import { useEffect, useState } from "react";
import { get, ref, update } from "firebase/database";
import { database } from "../../firebase";

export default function SOSRequestsPage() {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    const snapshot = await get(
      ref(database, "sosRequests")
    );

    if (!snapshot.exists()) return;

    const data = snapshot.val();

    const list = Object.entries(data).map(
      ([id, value]) => ({
        id,
        ...value,
      })
    );

    setRequests(list.reverse());
  }

  async function markResolved(id) {
    await update(
      ref(database, `sosRequests/${id}`),
      {
        status: "resolved",
      }
    );

    loadRequests();
  }

  return (
    <div className="min-h-screen bg-red-50 p-6">

      <h1 className="text-4xl font-bold text-red-700 mb-6">
        🚨 SOS Requests
      </h1>

      <div className="space-y-4">

        {requests.map((item) => (
          <div
            key={item.id}
            className="bg-white p-5 rounded-2xl shadow"
          >
            <p>
              <b>Farmer UID:</b> {item.farmerId}
            </p>

            <p>
              <b>Time:</b> {item.timestamp}
            </p>

            <p>
              <b>Status:</b> {item.status}
            </p>

            {item.status === "pending" && (
              <button
                onClick={() =>
                  markResolved(item.id)
                }
                className="mt-3 bg-green-600 text-white px-4 py-2 rounded-lg"
              >
                Mark Resolved
              </button>
            )}
          </div>
        ))}

      </div>
    </div>
  );
}