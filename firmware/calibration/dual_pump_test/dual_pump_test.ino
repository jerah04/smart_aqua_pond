/*
 * SMART Aqua Pond - Dedicated Drain & Refill Pump Controller
 *
 * Serial Monitor Commands (115200 baud):
 *   [1] -> Drain ON
 *   [0] -> Drain OFF
 *   [2] -> Refill ON
 *   [9] -> Refill OFF
 *   [3] -> BOTH Drain & Refill ON
 *   [S] -> STOP ALL (Both OFF)
 *   [A] -> Toggle 30s Auto-Stop Timer ON / OFF (Default: OFF = Continuous Run)
 */

#include <Servo.h>

const int RELAY_DRAIN_PIN  = 4;  // IN1 -> Digital Pin 4
const int RELAY_REFILL_PIN = 5;  // IN2 -> Digital Pin 5
const int SERVO_FEEDER_PIN = 9;  // Feeder Servo -> Digital Pin 9

Servo feederServo;

// Active-LOW relay definitions (LOW = Relay ON, HIGH = Relay OFF)
const int RELAY_ON  = LOW;
const int RELAY_OFF = HIGH;

const unsigned long MAX_RUN_MS = 30000; // Optional 30-second timer

bool autoStopEnabled = false; // Default FALSE: pumps stay ON until you turn them OFF!

bool drainActive = false;
unsigned long drainStartMs = 0;

bool refillActive = false;
unsigned long refillStartMs = 0;

void printMenu() {
  Serial.println(F("\n================================================"));
  Serial.println(F("     SMART Aqua Pond: Dual Pump Controller      "));
  Serial.println(F("================================================"));
  Serial.println(F(" DRAIN PUMP (IN1 / Pin 4):"));
  Serial.println(F("   [1] -> Drain ON"));
  Serial.println(F("   [0] -> Drain OFF"));
  Serial.println(F(""));
  Serial.println(F(" REFILL PUMP (IN2 / Pin 5):"));
  Serial.println(F("   [2] -> Refill ON"));
  Serial.println(F("   [9] -> Refill OFF"));
  Serial.println(F(""));
  Serial.println(F(" COMBINED CONTROLS:"));
  Serial.println(F("   [3] -> BOTH Drain & Refill ON"));
  Serial.println(F("   [S] -> STOP ALL PUMPS (Both OFF)"));
  Serial.println(F(""));
  Serial.print(F(" AUTO-STOP TIMER (30s): "));
  Serial.println(autoStopEnabled ? F("ENABLED") : F("DISABLED (Continuous Run)"));
  Serial.println(F("   [A] -> Toggle Auto-Stop Timer ON / OFF"));
  Serial.println(F("================================================"));
}

void startDrain() {
  Serial.println(F("--> [DRAIN PUMP] ON"));
  Serial.flush();
  delay(50);

  digitalWrite(RELAY_DRAIN_PIN, RELAY_ON);
  drainActive = true;
  drainStartMs = millis();
}

void stopDrain() {
  digitalWrite(RELAY_DRAIN_PIN, RELAY_OFF);
  drainActive = false;

  delay(50);
  Serial.println(F("--> [DRAIN PUMP] OFF"));
  Serial.flush();
}

void startRefill() {
  Serial.println(F("--> [REFILL PUMP] ON"));
  Serial.flush();
  delay(50);

  digitalWrite(RELAY_REFILL_PIN, RELAY_ON);
  refillActive = true;
  refillStartMs = millis();
}

void stopRefill() {
  digitalWrite(RELAY_REFILL_PIN, RELAY_OFF);
  refillActive = false;

  delay(50);
  Serial.println(F("--> [REFILL PUMP] OFF"));
  Serial.flush();
}

void startBoth() {
  Serial.println(F("--> [BOTH PUMPS: DRAIN & REFILL] ON"));
  Serial.flush();
  delay(50);

  digitalWrite(RELAY_DRAIN_PIN, RELAY_ON);
  drainActive = true;
  drainStartMs = millis();

  delay(150); // Stagger by 150ms so both motors don't surge at the exact same millisecond

  digitalWrite(RELAY_REFILL_PIN, RELAY_ON);
  refillActive = true;
  refillStartMs = millis();
}

void stopAll() {
  digitalWrite(RELAY_DRAIN_PIN, RELAY_OFF);
  digitalWrite(RELAY_REFILL_PIN, RELAY_OFF);
  drainActive = false;
  refillActive = false;
  feederServo.write(90); // Actively hold 360° servo at STOP

  delay(50);
  Serial.println(F("!!! [ALL PUMPS STOPPED] !!!"));
  Serial.flush();
}

void toggleAutoStop() {
  autoStopEnabled = !autoStopEnabled;
  // Reset timers from now if just enabled
  drainStartMs = millis();
  refillStartMs = millis();
  Serial.print(F("--> Auto-Stop (30s) is now: "));
  Serial.println(autoStopEnabled ? F("ENABLED") : F("DISABLED (Continuous Run)"));
}

void setup() {
  // Actively hold 360° servo at STOP (90) so floating noise doesn't spin it
  feederServo.attach(SERVO_FEEDER_PIN);
  feederServo.write(90);

  // Force pins HIGH (OFF) both BEFORE and AFTER pinMode so relays stay OFF at startup
  digitalWrite(RELAY_DRAIN_PIN, RELAY_OFF);
  digitalWrite(RELAY_REFILL_PIN, RELAY_OFF);

  pinMode(RELAY_DRAIN_PIN, OUTPUT);
  pinMode(RELAY_REFILL_PIN, OUTPUT);

  digitalWrite(RELAY_DRAIN_PIN, RELAY_OFF);
  digitalWrite(RELAY_REFILL_PIN, RELAY_OFF);

  Serial.begin(115200);
  unsigned long t = millis();
  while (!Serial && millis() - t < 3000) { ; }

  printMenu();
}

void loop() {
  // Only auto-stop if autoStopEnabled is true
  if (autoStopEnabled) {
    if (drainActive && (millis() - drainStartMs >= MAX_RUN_MS)) {
      stopDrain();
      Serial.println(F("[AUTO-STOP TIMER: Drain stopped after 30s]"));
    }

    if (refillActive && (millis() - refillStartMs >= MAX_RUN_MS)) {
      stopRefill();
      Serial.println(F("[AUTO-STOP TIMER: Refill stopped after 30s]"));
    }
  }

  if (Serial.available() > 0) {
    char cmd = Serial.read();

    switch (cmd) {
      case '1':
        startDrain();
        break;
      case '0':
        stopDrain();
        break;

      case '2':
        startRefill();
        break;
      case '9':
        stopRefill();
        break;

      case '3':
      case 'b':
      case 'B':
        startBoth();
        break;

      case 's':
      case 'S':
        stopAll();
        break;

      case 'a':
      case 'A':
        toggleAutoStop();
        break;

      case '\n':
      case '\r':
      case ' ':
        break;

      default:
        printMenu();
        break;
    }
  }
}
