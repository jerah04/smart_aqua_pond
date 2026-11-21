/*
 * SMART Aqua Pond - Drain Pump (Relay CH1) Test Sketch
 *
 * Hardware Connections:
 *   - Relay IN1  -> Arduino Uno R4 WiFi D4
 *   - Relay VCC  -> Breadboard + rail (LM2596S 5V)
 *   - Relay GND  -> Breadboard - rail (common with Arduino GND)
 *   - 12V +      -> Relay CH1 COM
 *   - Relay NO   -> Drain pump RED (+)
 *   - Pump BLACK -> 12V -
 *   - 1N4007 across pump (silver stripe -> pump +)
 *
 * Serial Monitor (115200 baud) commands:
 *   1 = Pump ON
 *   0 = Pump OFF
 *   p = Pulse pump for 3 seconds
 *
 * Safety: the pump turns OFF automatically after MAX_RUN_MS
 * so it can't run dry if you forget to stop it.
 */

const int RELAY_DRAIN_PIN = 4;     // Relay Channel 1 (IN1)

// Active-LOW relay module
const int RELAY_ON  = LOW;
const int RELAY_OFF = HIGH;

const unsigned long MAX_RUN_MS = 30000;  // Auto-off safety limit (30 s)
const unsigned long PULSE_MS   = 3000;   // Duration for 'p' command

bool pumpOn = false;
unsigned long pumpStartMs = 0;
unsigned long pumpLimitMs = MAX_RUN_MS;

void pumpStart(unsigned long limitMs) {
  digitalWrite(RELAY_DRAIN_PIN, RELAY_ON);
  pumpOn = true;
  pumpStartMs = millis();
  pumpLimitMs = limitMs;
  Serial.print(F("--> Drain pump ON (auto-off in "));
  Serial.print(limitMs / 1000);
  Serial.println(F(" s)"));
}

void pumpStop(const __FlashStringHelper* reason) {
  digitalWrite(RELAY_DRAIN_PIN, RELAY_OFF);
  pumpOn = false;
  Serial.print(F("--> Drain pump OFF ("));
  Serial.print(reason);
  Serial.println(F(")"));
}

void printMenu() {
  Serial.println(F("\n=== Drain Pump Test (Relay CH1 / D4) ==="));
  Serial.println(F("  1 = Pump ON"));
  Serial.println(F("  0 = Pump OFF"));
  Serial.println(F("  p = Pulse 3 seconds"));
  Serial.println(F("========================================"));
}

void setup() {
  // Drive HIGH (OFF) before enabling output so the relay doesn't click on boot
  digitalWrite(RELAY_DRAIN_PIN, RELAY_OFF);
  pinMode(RELAY_DRAIN_PIN, OUTPUT);

  Serial.begin(115200);
  unsigned long t = millis();
  while (!Serial && millis() - t < 3000) { ; }  // Don't hang if no USB

  printMenu();
}

void loop() {
  // Safety auto-off
  if (pumpOn && millis() - pumpStartMs >= pumpLimitMs) {
    pumpStop(F("timer"));
  }

  if (Serial.available() > 0) {
    char cmd = Serial.read();
    switch (cmd) {
      case '1':
        pumpStart(MAX_RUN_MS);
        break;
      case '0':
        pumpStop(F("manual"));
        break;
      case 'p':
      case 'P':
        pumpStart(PULSE_MS);
        break;
      case '\n':
      case '\r':
        break;
      default:
        printMenu();
        break;
    }
  }
}
