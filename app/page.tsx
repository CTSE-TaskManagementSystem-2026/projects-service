"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Task {
  _id?: string;
  title: string;
  completed: boolean;
}

interface Project {
  _id: string;
  name: string;
  description?: string;
  active: boolean;
  status: "active" | "inactive" | "archived" | "completed";
  dueDate?: string;
  tasks: Task[];
  tasksCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Summary {
  totalProjects: number;
  activeProjects: number;
  overdue: number;
  totalTasks: number;
}

type EditForm = Pick<Project, "name" | "description" | "status" | "active"> & {
  dueDate: string;
};

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<Project["status"], { bg: string; text: string; dot: string; ring: string }> = {
  active:    { bg: "bg-emerald-50",  text: "text-emerald-700", dot: "bg-emerald-500", ring: "ring-emerald-200" },
  completed: { bg: "bg-sky-50",      text: "text-sky-700",     dot: "bg-sky-500",     ring: "ring-sky-200"     },
  inactive:  { bg: "bg-slate-100",   text: "text-slate-600",   dot: "bg-slate-400",   ring: "ring-slate-200"   },
  archived:  { bg: "bg-amber-50",    text: "text-amber-700",   dot: "bg-amber-500",   ring: "ring-amber-200"   },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isOverdue(dueDate?: string) {
  if (!dueDate) return false;
  return Date.parse(dueDate) < Date.now();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, icon, accent,
}: {
  label: string; value: number; icon: React.ReactNode; accent: string;
}) {
  return (
    <div className="relative rounded-2xl bg-white border border-slate-100 shadow-sm px-6 py-5 overflow-hidden">
      <div className={`absolute right-4 top-4 h-10 w-10 rounded-xl ${accent} flex items-center justify-center`}>
        {icon}
      </div>
      <p className="text-3xl font-black text-slate-800 tracking-tight">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</p>
    </div>
  );
}

function Badge({ status }: { status: Project["status"] }) {
  const c = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${c.bg} ${c.text} ${c.ring}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function ProgressBar({ tasks }: { tasks: Task[] }) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.completed).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[11px] font-medium text-slate-400">
        <span>{done}/{total} tasks</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-100">
        <div
          className="h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditModal({
  project, onClose, onSaved,
}: {
  project: Project; onClose: () => void; onSaved: (p: Project) => void;
}) {
  const [form, setForm] = useState<EditForm>({
    name: project.name,
    description: project.description ?? "",
    status: project.status,
    active: project.active,
    dueDate: project.dueDate ? project.dueDate.slice(0, 10) : "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof EditForm>(key: K, val: EditForm[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("Name is required."); return; }
    setSaving(true); setError(null);
    try {
      const { data } = await axios.put<Project>(`/api/projects?id=${project._id}`, {
        ...form,
        dueDate: form.dueDate || undefined,
      });
      onSaved(data);
    } catch (e: unknown) {
      setError(axios.isAxiosError(e) ? e.response?.data?.details : String(e));
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">Edit Project</h2>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors text-xl leading-none">&times;</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && (
            <p className="rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5">{error}</p>
          )}
          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Name *</span>
            <input className="w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Description</span>
            <textarea rows={3} className="w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition resize-none" value={form.description} onChange={(e) => set("description", e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Status</span>
              <select className="w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition" value={form.status} onChange={(e) => set("status", e.target.value as Project["status"])}>
                {(["active", "inactive", "completed", "archived"] as const).map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Due Date</span>
              <input type="date" className="w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
            </label>
          </div>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div onClick={() => set("active", !form.active)} className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${form.active ? "bg-indigo-500" : "bg-slate-200"}`}>
              <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${form.active ? "translate-x-5" : ""}`} />
            </div>
            <span className="text-sm font-medium text-slate-600">Active project</span>
          </label>
        </div>
        <div className="flex gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors bg-white">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-2.5 text-sm font-bold text-white transition-colors shadow-sm">{saving ? "Saving…" : "Save Changes"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────

function DeleteModal({
  project, onClose, onDeleted,
}: {
  project: Project; onClose: () => void; onDeleted: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true); setError(null);
    try {
      await axios.delete(`/api/projects?id=${project._id}`);
      onDeleted(project._id);
    } catch (e: unknown) {
      setError(axios.isAxiosError(e) ? e.response?.data?.details : String(e));
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden">
        <div className="px-6 py-7 text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 border border-red-100">
            <svg className="h-6 w-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-slate-800">Delete "{project.name}"?</h3>
          <p className="text-sm text-slate-500">This action is permanent and cannot be undone.</p>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors bg-white">Cancel</button>
          <button onClick={handleDelete} disabled={deleting} className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50 py-2.5 text-sm font-bold text-white transition-colors">{deleting ? "Deleting…" : "Delete"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Project Card ─────────────────────────────────────────────────────────────

function ProjectCard({
  project, onEdit, onDelete,
}: {
  project: Project; onEdit: (p: Project) => void; onDelete: (p: Project) => void;
}) {
  const overdue = isOverdue(project.dueDate) && project.status !== "completed";

  return (
    <div className="group flex flex-col rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all duration-200 overflow-hidden">
      <div className={`h-1 w-full ${project.status === "active" ? "bg-gradient-to-r from-indigo-500 to-violet-500" : "bg-slate-100"}`} />
      <div className="flex flex-col flex-1 p-5 gap-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-800 truncate">{project.name}</h3>
            {project.description && (
              <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">{project.description}</p>
            )}
          </div>
          <Badge status={project.status} />
        </div>

        {project.tasks.length > 0 && <ProgressBar tasks={project.tasks} />}

        <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-slate-400">
          <span className="flex items-center gap-1">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {project.tasksCount} task{project.tasksCount !== 1 ? "s" : ""}
          </span>
          {project.dueDate && (
            <span className={`flex items-center gap-1 ${overdue ? "text-red-500 font-semibold" : ""}`}>
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {overdue ? "Overdue · " : ""}{formatDate(project.dueDate)}
            </span>
          )}
        </div>

        <div className="flex-1" />

        <div className="flex gap-2 pt-3 border-t border-slate-100">
          <button onClick={() => onEdit(project)} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
          <button onClick={() => onDelete(project)} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold text-slate-500 hover:text-red-500 hover:bg-red-50 transition-all">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [statusFilter, setStatusFilter] = useState<Project["status"] | "all">("all");
  const [search, setSearch] = useState("");

  const fetchProjects = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data } = await axios.get<{ projects: Project[]; summary: Summary }>("/api/projects");
      setProjects(data.projects);
      setSummary(data.summary);
    } catch (e: unknown) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error : "Failed to load projects.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  function handleSaved(updated: Project) {
    setProjects((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
    setEditTarget(null);
  }

  function handleDeleted(id: string) {
    setProjects((prev) => prev.filter((p) => p._id !== id));
    setSummary((s) => s ? { ...s, totalProjects: s.totalProjects - 1 } : s);
    setDeleteTarget(null);
  }

  const filtered = projects.filter((p) => {
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* soft gradient wash */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-80 bg-gradient-to-b from-indigo-50/80 to-transparent" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 space-y-10">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-500 mb-2">Dashboard</p>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">Projects</h1>
            <p className="mt-1 text-sm text-slate-500">Manage and track all your projects in one place.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchProjects}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white hover:border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-800 shadow-sm transition-all"
            >
              <svg className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            <button
              onClick={() => router.push("/pages/addproject")}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              New Project
            </button>
          </div>
        </div>

        {/* ── Stat Cards ── */}
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Projects" value={summary.totalProjects} accent="bg-indigo-100 text-indigo-600"
              icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
            />
            <StatCard label="Active" value={summary.activeProjects} accent="bg-emerald-100 text-emerald-600"
              icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />
            <StatCard label="Overdue" value={summary.overdue} accent="bg-red-100 text-red-500"
              icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />
            <StatCard label="Total Tasks" value={summary.totalTasks} accent="bg-violet-100 text-violet-600"
              icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>}
            />
          </div>
        )}

        {/* ── Filters ── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              placeholder="Search projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl bg-white border border-slate-200 pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(["all", "active", "inactive", "completed", "archived"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
                  statusFilter === s
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-white border border-slate-200 text-slate-500 hover:border-indigo-200 hover:text-indigo-600 shadow-sm"
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="rounded-2xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-600">{error}</div>
        )}

        {/* ── Skeletons ── */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-52 rounded-2xl bg-white border border-slate-100 shadow-sm animate-pulse" />
            ))}
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center">
              <svg className="h-7 w-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-600">No projects found</p>
              <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or create a new project.</p>
            </div>
            <button
              onClick={() => router.push("/pages/addproject")}
              className="mt-2 flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-sm font-bold text-white transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              New Project
            </button>
          </div>
        )}

        {/* ── Grid ── */}
        {!loading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((project) => (
              <ProjectCard
                key={project._id}
                project={project}
                onEdit={setEditTarget}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        )}
      </div>

      {editTarget && (
        <EditModal project={editTarget} onClose={() => setEditTarget(null)} onSaved={handleSaved} />
      )}
      {deleteTarget && (
        <DeleteModal project={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={handleDeleted} />
      )}
    </div>
  );
}
