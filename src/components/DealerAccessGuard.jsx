import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import { Navigate } from "react-router-dom";

import { auth, database } from "../firebase";

const SUSPENDED_STATUSES = new Set([
  "suspended",
  "deactivated",
  "blocked",
  "disabled",
]);

export default function DealerAccessGuard({ children }) {
  const [accessState, setAccessState] = useState("checking");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    setAccessState("checking");

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (active) setAccessState("denied");
        return;
      }

      try {
        const userSnapshot = await get(
          ref(database, `users/${user.uid}`)
        );
        const userData = userSnapshot.exists()
          ? userSnapshot.val()
          : null;
        const role = String(userData?.role || "")
          .trim()
          .toLowerCase();
        const status = String(userData?.status || "")
          .trim()
          .toLowerCase();

        if (role !== "dealer" || SUSPENDED_STATUSES.has(status)) {
          if (active) setAccessState("denied");
          return;
        }

        if (active) setAccessState("allowed");
      } catch (error) {
        console.error("Dealer access verification failed:", error);
        // Temporary database problems must never invalidate Firebase auth.
        if (active) setAccessState("unavailable");
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [retryKey]);

  if (accessState === "checking") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-green-50 p-6">
        <p className="text-green-900 font-medium">Checking dealer account…</p>
      </main>
    );
  }

  if (accessState === "unavailable") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-3 bg-green-50 p-6 text-center">
        <p className="text-green-900 font-medium">Dealer access could not be checked because the database is unavailable. Your login is still active.</p>
        <button type="button" onClick={() => setRetryKey((key) => key + 1)} className="rounded-lg bg-green-700 px-4 py-2 font-semibold text-white hover:bg-green-800">
          Retry
        </button>
      </main>
    );
  }

  if (accessState !== "allowed") {
    return <Navigate to="/login" replace />;
  }

  return children;
}
