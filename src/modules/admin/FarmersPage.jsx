import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get, ref, update } from "firebase/database";

import { database } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function getFarmerName(farmer) {
  return (
    farmer.name ||
    farmer.fullName ||
    farmer.farmerName ||
    "Unnamed Farmer"
  );
}

function getFarmerEmail(farmer) {
  return farmer.email || "Not provided";
}

function getFarmerPhone(farmer) {
  return (
    farmer.phone ||
    farmer.mobile ||
    farmer.phoneNumber ||
    "Not provided"
  );
}

function getFarmerVillage(farmer) {
  return farmer.village || farmer.address || "Not provided";
}

function getFarmerDistrict(farmer) {
  return farmer.district || farmer.location || "Not provided";
}

function getFarmerCrop(farmer) {
  return (
    farmer.mainCrop ||
    farmer.crop ||
    farmer.primaryCrop ||
    "Not provided"
  );
}

function getFarmerStatus(farmer) {
  return normalize(farmer.status) === "disabled"
    ? "disabled"
    : "active";
}

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function FarmersPage() {
  const navigate = useNavigate();

  const [farmers, setFarmers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [actionTarget, setActionTarget] = useState(null);

  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadFarmers();
  }, []);

  function showMessage(type, text) {
    setMessage({
      type,
      text,
    });
  }

  async function loadFarmers() {
    try {
      setLoading(true);

      const snapshot = await get(ref(database, "users"));

      if (!snapshot.exists()) {
        setFarmers([]);
        return;
      }

      const users = snapshot.val();

      const farmerList = Object.entries(users)
        .filter(([, user]) => {
          if (!user || typeof user !== "object") {
            return false;
          }

          return normalize(user.role) === "farmer";
        })
        .map(([uid, user]) => ({
          uid,
          ...user,
        }));

      farmerList.sort((first, second) =>
        getFarmerName(first).localeCompare(
          getFarmerName(second)
        )
      );

      setFarmers(farmerList);
    } catch (error) {
      console.error("Error loading farmers:", error);

      showMessage(
        "error",
        "Unable to load farmer information. Check Firebase database access and rules."
      );
    } finally {
      setLoading(false);
    }
  }

  function requestStatusChange(farmer) {
    setActionTarget(farmer);
  }

  async function confirmStatusChange() {
    if (!actionTarget?.uid) {
      return;
    }

    const farmer = actionTarget;
    const currentStatus = getFarmerStatus(farmer);

    const newStatus =
      currentStatus === "disabled"
        ? "approved"
        : "disabled";

    try {
      setProcessingId(farmer.uid);

      await update(
        ref(database, `users/${farmer.uid}`),
        {
          status: newStatus,
          updatedAt: new Date().toISOString(),
        }
      );

      setFarmers((currentFarmers) =>
        currentFarmers.map((currentFarmer) =>
          currentFarmer.uid === farmer.uid
            ? {
                ...currentFarmer,
                status: newStatus,
              }
            : currentFarmer
        )
      );

      if (selectedFarmer?.uid === farmer.uid) {
        setSelectedFarmer((current) => ({
          ...current,
          status: newStatus,
        }));
      }

      setActionTarget(null);

      showMessage(
        "success",
        currentStatus === "disabled"
          ? `${getFarmerName(
              farmer
            )} has been enabled successfully.`
          : `${getFarmerName(
              farmer
            )} has been disabled successfully.`
      );
    } catch (error) {
      console.error(
        "Error updating farmer status:",
        error
      );

      showMessage(
        "error",
        "Farmer account status could not be updated. Check Firebase permissions."
      );
    } finally {
      setProcessingId("");
    }
  }

  const filteredFarmers = useMemo(() => {
    const search = normalize(searchTerm);

    return farmers.filter((farmer) => {
      const status = getFarmerStatus(farmer);

      const matchesStatus =
        statusFilter === "all" ||
        status === statusFilter;

      if (!matchesStatus) {
        return false;
      }

      if (!search) {
        return true;
      }

      const searchableText = [
        getFarmerName(farmer),
        getFarmerEmail(farmer),
        getFarmerPhone(farmer),
        getFarmerVillage(farmer),
        getFarmerDistrict(farmer),
        getFarmerCrop(farmer),
        farmer.gender,
        farmer.farmerId,
      ]
        .map(normalize)
        .join(" ");

      return searchableText.includes(search);
    });
  }, [
    farmers,
    searchTerm,
    statusFilter,
  ]);

  const statistics = useMemo(() => {
    const active = farmers.filter(
      (farmer) =>
        getFarmerStatus(farmer) === "active"
    ).length;

    const disabled = farmers.filter(
      (farmer) =>
        getFarmerStatus(farmer) === "disabled"
    ).length;

    return {
      total: farmers.length,
      active,
      disabled,
    };
  }, [farmers]);

  function clearFilters() {
    setSearchTerm("");
    setStatusFilter("all");
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">

        <StatusMessage
          message={message}
          onClose={() => setMessage(null)}
        />

        {/* =====================================================
            STATUS CONFIRMATION MODAL
        ====================================================== */}
        {actionTarget && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6">

              <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center text-3xl">
                {getFarmerStatus(actionTarget) ===
                "disabled"
                  ? "🔓"
                  : "🔒"}
              </div>

              <h2 className="text-xl font-bold text-slate-900 mt-4">
                {getFarmerStatus(actionTarget) ===
                "disabled"
                  ? "Enable farmer?"
                  : "Disable farmer?"}
              </h2>

              <p className="text-slate-600 mt-2 leading-6">
                {getFarmerStatus(actionTarget) ===
                "disabled"
                  ? `${getFarmerName(
                      actionTarget
                    )} will be allowed to use the farmer account again.`
                  : `${getFarmerName(
                      actionTarget
                    )} will be disabled. Existing farmer information will be preserved.`}
              </p>

              <div className="grid grid-cols-2 gap-3 mt-6">

                <button
                  type="button"
                  disabled={Boolean(processingId)}
                  onClick={() =>
                    setActionTarget(null)
                  }
                  className="border border-slate-300 text-slate-700 rounded-xl py-3 font-semibold hover:bg-slate-50 transition disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={Boolean(processingId)}
                  onClick={confirmStatusChange}
                  className={`rounded-xl py-3 font-semibold text-white transition disabled:opacity-50 ${
                    getFarmerStatus(
                      actionTarget
                    ) === "disabled"
                      ? "bg-indigo-600 hover:bg-indigo-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {processingId
                    ? "Updating..."
                    : getFarmerStatus(
                        actionTarget
                      ) === "disabled"
                    ? "Enable"
                    : "Disable"}
                </button>

              </div>
            </div>
          </div>
        )}

        {/* =====================================================
            FARMER DETAILS MODAL
        ====================================================== */}
        {selectedFarmer && (
          <div
            className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4"
            onClick={() =>
              setSelectedFarmer(null)
            }
          >
            <div
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl"
              onClick={(event) =>
                event.stopPropagation()
              }
            >

              {/* Modal Header */}
              <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-indigo-700 text-white p-6 rounded-t-3xl">

                <div className="flex items-start justify-between gap-4">

                  <div>
                    <p className="text-indigo-200 text-sm">
                      Farmer Details
                    </p>

                    <h2 className="text-2xl font-bold mt-1">
                      {getFarmerName(
                        selectedFarmer
                      )}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedFarmer(null)
                    }
                    className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-xl"
                    aria-label="Close farmer details"
                  >
                    ×
                  </button>

                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6">

                <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">

                  <span
                    className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
                      getFarmerStatus(
                        selectedFarmer
                      ) === "active"
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {getFarmerStatus(
                      selectedFarmer
                    ) === "active"
                      ? "Active"
                      : "Disabled"}
                  </span>

                  <span className="text-xs text-slate-500 break-all">
                    UID: {selectedFarmer.uid}
                  </span>

                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  <InfoBox
                    label="Farmer Name"
                    value={getFarmerName(
                      selectedFarmer
                    )}
                  />

                  <InfoBox
                    label="Email"
                    value={getFarmerEmail(
                      selectedFarmer
                    )}
                  />

                  <InfoBox
                    label="Phone"
                    value={getFarmerPhone(
                      selectedFarmer
                    )}
                  />

                  <InfoBox
                    label="Village"
                    value={getFarmerVillage(
                      selectedFarmer
                    )}
                  />

                  <InfoBox
                    label="District"
                    value={getFarmerDistrict(
                      selectedFarmer
                    )}
                  />

                  <InfoBox
                    label="Main Crop"
                    value={getFarmerCrop(
                      selectedFarmer
                    )}
                  />

                  <InfoBox
                    label="Gender"
                    value={
                      selectedFarmer.gender ||
                      "Not provided"
                    }
                  />

                  <InfoBox
                    label="Registration Date"
                    value={formatDate(
                      selectedFarmer.createdAt ||
                        selectedFarmer.registeredAt
                    )}
                  />

                </div>

                <div className="mt-5 bg-indigo-50 border border-indigo-100 rounded-2xl p-5">

                  <p className="text-sm text-indigo-700">
                    Account Status
                  </p>

                  <p className="text-xl font-bold text-indigo-950 mt-1">
                    {getFarmerStatus(
                      selectedFarmer
                    ) === "active"
                      ? "Active"
                      : "Disabled"}
                  </p>

                </div>

                <div className="flex flex-col sm:flex-row gap-3 mt-6">

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFarmer(null);
                      requestStatusChange(
                        selectedFarmer
                      );
                    }}
                    className={`flex-1 rounded-xl py-3 font-semibold text-white ${
                      getFarmerStatus(
                        selectedFarmer
                      ) === "disabled"
                        ? "bg-indigo-600 hover:bg-indigo-700"
                        : "bg-red-600 hover:bg-red-700"
                    }`}
                  >
                    {getFarmerStatus(
                      selectedFarmer
                    ) === "disabled"
                      ? "Enable Farmer"
                      : "Disable Farmer"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedFarmer(null)
                    }
                    className="flex-1 border border-slate-300 rounded-xl py-3 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Close
                  </button>

                </div>

              </div>
            </div>
          </div>
        )}

        {/* =====================================================
            PAGE HEADER
        ====================================================== */}
        <header className="bg-gradient-to-r from-slate-950 via-indigo-950 to-indigo-800 text-white rounded-3xl shadow-xl p-6 md:p-8 mb-6">

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">

            <div className="flex items-center gap-4">

              <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-3xl">
                👨‍🌾
              </div>

              <div>
                <h1 className="text-3xl md:text-4xl font-bold">
                  Farmer Management
                </h1>

                <p className="text-indigo-200 mt-1">
                  View and manage registered AgriSathi farmers.
                </p>
              </div>

            </div>

            <div className="flex flex-wrap gap-3">

              <button
                type="button"
                onClick={() =>
                  navigate("/admin")
                }
                className="bg-white/10 border border-white/20 hover:bg-white/20 px-4 py-2.5 rounded-xl font-semibold transition"
              >
                ← Admin Dashboard
              </button>

              <button
                type="button"
                onClick={loadFarmers}
                disabled={loading}
                className="bg-white text-indigo-900 px-4 py-2.5 rounded-xl font-semibold hover:bg-indigo-50 transition disabled:opacity-50"
              >
                {loading
                  ? "Loading..."
                  : "↻ Refresh"}
              </button>

            </div>
          </div>
        </header>

        {/* =====================================================
            STATISTICS
        ====================================================== */}
        <section className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">

          <StatCard
            title="Total Farmers"
            value={statistics.total}
            icon="👨‍🌾"
            className="bg-white border-indigo-100"
            valueClass="text-indigo-900"
          />

          <StatCard
            title="Active Farmers"
            value={statistics.active}
            icon="✅"
            className="bg-indigo-50 border-indigo-100"
            valueClass="text-indigo-800"
          />

          <StatCard
            title="Disabled Farmers"
            value={statistics.disabled}
            icon="🔒"
            className="bg-red-50 border-red-100"
            valueClass="text-red-800"
          />

        </section>

        {/* =====================================================
            SEARCH AND FILTER
        ====================================================== */}
        <section className="bg-white border border-indigo-100 rounded-2xl shadow-sm p-5 mb-6">

          <div className="flex flex-col lg:flex-row gap-4">

            <div className="flex-1">

              <label
                htmlFor="farmer-search"
                className="block text-sm font-semibold text-slate-700 mb-2"
              >
                Search Farmers
              </label>

              <input
                id="farmer-search"
                type="search"
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(
                    event.target.value
                  )
                }
                placeholder="Search by name, email, phone, village, district or crop..."
                className="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />

            </div>

            <div className="lg:w-56">

              <label
                htmlFor="farmer-status"
                className="block text-sm font-semibold text-slate-700 mb-2"
              >
                Status
              </label>

              <select
                id="farmer-status"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
                className="w-full border border-slate-300 rounded-xl px-4 py-3 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">
                  All Farmers
                </option>

                <option value="active">
                  Active
                </option>

                <option value="disabled">
                  Disabled
                </option>
              </select>

            </div>

            <div className="lg:self-end">

              <button
                type="button"
                onClick={clearFilters}
                className="w-full lg:w-auto border border-slate-300 rounded-xl px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Clear
              </button>

            </div>

          </div>

          <p className="text-sm text-slate-500 mt-4">
            Showing{" "}
            <strong className="text-slate-700">
              {filteredFarmers.length}
            </strong>{" "}
            of{" "}
            <strong className="text-slate-700">
              {farmers.length}
            </strong>{" "}
            farmers
          </p>

        </section>

        {/* =====================================================
            FARMER LIST
        ====================================================== */}
        <section>

          {loading ? (
            <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 p-10 text-center">

              <div className="w-10 h-10 mx-auto rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />

              <p className="text-lg font-semibold text-indigo-900 mt-4">
                Loading farmers...
              </p>

              <p className="text-slate-500 mt-1">
                Please wait while farmer information is loaded.
              </p>

            </div>
          ) : filteredFarmers.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 p-10 text-center">

              <div className="text-5xl">
                🔍
              </div>

              <h2 className="text-xl font-bold text-slate-800 mt-4">
                No farmers found
              </h2>

              <p className="text-slate-500 mt-2">
                Try changing the search text or status filter.
              </p>

              <button
                type="button"
                onClick={clearFilters}
                className="mt-5 bg-indigo-600 text-white px-5 py-3 rounded-xl font-semibold hover:bg-indigo-700"
              >
                Clear Filters
              </button>

            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

              {filteredFarmers.map((farmer) => {
                const status =
                  getFarmerStatus(farmer);

                const isActive =
                  status === "active";

                const isProcessing =
                  processingId === farmer.uid;

                return (
                  <article
                    key={farmer.uid}
                    className="bg-white rounded-2xl shadow-sm border border-indigo-100 p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all"
                  >

                    {/* Farmer Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">

                      <div className="flex items-center gap-4">

                        <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-3xl shrink-0">
                          👨‍🌾
                        </div>

                        <div className="min-w-0">

                          <div className="flex flex-wrap items-center gap-2">

                            <h2 className="text-xl font-bold text-indigo-950 break-words">
                              {getFarmerName(
                                farmer
                              )}
                            </h2>

                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                isActive
                                  ? "bg-indigo-100 text-indigo-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {isActive
                                ? "Active"
                                : "Disabled"}
                            </span>

                          </div>

                          <p className="text-sm text-slate-500 mt-1 break-all">
                            {getFarmerEmail(
                              farmer
                            )}
                          </p>

                        </div>
                      </div>

                      <div className="text-right">

                        <p className="text-xs text-slate-500">
                          Main Crop
                        </p>

                        <p className="text-lg font-bold text-indigo-800 mt-1">
                          {getFarmerCrop(
                            farmer
                          )}
                        </p>

                      </div>

                    </div>

                    {/* Information */}
                    <div className="grid grid-cols-2 gap-3 mt-5">

                      <div className="bg-slate-50 rounded-xl p-3">

                        <p className="text-xs text-slate-500">
                          Phone
                        </p>

                        <p className="text-sm font-semibold text-slate-800 mt-1 break-words">
                          {getFarmerPhone(
                            farmer
                          )}
                        </p>

                      </div>

                      <div className="bg-slate-50 rounded-xl p-3">

                        <p className="text-xs text-slate-500">
                          District
                        </p>

                        <p className="text-sm font-semibold text-slate-800 mt-1 break-words">
                          {getFarmerDistrict(
                            farmer
                          )}
                        </p>

                      </div>

                      <div className="bg-slate-50 rounded-xl p-3">

                        <p className="text-xs text-slate-500">
                          Village
                        </p>

                        <p className="text-sm font-semibold text-slate-800 mt-1 break-words">
                          {getFarmerVillage(
                            farmer
                          )}
                        </p>

                      </div>

                      <div className="bg-slate-50 rounded-xl p-3">

                        <p className="text-xs text-slate-500">
                          Registered
                        </p>

                        <p className="text-sm font-semibold text-slate-800 mt-1">
                          {formatDate(
                            farmer.createdAt ||
                              farmer.registeredAt
                          )}
                        </p>

                      </div>

                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-3 mt-5">

                      <button
                        type="button"
                        onClick={() =>
                          setSelectedFarmer(
                            farmer
                          )
                        }
                        className="flex-1 bg-indigo-600 text-white rounded-xl py-3 font-semibold hover:bg-indigo-700 transition"
                      >
                        View Details
                      </button>

                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() =>
                          requestStatusChange(
                            farmer
                          )
                        }
                        className={`flex-1 rounded-xl py-3 font-semibold transition disabled:opacity-50 ${
                          isActive
                            ? "border border-red-300 text-red-700 hover:bg-red-50"
                            : "border border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                        }`}
                      >
                        {isProcessing
                          ? "Updating..."
                          : isActive
                          ? "Disable Farmer"
                          : "Enable Farmer"}
                      </button>

                    </div>

                  </article>
                );
              })}

            </div>
          )}

        </section>

        {/* =====================================================
            POLICY INFORMATION
        ====================================================== */}
        <section className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 mt-7">

          <h2 className="font-bold text-indigo-950">
            ℹ️ Farmer Management Policy
          </h2>

          <ul className="text-sm text-indigo-800 mt-2 space-y-1.5 list-disc pl-5">

            <li>
              Disabling a farmer does not delete the farmer account.
            </li>

            <li>
              Existing farmer information is preserved.
            </li>

            <li>
              A disabled farmer can be enabled again by the Admin.
            </li>

            <li>
              Permanent deletion is intentionally not provided here.
            </li>

          </ul>

        </section>

      </div>
    </div>
  );
}

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  title,
  value,
  icon,
  className,
  valueClass,
}) {
  return (
    <div
      className={`border rounded-2xl shadow-sm p-5 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">

        <div>

          <p className="text-sm text-slate-600 font-medium">
            {title}
          </p>

          <p
            className={`text-3xl md:text-4xl font-bold mt-2 ${valueClass}`}
          >
            {value}
          </p>

        </div>

        <div className="text-3xl">
          {icon}
        </div>

      </div>
    </div>
  );
}

/* =========================================================
   INFO BOX
========================================================= */

function InfoBox({ label, value }) {
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">

      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        {label}
      </p>

      <p className="text-sm font-semibold text-slate-800 mt-1 break-words">
        {value}
      </p>

    </div>
  );
}