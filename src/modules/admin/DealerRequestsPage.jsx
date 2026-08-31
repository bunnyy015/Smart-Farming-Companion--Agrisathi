import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get, ref } from "firebase/database";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  User,
  X,
} from "lucide-react";

import { database } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";

/*
|--------------------------------------------------------------------------
| Approved Dealers Management
|--------------------------------------------------------------------------
| This page is READ-ONLY for already approved dealers.
|
| Firebase structure is NOT changed.
|
| Existing structure used:
| users/{uid}
|   role: "dealer"
|   status: "approved"
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function cleanValue(value) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return "";
  }

  return String(value).trim();
}

function normalize(value) {
  return cleanValue(value).toLowerCase();
}

function getDealerName(dealer) {
  return (
    cleanValue(dealer?.dealerName) ||
    cleanValue(dealer?.ownerName) ||
    "Dealer"
  );
}

function getShopName(dealer) {
  return (
    cleanValue(dealer?.shopName) ||
    "Dealer Shop"
  );
}

function getDistrict(dealer) {
  return (
    cleanValue(dealer?.district) ||
    "District not available"
  );
}

/*
|--------------------------------------------------------------------------
| Main Component
|--------------------------------------------------------------------------
*/

export default function ApprovedDealersPage() {
  const navigate = useNavigate();

  const [dealers, setDealers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [selectedDistrict, setSelectedDistrict] =
    useState("All Districts");

  const [selectedDealer, setSelectedDealer] =
    useState(null);

  const [message, setMessage] = useState(null);

  /*
  |--------------------------------------------------------------------------
  | Initial load
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    loadDealers();
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Status message
  |--------------------------------------------------------------------------
  */

  function showMessage(type, text) {
    setMessage({
      type,
      text,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Load approved dealers
  |--------------------------------------------------------------------------
  */

  async function loadDealers(isRefresh = false) {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const snapshot = await get(
        ref(database, "users")
      );

      if (!snapshot.exists()) {
        setDealers([]);

        if (isRefresh) {
          showMessage(
            "info",
            "No approved dealer accounts were found."
          );
        }

        return;
      }

      const data = snapshot.val();

      const dealerList = Object.entries(data)
        .filter(
          ([, user]) =>
            user &&
            typeof user === "object" &&
            normalize(user.role) === "dealer" &&
            normalize(user.status) === "approved"
        )
        .map(([uid, user]) => ({
          uid,
          ...user,
        }));

      setDealers(dealerList);

      if (isRefresh) {
        showMessage(
          "success",
          "Approved dealer information refreshed successfully."
        );
      }
    } catch (error) {
      console.error(
        "Error loading approved dealers:",
        error
      );

      setDealers([]);

      showMessage(
        "error",
        "Unable to load approved dealer information. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | District list
  |--------------------------------------------------------------------------
  */

  const districts = useMemo(() => {
    const districtMap = new Map();

    dealers.forEach((dealer) => {
      const district = cleanValue(
        dealer?.district
      );

      if (!district) {
        return;
      }

      const key = normalize(district);

      if (!districtMap.has(key)) {
        districtMap.set(key, district);
      }
    });

    return [
      "All Districts",
      ...Array.from(districtMap.values()).sort(
        (a, b) => a.localeCompare(b)
      ),
    ];
  }, [dealers]);

  /*
  |--------------------------------------------------------------------------
  | Filter dealers
  |--------------------------------------------------------------------------
  */

  const filteredDealers = useMemo(() => {
    const keyword = normalize(search);

    return dealers.filter((dealer) => {
      const matchesDistrict =
        selectedDistrict === "All Districts" ||
        normalize(dealer?.district) ===
          normalize(selectedDistrict);

      if (!matchesDistrict) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const searchableText = [
        dealer?.shopName,
        dealer?.dealerName,
        dealer?.ownerName,
        dealer?.email,
        dealer?.phone,
        dealer?.district,
        dealer?.state,
        dealer?.licenseNumber,
        dealer?.address,
      ]
        .map(normalize)
        .join(" ");

      return searchableText.includes(keyword);
    });
  }, [
    dealers,
    search,
    selectedDistrict,
  ]);

  /*
  |--------------------------------------------------------------------------
  | Statistics
  |--------------------------------------------------------------------------
  */

  const statistics = useMemo(() => {
    const uniqueDistricts = new Set();

    dealers.forEach((dealer) => {
      const district = normalize(
        dealer?.district
      );

      if (district) {
        uniqueDistricts.add(district);
      }
    });

    return {
      total: dealers.length,
      districts: uniqueDistricts.size,
      showing: filteredDealers.length,
    };
  }, [dealers, filteredDealers]);

  /*
  |--------------------------------------------------------------------------
  | Loading Screen
  |--------------------------------------------------------------------------
  */

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-3xl border border-indigo-100 shadow-xl p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-50 flex items-center justify-center">
            <ShieldCheck
              size={32}
              className="text-indigo-700 animate-pulse"
            />
          </div>

          <h1 className="text-xl font-bold text-slate-900 mt-5">
            Loading Approved Dealers
          </h1>

          <p className="text-slate-500 mt-2">
            Fetching approved dealer accounts...
          </p>

          <div className="mt-5 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full w-2/3 bg-indigo-600 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Main UI
  |--------------------------------------------------------------------------
  */

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">

        <StatusMessage
          message={message}
          onClose={() => setMessage(null)}
        />

        {/* =========================================================
            HEADER
        ========================================================== */}

        <header className="bg-gradient-to-r from-slate-950 via-indigo-950 to-indigo-800 text-white rounded-3xl shadow-xl p-6 md:p-8 mb-6">

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">

            <div className="flex items-center gap-4">

              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
                <ShieldCheck size={30} />
              </div>

              <div>
                <p className="text-indigo-300 text-xs uppercase tracking-widest font-semibold">
                  Admin Module
                </p>

                <h1 className="text-3xl md:text-4xl font-bold mt-1">
                  Approved Dealers
                </h1>

                <p className="text-indigo-200 mt-1">
                  Monitor and review dealers approved by the administrator.
                </p>
              </div>

            </div>

            <div className="flex flex-wrap gap-3">

              <button
                type="button"
                onClick={() => navigate("/admin")}
                className="inline-flex items-center gap-2 bg-white/10 border border-white/20 hover:bg-white/20 px-4 py-2.5 rounded-xl font-semibold transition"
              >
                <ArrowLeft size={18} />
                Admin Dashboard
              </button>

              <button
                type="button"
                onClick={() => loadDealers(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-2 bg-white text-indigo-900 px-4 py-2.5 rounded-xl font-semibold hover:bg-indigo-50 transition disabled:opacity-50"
              >
                <RefreshCw
                  size={18}
                  className={
                    refreshing
                      ? "animate-spin"
                      : ""
                  }
                />

                {refreshing
                  ? "Refreshing..."
                  : "Refresh"}
              </button>

            </div>

          </div>

          <div className="mt-5 flex flex-wrap gap-2">

            <span className="inline-flex items-center gap-2 bg-white/10 border border-white/10 rounded-full px-3 py-1.5 text-sm text-indigo-100">
              <CheckCircle2 size={15} />
              Approved accounts
            </span>

            <span className="inline-flex items-center gap-2 bg-white/10 border border-white/10 rounded-full px-3 py-1.5 text-sm text-indigo-100">
              <Store size={15} />
              Dealer monitoring
            </span>

            <span className="inline-flex items-center gap-2 bg-white/10 border border-white/10 rounded-full px-3 py-1.5 text-sm text-indigo-100">
              <ShieldCheck size={15} />
              Read-only approval status
            </span>

          </div>

        </header>

        {/* =========================================================
            STATISTICS
        ========================================================== */}

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">

          <AdminStatCard
            title="Approved Dealers"
            value={statistics.total}
            subtitle="Total approved dealer accounts"
            icon={CheckCircle2}
          />

          <AdminStatCard
            title="Districts Covered"
            value={statistics.districts}
            subtitle="Districts with approved dealers"
            icon={MapPin}
          />

          <AdminStatCard
            title="Currently Showing"
            value={statistics.showing}
            subtitle="Dealers matching current filters"
            icon={Search}
          />

        </section>

        {/* =========================================================
            SEARCH + FILTER
        ========================================================== */}

        <section className="bg-white border border-indigo-100 rounded-2xl shadow-sm p-4 md:p-5 mb-6">

          <div className="flex flex-col lg:flex-row gap-3">

            <div className="relative flex-1">

              <Search
                size={19}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search shop, dealer, phone, email, district or license..."
                className="w-full border border-slate-300 rounded-xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />

            </div>

            <select
              value={selectedDistrict}
              onChange={(event) =>
                setSelectedDistrict(
                  event.target.value
                )
              }
              className="lg:w-64 border border-slate-300 rounded-xl px-4 py-3 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {districts.map((district) => (
                <option
                  key={district}
                  value={district}
                >
                  {district}
                </option>
              ))}
            </select>

            {(search ||
              selectedDistrict !==
                "All Districts") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setSelectedDistrict(
                    "All Districts"
                  );
                }}
                className="inline-flex items-center justify-center gap-2 border border-slate-300 text-slate-700 rounded-xl px-5 py-3 font-semibold hover:bg-slate-50 transition"
              >
                <X size={17} />
                Clear
              </button>
            )}

          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">

            <p className="text-sm text-slate-500">
              Showing{" "}
              <strong className="text-slate-800">
                {statistics.showing}
              </strong>{" "}
              of{" "}
              <strong className="text-slate-800">
                {statistics.total}
              </strong>{" "}
              approved dealers
            </p>

            {selectedDistrict !==
              "All Districts" && (
              <span className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-800 border border-indigo-100 rounded-full px-3 py-1.5 text-xs font-semibold">
                <MapPin size={14} />
                {selectedDistrict}
              </span>
            )}

          </div>

        </section>

        {/* =========================================================
            DEALER LIST
        ========================================================== */}

        {filteredDealers.length === 0 ? (

          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-10 text-center">

            <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center">
              <Store
                size={32}
                className="text-slate-400"
              />
            </div>

            <h2 className="text-xl font-bold text-slate-900 mt-5">
              No Approved Dealers Found
            </h2>

            <p className="text-slate-500 mt-2 max-w-md mx-auto">
              No approved dealer matches the current search or district filter.
            </p>

            {(search ||
              selectedDistrict !==
                "All Districts") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setSelectedDistrict(
                    "All Districts"
                  );
                }}
                className="mt-5 inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition"
              >
                Clear Filters
              </button>
            )}

          </div>

        ) : (

          <section>

            <div className="flex items-center justify-between gap-3 mb-4">

              <div>
                <p className="text-xs uppercase tracking-widest text-indigo-600 font-bold">
                  Dealer Directory
                </p>

                <h2 className="text-2xl font-bold text-slate-950 mt-1">
                  Approved Dealer Accounts
                </h2>
              </div>

              <span className="hidden sm:inline-flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600">
                <CheckCircle2
                  size={16}
                  className="text-indigo-600"
                />
                {filteredDealers.length} dealers
              </span>

            </div>

            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">

              {filteredDealers.map((dealer) => (
                <DealerCard
                  key={dealer.uid}
                  dealer={dealer}
                  onView={() =>
                    setSelectedDealer(dealer)
                  }
                />
              ))}

            </div>

          </section>

        )}

        {/* =========================================================
            INFORMATION
        ========================================================== */}

        <section className="bg-white border border-indigo-100 rounded-2xl shadow-sm p-5 mt-8">

          <div className="flex items-start gap-3">

            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
              <CircleAlert
                size={20}
                className="text-indigo-700"
              />
            </div>

            <div>

              <h2 className="font-bold text-slate-900">
                Approval Information
              </h2>

              <p className="text-sm text-slate-600 mt-1 leading-6">
                This page displays dealer accounts whose status is already
                approved. It does not manually approve, reject, or modify
                dealer accounts. Approval decisions should be handled through
                the pending dealer-request workflow.
              </p>

            </div>

          </div>

        </section>

      </div>

      {/* =========================================================
          DEALER DETAILS MODAL
      ========================================================== */}

      {selectedDealer && (
        <DealerDetailsModal
          dealer={selectedDealer}
          onClose={() =>
            setSelectedDealer(null)
          }
        />
      )}

    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Admin Statistic Card
|--------------------------------------------------------------------------
*/

function AdminStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
}) {
  return (
    <div className="bg-white border border-indigo-100 rounded-2xl shadow-sm p-5">

      <div className="flex items-start justify-between gap-4">

        <div>

          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="text-3xl font-bold text-slate-950 mt-1">
            {value}
          </p>

          <p className="text-xs text-slate-500 mt-1">
            {subtitle}
          </p>

        </div>

        <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center">
          <Icon
            size={21}
            className="text-indigo-700"
          />
        </div>

      </div>

    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Dealer Card
|--------------------------------------------------------------------------
*/

function DealerCard({
  dealer,
  onView,
}) {
  return (
    <article className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all overflow-hidden">

      {/* Card Header */}

      <div className="p-5">

        <div className="flex items-start justify-between gap-3">

          <div className="flex items-start gap-3 min-w-0">

            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
              <Store
                size={23}
                className="text-indigo-700"
              />
            </div>

            <div className="min-w-0">

              <h3 className="font-bold text-lg text-slate-950 truncate">
                {getShopName(dealer)}
              </h3>

              <p className="text-sm text-slate-500 mt-0.5">
                {getDealerName(dealer)}
              </p>

            </div>

          </div>

          <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-800 border border-indigo-100 rounded-full px-2.5 py-1 text-xs font-bold shrink-0">
            <CheckCircle2 size={13} />
            Approved
          </span>

        </div>

        {/* Dealer summary */}

        <div className="mt-5 space-y-3">

          <DealerInfoRow
            icon={MapPin}
            label="District"
            value={
              dealer?.district ||
              "Not available"
            }
          />

          <DealerInfoRow
            icon={Phone}
            label="Phone"
            value={
              dealer?.phone ||
              "Not available"
            }
          />

          <DealerInfoRow
            icon={Mail}
            label="Email"
            value={
              dealer?.email ||
              "Not available"
            }
          />

        </div>

      </div>

      {/* Footer */}

      <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">

        <button
          type="button"
          onClick={onView}
          className="w-full inline-flex items-center justify-between text-sm font-semibold text-indigo-700 hover:text-indigo-900 transition"
        >

          <span>
            View complete dealer details
          </span>

          <ChevronRight size={18} />

        </button>

      </div>

    </article>
  );
}

/*
|--------------------------------------------------------------------------
| Dealer Info Row
|--------------------------------------------------------------------------
*/

function DealerInfoRow({
  icon: Icon,
  label,
  value,
}) {
  return (
    <div className="flex items-center gap-3">

      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
        <Icon
          size={15}
          className="text-slate-600"
        />
      </div>

      <div className="min-w-0">

        <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">
          {label}
        </p>

        <p className="text-sm text-slate-700 truncate mt-0.5">
          {value}
        </p>

      </div>

    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Dealer Details Modal
|--------------------------------------------------------------------------
*/

function DealerDetailsModal({
  dealer,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-6">

      <div className="w-full max-w-3xl max-h-[92vh] overflow-hidden bg-slate-50 rounded-3xl shadow-2xl">

        {/* Modal Header */}

        <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-indigo-800 text-white px-5 md:px-7 py-5">

          <div className="flex items-start justify-between gap-4">

            <div className="flex items-start gap-3">

              <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
                <Store size={24} />
              </div>

              <div>

                <p className="text-xs uppercase tracking-widest text-indigo-300 font-semibold">
                  Approved Dealer
                </p>

                <h2 className="text-2xl font-bold mt-1">
                  {getShopName(dealer)}
                </h2>

                <p className="text-indigo-200 text-sm mt-1">
                  {getDealerName(dealer)}
                </p>

              </div>

            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
              aria-label="Close dealer details"
            >
              <X size={21} />
            </button>

          </div>

        </div>

        {/* Modal Content */}

        <div className="overflow-y-auto max-h-[calc(92vh-105px)] p-4 md:p-6">

          {/* Status */}

          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-center gap-3">

            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0">
              <CheckCircle2
                size={21}
                className="text-indigo-700"
              />
            </div>

            <div>

              <p className="font-bold text-indigo-900">
                Dealer Account Approved
              </p>

              <p className="text-sm text-indigo-700 mt-0.5">
                This dealer is currently marked as approved in the system.
              </p>

            </div>

          </div>

          {/* Basic Information */}

          <section className="mt-5">

            <ModalSectionTitle
              icon={User}
              title="Dealer Information"
            />

            <div className="grid sm:grid-cols-2 gap-3 mt-3">

              <DetailField
                label="Dealer Name"
                value={
                  dealer?.dealerName
                }
              />

              <DetailField
                label="Owner Name"
                value={
                  dealer?.ownerName
                }
              />

              <DetailField
                label="Shop Name"
                value={
                  dealer?.shopName
                }
              />

              <DetailField
                label="Email"
                value={
                  dealer?.email
                }
              />

              <DetailField
                label="Phone"
                value={
                  dealer?.phone
                }
              />

              <DetailField
                label="License Number"
                value={
                  dealer?.licenseNumber
                }

              />

            </div>

          </section>

          {/* Location */}

          <section className="mt-6">

            <ModalSectionTitle
              icon={MapPin}
              title="Location Information"
            />

            <div className="grid sm:grid-cols-2 gap-3 mt-3">

              <DetailField
                label="Village"
                value={
                  dealer?.village
                }
              />

              <DetailField
                label="District"
                value={
                  dealer?.district
                }
              />

              <DetailField
                label="State"
                value={
                  dealer?.state
                }
              />

              <DetailField
                label="PIN Code"
                value={
                  dealer?.pincode ||
                  dealer?.pinCode
                }
              />

              <div className="sm:col-span-2">

                <DetailField
                  label="Address"
                  value={
                    dealer?.address
                  }
                />

              </div>

            </div>

          </section>

          {/* Account Information */}

          <section className="mt-6">

            <ModalSectionTitle
              icon={ShieldCheck}
              title="Account Information"
            />

            <div className="grid sm:grid-cols-2 gap-3 mt-3">

              <DetailField
                label="Role"
                value={
                  dealer?.role
                }
              />

              <DetailField
                label="Status"
                value={
                  dealer?.status
                }
              />

              <DetailField
                label="User ID"
                value={
                  dealer?.uid
                }
              />

            </div>

          </section>

          {/* Close */}

          <div className="mt-6 flex justify-end">

            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition"
            >
              Close
            </button>

          </div>

        </div>

      </div>

    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Modal Section Title
|--------------------------------------------------------------------------
*/

function ModalSectionTitle({
  icon: Icon,
  title,
}) {
  return (
    <div className="flex items-center gap-2">

      <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
        <Icon
          size={18}
          className="text-indigo-700"
        />
      </div>

      <h3 className="font-bold text-slate-900">
        {title}
      </h3>

    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Detail Field
|--------------------------------------------------------------------------
*/

function DetailField({
  label,
  value,
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">

      <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">
        {label}
      </p>

      <p className="text-sm font-semibold text-slate-800 mt-1 break-words">
        {cleanValue(value) ||
          "Not available"}
      </p>

    </div>
  );
}