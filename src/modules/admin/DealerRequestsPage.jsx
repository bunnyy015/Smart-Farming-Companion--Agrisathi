import { useEffect, useState } from "react";
import { ref, get, remove, set } from "firebase/database";
import { database } from "../../firebase";

export default function DealerRequestsPage() {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    try {
      const snapshot = await get(
        ref(database, "dealerRequests")
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
      console.error(error);
    }
  }

  async function approveRequest(request) {
    try {
      await set(
        ref(database, `users/${request.id}`),
        {
          ...request,
          role: "dealer",
          status: "approved",
          approvedAt: new Date().toISOString(),
        }
      );

      await remove(
        ref(database, `dealerRequests/${request.id}`)
      );

      alert("Dealer Approved Successfully");

      loadRequests();
    } catch (error) {
      console.error(error);
      alert("Failed to approve dealer");
    }
  }

  async function rejectRequest(id) {
    try {
      await remove(
        ref(database, `dealerRequests/${id}`)
      );

      alert("Dealer Request Rejected");

      loadRequests();
    } catch (error) {
      console.error(error);
      alert("Failed to reject dealer");
    }
  }

  return (
    <div className="min-h-screen bg-green-50 p-6">

      <h1 className="text-4xl font-bold text-green-700 mb-6">
        🏪 Dealer Requests
      </h1>

      {requests.length === 0 ? (
        <div className="bg-white p-5 rounded-xl shadow">
          No Pending Dealer Requests
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="bg-white p-5 rounded-2xl shadow"
            >
              <h2 className="text-xl font-bold">
                {request.shopName}
              </h2>

              <p>
                <strong>Dealer:</strong>{" "}
                {request.dealerName}
              </p>

              <p>
                <strong>Owner:</strong>{" "}
                {request.ownerName}
              </p>

              <p>
                <strong>Email:</strong>{" "}
                {request.email}
              </p>

              <p>
                <strong>Phone:</strong>{" "}
                {request.phone}
              </p>

              <p>
                <strong>District:</strong>{" "}
                {request.district}
              </p>

              <p>
                <strong>State:</strong>{" "}
                {request.state}
              </p>

              <p>
                <strong>License:</strong>{" "}
                {request.licenseNumber}
              </p>

              <div className="flex gap-3 mt-4">

                <button
                  onClick={() =>
                    approveRequest(request)
                  }
                  className="bg-green-700 text-white px-4 py-2 rounded-lg"
                >
                  Approve
                </button>

                <button
                  onClick={() =>
                    rejectRequest(request.id)
                  }
                  className="bg-red-600 text-white px-4 py-2 rounded-lg"
                >
                  Reject
                </button>

              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}