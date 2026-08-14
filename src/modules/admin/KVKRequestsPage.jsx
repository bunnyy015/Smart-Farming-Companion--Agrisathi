import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ref, get, remove, set } from "firebase/database";
import { database } from "../../firebase";

export default function KVKRequestsPage() {
  const navigate = useNavigate();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    try {
      setLoading(true);

      const snapshot = await get(
        ref(database, "kvkRequests")
      );

      if (!snapshot.exists()) {
        setRequests([]);
        return;
      }

      const data = snapshot.val();

      const requestList = Object.entries(data).map(
        ([id, request]) => ({
          id,
          ...request,
        })
      );

      setRequests(requestList);
    } catch (error) {
      console.error(
        "Error loading KVK requests:",
        error
      );

      alert("Failed to load KVK requests.");
    } finally {
      setLoading(false);
    }
  }

  async function approveRequest(request) {
    try {
      setProcessingId(request.id);

      await set(
        ref(database, `users/${request.id}`),
        {
          ...request,
          role: "kvk",
          status: "approved",
          approvedAt: new Date().toISOString(),
        }
      );

      await remove(
        ref(database, `kvkRequests/${request.id}`)
      );

      alert("KVK Officer Approved Successfully");

      await loadRequests();
    } catch (error) {
      console.error(
        "Error approving KVK request:",
        error
      );

      alert("Failed to approve KVK officer.");
    } finally {
      setProcessingId(null);
    }
  }

  async function rejectRequest(id) {
    try {
      setProcessingId(id);

      await remove(
        ref(database, `kvkRequests/${id}`)
      );

      alert("KVK Request Rejected");

      await loadRequests();
    } catch (error) {
      console.error(
        "Error rejecting KVK request:",
        error
      );

      alert("Failed to reject KVK request.");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-green-50 p-6">
      <div className="max-w-6xl mx-auto">

        {/* Back Button */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-6 inline-flex items-center gap-2 bg-white text-green-700 px-4 py-2 rounded-lg shadow-sm border border-green-200 hover:bg-green-50 transition font-medium"
        >
          ← Back
        </button>

        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-green-700">
            🏛️ KVK Officer Requests
          </h1>

          <p className="text-gray-600 mt-2">
            Review and manage KVK officer registration
            requests.
          </p>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="bg-white p-8 rounded-2xl shadow text-center">
            <div className="w-8 h-8 mx-auto rounded-full border-4 border-green-200 border-t-green-700 animate-spin" />

            <p className="text-gray-600 mt-4">
              Loading KVK requests...
            </p>
          </div>
        ) : requests.length === 0 ? (
          /* No Requests */
          <div className="bg-white p-8 rounded-2xl shadow text-center">
            <div className="text-5xl mb-4">
              📭
            </div>

            <h2 className="text-xl font-bold text-gray-800">
              No Pending KVK Requests
            </h2>

            <p className="text-gray-500 mt-2">
              There are currently no KVK officer
              registration requests waiting for approval.
            </p>
          </div>
        ) : (
          /* Requests */
          <div className="space-y-5">
            {requests.map((request) => {
              const isProcessing =
                processingId === request.id;

              return (
                <div
                  key={request.id}
                  className="bg-white p-6 rounded-2xl shadow border border-green-100"
                >
                  {/* Request Header */}
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
                    <div>
                      <h2 className="text-2xl font-bold text-green-800">
                        {request.name ||
                          request.officerName ||
                          "KVK Officer"}
                      </h2>

                      <p className="text-gray-500 mt-1">
                        KVK officer registration request
                      </p>
                    </div>

                    <span className="inline-flex w-fit bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-semibold">
                      Pending Approval
                    </span>
                  </div>

                  {/* Officer Information */}
                  <div className="grid md:grid-cols-2 gap-4">

                    <div className="bg-gray-50 p-4 rounded-xl">
                      <p className="text-sm text-gray-500">
                        Officer Name
                      </p>

                      <p className="font-semibold mt-1">
                        {request.name ||
                          request.officerName ||
                          "Not available"}
                      </p>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl">
                      <p className="text-sm text-gray-500">
                        Email
                      </p>

                      <p className="font-semibold mt-1 break-all">
                        {request.email ||
                          "Not available"}
                      </p>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl">
                      <p className="text-sm text-gray-500">
                        Phone
                      </p>

                      <p className="font-semibold mt-1">
                        {request.phone ||
                          "Not available"}
                      </p>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl">
                      <p className="text-sm text-gray-500">
                        KVK Name
                      </p>

                      <p className="font-semibold mt-1">
                        {request.kvkName ||
                          request.instituteName ||
                          "Not available"}
                      </p>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl">
                      <p className="text-sm text-gray-500">
                        District
                      </p>

                      <p className="font-semibold mt-1">
                        {request.district ||
                          "Not available"}
                      </p>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl">
                      <p className="text-sm text-gray-500">
                        State
                      </p>

                      <p className="font-semibold mt-1">
                        {request.state ||
                          "Not available"}
                      </p>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl md:col-span-2">
                      <p className="text-sm text-gray-500">
                        Designation
                      </p>

                      <p className="font-semibold mt-1">
                        {request.designation ||
                          request.position ||
                          "Not available"}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-3 mt-6 pt-5 border-t border-gray-100">

                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() =>
                        approveRequest(request)
                      }
                      className="flex-1 bg-green-700 text-white px-5 py-3 rounded-xl font-semibold hover:bg-green-800 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {isProcessing
                        ? "Processing..."
                        : "✓ Approve KVK Officer"}
                    </button>

                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() =>
                        rejectRequest(request.id)
                      }
                      className="flex-1 bg-red-600 text-white px-5 py-3 rounded-xl font-semibold hover:bg-red-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {isProcessing
                        ? "Processing..."
                        : "✕ Reject Request"}
                    </button>

                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}