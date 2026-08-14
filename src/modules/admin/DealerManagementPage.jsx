import { useEffect, useState } from "react";
import { ref, get, update } from "firebase/database";
import { database } from "../../firebase";

export default function DealerManagementPage() {
  const [dealers, setDealers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

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

      const users = snapshot.val();

      const dealerList = Object.entries(users)
        .filter(
          ([, user]) =>
            user && user.role === "dealer"
        )
        .map(([uid, user]) => ({
          uid,
          ...user,
        }));

      setDealers(dealerList);
    } catch (error) {
      console.error(
        "Error loading dealers:",
        error
      );
    } finally {
      setLoading(false);
    }
  }

  async function toggleDealerStatus(dealer) {
    if (!dealer?.uid) return;

    try {
      setProcessingId(dealer.uid);

      const newStatus =
        dealer.status === "disabled"
          ? "approved"
          : "disabled";

      await update(
        ref(database, `users/${dealer.uid}`),
        {
          status: newStatus,
        }
      );

      setDealers((currentDealers) =>
        currentDealers.map((currentDealer) =>
          currentDealer.uid === dealer.uid
            ? {
                ...currentDealer,
                status: newStatus,
              }
            : currentDealer
        )
      );

      alert(
        newStatus === "disabled"
          ? "Dealer account disabled successfully."
          : "Dealer account enabled successfully."
      );
    } catch (error) {
      console.error(
        "Error updating dealer status:",
        error
      );

      alert(
        "Failed to update dealer account status."
      );
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
          onClick={() => window.history.back()}
          className="mb-5 inline-flex items-center gap-2 bg-white text-green-700 px-4 py-2 rounded-lg shadow-sm border border-green-200 hover:bg-green-50 transition font-medium"
        >
          ← Back
        </button>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-green-700">
              🏪 Manage Dealers
            </h1>

            <p className="text-gray-600 mt-2">
              View and manage approved dealer accounts.
            </p>
          </div>

          <button
            type="button"
            onClick={loadDealers}
            disabled={loading}
            className="bg-green-700 text-white px-5 py-3 rounded-xl font-semibold hover:bg-green-800 transition disabled:bg-gray-400"
          >
            ↻ Refresh
          </button>
        </div>

        {/* Dealer Count */}
        {!loading && (
          <div className="bg-white rounded-xl shadow-sm border border-green-100 p-4 mb-6">
            <p className="text-gray-600">
              Total Registered Dealers
            </p>

            <p className="text-3xl font-bold text-green-700 mt-1">
              {dealers.length}
            </p>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="bg-white p-8 rounded-2xl shadow text-center">
            <div className="w-8 h-8 mx-auto rounded-full border-4 border-green-200 border-t-green-700 animate-spin" />

            <p className="text-gray-600 mt-4">
              Loading dealers...
            </p>
          </div>
        ) : dealers.length === 0 ? (
          /* Empty State */
          <div className="bg-white p-8 rounded-2xl shadow text-center">
            <div className="text-5xl mb-4">
              🏪
            </div>

            <h2 className="text-xl font-bold text-gray-800">
              No Dealers Found
            </h2>

            <p className="text-gray-500 mt-2">
              There are currently no approved dealer
              accounts.
            </p>
          </div>
        ) : (
          /* Dealer List */
          <div className="space-y-5">
            {dealers.map((dealer) => {
              const isDisabled =
                dealer.status === "disabled";

              const isProcessing =
                processingId === dealer.uid;

              return (
                <div
                  key={dealer.uid}
                  className="bg-white p-6 rounded-2xl shadow border border-green-100"
                >
                  {/* Dealer Header */}
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
                    <div>
                      <h2 className="text-2xl font-bold text-green-800">
                        {dealer.shopName ||
                          "Dealer Shop"}
                      </h2>

                      <p className="text-gray-500 mt-1">
                        {dealer.dealerName ||
                          dealer.ownerName ||
                          "Dealer"}
                      </p>
                    </div>

                    <span
                      className={
                        isDisabled
                          ? "inline-flex w-fit bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-semibold"
                          : "inline-flex w-fit bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold"
                      }
                    >
                      {isDisabled
                        ? "Disabled"
                        : "Active"}
                    </span>
                  </div>

                  {/* Dealer Information */}
                  <div className="grid md:grid-cols-2 gap-4">

                    {/* Dealer Name */}
                    <div className="bg-gray-50 p-4 rounded-xl">
                      <p className="text-sm text-gray-500">
                        Dealer Name
                      </p>

                      <p className="font-semibold text-gray-800 mt-1">
                        {dealer.dealerName ||
                          dealer.ownerName ||
                          "Not available"}
                      </p>
                    </div>

                    {/* Owner */}
                    <div className="bg-gray-50 p-4 rounded-xl">
                      <p className="text-sm text-gray-500">
                        Owner Name
                      </p>

                      <p className="font-semibold text-gray-800 mt-1">
                        {dealer.ownerName ||
                          "Not available"}
                      </p>
                    </div>

                    {/* Email */}
                    <div className="bg-gray-50 p-4 rounded-xl">
                      <p className="text-sm text-gray-500">
                        Email
                      </p>

                      <p className="font-semibold text-gray-800 mt-1 break-all">
                        {dealer.email ||
                          "Not available"}
                      </p>
                    </div>

                    {/* Phone */}
                    <div className="bg-gray-50 p-4 rounded-xl">
                      <p className="text-sm text-gray-500">
                        Phone
                      </p>

                      <p className="font-semibold text-gray-800 mt-1">
                        {dealer.phone ||
                          "Not available"}
                      </p>
                    </div>

                    {/* District */}
                    <div className="bg-gray-50 p-4 rounded-xl">
                      <p className="text-sm text-gray-500">
                        District
                      </p>

                      <p className="font-semibold text-gray-800 mt-1">
                        {dealer.district ||
                          "Not available"}
                      </p>
                    </div>

                    {/* State */}
                    <div className="bg-gray-50 p-4 rounded-xl">
                      <p className="text-sm text-gray-500">
                        State
                      </p>

                      <p className="font-semibold text-gray-800 mt-1">
                        {dealer.state ||
                          "Not available"}
                      </p>
                    </div>

                    {/* License */}
                    <div className="bg-gray-50 p-4 rounded-xl md:col-span-2">
                      <p className="text-sm text-gray-500">
                        License Number
                      </p>

                      <p className="font-semibold text-gray-800 mt-1">
                        {dealer.licenseNumber ||
                          "Not available"}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-6 pt-5 border-t border-gray-100">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() =>
                        toggleDealerStatus(dealer)
                      }
                      className={
                        isDisabled
                          ? "w-full sm:w-auto bg-green-700 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-800 transition disabled:bg-gray-400"
                          : "w-full sm:w-auto bg-red-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-red-700 transition disabled:bg-gray-400"
                      }
                    >
                      {isProcessing
                        ? "Processing..."
                        : isDisabled
                        ? "✓ Enable Dealer"
                        : "Disable Dealer"}
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