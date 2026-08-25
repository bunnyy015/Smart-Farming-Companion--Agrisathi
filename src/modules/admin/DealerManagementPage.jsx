import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get, ref, update } from "firebase/database";

import { database } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";

const ACTIVE_STATUSES = ["approved", "active"];
const INACTIVE_STATUSES = ["suspended", "deactivated", "blocked"];

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function getDealerStatus(dealer) {
  const status = normalize(dealer.status);

  if (INACTIVE_STATUSES.includes(status)) {
    return "suspended";
  }

  if (ACTIVE_STATUSES.includes(status) || !status) {
    return "active";
  }

  return status;
}

function getDealerName(dealer) {
  return (
    dealer.name ||
    dealer.fullName ||
    dealer.dealerName ||
    dealer.businessName ||
    "Unnamed Dealer"
  );
}

function getDealerPhone(dealer) {
  return (
    dealer.phone ||
    dealer.mobile ||
    dealer.phoneNumber ||
    "Not provided"
  );
}

function getDealerEmail(dealer) {
  return dealer.email || "Not provided";
}

function getDealerDistrict(dealer) {
  return dealer.district || dealer.location || "Not provided";
}

function getDealerVillage(dealer) {
  return dealer.village || dealer.address || "Not provided";
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

export default function DealerManagementPage() {
  const navigate = useNavigate();

  const [dealers, setDealers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedDealer, setSelectedDealer] = useState(null);
  const [actionTarget, setActionTarget] = useState(null);

  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadDealers();
  }, []);

  function showMessage(type, text) {
    setMessage({
      type,
      text,
    });
  }

  async function loadDealers() {
    try {
      setLoading(true);

      const usersSnapshot = await get(ref(database, "users"));

      if (!usersSnapshot.exists()) {
        setDealers([]);
        return;
      }

      const usersData = usersSnapshot.val();

      const dealerEntries = Object.entries(usersData).filter(
        ([, user]) => {
          if (!user || typeof user !== "object") {
            return false;
          }

          return normalize(user.role) === "dealer";
        }
      );

      const dealerList = await Promise.all(
        dealerEntries.map(async ([uid, dealer]) => {
          let productCount = 0;

          try {
            const productsSnapshot = await get(
              ref(database, `dealerProducts/${uid}`)
            );

            if (productsSnapshot.exists()) {
              const products = productsSnapshot.val();

              if (
                products &&
                typeof products === "object" &&
                !Array.isArray(products)
              ) {
                productCount = Object.keys(products).length;
              }
            }
          } catch (productError) {
            console.warn(
              `Unable to load products for dealer ${uid}:`,
              productError
            );
          }

          return {
            uid,
            ...dealer,
            productCount,
          };
        })
      );

      dealerList.sort((first, second) =>
        getDealerName(first).localeCompare(getDealerName(second))
      );

      setDealers(dealerList);
    } catch (error) {
      console.error("Dealer management error:", error);

      showMessage(
        "error",
        "Unable to load dealer information. Check Firebase database access and rules."
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredDealers = useMemo(() => {
    const search = normalize(searchTerm);

    return dealers.filter((dealer) => {
      const status = getDealerStatus(dealer);

      const matchesStatus =
        statusFilter === "all" || status === statusFilter;

      if (!matchesStatus) {
        return false;
      }

      if (!search) {
        return true;
      }

      const searchableText = [
        getDealerName(dealer),
        getDealerEmail(dealer),
        getDealerPhone(dealer),
        getDealerDistrict(dealer),
        getDealerVillage(dealer),
        dealer.businessName,
        dealer.dealerId,
      ]
        .map(normalize)
        .join(" ");

      return searchableText.includes(search);
    });
  }, [dealers, searchTerm, statusFilter]);

  const statistics = useMemo(() => {
    const active = dealers.filter(
      (dealer) => getDealerStatus(dealer) === "active"
    ).length;

    const suspended = dealers.filter(
      (dealer) => getDealerStatus(dealer) === "suspended"
    ).length;

    const totalProducts = dealers.reduce(
      (total, dealer) => total + Number(dealer.productCount || 0),
      0
    );

    return {
      total: dealers.length,
      active,
      suspended,
      totalProducts,
    };
  }, [dealers]);

  function requestStatusChange(dealer) {
    setActionTarget(dealer);
  }

  async function confirmStatusChange() {
    if (!actionTarget) {
      return;
    }

    const dealer = actionTarget;
    const currentStatus = getDealerStatus(dealer);

    const nextStatus =
      currentStatus === "suspended" ? "approved" : "suspended";

    try {
      setActionLoading(dealer.uid);

      const updatedAt = new Date().toISOString();

      await update(ref(database, `users/${dealer.uid}`), {
        status: nextStatus,
        updatedAt,
      });

      setDealers((currentDealers) =>
        currentDealers.map((item) =>
          item.uid === dealer.uid
            ? {
                ...item,
                status: nextStatus,
                updatedAt,
              }
            : item
        )
      );

      if (selectedDealer?.uid === dealer.uid) {
        setSelectedDealer((current) => ({
          ...current,
          status: nextStatus,
        }));
      }

      setActionTarget(null);

      showMessage(
        "success",
        currentStatus === "suspended"
          ? `${getDealerName(dealer)} has been reactivated.`
          : `${getDealerName(dealer)} has been suspended.`
      );
    } catch (error) {
      console.error("Dealer status update error:", error);

      showMessage(
        "error",
        "Dealer status could not be updated. Check Firebase permissions."
      );
    } finally {
      setActionLoading("");
    }
  }

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
            CONFIRMATION MODAL
        ====================================================== */}
        {actionTarget && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-indigo-800 p-6 text-white">
                <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-3xl">
                  {getDealerStatus(actionTarget) === "suspended"
                    ? "🔓"
                    : "🔒"}
                </div>

                <h2 className="text-xl font-bold mt-4">
                  {getDealerStatus(actionTarget) === "suspended"
                    ? "Reactivate dealer?"
                    : "Suspend dealer?"}
                </h2>
              </div>

              <div className="p-6">
                <p className="text-gray-600 leading-6">
                  {getDealerStatus(actionTarget) === "suspended"
                    ? `${getDealerName(
                        actionTarget
                      )} will be allowed to use the dealer account again.`
                    : `${getDealerName(
                        actionTarget
                      )} will be marked as suspended. Existing products and records will be preserved.`}
                </p>

                <div className="grid grid-cols-2 gap-3 mt-6">
                  <button
                    type="button"
                    disabled={Boolean(actionLoading)}
                    onClick={() => setActionTarget(null)}
                    className="border border-gray-300 text-gray-700 rounded-xl py-3 font-semibold hover:bg-gray-50 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={Boolean(actionLoading)}
                    onClick={confirmStatusChange}
                    className={`rounded-xl py-3 font-semibold text-white transition disabled:opacity-50 ${
                      getDealerStatus(actionTarget) === "suspended"
                        ? "bg-indigo-600 hover:bg-indigo-700"
                        : "bg-red-600 hover:bg-red-700"
                    }`}
                  >
                    {actionLoading
                      ? "Updating..."
                      : getDealerStatus(actionTarget) === "suspended"
                      ? "Reactivate"
                      : "Suspend"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================
            DEALER DETAILS MODAL
        ====================================================== */}
        {selectedDealer && (
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl">
              <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-indigo-700 text-white p-6 rounded-t-3xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-indigo-200 text-sm">
                      Dealer Details
                    </p>

                    <h2 className="text-2xl font-bold mt-1">
                      {getDealerName(selectedDealer)}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedDealer(null)}
                    className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-xl transition"
                    aria-label="Close dealer details"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                  <span
                    className={`px-3 py-1.5 rounded-full text-sm font-semibold w-fit ${
                      getDealerStatus(selectedDealer) === "active"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {getDealerStatus(selectedDealer) === "active"
                      ? "Active"
                      : "Suspended"}
                  </span>

                  <span className="text-xs text-gray-500 break-all">
                    UID: {selectedDealer.uid}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoBox
                    label="Dealer Name"
                    value={getDealerName(selectedDealer)}
                  />

                  <InfoBox
                    label="Business Name"
                    value={
                      selectedDealer.businessName ||
                      selectedDealer.shopName ||
                      "Not provided"
                    }
                  />

                  <InfoBox
                    label="Email"
                    value={getDealerEmail(selectedDealer)}
                  />

                  <InfoBox
                    label="Phone"
                    value={getDealerPhone(selectedDealer)}
                  />

                  <InfoBox
                    label="Village"
                    value={getDealerVillage(selectedDealer)}
                  />

                  <InfoBox
                    label="District"
                    value={getDealerDistrict(selectedDealer)}
                  />

                  <InfoBox
                    label="Category / Type"
                    value={
                      selectedDealer.category ||
                      selectedDealer.dealerType ||
                      "Not provided"
                    }
                  />

                  <InfoBox
                    label="Registration Date"
                    value={formatDate(
                      selectedDealer.createdAt ||
                        selectedDealer.registeredAt
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
                  <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
                    <p className="text-sm text-indigo-700">
                      Products Listed
                    </p>

                    <p className="text-3xl font-bold text-indigo-950 mt-1">
                      {selectedDealer.productCount || 0}
                    </p>
                  </div>

                  <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
                    <p className="text-sm text-blue-700">
                      Account Status
                    </p>

                    <p className="text-xl font-bold text-blue-900 mt-2">
                      {getDealerStatus(selectedDealer) === "active"
                        ? "Active"
                        : "Suspended"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDealer(null);
                      requestStatusChange(selectedDealer);
                    }}
                    className={`flex-1 rounded-xl py-3 font-semibold text-white transition ${
                      getDealerStatus(selectedDealer) === "suspended"
                        ? "bg-indigo-600 hover:bg-indigo-700"
                        : "bg-red-600 hover:bg-red-700"
                    }`}
                  >
                    {getDealerStatus(selectedDealer) === "suspended"
                      ? "Reactivate Dealer"
                      : "Suspend Dealer"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedDealer(null)}
                    className="flex-1 border border-gray-300 rounded-xl py-3 font-semibold text-gray-700 hover:bg-gray-50 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================
            HEADER
        ====================================================== */}
        <header className="bg-gradient-to-r from-slate-950 via-indigo-950 to-indigo-800 text-white rounded-3xl shadow-xl p-6 md:p-8 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center text-3xl shadow-inner">
                🏪
              </div>

              <div>
                <h1 className="text-3xl md:text-4xl font-bold">
                  Dealer Management
                </h1>

                <p className="text-indigo-200 mt-1">
                  View and manage registered AgriSaathi dealers.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate("/admin")}
                className="bg-white/10 border border-white/20 hover:bg-white/20 px-4 py-2.5 rounded-xl font-semibold transition"
              >
                ← Admin Dashboard
              </button>

              <button
                type="button"
                onClick={loadDealers}
                disabled={loading}
                className="bg-white text-indigo-900 px-4 py-2.5 rounded-xl font-semibold hover:bg-indigo-50 transition disabled:opacity-50"
              >
                {loading ? "Loading..." : "↻ Refresh"}
              </button>
            </div>
          </div>
        </header>

        {/* =====================================================
            STATISTICS
        ====================================================== */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Total Dealers"
            value={statistics.total}
            icon="🏪"
            className="bg-white border-indigo-100"
            valueClass="text-indigo-900"
            iconClass="bg-indigo-50"
          />

          <StatCard
            title="Active Dealers"
            value={statistics.active}
            icon="✅"
            className="bg-emerald-50 border-emerald-100"
            valueClass="text-emerald-800"
            iconClass="bg-white/70"
          />

          <StatCard
            title="Suspended"
            value={statistics.suspended}
            icon="🔒"
            className="bg-red-50 border-red-100"
            valueClass="text-red-800"
            iconClass="bg-white/70"
          />

          <StatCard
            title="Products Listed"
            value={statistics.totalProducts}
            icon="📦"
            className="bg-blue-50 border-blue-100"
            valueClass="text-blue-800"
            iconClass="bg-white/70"
          />
        </section>

        {/* =====================================================
            SEARCH & FILTERS
        ====================================================== */}
        <section className="bg-white border border-indigo-100 rounded-2xl shadow-sm p-5 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <label
                htmlFor="dealer-search"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Search Dealers
              </label>

              <input
                id="dealer-search"
                type="search"
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(event.target.value)
                }
                placeholder="Search by name, email, phone, village or district..."
                className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
              />
            </div>

            <div className="lg:w-56">
              <label
                htmlFor="dealer-status"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Status
              </label>

              <select
                id="dealer-status"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
                className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-white outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
              >
                <option value="all">All Dealers</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
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
              {filteredDealers.length}
            </strong>{" "}
            of{" "}
            <strong className="text-gray-700">
              {dealers.length}
            </strong>{" "}
            dealers
          </p>
        </section>

        {/* =====================================================
            DEALERS
        ====================================================== */}
        <section>
          {loading ? (
            <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 p-10 text-center">
              <div className="text-4xl animate-pulse">🏪</div>

              <p className="text-lg font-semibold text-indigo-900 mt-3">
                Loading dealers...
              </p>

              <p className="text-gray-500 mt-1">
                Please wait while dealer information is loaded.
              </p>
            </div>
          ) : filteredDealers.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 p-10 text-center">
              <div className="text-5xl">🔍</div>

              <h2 className="text-xl font-bold text-gray-800 mt-4">
                No dealers found
              </h2>

              <p className="text-gray-500 mt-2">
                Try changing the search text or status filter.
              </p>

              <button
                type="button"
                onClick={clearFilters}
                className="mt-5 bg-indigo-600 text-white px-5 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {filteredDealers.map((dealer) => {
                const status = getDealerStatus(dealer);
                const isActive = status === "active";

                return (
                  <article
                    key={dealer.uid}
                    className="bg-white rounded-2xl shadow-sm border border-indigo-100 p-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-200"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-3xl">
                          🏪
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-xl font-bold text-indigo-950 break-words">
                              {getDealerName(dealer)}
                            </h2>

                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                isActive
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {isActive ? "Active" : "Suspended"}
                            </span>
                          </div>

                          <p className="text-sm text-gray-500 mt-1 break-words">
                            {getDealerEmail(dealer)}
                          </p>
                        </div>
                      </div>

                      <div className="text-right bg-indigo-50 rounded-xl px-4 py-2 shrink-0">
                        <p className="text-xs text-indigo-600">
                          Products
                        </p>

                        <p className="text-2xl font-bold text-indigo-900">
                          {dealer.productCount || 0}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-5">
                      <InfoBox
                        label="Phone"
                        value={getDealerPhone(dealer)}
                      />

                      <InfoBox
                        label="District"
                        value={getDealerDistrict(dealer)}
                      />

                      <InfoBox
                        label="Village"
                        value={getDealerVillage(dealer)}
                      />

                      <InfoBox
                        label="Registered"
                        value={formatDate(
                          dealer.createdAt ||
                            dealer.registeredAt
                        )}
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 mt-5">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedDealer(dealer)
                        }
                        className="flex-1 bg-indigo-600 text-white rounded-xl py-3 font-semibold hover:bg-indigo-700 transition shadow-sm"
                      >
                        View Details
                      </button>

                      <button
                        type="button"
                        disabled={
                          actionLoading === dealer.uid
                        }
                        onClick={() =>
                          requestStatusChange(dealer)
                        }
                        className={`flex-1 rounded-xl py-3 font-semibold transition disabled:opacity-50 ${
                          isActive
                            ? "border border-red-300 text-red-700 hover:bg-red-50"
                            : "border border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                        }`}
                      >
                        {actionLoading === dealer.uid
                          ? "Updating..."
                          : isActive
                          ? "Suspend"
                          : "Reactivate"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* =====================================================
            INFORMATION
        ====================================================== */}
        <section className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 mt-7">
          <h2 className="font-bold text-indigo-950">
            ℹ️ Dealer Management Policy
          </h2>

          <ul className="text-sm text-indigo-800 mt-2 space-y-1.5 list-disc pl-5">
            <li>
              Suspending a dealer does not delete their account.
            </li>

            <li>
              Existing products and historical records are preserved.
            </li>

            <li>
              A suspended dealer can be reactivated by the Admin.
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

function StatCard({
  title,
  value,
  icon,
  className,
  valueClass,
  iconClass,
}) {
  return (
    <div
      className={`border rounded-2xl shadow-sm p-5 hover:shadow-md transition ${className}`}
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

        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${iconClass}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function InfoBox({ label, value }) {
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {label}
      </p>

      <p className="text-sm font-semibold text-gray-800 mt-1 break-words">
        {value}
      </p>
    </div>
  );
}