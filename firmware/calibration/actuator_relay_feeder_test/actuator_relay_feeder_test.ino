/*
 * SMART Aqua Pond - Actuators & Relay Safety Test Sketch
 * 
 * Hardware Connections:
 *   - Relay CH1 (Drain Pump)       -> Arduino Uno R4 WiFi Digital Pin D4
 *   - Relay CH2 (Refill Pump)      -> Arduino Uno R4 WiFi Digital Pin D5
 *   - Relay CH3 (Aerator Pump)     -> Arduino Uno R4 WiFi Digital Pin D6
 *   - Feeder Servo (MG996R Signal) -> Arduino Uno R4 WiFi Digital Pin D9
 * 
 * Power Connections:
 *   - Servo VCC & Relay VCC -> 5V Output of LM2596S Buck Converter (NOT Arduino 5V!)
 *   - Common Ground         -> Tied to Arduino GND & 12V Supply GND
 * 
 * Safety Features:
 *   1. Relays are Active-LOW: pins are driven HIGH prior to pinMode() to prevent clicking on boot.
 *   2. Auto-shutoff safety timer on pumps (max 3 seconds test burst) to prevent dry-running.
 *   3. Interactive Serial Monitor controls.
 */

#include <Servo.h>

const int RELAY_DRAIN_PIN   = 4; // Relay Channel 1
const int RELAY_REFILL_PIN  = 5; // Relay Channel 2
const int RELAY_AERATOR_PIN = 6; // Relay Channel 3
const int SERVO_FEEDER_PIN  = 9; // TowerPro MG996R Servo

// Active-LOW relay definitions
const int RELAY_ON  = LOW;
const int RELAY_OFF = HIGH;

Servo feederServo;
bool aeratorState = false;

void setup() {
  // CRITICAL: Set relay outputs HIGH before AND after pinMode (Uno R4 RA4M1 resets pins LOW inside pinMode)
  digitalWrite(RELAY_DRAIN_PIN, RELAY_OFF);
  digitalWrite(RELAY_REFILL_PIN, RELAY_OFF);
  digitalWrite(RELAY_AERATOR_PIN, RELAY_OFF);

  pinMode(RELAY_DRAIN_PIN, OUTPUT);
  pinMode(RELAY_REFILL_PIN, OUTPUT);
  pinMode(RELAY_AERATOR_PIN, OUTPUT);

  digitalWrite(RELAY_DRAIN_PIN, RELAY_OFF);
  digitalWrite(RELAY_REFILL_PIN, RELAY_OFF);
  digitalWrite(RELAY_AERATOR_PIN, RELAY_OFF);

  // Setup Feeder Servo (360° Continuous: Keep attached with write(90) to actively lock motor at STOP)
  feederServo.attach(SERVO_FEEDER_PIN);
  feederServo.write(90); // 90 = STOP (actively holds motor stopped)

  Serial.begin(115200);
  while (!Serial) { ; }

  printMenu();
}

void printMenu() {
  Serial.println(F("\n=================================================="));
  Serial.println(F("   SMART Aqua Pond: Actuator & Relay Diagnostic   "));
  Serial.println(F("=================================================="));
  Serial.println(F("Send one of the following commands in Serial Monitor:"));
  Serial.println(F("  [1] - Pulse DRAIN Pump (3 sec safety run)"));
  Serial.println(F("  [2] - Pulse REFILL Pump (3 sec safety run)"));
  Serial.println(F("  [3] - Toggle AERATOR Air Pump (ON / OFF)"));
  Serial.println(F("  [F] - Dispense Feed (MG996R Servo cycle)"));
  Serial.println(F("  [X] - EMERGENCY STOP (All OFF)"));
  Serial.println(F("--------------------------------------------------"));
}

void dispenseFood() {
  Serial.println(F("--> Actuating Feeder: Spinning 360° servo to dispense pellets..."));
  feederServo.write(180); // Spin 360° servo forward (adjust between 100-180 for desired speed)
  delay(1200);            // Duration to dispense pellets
  feederServo.write(90);  // 90 = STOP command for 360° continuous rotation servo!
  Serial.println(F("--> Feeder stopped. Feeding cycle complete."));
}

void pulsePump(int pin, const char* pumpName) {
  Serial.print(F("--> Starting "));
  Serial.print(pumpName);
  Serial.println(F(" for 3 seconds..."));

  digitalWrite(pin, RELAY_ON);
  delay(3000); // 3 seconds safety burst
  digitalWrite(pin, RELAY_OFF);

  Serial.print(F("--> "));
  Serial.print(pumpName);
  Serial.println(F(" stopped."));
}

void emergencyStop() {
  digitalWrite(RELAY_DRAIN_PIN, RELAY_OFF);
  digitalWrite(RELAY_REFILL_PIN, RELAY_OFF);
  digitalWrite(RELAY_AERATOR_PIN, RELAY_OFF);
  feederServo.write(90); // Actively lock 360° servo at STOP
  aeratorState = false;
  Serial.println(F("!!! EMERGENCY STOP EXECUTED: All relays and servo OFF !!!"));
}

void loop() {
  if (Serial.available() > 0) {
    char cmd = Serial.read();

    switch (cmd) {
      case '1':
        pulsePump(RELAY_DRAIN_PIN, "Drain Pump (Relay CH1)");
        break;

      case '2':
        pulsePump(RELAY_REFILL_PIN, "Refill Pump (Relay CH2)");
        break;

      case '3':
        aeratorState = !aeratorState;
        digitalWrite(RELAY_AERATOR_PIN, aeratorState ? RELAY_ON : RELAY_OFF);
        Serial.print(F("--> Aerator is now: "));
        Serial.println(aeratorState ? F("ACTIVE [ON]") : F("INACTIVE [OFF]"));
        break;

      case 'f':
      case 'F':
        dispenseFood();
        break;

      case 'x':
      case 'X':
        emergencyStop();
        break;

      case '\n':
      case '\r':
        // Ignore carriage returns
        break;

      default:
        Serial.println(F("Invalid command."));
        printMenu();
        break;
    }
  }
}
