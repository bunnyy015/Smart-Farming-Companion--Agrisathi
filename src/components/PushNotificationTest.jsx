import { useState } from "react";
import { ArrowRight, Bell } from "lucide-react";
import { registerForPushNotifications } from "../utils/pushNotifications";

export default function PushNotificationTest() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    setLoading(true);
    setMessage("Registering this device...");

    try {
      const result = await registerForPushNotifications();
      setMessage(result.success
        ? "Push notifications are enabled for this device."
        : result.message || "Push notification setup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-amber-100 bg-gradient-to-r from-amber-50/80 to-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"><Bell size={23} aria-hidden="true" /></span>
        <div className="min-w-0">
          <h3 className="font-semibold text-[var(--agri-text)]">Stay up to date</h3>
          <p className="mt-1 text-sm text-[var(--agri-muted)]">Enable push notifications to receive the latest updates, alerts and important information.</p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleRegister}
        disabled={loading}
        className="mt-0 inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--agri-green)] px-5 py-2.5 font-semibold text-white transition hover:bg-[var(--agri-forest)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Registering..." : "Enable Push Notifications"}
        {!loading && <ArrowRight size={16} aria-hidden="true" />}
      </button>

      {message && (
        <p className="mt-3 text-sm text-slate-700 sm:mt-0" role="status" aria-live="polite">
          {message}
        </p>
      )}
    </div>
  );
}
