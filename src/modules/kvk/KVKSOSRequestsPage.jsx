import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ref, get, update } from "firebase/database";
import { database } from "../../firebase";

export default function KVKSOSRequestsPage() {
  const navigate = useNavigate();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    try {
      const snapshot = await get(ref(database, "sosRequests"));

      if (!snapshot.exists()) {
        setRequests([]);
        return;
      }

      const data = snapshot.val();

      const list = Object.entries(data).map(([id, value]) => ({
        id,
        ...value,
      }));

      setRequests(list.reverse());
    } catch (error) {
      console.error(error);
      alert("Failed to load SOS requests.");
    } finally {
      setLoading(false);
    }
  }

  async function markResolved(id) {
    await update(ref(database, `sosRequests/${id}`), {
      status: "resolved",
      resolvedAt: new Date().toISOString(),
    });

    alert("SOS request marked as resolved.");
    loadRequests();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center">
        <h1 className="text-2xl font-bold text-green-700">
          Loading SOS Requests...
        </h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <button
            onClick={() => navigate("/kvk")}
            className="text-green-700 font-semibold mb-4"
          >
            ← Back to KVK Dashboard
          </button>

          <h1 className="text-4xl font-bold text-red-600">
            🚨 Farmer SOS Requests
          </h1>

          <p className="text-gray-600 mt-2">
            View emergency farmer requests and respond quickly.
          </p>
        </div>

        {requests.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <h2 className="text-2xl font-bold text-green-700">
              No SOS requests found
            </h2>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div
                key={request.id}
                className="bg-white rounded-2xl shadow-lg p-6"
              >
                <h2 className="text-2xl font-bold text-red-600">
                  {request.issueType || request.title || "Emergency Request"}
                </h2>

                <div className="mt-3 space-y-1 text-gray-700">
                  <p>
                    <b>Farmer:</b>{" "}
                    {request.farmerName || request.name || "Not available"}
                  </p>

                  <p>
                    <b>Phone:</b>{" "}
                    {request.phone || request.mobile || "Not available"}
                  </p>

                  <p>
                    <b>District:</b> {request.district || "Not available"}
                  </p>

                  <p>
                    <b>Village:</b> {request.village || "Not available"}
                  </p>

                  <p>
                    <b>Description:</b>{" "}
                    {request.description || request.message || "Not available"}
                  </p>

                  <p>
                    <b>Status:</b>{" "}
                    <span
                      className={
                        request.status === "resolved"
                          ? "text-green-700 font-semibold"
                          : "text-red-600 font-semibold"
                      }
                    >
                      {request.status || "pending"}
                    </span>
                  </p>

                  <p className="text-sm text-gray-500">
                    {request.createdAt
                      ? new Date(request.createdAt).toLocaleString()
                      : ""}
                  </p>
                </div>

                {request.status !== "resolved" && (
                  <button
                    onClick={() => markResolved(request.id)}
                    className="bg-green-700 text-white px-5 py-3 rounded-lg font-semibold mt-5"
                  >
                    Mark Resolved
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}