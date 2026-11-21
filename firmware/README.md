# SMART Aqua Pond: Marine Ecosystem Monitoring System Firmware

This folder contains the complete firmware suite for the **SMART Aqua Pond** project (University of Eastern Philippines - College of Science).

---

## 📁 Directory Structure

```text
firmware/
├── calibration/                          # Standalone diagnostic & calibration sketches
│   ├── ph_calibration/                  # PH-4502C zero-offset & slope calibration
│   ├── ultrasonic_depth_test/           # JSN-SR04T distance & depth calculation
│   ├── dual_temp_test/                  # Dual DS18B20 & thermal shock prevention
│   ├── tds_turbidity_test/              # Gravity TDS + TS-300B water clarity test
│   └── actuator_relay_feeder_test/      # Active-LOW relay testing & MG996R servo feed
└── main_controller/                      # Master integrated controller for Arduino Uno R4 WiFi
    └── main_controller.ino              # Full sensor fusion, automation logic & JSON telemetry
```

---

## 📌 Master Hardware Pin Mapping (Arduino Uno R4 WiFi)

| Component | Pin | Signal Type | Power Rail | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Main Tank Temp (DS18B20 #1)** | **D2** | 1-Wire Digital | 5V | Requires 4.7kΩ pull-up resistor to 5V |
| **Refill Reservoir Temp (DS18B20 #2)** | **D3** | 1-Wire Digital | 5V | Requires 4.7kΩ pull-up resistor to 5V |
| **Relay CH1 (Drain Pump)** | **D4** | Digital Out | 5V Coil / 12V Load | Active-LOW (LOW = ON, HIGH = OFF) |
| **Relay CH2 (Refill Pump)** | **D5** | Digital Out | 5V Coil / 12V Load | Active-LOW (LOW = ON, HIGH = OFF) |
| **Relay CH3 (Aerator Air Pump)** | **D6** | Digital Out | 5V Coil / 12V Load | Active-LOW (LOW = ON, HIGH = OFF) |
| **JSN-SR04T Trig** | **D7** | Digital Out | 5V | Ultrasonic pulse trigger |
| **JSN-SR04T Echo** | **D8** | Digital In | 5V | Ultrasonic echo return |
| **Feeder Servo (MG996R)** | **D9** | PWM Out | 5V (Buck Converter) | **DO NOT** power from Uno 5V pin! |
| **PH-4502C pH Sensor** | **A0** | Analog In | 5V | Calibrated via trimpot & buffer sachets |
| **Gravity TDS Sensor** | **A1** | Analog In | 5V | Standardized to 25°C with DS18B20 data |
| **TS-300B Turbidity Sensor** | **A2** | Analog In | 5V | High V = Clear, Low V = Turbid/Dirty |

---

## ⚡ Power Supply & Circuit Safety

> [!IMPORTANT]
> 1. **Do not power the MG996R servo or relay coils from the Arduino Uno R4's 5V pin.** The servo draws up to 2.5A peak stall current, which will trigger Arduino brownout resets. Power them directly from the **LM2596S Buck Converter** adjusted to **5.0V DC**.
> 2. **Common Ground:** Ensure the 12V power supply negative terminal, LM2596S `OUT-`, and Arduino `GND` are all connected together.
> 3. **Flyback Diodes:** Solder or clamp the **1N4007 diodes** across the pump terminals (silver stripe to positive `+12V`, black body to negative `GND`) to suppress inductive voltage spikes.

---

## 📚 Required Arduino Libraries

In the Arduino IDE, open **Tools > Manage Libraries...** and install:
1. `OneWire` by Jim Studt, Paul Stoffregen
2. `DallasTemperature` by Miles Burton
3. `Servo` (built-in standard library)

---

## 🛠️ Step-by-Step Testing Procedure

### Step 1: Calibrate pH Sensor
1. Upload `calibration/ph_calibration/ph_calibration.ino`.
2. Mix the pH 6.86 powder packet with 250mL of distilled water.
3. Submerge the glass probe. Turn the trimpot on the PH-4502C until Serial Monitor reads `~2.50V`.
4. Test in pH 4.01 and 9.18 buffers to verify linear slope.

### Step 2: Test Ultrasonic Water Level
1. Upload `calibration/ultrasonic_depth_test/ultrasonic_depth_test.ino`.
2. Measure the physical distance from the overhead mounting gantry to the tank bottom.
3. Adjust `SENSOR_MOUNT_HEIGHT_CM` and `TANK_FULL_DEPTH_CM` to match your aquarium.

### Step 3: Test Relays & Feeder
1. Upload `calibration/actuator_relay_feeder_test/actuator_relay_feeder_test.ino`.
2. Open Serial Monitor (115200 baud).
3. Send `1` to test Drain Pump, `2` for Refill Pump, `3` for Aerator, and `F` for Feeder.

### Step 4: Run Integrated Master Firmware
1. Upload `main_controller/main_controller.ino`.
2. Open Serial Monitor at 115200 baud. The Uno R4 will output structured JSON telemetry every 2 seconds.
