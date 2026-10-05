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
  return (
    farmer.village ||
    farmer.address ||
    "Not provided"
  );
}

function getFarmerDistrict(farmer) {
  return (
    farmer.district ||
    farmer.location ||
    "Not provided"
  );
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

export default function FarmersListPage() {
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
      setMessage(null);

      const snapshot = await get(
        ref(database, "users")
      );

      if (!snapshot.exists()) {
        setFarmers([]);
        return;
      }

      const users = snapshot.val();

      const farmerList = Object.entries(users || {})
        .filter(([, user]) => {
          return (
            user &&
            typeof user === "object" &&
            normalize(user.role) === "farmer"
          );
        })
        .map(([uid, user]) => ({
          uid,
          ...user,
        }))
        .sort((first, second) =>
          getFarmerName(first).localeCompare(
            getFarmerName(second)
          )
        );

      setFarmers(farmerList);
    } catch (error) {
      console.error(
        "Farmer management loading error:",
        error
      );

      showMessage(
        "error",
        "Unable to load farmers. Please check Firebase database access and rules."
      );
    } finally {
      setLoading(false);
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
        farmer.age,
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

  function requestStatusChange(farmer) {
    setActionTarget(farmer);
  }

  async function confirmStatusChange() {
    if (!actionTarget?.uid) {
      return;
    }

    const farmer = actionTarget;

    const currentStatus =
      getFarmerStatus(farmer);

    const nextStatus =
      currentStatus === "disabled"
        ? "approved"
        : "disabled";

    const action =
      currentStatus === "disabled"
        ? "enable"
        : "disable";

    try {
      setProcessingId(farmer.uid);

      const updatedAt =
        new Date().toISOString();

      await update(
        ref(
          database,
          `users/${farmer.uid}`
        ),
        {
          status: nextStatus,
          statusUpdatedAt: updatedAt,
        }
      );

      setFarmers((currentFarmers) =>
        currentFarmers.map((item) =>
          item.uid === farmer.uid
            ? {
                ...item,
                status: nextStatus,
                statusUpdatedAt: updatedAt,
              }
            : item
        )
      );

      if (
        selectedFarmer?.uid ===
        farmer.uid
      ) {
        setSelectedFarmer((current) => ({
          ...current,
          status: nextStatus,
          statusUpdatedAt: updatedAt,
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
        "Farmer status update error:",
        error
      );

      showMessage(
        "error",
        `Unable to ${action} this farmer account. Please check Firebase permissions.`
      );
    } finally {
      setProcessingId("");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto">

        <StatusMessage
          message={message}
          onClose={() => setMessage(null)}
        />

        {/* =========================
            STATUS CONFIRMATION MODAL
        ========================== */}
        {actionTarget && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6">

              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl ${
                  getFarmerStatus(
                    actionTarget
                  ) === "disabled"
                    ? "bg-green-100"
                    : "bg-red-100"
                }`}
              >
                {getFarmerStatus(
                  actionTarget
                ) === "disabled"
                  ? "🔓"
                  : "🔒"}
              </div>

              <h2 className="text-xl font-bold text-gray-900 mt-4">
                {getFarmerStatus(
                  actionTarget
                ) === "disabled"
                  ? "Enable farmer?"
                  : "Disable farmer?"}
              </h2>

              <p className="text-gray-600 mt-2 leading-6">
                {getFarmerStatus(
                  actionTarget
                ) === "disabled"
                  ? `${getFarmerName(
                      actionTarget
                    )} will be allowed to use the farmer account again.`
                  : `${getFarmerName(
                      actionTarget
                    )} will no longer be able to log in until the account is enabled again.`}
              </p>

              <div className="grid grid-cols-2 gap-3 mt-6">

                <button
                  type="button"
                  disabled={Boolean(
                    processingId
                  )}
                  onClick={() =>
                    setActionTarget(null)
                  }
                  className="border border-gray-300 text-gray-700 rounded-xl py-3 font-semibold hover:bg-gray-50 transition disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={Boolean(
                    processingId
                  )}
                  onClick={
                    confirmStatusChange
                  }
                  className={`rounded-xl py-3 font-semibold text-white transition disabled:opacity-50 ${
                    getFarmerStatus(
                      actionTarget
                    ) === "disabled"
                      ? "bg-green-700 hover:bg-green-800"
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

        {/* =========================
            FARMER DETAILS MODAL
        ========================== */}
        {selectedFarmer && (
          <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4">

            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl">

              <div className="bg-gradient-to-r from-green-900 via-green-800 to-green-600 text-white p-6 rounded-t-3xl">

                <div className="flex items-start justify-between gap-4">

                  <div className="flex items-center gap-4">

                    <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center text-4xl">
                      👨‍🌾
                    </div>

                    <div>
                      <p className="text-green-100 text-sm">
                        Farmer Details
                      </p>

                      <h2 className="text-2xl font-bold mt-1">
                        {getFarmerName(
                          selectedFarmer
                        )}
                      </h2>
                    </div>

                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedFarmer(null)
                    }
                    className="w-10 h-10 rounded-xl bg-white/15 hover:bg-white/25 text-xl"
                    aria-label="Close farmer details"
                  >
                    ×
                  </button>

                </div>
              </div>

              <div className="p-6">

                <div className="flex items-center justify-between gap-3 mb-6">

                  <span
                    className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
                      getFarmerStatus(
                        selectedFarmer
                      ) === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {getFarmerStatus(
                      selectedFarmer
                    ) === "active"
                      ? "Active"
                      : "Disabled"}
                  </span>

                  <span className="text-xs text-gray-500 break-all">
                    UID:{" "}
                    {selectedFarmer.uid}
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
                    label="Age"
                    value={
                      selectedFarmer.age ||
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

                  <InfoBox
                    label="Last Status Update"
                    value={formatDate(
                      selectedFarmer.statusUpdatedAt
                    )}
                  />

                </div>

                <div className="flex flex-col sm:flex-row gap-3 mt-6">

                  <button
                    type="button"
                    disabled={
                      processingId ===
                      selectedFarmer.uid
                    }
                    onClick={() => {
                      const farmer =
                        selectedFarmer;

                      setSelectedFarmer(
                        null
                      );

                      requestStatusChange(
                        farmer
                      );
                    }}
                    className={`flex-1 rounded-xl py-3 font-semibold text-white transition disabled:opacity-50 ${
                      getFarmerStatus(
                        selectedFarmer
                      ) === "disabled"
                        ? "bg-green-700 hover:bg-green-800"
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
                    className="flex-1 border border-gray-300 rounded-xl py-3 font-semibold text-gray-700 hover:bg-gray-50 transition"
                  >
                    Close
                  </button>

                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================
            PAGE HEADER
        ========================== */}
        <header className="bg-gradient-to-r from-green-900 via-green-800 to-green-600 text-white rounded-3xl shadow-xl p-6 md:p-8 mb-6">

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">

            <div className="flex items-center gap-4">

              <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center text-4xl">
                👨‍🌾
              </div>

              <div>
                <h1 className="text-3xl md:text-4xl font-bold">
                  Farmer Management
                </h1>

                <p className="text-green-100 mt-1">
                  View and manage registered
                  farmer accounts.
                </p>
              </div>

            </div>

            <div className="flex flex-wrap gap-3">

              <button
                type="button"
                onClick={() =>
                  navigate("/admin")
                }
                className="bg-white/15 hover:bg-white/25 px-4 py-2.5 rounded-xl font-semibold transition"
              >
                ← Admin Dashboard
              </button>

              <button
                type="button"
                onClick={loadFarmers}
                disabled={loading}
                className="bg-white text-green-800 px-4 py-2.5 rounded-xl font-semibold hover:bg-green-50 transition disabled:opacity-50"
              >
                {loading
                  ? "Loading..."
                  : "↻ Refresh"}
              </button>

            </div>
          </div>
        </header>

        {/* =========================
            STATISTICS
        ========================== */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">

          <StatCard
            title="Total Farmers"
            value={statistics.total}
            icon="👨‍🌾"
            className="bg-white border-green-100"
            valueClass="text-green-800"
          />

          <StatCard
            title="Active Farmers"
            value={statistics.active}
            icon="✅"
            className="bg-green-50 border-green-100"
            valueClass="text-green-800"
          />

          <StatCard
            title="Disabled Farmers"
            value={statistics.disabled}
            icon="🔒"
            className="bg-red-50 border-red-100"
            valueClass="text-red-800"
          />

        </section>

        {/* =========================
            SEARCH & FILTER
        ========================== */}
        <section className="bg-white border border-green-100 rounded-2xl shadow-sm p-5 mb-6">

          <div className="flex flex-col lg:flex-row gap-4">

            <div className="flex-1">

              <label
                htmlFor="farmer-search"
                className="block text-sm font-semibold text-gray-700 mb-2"
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
                className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />

            </div>

            <div className="lg:w-56">

              <label
                htmlFor="farmer-status"
                className="block text-sm font-semibold text-gray-700 mb-2"
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
                className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-white outline-none focus:ring-2 focus:ring-green-500"
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
                className="w-full lg:w-auto border border-gray-300 rounded-xl px-5 py-3 font-semibold text-gray-700 hover:bg-gray-50 transition"
              >
                Clear
              </button>

            </div>

          </div>

          <p className="text-sm text-gray-500 mt-4">
            Showing{" "}
            <strong className="text-gray-700">
              {filteredFarmers.length}
            </strong>{" "}
            of{" "}
            <strong className="text-gray-700">
              {farmers.length}
            </strong>{" "}
            farmers
          </p>

        </section>

        {/* =========================
            FARMER LIST
        ========================== */}
        <section>

          {loading ? (
            <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-10 text-center">

              <div className="w-10 h-10 mx-auto rounded-full border-4 border-green-200 border-t-green-700 animate-spin" />

              <p className="text-lg font-semibold text-green-800 mt-4">
                Loading farmers...
              </p>

              <p className="text-gray-500 mt-1">
                Please wait while farmer
                information is loaded.
              </p>

            </div>
          ) : filteredFarmers.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-10 text-center">

              <div className="text-5xl">
                🔍
              </div>

              <h2 className="text-xl font-bold text-gray-800 mt-4">
                No farmers found
              </h2>

              <p className="text-gray-500 mt-2">
                Try changing the search text
                or status filter.
              </p>

              <button
                type="button"
                onClick={clearFilters}
                className="mt-5 bg-green-700 text-white px-5 py-3 rounded-xl font-semibold hover:bg-green-800 transition"
              >
                Clear Filters
              </button>

            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-green-100 bg-white shadow-sm">
              <table className="min-w-[900px] w-full text-left text-sm">
                <thead className="bg-green-50 text-xs uppercase tracking-wide text-green-900">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Farmer</th>
                    <th className="px-4 py-3 font-semibold">Phone</th>
                    <th className="px-4 py-3 font-semibold">Location</th>
                    <th className="px-4 py-3 font-semibold">Registered</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-green-100">
              {filteredFarmers.map((farmer) => {
                  const status =
                    getFarmerStatus(
                      farmer
                    );

                  const isActive =
                    status === "active";

                  const isProcessing =
                    processingId ===
                    farmer.uid;

                  return (
                    <tr key={farmer.uid} className="hover:bg-green-50/60">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{getFarmerName(farmer)}</div>
                        <div className="text-gray-500">{getFarmerEmail(farmer)}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{getFarmerPhone(farmer)}</td>
                      <td className="px-4 py-3 text-gray-700">{[getFarmerVillage(farmer), getFarmerDistrict(farmer)].filter((value) => value !== "Not provided").join(", ") || "Not provided"}</td>
                      <td className="px-4 py-3 text-gray-700">{formatDate(farmer.createdAt || farmer.registeredAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{isActive ? "Active" : "Disabled"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => setSelectedFarmer(farmer)} className="rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white hover:bg-green-800">View</button>
                          <button type="button" disabled={isProcessing} onClick={() => requestStatusChange(farmer)} className={`rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${isActive ? "border-red-300 text-red-700 hover:bg-red-50" : "border-green-300 text-green-700 hover:bg-green-50"}`}>{isProcessing ? "Updating..." : isActive ? "Disable" : "Enable"}</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                </tbody>
              </table>
            </div>
          )}

        </section>

        {/* =========================
            MANAGEMENT POLICY
        ========================== */}
        <section className="bg-blue-50 border border-blue-100 rounded-2xl p-5 mt-7">

          <h2 className="font-bold text-blue-900">
            ℹ️ Farmer Management Policy
          </h2>

          <ul className="text-sm text-blue-800 mt-2 space-y-1.5 list-disc pl-5">

            <li>
              Disabling a farmer does not
              delete their account.
            </li>

            <li>
              Farmer information and
              existing records are preserved.
            </li>

            <li>
              A disabled farmer can be
              enabled again by the Admin.
            </li>

            <li>
              Permanent deletion is not
              provided to prevent accidental
              data loss.
            </li>

          </ul>

        </section>

      </div>
    </div>
  );
}

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

          <p className="text-sm text-gray-600 font-medium">
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

function InfoBox({ label, value }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">

      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {label}
      </p>

      <p className="text-sm font-semibold text-gray-800 mt-1 break-words">
        {value}
      </p>

    </div>
  );
}
