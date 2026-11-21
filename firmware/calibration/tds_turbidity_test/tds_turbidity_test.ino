/*
 * SMART Aqua Pond - TDS & Turbidity Sensor Calibration & Test Sketch
 * 
 * Hardware Connections:
 *   - Gravity TDS Signal     -> Arduino Uno R4 WiFi Analog Pin A1
 *   - TS-300B Turbidity Out  -> Arduino Uno R4 WiFi Analog Pin A2
 *   - VCC: 5V Rail
 *   - GND: Common Ground (GND)
 * 
 * Notes:
 *   1. TDS reading relies on water temperature for compensation (standardized to 25°C).
 *   2. Turbidity sensor (TS-300B):
 *      - High voltage (~4.0V - 4.5V) indicates clear, transparent water.
 *      - Lower voltage (<2.5V - 3.0V) indicates suspended solids/cloudy water.
 */

const int TDS_PIN = A1;
const int TURBIDITY_PIN = A2;
const float VREF = 5.0; // Arduino Uno R4 5V reference

// Estimated water temperature for TDS compensation (in °C)
// (In the final integrated firmware, this is fed directly from DS18B20 #1)
float waterTempC = 25.0;

// Number of sample points for rolling average
const int SAMPLE_POINTS = 30;

void setup() {
  Serial.begin(115200);
  while (!Serial) { ; }

  pinMode(TDS_PIN, INPUT);
  pinMode(TURBIDITY_PIN, INPUT);

  Serial.println(F("=================================================="));
  Serial.println(F("  SMART Aqua Pond: TDS & Turbidity Testing        "));
  Serial.println(F("=================================================="));
  Serial.println(F("Testing TDS (Pin A1) and Turbidity (Pin A2)..."));
  Serial.println(F("--------------------------------------------------"));
}

float readAverageVoltage(int pin) {
  long sum = 0;
  for (int i = 0; i < SAMPLE_POINTS; i++) {
    sum += analogRead(pin);
    delay(5);
  }
  float avgAdc = (float)sum / SAMPLE_POINTS;
  return avgAdc * (VREF / 1023.0);
}

float calculateTDS(float voltage, float tempC) {
  // Temperature compensation formula (standardized to 25.0 °C)
  float compensationCoefficient = 1.0 + 0.02 * (tempC - 25.0);
  float compVoltage = voltage / compensationCoefficient;

  // Polynomial curve for Gravity TDS probe
  float tds = (133.42 * compVoltage * compVoltage * compVoltage 
             - 255.86 * compVoltage * compVoltage 
             + 857.39 * compVoltage) * 0.5;

  if (tds < 0) tds = 0;
  return tds;
}

void loop() {
  float tdsVoltage = readAverageVoltage(TDS_PIN);
  float tdsPpm     = calculateTDS(tdsVoltage, waterTempC);

  float turbVoltage = readAverageVoltage(TURBIDITY_PIN);

  // Turbidity qualitative classification
  String clarity;
  if (turbVoltage > 3.8) {
    clarity = "Very Clear (Normal)";
  } else if (turbVoltage > 3.0) {
    clarity = "Moderate Clarity";
  } else if (turbVoltage > 2.5) {
    clarity = "Slightly Cloudy (Monitor)";
  } else {
    clarity = "Cloudy / Dirty (Trigger Water Change)";
  }

  // Print results
  Serial.print(F("TDS: "));
  Serial.print(tdsVoltage, 2);
  Serial.print(F("V ("));
  Serial.print(tdsPpm, 0);
  Serial.print(F(" ppm)"));

  Serial.print(F(" | Turbidity: "));
  Serial.print(turbVoltage, 2);
  Serial.print(F("V -> "));
  Serial.println(clarity);

  delay(1000);
}
