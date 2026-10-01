import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { get, onValue, push, ref, remove, set } from "firebase/database";
import { auth, database } from "../../firebase";

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN", { dateStyle: "medium" });
}

export default function CropCareCalendarPage() {
  const navigate = useNavigate();
  const [uid, setUid] = useState("");
  const [reminders, setReminders] = useState([]);
  const [crop, setCrop] = useState("");
  const [task, setTask] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => onAuthStateChanged(auth, async (user) => {
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    try {
      const profile = await get(ref(database, `users/${user.uid}`));
      if (!profile.exists() || profile.val().role !== "farmer") {
        navigate("/role-selection", { replace: true });
        return;
      }
      setUid(user.uid);
    } catch (loadError) {
      console.error("Crop-care calendar access error:", loadError);
      setError("Your calendar could not be loaded.");
    }
  }), [navigate]);

  useEffect(() => {
    if (!uid) return undefined;
    return onValue(ref(database, `farmers/${uid}/cropCareReminders`), (snapshot) => {
      const next = snapshot.exists()
        ? Object.entries(snapshot.val()).map(([id, item]) => ({ id, ...item }))
        : [];
      next.sort((a, b) => String(a.date).localeCompare(String(b.date)));
      setReminders(next);
    }, (loadError) => {
      console.error("Crop-care reminders error:", loadError);
      setError("Reminders are unavailable. Check your connection and try again.");
    });
  }, [uid]);

  async function addReminder(event) {
    event.preventDefault();
    if (!uid || !crop.trim() || !task.trim() || !date) return;
    setSaving(true);
    setError("");
    try {
      const item = push(ref(database, `farmers/${uid}/cropCareReminders`));
      await set(item, { crop: crop.trim(), task: task.trim(), date, createdAt: Date.now() });
      setTask("");
      setDate("");
    } catch (saveError) {
      console.error("Crop-care reminder save error:", saveError);
      setError("Reminder could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteReminder(id) {
    try {
      await remove(ref(database, `farmers/${uid}/cropCareReminders/${id}`));
    } catch (deleteError) {
      console.error("Crop-care reminder delete error:", deleteError);
      setError("Reminder could not be removed.");
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="min-h-screen bg-green-50 p-4 pb-10">
      <div className="mx-auto max-w-2xl">
        <header className="rounded-3xl bg-gradient-to-br from-green-800 to-green-600 p-5 text-white shadow-lg">
          <button type="button" onClick={() => navigate("/dashboard")} className="font-semibold text-green-100">← Dashboard</button>
          <p className="mt-4 text-sm text-green-100">Plan important farm work</p>
          <h1 className="mt-1 text-3xl font-bold">🌱 Crop-care calendar</h1>
          <p className="mt-2 text-sm text-green-100">Add your own irrigation, fertilizer, inspection, and harvest reminders.</p>
        </header>

        <form onSubmit={addReminder} className="mt-5 space-y-3 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-green-900">Add a reminder</h2>
          <label className="block text-sm font-semibold text-gray-700">Crop name
            <input required value={crop} onChange={(event) => setCrop(event.target.value)} placeholder="e.g. Paddy" className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3" />
          </label>
          <label className="block text-sm font-semibold text-gray-700">Farm task
            <input required value={task} onChange={(event) => setTask(event.target.value)} placeholder="e.g. Check soil moisture" className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3" />
          </label>
          <label className="block text-sm font-semibold text-gray-700">Date
            <input required type="date" min={today} value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3" />
          </label>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button disabled={saving || !uid} className="min-h-12 w-full rounded-xl bg-green-700 px-4 font-bold text-white disabled:opacity-50">{saving ? "Saving..." : "Save reminder"}</button>
        </form>

        <section className="mt-5 space-y-3">
          <h2 className="px-1 text-lg font-bold text-green-900">Your reminders</h2>
          {reminders.length === 0 ? (
            <div className="rounded-2xl bg-white p-7 text-center text-gray-600">No reminders yet. Add farm tasks above.</div>
          ) : reminders.map((item) => (
            <article key={item.id} className="flex items-center gap-3 rounded-2xl border border-green-100 bg-white p-4 shadow-sm">
              <span className="text-2xl">{item.date === today ? "📌" : "🗓️"}</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-gray-900">{item.task}</p>
                <p className="text-sm text-gray-600">{item.crop} · {formatDate(item.date)}</p>
              </div>
              <button type="button" onClick={() => deleteReminder(item.id)} aria-label={`Delete ${item.task} reminder`} className="min-h-10 rounded-lg px-3 font-semibold text-red-700 hover:bg-red-50">Delete</button>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
