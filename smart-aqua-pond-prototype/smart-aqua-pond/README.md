# SMART Aqua Pond — Initial Prototype

A modern, minimalistic full-stack prototype for monitoring aquaculture ponds.

## Stack
- Frontend: Next.js App Router, TypeScript, Tailwind CSS, lucide-react
- Backend: Node.js, Express, mysql2
- Database: MySQL (manage it with MySQL Workbench)

## Prototype features
- Pond overview with water-quality indicators and status
- Fish health/stress alerts (prototype/demo data; camera AI is not connected)
- Sensor readings and recent history
- Manual aerator/pump controls and feeder action
- API health endpoint and REST endpoints
- SQL schema and optional seed data

> Important: This is a software prototype. Sensor values and AI stress classifications are simulated unless you connect real hardware and a validated computer-vision model. Do not rely on the demo's automatic recommendations as veterinary or water-quality advice.

## 1. Requirements
- Node.js 20+
- MySQL 8+
- npm

## 2. Set up MySQL
Open MySQL Workbench and run `database/schema.sql`. This creates `smart_aqua_pond` and starter tables/data.

## 3. Start the backend
```bash
cd backend
cp .env.example .env
# Update DB credentials in .env
npm install
npm run dev
```
API runs at `http://localhost:4000`. Check `http://localhost:4000/api/health`.

If your local MySQL user has no password, set `DB_PASSWORD=` in `.env`.

## 4. Start the frontend
In another terminal:
```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```
Open `http://localhost:3000`.

## API endpoints
- `GET /api/health`
- `GET /api/dashboard`
- `GET /api/ponds`
- `GET /api/ponds/:id/readings`
- `GET /api/alerts`
- `POST /api/controls` — `{ "device": "aerator"|"pump", "enabled": true|false }`
- `POST /api/feeder` — `{ "amountGrams": 50 }`

## Architecture notes
- The frontend falls back to clearly labeled demo data if the backend is unavailable.
- The current controls update the prototype database state only. Real actuators require a device gateway (for example, ESP32/MQTT) and safe hardware interlocks.
- For production, add authentication, authorization, audit logs, input validation, rate limits, TLS, and hardware fail-safes.
