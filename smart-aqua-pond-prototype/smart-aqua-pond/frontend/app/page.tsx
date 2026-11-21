"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity, AlertTriangle, Bell, Camera, CheckCircle2, ChevronDown, CircleHelp,
  Cpu, Droplets, Eye, Fish, FlaskConical, Gauge, Layers, LayoutDashboard, Leaf,
  Menu, MoreHorizontal, OctagonAlert, Play, Power, RefreshCw, Ruler, Settings2,
  ShieldCheck, Thermometer, Waves, Wind, X, Zap
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const DEFAULT_CAM_URL = process.env.NEXT_PUBLIC_ESP32_CAM_URL || "";

type Reading = {
  temperature_c: number;
  reservoir_temp_c: number;
  ph: number;
  tds_ppm: number;
  turbidity_ntu: number;
  turbidity_voltage: number;
  water_level_cm: number;
  water_level_pct: number;
  ammonia_mg_l: number | null;
  nitrite_mg_l: number | null;
  nitrate_mg_l: number | null;
  system_state: string;
  recorded_at: string;
};

type DeviceKey = "drain_pump" | "refill_pump" | "aerator";

type Device = {
  device_key: DeviceKey;
  pin_assignment: string;
  label: string;
  description: string;
  is_enabled: boolean;
};

type AlertItem = {
  id: number;
  severity: string;
  category: string;
  message: string;
  created_at: string;
};

type FeedingEvent = {
  id: number;
  amount_grams: number;
  servo_pin: string;
  mode: string;
  created_at: string;
};

type FishStress = {
  status: string;
  behavior: string;
  stressScore: number;
  activityIndexPct: number;
  surfaceClusteringPct: number;
  autoResponseEnabled: boolean;
  lastAutoAction: string;
  updatedAt?: string;
};

type Dashboard = {
  pond: {
    id: number;
    name: string;
    species: string;
    volume_liters: number;
    reservoir_liters?: number;
    status: string;
  };
  readings: Reading;
  devices: Device[];
  alerts: AlertItem[];
  feedingEvents?: FeedingEvent[];
  arduinoStatus?: {
    connected: boolean;
    lastSeenAt: string | null;
    port: string;
  };
  fishStress?: FishStress;
};

const demo: Dashboard = {
  pond: {
    id: 1,
    name: "SMART Aqua Pond (Main Tank)",
    species: "Marine / Aquatic Habitat",
    volume_liters: 150,
    reservoir_liters: 20,
    status: "healthy"
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
    system_state: "NORMAL",
    recorded_at: "2026-01-01T00:00:00.000Z"
  },
  devices: [
    {
      device_key: "drain_pump",
      pin_assignment: "Relay CH1 · Pin D4",
      label: "12V Submersible Drain Pump",
      description: "Drains 10–25% dirty tank water into wastewater catch bucket (#2)",
      is_enabled: false
    },
    {
      device_key: "refill_pump",
      pin_assignment: "Relay CH2 · Pin D5",
      label: "12V Submersible Refill Pump",
      description: "Pumps temperature-matched clean water from reservoir bucket (#1)",
      is_enabled: false
    },
    {
      device_key: "aerator",
      pin_assignment: "Relay CH3 · Pin D6",
      label: "12V Mini Diaphragm Aerator",
      description: "Emergency oxygen supply for thermal (>30°C) or hypoxia events",
      is_enabled: true
    }
  ],
  feedingEvents: [],
  alerts: [
    {
      id: 1,
      severity: "info",
      category: "Chemical Testing Limitation",
      message: "Ammonia, nitrite, and nitrate parameters are marked as pending until physical water-testing kits become available.",
      created_at: "2026-01-01T00:00:00.000Z"
    },
    {
      id: 2,
      severity: "warning",
      category: "ESP32-CAM & Fish Behavior",
      message: "Ensure ESP32-CAM (with 37mm CPL polarizing filter) is powered on to monitor fish-stress and surface behavior.",
      created_at: "2026-01-01T00:00:00.000Z"
    }
  ],
  arduinoStatus: {
    connected: false,
    lastSeenAt: null,
    port: "USB Serial / Wi-Fi"
  },
  fishStress: {
    status: "NORMAL",
    behavior: "Calm Mid-Water Swimming",
    stressScore: 14,
    activityIndexPct: 48,
    surfaceClusteringPct: 12,
    autoResponseEnabled: true,
    lastAutoAction: "Auto-Guard Active (All parameters nominal)"
  }
};

function Metric({
  title,
  pinBadge,
  value,
  unit,
  subValue,
  icon: Icon,
  note,
  statusOk = true,
  tone = "teal"
}: {
  title: string;
  pinBadge: string;
  value: string;
  unit: string;
  subValue?: string;
  icon: any;
  note: string;
  statusOk?: boolean;
  tone?: "teal" | "blue" | "amber" | "emerald";
}) {
  const toneClass =
    tone === "blue"
      ? "bg-blue-50 text-blue-600"
      : tone === "amber"
      ? "bg-amber-50 text-amber-600"
      : tone === "emerald"
      ? "bg-emerald-50 text-emerald-600"
      : "bg-ocean-100 text-ocean-600";

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-sm font-medium text-slate-600">{title}</span>
          <div className="mt-0.5 text-[11px] font-semibold text-slate-400">{pinBadge}</div>
        </div>
        <span className={`rounded-xl p-2.5 ${toneClass}`}>
          <Icon size={18} />
        </span>
      </div>
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tracking-tight text-slate-800">{value}</span>
        <span className="text-sm font-medium text-slate-500">{unit}</span>
        {subValue && (
          <span className="ml-auto rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {subValue}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
        <span className={`h-1.5 w-1.5 rounded-full ${statusOk ? "bg-emerald-500" : "bg-amber-500"}`} />
        {note}
      </div>
    </div>
  );
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<Dashboard>(demo);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [feedAmount, setFeedAmount] = useState("50");
  const [mobileMenu, setMobileMenu] = useState(false);

  // ESP32-CAM live stream URL state
  const [cameraUrl, setCameraUrl] = useState(DEFAULT_CAM_URL);
  const [cameraInput, setCameraInput] = useState(DEFAULT_CAM_URL || "http://192.168.1.50/stream");
  const [showCameraConfig, setShowCameraConfig] = useState(false);
  const [cameraError, setCameraError] = useState(false);

  // Optional Manual Chemical Kit Entry (Ammonia, Nitrite, Nitrate)
  const [showChemicalForm, setShowChemicalForm] = useState(false);
  const [ammoniaInput, setAmmoniaInput] = useState("");
  const [nitriteInput, setNitriteInput] = useState("");
  const [nitrateInput, setNitrateInput] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/dashboard`, { cache: "no-store" });
      if (!res.ok) throw new Error("API unavailable");
      const json = await res.json();
      if (json?.pond && json?.readings) {
        setData(json);
        setConnected(true);
      } else {
        setData(demo);
        setConnected(false);
      }
    } catch {
      setData(demo);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    load();
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  }, [load]);

  async function toggleDevice(device: DeviceKey, enabled: boolean) {
    setBusy(device);
    setNotice("");
    try {
      const res = await fetch(`${API}/controls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device, enabled })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not update device");
      setData(prev => ({
        ...prev,
        devices: prev.devices.map(d => (d.device_key === device ? { ...d, is_enabled: enabled } : d))
      }));
      setNotice(json.message);
    } catch {
      setData(prev => ({
        ...prev,
        devices: prev.devices.map(d => (d.device_key === device ? { ...d, is_enabled: enabled } : d))
      }));
      setNotice(`Demo mode: ${device} state changed locally. Start the Express backend to relay to Arduino.`);
    } finally {
      setBusy(null);
    }
  }

  async function sendSystemAction(action: "WATER_CHANGE" | "STOP" | "RESUME") {
    setBusy(action);
    setNotice("");
    try {
      const res = await fetch(`${API}/controls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not execute action");
      setNotice(json.message);
      load();
    } catch {
      setNotice(`Demo mode: "${action}" previewed locally. Connect backend & Arduino Uno R4 to execute.`);
    } finally {
      setBusy(null);
    }
  }

  async function feedFish() {
    const amount = Number(feedAmount);
    if (!Number.isFinite(amount) || amount < 1 || amount > 1000) {
      setNotice("Enter a feeding amount from 1 to 1000 grams.");
      return;
    }
    setBusy("feeder");
    setNotice("");
    try {
      const res = await fetch(`${API}/feeder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountGrams: amount })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Unable to record feeding");
      setNotice(json.message);
      load();
    } catch {
      setNotice(`Demo mode: ${amount} g feeding cycle (MG996R Servo · Pin D9) previewed.`);
    } finally {
      setBusy(null);
    }
  }

  async function saveChemicalTest() {
    setBusy("chemical");
    setNotice("");
    const payload = {
      ammonia_mg_l: ammoniaInput === "" ? null : Number(ammoniaInput),
      nitrite_mg_l: nitriteInput === "" ? null : Number(nitriteInput),
      nitrate_mg_l: nitrateInput === "" ? null : Number(nitrateInput)
    };
    try {
      const res = await fetch(`${API}/chemical-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      setNotice(json.message || "Manual chemical test values updated.");
      setShowChemicalForm(false);
      load();
    } catch {
      setData(prev => ({
        ...prev,
        readings: { ...prev.readings, ...payload }
      }));
      setNotice("Demo mode: Manual chemical test kit values updated locally.");
      setShowChemicalForm(false);
    } finally {
      setBusy(null);
    }
  }

  async function triggerFishStressScenario(
    input:
      | "NORMAL"
      | "HYPOXIA_GASPING"
      | "ERRATIC_WATER_STRESS"
      | "LETHARGY"
      | {
          scenario?: "NORMAL" | "HYPOXIA_GASPING" | "ERRATIC_WATER_STRESS" | "LETHARGY";
          autoResponseEnabled?: boolean;
        }
  ) {
    const payload = typeof input === "string" ? { scenario: input } : input;
    setBusy("fishStress");
    setNotice("");
    try {
      const res = await fetch(`${API}/fish-stress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Unable to update fish stress state");
      setNotice(json.message);
      load();
    } catch {
      const current = data.fishStress || demo.fishStress!;
      const autoOn = payload.autoResponseEnabled ?? current.autoResponseEnabled;
      let nextStress: FishStress = { ...current, autoResponseEnabled: autoOn };
      if (payload.scenario === "HYPOXIA_GASPING") {
        nextStress = {
          status: "CRITICAL_STRESS",
          behavior: "Surface Gasping & Erratic Swimming (Acute Hypoxia)",
          stressScore: 90,
          activityIndexPct: 78,
          surfaceClusteringPct: 84,
          autoResponseEnabled: autoOn,
          lastAutoAction: autoOn
            ? "AUTO-ACTUATED: Emergency Aerator (Relay K3) turned ON"
            : "Manual Mode (Auto-Response paused)"
        };
      } else if (payload.scenario === "ERRATIC_WATER_STRESS") {
        nextStress = {
          status: "CRITICAL_STRESS",
          behavior: "Surface Gasping & Erratic Swimming (Acute Hypoxia)",
          stressScore: 95,
          activityIndexPct: 92,
          surfaceClusteringPct: 62,
          autoResponseEnabled: autoOn,
          lastAutoAction: autoOn
            ? "AUTO-ACTUATED: Aerator (K3) ON + Partial Water Change (K1 Drain) Started"
            : "Manual Mode (Auto-Response paused)"
        };
      } else if (payload.scenario === "LETHARGY") {
        nextStress = {
          status: "HIGH_STRESS",
          behavior: "Bottom Lethargy / Low Mobility Stress",
          stressScore: 48,
          activityIndexPct: 11,
          surfaceClusteringPct: 18,
          autoResponseEnabled: autoOn,
          lastAutoAction: autoOn
            ? "AUTO-ACTUATED: Emergency Aerator (Relay K3) turned ON"
            : "Manual Mode (Auto-Response paused)"
        };
      } else if (payload.scenario === "NORMAL") {
        nextStress = {
          status: "NORMAL",
          behavior: "Calm Mid-Water Swimming",
          stressScore: 14,
          activityIndexPct: 48,
          surfaceClusteringPct: 12,
          autoResponseEnabled: autoOn,
          lastAutoAction: "Auto-Guard Active (Fish behavior calm & nominal)"
        };
      }
      setData(prev => ({ ...prev, fishStress: nextStress }));
      setNotice(`Demo mode: ${nextStress.behavior} (${nextStress.stressScore}%). ${nextStress.lastAutoAction}`);
    } finally {
      setBusy(null);
    }
  }

  const r = data.readings;
  const fs = data.fishStress || demo.fishStress!;
  const tempDelta = Math.abs(Number(r.temperature_c) - Number(r.reservoir_temp_c ?? r.temperature_c));
  const thermalShockSafe = tempDelta <= 2.0;
  const lastUpdated = mounted && r.recorded_at
    ? new Date(r.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "—";

  return (
    <div className="min-h-screen">
      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-slate-100 bg-white px-5 py-6 transition-transform lg:translate-x-0 ${
          mobileMenu ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ocean-900 text-white">
            <Waves size={23} />
          </div>
          <div>
            <div className="font-bold tracking-tight text-slate-800">
              SMART<span className="text-ocean-600">AQUA</span>
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-[.2em] text-slate-400">
              Pond intelligence
            </div>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setMobileMenu(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <div className="mt-10 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">Workspace</div>
        <nav className="mt-3 space-y-1">
          <a className="flex items-center gap-3 rounded-xl bg-ocean-100 px-3 py-3 text-sm font-semibold text-ocean-900" href="#">
            <LayoutDashboard size={18} /> Overview
          </a>
          <a className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-500 hover:bg-slate-50" href="#water">
            <Droplets size={18} /> Sensor Suite (Uno R4)
          </a>
          <a className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-500 hover:bg-slate-50" href="#chemical">
            <FlaskConical size={18} /> Chemical Parameters
          </a>
          <a className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-500 hover:bg-slate-50" href="#fish-health">
            <Camera size={18} /> ESP32-CAM Stream
          </a>
          <a className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-500 hover:bg-slate-50" href="#controls">
            <Settings2 size={18} /> Relays & Feeder
          </a>
        </nav>

        <div className="mt-auto rounded-2xl bg-ocean-950 p-4 text-white">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Cpu size={16} /> Arduino Uno R4 WiFi
          </div>
          <p className="mt-2 text-xs leading-5 text-teal-100/75">
            Renesas RA4M1 + ESP32-S3 with 4-channel optocoupled relay isolation & LM2596S 5V buck converter.
          </p>
          <div className="mt-4 flex items-center gap-2 text-[11px] text-teal-100">
            <span className={`h-2 w-2 rounded-full ${data.arduinoStatus?.connected ? "bg-emerald-400" : "bg-amber-400"}`} />
            State: {r.system_state || "NORMAL"}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600">
            <span className="text-xs font-bold">UEP</span>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-700">SMART Aqua Pond</div>
            <div className="text-xs text-slate-400">College of Science</div>
          </div>
          <MoreHorizontal className="ml-auto text-slate-400" size={18} />
        </div>
      </aside>

      {mobileMenu && (
        <button
          className="fixed inset-0 z-20 bg-slate-900/30 lg:hidden"
          onClick={() => setMobileMenu(false)}
          aria-label="Close navigation"
        />
      )}

      {/* Main Content */}
      <main className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-10 flex h-[76px] items-center justify-between border-b border-slate-100 bg-white/90 px-5 backdrop-blur md:px-9">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setMobileMenu(true)} aria-label="Open menu">
              <Menu size={21} />
            </button>
            <div>
              <div className="text-xs text-slate-400">Marine Ecosystem Monitoring System</div>
              <div className="mt-1 text-sm font-semibold text-slate-700">Arduino Uno R4 WiFi + ESP32-CAM Telemetry</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`hidden items-center gap-2 rounded-full px-3 py-2 text-xs font-medium sm:flex ${
                connected ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-amber-500"}`} />
              {connected ? "Express + MySQL Connected" : "Demo / Fallback Mode"}
            </div>
            <button
              onClick={load}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button className="relative rounded-xl border border-slate-200 p-2.5 text-slate-500" aria-label="Notifications">
              <Bell size={17} />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-rose-500" />
            </button>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] px-5 py-7 md:px-9 md:py-9">
          {/* Top Banner */}
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-ocean-600">
                <span className="h-2 w-2 rounded-full bg-ocean-500" /> Marine Ecosystem — SMART Aqua Pond
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-800 md:text-[34px]">
                Good day, pond manager<span className="text-ocean-500">.</span>
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Real-time water quality sensor suite, thermal-shock guard, automated feeding, and partial water cycling.
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-soft">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ocean-100 text-ocean-700">
                <Waves size={20} />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-800">{data.pond.name}</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  20–50 Gal Tank ({data.pond.volume_liters} L) · Reservoir ({data.pond.reservoir_liters ?? 20} L)
                </div>
              </div>
              <ChevronDown size={16} className="ml-2 text-slate-400" />
            </div>
          </div>

          {notice && (
            <div className="mt-5 flex items-start justify-between gap-3 rounded-xl border border-ocean-100 bg-white px-4 py-3 text-sm text-slate-600 shadow-soft">
              <span>{notice}</span>
              <button onClick={() => setNotice("")} aria-label="Dismiss notice">
                <X size={16} />
              </button>
            </div>
          )}

          {/* Section 1: Active Hardware Sensor Suite (6 Sensors from BOM) */}
          <section id="water" className="mt-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold text-slate-800">Active Sensor Suite (Arduino Uno R4 WiFi)</h2>
                <p suppressHydrationWarning className="mt-1 text-xs text-slate-400">
                  6 hardware sensors configured on Digital Pins D2, D3, D7/D8 & Analog Pins A0, A1, A2 · Updated {lastUpdated}
                </p>
              </div>
              <span
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                  thermalShockSafe ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                }`}
              >
                <CheckCircle2 size={14} />
                {thermalShockSafe
                  ? `Refill ΔT: ${tempDelta.toFixed(1)}°C (Safe against thermal shock)`
                  : `Refill ΔT: ${tempDelta.toFixed(1)}°C (>2.0°C Thermal Shock Alert)`}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Metric
                title="Main Tank Water Temp"
                pinBadge="DS18B20 Probe #1 · Pin D2 (1-Wire)"
                value={Number(r.temperature_c).toFixed(1)}
                unit="°C"
                subValue={Number(r.temperature_c) > 30 ? "High (>30°C)" : "Optimal"}
                icon={Thermometer}
                statusOk={Number(r.temperature_c) <= 30}
                note="Primary fish habitat temperature (-10°C to +85°C)"
              />

              <Metric
                title="Reservoir Water Temp"
                pinBadge="DS18B20 Probe #2 · Pin D3 (1-Wire)"
                value={Number(r.reservoir_temp_c ?? 27.1).toFixed(1)}
                unit="°C"
                subValue={`ΔT ${tempDelta.toFixed(1)}°C`}
                icon={Thermometer}
                tone="blue"
                statusOk={thermalShockSafe}
                note="Clean refill bucket (#1) temperature verification"
              />

              <Metric
                title="pH Level"
                pinBadge="PH-4502C + BNC Probe · Pin A0"
                value={Number(r.ph).toFixed(2)}
                unit="pH"
                subValue="Calibrated (4.01 / 6.86 / 9.18)"
                icon={Gauge}
                statusOk={Number(r.ph) >= 6.5 && Number(r.ph) <= 8.5}
                note="Water acidity & alkalinity (0.0–14.0 pH)"
              />

              <Metric
                title="Total Dissolved Solids (TDS)"
                pinBadge="Gravity Analog TDS V1.0 · Pin A1"
                value={Number(r.tds_ppm ?? 245).toFixed(0)}
                unit="ppm"
                subValue="0–1000 ppm"
                icon={Layers}
                tone="emerald"
                statusOk={Number(r.tds_ppm ?? 245) < 600}
                note="Conductivity from dissolved fish waste & uneaten feed"
              />

              <Metric
                title="Turbidity (Water Clarity)"
                pinBadge="TS-300B Optical Probe · Pin A2"
                value={Number(r.turbidity_ntu).toFixed(1)}
                unit="NTU"
                subValue={`${Number(r.turbidity_voltage ?? 4.12).toFixed(2)} V`}
                icon={Eye}
                tone="amber"
                statusOk={Number(r.turbidity_voltage ?? 4.12) >= 2.8}
                note="Detects suspended solids, cloudiness & feces blocking IR beam"
              />

              <Metric
                title="Ultrasonic Water Level"
                pinBadge="JSN-SR04T Waterproof · Pins D7, D8"
                value={Number(r.water_level_cm ?? 32.0).toFixed(1)}
                unit="cm"
                subValue={`${Number(r.water_level_pct ?? 91.4).toFixed(0)}% Full`}
                icon={Ruler}
                tone="blue"
                statusOk={Number(r.water_level_pct ?? 91.4) >= 70}
                note="Overhead distance sensor for 10–25% partial water changes"
              />
            </div>
          </section>

          {/* Section 2: Pending Chemical Testing Parameters (Ammonia, Nitrite, Nitrate) */}
          <section id="chemical" className="mt-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-amber-50 p-2.5 text-amber-600">
                  <FlaskConical size={19} />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-800">
                      Nitrogen Cycle Parameters (Ammonia, Nitrite, Nitrate)
                    </h3>
                    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                      Pending Testing Kits
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Per Implementation Testing Plan: recorded as pending until physical chemical water-testing kits become available.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowChemicalForm(!showChemicalForm)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {showChemicalForm ? "Cancel" : "Log Manual Kit Results"}
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                { label: "Ammonia (NH₃)", val: r.ammonia_mg_l },
                { label: "Nitrite (NO₂⁻)", val: r.nitrite_mg_l },
                { label: "Nitrate (NO₃⁻)", val: r.nitrate_mg_l }
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <span className="text-xs font-medium text-slate-600">{item.label}</span>
                  {item.val !== null && item.val !== undefined ? (
                    <span className="text-sm font-bold text-slate-800">{Number(item.val).toFixed(2)} mg/L</span>
                  ) : (
                    <span className="rounded-md bg-amber-100/70 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                      Pending Kit
                    </span>
                  )}
                </div>
              ))}
            </div>

            {showChemicalForm && (
              <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-4">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Ammonia (mg/L)"
                  value={ammoniaInput}
                  onChange={e => setAmmoniaInput(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-ocean-500"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Nitrite (mg/L)"
                  value={nitriteInput}
                  onChange={e => setNitriteInput(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-ocean-500"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Nitrate (mg/L)"
                  value={nitrateInput}
                  onChange={e => setNitrateInput(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-ocean-500"
                />
                <button
                  disabled={busy === "chemical"}
                  onClick={saveChemicalTest}
                  className="rounded-xl bg-ocean-900 px-4 py-2 text-xs font-semibold text-white hover:bg-ocean-800"
                >
                  Save Kit Readings
                </button>
              </div>
            )}
          </section>

          {/* Section 3: ESP32-CAM & Actuators */}
          <div className="mt-8 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
            {/* ESP32-CAM Card */}
            <section id="fish-health" className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft md:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-800">
                    ESP32-CAM Habitat Stream & Fish-Stress Detection
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    OV2640 2MP Camera + ESP32-CAM-MB Baseboard + BlueWow 37mm CPL Polarizing Filter
                  </p>
                </div>
                <button
                  onClick={() => setShowCameraConfig(!showCameraConfig)}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  {cameraUrl ? "Change Stream IP" : "Connect ESP32-CAM"}
                </button>
              </div>

              {showCameraConfig && (
                <div className="mt-4 flex gap-2 rounded-xl bg-slate-50 p-3">
                  <input
                    type="text"
                    value={cameraInput}
                    onChange={e => setCameraInput(e.target.value)}
                    placeholder="http://192.168.1.50/stream"
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-ocean-500"
                  />
                  <button
                    onClick={() => {
                      setCameraError(false);
                      setCameraUrl(cameraInput.trim());
                      setShowCameraConfig(false);
                    }}
                    className="rounded-lg bg-ocean-900 px-3 py-2 text-xs font-semibold text-white hover:bg-ocean-800"
                  >
                    Connect Stream
                  </button>
                </div>
              )}

              <div className="mt-5 overflow-hidden rounded-2xl bg-gradient-to-br from-ocean-950 via-ocean-800 to-teal-600 p-5 text-white">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium backdrop-blur">
                    ESP32-CAM + 37MM CPL FILTER
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-teal-100">
                    <span className={`h-2 w-2 rounded-full ${cameraUrl && !cameraError ? "bg-emerald-400" : "bg-amber-300"}`} />
                    {cameraUrl && !cameraError ? "Live MJPEG Stream" : "Awaiting ESP32-CAM Stream"}
                  </span>
                </div>

                {cameraUrl && !cameraError ? (
                  <div className="mt-4 overflow-hidden rounded-xl bg-black/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cameraUrl}
                      alt="ESP32-CAM Live Aquatic Habitat Stream"
                      onError={() => setCameraError(true)}
                      className="mx-auto max-h-[260px] w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex min-h-[160px] flex-col items-center justify-center text-center">
                    <div className="mb-3 rounded-2xl bg-white/10 p-3">
                      <Camera size={28} />
                    </div>
                    <p className="text-sm font-semibold">
                      {cameraError ? "Unable to reach ESP32-CAM stream URL" : "ESP32-CAM stream not connected"}
                    </p>
                    <p className="mt-1 max-w-md text-xs leading-5 text-teal-100/80">
                      Upload <code className="rounded bg-white/10 px-1.5 py-0.5">camera/esp32_cam_stream.ino</code> to your ESP32-CAM, then click <strong>Connect ESP32-CAM</strong> above and enter its <code className="rounded bg-white/10 px-1.5 py-0.5">http://&lt;IP&gt;/stream</code> address.
                    </p>
                  </div>
                )}
              </div>

              {/* AI Vision Fish-Stress Analyzer & Automatic Response Panel */}
              <div
                className={`mt-4 rounded-xl border p-4 ${
                  fs.stressScore >= 45
                    ? "border-rose-200 bg-rose-50/80"
                    : "border-emerald-200 bg-emerald-50/70"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Fish
                      className={fs.stressScore >= 45 ? "text-rose-600" : "text-emerald-600"}
                      size={18}
                    />
                    <span className="text-sm font-semibold text-slate-800">
                      AI Fish-Stress Detection: {fs.behavior}
                    </span>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      fs.stressScore >= 45
                        ? "bg-rose-600 text-white"
                        : "bg-emerald-600 text-white"
                    }`}
                  >
                    {fs.status.replace("_", " ")} · {fs.stressScore}%
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-white/90 p-2 shadow-sm">
                    <div className="text-[11px] text-slate-400">Stress Index</div>
                    <div className="text-sm font-bold text-slate-800">{fs.stressScore} / 100</div>
                  </div>
                  <div className="rounded-lg bg-white/90 p-2 shadow-sm">
                    <div className="text-[11px] text-slate-400">Swim Motion</div>
                    <div className="text-sm font-bold text-slate-800">{fs.activityIndexPct}%</div>
                  </div>
                  <div className="rounded-lg bg-white/90 p-2 shadow-sm">
                    <div className="text-[11px] text-slate-400">Surface Gasping</div>
                    <div className="text-sm font-bold text-slate-800">{fs.surfaceClusteringPct}%</div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between rounded-lg bg-white/90 px-3 py-2 text-xs">
                  <span className="font-semibold text-slate-700">{fs.lastAutoAction}</span>
                  <span className="rounded bg-ocean-100 px-2 py-0.5 text-[10px] font-bold text-ocean-800">
                    AUTO-RESPONSE ON
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button
                    onClick={() => triggerFishStressScenario("NORMAL")}
                    disabled={busy === "fish-stress"}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Normal Swimming
                  </button>
                  <button
                    onClick={() => triggerFishStressScenario("HYPOXIA_GASPING")}
                    disabled={busy === "fish-stress"}
                    className="rounded-lg bg-amber-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-700"
                  >
                    Simulate Hypoxia Gasping (Auto-Aerator)
                  </button>
                  <button
                    onClick={() => triggerFishStressScenario("ERRATIC_WATER_STRESS")}
                    disabled={busy === "fish-stress"}
                    className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-rose-700"
                  >
                    Simulate Acute Stress (Auto Water Change)
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-xs text-slate-400">Optics Specification</div>
                  <div className="mt-1 text-sm font-semibold text-slate-700">BlueWow 37mm CPL Filter</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-xs text-slate-400">Water Clarity (TS-300B)</div>
                  <div className="mt-1 text-sm font-semibold text-slate-700">
                    {Number(r.turbidity_ntu).toFixed(1)} NTU ({Number(r.turbidity_voltage ?? 4.12).toFixed(2)}V)
                  </div>
                </div>
              </div>
            </section>

            {/* Actuators & Power Distribution Card */}
            <section id="controls" className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft md:p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold text-slate-800">Actuators & 4-Channel Relay Controls</h2>
                  <p className="mt-1 text-xs text-slate-400">
                    5V Optocoupled Relay Module (Pins D4, D5, D6) + 1N4007 Flyback Diode Protection
                  </p>
                </div>
                <span className="rounded-xl bg-ocean-100 p-2.5 text-ocean-700">
                  <Zap size={19} />
                </span>
              </div>

              {/* 3 Relay Channels from BOM */}
              <div className="mt-5 space-y-3">
                {data.devices.map(item => {
                  const on = item.is_enabled;
                  const IconComponent =
                    item.device_key === "aerator" ? Wind : item.device_key === "drain_pump" ? Droplets : RefreshCw;

                  return (
                    <div key={item.device_key} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3.5">
                      <div className={`rounded-xl p-3 ${on ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                        <IconComponent size={19} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-700">{item.label}</span>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                            {item.pin_assignment}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-400">{item.description}</div>
                        <div className={`mt-1.5 text-[10px] font-bold uppercase tracking-wider ${on ? "text-emerald-600" : "text-slate-400"}`}>
                          {on ? "Active (Relay ON)" : "Standby (Relay OFF)"}
                        </div>
                      </div>
                      <button
                        disabled={busy === item.device_key}
                        onClick={() => toggleDevice(item.device_key, !on)}
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition disabled:opacity-50 ${
                          on ? "bg-emerald-500 text-white hover:bg-emerald-600" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                        aria-label={`${on ? "Turn off" : "Turn on"} ${item.label}`}
                      >
                        <Power size={17} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Automated Water Change Cycle & Emergency Stop */}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  disabled={busy === "WATER_CHANGE"}
                  onClick={() => sendSystemAction("WATER_CHANGE")}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-ocean-600 bg-ocean-50/60 px-3 py-2.5 text-xs font-semibold text-ocean-900 transition hover:bg-ocean-100 disabled:opacity-50"
                >
                  <Play size={14} /> Auto 20% Water Change
                </button>
                <button
                  disabled={busy === "STOP"}
                  onClick={() => sendSystemAction("STOP")}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                >
                  <OctagonAlert size={14} /> Emergency Stop
                </button>
              </div>

              {/* Automated Fish Feeder (MG996R Servo on Pin D9) */}
              <div className="mt-5 border-t border-slate-100 pt-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <Fish size={16} className="text-ocean-600" /> Automated Fish Feeder
                  </div>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                    TowerPro MG996R Servo · Pin D9
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  High-torque metal gear servo powered via LM2596S 5.0V (3A) buck converter
                </p>
                <div className="mt-3 flex gap-2">
                  <div className="relative flex-1">
                    <input
                      value={feedAmount}
                      onChange={e => setFeedAmount(e.target.value)}
                      type="number"
                      min="1"
                      max="1000"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 pr-12 text-sm outline-none focus:border-ocean-500 focus:ring-2 focus:ring-ocean-100"
                    />
                    <span className="absolute right-3 top-3 text-xs text-slate-400">grams</span>
                  </div>
                  <button
                    disabled={busy === "feeder"}
                    onClick={feedFish}
                    className="rounded-xl bg-ocean-900 px-4 text-sm font-semibold text-white transition hover:bg-ocean-800 disabled:opacity-50"
                  >
                    {busy === "feeder" ? "Dispensing…" : "Dispense Feed"}
                  </button>
                </div>
              </div>
            </section>
          </div>

          {/* Section 4: System & Testing Alerts */}
          <section className="mt-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-soft md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-800">System Diagnostics & Implementation Logs</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Real-time water safety notifications and documented implementation notes
                </p>
              </div>
              <button className="flex items-center gap-1 text-xs font-semibold text-ocean-700" onClick={load}>
                View latest <RefreshCw size={13} />
              </button>
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {(data.alerts || []).length ? (
                data.alerts.map(alert => (
                  <div key={alert.id} className="flex items-start gap-3 py-4">
                    <div
                      className={`mt-0.5 rounded-xl p-2 ${
                        alert.severity === "critical"
                          ? "bg-rose-50 text-rose-600"
                          : alert.severity === "info"
                          ? "bg-blue-50 text-blue-600"
                          : "bg-amber-50 text-amber-600"
                      }`}
                    >
                      <AlertTriangle size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-700">{alert.category}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            alert.severity === "critical"
                              ? "bg-rose-50 text-rose-600"
                              : alert.severity === "info"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {alert.severity}
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-5 text-slate-500">{alert.message}</p>
                    </div>
                    <span suppressHydrationWarning className="whitespace-nowrap text-[11px] text-slate-400">
                      {mounted ? new Date(alert.created_at).toLocaleDateString() : ""}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-sm text-slate-400">
                  <CheckCircle2 className="mx-auto mb-2 text-emerald-500" size={22} />
                  No active alerts
                </div>
              )}
            </div>
          </section>

          <footer className="flex flex-col gap-2 py-7 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <span>© 2026 SMART Aqua Pond · University of Eastern Philippines — College of Science</span>
            <span className="flex items-center gap-1">
              <CircleHelp size={13} /> Hardware: Arduino Uno R4 WiFi + ESP32-CAM + 4-Ch Optocoupled Relay + LM2596S
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}
