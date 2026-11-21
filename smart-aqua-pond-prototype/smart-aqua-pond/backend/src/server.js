require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000' }));
app.use(express.json());

// Root endpoint to inform users to open the frontend on port 3000
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>SMART Aqua Pond API</title></head>
      <body style="font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc;">
        <div style="text-align: center; max-width: 500px; padding: 2rem; background: #1e293b; border-radius: 12px; border: 1px solid #334155;">
          <h1 style="color: #38bdf8; margin-top: 0;">SMART Aqua Pond API</h1>
          <p style="color: #94a3b8; line-height: 1.6;">The backend server is running on port 4000.</p>
          <p style="margin: 1.5rem 0;">To view the <strong>Dashboard & Control Interface</strong>, open port 3000:</p>
          <a href="http://localhost:3000" style="display: inline-block; background: #0284c7; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Open Dashboard (http://localhost:3000)</a>
        </div>
      </body>
    </html>
  `);
});

// Queue of pending hardware commands for the Arduino Uno R4 WiFi (consumed via Serial or HTTP /api/telemetry)
let pendingArduinoCommands = [];
let lastArduinoSeenAt = null;
let serialPortInstance = null;

function queueArduinoCommand(cmd) {
  pendingArduinoCommands.push(cmd);
  if (pendingArduinoCommands.length > 25) pendingArduinoCommands.shift();

  // If USB Serial is open, write immediately to Arduino Uno R4
  if (serialPortInstance && serialPortInstance.isOpen) {
    serialPortInstance.write(`${cmd}\n`, (err) => {
      if (err) console.error('Serial write error:', err.message);
    });
  }
}

// Convert TS-300B 0-5V turbidity voltage into approximate NTU if needed
function voltageToNtu(voltage) {
  const v = Number(voltage);
  if (!Number.isFinite(v)) return 14.5;
  if (v >= 4.2) return 5.0;
  if (v <= 2.5) return 850.0;
  // Standard quadratic approximation scaled for 0-5V optical transmission
  const ntu = Math.max(0, (4.2 - v) * 250);
  return Number(ntu.toFixed(1));
}

// Default fallback data strictly matching the SMART Aqua Pond project documents
const demoDashboard = {
  pond: {
    id: 1,
    name: 'SMART Aqua Pond (Main Tank)',
    species: 'Marine / Aquatic Habitat',
    volume_liters: 150,
    reservoir_liters: 20,
    status: 'healthy'
  },
  readings: {
    temperature_c: 27.4,
    reservoir_temp_c: 27.1,
    ph: 7.25,
    tds_ppm: 245.0,
    turbidity_ntu: 14.5,
    turbidity_voltage: 4.12,
    water_level_cm: 32.0,
    water_level_pct: 91.4,
    ammonia_mg_l: null,
    nitrite_mg_l: null,
    nitrate_mg_l: null,
    system_state: 'NORMAL',
    recorded_at: new Date().toISOString()
  },
  devices: [
    {
      device_key: 'drain_pump',
      pin_assignment: 'Relay CH1 · Pin D4',
      label: '12V Submersible Drain Pump',
      description: 'Drains 10–25% dirty tank water into wastewater catch bucket (#2)',
      is_enabled: false
    },
    {
      device_key: 'refill_pump',
      pin_assignment: 'Relay CH2 · Pin D5',
      label: '12V Submersible Refill Pump',
      description: 'Pumps temperature-matched clean water from reservoir bucket (#1)',
      is_enabled: false
    },
    {
      device_key: 'aerator',
      pin_assignment: 'Relay CH3 · Pin D6',
      label: '12V Mini Diaphragm Aerator',
      description: 'Emergency oxygen supply for thermal (>30°C) or hypoxia events',
      is_enabled: true
    }
  ],
  feedingEvents: [],
  alerts: [
    {
      id: 1,
      severity: 'info',
      category: 'Chemical Testing Limitation',
      message: 'Ammonia, nitrite, and nitrate parameters are marked as pending until physical water-testing kits become available.',
      created_at: new Date().toISOString()
    },
    {
      id: 2,
      severity: 'warning',
      category: 'ESP32-CAM & Fish Behavior',
      message: 'Ensure ESP32-CAM (with 37mm CPL polarizing filter) is powered on to monitor fish-stress and surface behavior.',
      created_at: new Date().toISOString()
    }
  ],
  arduinoStatus: {
    connected: false,
    lastSeenAt: null,
    port: process.env.ARDUINO_PORT || 'Wi-Fi / Serial'
  },
  fishStress: {
    status: 'NORMAL',
    behavior: 'Calm Mid-Water Swimming',
    stressScore: 14,
    activityIndexPct: 48,
    surfaceClusteringPct: 12,
    autoResponseEnabled: true,
    lastAutoAction: 'Auto-Guard Active (All parameters nominal)',
    updatedAt: new Date().toISOString()
  }
};

// Multi-Modal Fish Stress Detection & Automatic Actuation Engine (ESP32-CAM Vision + Sensor Fusion)
async function evaluateFishStressAndAutoRespond(visionInput = {}) {
  const r = demoDashboard.readings;
  const current = demoDashboard.fishStress;

  if (typeof visionInput.autoResponseEnabled === 'boolean') {
    current.autoResponseEnabled = visionInput.autoResponseEnabled;
  }

  let activity = Number.isFinite(Number(visionInput.activityIndexPct))
    ? Number(visionInput.activityIndexPct)
    : current.activityIndexPct;
  let surface = Number.isFinite(Number(visionInput.surfaceClusteringPct))
    ? Number(visionInput.surfaceClusteringPct)
    : current.surfaceClusteringPct;

  // Preset simulation / detection modes for live demonstration or camera triggers
  if (visionInput.scenario === 'HYPOXIA_GASPING') {
    activity = 78;
    surface = 84;
  } else if (visionInput.scenario === 'ERRATIC_WATER_STRESS') {
    activity = 92;
    surface = 62;
  } else if (visionInput.scenario === 'LETHARGY') {
    activity = 11;
    surface = 18;
  } else if (visionInput.scenario === 'NORMAL') {
    activity = 48;
    surface = 12;
  }

  // Compute composite Fish Stress Score (0 - 100) from Vision + Water Quality
  let score = 10;
  let behavior = 'Calm Mid-Water Swimming';
  let status = 'NORMAL';

  if (surface >= 55) {
    score += 48;
    behavior = 'Surface Gasping / Piping (Hypoxia Stress)';
  }
  if (activity >= 80) {
    score += 32;
    behavior = surface >= 55
      ? 'Surface Gasping & Erratic Swimming (Acute Hypoxia)'
      : 'Erratic Hyperactivity (Environmental Stress)';
  } else if (activity <= 16) {
    score += 35;
    behavior = 'Bottom Lethargy / Low Mobility Stress';
  }

  // Environmental stress correlation
  if (Number(r.temperature_c) >= 30.0) score += 22;
  if (Number(r.ph) < 6.8 || Number(r.ph) > 8.2) score += 18;
  if (Number(r.turbidity_voltage) < 2.5 || Number(r.tds_ppm) > 650) score += 20;

  score = Math.min(100, Math.max(5, Math.round(score)));

  if (score >= 70) {
    status = 'CRITICAL_STRESS';
  } else if (score >= 45) {
    status = 'HIGH_STRESS';
  } else if (score >= 30) {
    status = 'MILD_STRESS';
  } else {
    status = 'NORMAL';
    behavior = 'Calm Mid-Water Swimming';
  }

  let autoAction = current.autoResponseEnabled
    ? 'Auto-Guard Active (No intervention needed)'
    : 'Manual Mode (Auto-Response paused)';

  // AUTOMATIC HARDWARE ACTUATION WHEN FISH STRESS IS DETECTED
  if (current.autoResponseEnabled && score >= 45) {
    // 1. Always activate Aerator (Relay K3 / Pin D6) to boost dissolved oxygen immediately
    queueArduinoCommand('AERATOR_ON');
    demoDashboard.devices = demoDashboard.devices.map(d =>
      d.device_key === 'aerator' ? { ...d, is_enabled: true } : d
    );
    autoAction = 'AUTO-ACTUATED: Emergency Aerator (Relay K3) turned ON';

    // 2. If erratic stress is paired with high turbidity/TDS or explicit water stress scenario, trigger partial water change
    if (visionInput.scenario === 'ERRATIC_WATER_STRESS' || Number(r.turbidity_voltage) < 2.2 || Number(r.tds_ppm) > 750) {
      queueArduinoCommand('WATER_CHANGE');
      demoDashboard.readings.system_state = 'DRAINING';
      demoDashboard.devices = demoDashboard.devices.map(d =>
        d.device_key === 'drain_pump' ? { ...d, is_enabled: true } : d
      );
      autoAction = 'AUTO-ACTUATED: Aerator (K3) ON + Partial Water Change (K1 Drain) Started';
    }

    const alertMsg = `ESP32-CAM detected "${behavior}" (Stress Score: ${score}%). ${autoAction}.`;
    const newAlert = {
      id: Date.now(),
      severity: score >= 70 ? 'critical' : 'warning',
      category: 'ESP32-CAM Fish-Stress Auto-Response',
      message: alertMsg,
      created_at: new Date().toISOString()
    };
    demoDashboard.alerts = [
      newAlert,
      ...demoDashboard.alerts.filter(a => a.category !== 'ESP32-CAM Fish-Stress Auto-Response').slice(0, 6)
    ];

    try {
      const [[pond]] = await db.query('SELECT id FROM ponds ORDER BY id LIMIT 1');
      const pondId = pond ? pond.id : 1;
      await db.query("UPDATE devices SET is_enabled=TRUE WHERE pond_id=? AND device_key='aerator'", [pondId]);
      await db.query(
        'INSERT INTO alerts (pond_id, severity, category, message) VALUES (?, ?, ?, ?)',
        [pondId, newAlert.severity, newAlert.category, newAlert.message]
      );
    } catch (_e) {
      // In-memory state already updated
    }
  } else if (current.autoResponseEnabled && status === 'NORMAL' && visionInput.scenario === 'NORMAL') {
    autoAction = 'Auto-Guard Active (Fish behavior calm & nominal)';
  }

  demoDashboard.fishStress = {
    status,
    behavior,
    stressScore: score,
    activityIndexPct: activity,
    surfaceClusteringPct: surface,
    autoResponseEnabled: current.autoResponseEnabled,
    lastAutoAction: autoAction,
    updatedAt: new Date().toISOString()
  };

  return demoDashboard.fishStress;
}

// Process incoming JSON telemetry from Arduino Uno R4 WiFi (via USB Serial or HTTP POST)
async function handleArduinoTelemetry(payload) {
  lastArduinoSeenAt = new Date().toISOString();

  const tempTank = Number(payload.tank_temp ?? payload.temperature_c ?? 27.4);
  const tempRes = Number(payload.res_temp ?? payload.reservoir_temp_c ?? 27.1);
  const ph = Number(payload.ph ?? 7.2);
  const tdsPpm = Number(payload.tds_ppm ?? 240);
  const turbV = Number(payload.turbidity_v ?? payload.turbidity_voltage ?? 4.1);
  const turbNtu = Number(payload.turbidity_ntu ?? voltageToNtu(turbV));
  const waterDepthCm = Number(payload.water_depth_cm ?? payload.water_level_cm ?? 32.0);
  const tankFillPct = Number(payload.tank_fill_pct ?? payload.water_level_pct ?? 91.4);
  const systemState = String(payload.state ?? payload.system_state ?? 'NORMAL');

  // Update in-memory fallback so even without MySQL, live Arduino readings appear on dashboard
  demoDashboard.readings = {
    ...demoDashboard.readings,
    temperature_c: tempTank,
    reservoir_temp_c: tempRes,
    ph,
    tds_ppm: tdsPpm,
    turbidity_ntu: turbNtu,
    turbidity_voltage: turbV,
    water_level_cm: waterDepthCm,
    water_level_pct: tankFillPct,
    system_state: systemState,
    recorded_at: lastArduinoSeenAt
  };

  try {
    const [[pond]] = await db.query('SELECT id FROM ponds ORDER BY id LIMIT 1');
    const pondId = pond ? pond.id : 1;

    await db.query(
      `INSERT INTO sensor_readings (
        pond_id, temperature_c, reservoir_temp_c, ph, tds_ppm,
        turbidity_ntu, turbidity_voltage, water_level_cm, water_level_pct, system_state
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [pondId, tempTank, tempRes, ph, tdsPpm, turbNtu, turbV, waterDepthCm, tankFillPct, systemState]
    );

    // Sync relay states if reported by Arduino
    if (typeof payload.drain === 'boolean') {
      await db.query("UPDATE devices SET is_enabled=? WHERE pond_id=? AND device_key='drain_pump'", [payload.drain, pondId]);
    }
    if (typeof payload.refill === 'boolean') {
      await db.query("UPDATE devices SET is_enabled=? WHERE pond_id=? AND device_key='refill_pump'", [payload.refill, pondId]);
    }
    if (typeof payload.aerator === 'boolean') {
      await db.query("UPDATE devices SET is_enabled=? WHERE pond_id=? AND device_key='aerator'", [payload.aerator, pondId]);
    }

    // Automatic Safety & Water Quality Alert Generation
    const tempDelta = Math.abs(tempTank - tempRes);
    if (tempDelta > 2.0) {
      await db.query(
        `INSERT INTO alerts (pond_id, severity, category, message)
         SELECT ?, 'warning', 'Thermal Shock Guard (DS18B20 #1 & #2)', ?
         FROM DUAL WHERE NOT EXISTS (
           SELECT 1 FROM alerts WHERE pond_id=? AND category='Thermal Shock Guard (DS18B20 #1 & #2)' AND is_resolved=FALSE
         )`,
        [pondId, `Refill reservoir temp (${tempRes.toFixed(1)}°C) differs from main tank (${tempTank.toFixed(1)}°C) by ${tempDelta.toFixed(1)}°C (>2.0°C limit). Refill blocked.`, pondId]
      );
    }
    if (tempTank > 30.0) {
      await db.query(
        `INSERT INTO alerts (pond_id, severity, category, message)
         SELECT ?, 'critical', 'High Water Temperature (>30°C)', ?
         FROM DUAL WHERE NOT EXISTS (
           SELECT 1 FROM alerts WHERE pond_id=? AND category='High Water Temperature (>30°C)' AND is_resolved=FALSE
         )`,
        [pondId, `Main tank reached ${tempTank.toFixed(1)}°C. Emergency aerator (Relay CH3) activated.`, pondId]
      );
    }
  } catch (err) {
    // Database might not be running yet; in-memory demoDashboard still reflects live Arduino telemetry
  }

  // Re-evaluate multi-modal fish stress & automatic actuation whenever new telemetry arrives
  await evaluateFishStressAndAutoRespond(payload.fish_stress || {});
}

// Endpoint for ESP32-CAM Vision Analyzer or Operator to report fish behavior & trigger automatic actuation
app.post('/api/fish-stress', async (req, res) => {
  try {
    const result = await evaluateFishStressAndAutoRespond(req.body || {});
    res.json({
      success: true,
      fishStress: result,
      message: `${result.behavior} (Score: ${result.stressScore}%). ${result.lastAutoAction}`
    });
  } catch (e) {
    res.status(500).json({ error: 'Unable to evaluate fish stress.' });
  }
});

app.get('/api/health', async (_req, res) => {
  const arduinoOnline = lastArduinoSeenAt && (Date.now() - new Date(lastArduinoSeenAt).getTime() < 15000);
  try {
    await db.query('SELECT 1');
    res.json({
      status: 'ok',
      database: 'connected',
      arduino: arduinoOnline ? 'connected' : 'standby',
      lastArduinoSeenAt
    });
  } catch (e) {
    res.status(503).json({
      status: 'degraded',
      database: 'disconnected',
      arduino: arduinoOnline ? 'connected' : 'standby',
      message: 'Check backend .env and MySQL service.'
    });
  }
});

app.get('/api/dashboard', async (_req, res) => {
  const arduinoOnline = Boolean(lastArduinoSeenAt && (Date.now() - new Date(lastArduinoSeenAt).getTime() < 15000));
  const arduinoStatus = {
    connected: arduinoOnline,
    lastSeenAt: lastArduinoSeenAt,
    port: process.env.ARDUINO_PORT || 'Wi-Fi / Serial'
  };

  try {
    const [[pond]] = await db.query('SELECT * FROM ponds ORDER BY id LIMIT 1');
    if (!pond) return res.json({ ...demoDashboard, arduinoStatus });

    const [[reading]] = await db.query(
      'SELECT * FROM sensor_readings WHERE pond_id=? ORDER BY recorded_at DESC LIMIT 1',
      [pond.id]
    );
    const [devices] = await db.query(
      'SELECT device_key, pin_assignment, label, description, is_enabled FROM devices WHERE pond_id=? ORDER BY id',
      [pond.id]
    );
    const [alerts] = await db.query(
      'SELECT id, severity, category, message, created_at FROM alerts WHERE pond_id=? AND is_resolved=FALSE ORDER BY created_at DESC LIMIT 8',
      [pond.id]
    );
    const [feedingEvents] = await db.query(
      'SELECT id, amount_grams, servo_pin, mode, created_at FROM feeding_events WHERE pond_id=? ORDER BY created_at DESC LIMIT 5',
      [pond.id]
    );

    res.json({
      pond,
      readings: reading || demoDashboard.readings,
      devices: devices.length ? devices : demoDashboard.devices,
      alerts,
      feedingEvents,
      arduinoStatus,
      fishStress: demoDashboard.fishStress
    });
  } catch (e) {
    console.error('Database query error (falling back to live/demo state):', e.message);
    res.json({ ...demoDashboard, arduinoStatus });
  }
});

app.get('/api/ponds', async (_req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM ponds ORDER BY id');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Unable to load ponds.' });
  }
});

app.get('/api/ponds/:id/readings', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM sensor_readings WHERE pond_id=? ORDER BY recorded_at DESC LIMIT 24',
      [req.params.id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Unable to load readings.' });
  }
});

app.get('/api/alerts', async (_req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT a.*, p.name AS pond_name FROM alerts a JOIN ponds p ON p.id=a.pond_id WHERE a.is_resolved=FALSE ORDER BY a.created_at DESC'
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Unable to load alerts.' });
  }
});

// Control Relay Channels (Drain Pump CH1/D4, Refill Pump CH2/D5, Aerator CH3/D6) or System Actions
app.post('/api/controls', async (req, res) => {
  const { device, enabled, action } = req.body || {};

  // Handle high-level state machine commands (e.g. automated 10-25% water change or emergency stop)
  if (action && ['WATER_CHANGE', 'STOP', 'RESUME'].includes(action)) {
    queueArduinoCommand(action);
    demoDashboard.readings.system_state = action === 'WATER_CHANGE' ? 'DRAINING' : action === 'STOP' ? 'EMERGENCY_STOP' : 'NORMAL';
    return res.json({
      success: true,
      action,
      message: `Command "${action}" sent to Arduino Uno R4 WiFi controller.`
    });
  }

  if (!['drain_pump', 'refill_pump', 'aerator'].includes(device) || typeof enabled !== 'boolean') {
    return res.status(400).json({
      error: 'device must be drain_pump, refill_pump, or aerator and enabled must be boolean.'
    });
  }

  // Map device toggle to Arduino serial/Wi-Fi command
  const commandMap = {
    drain_pump: enabled ? 'DRAIN_ON' : 'DRAIN_OFF',
    refill_pump: enabled ? 'REFILL_ON' : 'REFILL_OFF',
    aerator: enabled ? 'AERATOR_ON' : 'AERATOR_OFF'
  };
  queueArduinoCommand(commandMap[device]);

  // Update in-memory state
  demoDashboard.devices = demoDashboard.devices.map(d =>
    d.device_key === device ? { ...d, is_enabled: enabled } : d
  );

  try {
    const [result] = await db.query(
      'UPDATE devices SET is_enabled=? WHERE device_key=? AND pond_id=(SELECT id FROM ponds ORDER BY id LIMIT 1)',
      [enabled, device]
    );
    if (!result.affectedRows) {
      return res.json({
        success: true,
        device,
        enabled,
        message: `${device} command (${commandMap[device]}) queued for Arduino (run schema.sql to persist in MySQL).`
      });
    }
    res.json({
      success: true,
      device,
      enabled,
      message: `${device} set ${enabled ? 'ON' : 'OFF'} (Arduino command: ${commandMap[device]}).`
    });
  } catch (e) {
    res.json({
      success: true,
      device,
      enabled,
      message: `${device} command (${commandMap[device]}) queued for Arduino.`
    });
  }
});

// Trigger TowerPro MG996R Automated Fish Feeder (Pin D9)
app.post('/api/feeder', async (req, res) => {
  const amountGrams = Number(req.body?.amountGrams);
  if (!Number.isFinite(amountGrams) || amountGrams < 1 || amountGrams > 1000) {
    return res.status(400).json({ error: 'amountGrams must be between 1 and 1000.' });
  }

  queueArduinoCommand('FEED');

  const newEvent = {
    id: Date.now(),
    amount_grams: amountGrams,
    servo_pin: 'Pin D9 (MG996R Servo)',
    mode: 'manual',
    created_at: new Date().toISOString()
  };
  demoDashboard.feedingEvents = [newEvent, ...demoDashboard.feedingEvents.slice(0, 4)];

  try {
    await db.query(
      "INSERT INTO feeding_events (pond_id, amount_grams, servo_pin, mode) VALUES ((SELECT id FROM ponds ORDER BY id LIMIT 1), ?, 'Pin D9 (MG996R Servo)', 'manual')",
      [amountGrams]
    );
    res.json({
      success: true,
      amountGrams,
      message: `Dispensed ${amountGrams} g via MG996R Servo (Pin D9) and logged to database.`
    });
  } catch (e) {
    res.json({
      success: true,
      amountGrams,
      message: `FEED command sent to MG996R Servo (Pin D9) for ${amountGrams} g.`
    });
  }
});

// Endpoint for Arduino Uno R4 WiFi to push sensor JSON over Wi-Fi or local bridge
app.post('/api/telemetry', async (req, res) => {
  try {
    await handleArduinoTelemetry(req.body || {});
    const commandsToRun = [...pendingArduinoCommands];
    pendingArduinoCommands = [];
    res.json({ status: 'ok', commands: commandsToRun });
  } catch (e) {
    res.status(500).json({ error: 'Failed to ingest Arduino telemetry.' });
  }
});

// Endpoint to record Ammonia, Nitrite, and Nitrate once physical testing kits become available
app.post('/api/chemical-test', async (req, res) => {
  const ammonia = req.body?.ammonia_mg_l !== undefined && req.body?.ammonia_mg_l !== '' ? Number(req.body.ammonia_mg_l) : null;
  const nitrite = req.body?.nitrite_mg_l !== undefined && req.body?.nitrite_mg_l !== '' ? Number(req.body.nitrite_mg_l) : null;
  const nitrate = req.body?.nitrate_mg_l !== undefined && req.body?.nitrate_mg_l !== '' ? Number(req.body.nitrate_mg_l) : null;

  demoDashboard.readings.ammonia_mg_l = ammonia;
  demoDashboard.readings.nitrite_mg_l = nitrite;
  demoDashboard.readings.nitrate_mg_l = nitrate;

  try {
    const [[latest]] = await db.query('SELECT id FROM sensor_readings ORDER BY recorded_at DESC LIMIT 1');
    if (latest) {
      await db.query(
        'UPDATE sensor_readings SET ammonia_mg_l=?, nitrite_mg_l=?, nitrate_mg_l=? WHERE id=?',
        [ammonia, nitrite, nitrate, latest.id]
      );
    }
    res.json({
      success: true,
      message: 'Manual chemical test kit parameters (Ammonia, Nitrite, Nitrate) recorded.'
    });
  } catch (e) {
    res.json({
      success: true,
      message: 'Chemical test parameters updated in active session.'
    });
  }
});

// Robust USB Serial Auto-Listener with auto-reconnect
async function initOptionalSerialBridge() {
  const portName = process.env.ARDUINO_PORT;
  if (!portName) return;

  let SerialPort, ReadlineParser;
  try {
    const sp = require('serialport');
    SerialPort = sp.SerialPort;
    ReadlineParser = require('@serialport/parser-readline').ReadlineParser;
  } catch (_e) {
    console.log('[Arduino Serial] serialport package not available, using HTTP telemetry.');
    return;
  }

  let isConnecting = false;

  const tryConnect = () => {
    if (isConnecting || (serialPortInstance && serialPortInstance.isOpen)) return;
    isConnecting = true;

    try {
      const port = new SerialPort({ path: portName, baudRate: 115200, autoOpen: false });
      const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

      port.on('error', (_err) => {
        serialPortInstance = null;
        isConnecting = false;
        try { port.destroy(); } catch (_) {}
      });

      port.on('close', () => {
        serialPortInstance = null;
        isConnecting = false;
      });

      parser.on('data', (line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          try {
            const json = JSON.parse(trimmed);
            if (json.tank_temp !== undefined || json.ph !== undefined) {
              handleArduinoTelemetry(json);
            }
          } catch (_err) {
            // Ignore malformed serial fragment
          }
        }
      });

      port.open((err) => {
        isConnecting = false;
        if (err) {
          // Port busy (e.g. Arduino Serial Monitor open in IDE)
          serialPortInstance = null;
          try { port.destroy(); } catch (_) {}
          return;
        }

        serialPortInstance = port;
        console.log(`[Arduino Serial] Successfully connected to Arduino Uno R4 WiFi on ${portName} at 115200 baud`);

        // Send any queued commands
        if (pendingArduinoCommands.length > 0) {
          const cmds = [...pendingArduinoCommands];
          pendingArduinoCommands = [];
          cmds.forEach(cmd => port.write(`${cmd}\n`));
        }
      });
    } catch (_err) {
      isConnecting = false;
      serialPortInstance = null;
    }
  };

  // Initial attempt and periodic reconnect loop every 3 seconds
  tryConnect();
  setInterval(tryConnect, 3000);
}

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`SMART Aqua Pond API running at http://localhost:${port}`);
  initOptionalSerialBridge();
});
