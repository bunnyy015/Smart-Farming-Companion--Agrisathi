import { useEffect, useState } from "react";
import { ref, get, remove, set } from "firebase/database";
import { database } from "../../firebase";

export default function KVKRequestsPage() {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    const snapshot = await get(ref(database, "kvkRequests"));

    if (!snapshot.exists()) {
      setRequests([]);
      return;
    }

    const data = snapshot.val();

    const requestList = Object.entries(data).map(([id, request]) => ({
      id,
      ...request,
    }));

    setRequests(requestList.reverse());
  }

  async function approveRequest(request) {
    await set(ref(database, `users/${request.id}`), {
      uid: request.id,
      officerName: request.officerName,
      email: request.email,
      phone: request.phone,
      employeeId: request.employeeId,
      designation: request.designation,
      kvkCenter: request.kvkCenter,
      district: request.district,
      state: request.state,
      address: request.address,
      role: "kvk",
      status: "approved",
      approvedAt: new Date().toISOString(),
      createdAt: request.createdAt || new Date().toISOString(),
    });

    await remove(ref(database, `kvkRequests/${request.id}`));

    alert("KVK Officer Approved");
    loadRequests();
  }

  async function rejectRequest(id) {
    await remove(ref(database, `kvkRequests/${id}`));

    alert("Request Rejected");
    loadRequests();
  }

  return (
    <div className="min-h-screen bg-green-50 p-6">
      <h1 className="text-4xl font-bold text-green-700 mb-6">
        🏛️ KVK Officer Requests
      </h1>

      {requests.length === 0 ? (
        <div className="bg-white p-5 rounded-xl shadow">
          No Pending Requests
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <div key={request.id} className="bg-white p-5 rounded-2xl shadow">
              <h2 className="text-xl font-bold text-green-700">
                {request.officerName}
              </h2>

              <p>Designation: {request.designation}</p>
              <p>KVK Center: {request.kvkCenter}</p>
              <p>Employee ID: {request.employeeId}</p>
              <p>Email: {request.email}</p>
              <p>Phone: {request.phone}</p>
              <p>District: {request.district}</p>
              <p>State: {request.state}</p>
              <p>Address: {request.address || "Not provided"}</p>

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => approveRequest(request)}
                  className="bg-green-700 text-white px-4 py-2 rounded-lg"
                >
                  Approve
                </button>

                <button
                  onClick={() => rejectRequest(request.id)}
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