CREATE DATABASE IF NOT EXISTS smart_aqua_pond
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE smart_aqua_pond;

CREATE TABLE IF NOT EXISTS ponds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  species VARCHAR(100) NOT NULL DEFAULT 'Tilapia',
  volume_liters INT NOT NULL DEFAULT 10000,
  status ENUM('healthy','attention','critical') NOT NULL DEFAULT 'healthy',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sensor_readings (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  pond_id INT NOT NULL,
  temperature_c DECIMAL(5,2) NOT NULL,
  ph DECIMAL(4,2) NOT NULL,
  dissolved_oxygen_mg_l DECIMAL(5,2) NOT NULL,
  ammonia_mg_l DECIMAL(6,3) NOT NULL DEFAULT 0,
  turbidity_ntu DECIMAL(7,2) NOT NULL DEFAULT 0,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reading_pond FOREIGN KEY (pond_id) REFERENCES ponds(id) ON DELETE CASCADE,
  INDEX idx_pond_recorded (pond_id, recorded_at)
);

CREATE TABLE IF NOT EXISTS alerts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pond_id INT NOT NULL,
  severity ENUM('info','warning','critical') NOT NULL DEFAULT 'info',
  category VARCHAR(80) NOT NULL,
  message VARCHAR(255) NOT NULL,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_alert_pond FOREIGN KEY (pond_id) REFERENCES ponds(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pond_id INT NOT NULL,
  device_key ENUM('aerator','pump') NOT NULL,
  label VARCHAR(100) NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pond_device (pond_id, device_key),
  CONSTRAINT fk_device_pond FOREIGN KEY (pond_id) REFERENCES ponds(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS feeding_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  pond_id INT NOT NULL,
  amount_grams DECIMAL(7,2) NOT NULL,
  mode ENUM('manual','scheduled') NOT NULL DEFAULT 'manual',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_feed_pond FOREIGN KEY (pond_id) REFERENCES ponds(id) ON DELETE CASCADE
);

INSERT INTO ponds (id, name, species, volume_liters, status)
VALUES (1, 'Pond Alpha', 'Nile Tilapia', 12000, 'healthy')
ON DUPLICATE KEY UPDATE name=VALUES(name);

INSERT INTO sensor_readings (pond_id, temperature_c, ph, dissolved_oxygen_mg_l, ammonia_mg_l, turbidity_ntu)
SELECT 1, 27.4, 7.3, 6.8, 0.12, 18.5
WHERE NOT EXISTS (SELECT 1 FROM sensor_readings WHERE pond_id=1);

INSERT INTO alerts (pond_id, severity, category, message)
SELECT 1, 'warning', 'Fish health', 'Camera review recommended: unusual surface activity detected.'
WHERE NOT EXISTS (SELECT 1 FROM alerts WHERE pond_id=1);

INSERT INTO devices (pond_id, device_key, label, is_enabled)
VALUES (1, 'aerator', 'Pond aerator', TRUE), (1, 'pump', 'Water circulation pump', FALSE)
ON DUPLICATE KEY UPDATE label=VALUES(label);
