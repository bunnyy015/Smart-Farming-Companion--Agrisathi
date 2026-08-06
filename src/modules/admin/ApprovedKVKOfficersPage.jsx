import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ref, get } from "firebase/database";
import { database } from "../../firebase";

export default function ApprovedKVKOfficersPage() {
  const navigate = useNavigate();

  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOfficers();
  }, []);

  async function loadOfficers() {
    try {
      setLoading(true);

      const snapshot = await get(
        ref(database, "users")
      );

      if (!snapshot.exists()) {
        setOfficers([]);
        return;
      }

      const data = snapshot.val();

      const officerList = Object.entries(data)
        .filter(
          ([, user]) =>
            user &&
            user.role === "kvk" &&
            user.status === "approved"
        )
        .map(([uid, user]) => ({
          uid,
          ...user,
        }));

      setOfficers(officerList);
    } catch (error) {
      console.error(
        "Error loading approved KVK officers:",
        error
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-green-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="bg-gradient-to-r from-green-800 to-green-600 text-white rounded-2xl shadow-lg p-5 mb-6">
          <button
            type="button"
            onClick={() => navigate("/admin")}
            className="text-green-100 hover:text-white mb-3"
          >
            ← Back to Admin Dashboard
          </button>

          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold">
                🏛️ Approved KVK Officers
              </h1>

              <p className="text-green-100 mt-1">
                KVK officers approved by the administrator
              </p>
            </div>

            <div className="bg-white text-green-800 rounded-xl px-4 py-2 font-bold">
              {loading ? "—" : officers.length}
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
            <p className="text-gray-600">
              Loading approved KVK officers...
            </p>
          </div>
        ) : officers.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <div className="text-5xl">🏛️</div>

            <h2 className="text-xl font-bold text-gray-800 mt-4">
              No Approved KVK Officers
            </h2>

            <p className="text-gray-500 mt-2">
              No KVK officer accounts have been approved yet.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {officers.map((officer) => (
              <div
                key={officer.uid}
                className="bg-white rounded-2xl shadow-sm border border-green-100 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-green-800">
                      {officer.officerName ||
                        "KVK Officer"}
                    </h2>

                    <span className="inline-block mt-2 bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded-full">
                      Approved
                    </span>
                  </div>

                  <span className="text-3xl">
                    🏛️
                  </span>
                </div>

                <div className="border-t mt-4 pt-4 space-y-2 text-sm">
                  <p>
                    <strong>Designation:</strong>{" "}
                    {officer.designation ||
                      "Not available"}
                  </p>

                  <p>
                    <strong>Employee ID:</strong>{" "}
                    {officer.employeeId ||
                      "Not available"}
                  </p>

                  <p>
                    <strong>Email:</strong>{" "}
                    {officer.email ||
                      "Not available"}
                  </p>

                  <p>
                    <strong>Phone:</strong>{" "}
                    {officer.phone ||
                      "Not available"}
                  </p>

                  <p>
                    <strong>KVK Center:</strong>{" "}
                    {officer.kvkCenter ||
                      "Not available"}
                  </p>

                  <p>
                    <strong>District:</strong>{" "}
                    {officer.district ||
                      "Not available"}
                  </p>

                  <p>
                    <strong>State:</strong>{" "}
                    {officer.state ||
                      "Not available"}
                  </p>

                  <p>
                    <strong>Address:</strong>{" "}
                    {officer.address ||
                      "Not available"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}