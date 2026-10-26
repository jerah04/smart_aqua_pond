"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity, AlertTriangle, Bell, CheckCircle2, ChevronDown, CircleHelp, Droplets,
  Fish, Gauge, LayoutDashboard, Leaf, Menu, MoreHorizontal, Power, RefreshCw,
  Settings2, ShieldCheck, Thermometer, Waves, Wind, X, Zap
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

type Reading = { temperature_c: number; ph: number; dissolved_oxygen_mg_l: number; ammonia_mg_l: number; turbidity_ntu: number; recorded_at: string };
type Device = { device_key: "aerator" | "pump"; label: string; is_enabled: boolean };
type AlertItem = { id: number; severity: string; category: string; message: string; created_at: string };
type Dashboard = { pond: { id: number; name: string; species: string; volume_liters: number; status: string }; readings: Reading; devices: Device[]; alerts: AlertItem[] };

const demo: Dashboard = {
  pond: { id: 1, name: "Pond Alpha", species: "Nile Tilapia", volume_liters: 12000, status: "healthy" },
  readings: { temperature_c: 27.4, ph: 7.3, dissolved_oxygen_mg_l: 6.8, ammonia_mg_l: 0.12, turbidity_ntu: 18.5, recorded_at: new Date().toISOString() },
  devices: [{ device_key: "aerator", label: "Pond aerator", is_enabled: true }, { device_key: "pump", label: "Water circulation pump", is_enabled: false }],
  alerts: [{ id: 1, severity: "warning", category: "Fish health", message: "Unusual surface activity detected. Review camera feed and fish behavior.", created_at: new Date().toISOString() }]
};

function Metric({ title, value, unit, icon: Icon, note, tone = "teal" }: { title: string; value: string; unit: string; icon: any; note: string; tone?: string }) {
  return <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft">
    <div className="flex items-center justify-between"><span className="text-sm font-medium text-slate-500">{title}</span><span className={`rounded-xl p-2 ${tone === "blue" ? "bg-blue-50 text-blue-600" : tone === "amber" ? "bg-amber-50 text-amber-600" : "bg-ocean-100 text-ocean-600"}`}><Icon size={18}/></span></div>
    <div className="mt-5 flex items-baseline gap-1"><span className="text-3xl font-semibold tracking-tight text-slate-800">{value}</span><span className="text-sm text-slate-500">{unit}</span></div>
    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500"/>{note}</div>
  </div>;
}

export default function Home() {
  const [data, setData] = useState<Dashboard>(demo);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [feedAmount, setFeedAmount] = useState("50");
  const [mobileMenu, setMobileMenu] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/dashboard`, { cache: "no-store" });
      if (!res.ok) throw new Error("API unavailable");
      const json = await res.json();
      if (json?.pond && json?.readings) { setData(json); setConnected(true); }
      else { setData(demo); setConnected(false); }
    } catch { setData(demo); setConnected(false); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleDevice(device: "aerator" | "pump", enabled: boolean) {
    setBusy(device); setNotice("");
    try {
      const res = await fetch(`${API}/controls`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ device, enabled }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not update device");
      setData(prev => ({ ...prev, devices: prev.devices.map(d => d.device_key === device ? { ...d, is_enabled: enabled } : d) }));
      setNotice(`${device === "aerator" ? "Aerator" : "Water pump"} ${enabled ? "turned on" : "turned off"} in the database.`);
    } catch {
      // Demo mode remains interactive but clearly does not claim hardware control.
      setData(prev => ({ ...prev, devices: prev.devices.map(d => d.device_key === device ? { ...d, is_enabled: enabled } : d) }));
      setNotice(`Demo mode: ${device} state changed locally. Connect the backend to save this state.`);
    } finally { setBusy(null); }
  }

  async function feedFish() {
    const amount = Number(feedAmount);
    if (!Number.isFinite(amount) || amount < 1 || amount > 1000) { setNotice("Enter a feeding amount from 1 to 1000 grams."); return; }
    setBusy("feeder"); setNotice("");
    try {
      const res = await fetch(`${API}/feeder`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amountGrams: amount }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Unable to record feeding");
      setNotice(json.message);
    } catch { setNotice(`Demo mode: ${amount} g feeding event previewed. Connect the backend to record it.`); }
    finally { setBusy(null); }
  }

  const r = data.readings;
  const devices = (key: "aerator" | "pump") => data.devices.find(d => d.device_key === key)?.is_enabled ?? false;
  const lastUpdated = r.recorded_at ? new Date(r.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

  return <div className="min-h-screen">
    <aside className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-slate-100 bg-white px-5 py-6 transition-transform lg:translate-x-0 ${mobileMenu ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex items-center gap-3 px-2"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ocean-900 text-white"><Waves size={23}/></div><div><div className="font-bold tracking-tight text-slate-800">SMART<span className="text-ocean-600">AQUA</span></div><div className="text-[10px] font-semibold uppercase tracking-[.2em] text-slate-400">Pond intelligence</div></div><button className="ml-auto lg:hidden" onClick={() => setMobileMenu(false)} aria-label="Close menu"><X size={18}/></button></div>
      <div className="mt-10 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">Workspace</div>
      <nav className="mt-3 space-y-1">
        <a className="flex items-center gap-3 rounded-xl bg-ocean-100 px-3 py-3 text-sm font-semibold text-ocean-900" href="#"><LayoutDashboard size={18}/>Overview</a>
        <a className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-500 hover:bg-slate-50" href="#water"><Droplets size={18}/>Water quality</a>
        <a className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-500 hover:bg-slate-50" href="#fish-health"><Fish size={18}/>Fish health</a>
        <a className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-500 hover:bg-slate-50" href="#controls"><Settings2 size={18}/>Device controls</a>
      </nav>
      <div className="mt-auto rounded-2xl bg-ocean-950 p-4 text-white"><div className="flex items-center gap-2 text-sm font-semibold"><Leaf size={16}/>Healthy pond, better yield</div><p className="mt-2 text-xs leading-5 text-teal-100/75">Keep a close eye on water conditions and fish behavior.</p><div className="mt-4 flex items-center gap-2 text-[11px] text-teal-100"><span className="h-2 w-2 rounded-full bg-emerald-400"/> Monitoring workspace</div></div>
      <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-5"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600"><span className="text-xs font-bold">SA</span></div><div><div className="text-sm font-semibold text-slate-700">Pond administrator</div><div className="text-xs text-slate-400">Local prototype</div></div><MoreHorizontal className="ml-auto text-slate-400" size={18}/></div>
    </aside>
    {mobileMenu && <button className="fixed inset-0 z-20 bg-slate-900/30 lg:hidden" onClick={() => setMobileMenu(false)} aria-label="Close navigation"/>}
    <main className="min-h-screen lg:pl-64">
      <header className="sticky top-0 z-10 flex h-[76px] items-center justify-between border-b border-slate-100 bg-white/90 px-5 backdrop-blur md:px-9">
        <div className="flex items-center gap-3"><button className="lg:hidden" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu size={21}/></button><div><div className="text-xs text-slate-400">Workspace / Overview</div><div className="mt-1 text-sm font-semibold text-slate-700">Pond monitoring</div></div></div>
        <div className="flex items-center gap-3"><div className={`hidden items-center gap-2 rounded-full px-3 py-2 text-xs font-medium sm:flex ${connected ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}><span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-amber-500"}`}/>{connected ? "Backend connected" : "Demo data"}</div><button onClick={load} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/><span className="hidden sm:inline">Refresh</span></button><button className="relative rounded-xl border border-slate-200 p-2.5 text-slate-500" aria-label="Notifications"><Bell size={17}/><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-rose-500"/></button></div>
      </header>
      <div className="mx-auto max-w-[1500px] px-5 py-7 md:px-9 md:py-9">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-ocean-600"><span className="h-2 w-2 rounded-full bg-ocean-500"/> Aquaculture monitoring</div><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-800 md:text-[34px]">Good day, pond manager<span className="text-ocean-500">.</span></h1><p className="mt-2 text-sm text-slate-500">Here’s what’s happening in your pond right now.</p></div><div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-soft"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ocean-100 text-ocean-700"><Waves size={20}/></div><div><div className="text-sm font-semibold text-slate-800">{data.pond.name}</div><div className="mt-0.5 text-xs text-slate-500">{data.pond.species} · {(data.pond.volume_liters || 0).toLocaleString()} L</div></div><ChevronDown size={16} className="ml-3 text-slate-400"/></div></div>

        {notice && <div className="mt-5 flex items-start justify-between gap-3 rounded-xl border border-ocean-100 bg-white px-4 py-3 text-sm text-slate-600 shadow-soft"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss notice"><X size={16}/></button></div>}

        <section id="water" className="mt-8"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-slate-800">Water quality</h2><p className="mt-1 text-xs text-slate-400">Essential parameters · Updated {lastUpdated}</p></div><span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"><CheckCircle2 size={14}/> Within target range*</span></div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric title="Water temperature" value={Number(r.temperature_c).toFixed(1)} unit="°C" icon={Thermometer} note="Typical warm-water range" />
            <Metric title="Dissolved oxygen" value={Number(r.dissolved_oxygen_mg_l).toFixed(1)} unit="mg/L" icon={Wind} note="Oxygen availability" tone="blue"/>
            <Metric title="pH level" value={Number(r.ph).toFixed(1)} unit="pH" icon={Gauge} note="Acidity / alkalinity" />
            <Metric title="Ammonia" value={Number(r.ammonia_mg_l).toFixed(2)} unit="mg/L" icon={Activity} note="Monitor for toxic buildup" tone="amber"/>
          </div><p className="mt-3 text-[11px] text-slate-400">*Indicative demo status only. Acceptable ranges vary by species and life stage; validate against local aquaculture guidance.</p>
        </section>

        <div className="mt-8 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
          <section id="fish-health" className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft md:p-6">
            <div className="flex items-start justify-between"><div><h2 className="font-semibold text-slate-800">Fish health & habitat</h2><p className="mt-1 text-xs text-slate-400">Camera monitoring and behavior review</p></div><span className="rounded-xl bg-rose-50 p-2.5 text-rose-600"><Fish size={19}/></span></div>
            <div className="mt-5 overflow-hidden rounded-2xl bg-gradient-to-br from-ocean-950 via-ocean-800 to-teal-600 p-5 text-white">
              <div className="flex items-center justify-between"><span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium backdrop-blur">CAMERA STATUS</span><span className="flex items-center gap-1.5 text-xs text-teal-100"><span className="h-2 w-2 rounded-full bg-amber-300"/> Awaiting camera</span></div>
              <div className="flex min-h-[130px] flex-col items-center justify-center text-center"><div className="mb-3 rounded-2xl bg-white/10 p-3"><Waves size={30}/></div><p className="text-sm font-semibold">Habitat camera not connected</p><p className="mt-1 max-w-xs text-xs leading-5 text-teal-100/80">Connect an IP camera or video source to enable visual monitoring.</p></div>
            </div>
            <div className="mt-4 flex gap-3 rounded-xl border border-amber-100 bg-amber-50/70 p-4"><AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={18}/><div><div className="text-sm font-semibold text-slate-700">Behavior review recommended</div><p className="mt-1 text-xs leading-5 text-slate-500">Demo alert: unusual surface activity detected. Verify oxygen levels and inspect fish before taking action.</p></div></div>
            <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-400">Visual AI</div><div className="mt-1 text-sm font-semibold text-slate-700">Not connected</div></div><div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-400">Turbidity</div><div className="mt-1 text-sm font-semibold text-slate-700">{Number(r.turbidity_ntu).toFixed(1)} NTU</div></div></div>
          </section>

          <section id="controls" className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft md:p-6">
            <div className="flex items-start justify-between"><div><h2 className="font-semibold text-slate-800">Device controls</h2><p className="mt-1 text-xs text-slate-400">Manual controls for connected equipment</p></div><span className="rounded-xl bg-ocean-100 p-2.5 text-ocean-700"><Zap size={19}/></span></div>
            <div className="mt-5 space-y-3">
              {[{ key: "aerator" as const, name: "Pond aerator", desc: "Supports dissolved oxygen", icon: Wind }, { key: "pump" as const, name: "Circulation pump", desc: "Moves and circulates water", icon: RefreshCw }].map(item => {
                const on = devices(item.key);
                return <div key={item.key} className="flex items-center gap-3 rounded-xl border border-slate-100 p-4"><div className={`rounded-xl p-3 ${on ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}><item.icon size={19}/></div><div className="min-w-0 flex-1"><div className="text-sm font-semibold text-slate-700">{item.name}</div><div className="mt-1 text-xs text-slate-400">{item.desc}</div><div className={`mt-2 text-[10px] font-bold uppercase tracking-wider ${on ? "text-emerald-600" : "text-slate-400"}`}>{on ? "Running" : "Standby"}</div></div><button disabled={busy === item.key} onClick={() => toggleDevice(item.key, !on)} className={`flex h-10 w-10 items-center justify-center rounded-full transition disabled:opacity-50 ${on ? "bg-emerald-500 text-white hover:bg-emerald-600" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`} aria-label={`${on ? "Turn off" : "Turn on"} ${item.name}`}><Power size={17}/></button></div>;
              })}
            </div>
            <div className="mt-6 border-t border-slate-100 pt-5"><div className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Fish size={16} className="text-ocean-600"/> Controlled fish feeder</div><p className="mt-1 text-xs text-slate-400">Log a manual feed event</p><div className="mt-3 flex gap-2"><div className="relative flex-1"><input value={feedAmount} onChange={e => setFeedAmount(e.target.value)} type="number" min="1" max="1000" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 pr-12 text-sm outline-none focus:border-ocean-500 focus:ring-2 focus:ring-ocean-100"/><span className="absolute right-3 top-3 text-xs text-slate-400">grams</span></div><button disabled={busy === "feeder"} onClick={feedFish} className="rounded-xl bg-ocean-900 px-4 text-sm font-semibold text-white transition hover:bg-ocean-800 disabled:opacity-50">{busy === "feeder" ? "Saving…" : "Feed fish"}</button></div></div>
            <div className="mt-5 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-[11px] leading-5 text-slate-500"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-slate-400"/> Prototype only: device buttons update database state, not physical hardware. Add an authenticated device gateway and safety interlocks before deployment.</div>
          </section>
        </div>

        <section className="mt-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-soft md:p-6">
          <div className="flex items-center justify-between"><div><h2 className="font-semibold text-slate-800">Recent alerts</h2><p className="mt-1 text-xs text-slate-400">Items that may need your attention</p></div><button className="flex items-center gap-1 text-xs font-semibold text-ocean-700" onClick={load}>View latest <RefreshCw size={13}/></button></div>
          <div className="mt-4 divide-y divide-slate-100">{(data.alerts || []).length ? data.alerts.map(alert => <div key={alert.id} className="flex items-start gap-3 py-4"><div className={`mt-0.5 rounded-xl p-2 ${alert.severity === "critical" ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"}`}><AlertTriangle size={17}/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold text-slate-700">{alert.category}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${alert.severity === "critical" ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-700"}`}>{alert.severity}</span></div><p className="mt-1 text-sm leading-5 text-slate-500">{alert.message}</p></div><span className="whitespace-nowrap text-[11px] text-slate-400">{new Date(alert.created_at).toLocaleDateString()}</span></div>) : <div className="py-8 text-center text-sm text-slate-400"><CheckCircle2 className="mx-auto mb-2 text-emerald-500" size={22}/>No active alerts</div>}</div>
        </section>
        <footer className="flex flex-col gap-2 py-7 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between"><span>© 2026 SMART Aqua Pond · Initial prototype</span><span className="flex items-center gap-1"><CircleHelp size={13}/> Demo data is not a substitute for calibrated sensors.</span></footer>
      </div>
    </main>
  </div>;
}
