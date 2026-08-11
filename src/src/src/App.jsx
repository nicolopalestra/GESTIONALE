import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus, Calendar, Users, X, Trash2, Edit2, AlertTriangle, CheckCircle2,
  ExternalLink, Loader2, ChevronLeft, Dumbbell, Utensils, TrendingUp, Link2,
  Settings, MessageCircle, Search, Download, Upload, Euro, Bell, ClipboardList,
  Sun, Mail, Repeat, BookmarkPlus, Bookmark, FileText
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "./supabaseClient";

// -------------------------------------------------------------
// FUNZIONI DI SALVATAGGIO CLOUD (SUPABASE)
// -------------------------------------------------------------
async function loadWithMigration(key) {
  try {
    const { data, error } = await supabase
      .from('app_data')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    
    if (data && data.value) {
      return data.value;
    }
  } catch (e) {
    console.error("Errore lettura Supabase:", e);
  }
  return localStorage.getItem(key);
}

async function saveStorage(key, value) {
  try {
    await supabase
      .from('app_data')
      .upsert({ key: key, value: value });
  } catch (e) {
    console.error("Errore salvataggio Supabase:", e);
  }
}

// -------------------------------------------------------------
// COSTANTI E UTILITÀ
// -------------------------------------------------------------
const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
`;

const COLORS = {
  bg: "#F7F7F7", card: "#FFFFFF", ink: "#121212", inkSoft: "#63696A",
  turquoise: "#0DB6AC", turquoiseSoft: "#E0F6F4",
  amber: "#C79A3B", amberSoft: "#F6EFDC",
  red: "#B3462C", redSoft: "#F5E4DE",
  line: "#E4E4E4",
};

const PERSONAL_PACKAGES = [12, 24, 36];
const ONLINE_DURATIONS = [
  { id: "trimestrale", label: "Trimestrale", months: 3 },
  { id: "semestrale", label: "Semestrale", months: 6 },
  { id: "annuale", label: "Annuale", months: 12 },
];
const ADERENZA_OPTS = ["Ottima", "Buona", "Discreta", "Scarsa"];
const DEFAULT_PRICING = {
  personal: { 12: 960, 24: 1800, 36: 2550 },
  online: { trimestrale: 170, semestrale: 300, annuale: 500 },
};

const uid = () => Math.random().toString(36).slice(2, 10);
const todayISO = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const fmtDate = (iso) => (!iso ? "—" : new Date(iso + "T00:00:00").toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" }));
const fmtDateShort = (iso) => (!iso ? "—" : new Date(iso + "T00:00:00").toLocaleDateString("it-IT", { day: "2-digit", month: "short" }));
const waLink = (phone, text) => `https://wa.me/${(phone || "").replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
const mailLink = (email, subject, body) => `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

function addMonths(iso, months) {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}
function addDays(iso, days) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function emptyExercises() {
  return Array.from({ length: 8 }, () => ({ id: uid(), name: "", sets: "", reps: "", load: "" }));
}

function Ring({ pct, size = 56, stroke = 6, color, bg = "#E4E4E4", label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - Math.min(Math.max(pct, 0), 1) * c;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={bg} strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.5s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'IBM Plex Mono', monospace", fontSize: size * 0.24, fontWeight: 600, color: COLORS.ink }}>{label}</div>
    </div>
  );
}

function statusOf(client) {
  if (client.type === "online") {
    const d = daysBetween(todayISO(), client.endDate);
    if (d < 0) return { level: "scaduto", days: d };
    if (d <= 7) return { level: "urgente", days: d };
    if (d <= 21) return { level: "attenzione", days: d };
    return { level: "ok", days: d };
  } else {
    const remaining = client.totalLessons - client.usedLessons;
    if (remaining <= 0) return { level: "scaduto", remaining };
    if (remaining === 1) return { level: "urgente", remaining };
    if (remaining <= 2) return { level: "attenzione", remaining };
    return { level: "ok", remaining };
  }
}
const statusColors = {
  ok: { text: COLORS.turquoise, bg: COLORS.turquoiseSoft, label: "Attivo" },
  attenzione: { text: COLORS.amber, bg: COLORS.amberSoft, label: "In scadenza" },
  urgente: { text: COLORS.red, bg: COLORS.redSoft, label: "Ultimi giorni" },
  scaduto: { text: COLORS.red, bg: COLORS.redSoft, label: "Scaduto" },
};

function packageLabel(client) {
  if (client.type === "personal") return `Pacchetto ${client.totalLessons} lezioni`;
  const d = ONLINE_DURATIONS.find((x) => x.id === client.duration);
  return d ? d.label : "Abbonamento online";
}

function renewalMessage(client) {
  if (client.type === "online") {
    return `Ciao ${client.name.split(" ")[0]}! Il tuo abbonamento ${packageLabel(client).toLowerCase()} scade il ${fmtDate(client.endDate)}. Vuoi rinnovare per continuare a lavorare insieme? Fammi sapere 💪`;
  }
  const remaining = client.totalLessons - client.usedLessons;
  return `Ciao ${client.name.split(" ")[0]}! Ti restano ${remaining <= 0 ? "0" : remaining} lezion${remaining === 1 ? "e" : "i"} nel tuo pacchetto da ${client.totalLessons}. Vuoi rinnovare? Fammi sapere 💪`;
}

function googleCalendarLink(appt, client) {
  const start = new Date(`${appt.date}T${appt.time || "09:00"}:00`);
  const end = new Date(start.getTime() + (appt.duration || 60) * 60000);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${appt.title || "Lezione"} — ${client ? client.name : ""}`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: appt.notes || "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function suggestedPrice(client, pricing) {
  if (client.type === "personal") return pricing.personal?.[client.totalLessons] ?? "";
  return pricing.online?.[client.duration] ?? "";
}

function remainingDue(client) {
  const total = Number(client.priceTotal) || 0;
  const paid = Number(client.amountPaid) || 0;
  return Math.max(total - paid, 0);
}

function migrateClient(c, pricing) {
  const base = {
    trainings: [], nutritionPlans: [], schede: [], weightLog: [], checkins: [],
    priceTotal: "", amountPaid: "", archived: false,
    ...c,
    type: c.type === "tempo" ? "online" : c.type === "pacchetto" ? "personal" : c.type,
  };
  if (base.priceTotal === "" && (c.paymentStatus !== undefined)) {
    const suggested = suggestedPrice(base, pricing || DEFAULT_PRICING);
    base.priceTotal = suggested || "";
    if (c.paymentStatus === "pagato") base.amountPaid = base.priceTotal;
    else base.amountPaid = suggested && c.paymentAmount ? Math.max(Number(suggested) - Number(c.paymentAmount), 0) : 0;
  }
  return base;
}
function migrateAppt(a) {
  return { status: "previsto", consumesLesson: true, lessonDeducted: false, ...a };
}

/* ---------------- Root ---------------- */

export default function Gestionale() {
  const [clients, setClients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [businessName, setBusinessName] = useState("Gestionale");
  const [pricing, setPricing] = useState(DEFAULT_PRICING);
  const [lastBackupAt, setLastBackupAt] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const c = await loadWithMigration("clients");
      if (c) { try { setClients(JSON.parse(c).map((cl) => migrateClient(cl, DEFAULT_PRICING))); } catch (e) {} }
      const a = await loadWithMigration("appointments");
      if (a) { try { setAppointments(JSON.parse(a).map(migrateAppt)); } catch (e) {} }
      const t = await loadWithMigration("workoutTemplates");
      if (t) { try { setTemplates(JSON.parse(t)); } catch (e) {} }
      const b = await loadWithMigration("businessName");
      if (b) setBusinessName(b);
      const pr = await loadWithMigration("pricing");
      if (pr) { try { setPricing({ ...DEFAULT_PRICING, ...JSON.parse(pr) }); } catch (e) {} }
      const lb = await loadWithMigration("lastBackupAt");
      if (lb) setLastBackupAt(lb);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => { if (loaded) saveStorage("clients", JSON.stringify(clients)).catch(() => {}); }, [clients, loaded]);
  useEffect(() => { if (loaded) saveStorage("appointments", JSON.stringify(appointments)).catch(() => {}); }, [appointments, loaded]);
  useEffect(() => { if (loaded) saveStorage("workoutTemplates", JSON.stringify(templates)).catch(() => {}); }, [templates, loaded]);
  useEffect(() => { if (loaded) saveStorage("pricing", JSON.stringify(pricing)).catch(() => {}); }, [pricing, loaded]);

  const clientsRef = useRef(clients);
  const appointmentsRef = useRef(appointments);
  useEffect(() => { clientsRef.current = clients; }, [clients]);
  useEffect(() => { appointmentsRef.current = appointments; }, [appointments]);

  useEffect(() => {
    if (!loaded) return;
    function processAutoDeductions() {
      const now = new Date();
      const currentAppts = appointmentsRef.current;
      const currentClients = clientsRef.current;
      const usageDelta = {};
      let changed = false;
      const updatedAppts = currentAppts.map((a) => {
        if (a.status !== "previsto" || a.consumesLesson === false) return a;
        const client = currentClients.find((c) => c.id === a.clientId);
        if (!client || client.type !== "personal") return a;
        const end = new Date(`${a.date}T${a.time || "00:00"}:00`);
        end.setMinutes(end.getMinutes() + (a.duration || 60));
        if (now >= end) {
          usageDelta[client.id] = (usageDelta[client.id] || 0) + 1;
          changed = true;
          return { ...a, status: "fatta", lessonDeducted: true };
        }
        return a;
      });
      if (changed) {
        setAppointments(updatedAppts);
        setClients((prev) => prev.map((c) => (usageDelta[c.id] ? { ...c, usedLessons: Math.min(c.usedLessons + usageDelta[c.id], c.totalLessons) } : c)));
      }
    }
    processAutoDeductions();
    const id = setInterval(processAutoDeductions, 60000);
    return () => clearInterval(id);
  }, [loaded]);

  function markApptStatus(apptId, status) {
    setAppointments((prevAppts) => {
      const appt = prevAppts.find((a) => a.id === apptId);
      if (!appt) return prevAppts;
      const client = clients.find((c) => c.id === appt.clientId);
      const isPersonal = client && client.type === "personal" && appt.consumesLesson !== false;
      if (status === "fatta" && isPersonal && !appt.lessonDeducted) {
        setClients((prevC) => prevC.map((c) => (c.id === client.id ? { ...c, usedLessons: Math.min(c.usedLessons + 1, c.totalLessons) } : c)));
        return prevAppts.map((a) => (a.id === apptId ? { ...a, status, lessonDeducted: true } : a));
      }
      if (status !== "fatta" && appt.lessonDeducted && isPersonal) {
        setClients((prevC) => prevC.map((c) => (c.id === client.id ? { ...c, usedLessons: Math.max(c.usedLessons - 1, 0) } : c)));
        return prevAppts.map((a) => (a.id === apptId ? { ...a, status, lessonDeducted: false } : a));
      }
      return prevAppts.map((a) => (a.id === apptId ? { ...a, status } : a));
    });
  }

  function changeBusinessName(name) {
    setBusinessName(name);
    saveStorage("businessName", name).catch(() => {});
  }
  function recordBackup() {
    const now = new Date().toISOString();
    setLastBackupAt(now);
    saveStorage("lastBackupAt", now).catch(() => {});
  }

  if (!loaded) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: COLORS.bg }}>
        <Loader2 className="animate-spin" color={COLORS.turquoise} size={28} />
      </div>
    );
  }

  return (
    <CoachApp
      clients={clients} setClients={setClients}
      appointments={appointments} setAppointments={setAppointments}
      templates={templates} setTemplates={setTemplates}
      businessName={businessName} onChangeBusinessName={changeBusinessName}
      pricing={pricing} setPricing={setPricing}
      lastBackupAt={lastBackupAt} onRecordBackup={recordBackup}
      markApptStatus={markApptStatus}
    />
  );
}

/* ---------------- Main app ---------------- */

function CoachApp({ clients, setClients, appointments, setAppointments, templates, setTemplates, businessName, onChangeBusinessName, pricing, setPricing, lastBackupAt, onRecordBackup, markApptStatus }) {
  const [tab, setTab] = useState("oggi");
  const [clientModal, setClientModal] = useState(null);
  const [apptModal, setApptModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [detailClientId, setDetailClientId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const activeClients = useMemo(() => clients.filter((c) => !c.archived), [clients]);
  const sortedClients = useMemo(() => {
    const rank = { scaduto: 0, urgente: 1, attenzione: 2, ok: 3 };
    return [...activeClients].sort((a, b) => rank[statusOf(a).level] - rank[statusOf(b).level]);
  }, [activeClients]);

  const upcomingAppts = useMemo(() => [...appointments].filter((a) => a.date >= todayISO()).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)), [appointments]);
  const todayAppts = useMemo(() => [...appointments].filter((a) => a.date === todayISO()).sort((a, b) => a.time.localeCompare(b.time)), [appointments]);
  const alerts = useMemo(() => sortedClients.filter((c) => ["urgente", "scaduto"].includes(statusOf(c).level)), [sortedClients]);
  const unpaidClients = useMemo(() => activeClients.filter((c) => remainingDue(c) > 0), [activeClients]);
  const unpaidTotal = useMemo(() => unpaidClients.reduce((sum, c) => sum + remainingDue(c), 0), [unpaidClients]);
  const backupStale = !lastBackupAt || daysBetween(lastBackupAt.slice(0, 10), todayISO()) > 14;

  function saveClient(data) {
    if (data.id) setClients((prev) => prev.map((c) => (c.id === data.id ? { ...c, ...data } : c)));
    else setClients((prev) => [...prev, { ...data, id: uid(), trainings: [], nutritionPlans: [], weightLog: [], checkins: [] }]);
    setClientModal(null);
  }
  function deleteClient(id) {
    setClients((prev) => prev.filter((c) => c.id !== id));
    setAppointments((prev) => prev.filter((a) => a.clientId !== id));
    setConfirmDelete(null);
    if (detailClientId === id) setDetailClientId(null);
  }
  function archiveClient(id, archived) {
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, archived } : c)));
  }

  function saveAppt(data) {
    if (data.id) {
      setAppointments((prev) => prev.map((a) => (a.id === data.id ? { ...a, ...data } : a)));
      setApptModal(null);
      return;
    }
    if (data.repeatWeeks && data.repeatWeeks > 1) {
      const seriesId = uid();
      const newOnes = Array.from({ length: data.repeatWeeks }, (_, i) => ({
        ...data, id: uid(), date: addDays(data.date, i * 7), status: "previsto", lessonDeducted: false, seriesId,
      }));
      setAppointments((prev) => [...prev, ...newOnes.map((n) => { const { repeatWeeks, ...rest } = n; return rest; })]);
    } else {
      const { repeatWeeks, ...rest } = data;
      setAppointments((prev) => [...prev, { ...rest, id: uid(), status: "previsto", lessonDeducted: false }]);
    }
    setApptModal(null);
  }
  function deleteAppt(id) {
    setAppointments((prev) => prev.filter((a) => a.id !== id));
    setConfirmDelete(null);
  }

  function useLesson(clientId) {
    setClients((prev) => prev.map((c) => (c.id === clientId && c.type === "personal" ? { ...c, usedLessons: Math.min(c.usedLessons + 1, c.totalLessons) } : c)));
  }
  function updateClientData(clientId, patch) {
    setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, ...patch } : c)));
  }

  function saveTemplate(name, exercises) {
    setTemplates((prev) => [...prev, { id: uid(), name, exercises: exercises.map((e) => ({ ...e, id: uid() })) }]);
  }
  function deleteTemplate(id) {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  function exportBackup() {
    const payload = { exportedAt: new Date().toISOString(), clients, appointments, templates };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `gestionale-backup-${todayISO()}.json`; a.click();
    URL.revokeObjectURL(url);
    onRecordBackup();
  }
  function importBackup(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (Array.isArray(data.clients)) setClients(data.clients.map((cl) => migrateClient(cl, pricing)));
        if (Array.isArray(data.appointments)) setAppointments(data.appointments.map(migrateAppt));
        if (Array.isArray(data.templates)) setTemplates(data.templates);
      } catch (err) { alert("File non valido."); }
    };
    reader.readAsText(file);
  }

  const detailClient = detailClientId ? clients.find((c) => c.id === detailClientId) : null;

  if (detailClient) {
    return (
      <>
        <ClientDetail
          client={detailClient}
          onBack={() => setDetailClientId(null)}
          onEditSubscription={() => setClientModal(detailClient)}
          onUpdate={(patch) => updateClientData(detailClient.id, patch)}
          onUseLesson={() => useLesson(detailClient.id)}
          onArchive={(archived) => archiveClient(detailClient.id, archived)}
          onDelete={() => setConfirmDelete({ type: "client", id: detailClient.id })}
          templates={templates}
          onSaveTemplate={saveTemplate}
          onDeleteTemplate={deleteTemplate}
        />
        {clientModal && <ClientModal client={clientModal === "new" ? null : clientModal} pricing={pricing} onSave={saveClient} onClose={() => setClientModal(null)} />}
        {confirmDelete && <ConfirmModal onCancel={() => setConfirmDelete(null)} onConfirm={() => deleteClient(confirmDelete.id)} />}
      </>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, fontFamily: "'Inter', sans-serif", color: COLORS.ink }}>
      <style>{FONT_IMPORT}</style>
      <div style={{ borderBottom: `1px solid ${COLORS.line}`, background: COLORS.card, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "18px 20px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 26, margin: 0, letterSpacing: -0.5 }}>{businessName || "Gestionale"}</h1>
              <p style={{ color: COLORS.inkSoft, fontSize: 13, margin: "4px 0 16px" }}>{activeClients.length} clienti attivi</p>
            </div>
            <button onClick={() => setSettingsOpen(true)} title="Impostazioni" style={iconBtnStyle}><Settings size={16} /></button>
          </div>
          <div style={{ display: "flex", gap: 4, overflowX: "auto" }}>
            {[
              { id: "oggi", label: "Oggi", icon: Sun },
              { id: "dashboard", label: "Panoramica", icon: AlertTriangle },
              { id: "entrate", label: "Entrate", icon: Euro },
              { id: "clienti", label: "Clienti", icon: Users },
              { id: "calendario", label: "Calendario", icon: Calendar },
            ].map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", border: "none", background: "transparent",
                borderBottom: tab === t.id ? `2px solid ${COLORS.turquoise}` : "2px solid transparent",
                color: tab === t.id ? COLORS.turquoise : COLORS.inkSoft, fontWeight: 600, fontSize: 14, cursor: "pointer",
                fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap",
              }}>
                <t.icon size={15} />{t.label}
                {t.id === "oggi" && todayAppts.length > 0 && <span style={{ background: COLORS.turquoise, color: "#fff", borderRadius: 10, fontSize: 10.5, padding: "1px 6px", fontWeight: 700 }}>{todayAppts.length}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 20px 80px" }}>
        {backupStale && (
          <div style={{ background: COLORS.amberSoft, border: `1px solid ${COLORS.amber}44`, borderRadius: 10, padding: "12px 14px", fontSize: 12.5, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Download size={14} color={COLORS.amber} /> {lastBackupAt ? "Ultimo backup più di 14 giorni fa." : "Non hai ancora fatto un backup."} Fanne uno per sicurezza.
            </span>
            <button onClick={() => setSettingsOpen(true)} style={{ background: "none", border: "none", color: COLORS.turquoise, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>Vai alle impostazioni</button>
          </div>
        )}
        {tab === "oggi" && <OggiView appts={todayAppts} clients={activeClients} markApptStatus={markApptStatus} onOpenClient={(id) => setDetailClientId(id)} />}
        {tab === "dashboard" && <Dashboard clients={sortedClients} alerts={alerts} unpaidClients={unpaidClients} unpaidTotal={unpaidTotal} upcomingAppts={upcomingAppts} onOpenClient={(c) => setDetailClientId(c.id)} onUseLesson={useLesson} />}
        {tab === "entrate" && <EntrateView clients={activeClients} appointments={appointments} pricing={pricing} onOpenClient={(id) => setDetailClientId(id)} />}
        {tab === "clienti" && <ClientiView clients={clients} onNew={() => setClientModal("new")} onOpen={(c) => setDetailClientId(c.id)} onArchive={archiveClient} onUseLesson={useLesson} />}
        {tab === "calendario" && <CalendarioView appointments={upcomingAppts} clients={activeClients} onNew={() => setApptModal("new")} onEdit={(a) => setApptModal(a)} markApptStatus={markApptStatus} />}
      </div>

      {clientModal && <ClientModal client={clientModal === "new" ? null : clientModal} pricing={pricing} onSave={saveClient} onClose={() => setClientModal(null)} />}
      {apptModal && <ApptModal appt={apptModal === "new" ? null : apptModal} clients={clients} onSave={saveAppt} onClose={() => setApptModal(null)} />}
      {confirmDelete && <ConfirmModal onCancel={() => setConfirmDelete(null)} onConfirm={() => (confirmDelete.type === "client" ? deleteClient(confirmDelete.id) : deleteAppt(confirmDelete.id))} />}
      {settingsOpen && <SettingsModal businessName={businessName} onChangeBusinessName={onChangeBusinessName} pricing={pricing} setPricing={setPricing} lastBackupAt={lastBackupAt} onExport={exportBackup} onImport={importBackup} onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

const iconBtnStyle = {
  width: 34, height: 34, borderRadius: 8, border: `1px solid ${COLORS.line}`, background: "#fff",
  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: COLORS.inkSoft,
};

function SettingsModal({ businessName, onChangeBusinessName, pricing, setPricing, lastBackupAt, onExport, onImport, onClose }) {
  const [name, setName] = useState(businessName);
  const [savedName, setSavedName] = useState(false);
  const [prices, setPrices] = useState(pricing);
  const [savedPrices, setSavedPrices] = useState(false);
  const fileRef = useRef(null);

  function updatePrice(group, key, value) {
    setPrices((p) => ({ ...p, [group]: { ...p[group], [key]: value } }));
    setSavedPrices(false);
  }

  return (
    <ModalShell title="Impostazioni" onClose={onClose}>
      <Field label="Nome della tua attività">
        <input style={inputStyle} value={name} onChange={(e) => { setName(e.target.value); setSavedName(false); }} placeholder="Es. Nicolò PT" />
      </Field>
      <button onClick={() => { onChangeBusinessName(name || "Gestionale"); setSavedName(true); }} style={{ ...secondaryBtnStyle, marginBottom: 20 }}>{savedName ? "Salvato ✓" : "Salva nome"}</button>

      <div style={{ height: 1, background: COLORS.line, margin: "8px 0 20px" }} />

      <div style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.inkSoft, marginBottom: 10 }}>Prezzi dei servizi</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        {PERSONAL_PACKAGES.map((n) => (
          <div key={n}>
            <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginBottom: 4 }}>{n} lezioni</div>
            <input type="number" style={{ ...inputStyle, padding: "7px 8px", fontSize: 13 }} value={prices.personal[n] ?? ""} onChange={(e) => updatePrice("personal", n, Number(e.target.value))} />
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        {ONLINE_DURATIONS.map((d) => (
          <div key={d.id}>
            <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginBottom: 4 }}>{d.label}</div>
            <input type="number" style={{ ...inputStyle, padding: "7px 8px", fontSize: 13 }} value={prices.online[d.id] ?? ""} onChange={(e) => updatePrice("online", d.id, Number(e.target.value))} />
          </div>
        ))}
      </div>
      <button onClick={() => { setPricing(prices); setSavedPrices(true); }} style={{ ...secondaryBtnStyle, marginBottom: 20 }}>{savedPrices ? "Salvato ✓" : "Salva prezzi"}</button>
      <p style={{ fontSize: 11.5, color: COLORS.inkSoft, marginTop: -14, marginBottom: 20, lineHeight: 1.5 }}>Questi prezzi vengono suggeriti automaticamente quando crei un nuovo cliente, e usati per calcolare le entrate mensili.</p>

      <div style={{ height: 1, background: COLORS.line, margin: "0 0 20px" }} />

      <div style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.inkSoft, marginBottom: 4 }}>Backup dati</div>
      <p style={{ fontSize: 11.5, color: COLORS.inkSoft, marginTop: 0, marginBottom: 10 }}>{lastBackupAt ? `Ultimo backup: ${fmtDate(lastBackupAt.slice(0, 10))}` : "Non hai ancora fatto un backup."}</p>
      <button onClick={onExport} style={{ ...secondaryBtnStyle, marginBottom: 8 }}><Download size={14} /> Esporta tutti i dati (.json)</button>
      <button onClick={() => fileRef.current?.click()} style={secondaryBtnStyle}><Upload size={14} /> Importa da backup</button>
      <input ref={fileRef} type="file" accept=".json" style={{ display: "none" }} onChange={(e) => e.target.files[0] && onImport(e.target.files[0])} />
    </ModalShell>
  );
}

const secondaryBtnStyle = {
  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px",
  background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer", color: COLORS.ink,
};

function SectionHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
      <div>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 600, margin: 0 }}>{title}</h2>
        {subtitle && <p style={{ color: COLORS.inkSoft, fontSize: 13, margin: "4px 0 0" }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
function AddButton({ onClick, label }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", background: COLORS.turquoise, color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
      <Plus size={15} /> {label}
    </button>
  );
}
function EmptyState({ text, icon: Icon, color }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: "28px 20px", textAlign: "center", color: COLORS.inkSoft, fontSize: 14 }}>
      <Icon size={20} color={color} style={{ marginBottom: 8 }} /><div>{text}</div>
    </div>
  );
}

function ClientRow({ client, onClick, onUseLesson }) {
  const s = statusOf(client);
  const sc = statusColors[s.level];
  const pct = client.type === "online" ? Math.max(0, Math.min(1, s.days / 30)) : 1 - client.usedLessons / client.totalLessons;
  const ringLabel = client.type === "online" ? `${s.days}g` : `${client.totalLessons - client.usedLessons}`;
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }} onClick={onClick}>
      <Ring pct={Math.max(pct, 0.04)} size={48} stroke={5} color={sc.text} label={ringLabel} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{client.name}</div>
        <div style={{ fontSize: 12.5, color: COLORS.inkSoft, marginTop: 2 }}>
          {packageLabel(client)}{client.type === "online" ? ` · fino al ${fmtDate(client.endDate)}` : ` · ${client.totalLessons - client.usedLessons} rimanenti`}
        </div>
      </div>
      {remainingDue(client) > 0 && (
        <span title={`${remainingDue(client)}€ da saldare`} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: COLORS.amber, background: COLORS.amberSoft, borderRadius: 20, padding: "4px 8px" }}><Euro size={11} /></span>
      )}
      <span style={{ fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: 20, background: sc.bg, color: sc.text, whiteSpace: "nowrap" }}>{sc.label}</span>
      {client.type === "personal" && (
        <button onClick={(e) => { e.stopPropagation(); onUseLesson(client.id); }} title="Segna lezione svolta" style={{ border: `1px solid ${COLORS.line}`, background: "#fff", borderRadius: 7, padding: "6px 9px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", color: COLORS.turquoise }}>+ lezione</button>
      )}
    </div>
  );
}

function ContactButtons({ client, message, size = 13 }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {client.phone && (
        <a href={waLink(client.phone, message)} target="_blank" rel="noopener noreferrer" title="Scrivi su WhatsApp" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, background: "#E7F8F1", color: "#1EA766", textDecoration: "none" }}><MessageCircle size={size} /></a>
      )}
      {client.email && (
        <a href={mailLink(client.email, "Rinnovo abbonamento", message || "")} title="Scrivi una email" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, background: COLORS.turquoiseSoft, color: COLORS.turquoise, textDecoration: "none" }}><Mail size={size} /></a>
      )}
    </div>
  );
}

function ApptRow({ appt, client, markApptStatus, showStatusControls }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: "12px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, textAlign: "center", background: COLORS.turquoiseSoft, color: COLORS.turquoise, borderRadius: 8, padding: "6px 10px", minWidth: 54 }}>
          <div style={{ fontWeight: 700 }}>{fmtDateShort(appt.date)}</div><div>{appt.time}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 5 }}>
            {appt.title || "Lezione"} {appt.seriesId && <Repeat size={11} color={COLORS.inkSoft} />}
          </div>
          <div style={{ fontSize: 12.5, color: COLORS.inkSoft }}>{client ? client.name : "Cliente non specificato"}</div>
          {appt.lessonDeducted && <div style={{ fontSize: 11, color: COLORS.turquoise, fontWeight: 600, marginTop: 2 }}>✓ Lezione scalata dal pacchetto</div>}
        </div>
        {client && <ContactButtons client={client} />}
        <a href={googleCalendarLink(appt, client)} target="_blank" rel="noopener noreferrer" title="Aggiungi al tuo Google Calendar" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: COLORS.turquoise, textDecoration: "none", border: `1px solid ${COLORS.line}`, borderRadius: 7, padding: "6px 10px" }}>
          <ExternalLink size={12} />
        </a>
      </div>
      {showStatusControls && markApptStatus && (
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          {[{ id: "fatta", label: "Fatta" }, { id: "assente", label: "Assente" }, { id: "rimandato", label: "Rimandato" }].map((s) => (
            <button key={s.id} onClick={() => markApptStatus(appt.id, s.id)} style={{
              flex: 1, padding: "6px 4px", borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: "pointer",
              border: `1px solid ${appt.status === s.id ? COLORS.turquoise : COLORS.line}`,
              background: appt.status === s.id ? COLORS.turquoiseSoft : "#fff", color: appt.status === s.id ? COLORS.turquoise : COLORS.inkSoft,
            }}>{s.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function OggiView({ appts, clients, markApptStatus, onOpenClient }) {
  return (
    <div>
      <SectionHeader title="Oggi" subtitle={new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })} />
      {appts.length === 0 ? <EmptyState text="Nessun appuntamento oggi." icon={Sun} color={COLORS.inkSoft} /> : (
        <div style={{ display: "grid", gap: 10 }}>
          {appts.map((a) => {
            const client = clients.find((c) => c.id === a.clientId);
            return (
              <div key={a.id} onClick={() => client && onOpenClient(client.id)} style={{ cursor: client ? "pointer" : "default" }}>
                <ApptRow appt={a} client={client} markApptStatus={markApptStatus} showStatusControls />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Dashboard({ clients, alerts, unpaidClients, unpaidTotal, upcomingAppts, onOpenClient, onUseLesson }) {
  const personalCount = clients.filter((c) => c.type === "personal").length;
  const onlineCount = clients.filter((c) => c.type === "online").length;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 24 }}>
        <StatCard icon={Users} label="Clienti attivi" value={clients.length} />
        <StatCard icon={Dumbbell} label="Personal / Online" value={`${personalCount} / ${onlineCount}`} />
        <StatCard icon={Euro} label="Da incassare" value={unpaidTotal > 0 ? `${unpaidTotal}€` : "0€"} highlight={unpaidTotal > 0} />
      </div>

      {unpaidClients.length > 0 && (
        <div style={{ background: COLORS.amberSoft, border: `1px solid ${COLORS.amber}44`, borderRadius: 10, padding: "12px 14px", fontSize: 13, marginBottom: 20, color: COLORS.ink }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontWeight: 700 }}><Euro size={15} color={COLORS.amber} /> Pagamenti da saldare</div>
          {unpaidClients.map((c) => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "3px 0" }}>
              <span>{c.name}{Number(c.amountPaid) > 0 ? " (acconto versato)" : ""}</span><span style={{ fontWeight: 600 }}>{remainingDue(c)}€</span>
            </div>
          ))}
        </div>
      )}

      <SectionHeader title={`${alerts.length ? alerts.length : "Nessuna"} scadenza da seguire`} subtitle="Abbonamenti e pacchetti che richiedono attenzione" />
      {alerts.length === 0 ? <EmptyState text="Tutti i clienti sono in regola." icon={CheckCircle2} color={COLORS.turquoise} /> : (
        <div style={{ display: "grid", gap: 10, marginBottom: 32 }}>
          {alerts.map((c) => (
            <div key={c.id}>
              <ClientRow client={c} onClick={() => onOpenClient(c)} onUseLesson={onUseLesson} />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}><ContactButtons client={c} message={renewalMessage(c)} /></div>
            </div>
          ))}
        </div>
      )}
      <SectionHeader title="Prossimi appuntamenti" subtitle={`${upcomingAppts.length} in programma`} />
      {upcomingAppts.length === 0 ? <EmptyState text="Nessun appuntamento in calendario." icon={Calendar} color={COLORS.inkSoft} /> : (
        <div style={{ display: "grid", gap: 8 }}>
          {upcomingAppts.slice(0, 5).map((a) => { const client = clients.find((c) => c.id === a.clientId); return <ApptRow key={a.id} appt={a} client={client} />; })}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, highlight }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${highlight ? COLORS.amber : COLORS.line}`, borderRadius: 12, padding: "14px 12px" }}>
      <Icon size={15} color={highlight ? COLORS.amber : COLORS.turquoise} />
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 18, marginTop: 8, color: highlight ? COLORS.amber : COLORS.ink }}>{value}</div>
      <div style={{ fontSize: 11, color: COLORS.inkSoft, marginTop: 2 }}>{label}</div>
    </div>
  );
}

const monthNavStyle = {
  width: 34, height: 34, borderRadius: 8, border: `1px solid ${COLORS.line}`, background: "#fff",
  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: COLORS.ink, fontWeight: 700,
};

function EntrateView({ clients, appointments, pricing, onOpenClient }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + monthOffset);
  const year = base.getFullYear();
  const month = base.getMonth();
  const monthLabel = base.toLocaleDateString("it-IT", { month: "long", year: "numeric" });

  const inMonth = (iso) => {
    if (!iso) return false;
    const d = new Date(iso + "T00:00:00");
    return d.getFullYear() === year && d.getMonth() === month;
  };

  const onlineRows = clients
    .filter((c) => c.type === "online" && inMonth(c.startDate))
    .map((c) => ({ client: c, amount: Number(c.amountPaid) || 0 }));
  const onlineTotal = onlineRows.reduce((s, r) => s + r.amount, 0);

  const personalRows = clients
    .filter((c) => c.type === "personal")
    .map((c) => {
      const count = appointments.filter((a) => a.clientId === c.id && a.lessonDeducted && inMonth(a.date)).length;
      const perLesson = c.totalLessons ? (Number(c.priceTotal) || 0) / c.totalLessons : 0;
      return { client: c, count, amount: Math.round(count * perLesson * 100) / 100 };
    })
    .filter((r) => r.count > 0);
  const personalTotal = personalRows.reduce((s, r) => s + r.amount, 0);
  const total = Math.round((onlineTotal + personalTotal) * 100) / 100;

  return (
    <div>
      <SectionHeader title="Entrate" subtitle="Stima di quanto hai incassato/guadagnato nel mese" />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <button onClick={() => setMonthOffset((m) => m - 1)} style={monthNavStyle}>←</button>
        <div style={{ fontWeight: 700, fontSize: 15, textTransform: "capitalize" }}>{monthLabel}</div>
        <button onClick={() => setMonthOffset((m) => Math.min(m + 1, 0))} disabled={monthOffset >= 0} style={{ ...monthNavStyle, opacity: monthOffset >= 0 ? 0.35 : 1, cursor: monthOffset >= 0 ? "not-allowed" : "pointer" }}>→</button>
      </div>

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 20, textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 12.5, color: COLORS.inkSoft }}>Totale stimato</div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 32, color: COLORS.turquoise, marginTop: 4 }}>{total}€</div>
      </div>

      {onlineRows.length === 0 && personalRows.length === 0 ? (
        <EmptyState text="Nessuna entrata registrata per questo mese." icon={Euro} color={COLORS.inkSoft} />
      ) : (
        <>
          {onlineRows.length > 0 && (
            <>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.inkSoft, marginBottom: 8 }}>Coaching online — nuovi/rinnovi nel mese</div>
              <div style={{ display: "grid", gap: 6, marginBottom: 20 }}>
                {onlineRows.map((r) => (
                  <div key={r.client.id} onClick={() => onOpenClient(r.client.id)} style={{ display: "flex", justifyContent: "space-between", background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}>
                    <span>{r.client.name}</span><span style={{ fontWeight: 600 }}>{r.amount}€</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {personalRows.length > 0 && (
            <>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.inkSoft, marginBottom: 8 }}>Personal — lezioni svolte nel mese</div>
              <div style={{ display: "grid", gap: 6, marginBottom: 20 }}>
                {personalRows.map((r) => (
                  <div key={r.client.id} onClick={() => onOpenClient(r.client.id)} style={{ display: "flex", justifyContent: "space-between", background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}>
                    <span>{r.client.name} · {r.count} lezion{r.count === 1 ? "e" : "i"}</span><span style={{ fontWeight: 600 }}>{r.amount}€</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <div style={{ background: COLORS.turquoiseSoft, borderRadius: 10, padding: "12px 14px", fontSize: 12, color: COLORS.ink, lineHeight: 1.5, marginTop: 12 }}>
        <strong>Come viene calcolato:</strong> per il coaching online conta l'incasso segnato quando il cliente inizia o rinnova in quel mese. Per il personal conta il valore delle lezioni segnate come "Fatta" nel calendario in quel mese (prezzo pacchetto ÷ numero lezioni). Le lezioni segnate col tasto manuale "+ lezione", senza un appuntamento con data, non vengono conteggiate qui: per numeri precisi usa il calendario.
      </div>
    </div>
  );
}

function ClientiView({ clients, onNew, onOpen, onArchive, onUseLesson }) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("tutti");
  const [showArchived, setShowArchived] = useState(false);
  const rank = { scaduto: 0, urgente: 1, attenzione: 2, ok: 3 };
  const base = clients.filter((c) => !!c.archived === showArchived);
  const filtered = base.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase())).filter((c) => typeFilter === "tutti" || c.type === typeFilter).sort((a, b) => rank[statusOf(a).level] - rank[statusOf(b).level]);
  const archivedCount = clients.filter((c) => c.archived).length;

  return (
    <div>
      <SectionHeader title="Clienti" subtitle={`${clients.filter((c) => !c.archived).length} attivi`} action={<AddButton onClick={onNew} label="Nuovo cliente" />} />
      <div style={{ position: "relative", marginBottom: 10 }}>
        <Search size={15} color={COLORS.inkSoft} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
        <input style={{ ...inputStyle, paddingLeft: 34 }} placeholder="Cerca cliente per nome..." value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {[{ id: "tutti", label: "Tutti" }, { id: "personal", label: "Personal" }, { id: "online", label: "Online" }].map((f) => (
          <button key={f.id} onClick={() => setTypeFilter(f.id)} style={{ padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${typeFilter === f.id ? COLORS.turquoise : COLORS.line}`, background: typeFilter === f.id ? COLORS.turquoiseSoft : "#fff", color: typeFilter === f.id ? COLORS.turquoise : COLORS.ink }}>{f.label}</button>
        ))}
        <div style={{ flex: 1 }} />
        {archivedCount > 0 && <button onClick={() => setShowArchived((s) => !s)} style={{ background: "none", border: "none", color: COLORS.inkSoft, fontSize: 12, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>{showArchived ? "← Vedi attivi" : `Archiviati (${archivedCount})`}</button>}
      </div>
      {filtered.length === 0 ? <EmptyState text={showArchived ? "Nessun cliente archiviato." : clients.length === 0 ? "Nessun cliente ancora. Aggiungine uno per iniziare." : "Nessun cliente trovato."} icon={Users} color={COLORS.inkSoft} /> : (
        <div style={{ display: "grid", gap: 10 }}>
          {filtered.map((c) => (
            <div key={c.id} style={{ position: "relative", opacity: c.archived ? 0.6 : 1 }}>
              <ClientRow client={c} onClick={() => onOpen(c)} onUseLesson={onUseLesson} />
              <button onClick={(e) => { e.stopPropagation(); onArchive(c.id, !c.archived); }} title={c.archived ? "Riattiva" : "Archivia"} style={{ position: "absolute", top: -6, right: -6, background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 20, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: c.archived ? COLORS.turquoise : COLORS.inkSoft, fontSize: 11, fontWeight: 700 }}>{c.archived ? "↺" : "—"}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CalendarioView({ appointments, clients, onNew, onEdit, markApptStatus }) {
  return (
    <div>
      <SectionHeader title="Calendario" subtitle="Ricorda: il pulsante calendario aggiunge l'evento SOLO al tuo Google Calendar" action={<AddButton onClick={onNew} label="Nuovo appuntamento" />} />
      {appointments.length === 0 ? <EmptyState text="Nessun appuntamento in programma." icon={Calendar} color={COLORS.inkSoft} /> : (
        <div style={{ display: "grid", gap: 8 }}>
          {appointments.map((a) => {
            const client = clients.find((c) => c.id === a.clientId);
            return (
              <div key={a.id} style={{ position: "relative" }}>
                <ApptRow appt={a} client={client} markApptStatus={markApptStatus} showStatusControls={a.date <= todayISO()} />
                <button onClick={() => onEdit(a)} style={{ position: "absolute", top: 8, right: -6, background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 20, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: COLORS.inkSoft }}><Edit2 size={10} /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- Client detail ---------------- */

function ClientDetail({ client, onBack, onEditSubscription, onUpdate, onUseLesson, onArchive, onDelete, templates, onSaveTemplate, onDeleteTemplate }) {
  const [subTab, setSubTab] = useState("abbonamento");
  const s = statusOf(client);
  const sc = statusColors[s.level];

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, fontFamily: "'Inter', sans-serif", color: COLORS.ink }}>
      <style>{FONT_IMPORT}</style>
      <div style={{ borderBottom: `1px solid ${COLORS.line}`, background: COLORS.card, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "14px 20px 0" }}>
          <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: COLORS.inkSoft, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 10 }}><ChevronLeft size={15} /> Clienti</button>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 24, margin: 0 }}>{client.name}</h1>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: 20, background: sc.bg, color: sc.text }}>{sc.label}</span>
                <span style={{ fontSize: 12.5, color: COLORS.inkSoft }}>{packageLabel(client)}</span>
                {remainingDue(client) > 0 && <span style={{ fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: 20, background: COLORS.amberSoft, color: COLORS.amber, display: "flex", alignItems: "center", gap: 4 }}><Euro size={11} /> {remainingDue(client)}€ da saldare{Number(client.amountPaid) > 0 ? ` (acconto ${client.amountPaid}€ versato)` : ""}</span>}
              </div>
            </div>
            <button onClick={onEditSubscription} style={{ border: `1px solid ${COLORS.line}`, background: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", color: COLORS.turquoise, whiteSpace: "nowrap" }}>Modifica</button>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
            <ContactButtons client={client} message={s.level !== "ok" ? renewalMessage(client) : ""} />
            {s.level !== "ok" && <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: COLORS.red, fontWeight: 600 }}><Bell size={12} /> Promemoria rinnovo pronto</span>}
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 16, overflowX: "auto" }}>
            {[
              { id: "abbonamento", label: "Abbonamento", icon: CheckCircle2 },
              { id: "scheda", label: "Scheda", icon: FileText },
              { id: "allenamenti", label: "Allenamenti", icon: Dumbbell },
              { id: "alimentare", label: "Piano alimentare", icon: Utensils },
              { id: "checkin", label: "Check-in", icon: ClipboardList },
              { id: "risultati", label: "Risultati", icon: TrendingUp },
            ].map((t) => (
              <button key={t.id} onClick={() => setSubTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", border: "none", background: "transparent", borderBottom: subTab === t.id ? `2px solid ${COLORS.turquoise}` : "2px solid transparent", color: subTab === t.id ? COLORS.turquoise : COLORS.inkSoft, fontWeight: 600, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}><t.icon size={14} />{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px 20px 80px" }}>
        {subTab === "abbonamento" && <AbbonamentoTab client={client} onUseLesson={onUseLesson} />}
        {subTab === "scheda" && <SchedaTab client={client} onUpdate={onUpdate} />}
        {subTab === "allenamenti" && <AllenamentiTab client={client} onUpdate={onUpdate} templates={templates} onSaveTemplate={onSaveTemplate} onDeleteTemplate={onDeleteTemplate} />}
        {subTab === "alimentare" && <AlimentareTab client={client} onUpdate={onUpdate} />}
        {subTab === "checkin" && <CheckinTab client={client} onUpdate={onUpdate} />}
        {subTab === "risultati" && <RisultatiTab client={client} onUpdate={onUpdate} />}

        <div style={{ marginTop: 32, paddingTop: 20, borderTop: `1px solid ${COLORS.line}`, display: "flex", gap: 16, flexWrap: "wrap" }}>
          <button onClick={() => onArchive(!client.archived)} style={{ background: "none", border: "none", color: COLORS.inkSoft, fontSize: 12.5, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>{client.archived ? "Riattiva cliente" : "Archivia cliente (non elimina i dati)"}</button>
          <button onClick={onDelete} style={{ background: "none", border: "none", color: COLORS.red, fontSize: 12.5, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>Elimina definitivamente</button>
        </div>
      </div>
    </div>
  );
}

function AbbonamentoTab({ client, onUseLesson }) {
  const s = statusOf(client);
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 20, display: "flex", alignItems: "center", gap: 18 }}>
        <Ring pct={client.type === "online" ? Math.max(0, Math.min(1, s.days / 30)) : 1 - client.usedLessons / client.totalLessons} size={72} stroke={7} color={statusColors[s.level].text} label={client.type === "online" ? `${s.days}g` : `${client.totalLessons - client.usedLessons}`} />
        <div>
          {client.type === "online" ? (
            <><div style={{ fontWeight: 700, fontSize: 16 }}>{packageLabel(client)}</div><div style={{ fontSize: 13, color: COLORS.inkSoft, marginTop: 3 }}>Dal {fmtDate(client.startDate)} al {fmtDate(client.endDate)}</div></>
          ) : (
            <>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{packageLabel(client)}</div>
              <div style={{ fontSize: 13, color: COLORS.inkSoft, marginTop: 3 }}>{client.usedLessons} svolte · {client.totalLessons - client.usedLessons} rimanenti</div>
              <button onClick={onUseLesson} style={{ marginTop: 10, border: `1px solid ${COLORS.line}`, background: "#fff", borderRadius: 7, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", color: COLORS.turquoise }}>+ Segna lezione svolta</button>
            </>
          )}
        </div>
      </div>
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 12.5, color: COLORS.inkSoft, marginBottom: 4 }}>Contatti</div>
        <div style={{ fontSize: 14 }}>{client.phone || "—"}</div>
        <div style={{ fontSize: 14 }}>{client.email || "—"}</div>
        {client.notes && (<><div style={{ fontSize: 12.5, color: COLORS.inkSoft, marginTop: 14, marginBottom: 4 }}>Note</div><div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{client.notes}</div></>)}
      </div>
    </div>
  );
}

function AllenamentiTab({ client, onUpdate, templates, onSaveTemplate, onDeleteTemplate }) {
  const [editing, setEditing] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);

  function saveTraining(t) {
    const trainings = client.trainings || [];
    if (t.id && trainings.find((x) => x.id === t.id)) onUpdate({ trainings: trainings.map((x) => (x.id === t.id ? t : x)) });
    else onUpdate({ trainings: [{ ...t, id: uid() }, ...trainings] });
    setEditing(null);
  }
  function deleteTraining(id) { onUpdate({ trainings: (client.trainings || []).filter((x) => x.id !== id) }); }
  const sorted = [...(client.trainings || [])].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <SectionHeader title="Allenamenti" subtitle="Serie, ripetizioni e carico per ogni sessione" action={
        <div style={{ display: "flex", gap: 8 }}>
          {templates.length > 0 && <button onClick={() => setShowTemplates(true)} style={{ ...secondaryBtnStyle, width: "auto", padding: "9px 12px" }}><Bookmark size={14} /> Modelli</button>}
          <AddButton onClick={() => setEditing("new")} label="Nuovo allenamento" />
        </div>
      } />
      {sorted.length === 0 ? <EmptyState text="Nessun allenamento registrato." icon={Dumbbell} color={COLORS.inkSoft} /> : (
        <div style={{ display: "grid", gap: 10 }}>
          {sorted.map((t) => (
            <div key={t.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 13, color: COLORS.turquoise }}>{fmtDate(t.date)}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => onSaveTemplate(prompt("Nome del modello:", t.name || "Modello") || "Modello", t.exercises)} title="Salva come modello" style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.inkSoft }}><BookmarkPlus size={14} /></button>
                  <button onClick={() => setEditing(t)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.inkSoft }}><Edit2 size={14} /></button>
                  <button onClick={() => deleteTraining(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.red }}><Trash2 size={14} /></button>
                </div>
              </div>
              <div style={{ display: "grid", gap: 4 }}>
                {t.exercises.filter((e) => e.name.trim()).map((e) => (
                  <div key={e.id} style={{ display: "grid", gridTemplateColumns: "1.6fr 0.7fr 0.7fr 0.8fr", gap: 8, fontSize: 13, padding: "5px 0", borderBottom: `1px solid ${COLORS.line}` }}>
                    <span style={{ fontWeight: 600 }}>{e.name}</span><span style={{ color: COLORS.inkSoft }}>{e.sets || "—"} serie</span><span style={{ color: COLORS.inkSoft }}>{e.reps || "—"} rip</span><span style={{ color: COLORS.inkSoft }}>{e.load ? `${e.load} kg` : "—"}</span>
                  </div>
                ))}
              </div>
              {t.notes && <div style={{ marginTop: 10, fontSize: 13, color: COLORS.ink, background: COLORS.bg, borderRadius: 8, padding: "8px 10px", whiteSpace: "pre-wrap" }}>{t.notes}</div>}
            </div>
          ))}
        </div>
      )}
      {editing && <TrainingModal training={editing === "new" ? null : editing} onSave={saveTraining} onClose={() => setEditing(null)} />}
      {showTemplates && (
        <ModalShell title="Modelli di allenamento" onClose={() => setShowTemplates(false)}>
          {templates.length === 0 ? <EmptyState text="Nessun modello salvato ancora." icon={Bookmark} color={COLORS.inkSoft} /> : (
            <div style={{ display: "grid", gap: 8 }}>
              {templates.map((tpl) => (
                <div key={tpl.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: "10px 12px" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{tpl.name}</div>
                    <div style={{ fontSize: 11.5, color: COLORS.inkSoft }}>{tpl.exercises.filter((e) => e.name.trim()).length} esercizi</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => { setEditing({ date: todayISO(), exercises: tpl.exercises, notes: "" }); setShowTemplates(false); }} style={{ background: COLORS.turquoiseSoft, color: COLORS.turquoise, border: "none", borderRadius: 7, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Usa</button>
                    <button onClick={() => onDeleteTemplate(tpl.id)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.red }}><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ModalShell>
      )}
    </div>
  );
}

function TrainingModal({ training, onSave, onClose }) {
  const [date, setDate] = useState(training?.date || todayISO());
  const [exercises, setExercises] = useState(training?.exercises?.length ? training.exercises.map((e) => ({ ...e, id: e.id || uid() })) : emptyExercises());
  const [notes, setNotes] = useState(training?.notes || "");
  function updateEx(id, field, value) { setExercises((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))); }
  function addRow() { setExercises((prev) => [...prev, { id: uid(), name: "", sets: "", reps: "", load: "" }]); }

  return (
    <ModalShell title={training?.id ? "Modifica allenamento" : "Nuovo allenamento"} onClose={onClose}>
      <Field label="Data"><input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.inkSoft, marginBottom: 6 }}>Esercizi</div>
      <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 0.7fr 0.7fr 0.8fr", gap: 6, fontSize: 11, color: COLORS.inkSoft, fontWeight: 600 }}><span>Esercizio</span><span>Serie</span><span>Rip.</span><span>Carico</span></div>
        {exercises.map((e) => (
          <div key={e.id} style={{ display: "grid", gridTemplateColumns: "1.6fr 0.7fr 0.7fr 0.8fr", gap: 6 }}>
            <input style={{ ...inputStyle, padding: "7px 8px", fontSize: 13 }} value={e.name} onChange={(ev) => updateEx(e.id, "name", ev.target.value)} placeholder="Es. Squat" />
            <input style={{ ...inputStyle, padding: "7px 8px", fontSize: 13 }} value={e.sets} onChange={(ev) => updateEx(e.id, "sets", ev.target.value)} placeholder="4" />
            <input style={{ ...inputStyle, padding: "7px 8px", fontSize: 13 }} value={e.reps} onChange={(ev) => updateEx(e.id, "reps", ev.target.value)} placeholder="10" />
            <input style={{ ...inputStyle, padding: "7px 8px", fontSize: 13 }} value={e.load} onChange={(ev) => updateEx(e.id, "load", ev.target.value)} placeholder="kg" />
          </div>
        ))}
      </div>
      <button onClick={addRow} style={{ background: "none", border: "none", color: COLORS.turquoise, fontWeight: 600, fontSize: 12.5, cursor: "pointer", padding: 0, marginBottom: 14 }}>+ Aggiungi esercizio</button>
      <Field label="Note (problematiche, sensazioni, altro)"><textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <button onClick={() => onSave({ id: training?.id, date, exercises, notes })} style={saveBtnStyle}>Salva allenamento</button>
    </ModalShell>
  );
}

function SchedaTab({ client, onUpdate }) {
  const [editing, setEditing] = useState(null);
  function saveScheda(s) {
    const schede = client.schede || [];
    if (s.id && schede.find((x) => x.id === s.id)) onUpdate({ schede: schede.map((x) => (x.id === s.id ? s : x)) });
    else onUpdate({ schede: [{ ...s, id: uid() }, ...schede] });
    setEditing(null);
  }
  function deleteScheda(id) { onUpdate({ schede: (client.schede || []).filter((x) => x.id !== id) }); }
  const sorted = [...(client.schede || [])].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <SectionHeader title="Scheda allenamento" subtitle="Il documento del programma da seguire, sempre a portata di mano" action={<AddButton onClick={() => setEditing("new")} label="Nuova scheda" />} />
      <div style={{ background: COLORS.amberSoft, border: `1px solid ${COLORS.amber}33`, borderRadius: 10, padding: "12px 14px", fontSize: 12.5, marginBottom: 14, lineHeight: 1.5 }}>
        Carica il PDF o il documento su Google Drive (o Dropbox) con link condivisibile, e incollalo qui.
      </div>
      {sorted.length === 0 ? <EmptyState text="Nessuna scheda caricata ancora." icon={FileText} color={COLORS.inkSoft} /> : (
        <div style={{ display: "grid", gap: 10 }}>
          {sorted.map((s) => (
            <div key={s.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 13, color: COLORS.turquoise }}>{fmtDate(s.date)}</div>
                  {s.name && <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{s.name}</div>}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setEditing(s)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.inkSoft }}><Edit2 size={14} /></button>
                  <button onClick={() => deleteScheda(s.id)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.red }}><Trash2 size={14} /></button>
                </div>
              </div>
              {s.fileLink && (
                <a href={s.fileLink} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, color: COLORS.turquoise, fontWeight: 600, marginTop: 8, textDecoration: "none" }}>
                  <Link2 size={14} /> Apri la scheda
                </a>
              )}
              {s.notes && <div style={{ marginTop: 8, fontSize: 13, whiteSpace: "pre-wrap" }}>{s.notes}</div>}
            </div>
          ))}
        </div>
      )}
      {editing && <SchedaModal scheda={editing === "new" ? null : editing} onSave={saveScheda} onClose={() => setEditing(null)} />}
    </div>
  );
}

function SchedaModal({ scheda, onSave, onClose }) {
  const [date, setDate] = useState(scheda?.date || todayISO());
  const [name, setName] = useState(scheda?.name || "");
  const [fileLink, setFileLink] = useState(scheda?.fileLink || "");
  const [notes, setNotes] = useState(scheda?.notes || "");
  return (
    <ModalShell title={scheda ? "Modifica scheda" : "Nuova scheda allenamento"} onClose={onClose}>
      <Field label="Data"><input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Field label="Nome scheda (opzionale)"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Scheda forza 4 settimane" /></Field>
      <Field label="Link al file (Drive, Dropbox, PDF online)"><input style={inputStyle} value={fileLink} onChange={(e) => setFileLink(e.target.value)} placeholder="https://drive.google.com/..." /></Field>
      <Field label="Note"><textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <button onClick={() => onSave({ id: scheda?.id, date, name, fileLink, notes })} style={saveBtnStyle}>Salva scheda</button>
    </ModalShell>
  );
}

function AlimentareTab({ client, onUpdate }) {
  const [editing, setEditing] = useState(null);
  function savePlan(p) {
    const plans = client.nutritionPlans || [];
    if (p.id && plans.find((x) => x.id === p.id)) onUpdate({ nutritionPlans: plans.map((x) => (x.id === p.id ? p : x)) });
    else onUpdate({ nutritionPlans: [{ ...p, id: uid() }, ...plans] });
    setEditing(null);
  }
  function deletePlan(id) { onUpdate({ nutritionPlans: (client.nutritionPlans || []).filter((x) => x.id !== id) }); }
  const sorted = [...(client.nutritionPlans || [])].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <SectionHeader title="Piano alimentare" subtitle="Un link per ogni versione del piano" action={<AddButton onClick={() => setEditing("new")} label="Nuovo piano" />} />
      <div style={{ background: COLORS.amberSoft, border: `1px solid ${COLORS.amber}33`, borderRadius: 10, padding: "12px 14px", fontSize: 12.5, marginBottom: 14, lineHeight: 1.5 }}>Carica il piano su Google Drive (o Dropbox) con link condivisibile, e incollalo qui sotto.</div>
      {sorted.length === 0 ? <EmptyState text="Nessun piano alimentare caricato." icon={Utensils} color={COLORS.inkSoft} /> : (
        <div style={{ display: "grid", gap: 10 }}>
          {sorted.map((p) => (
            <div key={p.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 13, color: COLORS.turquoise }}>{fmtDate(p.date)}</div>
                <div style={{ display: "flex", gap: 6 }}><button onClick={() => setEditing(p)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.inkSoft }}><Edit2 size={14} /></button><button onClick={() => deletePlan(p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.red }}><Trash2 size={14} /></button></div>
              </div>
              {p.fileLink && <a href={p.fileLink} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, color: COLORS.turquoise, fontWeight: 600, marginTop: 8, textDecoration: "none" }}><Link2 size={14} /> Apri il piano</a>}
              {p.notes && <div style={{ marginTop: 8, fontSize: 13, whiteSpace: "pre-wrap" }}>{p.notes}</div>}
            </div>
          ))}
        </div>
      )}
      {editing && <NutritionModal plan={editing === "new" ? null : editing} onSave={savePlan} onClose={() => setEditing(null)} />}
    </div>
  );
}

function NutritionModal({ plan, onSave, onClose }) {
  const [date, setDate] = useState(plan?.date || todayISO());
  const [fileLink, setFileLink] = useState(plan?.fileLink || "");
  const [notes, setNotes] = useState(plan?.notes || "");
  return (
    <ModalShell title={plan ? "Modifica piano" : "Nuovo piano alimentare"} onClose={onClose}>
      <Field label="Data"><input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Field label="Link al file (Drive, Dropbox, PDF online)"><input style={inputStyle} value={fileLink} onChange={(e) => setFileLink(e.target.value)} placeholder="https://drive.google.com/..." /></Field>
      <Field label="Note"><textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <button onClick={() => onSave({ id: plan?.id, date, fileLink, notes })} style={saveBtnStyle}>Salva piano</button>
    </ModalShell>
  );
}

function CheckinTab({ client, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [aderenza, setAderenza] = useState("Buona");
  const [energia, setEnergia] = useState(3);
  const [notes, setNotes] = useState("");
  const sorted = [...(client.checkins || [])].sort((a, b) => b.date.localeCompare(a.date));
  function addCheckin() { onUpdate({ checkins: [{ id: uid(), date, aderenza, energia, notes }, ...(client.checkins || [])] }); setNotes(""); setEditing(false); }
  function deleteCheckin(id) { onUpdate({ checkins: (client.checkins || []).filter((c) => c.id !== id) }); }

  return (
    <div>
      <SectionHeader title="Check-in" subtitle="Aderenza al piano, energia e note periodiche" action={<AddButton onClick={() => setEditing(true)} label="Nuovo check-in" />} />
      {sorted.length === 0 ? <EmptyState text="Nessun check-in ancora." icon={ClipboardList} color={COLORS.inkSoft} /> : (
        <div style={{ display: "grid", gap: 10 }}>
          {sorted.map((c) => (
            <div key={c.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 13, color: COLORS.turquoise }}>{fmtDate(c.date)}</div>
                <button onClick={() => deleteCheckin(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.red }}><Trash2 size={14} /></button>
              </div>
              <div style={{ display: "flex", gap: 16, fontSize: 13 }}><span><strong>Aderenza:</strong> {c.aderenza}</span><span><strong>Energia:</strong> {c.energia}/5</span></div>
              {c.notes && <div style={{ marginTop: 8, fontSize: 13, whiteSpace: "pre-wrap" }}>{c.notes}</div>}
            </div>
          ))}
        </div>
      )}
      {editing && (
        <ModalShell title="Nuovo check-in" onClose={() => setEditing(false)}>
          <Field label="Data"><input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Aderenza al piano">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {ADERENZA_OPTS.map((o) => (<button key={o} onClick={() => setAderenza(o)} style={{ padding: "7px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: `1px solid ${aderenza === o ? COLORS.turquoise : COLORS.line}`, background: aderenza === o ? COLORS.turquoiseSoft : "#fff", color: aderenza === o ? COLORS.turquoise : COLORS.ink }}>{o}</button>))}
            </div>
          </Field>
          <Field label={`Energia percepita: ${energia}/5`}><input type="range" min={1} max={5} value={energia} onChange={(e) => setEnergia(Number(e.target.value))} style={{ width: "100%", accentColor: COLORS.turquoise }} /></Field>
          <Field label="Note"><textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <button onClick={addCheckin} style={saveBtnStyle}>Salva check-in</button>
        </ModalShell>
      )}
    </div>
  );
}

function RisultatiTab({ client, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [weight, setWeight] = useState("");
  const [date, setDate] = useState(todayISO());
  const [exerciseFilter, setExerciseFilter] = useState("");
  const log = [...(client.weightLog || [])].sort((a, b) => a.date.localeCompare(b.date));
  const chartData = log.map((w) => ({ date: fmtDateShort(w.date), peso: w.weight }));
  const exerciseNames = useMemo(() => { const names = new Set(); (client.trainings || []).forEach((t) => t.exercises.forEach((e) => e.name.trim() && names.add(e.name.trim()))); return Array.from(names); }, [client.trainings]);
  const activeExercise = exerciseFilter || exerciseNames[0] || "";
  const exerciseData = useMemo(() => {
    if (!activeExercise) return [];
    return [...(client.trainings || [])].filter((t) => t.exercises.some((e) => e.name.trim() === activeExercise && e.load)).sort((a, b) => a.date.localeCompare(b.date)).map((t) => { const ex = t.exercises.find((e) => e.name.trim() === activeExercise); return { date: fmtDateShort(t.date), carico: Number(ex.load) || 0 }; });
  }, [client.trainings, activeExercise]);
  function addEntry() { if (!weight) return; onUpdate({ weightLog: [...(client.weightLog || []), { id: uid(), date, weight: Number(weight) }] }); setWeight(""); setEditing(false); }
  function deleteEntry(id) { onUpdate({ weightLog: (client.weightLog || []).filter((w) => w.id !== id) }); }

  return (
    <div>
      <SectionHeader title="Risultati" subtitle="Andamento del peso nel tempo" action={<AddButton onClick={() => setEditing(true)} label="Aggiungi peso" />} />
      {log.length === 0 ? <EmptyState text="Nessun dato ancora." icon={TrendingUp} color={COLORS.inkSoft} /> : (
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: "16px 10px 6px", marginBottom: 16 }}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 5, right: 16, left: -10, bottom: 0 }}>
              <CartesianGrid stroke={COLORS.line} strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 11, fill: COLORS.inkSoft }} /><YAxis tick={{ fontSize: 11, fill: COLORS.inkSoft }} domain={["auto", "auto"]} /><Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${COLORS.line}` }} /><Line type="monotone" dataKey="peso" stroke={COLORS.turquoise} strokeWidth={2.5} dot={{ r: 3, fill: COLORS.turquoise }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {log.length > 0 && (
        <div style={{ display: "grid", gap: 6, marginBottom: 28 }}>
          {[...log].reverse().map((w) => (<div key={w.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: "8px 12px", fontSize: 13 }}><span style={{ color: COLORS.inkSoft }}>{fmtDate(w.date)}</span><span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>{w.weight} kg</span><button onClick={() => deleteEntry(w.id)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.red }}><Trash2 size={13} /></button></div>))}
        </div>
      )}
      {exerciseNames.length > 0 && (
        <>
          <SectionHeader title="Progressi per esercizio" subtitle="Andamento del carico nel tempo" />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {exerciseNames.map((n) => (<button key={n} onClick={() => setExerciseFilter(n)} style={{ padding: "6px 12px", borderRadius: 20, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: `1px solid ${activeExercise === n ? COLORS.turquoise : COLORS.line}`, background: activeExercise === n ? COLORS.turquoiseSoft : "#fff", color: activeExercise === n ? COLORS.turquoise : COLORS.ink }}>{n}</button>))}
          </div>
          {exerciseData.length === 0 ? <EmptyState text="Nessun carico registrato per questo esercizio." icon={TrendingUp} color={COLORS.inkSoft} /> : (
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: "16px 10px 6px" }}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={exerciseData} margin={{ top: 5, right: 16, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke={COLORS.line} strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 11, fill: COLORS.inkSoft }} /><YAxis tick={{ fontSize: 11, fill: COLORS.inkSoft }} domain={["auto", "auto"]} /><Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${COLORS.line}` }} /><Line type="monotone" dataKey="carico" stroke={COLORS.amber} strokeWidth={2.5} dot={{ r: 3, fill: COLORS.amber }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
      {editing && (
        <ModalShell title="Aggiungi peso" onClose={() => setEditing(false)}>
          <Field label="Data"><input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Peso (kg)"><input type="number" step="0.1" style={inputStyle} value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="72.5" /></Field>
          <button onClick={addEntry} style={saveBtnStyle}>Salva</button>
        </ModalShell>
      )}
    </div>
  );
}

/* ---------------- Shared form bits ---------------- */

function Field({ label, children }) {
  return (<div style={{ marginBottom: 14 }}><label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: COLORS.inkSoft, marginBottom: 5 }}>{label}</label>{children}</div>);
}
const inputStyle = { width: "100%", padding: "9px 11px", border: `1px solid ${COLORS.line}`, borderRadius: 8, fontSize: 14, fontFamily: "'Inter', sans-serif", boxSizing: "border-box", color: COLORS.ink, background: "#fff" };
const saveBtnStyle = { width: "100%", padding: "12px", background: COLORS.turquoise, color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, fontSize: 14.5, cursor: "pointer", marginTop: 6 };

function ModalShell({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(18,18,18,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }} onClick={onClose}>
      <div style={{ background: COLORS.bg, borderRadius: "18px", width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", padding: 20, boxSizing: "border-box" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}><h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 600, margin: 0 }}>{title}</h3><button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.inkSoft }}><X size={20} /></button></div>
        {children}
      </div>
    </div>
  );
}

function ClientModal({ client, pricing, onSave, onClose }) {
  const [form, setForm] = useState(client || { name: "", phone: "", email: "", type: "personal", totalLessons: 12, usedLessons: 0, duration: "trimestrale", startDate: todayISO(), endDate: addMonths(todayISO(), 3), notes: "", priceTotal: pricing.personal[12], amountPaid: pricing.personal[12] });
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function setType(type) {
    setForm((f) => {
      const suggested = suggestedPrice({ ...f, type }, pricing);
      return { ...f, type, priceTotal: suggested || f.priceTotal };
    });
  }
  function setPackage(n) {
    setForm((f) => {
      const suggested = pricing.personal[n];
      return { ...f, totalLessons: n, priceTotal: suggested ?? f.priceTotal };
    });
  }
  function setDuration(d) {
    const dur = ONLINE_DURATIONS.find((x) => x.id === d);
    setForm((f) => {
      const suggested = pricing.online[d];
      return { ...f, duration: d, endDate: addMonths(f.startDate, dur.months), priceTotal: suggested ?? f.priceTotal };
    });
  }
  function setStart(date) { const dur = ONLINE_DURATIONS.find((x) => x.id === form.duration); setForm((f) => ({ ...f, startDate: date, endDate: dur ? addMonths(date, dur.months) : f.endDate })); }

  const total = Number(form.priceTotal) || 0;
  const paid = Number(form.amountPaid) || 0;
  const remaining = Math.max(total - paid, 0);
  const paymentMode = total > 0 && paid >= total ? "saldato" : paid > 0 ? "acconto" : "da_pagare";

  function setPaymentMode(mode) {
    if (mode === "saldato") update("amountPaid", total || "");
    else if (mode === "da_pagare") update("amountPaid", 0);
    else if (mode === "acconto" && paid === 0) update("amountPaid", total ? Math.round(total / 2) : "");
  }

  return (
    <ModalShell title={client ? "Modifica cliente" : "Nuovo cliente"} onClose={onClose}>
      <Field label="Nome e cognome"><input style={inputStyle} value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Es. Maria Rossi" /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Telefono (per WhatsApp)"><input style={inputStyle} value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+39..." /></Field>
        <Field label="Email"><input style={inputStyle} value={form.email} onChange={(e) => update("email", e.target.value)} /></Field>
      </div>
      <Field label="Tipo di servizio">
        <div style={{ display: "flex", gap: 8 }}>
          {[{ id: "personal", label: "Personal (pacchetto)" }, { id: "online", label: "Coaching online" }].map((opt) => (<button key={opt.id} onClick={() => setType(opt.id)} style={{ flex: 1, padding: "9px 10px", borderRadius: 8, border: `1px solid ${form.type === opt.id ? COLORS.turquoise : COLORS.line}`, background: form.type === opt.id ? COLORS.turquoiseSoft : "#fff", color: form.type === opt.id ? COLORS.turquoise : COLORS.ink, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{opt.label}</button>))}
        </div>
      </Field>
      {form.type === "personal" ? (
        <>
          <Field label="Pacchetto"><div style={{ display: "flex", gap: 8 }}>{PERSONAL_PACKAGES.map((n) => (<button key={n} onClick={() => setPackage(n)} style={{ flex: 1, padding: "9px 6px", borderRadius: 8, border: `1px solid ${form.totalLessons === n ? COLORS.turquoise : COLORS.line}`, background: form.totalLessons === n ? COLORS.turquoiseSoft : "#fff", color: form.totalLessons === n ? COLORS.turquoise : COLORS.ink, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{n} lezioni · {pricing.personal[n] || "?"}€</button>))}</div></Field>
          <Field label="Lezioni già svolte"><input type="number" min={0} style={inputStyle} value={form.usedLessons} onChange={(e) => update("usedLessons", Number(e.target.value))} /></Field>
        </>
      ) : (
        <>
          <Field label="Durata abbonamento"><div style={{ display: "flex", gap: 8 }}>{ONLINE_DURATIONS.map((d) => (<button key={d.id} onClick={() => setDuration(d.id)} style={{ flex: 1, padding: "9px 6px", borderRadius: 8, border: `1px solid ${form.duration === d.id ? COLORS.turquoise : COLORS.line}`, background: form.duration === d.id ? COLORS.turquoiseSoft : "#fff", color: form.duration === d.id ? COLORS.turquoise : COLORS.ink, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>{d.label} · {pricing.online[d.id] || "?"}€</button>))}</div></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><Field label="Inizio"><input type="date" style={inputStyle} value={form.startDate} onChange={(e) => setStart(e.target.value)} /></Field><Field label="Scadenza (calcolata)"><input type="date" style={inputStyle} value={form.endDate} onChange={(e) => update("endDate", e.target.value)} /></Field></div>
        </>
      )}

      <Field label="Prezzo del servizio">
        <input type="number" style={inputStyle} value={form.priceTotal} onChange={(e) => update("priceTotal", e.target.value)} placeholder="Prezzo totale in €" />
      </Field>
      <Field label="Pagamento">
        <div style={{ display: "flex", gap: 8, marginBottom: paymentMode === "acconto" ? 10 : 0 }}>
          {[{ id: "saldato", label: "Saldato" }, { id: "acconto", label: "Acconto" }, { id: "da_pagare", label: "Da pagare" }].map((opt) => (
            <button key={opt.id} onClick={() => setPaymentMode(opt.id)} style={{ flex: 1, padding: "9px 6px", borderRadius: 8, border: `1px solid ${paymentMode === opt.id ? COLORS.turquoise : COLORS.line}`, background: paymentMode === opt.id ? COLORS.turquoiseSoft : "#fff", color: paymentMode === opt.id ? COLORS.turquoise : COLORS.ink, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>{opt.label}</button>
          ))}
        </div>
        {paymentMode === "acconto" && (
          <>
            <input type="number" style={inputStyle} value={form.amountPaid} onChange={(e) => update("amountPaid", e.target.value)} placeholder="Quanto ha già versato, in €" />
            <p style={{ fontSize: 12, color: COLORS.amber, marginTop: 6, fontWeight: 600 }}>Resta da incassare: {remaining}€ — comparirà tra i promemoria pagamenti.</p>
          </>
        )}
      </Field>
      <Field label="Note"><textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={form.notes} onChange={(e) => update("notes", e.target.value)} /></Field>
      <button onClick={() => form.name.trim() && onSave(form)} disabled={!form.name.trim()} style={{ ...saveBtnStyle, background: form.name.trim() ? COLORS.turquoise : COLORS.line, cursor: form.name.trim() ? "pointer" : "not-allowed" }}>Salva cliente</button>
    </ModalShell>
  );
}

function ApptModal({ appt, clients, onSave, onClose }) {
  const [form, setForm] = useState(appt || { clientId: clients[0]?.id || "", title: "", date: todayISO(), time: "09:00", duration: 60, notes: "", consumesLesson: true, status: "previsto", repeatWeeks: 1 });
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const selectedClient = clients.find((c) => c.id === form.clientId);

  return (
    <ModalShell title={appt ? "Modifica appuntamento" : "Nuovo appuntamento"} onClose={onClose}>
      <Field label="Cliente"><select style={inputStyle} value={form.clientId} onChange={(e) => update("clientId", e.target.value)}><option value="">— Nessuno —</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <Field label="Titolo (es. Lezione, Coaching online)"><input style={inputStyle} value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="Lezione individuale" /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <Field label="Data"><input type="date" style={inputStyle} value={form.date} onChange={(e) => update("date", e.target.value)} /></Field>
        <Field label="Ora"><input type="time" style={inputStyle} value={form.time} onChange={(e) => update("time", e.target.value)} /></Field>
        <Field label="Durata (min)"><input type="number" style={inputStyle} value={form.duration} onChange={(e) => update("duration", Number(e.target.value))} /></Field>
      </div>

      {!appt && (
        <Field label="Ripeti ogni settimana">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Repeat size={14} color={COLORS.inkSoft} />
            <input type="number" min={1} max={26} style={{ ...inputStyle, width: 80 }} value={form.repeatWeeks} onChange={(e) => update("repeatWeeks", Number(e.target.value))} />
            <span style={{ fontSize: 12.5, color: COLORS.inkSoft }}>settimane (1 = nessuna ripetizione)</span>
          </div>
        </Field>
      )}

      {selectedClient?.type === "personal" && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={form.consumesLesson !== false} onChange={(e) => update("consumesLesson", e.target.checked)} style={{ width: 16, height: 16, accentColor: COLORS.turquoise }} />
          Scala automaticamente una lezione dal pacchetto a fine sessione {form.repeatWeeks > 1 ? "(per ogni occorrenza)" : ""}
        </label>
      )}

      <Field label="Note"><textarea style={{ ...inputStyle, minHeight: 50, resize: "vertical" }} value={form.notes} onChange={(e) => update("notes", e.target.value)} /></Field>
      <button onClick={() => onSave(form)} style={saveBtnStyle}>Salva appuntamento{form.repeatWeeks > 1 && !appt ? ` (${form.repeatWeeks} occorrenze)` : ""}</button>
    </ModalShell>
  );
}

function ConfirmModal({ onCancel, onConfirm }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(18,18,18,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }} onClick={onCancel}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 20, width: 300, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
        <AlertTriangle color={COLORS.red} size={22} style={{ marginBottom: 8 }} />
        <p style={{ fontSize: 14, marginBottom: 16 }}>Confermi l'eliminazione? L'azione non può essere annullata.</p>
        <div style={{ display: "flex", gap: 8 }}><button onClick={onCancel} style={{ flex: 1, padding: "9px", borderRadius: 8, border: `1px solid ${COLORS.line}`, background: "#fff", cursor: "pointer" }}>Annulla</button><button onClick={onConfirm} style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none", background: COLORS.red, color: "#fff", fontWeight: 600, cursor: "pointer" }}>Elimina</button></div>
      </div>
    </div>
  );
}
