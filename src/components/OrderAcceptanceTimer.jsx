import { useEffect, useState } from "react";
import { formatAcceptanceCountdown, getOrderAcceptanceDeadline } from "../utils/orderAcceptanceTimer";

export default function OrderAcceptanceTimer({ order }) {
  const [now, setNow] = useState(Date.now());
  const deadline = getOrderAcceptanceDeadline(order);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!deadline) return null;

  const expired = deadline <= now;
  return (
    <div className={`mt-3 rounded-xl px-3 py-2 text-sm ${expired ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`}>
      <p className="font-semibold">
        {expired ? "Acceptance deadline passed" : `Accept within ${formatAcceptanceCountdown(deadline, now)}`}
      </p>
      <p className="mt-0.5 text-xs opacity-80">Deadline: {new Date(deadline).toLocaleString("en-IN")}</p>
    </div>
  );
}
