CREATE DATABASE IF NOT EXISTS smart_aqua_pond
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE smart_aqua_pond;

-- Drop existing prototype tables in reverse dependency order so re-running schema.sql cleanly updates columns
DROP TABLE IF EXISTS feeding_events;
DROP TABLE IF EXISTS devices;
DROP TABLE IF EXISTS alerts;
DROP TABLE IF EXISTS sensor_readings;
DROP TABLE IF EXISTS ponds;

-- 1. Main Habitat Tank & Containers (20 to 50-Gallon Aquarium + 10-20L Reservoir & Catch Buckets)
CREATE TABLE ponds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  species VARCHAR(100) NOT NULL DEFAULT 'Aquatic Fish Habitat',
  volume_liters INT NOT NULL DEFAULT 150 COMMENT '20-50 Gallon Main Habitat Tank (~75L-190L)',
  reservoir_liters INT NOT NULL DEFAULT 20 COMMENT '10-20 Liter Clean Refill Bucket (#1)',
  status ENUM('healthy','attention','critical') NOT NULL DEFAULT 'healthy',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Sensor Suite Readings (Arduino Uno R4 WiFi)
-- Active Sensors:
--   - Main Tank Temp: Waterproof DS18B20 Probe #1 (Pin D2)
--   - Reservoir Temp: Waterproof DS18B20 Probe #2 (Pin D3)
--   - pH Level: Analog PH-4502C Module + BNC Glass Probe (Pin A0)
--   - TDS: Gravity Analog TDS Transmitter V1.0 (Pin A1)
--   - Turbidity: TS-300B Optical Sensor (Pin A2)
--   - Water Level: JSN-SR04T Waterproof Ultrasonic Sensor (Pins D7, D8)
-- Pending Parameters (Manual Testing Kits):
--   - Ammonia, Nitrite, Nitrate (Nullable until testing kits arrive)
CREATE TABLE sensor_readings (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  pond_id INT NOT NULL,
  temperature_c DECIMAL(5,2) NOT NULL COMMENT 'Main Tank DS18B20 #1 (Pin D2)',
  reservoir_temp_c DECIMAL(5,2) NOT NULL DEFAULT 26.80 COMMENT 'Refill Reservoir DS18B20 #2 (Pin D3)',
  ph DECIMAL(4,2) NOT NULL COMMENT 'PH-4502C Module (Pin A0)',
  tds_ppm DECIMAL(6,1) NOT NULL DEFAULT 245.0 COMMENT 'Gravity Analog TDS (Pin A1, 0-1000 ppm)',
  turbidity_ntu DECIMAL(7,2) NOT NULL DEFAULT 14.5 COMMENT 'TS-300B Turbidity in NTU (Pin A2)',
  turbidity_voltage DECIMAL(4,2) NOT NULL DEFAULT 4.12 COMMENT 'TS-300B Amplifier Voltage (0-5V)',
  water_level_cm DECIMAL(5,2) NOT NULL DEFAULT 32.0 COMMENT 'JSN-SR04T Water Depth in cm (Pins D7, D8)',
  water_level_pct DECIMAL(5,1) NOT NULL DEFAULT 91.4 COMMENT 'Calculated Tank Fill %',
  ammonia_mg_l DECIMAL(6,3) DEFAULT NULL COMMENT 'Pending water testing kit',
  nitrite_mg_l DECIMAL(6,3) DEFAULT NULL COMMENT 'Pending water testing kit',
  nitrate_mg_l DECIMAL(6,3) DEFAULT NULL COMMENT 'Pending water testing kit',
  system_state VARCHAR(40) NOT NULL DEFAULT 'NORMAL',
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reading_pond FOREIGN KEY (pond_id) REFERENCES ponds(id) ON DELETE CASCADE,
  INDEX idx_pond_recorded (pond_id, recorded_at)
);

-- 3. System & Fish-Stress Alerts
CREATE TABLE alerts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pond_id INT NOT NULL,
  severity ENUM('info','warning','critical') NOT NULL DEFAULT 'info',
  category VARCHAR(80) NOT NULL,
  message VARCHAR(255) NOT NULL,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_alert_pond FOREIGN KEY (pond_id) REFERENCES ponds(id) ON DELETE CASCADE
);

-- 4. Relay Actuators (4-Channel 5V Optocoupled Relay Module on Pins D4, D5, D6)
CREATE TABLE devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pond_id INT NOT NULL,
  device_key ENUM('drain_pump','refill_pump','aerator') NOT NULL,
  pin_assignment VARCHAR(50) NOT NULL,
  label VARCHAR(100) NOT NULL,
  description VARCHAR(255) NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pond_device (pond_id, device_key),
  CONSTRAINT fk_device_pond FOREIGN KEY (pond_id) REFERENCES ponds(id) ON DELETE CASCADE
);

-- 5. Automated Fish Feeder Events (TowerPro MG996R Servo on Pin D9)
CREATE TABLE feeding_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  pond_id INT NOT NULL,
  amount_grams DECIMAL(7,2) NOT NULL,
  servo_pin VARCHAR(40) NOT NULL DEFAULT 'Pin D9 (MG996R Servo)',
  mode ENUM('manual','scheduled') NOT NULL DEFAULT 'manual',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_feed_pond FOREIGN KEY (pond_id) REFERENCES ponds(id) ON DELETE CASCADE
);

-- Seed Initial Prototype Data Matching Project Documents
INSERT INTO ponds (id, name, species, volume_liters, reservoir_liters, status)
VALUES (1, 'SMART Aqua Pond (Main Tank)', 'Marine / Aquatic Habitat', 150, 20, 'healthy');

INSERT INTO sensor_readings (
  pond_id, temperature_c, reservoir_temp_c, ph, tds_ppm,
  turbidity_ntu, turbidity_voltage, water_level_cm, water_level_pct,
  ammonia_mg_l, nitrite_mg_l, nitrate_mg_l, system_state
) VALUES (
  1, 27.40, 27.10, 7.25, 245.0,
  14.50, 4.12, 32.00, 91.4,
  NULL, NULL, NULL, 'NORMAL'
);

INSERT INTO alerts (pond_id, severity, category, message) VALUES
  (1, 'info', 'Chemical Testing Limitation', 'Ammonia, nitrite, and nitrate parameters are marked as pending until physical water-testing kits become available.'),
  (1, 'warning', 'ESP32-CAM & Fish Behavior', 'Ensure ESP32-CAM (with 37mm CPL polarizing filter) is powered on to monitor fish-stress and surface behavior.');

INSERT INTO devices (pond_id, device_key, pin_assignment, label, description, is_enabled) VALUES
  (1, 'drain_pump',  'Relay CH1 · Pin D4', '12V Submersible Drain Pump',  'Drains 10–25% dirty tank water into wastewater catch bucket (#2)', FALSE),
  (1, 'refill_pump', 'Relay CH2 · Pin D5', '12V Submersible Refill Pump', 'Pumps temperature-matched clean water from reservoir bucket (#1)', FALSE),
  (1, 'aerator',     'Relay CH3 · Pin D6', '12V Mini Diaphragm Aerator',  'Emergency oxygen supply for thermal (>30°C) or hypoxia events', TRUE);
