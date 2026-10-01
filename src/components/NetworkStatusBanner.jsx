import { useEffect, useState } from "react";

export default function NetworkStatusBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const updateStatus = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);
    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      className="fixed top-0 inset-x-0 z-[100] bg-amber-100 border-b border-amber-300 px-4 py-2 text-center text-sm font-semibold text-amber-950 shadow"
    >
      You are offline. Saved pages and cached public data may still be available; live updates need a connection.
    </div>
  );
}
