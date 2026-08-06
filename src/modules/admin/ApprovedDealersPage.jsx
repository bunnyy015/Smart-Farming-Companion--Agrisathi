import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ref, get } from "firebase/database";
import { database } from "../../firebase";

export default function ApprovedDealersPage() {
  const navigate = useNavigate();

  const [dealers, setDealers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDealers();
  }, []);

  async function loadDealers() {
    try {
      setLoading(true);

      const snapshot = await get(
        ref(database, "users")
      );

      if (!snapshot.exists()) {
        setDealers([]);
        return;
      }

      const data = snapshot.val();

      const dealerList = Object.entries(data)
        .filter(
          ([, user]) =>
            user &&
            user.role === "dealer" &&
            user.status === "approved"
        )
        .map(([uid, user]) => ({
          uid,
          ...user,
        }));

      setDealers(dealerList);
    } catch (error) {
      console.error(
        "Error loading approved dealers:",
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
                🏪 Approved Dealers
              </h1>

              <p className="text-green-100 mt-1">
                Dealers approved by the administrator
              </p>
            </div>

            <div className="bg-white text-green-800 rounded-xl px-4 py-2 font-bold">
              {loading ? "—" : dealers.length}
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
            <p className="text-gray-600">
              Loading approved dealers...
            </p>
          </div>
        ) : dealers.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <div className="text-5xl">🏪</div>

            <h2 className="text-xl font-bold text-gray-800 mt-4">
              No Approved Dealers
            </h2>

            <p className="text-gray-500 mt-2">
              No dealer accounts have been approved yet.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {dealers.map((dealer) => (
              <div
                key={dealer.uid}
                className="bg-white rounded-2xl shadow-sm border border-green-100 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-green-800">
                      {dealer.shopName ||
                        dealer.dealerName ||
                        dealer.ownerName ||
                        "Dealer"}
                    </h2>

                    <span className="inline-block mt-2 bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded-full">
                      Approved
                    </span>
                  </div>

                  <span className="text-3xl">
                    🏪
                  </span>
                </div>

                <div className="border-t mt-4 pt-4 space-y-2 text-sm">
                  <p>
                    <strong>Dealer Name:</strong>{" "}
                    {dealer.dealerName ||
                      "Not available"}
                  </p>

                  <p>
                    <strong>Owner Name:</strong>{" "}
                    {dealer.ownerName ||
                      "Not available"}
                  </p>

                  <p>
                    <strong>Email:</strong>{" "}
                    {dealer.email ||
                      "Not available"}
                  </p>

                  <p>
                    <strong>Phone:</strong>{" "}
                    {dealer.phone ||
                      "Not available"}
                  </p>

                  <p>
                    <strong>District:</strong>{" "}
                    {dealer.district ||
                      "Not available"}
                  </p>

                  <p>
                    <strong>State:</strong>{" "}
                    {dealer.state ||
                      "Not available"}
                  </p>

                  <p>
                    <strong>License Number:</strong>{" "}
                    {dealer.licenseNumber ||
                      "Not available"}
                  </p>

                  <p>
                    <strong>Address:</strong>{" "}
                    {dealer.address ||
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