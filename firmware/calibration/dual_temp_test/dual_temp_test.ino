/*
 * SMART Aqua Pond - Dual DS18B20 Temperature Probes & Thermal Shock Guard
 * 
 * Hardware Connections:
 *   - Probe #1 (Main Tank):  Data to Arduino Uno R4 Pin D2 (with 4.7k pull-up to 5V)
 *   - Probe #2 (Reservoir):  Data to Arduino Uno R4 Pin D3 (with 4.7k pull-up to 5V)
 *   - VCC: 5V Rail
 *   - GND: Common Ground (GND)
 * 
 * Required Arduino Libraries (Install via Arduino IDE Library Manager):
 *   1. "OneWire" by Jim Studt, Paul Stoffregen
 *   2. "DallasTemperature" by Miles Burton
 * 
 * Purpose:
 *   Verifies both temperatures and prevents fish shock by calculating
 *   delta T (|T_tank - T_refill|). Refill pump should ONLY run if delta T <= 2.0°C.
 */

#include <OneWire.h>
#include <DallasTemperature.h>

const int TANK_TEMP_PIN = 2;     // Main tank probe
const int RESERVOIR_TEMP_PIN = 3; // Clean refill reservoir probe

// Maximum allowable temperature difference before refill is blocked (°C)
const float MAX_TEMP_DIFF_CELSIUS = 2.0;

OneWire oneWireTank(TANK_TEMP_PIN);
DallasTemperature tankSensor(&oneWireTank);

OneWire oneWireReservoir(RESERVOIR_TEMP_PIN);
DallasTemperature reservoirSensor(&oneWireReservoir);

void setup() {
  Serial.begin(115200);
  while (!Serial) { ; }

  tankSensor.begin();
  reservoirSensor.begin();

  // Set resolution to 10-bit (0.25°C precision, 187ms conversion time)
  tankSensor.setResolution(10);
  reservoirSensor.setResolution(10);

  Serial.println(F("=================================================="));
  Serial.println(F("  SMART Aqua Pond: Dual DS18B20 Temperature Test  "));
  Serial.println(F("=================================================="));
}

void loop() {
  tankSensor.requestTemperatures();
  reservoirSensor.requestTemperatures();

  float tTank = tankSensor.getTempCByIndex(0);
  float tRes  = reservoirSensor.getTempCByIndex(0);

  // Check for disconnected probe (DEVICE_DISCONNECTED_C = -127)
  bool tankValid = (tTank > -50.0 && tTank < 85.0);
  bool resValid  = (tRes > -50.0 && tRes < 85.0);

  Serial.print(F("Main Tank: "));
  if (tankValid) {
    Serial.print(tTank, 2);
    Serial.print(F(" °C"));
  } else {
    Serial.print(F("[DISCONNECTED/ERROR]"));
  }

  Serial.print(F(" | Reservoir: "));
  if (resValid) {
    Serial.print(tRes, 2);
    Serial.print(F(" °C"));
  } else {
    Serial.print(F("[DISCONNECTED/ERROR]"));
  }

  // Safety thermal shock check
  if (tankValid && resValid) {
    float diff = abs(tTank - tRes);
    Serial.print(F(" | ΔT: "));
    Serial.print(diff, 2);
    Serial.print(F(" °C"));

    if (diff > MAX_TEMP_DIFF_CELSIUS) {
      Serial.println(F(" [BLOCKED: High temp mismatch! Risk of shock]"));
    } else {
      Serial.println(F(" [SAFE: Temperature matched for refill]"));
    }
  } else {
    Serial.println();
  }

  // High temperature trigger for emergency aerator (> 30°C)
  if (tankValid && tTank > 30.0) {
    Serial.println(F(" --> [ALERT] High tank water temperature! Aerator should turn ON."));
  }

  delay(1500);
}
