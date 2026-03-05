"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TaskInput {
  id: string;
  title: string;
  completed: boolean;
}

interface ProjectForm {
  name: string;
  description: string;
  status: "active" | "inactive" | "archived" | "completed";
  active: boolean;
  dueDate: string;
  tasks: TaskInput[];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AddProjectPage() {
  const router = useRouter();

  const [form, setForm] = useState<ProjectForm>({
    name: "",
    description: "",
    status: "active",
    active: true,
    dueDate: "",
    tasks: [],
  });

  const [newTask, setNewTask] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Form helpers ───────────────────────────────────────────────────────────

  function setField<K extends keyof ProjectForm>(key: K, val: ProjectForm[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function addTask() {
    const title = newTask.trim();
    if (!title) return;
    setForm((f) => ({
      ...f,
      tasks: [...f.tasks, { id: crypto.randomUUID(), title, completed: false }],
    }));
    setNewTask("");
  }

  function removeTask(id: string) {
    setForm((f) => ({ ...f, tasks: f.tasks.filter((t) => t.id !== id) }));
  }

  function toggleTask(id: string) {
    setForm((f) => ({
      ...f,
      tasks: f.tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    }));
  }

  function handleTaskKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); addTask(); }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!form.name.trim()) { setError("Project name is required."); return; }
    setSubmitting(true); setError(null);
    try {
      await axios.post("/api/projects", {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        status: form.status,
        active: form.active,
        dueDate: form.dueDate || undefined,
        tasks: form.tasks.map(({ title, completed }) => ({ title, completed })),
      });
      router.push("/");
    } catch (e: unknown) {
      setError(axios.isAxiosError(e) ? (e.response?.data?.details ?? e.message) : String(e));
      setSubmitting(false);
    }
  }

  const completedCount = form.tasks.filter((t) => t.completed).length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* gradient wash */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-gradient-to-b from-indigo-50/80 to-transparent" />

      <div className="relative mx-auto max-w-2xl px-4 sm:px-6 py-12">

        {/* ── Back nav ── */}
        <button
          onClick={() => router.back()}
          className="mb-8 flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors group"
        >
          <svg className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Projects
        </button>

        {/* ── Page header ── */}
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-500 mb-2">New Project</p>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Create a Project</h1>
          <p className="mt-1.5 text-sm text-slate-500">Fill in the details below to get started.</p>
        </div>

        {/* ── Card ── */}
        <div className="rounded-3xl bg-white border border-slate-100 shadow-sm overflow-hidden">

          {/* top accent */}
          <div className="h-1 w-full bg-gradient-to-r from-indigo-500 to-violet-500" />

          <div className="px-6 sm:px-8 py-8 space-y-7">

            {error && (
              <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                <svg className="h-4 w-4 text-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* ─ Name ─ */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-400">
                Project Name <span className="text-red-400">*</span>
              </label>
              <input
                placeholder="e.g. Website Redesign"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                className="w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
              />
            </div>

            {/* ─ Description ─ */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-400">
                Description
              </label>
              <textarea
                rows={3}
                placeholder="What is this project about?"
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                className="w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition resize-none"
              />
            </div>

            {/* ─ Status + Due date ─ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setField("status", e.target.value as ProjectForm["status"])}
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
                >
                  {(["active", "inactive", "completed", "archived"] as const).map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400">Due Date</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setField("dueDate", e.target.value)}
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* ─ Active toggle ─ */}
            <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">Mark as Active</p>
                <p className="text-xs text-slate-400 mt-0.5">Active projects appear highlighted in your dashboard.</p>
              </div>
              <div
                onClick={() => setField("active", !form.active)}
                className={`relative w-12 h-6 rounded-full cursor-pointer transition-colors duration-200 ${form.active ? "bg-indigo-500" : "bg-slate-300"}`}
              >
                <span className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${form.active ? "translate-x-6" : ""}`} />
              </div>
            </div>

            {/* ─ Tasks ─ */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400">Tasks</label>
                {form.tasks.length > 0 && (
                  <span className="text-xs font-semibold text-slate-400">
                    {completedCount}/{form.tasks.length} done
                  </span>
                )}
              </div>

              {/* task list */}
              {form.tasks.length > 0 && (
                <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                  {form.tasks.map((task) => (
                    <div key={task.id} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 transition-colors group">
                      <button
                        onClick={() => toggleTask(task.id)}
                        className={`h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                          task.completed ? "border-indigo-500 bg-indigo-500" : "border-slate-300 hover:border-indigo-400"
                        }`}
                      >
                        {task.completed && (
                          <svg className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <span className={`flex-1 text-sm ${task.completed ? "line-through text-slate-400" : "text-slate-700"}`}>
                        {task.title}
                      </span>
                      <button
                        onClick={() => removeTask(task.id)}
                        className="text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* add task input */}
              <div className="flex gap-2">
                <input
                  placeholder="Add a task and press Enter…"
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={handleTaskKeyDown}
                  className="flex-1 rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
                />
                <button
                  onClick={addTask}
                  disabled={!newTask.trim()}
                  className="rounded-xl bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed border border-indigo-200 px-4 py-2.5 text-sm font-bold text-indigo-600 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* ── Footer actions ── */}
          <div className="flex gap-3 px-6 sm:px-8 py-5 bg-slate-50 border-t border-slate-100">
            <button
              onClick={() => router.back()}
              className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed py-3 text-sm font-bold text-white shadow-sm transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating…
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Project
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
