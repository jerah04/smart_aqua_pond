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

The application root is:

```text
C:\xampp\htdocs\repos\smart_aqua_pond
```

> Use the root above. The old `smart-aqua-pond-prototype\smart-aqua-pond` path is no longer used.

## 2. Set up MySQL
Open MySQL Workbench and run `backend/database/schema.sql`. This creates `smart_aqua_pond` and starter tables/data.

## 3. Start the backend (PowerShell)
Open a terminal and run:

```powershell
Set-Location "C:\xampp\htdocs\repos\smart_aqua_pond\backend"
Copy-Item .env.example .env -Force
npm install
npm run dev
```

If PowerShell reports `Could not determine Node.js install directory` for `npm`, use `npm.cmd` instead:

```powershell
npm.cmd install
npm.cmd run dev
```

API runs at `http://localhost:4000`. Check `http://localhost:4000/api/health`.

If your local MySQL user has no password, keep `DB_PASSWORD=` empty in `.env`.

## 4. Start the frontend (PowerShell)
In another terminal:

```powershell
Set-Location "C:\xampp\htdocs\repos\smart_aqua_pond\frontend"
Copy-Item .env.local.example .env.local -Force
npm install
npm run dev
```

If needed, use `npm.cmd`:

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000`. 

Do not run commands from the old nested path because that directory no longer exists.

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
