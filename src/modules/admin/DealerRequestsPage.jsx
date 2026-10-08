import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get, ref, update } from "firebase/database";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  MapPin,
  RefreshCw,
  Search,
  Store,
  UserRound,
} from "lucide-react";

import StatusMessage from "../../components/StatusMessage";
import { database } from "../../firebase";

function cleanValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function normalize(value) {
  return cleanValue(value).toLowerCase();
}

function getPendingRequests(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return [];
  }

  return Object.entries(data)
    .filter(([, request]) => {
      if (!request || typeof request !== "object" || Array.isArray(request)) {
        return false;
      }

      const status = normalize(request.status);
      const role = normalize(request.role);

      return (
        (!status || status === "pending") &&
        (!role || role === "dealer")
      );
    })
    .map(([requestKey, request]) => ({
      ...request,
      requestKey,
    }))
    .sort((first, second) =>
      cleanValue(second.createdAt).localeCompare(
        cleanValue(first.createdAt)
      )
    );
}

function displayValue(value) {
  return cleanValue(value) || "Not provided";
}

function DealerRequestCard({ request, processing, onApprove }) {
  const dealerName =
    cleanValue(request.dealerName) ||
    cleanValue(request.ownerName) ||
    "Dealer";
  const shopName = cleanValue(request.shopName) || "Shop name not provided";

  return (
    <article className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 bg-amber-50/70 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-amber-700 shadow-sm">
            <Store size={21} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{shopName}</h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-600">
              <UserRound size={15} />
              {dealerName}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onApprove(request)}
          disabled={processing}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-green-700 px-4 py-2.5 font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <CheckCircle2 size={18} />
          {processing ? "Accepting..." : "Accept dealer"}
        </button>
      </div>

      <div className="grid gap-x-8 gap-y-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
        <RequestField label="Owner name" value={request.ownerName} />
        <RequestField label="Email" value={request.email} />
        <RequestField label="Phone" value={request.phone} />
        <RequestField label="License number" value={request.licenseNumber} />
        <RequestField label="GST number" value={request.gstNumber} />
        <RequestField
          label="Location"
          value={[cleanValue(request.district), cleanValue(request.state)]
            .filter(Boolean)
            .join(", ")}
          icon={<MapPin size={14} />}
        />
        <div className="sm:col-span-2 lg:col-span-3">
          <RequestField label="Shop address" value={request.address} />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Clock3 size={14} />
          Submitted {formatDate(request.createdAt)}
        </div>
      </div>
    </article>
  );
}

function RequestField({ label, value, icon }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 flex items-start gap-1.5 break-words text-sm text-slate-800">
        {icon && <span className="mt-0.5 shrink-0 text-slate-500">{icon}</span>}
        {displayValue(value)}
      </p>
    </div>
  );
}

function formatDate(value) {
  const date = new Date(value);

  if (!value || Number.isNaN(date.getTime())) {
    return "date unavailable";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DealerRequestsPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingKey, setProcessingKey] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState(null);

  const loadRequests = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const snapshot = await get(ref(database, "dealerRequests"));
      setRequests(getPendingRequests(snapshot.exists() ? snapshot.val() : null));

      if (isRefresh) {
        setMessage({
          type: "success",
          text: "Dealer requests refreshed.",
        });
      }
    } catch (error) {
      console.error("Error loading dealer requests:", error);
      setMessage({
        type: "error",
        text: "Unable to load dealer requests. Check your connection and try again.",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  async function approveRequest(request) {
    const requestKey = request.requestKey;
    const uid = cleanValue(request.uid) || requestKey;

    if (!requestKey || !uid) {
      setMessage({
        type: "error",
        text: "This dealer request is missing its account identifier and cannot be accepted.",
      });
      return;
    }

    setProcessingKey(requestKey);
    setMessage(null);

    try {
      const existingUser = await get(ref(database, `users/${uid}`));
      if (
        existingUser.exists() &&
        normalize(existingUser.val()?.role) !== "dealer"
      ) {
        throw new Error(
          "An account with this identifier already exists and is not a dealer."
        );
      }

      const approvedAt = new Date().toISOString();
      const profile = { ...request };
      delete profile.requestKey;

      await update(ref(database), {
        [`users/${uid}`]: {
          ...profile,
          uid,
          role: "dealer",
          status: "approved",
          approvedAt,
        },
        [`dealerRequests/${requestKey}/status`]: "approved",
        [`dealerRequests/${requestKey}/approvedAt`]: approvedAt,
      });

      setRequests((current) =>
        current.filter((item) => item.requestKey !== requestKey)
      );
      setMessage({
        type: "success",
        text: `${cleanValue(request.dealerName) || "Dealer"} has been approved.`,
      });
    } catch (error) {
      console.error("Error accepting dealer request:", error);
      setMessage({
        type: "error",
        text: error.message || "Unable to accept this dealer request.",
      });
    } finally {
      setProcessingKey("");
    }
  }

  const filteredRequests = useMemo(() => {
    const keyword = normalize(search);

    if (!keyword) {
      return requests;
    }

    return requests.filter((request) =>
      [
        request.dealerName,
        request.shopName,
        request.ownerName,
        request.email,
        request.phone,
        request.licenseNumber,
        request.gstNumber,
        request.district,
        request.state,
        request.address,
      ]
        .map(normalize)
        .join(" ")
        .includes(keyword)
    );
  }, [requests, search]);

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <StatusMessage
          message={message}
          onClose={() => setMessage(null)}
        />

        <header className="mb-6 rounded-3xl bg-gradient-to-r from-slate-950 via-indigo-950 to-indigo-800 p-6 text-white shadow-xl md:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-300">
                Admin module
              </p>
              <h1 className="mt-1 text-3xl font-bold md:text-4xl">
                Dealer Requests
              </h1>
              <p className="mt-2 text-indigo-100">
                Review submitted dealer profiles and accept eligible requests.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate("/admin")}
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 font-semibold transition hover:bg-white/20"
              >
                <ArrowLeft size={18} />
                Admin dashboard
              </button>
              <button
                type="button"
                onClick={() => loadRequests(true)}
                disabled={refreshing || loading}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 font-semibold text-indigo-900 transition hover:bg-indigo-50 disabled:opacity-60"
              >
                <RefreshCw
                  size={18}
                  className={refreshing ? "animate-spin" : ""}
                />
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-sm text-indigo-100">
            <Clock3 size={15} />
            {requests.length} pending{" "}
            {requests.length === 1 ? "request" : "requests"}
          </div>
        </header>

        <section className="mb-5 rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
          <label className="relative block">
            <Search
              size={19}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search dealer, shop, email, phone, license or location..."
              className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
        </section>

        {loading ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <RefreshCw
              size={26}
              className="mx-auto animate-spin text-indigo-700"
            />
            <p className="mt-3 font-semibold text-slate-700">
              Loading dealer requests...
            </p>
          </section>
        ) : filteredRequests.length === 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <Store size={26} />
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900">
              {requests.length === 0
                ? "No pending dealer requests"
                : "No matching dealer requests"}
            </h2>
            <p className="mt-2 text-slate-600">
              {requests.length === 0
                ? "New dealer registration profiles will appear here for review."
                : "Try a different search term."}
            </p>
          </section>
        ) : (
          <section className="space-y-4">
            {filteredRequests.map((request) => (
              <DealerRequestCard
                key={request.requestKey}
                request={request}
                processing={processingKey === request.requestKey}
                onApprove={approveRequest}
              />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
