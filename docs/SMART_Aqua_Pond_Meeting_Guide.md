# UNIVERSITY OF EASTERN PHILIPPINES
**College of Science**  
**University Town, Catarman, Northern Samar**

---

# SMART AQUA POND: A MARINE ECOSYSTEM MONITORING AND AUTOMATION SYSTEM

*Technical Meeting Report on the Front-End and Back-End Setup, Fish-Stress Detection Module, Sensor Telemetry Data Model, and System Flowchart*

*In Partial Fulfillment of the Requirements in Application Development and Emerging Technologies*

**Prepared by:**
- **Group Leader:** Cananga, Shierafel Kim B.
- **Group Members:** Mendez, Mara Grace; Agonias, Trixie Keith; Gremio, Emmanuel Justine; Arnesto, Jerah Fernando; Gonzales, Mark Eugine; Seguros, Patrick; Alsola, Arriana Monique F.; Araojo, Grezabeth G.; Galit, Rugelyn D.; Olesco, Jerome C.; Paller, Christian Rey B.; Pinca, Ken David P.; Ramosa, Jummel Mark M.; Tan, Princess

**Submitted to:** Emmanuel Santos, Subject Teacher  
**Date:** November 2026

---

## TABLE OF CONTENTS
- **1.0 Presentation of the Front-End and Back-End Setup**
  - 1.1 System Overview
  - 1.2 Front-End Architecture
  - 1.3 Back-End Architecture and Fish-Stress Detection Engine
  - 1.4 Database Layer
  - 1.5 System Deployment Procedure
- **2.0 Realistic Dummy Data from the Arduino Sensors**
  - 2.1 Telemetry Data Format
  - 2.2 Sample Telemetry Records Across Operating Conditions
  - 2.3 Sensor Reference Ranges, Fish-Stress Thresholds, and Automated Responses
  - 2.4 Simulated 24-Hour Sensor Dataset
- **3.0 System Flowchart**
  - 3.1 End-to-End System Flowchart
  - 3.2 Description of the Process Flow
  - 3.3 Command and Actuation Flow

---

## 1.0 PRESENTATION OF THE FRONT-END AND BACK-END SETUP

### 1.1 System Overview
The SMART Aqua Pond is an Internet of Things (IoT)-based marine and aquatic ecosystem monitoring and automation system designed to observe and maintain the water quality and fish welfare of a controlled habitat. The software platform adopts a three-tier architecture composed of a presentation layer (front-end), an application layer (back-end), and a data layer (relational database), which interface with a hardware layer built around the Arduino Uno R4 WiFi microcontroller and an overhead ESP32-CAM visual monitoring module.

Sensor readings acquired by the microcontroller are transmitted to the back-end server through a USB serial connection (`COM5` at `115,200` baud) or via an HTTP telemetry endpoint, stored in a MySQL 8.0 relational database, and presented to the operator through a web-based dashboard. In addition, the system incorporates a multi-modal Fish-Stress Detection feature that correlates observed fish swimming and surface-gasping behavior with real-time water-quality parameters to trigger automated corrective actions, such as emergency aeration or partial water changes.

**Table 1. Technology Stack of the System**

| Layer | Technology / Component | Role in the System |
| :--- | :--- | :--- |
| **Presentation Layer** | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS | Web dashboard for real-time telemetry visualization, fish-stress monitoring, and actuator control (Port 3000) |
| **Application Layer** | Node.js, Express 4.x, `serialport`, `mysql2/promise` | REST API server, USB serial bridge, threshold alert evaluator, and fish-stress auto-actuation engine (Port 4000) |
| **Data Layer** | MySQL 8.0 (`smart_aqua_pond` schema) | Persistent relational storage of habitat profiles, sensor readings, device states, alerts, and feeding events (Port 3306) |
| **Hardware Layer** | Arduino Uno R4 WiFi + 4-Ch Optocoupled Relay + MG996R Servo | Real-time acquisition of six water-quality sensors every 2 seconds and relay/servo actuation (`COM5`, `115200` baud) |
| **Vision Layer** | ESP32-CAM (OV2640 2MP) + BlueWow 37mm CPL Filter | Wireless MJPEG video streaming with surface-glare elimination for visual observation and fish-stress detection |

### 1.2 Front-End Architecture
The front-end is a single-page web application developed using the Next.js 14 framework with the App Router, written in TypeScript, and styled with Tailwind CSS. It retrieves the current operational state of the system from the back-end REST API at a fixed polling interval of four (4) seconds and updates the interface without requiring page reloads. The dashboard is organized into six functional modules:

1. **Telemetry Panel.** Displays the current main tank water temperature, refill reservoir water temperature, pH level, total dissolved solids (TDS), optical turbidity (in NTU and volts), and ultrasonic water depth as individual indicator cards with hardware pin assignments and operating status indicators.
2. **Thermal Shock Protection Indicator.** Continuously computes the temperature differential between the main habitat tank and the refill reservoir ($\Delta T = |T_{\text{tank}} - T_{\text{reservoir}}|$) and indicates whether the differential is within the safe threshold of $2.0\ ^\circ\text{C}$ prior to water refilling.
3. **Live Camera View and Fish-Stress Detection Panel.** Embeds the live MJPEG video stream transmitted by the ESP32-CAM module (equipped with a 37mm circular polarizing filter) alongside the Fish-Stress Detection interface. This panel displays the composite Fish Stress Index (`0` to `100`), Swimming Activity Index (`%`), Surface Gasping Clustering (`%`), detected behavioral classification, and diagnostic simulation controls for testing automated hardware responses.
4. **Actuator and Relay Control Panel.** Provides manual and automated switches for the 12V submersible drain pump (`Relay K1`, `Pin D4`), 12V submersible refill pump (`Relay K2`, `Pin D5`), 12V diaphragm aerator pump (`Relay K3`, `Pin D6`), an automated 20% partial water change cycle, a manual feed dispenser (`TowerPro MG996R Servo`, `Pin D9`), and an emergency stop command.
5. **Chemical Test Kit Log.** Allows researchers to manually record results obtained from physical chemical test kits for ammonia ($\text{NH}_3$), nitrite ($\text{NO}_2^-$), and nitrate ($\text{NO}_3^-$), which are documented as pending physical testing equipment in the implementation testing plan.
6. **System Diagnostics and Alerts Panel.** Lists active notifications and warnings generated whenever a water-quality parameter or fish-stress indicator exceeds its safe operating threshold.

*Front-end environment configuration (`frontend/.env.local`):*
```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_ESP32_CAM_URL=http://192.168.1.17/stream
```

### 1.3 Back-End Architecture and Fish-Stress Detection Engine
The back-end is a Node.js server application built with the Express framework. It performs four core functions: (a) it maintains an auto-reconnecting serial communication link with the Arduino Uno R4 WiFi on port `COM5` at `115,200` baud and parses incoming JSON telemetry lines; (b) it stores each sensor reading in the MySQL database and evaluates the values against predefined safety thresholds; (c) it executes a multi-modal Fish-Stress Detection and Auto-Actuation routine (`evaluateFishStressAndAutoRespond`) that correlates behavioral indicators with water-quality metrics; and (d) it exposes a RESTful API through which the front-end retrieves data and issues actuator commands.

When the Fish-Stress Detection engine calculates a composite stress score of `45%` or higher—such as during hypoxia-induced surface gasping (surface clustering $\ge 55\%$) or thermal stress ($> 30.0\ ^\circ\text{C}$)—the back-end automatically queues the `AERATOR_ON` command to activate Relay K3 (`Pin D6`) and records a corresponding safety alert. When severe behavioral stress coincides with elevated dissolved solids ($> 750\ \text{ppm}$) or high turbidity ($< 2.20\ \text{V}$), the back-end automatically initiates a 20% partial water change cycle (`WATER_CHANGE`) via Relay K1 (`Pin D4`).

**Table 2. Back-End REST API Endpoints**

| Endpoint | Method | Description |
| :--- | :---: | :--- |
| `/api/health` | `GET` | Reports the operational status of the Express server, MySQL database connection, and Arduino serial link. |
| `/api/dashboard` | `GET` | Returns the pond profile, latest sensor reading, relay states, fish-stress evaluation, active alerts, and feeding logs. |
| `/api/controls` | `POST` | Transmits relay commands to the Arduino (`drain_pump`, `refill_pump`, `aerator`, `WATER_CHANGE`, `STOP`, `RESUME`). |
| `/api/feeder` | `POST` | Triggers a feeding cycle on the MG996R servo (`Pin D9`) and records the dispensed feed weight in the database. |
| `/api/fish-stress` | `POST` | Evaluates fish behavioral indicators and water-quality correlation, triggering automatic aeration or water change when stressed. |
| `/api/telemetry` | `POST` | Receives JSON telemetry packets transmitted over Wi-Fi/HTTP and returns any queued actuator commands. |
| `/api/chemical-test` | `POST` | Stores manually entered ammonia, nitrite, and nitrate test kit measurements in the active reading record. |

*Back-end environment configuration (`backend/.env`):*
```env
PORT=4000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=smart_aqua_pond
FRONTEND_ORIGIN=http://localhost:3000
ARDUINO_PORT=COM5
```

### 1.4 Database Layer
The system utilizes a MySQL 8.0 relational database named `smart_aqua_pond`, defined in `database/schema.sql`. The principal tables of the schema are summarized in Table 3.

**Table 3. Principal Database Tables**

| Table Name | Primary Key | Description |
| :--- | :--- | :--- |
| `ponds` | `id (INT)` | Stores the profile of the monitored aquatic habitat, including tank name, species, main volume (`150 L`), reservoir volume (`20 L`), and overall health status. |
| `sensor_readings` | `id (BIGINT)` | Stores time-stamped readings for main tank temperature, reservoir temperature, pH, TDS, turbidity (NTU and voltage), water depth (cm and fill `%`), manual chemical parameters, and firmware state. |
| `devices` | `id (INT)` | Maintains the current on/off state, hardware pin assignment, and functional description of the drain pump, refill pump, and aerator relays. |
| `alerts` | `id (INT)` | Records water-quality, thermal-shock, and fish-stress warnings raised when parameters exceed safe operating thresholds, along with resolution status. |
| `feeding_events` | `id (BIGINT)` | Logs manual and scheduled feeding cycles, including feed weight in grams, servo pin assignment, execution mode, and timestamp. |

### 1.5 System Deployment Procedure
1. **Hardware Connection.** Connect the Arduino Uno R4 WiFi to the host computer via USB and confirm that the device is enumerated on port `COM5`. Power the 12V 5A main supply and LM2596S 5.0V buck converter for the relay module and servo.
2. **Database Initialization.** Ensure that the MySQL 8.0 service is running on port `3306` and execute `database/schema.sql` in MySQL Workbench to initialize the `smart_aqua_pond` database.
3. **Application Startup.** Execute `start-interface.bat`, which starts the Express back-end server on port `4000` and the Next.js front-end development server on port `3000`.
4. **Dashboard Access.** Open `http://localhost:3000` in a web browser to view the telemetry dashboard and connect the ESP32-CAM stream (`http://192.168.1.17/stream`).

---

## 2.0 REALISTIC DUMMY DATA FROM THE ARDUINO SENSORS

### 2.1 Telemetry Data Format
The Arduino Uno R4 WiFi master firmware (`firmware/main_controller/main_controller.ino`) samples all connected sensors every two (2) seconds and transmits a single line of JSON-formatted data per cycle over USB Serial at `115,200` baud.

**Table 4. Telemetry Field Definitions**

| Field Name | Unit / Type | Source Sensor and Pin | Description |
| :--- | :--- | :--- | :--- |
| `tank_temp` | `°C (float)` | DS18B20 Probe #1 / `Pin D2` | Primary water temperature measured in the main habitat tank. |
| `res_temp` | `°C (float)` | DS18B20 Probe #2 / `Pin D3` | Water temperature of the clean refill reservoir (or mirrored in single-probe mode). |
| `ph` | `pH (float)` | PH-4502C Module / `Pin A0` | Acidity or alkalinity of the habitat water (`0.0` to `14.0` pH scale). |
| `tds_ppm` | `ppm (int)` | Gravity Analog TDS / `Pin A1` | Temperature-compensated total dissolved solids indicating dissolved waste and feed. |
| `turbidity_v` | `V (float)` | TS-300B Optical / `Pin A2` | Optical light-transmission voltage (`0–5 V`); higher voltage indicates clearer water. |
| `water_depth_cm` | `cm (float)` | JSN-SR04T / `Pins D7, D8` | Water depth computed from overhead ultrasonic echo distance (`50 cm` mount height). |
| `tank_fill_pct` | `% (float)` | Derived in Firmware | Water depth expressed as a percentage of the nominal full depth (`35.0 cm`). |
| `aerator`, `drain`, `refill` | `boolean` | Relays `K3 (D6)`, `K1 (D4)`, `K2 (D5)` | Current active/inactive state of each relay-controlled actuator. |
| `state` | `string` | Firmware State Machine | Current controller operating mode: `NORMAL`, `DRAINING`, `REFILLING`, or `EMERGENCY_STOP`. |

*Sample baseline JSON telemetry packet transmitted by the Arduino Uno R4 WiFi:*
```json
{"tank_temp":27.25,"res_temp":27.10,"ph":7.38,"tds_ppm":245,"turbidity_v":4.14,"water_depth_cm":33.2,"tank_fill_pct":94.9,"aerator":false,"drain":false,"refill":false,"state":"NORMAL"}
```

### 2.2 Sample Telemetry Records Across Operating Conditions

**Table 5. Sample Sensor Readings Across Operating Conditions**

| Parameter | Normal State | Hypoxia / High Temp. | Draining (Water Stress) | Refilling Stage |
| :--- | :--- | :--- | :--- | :--- |
| **Main Tank Temperature (°C)** | `27.25` | `30.40` | `28.10` | `27.15` |
| **Reservoir Temperature (°C)** | `27.10` | `28.90` | `27.60` | `27.05` |
| **Temperature Differential ΔT (°C)** | `0.15 (Safe)` | `1.50 (Safe)` | `0.50 (Safe)` | `0.10 (Safe)` |
| **pH Level** | `7.38` | `7.22` | `7.18` | `7.39` |
| **Total Dissolved Solids (ppm)** | `245` | `412` | `765` | `238` |
| **Turbidity Voltage (V / NTU)** | `4.14 V (14.5 NTU)` | `3.45 V (187.5 NTU)` | `2.10 V (850.0 NTU)` | `4.14 V (14.5 NTU)` |
| **Water Depth (cm)** | `33.2` | `32.8` | `29.4 (Target: 28.0)` | `33.6` |
| **Tank Fill Percentage (%)** | `94.9` | `93.7` | `84.0` | `96.0` |
| **Fish Behavior Classification** | Calm Mid-Water Swimming | Surface Gasping (Hypoxia) | Erratic Hyperactivity | Recovering Calm |
| **Composite Fish-Stress Score (%)** | `14% (NORMAL)` | `90% (CRITICAL_STRESS)` | `95% (CRITICAL_STRESS)` | `20% (NORMAL)` |
| **Aerator Pump (Relay K3 / D6)** | `OFF` | `ON (Auto-Actuated)` | `ON (Auto-Actuated)` | `OFF` |
| **Drain Pump (Relay K1 / D4)** | `OFF` | `OFF` | `ON (Auto-Actuated)` | `OFF` |
| **Refill Pump (Relay K2 / D5)** | `OFF` | `OFF` | `OFF` | `ON` |
| **System State** | `NORMAL` | `NORMAL` | `DRAINING` | `REFILLING` |

### 2.3 Sensor Reference Ranges, Fish-Stress Thresholds, and Automated Responses

**Table 6. Sensor Reference Ranges, Fish-Stress Thresholds, and Automated Responses**

| Parameter | Optimal Range | Warning / Stress Range | Automated System Response |
| :--- | :--- | :--- | :--- |
| **Water Temperature (D2)** | `26.0 – 28.5 °C` | `< 24.0 °C` or `> 29.5 °C` | Aerator pump (`Relay K3`) is automatically activated above `30.0 °C`. |
| **Thermal Shock Differential (ΔT)** | `0.0 – 2.0 °C` | `> 2.0 °C` | Refill pump (`Relay K2`) is blocked to prevent thermal shock to the fish. |
| **pH Level (A0)** | `7.20 – 7.60 pH` | `< 6.80` or `> 8.20 pH` | Critical acid/alkaline alert is logged and fish-stress score increases. |
| **Total Dissolved Solids (A1)** | `180 – 320 ppm` | `500 – 750 ppm` | Partial water change (`Relay K1` drain) is initiated above `750 ppm`. |
| **Optical Turbidity (A2)** | `3.90 – 4.25 V (< 50 NTU)` | `2.50 – 3.50 V` | Partial water change (`Relay K1` drain) is initiated below `2.20 V`. |
| **Water Depth (D7, D8)** | `30.0 – 35.0 cm (85–100%)` | `< 25.0 cm (< 71%)` | Draining terminates at `28.0 cm`; refilling terminates at `35.0 cm` (`90s` safety timeout). |
| **Fish-Stress Score (Vision + Sensors)** | `0% – 29% (Calm)` | `≥ 45% (High)` / `≥ 70% (Critical)` | Score `≥ 45%` activates Aerator (`K3`); acute erratic water stress starts Drain (`K1`). |

### 2.4 Simulated 24-Hour Sensor Dataset

**Table 7. Simulated 24-Hour Sensor Dataset**

| Time | Tank Temp (°C) | Res Temp (°C) | pH | TDS (ppm) | Turbidity (V / NTU) | Depth (cm) | Fish Stress | State |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| `00:00` | `25.90` | `25.80` | `7.44` | `225` | `4.20 V (11.5 NTU)` | `33.4` | `12% (Calm)` | `NORMAL` |
| `04:00` | `26.20` | `26.05` | `7.41` | `232` | `4.16 V (13.0 NTU)` | `33.3` | `14% (Calm)` | `NORMAL` |
| `08:00` | `26.85` | `26.60` | `7.36` | `250` | `4.06 V (35.0 NTU)` | `33.1` | `24% (Feeding)` | `NORMAL` |
| `12:00` | `27.40` | `27.10` | `7.31` | `285` | `3.84 V (90.0 NTU)` | `32.9` | `18% (Calm)` | `NORMAL` |
| `15:00` | `30.35` | `28.80` | `7.24` | `390` | `3.50 V (175.0 NTU)` | `32.7` | `88% (Hypoxia)` | `NORMAL` |
| `16:00` | `28.60` | `27.90` | `7.21` | `540` | `3.10 V (275.0 NTU)` | `32.6` | `38% (Mild)` | `NORMAL` |
| `20:00` | `27.95` | `27.40` | `7.18` | `765` | `2.10 V (850.0 NTU)` | `28.0` | `95% (Critical)` | `DRAINING` |
| `21:00` | `27.15` | `27.05` | `7.39` | `238` | `4.14 V (14.5 NTU)` | `33.6` | `20% (Calm)` | `REFILLING` |
| `24:00` | `26.75` | `26.65` | `7.42` | `234` | `4.19 V (12.0 NTU)` | `33.5` | `14% (Calm)` | `NORMAL` |

*SQL statement for loading the simulated 24-hour dataset into MySQL 8.0:*
```sql
USE smart_aqua_pond;

INSERT INTO sensor_readings
  (pond_id, temperature_c, reservoir_temp_c, ph, tds_ppm, turbidity_ntu,
   turbidity_voltage, water_level_cm, water_level_pct, ammonia_mg_l,
   nitrite_mg_l, nitrate_mg_l, system_state, recorded_at)
VALUES
  (1, 25.90, 25.80, 7.44, 225.0, 11.5,  4.20, 33.4, 95.4, 0.010, 0.020, 11.0, 'NORMAL',    NOW() - INTERVAL 24 HOUR),
  (1, 26.20, 26.05, 7.41, 232.0, 13.0,  4.16, 33.3, 95.1, NULL,  NULL,  NULL, 'NORMAL',    NOW() - INTERVAL 20 HOUR),
  (1, 26.85, 26.60, 7.36, 250.0, 35.0,  4.06, 33.1, 94.6, NULL,  NULL,  NULL, 'NORMAL',    NOW() - INTERVAL 16 HOUR),
  (1, 27.40, 27.10, 7.31, 285.0, 90.0,  3.84, 32.9, 94.0, 0.025, 0.035, 14.5, 'NORMAL',    NOW() - INTERVAL 12 HOUR),
  (1, 30.35, 28.80, 7.24, 390.0, 175.0, 3.50, 32.7, 93.4, NULL,  NULL,  NULL, 'NORMAL',    NOW() - INTERVAL 9 HOUR),
  (1, 27.95, 27.40, 7.18, 765.0, 850.0, 2.10, 28.0, 80.0, NULL,  NULL,  NULL, 'DRAINING',  NOW() - INTERVAL 4 HOUR),
  (1, 27.15, 27.05, 7.39, 238.0, 14.5,  4.14, 33.6, 96.0, 0.005, 0.010,  8.5, 'REFILLING', NOW() - INTERVAL 3 HOUR),
  (1, 26.75, 26.65, 7.42, 234.0, 12.0,  4.19, 33.5, 95.7, 0.005, 0.010,  8.5, 'NORMAL',    NOW());
```

---

## 3.0 SYSTEM FLOWCHART

### 3.1 End-to-End System Flowchart
- **Figure 1 (Formal Swimlane Process Flowchart):** `docs/System_Flowchart_Formal.png`
- **Figure 2 (System Architecture Block Flowchart):** `docs/System_Flowchart.png`

### 3.2 Description of the Process Flow

**Table 8. Stages of the System Process Flow**

| Stage | Subsystem | Process Description |
| :--- | :--- | :--- |
| **1. Data Acquisition** | Arduino Uno R4 WiFi and ESP32-CAM | The microcontroller samples water temperature (`D2, D3`), pH (`A0`), TDS (`A1`), turbidity (`A2`), and ultrasonic depth (`D7, D8`) every two seconds and encodes the readings in JSON format. Concurrently, the ESP32-CAM streams live habitat video through a 37mm polarizing filter. |
| **2. Data Transmission** | USB Serial Bridge (`COM5`) | The single-line JSON telemetry packet is transmitted to the back-end server over USB Serial at `115,200` baud (or via HTTP POST to `/api/telemetry`). |
| **3. Processing, Fish-Stress Fusion, and Storage** | Express Back-End and MySQL 8.0 | The back-end parses the telemetry packet, evaluates water-quality thresholds, computes the composite Fish-Stress Score (`0–100%`), inserts the record into `sensor_readings`, and logs alerts or queues automatic actuation commands when stress is detected. |
| **4. Visualization** | Next.js 14 Front-End | The web dashboard queries `GET /api/dashboard` every four seconds and renders updated sensor cards, thermal-shock status, live camera stream, fish-stress diagnostics, and active alerts. |
| **5. Operator or Automated Command** | Front-End / Fish-Stress Engine to Back-End | When the operator activates a control on the dashboard (`POST /api/controls` or `/api/feeder`) or the Fish-Stress Engine detects a stress score `≥ 45%` (`POST /api/fish-stress`), the corresponding command is logged in MySQL and placed in the serial command queue. |
| **6. Hardware Actuation** | Back-End to Arduino Relays and Servo | The back-end writes the command string to `COM5`; the Arduino Uno R4 switches the designated Active-LOW optocoupled relay channel (`K1–K4`) or drives the MG996R feeder servo (`Pin D9`). |

### 3.3 Command and Actuation Flow

**Table 9. Mapping of Dashboard Actions, Serial Commands, and Hardware Outputs**

| System / Dashboard Action | Serial Command | Hardware Pin and Output Behavior |
| :--- | :--- | :--- |
| **Drain Pump ON / OFF** | `DRAIN_ON` / `DRAIN_OFF` | Switches Relay K1 (`Pin D4`, Active-LOW) to control the 12V submersible drain pump. |
| **Refill Pump ON / OFF** | `REFILL_ON` / `REFILL_OFF` | Switches Relay K2 (`Pin D5`, Active-LOW) to control the 12V submersible refill pump. |
| **Aerator ON / OFF (or Auto on Fish Stress ≥ 45%)** | `AERATOR_ON` / `AERATOR_OFF` | Switches Relay K3 (`Pin D6`, Active-LOW) to control the 12V diaphragm air pump. |
| **Automated 20% Water Change (or Auto on Water Stress)** | `WATER_CHANGE` | Enters `STATE_DRAINING` (`Relay K1` ON until depth reaches `28.0 cm`), verifies $\Delta T \le 2.0\ ^\circ\text{C}$, and transitions to `STATE_REFILLING` (`Relay K2` ON until `35.0 cm`). |
| **Dispense Fish Feed** | `FEED` | Energizes Relay K4 (`Pin D10`) and drives the MG996R servo (`Pin D9` PWM) for `1.2` seconds before returning to the locked neutral stop position (`90°`). |
| **Emergency Stop** | `STOP` | Transitions firmware to `STATE_EMERGENCY_STOP` and immediately de-energizes all relay channels (`K1–K4` HIGH) and locks the feeder servo. |
