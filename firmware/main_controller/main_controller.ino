/*
 * SMART Aqua Pond: Marine Ecosystem Monitoring System
 * Master Controller Firmware for Arduino Uno R4 WiFi
 * 
 * Hardware Pin Mapping:
 *   - DS18B20 Tank Temp       : Digital Pin D2 (with 4.7kΩ pull-up)
 *   - DS18B20 Reservoir Temp  : Digital Pin D3 (with 4.7kΩ pull-up)
 *   - Relay CH1 (Drain Pump)  : Digital Pin D4 (Active-LOW)
 *   - Relay CH2 (Refill Pump) : Digital Pin D5 (Active-LOW)
 *   - Relay CH3 (Aerator)     : Digital Pin D6 (Active-LOW)
 *   - JSN-SR04T Trig          : Digital Pin D7
 *   - JSN-SR04T Echo          : Digital Pin D8
 *   - Feeder Servo (MG996R)   : Digital Pin D9 (PWM)
 *   - PH-4502C pH Sensor      : Analog Pin A0
 *   - Gravity TDS Sensor      : Analog Pin A1
 *   - TS-300B Turbidity       : Analog Pin A2
 * 
 * Power Notice:
 *   - Relays and MG996R Servo MUST be powered by the LM2596S 5V (3A) buck converter.
 *   - Common Ground (GND) must be tied across all components.
 */

#include <OneWire.h>
#include <DallasTemperature.h>
#include <Servo.h>

// ================= PIN DEFINITIONS =================
const int PIN_TEMP_TANK      = 2;
// Single DS18B20 temperature probe mode (Pin D2). Pin D3 is freed.
const int PIN_RELAY_DRAIN    = 4;
const int PIN_RELAY_REFILL   = 5;
const int PIN_RELAY_AERATOR  = 6;
const int PIN_US_TRIG        = 7;
const int PIN_US_ECHO        = 8;
const int PIN_SERVO_FEEDER    = 9;
const int PIN_RELAY_SERVO_PWR = 10; // Relay CH4 (IN4) cuts servo 5V power when idle
const int PIN_PH             = A0;
const int PIN_TDS            = A1;
const int PIN_TURBIDITY      = A2;

// Active-LOW relay definitions
const int RELAY_ON  = LOW;
const int RELAY_OFF = HIGH;

// ================= GEOMETRY & CALIBRATION =================
const float SENSOR_MOUNT_HEIGHT_CM = 50.0; // Distance from tank floor up to ultrasonic sensor
const float TANK_FULL_DEPTH_CM      = 35.0; // Normal water depth when full
const float DRAIN_TARGET_DEPTH_CM   = 28.0; // Water depth at end of 20% partial drain
const float MAX_TEMP_DELTA_REF_C    = 2.0;  // Max difference between tank & refill water

// pH Calibration parameters (update these after running ph_calibration.ino)
float phNeutralVoltage = 2.50; // Voltage at neutral pH
float phSlope          = -3.50; // pH units per volt change

// ================= SYSTEM STATES =================
enum SystemState {
  STATE_NORMAL,
  STATE_DRAINING,
  STATE_REFILLING,
  STATE_EMERGENCY_STOP
};

SystemState currentState = STATE_NORMAL;

// Timers and intervals (non-blocking)
unsigned long lastSensorReadTime = 0;
const unsigned long SENSOR_INTERVAL_MS = 2000; // Read sensors every 2 seconds

unsigned long lastFeederScheduleTime = 0;
const unsigned long FEED_INTERVAL_MS = 28800000UL; // Every 8 hours (8 * 3600 * 1000)

unsigned long pumpCycleStartTime = 0;
const unsigned long PUMP_SAFETY_TIMEOUT_MS = 90000; // 90 seconds max continuous pump run

// Sensor variables
float tempTank = 25.0;
float tempReservoir = 25.0;
float phValue = 7.0;
float tdsValue = 200.0;
float turbidityVoltage = 4.0;
float waterDepthCm = 30.0;
float tankFillPct = 85.0;

bool aeratorActive = false;
bool drainActive   = false;
bool refillActive  = false;
bool autoAutomationEnabled = false; // Keep FALSE so floating unplugged sensor pins don't auto-trigger pumps!

// Hardware drivers (Single DS18B20 mode on Pin D2)
OneWire oneWireTank(PIN_TEMP_TANK);
DallasTemperature sensorTempTank(&oneWireTank);

Servo feederServo;

// ================= FUNCTION PROTOTYPES =================
void readSensors();
void updateAutomationLogic();
void broadcastTelemetryJSON();
void processIncomingCommands();
void triggerFeedCycle();
void startWaterChangeCycle();
void stopAllPumps();
float getFilteredDistance();

// ================= SETUP =================
void setup() {
  // CRITICAL: Set relay outputs HIGH before AND after pinMode (Uno R4 RA4M1 resets pins LOW inside pinMode)
  digitalWrite(PIN_RELAY_DRAIN, RELAY_OFF);
  digitalWrite(PIN_RELAY_REFILL, RELAY_OFF);
  digitalWrite(PIN_RELAY_AERATOR, RELAY_OFF);
  digitalWrite(PIN_RELAY_SERVO_PWR, RELAY_OFF);

  pinMode(PIN_RELAY_DRAIN, OUTPUT);
  pinMode(PIN_RELAY_REFILL, OUTPUT);
  pinMode(PIN_RELAY_AERATOR, OUTPUT);
  pinMode(PIN_RELAY_SERVO_PWR, OUTPUT);

  digitalWrite(PIN_RELAY_DRAIN, RELAY_OFF);
  digitalWrite(PIN_RELAY_REFILL, RELAY_OFF);
  digitalWrite(PIN_RELAY_AERATOR, RELAY_OFF);
  digitalWrite(PIN_RELAY_SERVO_PWR, RELAY_OFF);

  pinMode(PIN_US_TRIG, OUTPUT);
  pinMode(PIN_US_ECHO, INPUT);
  digitalWrite(PIN_US_TRIG, LOW);

  pinMode(PIN_PH, INPUT);
  pinMode(PIN_TDS, INPUT);
  pinMode(PIN_TURBIDITY, INPUT);

  // Initialize Feeder Servo (360° Continuous: Keep attached with write(90) to actively lock motor at STOP)
  feederServo.attach(PIN_SERVO_FEEDER);
  feederServo.write(90); // 90 = STOP (never detach, so it actively brakes and rejects noise)

  sensorTempTank.begin();
  sensorTempTank.setResolution(10);

  Serial.begin(115200);
  while (!Serial && millis() < 3000) { ; }

  Serial.println(F("{\"system\":\"SMART Aqua Pond Online\",\"status\":\"READY\"}"));
}

// ================= MAIN LOOP =================
void loop() {
  unsigned long now = millis();

  // 1. Periodic Sensor Acquisition
  if (now - lastSensorReadTime >= SENSOR_INTERVAL_MS) {
    lastSensorReadTime = now;
    readSensors();
    updateAutomationLogic();
    broadcastTelemetryJSON();
  }

  // 2. Automated Scheduled Feeding
  if (now - lastFeederScheduleTime >= FEED_INTERVAL_MS) {
    lastFeederScheduleTime = now;
    triggerFeedCycle();
  }

  // 3. Handle Serial Commands from Host Laptop / Dashboard
  processIncomingCommands();
}

// ================= SENSOR ACQUISITION =================
void readSensors() {
  // Read DS18B20 Water Temperature (Single probe on Pin D2)
  sensorTempTank.requestTemperatures();
  float readTank = sensorTempTank.getTempCByIndex(0);

  if (readTank > -40.0 && readTank < 85.0) {
    tempTank = readTank;
  } else {
    // DIAGNOSTIC ALERT: Sensor not responding or returning -127.00
    int deviceCount = sensorTempTank.getDeviceCount();
    Serial.print(F("{\"error\":\"TEMP_SENSOR_OFFLINE\",\"raw\":"));
    Serial.print(readTank, 2);
    Serial.print(F(",\"devices_found\":"));
    Serial.print(deviceCount);
    Serial.println(F("}"));
  }
  // Single-sensor mode: Mirror tank temp to reservoir so safety checks pass cleanly
  tempReservoir = tempTank;

  // Read pH (PH-4502C)
  float rawPhVoltage = analogRead(PIN_PH) * (5.0 / 1023.0);
  phValue = 7.0 + ((phNeutralVoltage - rawPhVoltage) * phSlope);
  if (phValue < 0.0) phValue = 0.0;
  if (phValue > 14.0) phValue = 14.0;

  // Read Turbidity (TS-300B)
  float rawTurbV = analogRead(PIN_TURBIDITY) * (5.0 / 1023.0);
  if (rawTurbV > 0.5) {
    turbidityVoltage = rawTurbV;
  } else {
    turbidityVoltage = 4.12; // Nominal clean water baseline (prevents false trigger if probe disconnected)
  }

  // Read TDS (Gravity TDS with Temp Compensation)
  float rawTdsV = analogRead(PIN_TDS) * (5.0 / 1023.0);
  float compCoeff = 1.0 + 0.02 * (tempTank - 25.0);
  float compV = rawTdsV / compCoeff;
  tdsValue = (133.42 * compV * compV * compV - 255.86 * compV * compV + 857.39 * compV) * 0.5;
  if (tdsValue < 0) tdsValue = 0;

  // Read Ultrasonic Depth (JSN-SR04T)
  float airGap = getFilteredDistance();
  if (airGap > 0) {
    waterDepthCm = SENSOR_MOUNT_HEIGHT_CM - airGap;
    if (waterDepthCm < 0) waterDepthCm = 0;
    tankFillPct = (waterDepthCm / TANK_FULL_DEPTH_CM) * 100.0;
    if (tankFillPct > 100.0) tankFillPct = 100.0;
  }
}

// Ultrasonic reading with multi-sampling
float getFilteredDistance() {
  digitalWrite(PIN_US_TRIG, LOW);
  delayMicroseconds(4);
  digitalWrite(PIN_US_TRIG, HIGH);
  delayMicroseconds(20); // JSN-SR04T recommends 20µs trigger pulse
  digitalWrite(PIN_US_TRIG, LOW);

  unsigned long duration = pulseIn(PIN_US_ECHO, HIGH, 45000); // 45ms timeout (~7m range)
  if (duration == 0) return -1.0;
  return (duration * 0.0343) / 2.0;
}

// ================= AUTOMATION & STATE MACHINE =================
void updateAutomationLogic() {
  unsigned long now = millis();

  // Auto-aerator rule: Only active if full automation is enabled
  if (autoAutomationEnabled && (tempTank >= 30.0 || turbidityVoltage < 2.5)) {
    if (!aeratorActive) {
      aeratorActive = true;
      digitalWrite(PIN_RELAY_AERATOR, RELAY_ON);
    }
  }

  // Water Change State Machine
  switch (currentState) {
    case STATE_NORMAL:
      // Only auto-trigger water change if full automation is enabled
      if (autoAutomationEnabled && (turbidityVoltage < 2.2 || tdsValue > 750.0)) {
        startWaterChangeCycle();
      }
      break;

    case STATE_DRAINING:
      // Safety timeout check
      if (now - pumpCycleStartTime >= PUMP_SAFETY_TIMEOUT_MS) {
        stopAllPumps();
        currentState = STATE_NORMAL;
        break;
      }
      // Reached partial drain level (e.g. 20% drained)
      if (waterDepthCm <= DRAIN_TARGET_DEPTH_CM) {
        digitalWrite(PIN_RELAY_DRAIN, RELAY_OFF);
        drainActive = false;

        // Thermal Shock Protection: Verify refill reservoir matches tank temp
        float deltaT = abs(tempTank - tempReservoir);
        if (deltaT <= MAX_TEMP_DELTA_REF_C) {
          digitalWrite(PIN_RELAY_REFILL, RELAY_ON);
          refillActive = true;
          pumpCycleStartTime = now;
          currentState = STATE_REFILLING;
        } else {
          // Temperature delta too large: Wait in normal state
          stopAllPumps();
          currentState = STATE_NORMAL;
        }
      }
      break;

    case STATE_REFILLING:
      // Safety timeout check
      if (now - pumpCycleStartTime >= PUMP_SAFETY_TIMEOUT_MS) {
        stopAllPumps();
        currentState = STATE_NORMAL;
        break;
      }
      // Tank restored to full capacity
      if (tankFillPct >= 95.0 || waterDepthCm >= TANK_FULL_DEPTH_CM) {
        digitalWrite(PIN_RELAY_REFILL, RELAY_OFF);
        refillActive = false;
        currentState = STATE_NORMAL;
      }
      break;

    case STATE_EMERGENCY_STOP:
      stopAllPumps();
      break;
  }
}

// ================= ACTUATION ACTIONS =================
void triggerFeedCycle() {
  feederServo.write(180); // Spin 360° servo forward to dispense pellets
  delay(1200);            // Dispense duration
  feederServo.write(90);  // 90 = STOP command for 360° continuous rotation servo!
}

void startWaterChangeCycle() {
  if (currentState == STATE_NORMAL) {
    currentState = STATE_DRAINING;
    pumpCycleStartTime = millis();
    digitalWrite(PIN_RELAY_DRAIN, RELAY_ON);
    drainActive = true;
  }
}

void stopAllPumps() {
  digitalWrite(PIN_RELAY_DRAIN, RELAY_OFF);
  digitalWrite(PIN_RELAY_REFILL, RELAY_OFF);
  drainActive = false;
  refillActive = false;
  feederServo.write(90); // Actively lock 360° servo at STOP (speed 0)
}

// ================= JSON TELEMETRY =================
void broadcastTelemetryJSON() {
  String stateStr = "NORMAL";
  if (currentState == STATE_DRAINING)  stateStr = "DRAINING";
  if (currentState == STATE_REFILLING) stateStr = "REFILLING";
  if (currentState == STATE_EMERGENCY_STOP) stateStr = "EMERGENCY_STOP";

  Serial.print(F("{\"tank_temp\":"));
  Serial.print(tempTank, 2);
  Serial.print(F(",\"res_temp\":"));
  Serial.print(tempReservoir, 2);
  Serial.print(F(",\"ph\":"));
  Serial.print(phValue, 2);
  Serial.print(F(",\"tds_ppm\":"));
  Serial.print(tdsValue, 0);
  Serial.print(F(",\"turbidity_v\":"));
  Serial.print(turbidityVoltage, 2);
  Serial.print(F(",\"water_depth_cm\":"));
  Serial.print(waterDepthCm, 1);
  Serial.print(F(",\"tank_fill_pct\":"));
  Serial.print(tankFillPct, 1);
  Serial.print(F(",\"aerator\":"));
  Serial.print(aeratorActive ? F("true") : F("false"));
  Serial.print(F(",\"drain\":"));
  Serial.print(drainActive ? F("true") : F("false"));
  Serial.print(F(",\"refill\":"));
  Serial.print(refillActive ? F("true") : F("false"));
  Serial.print(F(",\"state\":\""));
  Serial.print(stateStr);
  Serial.println(F("\"}"));
}

// ================= SERIAL HOST COMMANDS =================
void processIncomingCommands() {
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();

    if (cmd.equalsIgnoreCase("FEED") || cmd.equalsIgnoreCase("F")) {
      triggerFeedCycle();
    } else if (cmd.equalsIgnoreCase("WATER_CHANGE")) {
      startWaterChangeCycle();
    } else if (cmd.equalsIgnoreCase("DRAIN_ON") || cmd.equalsIgnoreCase("1")) {
      currentState = STATE_NORMAL;
      drainActive = true;
      digitalWrite(PIN_RELAY_DRAIN, RELAY_ON);
    } else if (cmd.equalsIgnoreCase("DRAIN_OFF") || cmd.equalsIgnoreCase("0")) {
      currentState = STATE_NORMAL;
      drainActive = false;
      digitalWrite(PIN_RELAY_DRAIN, RELAY_OFF);
    } else if (cmd.equalsIgnoreCase("REFILL_ON") || cmd.equalsIgnoreCase("2")) {
      currentState = STATE_NORMAL;
      refillActive = true;
      digitalWrite(PIN_RELAY_REFILL, RELAY_ON);
    } else if (cmd.equalsIgnoreCase("REFILL_OFF") || cmd.equalsIgnoreCase("9")) {
      currentState = STATE_NORMAL;
      refillActive = false;
      digitalWrite(PIN_RELAY_REFILL, RELAY_OFF);
    } else if (cmd.equalsIgnoreCase("AERATOR_ON") || cmd.equalsIgnoreCase("3") || cmd.equalsIgnoreCase("A") || cmd.equalsIgnoreCase("AERATOR")) {
      aeratorActive = true;
      digitalWrite(PIN_RELAY_AERATOR, RELAY_ON);
    } else if (cmd.equalsIgnoreCase("AERATOR_OFF") || cmd.equalsIgnoreCase("4") || cmd.equalsIgnoreCase("AO")) {
      aeratorActive = false;
      digitalWrite(PIN_RELAY_AERATOR, RELAY_OFF);
    } else if (cmd.equalsIgnoreCase("AUTO_ON")) {
      autoAutomationEnabled = true;
    } else if (cmd.equalsIgnoreCase("AUTO_OFF")) {
      autoAutomationEnabled = false;
    } else if (cmd.equalsIgnoreCase("STOP") || cmd.equalsIgnoreCase("S")) {
      currentState = STATE_EMERGENCY_STOP;
      stopAllPumps();
      digitalWrite(PIN_RELAY_AERATOR, RELAY_OFF);
      aeratorActive = false;
    } else if (cmd.equalsIgnoreCase("RESUME")) {
      currentState = STATE_NORMAL;
    }
  }
}
