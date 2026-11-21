/*
 * SMART Aqua Pond - Waterproof Ultrasonic (JSN-SR04T) Water Depth Test Sketch
 * 
 * Hardware Connections:
 *   - JSN-SR04T TRIG -> Arduino Uno R4 WiFi Digital Pin D7
 *   - JSN-SR04T ECHO -> Arduino Uno R4 WiFi Digital Pin D8
 *   - JSN-SR04T VCC  -> 5V Rail
 *   - JSN-SR04T GND  -> Common Ground (GND)
 * 
 * Physical Geometry Setup:
 * -------------------------------------------------------------
 * - SENSOR_MOUNT_HEIGHT_CM: Distance from the bottom of the tank to the sensor transducer.
 * - TANK_FULL_DEPTH_CM: Water depth when tank is 100% full.
 * 
 * Calculations:
 *   Distance Measured (d) = Air gap from sensor to water surface.
 *   Current Water Depth   = SENSOR_MOUNT_HEIGHT_CM - d
 *   Water Volume %        = (Current Water Depth / TANK_FULL_DEPTH_CM) * 100
 */

const int TRIG_PIN = 7;
const int ECHO_PIN = 8;

// Adjust these to match your actual physical aquarium and gantry measurements (in cm):
const float SENSOR_MOUNT_HEIGHT_CM = 50.0; // Distance from tank floor up to overhead sensor
const float TANK_FULL_DEPTH_CM      = 35.0; // Desired full water depth from tank floor
const float MIN_SAFE_WATER_DEPTH_CM = 20.0; // Minimum level before triggering drain pump cut-off

// Filter constants to eliminate water ripple noise
const int SAMPLE_COUNT = 7;

void setup() {
  Serial.begin(115200);
  while (!Serial) { ; }

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);

  Serial.println(F("=================================================="));
  Serial.println(F("  SMART Aqua Pond: JSN-SR04T Water Depth Test     "));
  Serial.println(F("=================================================="));
  Serial.print(F("Sensor Mount Height: ")); Serial.print(SENSOR_MOUNT_HEIGHT_CM); Serial.println(F(" cm"));
  Serial.print(F("Target Full Depth:   ")); Serial.print(TANK_FULL_DEPTH_CM); Serial.println(F(" cm"));
  Serial.println(F("--------------------------------------------------"));
}

// Function to take a single ultrasonic reading in cm
float getRawDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // Timeout set to 30000us (~5 meters max range)
  unsigned long duration = pulseIn(ECHO_PIN, HIGH, 30000);

  if (duration == 0) {
    return -1.0; // Out of range or echo lost
  }
  // Speed of sound = 343 m/s = 0.0343 cm/microsecond. Divide by 2 for round-trip.
  return (duration * 0.0343) / 2.0;
}

// Median filtering to reject water surface ripples and air bubbles
float getFilteredDistance() {
  float readings[SAMPLE_COUNT];
  int validCount = 0;

  for (int i = 0; i < SAMPLE_COUNT; i++) {
    float d = getRawDistance();
    if (d > 15.0 && d < 200.0) { // JSN-SR04T blind zone is <20cm typically
      readings[validCount++] = d;
    }
    delay(30);
  }

  if (validCount == 0) return -1.0;

  // Simple bubble sort to find median
  for (int i = 0; i < validCount - 1; i++) {
    for (int j = i + 1; j < validCount; j++) {
      if (readings[i] > readings[j]) {
        float temp = readings[i];
        readings[i] = readings[j];
        readings[j] = temp;
      }
    }
  }
  return readings[validCount / 2];
}

void loop() {
  float distance = getFilteredDistance();

  if (distance < 0) {
    Serial.println(F("[WARNING] Sensor out of range or echo timed out."));
  } else {
    float waterDepth = SENSOR_MOUNT_HEIGHT_CM - distance;
    if (waterDepth < 0) waterDepth = 0;

    float fillPercentage = (waterDepth / TANK_FULL_DEPTH_CM) * 100.0;
    if (fillPercentage > 100.0) fillPercentage = 100.0;

    Serial.print(F("Air Gap: "));
    Serial.print(distance, 1);
    Serial.print(F(" cm | Water Depth: "));
    Serial.print(waterDepth, 1);
    Serial.print(F(" cm | Tank Fill: "));
    Serial.print(fillPercentage, 1);
    Serial.print(F("%"));

    if (waterDepth < MIN_SAFE_WATER_DEPTH_CM) {
      Serial.println(F(" [ALERT: LOW WATER LEVEL - DRAIN CUTOFF]"));
    } else if (fillPercentage >= 95.0) {
      Serial.println(F(" [FULL - REFILL COMPLETE]"));
    } else {
      Serial.println(F(" [NORMAL]"));
    }
  }

  delay(1000);
}
