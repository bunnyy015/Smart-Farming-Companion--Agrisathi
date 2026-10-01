import { useState } from "react";
import { push, ref, set } from "firebase/database";
import { auth, database } from "../firebase";

export default function FarmerFeedback({ feature }) {
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(rating) {
    const user = auth.currentUser;
    if (!user || saving || sent) return;

    setSaving(true);
    setError("");
    try {
      const feedbackRef = push(ref(database, `farmerFeedback/${user.uid}`));
      await set(feedbackRef, {
        feature,
        rating,
        createdAt: Date.now(),
      });
      setSent(true);
    } catch (submitError) {
      console.error("Farmer feedback error:", submitError);
      setError("Feedback could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-green-100 bg-white p-4 text-center shadow-sm">
      {sent ? (
        <p role="status" className="font-semibold text-green-800">Thanks for your feedback!</p>
      ) : (
        <>
          <p className="font-semibold text-gray-800">Was this helpful?</p>
          <div className="mt-3 flex justify-center gap-3">
            <button type="button" disabled={saving} onClick={() => submit("helpful")} className="min-h-11 rounded-xl bg-green-50 px-4 font-semibold text-green-800 disabled:opacity-50">👍 Yes</button>
            <button type="button" disabled={saving} onClick={() => submit("not_helpful")} className="min-h-11 rounded-xl bg-gray-100 px-4 font-semibold text-gray-700 disabled:opacity-50">👎 Not yet</button>
          </div>
          {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
        </>
      )}
    </section>
  );
}
