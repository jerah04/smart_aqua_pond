# SMART Aqua Pond: Marine Ecosystem Monitoring System

Full-stack web application and hardware telemetry gateway for the **SMART Aqua Pond** project (**University of Eastern Philippines — College of Science**).

---

## 🛠️ Technology & Hardware Stack

- **Primary Controller:** Arduino Uno R4 WiFi (Renesas RA4M1 32-bit + ESP32-S3)
- **Secondary Controller:** ESP32-CAM (OV2640 2MP + ESP32-CAM-MB + BlueWow 37mm CPL Polarizing Filter)
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, `lucide-react`
- **Backend:** Node.js, Express.js, `mysql2/promise` (with optional `serialport` USB listener & `/api/telemetry` HTTP bridge)
- **Database:** MySQL 8+ (MySQL Workbench)

---

## 📌 Hardware Pin Mapping & Database Alignment

| Hardware Component | Model / Specification | Arduino Pin | Database Column / Key |
| :--- | :--- | :--- | :--- |
| **Main Tank Water Temp** | Waterproof DS18B20 Probe #1 | **Pin D2** | `sensor_readings.temperature_c` |
| **Reservoir Water Temp** | Waterproof DS18B20 Probe #2 | **Pin D3** | `sensor_readings.reservoir_temp_c` |
| **pH Sensor** | PH-4502C + BNC Glass Electrode | **Pin A0** | `sensor_readings.ph` |
| **TDS Sensor** | Gravity Analog TDS V1.0 | **Pin A1** | `sensor_readings.tds_ppm` |
| **Turbidity Sensor** | TS-300B Optical Probe | **Pin A2** | `sensor_readings.turbidity_ntu` & `turbidity_voltage` |
| **Water Level Sensor** | JSN-SR04T Waterproof Ultrasonic | **Pins D7, D8** | `sensor_readings.water_level_cm` & `water_level_pct` |
| **Drain Pump** | 12V Brushless Submersible (3L/min) | **Relay CH1 (Pin D4)** | `devices.device_key = 'drain_pump'` |
| **Refill Pump** | 12V Brushless Submersible (3L/min) | **Relay CH2 (Pin D5)** | `devices.device_key = 'refill_pump'` |
| **Aerator Pump** | 12V Mini Diaphragm Air Pump | **Relay CH3 (Pin D6)** | `devices.device_key = 'aerator'` |
| **Automated Fish Feeder** | TowerPro MG996R Metal Gear Servo | **Pin D9 (PWM)** | `feeding_events` table |
| **Ammonia, Nitrite, Nitrate** | Pending Physical Water-Testing Kits | *Manual Input* | `ammonia_mg_l`, `nitrite_mg_l`, `nitrate_mg_l` |

---

## 🚀 Step-by-Step Setup Guide

### 1. Set Up the MySQL Database (MySQL Workbench)
1. Open **MySQL Workbench** and connect to your local MySQL server (`localhost:3306`).
2. Open and execute `database/schema.sql`.
3. This creates the `smart_aqua_pond` database with `ponds`, `sensor_readings`, `devices`, `alerts`, and `feeding_events`.

### 2. Start the Node.js + Express Backend
```bash
cd backend
cp .env.example .env
# Edit .env and set your MySQL DB_PASSWORD (and optional ARDUINO_PORT=COM3)
npm install
npm run dev
```
- The API runs at `http://localhost:4000`.
- Verify health at `http://localhost:4000/api/health`.

### 3. Start the Next.js + Tailwind CSS Frontend
In a second terminal:
```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```
- Open `http://localhost:3000` in your browser.

---

## 📡 API Endpoints

- `GET /api/health` — Checks MySQL connection and Arduino Uno R4 WiFi telemetry status.
- `GET /api/dashboard` — Loads pond profile, latest 6-sensor readings, 3 relay states, feeder logs, and alerts.
- `POST /api/controls` — Controls individual relays (`drain_pump`, `refill_pump`, `aerator`) or triggers `WATER_CHANGE` / `STOP` on the Arduino.
- `POST /api/feeder` — Triggers the **MG996R Servo (Pin D9)** and records the feed weight in MySQL.
- `POST /api/telemetry` — Ingests real-time JSON from the Arduino Uno R4 WiFi and returns queued actuator commands.
- `POST /api/chemical-test` — Logs manual water-testing kit results for Ammonia, Nitrite, and Nitrate.
