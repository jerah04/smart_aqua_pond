require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000' }));
app.use(express.json());

const demoDashboard = {
  pond: { id: 1, name: 'Pond Alpha', species: 'Nile Tilapia', volume_liters: 12000, status: 'healthy' },
  readings: { temperature_c: 27.4, ph: 7.3, dissolved_oxygen_mg_l: 6.8, ammonia_mg_l: 0.12, turbidity_ntu: 18.5, recorded_at: new Date().toISOString() },
  devices: [{ device_key: 'aerator', label: 'Pond aerator', is_enabled: true }, { device_key: 'pump', label: 'Water circulation pump', is_enabled: false }],
  alerts: [{ id: 1, severity: 'warning', category: 'Fish health', message: 'Camera review recommended: unusual surface activity detected.', created_at: new Date().toISOString() }]
};

app.get('/api/health', async (_req, res) => {
  try { await db.query('SELECT 1'); res.json({ status: 'ok', database: 'connected' }); }
  catch (e) { res.status(503).json({ status: 'degraded', database: 'disconnected', message: 'Check backend .env and MySQL service.' }); }
});

app.get('/api/dashboard', async (_req, res) => {
  try {
    const [[pond]] = await db.query('SELECT * FROM ponds ORDER BY id LIMIT 1');
    if (!pond) return res.json(demoDashboard);
    const [[reading]] = await db.query('SELECT * FROM sensor_readings WHERE pond_id=? ORDER BY recorded_at DESC LIMIT 1', [pond.id]);
    const [devices] = await db.query('SELECT device_key, label, is_enabled FROM devices WHERE pond_id=?', [pond.id]);
    const [alerts] = await db.query('SELECT id, severity, category, message, created_at FROM alerts WHERE pond_id=? AND is_resolved=FALSE ORDER BY created_at DESC LIMIT 8', [pond.id]);
    res.json({ pond, readings: reading || demoDashboard.readings, devices, alerts });
  } catch (e) { console.error(e.message); res.status(500).json({ error: 'Unable to load dashboard data.' }); }
});

app.get('/api/ponds', async (_req, res) => {
  try { const [rows] = await db.query('SELECT * FROM ponds ORDER BY id'); res.json(rows); }
  catch (e) { res.status(500).json({ error: 'Unable to load ponds.' }); }
});

app.get('/api/ponds/:id/readings', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM sensor_readings WHERE pond_id=? ORDER BY recorded_at DESC LIMIT 24', [req.params.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: 'Unable to load readings.' }); }
});

app.get('/api/alerts', async (_req, res) => {
  try { const [rows] = await db.query('SELECT a.*, p.name AS pond_name FROM alerts a JOIN ponds p ON p.id=a.pond_id WHERE a.is_resolved=FALSE ORDER BY a.created_at DESC'); res.json(rows); }
  catch (e) { res.status(500).json({ error: 'Unable to load alerts.' }); }
});

app.post('/api/controls', async (req, res) => {
  const { device, enabled } = req.body || {};
  if (!['aerator', 'pump'].includes(device) || typeof enabled !== 'boolean') return res.status(400).json({ error: 'device must be aerator or pump and enabled must be boolean.' });
  try {
    const [result] = await db.query('UPDATE devices SET is_enabled=? WHERE device_key=? AND pond_id=(SELECT id FROM ponds ORDER BY id LIMIT 1)', [enabled, device]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Device not found. Run database/schema.sql first.' });
    res.json({ success: true, device, enabled, message: `${device} set ${enabled ? 'on' : 'off'} in prototype database.` });
  } catch (e) { res.status(500).json({ error: 'Unable to update device state.' }); }
});

app.post('/api/feeder', async (req, res) => {
  const amountGrams = Number(req.body?.amountGrams);
  if (!Number.isFinite(amountGrams) || amountGrams < 1 || amountGrams > 1000) return res.status(400).json({ error: 'amountGrams must be between 1 and 1000.' });
  try {
    await db.query("INSERT INTO feeding_events (pond_id, amount_grams, mode) VALUES ((SELECT id FROM ponds ORDER BY id LIMIT 1), ?, 'manual')", [amountGrams]);
    res.json({ success: true, amountGrams, message: `Recorded a ${amountGrams} g feeding event.` });
  } catch (e) { res.status(500).json({ error: 'Unable to record feeding event.' }); }
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`SMART Aqua Pond API running at http://localhost:${port}`));
