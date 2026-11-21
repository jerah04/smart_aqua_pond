/*
 * SMART Aqua Pond - pH Sensor (PH-4502C) Calibration & Test Sketch
 * 
 * Hardware Connections:
 *   - PH-4502C Signal (Po) -> Arduino Uno R4 WiFi Analog Pin A0
 *   - PH-4502C VCC         -> 5V Rail (from breadboard / buck converter)
 *   - PH-4502C GND         -> Common Ground (GND)
 * 
 * Calibration Procedure with Buffers (pH 4.01, 6.86, 9.18):
 * -------------------------------------------------------------
 * 1. Midpoint Calibration (Offset):
 *    - Rinse probe in distilled water, dry gently with lint-free paper.
 *    - Submerge probe in pH 6.86 buffer powder solution.
 *    - Adjust the trimpot (potentiometer closest to the BNC connector)
 *      until the Serial Monitor reports ~2.50V (midpoint of 0-5V).
 * 
 * 2. Slope Calculation (Two-point verification):
 *    - Rinse probe, submerge in pH 4.01 acidic buffer. Note voltage (e.g., ~3.05V).
 *    - Rinse probe, submerge in pH 9.18 alkaline buffer. Note voltage (e.g., ~1.95V).
 *    - Enter these voltages below or in the Serial Monitor to determine exact slope.
 */

const int PH_PIN = A0;
const float ARDUINO_VOLTAGE = 5.0; // Uno R4 5V reference
const int ADC_RESOLUTION = 1024;   // Default 10-bit ADC (0-1023)

// Calibration values (Default starting estimates - adjust after testing)
float neutralVoltage = 2.50; // Voltage at pH 7.0 / 6.86 (after trimpot adjustment)
float phSlope = -3.50;       // Typical PH-4502C sensitivity: pH change per volt (~ -3.5 to -4.0)

// Moving average buffer for stable ADC readings
const int NUM_READINGS = 30;
int readIndex = 0;
float readings[NUM_READINGS];
float total = 0;

void setup() {
  Serial.begin(115200);
  while (!Serial) { ; } // Wait for serial monitor on Uno R4

  pinMode(PH_PIN, INPUT);

  // Initialize reading filter
  for (int i = 0; i < NUM_READINGS; i++) {
    readings[i] = analogRead(PH_PIN) * (ARDUINO_VOLTAGE / (ADC_RESOLUTION - 1));
    total += readings[i];
    delay(10);
  }

  Serial.println(F("=================================================="));
  Serial.println(F("  SMART Aqua Pond: PH-4502C Calibration & Test   "));
  Serial.println(F("=================================================="));
  Serial.println(F("Instructions:"));
  Serial.println(F("1. Dip probe in pH 6.86 buffer solution."));
  Serial.println(F("2. Turn trimpot until Output Voltage is ~2.50V."));
  Serial.println(F("3. Test with pH 4.01 and pH 9.18 to verify slope."));
  Serial.println(F("--------------------------------------------------"));
}

void loop() {
  // Read and apply moving average filter
  total = total - readings[readIndex];
  float rawV = analogRead(PH_PIN) * (ARDUINO_VOLTAGE / (ADC_RESOLUTION - 1));
  readings[readIndex] = rawV;
  total = total + readings[readIndex];
  readIndex = (readIndex + 1) % NUM_READINGS;

  float averageVoltage = total / NUM_READINGS;

  // Linear pH calculation: pH = 7.0 + ((V_neutral - V_measured) * slope)
  float calculatedPH = 7.0 + ((neutralVoltage - averageVoltage) * phSlope);

  // Print telemetry every 500ms
  static unsigned long lastPrint = 0;
  if (millis() - lastPrint >= 500) {
    lastPrint = millis();

    Serial.print(F("ADC Raw: "));
    Serial.print(analogRead(PH_PIN));
    Serial.print(F(" | Voltage: "));
    Serial.print(averageVoltage, 3);
    Serial.print(F(" V | Est. pH: "));
    Serial.print(calculatedPH, 2);

    // Evaluation guideline
    if (calculatedPH < 6.5) {
      Serial.println(F(" [ACIDIC - Caution for fish]"));
    } else if (calculatedPH > 8.5) {
      Serial.println(F(" [ALKALINE - Caution for fish]"));
    } else {
      Serial.println(F(" [OPTIMAL WATER RANGE]"));
    }
  }

  // Serial command interface for fast field adjustment
  if (Serial.available() > 0) {
    char cmd = Serial.read();
    if (cmd == 'c' || cmd == 'C') {
      neutralVoltage = averageVoltage;
      Serial.print(F("--> Midpoint calibrated! Set neutral voltage to: "));
      Serial.print(neutralVoltage, 3);
      Serial.println(F(" V"));
    }
  }
}
