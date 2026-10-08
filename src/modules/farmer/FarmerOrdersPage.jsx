import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  equalTo,
  get,
  onValue,
  orderByChild,
  query,
  ref,
  update,
} from "firebase/database";

import { auth, database } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";

const FILTERS = [
  { value: "active", label: "Active" },
  { value: "history", label: "Order History" },
];

const ACTIVE_STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "delivered_by_dealer",
  "received_by_farmer",
];

function isPaidOrder(order) {
  const status = String(order.status || order.orderStatus || "")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_");

  return (
    ["payment_received", "completed", "complete", "paid", "payment_completed"].includes(status) ||
    order.dealerPaymentReceived === true ||
    order.paymentStatus === "paid" ||
    order.paymentStatus === "completed"
  );
}

function isHistoryOrder(order) {
  const status = String(order.status || order.orderStatus || "")
    .trim()
    .toLowerCase();
  const normalizedStatus = status.replaceAll(" ", "_");

  return (
    isPaidOrder(order) ||
    order.farmerArchived === true ||
    ["completed", "complete"].includes(normalizedStatus)
  );
}

function isEligibleHistoryOrder(order) {
  const status = String(order.status || order.orderStatus || "")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_");

  return (
    isPaidOrder(order) ||
    ["rejected", "reject"].includes(status)
  );
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
}

function formatDate(value) {
  if (!value) {
    return "Date unavailable";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getStatusDetails(status) {
  const statuses = {
    pending: {
      icon: "⏳",
      label: "Waiting for Dealer",
      className: "bg-yellow-100 text-yellow-800",
      progress: 15,
      message: "The dealer has not responded yet.",
    },

    accepted: {
      icon: "✅",
      label: "Dealer Accepted",
      className: "bg-blue-100 text-blue-800",
      progress: 40,
      message: "The dealer accepted your order. Confirm after the products have physically arrived.",
    },

    delivered_by_dealer: {
      icon: "🚚",
      label: "Marked Delivered",
      className: "bg-purple-100 text-purple-800",
      progress: 70,
      message: "Confirm only after receiving the product.",
    },

    received_by_farmer: {
      icon: "📦",
      label: "Order Received",
      className: "bg-indigo-100 text-indigo-800",
      progress: 85,
      message: "You confirmed receipt. Waiting for the dealer to mark delivery.",
    },

    payment_received: {
      icon: "💵",
      label: "Payment Confirmed",
      className: "bg-orange-100 text-orange-800",
      progress: 95,
      message: "The order is almost complete.",
    },

    completed: {
      icon: "🎉",
      label: "Completed",
      className: "bg-green-100 text-green-800",
      progress: 100,
      message: "The order was completed successfully.",
    },

    rejected: {
      icon: "❌",
      label: "Rejected",
      className: "bg-red-100 text-red-800",
      progress: 0,
      message: "The dealer could not accept this request.",
    },

  };

  return (
    statuses[status] || {
      icon: "ℹ️",
      label: "Order Update",
      className: "bg-gray-100 text-gray-700",
      progress: 0,
      message: "Check the latest order information.",
    }
  );
}

export default function FarmerOrdersPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [orders, setOrders] = useState([]);
  const selectedFilter = FILTERS.some(
    (filter) => filter.value === searchParams.get("filter")
  )
    ? searchParams.get("filter")
    : "active";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("completed");
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [deleteConfirmation, setDeleteConfirmation] = useState(false);
  const [message, setMessage] = useState(null);
  const knownPaidOrderIds = useRef(new Set());
  const knownHistoryOrderIds = useRef(new Set());
  const longPressTimer = useRef(null);
  const suppressOrderClick = useRef(false);

  function showPaymentCompletedNotice(uid, order) {
    const storageKey = `farmerPaymentNoticeOrderIds_${uid}`;
    let shownOrderIds = [];

    try {
      shownOrderIds = JSON.parse(localStorage.getItem(storageKey) || "[]");
    } catch {
      shownOrderIds = [];
    }

    if (shownOrderIds.includes(order.id)) {
      return;
    }

    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify([...shownOrderIds, order.id].slice(-100))
      );
    } catch {
      // The notice can still be shown when browser storage is unavailable.
    }

    showMessage(
      "success",
      `Payment completed for ${order.productName || "your order"}. It is now in Order History.`
    );
  }

  const currentOrders = useMemo(
    () =>
      orders.filter((order) => !isHistoryOrder(order)),
    [orders]
  );

  const paidOrders = useMemo(
    () => orders.filter(isPaidOrder),
    [orders]
  );

  const historyOrders = useMemo(
    () => orders.filter((order) => isHistoryOrder(order) && !order.farmerArchived),
    [orders]
  );

  useEffect(() => {
    let unsubscribeOrders = () => {};
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribeOrders();

      if (!user) {
        navigate("/login", {
          replace: true,
        });

        return;
      }

      await loadOrders(user.uid);

      if (!active) {
        return;
      }

      const ordersQuery = query(
        ref(database, "dealerOrders"),
        orderByChild("farmerUid"),
        equalTo(user.uid)
      );

      unsubscribeOrders = onValue(
        ordersQuery,
        (snapshot) => {
          const orderList = snapshot.exists()
            ? Object.entries(snapshot.val())
                .map(([id, value]) => ({ id, ...value }))
                .sort(
                  (first, second) =>
                    new Date(second.updatedAt || second.createdAt || 0) -
                    new Date(first.updatedAt || first.createdAt || 0)
                )
            : [];

          const paidOrderIds = new Set(
            orderList.filter(isPaidOrder).map((order) => order.id)
          );
          const newlyPaidOrder = orderList.find(
            (order) =>
              isPaidOrder(order) &&
              !knownPaidOrderIds.current.has(order.id)
          );
          const historyOnlyStatuses = ["completed", "complete"];
          const newlyMovedToHistory = orderList.find(
            (order) =>
              historyOnlyStatuses.includes(
                String(order.status || order.orderStatus || "").trim().toLowerCase().replaceAll(" ", "_")
              ) &&
              !knownHistoryOrderIds.current.has(order.id)
          );

          knownPaidOrderIds.current = paidOrderIds;
          knownHistoryOrderIds.current = new Set(
            orderList.filter(isHistoryOrder).map((order) => order.id)
          );
          setOrders(orderList);

          if (newlyPaidOrder) {
            showPaymentCompletedNotice(user.uid, newlyPaidOrder);
          } else if (newlyMovedToHistory) {
            const historyStatus = String(
              newlyMovedToHistory.status || newlyMovedToHistory.orderStatus || ""
            )
              .trim()
              .toLowerCase()
              .replaceAll(" ", "_");
            const statusMessage = {
              completed: "The completed order is now in Order History.",
              complete: "The completed order is now in Order History.",
            }[historyStatus];
            showMessage("info", statusMessage || "The order is now in Order History.");
          }
        },
        (error) => {
          console.error("Farmer order updates error:", error);
        }
      );
    });

    return () => {
      active = false;
      unsubscribe();
      unsubscribeOrders();
    };
  }, [navigate]);

  useEffect(() => {
    if (selectedFilter !== "history") {
      clearTimeout(longPressTimer.current);
      setSelectionMode(false);
      setSelectedOrderIds([]);
      setDeleteConfirmation(false);
    }
  }, [selectedFilter]);

  useEffect(() => () => clearTimeout(longPressTimer.current), []);

  const filteredOrders = useMemo(() => {
    if (selectedFilter === "history") {
      return historyOrders.filter((order) => {
        const status = String(order.status || order.orderStatus || "")
          .trim().toLowerCase().replaceAll(" ", "_");
        const statusMatches = (historyStatusFilter === "completed" && isPaidOrder(order)) ||
          (historyStatusFilter === "rejected" && ["rejected", "reject"].includes(status));
        const dateValue = order.completedAt || order.paymentReceivedAt || order.updatedAt || order.createdAt;
        const timestamp = dateValue ? new Date(dateValue).getTime() : NaN;
        const start = historyStartDate ? new Date(`${historyStartDate}T00:00:00`).getTime() : -Infinity;
        const end = historyEndDate ? new Date(`${historyEndDate}T23:59:59.999`).getTime() : Infinity;
        const dateMatches = !historyStartDate && !historyEndDate
          ? true
          : Number.isFinite(timestamp) && timestamp >= start && timestamp <= end;
        return !order.farmerArchived && statusMatches && dateMatches;
      });
    }

    if (selectedFilter === "active") {
      return currentOrders.filter((order) =>
        ACTIVE_STATUSES.includes(order.status)
      );
    }

    if (selectedFilter === "history") {
      return historyOrders;
    }

    return currentOrders;
  }, [currentOrders, historyOrders, selectedFilter, historyStatusFilter, historyStartDate, historyEndDate]);

  const counts = useMemo(
    () => ({
      active: currentOrders.filter((order) =>
        ACTIVE_STATUSES.includes(order.status)
      ).length,
      history: historyOrders.length,
    }),
    [currentOrders, historyOrders]
  );

  function showMessage(type, text) {
    setMessage({ type, text });

    window.setTimeout(() => {
      setMessage(null);
    }, 5000);
  }

  async function loadOrders(uid, isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const profileSnapshot = await get(
        ref(database, `users/${uid}`)
      );

      if (
        !profileSnapshot.exists() ||
        profileSnapshot.val().role !== "farmer"
      ) {
        navigate("/role-selection", {
          replace: true,
        });

        return;
      }

      const ordersQuery = query(
        ref(database, "dealerOrders"),
        orderByChild("farmerUid"),
        equalTo(uid)
      );

      const snapshot = await get(ordersQuery);

      if (!snapshot.exists()) {
        setOrders([]);
        knownPaidOrderIds.current = new Set();
        knownHistoryOrderIds.current = new Set();
        return;
      }

      const orderList = Object.entries(snapshot.val())
        .map(([id, value]) => ({
          id,
          ...value,
        }))
        .sort(
          (first, second) =>
            new Date(
              second.updatedAt ||
                second.createdAt ||
                0
            ) -
            new Date(
              first.updatedAt ||
                first.createdAt ||
                0
            )
        );

      setOrders(orderList);
      knownPaidOrderIds.current = new Set(
        orderList.filter(isPaidOrder).map((order) => order.id)
      );
      knownHistoryOrderIds.current = new Set(
        orderList.filter(isHistoryOrder).map((order) => order.id)
      );

      const latestPaidOrder = orderList.find((order) => {
        if (!isPaidOrder(order)) {
          return false;
        }

        const paidAt = new Date(
          order.paymentReceivedAt ||
            order.dealerPaymentReceivedAt ||
            order.completedAt ||
            order.updatedAt ||
            0
        ).getTime();

        return Number.isFinite(paidAt) && Date.now() - paidAt < 24 * 60 * 60 * 1000;
      });

      if (latestPaidOrder) {
        showPaymentCompletedNotice(uid, latestPaidOrder);
      }
    } catch (error) {
      console.error("Farmer orders error:", error);

      showMessage(
        "error",
        String(error?.message || "")
          .toLowerCase()
          .includes("permission denied")
          ? "Order access is blocked by Firebase rules."
          : "Your orders could not be loaded."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function refreshOrders() {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      navigate("/login", {
        replace: true,
      });

      return;
    }

    await loadOrders(currentUser.uid, true);
  }

  function changeFilter(filter) {
    clearTimeout(longPressTimer.current);
    setSelectionMode(false);
    setSelectedOrderIds([]);
    setExpandedOrderId("");
    navigate(
      filter === "active" ? "/farmer/orders" : `/farmer/orders?filter=${filter}`,
      { replace: true }
    );
  }

  function toggleOrderSelection(order) {
    if (!isEligibleHistoryOrder(order)) {
      return;
    }

    setSelectionMode(true);
    setSelectedOrderIds((currentIds) =>
      currentIds.includes(order.id)
        ? currentIds.filter((id) => id !== order.id)
        : [...currentIds, order.id]
    );
  }

  function startOrderLongPress(order) {
    if (selectedFilter !== "history" || !isEligibleHistoryOrder(order)) {
      return;
    }

    clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      suppressOrderClick.current = true;
      setSelectionMode(true);
      setSelectedOrderIds((currentIds) =>
        currentIds.includes(order.id) ? currentIds : [...currentIds, order.id]
      );
    }, 600);
  }

  function stopOrderLongPress() {
    clearTimeout(longPressTimer.current);
  }

  function handleOrderCardClick(order, event) {
    if (suppressOrderClick.current) {
      suppressOrderClick.current = false;
      event.preventDefault();
      return;
    }

    if (selectionMode && !event.target.closest?.("button, a, input, select, textarea")) {
      toggleOrderSelection(order);
    }
  }

  async function hideSelectedHistoryOrders() {
    const currentUser = auth.currentUser;
    const selectedOrders = filteredOrders.filter(
      (order) =>
        selectedOrderIds.includes(order.id) &&
        isEligibleHistoryOrder(order)
    );

    if (!currentUser || selectedOrders.length === 0) {
      setDeleteConfirmation(false);
      return;
    }

    if (selectedOrders.some((order) => order.farmerUid !== currentUser.uid)) {
      showMessage("error", "You can only delete orders from your own history.");
      return;
    }

    try {
      setUpdatingId("archiving-history");
      const results = await Promise.allSettled(
        selectedOrders.map((order) =>
          update(ref(database, `dealerOrders/${order.id}`), {
            farmerArchived: true,
          })
        )
      );
      const archivedIds = new Set(
        results.flatMap((result, index) =>
          result.status === "fulfilled" ? [selectedOrders[index].id] : []
        )
      );
      const failedIds = selectedOrders
        .filter((order) => !archivedIds.has(order.id))
        .map((order) => order.id);

      if (archivedIds.size > 0) {
        setOrders((currentOrders) => currentOrders.map((order) =>
          archivedIds.has(order.id)
            ? { ...order, farmerArchived: true }
            : order
        ));
        setExpandedOrderId((currentId) =>
          archivedIds.has(currentId) ? "" : currentId
        );
      }

      setSelectedOrderIds(failedIds);
      setSelectionMode(failedIds.length > 0);
      setDeleteConfirmation(false);
      if (failedIds.length > 0) {
        console.error(
          "Farmer order hiding failed for selected order IDs:",
          failedIds
        );
        showMessage(
          "error",
          archivedIds.size > 0
          ? `${archivedIds.size} order${archivedIds.size === 1 ? "" : "s"} deleted. ${failedIds.length} could not be deleted.`
            : "The selected orders could not be deleted. Check database permissions and try again."
        );
      } else {
        showMessage(
          "success",
          selectedOrders.length === 1
            ? "Order deleted from your history."
            : "Orders deleted from your history."
        );
      }
    } catch (error) {
      console.error("Delete history orders error:", error);
      showMessage("error", "The selected orders could not be deleted from your history.");
    } finally {
      setUpdatingId("");
    }
  }

  function cancelSelection() {
    clearTimeout(longPressTimer.current);
    setSelectionMode(false);
    setSelectedOrderIds([]);
    setDeleteConfirmation(false);
  }

  const selectableVisibleOrderIds = filteredOrders
    .filter(isEligibleHistoryOrder)
    .map((order) => order.id);
  const allVisibleOrdersSelected =
    selectableVisibleOrderIds.length > 0 &&
    selectableVisibleOrderIds.every((id) => selectedOrderIds.includes(id));

  function toggleSelectAll() {
    setSelectionMode(true);
    setSelectedOrderIds((currentIds) => {
      if (allVisibleOrdersSelected) {
        return currentIds.filter((id) => !selectableVisibleOrderIds.includes(id));
      }
      return [...new Set([...currentIds, ...selectableVisibleOrderIds])];
    });
  }

  async function confirmProductReceived(order) {
    if (!["accepted", "delivered_by_dealer"].includes(order.status) || order.farmerReceived) {
      showMessage(
        "warning",
        "Only accepted orders can be confirmed as received."
      );

      setConfirmation(null);
      return;
    }

    try {
      setUpdatingId(order.id);

      const now = new Date().toISOString();

      await update(
        ref(database, `dealerOrders/${order.id}`),
        {
          farmerReceived: true,
          farmerReceivedAt: now,
          status: "received_by_farmer",
          updatedAt: now,
        }
      );

      setConfirmation(null);

      showMessage(
        "success",
        "Product receipt was confirmed."
      );

      await refreshOrders();
    } catch (error) {
      console.error(
        "Product receipt confirmation error:",
        error
      );

      const errorCode = String(error?.code || "").toLowerCase();
      const errorText = String(error?.message || "").toLowerCase();
      const permissionDenied =
        errorCode.includes("permission_denied") ||
        errorText.includes("permission denied");
      const validationFailed =
        errorCode.includes("invalid") ||
        errorText.includes("validation");

      showMessage(
        "error",
        permissionDenied
          ? "Firebase blocked this update. Its database rules must let the signed-in farmer update receipt fields on their own order."
          : validationFailed
            ? "Firebase rejected the receipt fields. Check the dealerOrders validation rules for farmerReceived, farmerReceivedAt, status, and updatedAt."
            : "The order update failed. Check your connection and try again."
      );
    } finally {
      setUpdatingId("");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto rounded-full border-4 border-green-200 border-t-green-700 animate-spin" />

          <p className="font-semibold text-green-800 mt-4">
            Loading your orders...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-50">
      <main className="w-full px-4 sm:px-6 lg:px-10">
        <StatusMessage
          message={message}
          onClose={() => setMessage(null)}
        />

        <header className="bg-gradient-to-br from-green-800 to-green-600 text-white rounded-b-3xl px-4 pt-5 pb-6 shadow-lg">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center"
              aria-label="Back to dashboard"
            >
              ←
            </button>

            <button
              type="button"
              disabled={refreshing}
              onClick={refreshOrders}
              className="bg-white/15 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="mt-5">
            <p className="text-green-100 text-sm">
              Farmer purchases
            </p>

            <h1 className="text-3xl font-bold mt-1">
              🛒 My Orders
            </h1>

            <p className="text-green-100 text-sm mt-2">
              Track requested orders or review completed orders.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-5">
            <div className="bg-white/15 rounded-xl p-3 text-center">
              <p className="text-xl font-bold">
                {counts.active}
              </p>
              <p className="text-xs text-green-100 mt-1">
                Active
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/farmer/orders?filter=history")}
              className="bg-white/20 rounded-xl p-3 text-center hover:bg-white/30"
            >
              <p className="text-xl font-bold">{historyOrders.length}</p>
              <p className="text-xs text-green-100 mt-1">
                History
              </p>
            </button>
          </div>
        </header>

        <div className="px-4">
          {paidOrders.length > 0 && (
            <section className="bg-green-50 border border-green-200 rounded-2xl p-4 mt-5">
              <p className="font-bold text-green-900">
                ✅ Payment completed
              </p>
              <p className="text-sm text-green-800 mt-1">
                {paidOrders.length} paid {paidOrders.length === 1 ? "order is" : "orders are"} stored in your history. They no longer appear in My Orders.
              </p>
              <button
                type="button"
                onClick={() => navigate("/farmer/orders?filter=history")}
                className="mt-3 bg-green-700 text-white px-4 py-2 rounded-xl font-semibold"
              >
                View Order History
              </button>
            </section>
          )}

          <section className="flex gap-2 overflow-x-auto py-5">
            {FILTERS.map((filter) => (
              <button
                type="button"
                key={filter.value}
                onClick={() => changeFilter(filter.value)}
                aria-pressed={selectedFilter === filter.value}
                className={`shrink-0 min-h-11 px-4 rounded-full text-sm font-semibold ${
                  selectedFilter === filter.value
                    ? "bg-green-700 text-white"
                    : "bg-white border border-green-200 text-green-800"
                }`}
              >
                {filter.label} ({counts[filter.value]})
              </button>
            ))}
          </section>

          {selectedFilter === "history" && (
            <section className="mb-5 grid grid-cols-1 gap-3 rounded-2xl border border-green-100 bg-white p-4 shadow-sm sm:grid-cols-3">
              <label className="text-sm font-semibold text-gray-700">
                History status
                <select value={historyStatusFilter} onChange={(event) => { cancelSelection(); setHistoryStatusFilter(event.target.value); }} className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 font-normal">
                  <option value="completed">Completed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>
              <label className="text-sm font-semibold text-gray-700">
                From date
                <input type="date" value={historyStartDate} max={historyEndDate || undefined} onChange={(event) => { cancelSelection(); setHistoryStartDate(event.target.value); }} className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal" />
              </label>
              <label className="text-sm font-semibold text-gray-700">
                To date
                <input type="date" value={historyEndDate} min={historyStartDate || undefined} onChange={(event) => { cancelSelection(); setHistoryEndDate(event.target.value); }} className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal" />
              </label>
            </section>
          )}

          {selectedFilter === "history" && selectionMode && (
            <section className="sticky top-2 z-20 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-green-200 bg-white p-3 shadow-lg">
              <button
                type="button"
                onClick={cancelSelection}
                className="min-h-11 rounded-xl px-3 font-semibold text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <span className="font-bold text-green-900">
                {selectedOrderIds.length} Selected
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  disabled={selectableVisibleOrderIds.length === 0}
                  className="min-h-11 rounded-xl border border-green-200 px-3 font-semibold text-green-800 disabled:opacity-50"
                >
                  {allVisibleOrdersSelected ? "Deselect All" : "Select All"}
                </button>
                {selectedOrderIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmation(true)}
                    disabled={Boolean(updatingId)}
                    className="min-h-11 rounded-xl bg-red-600 px-4 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Delete Selected
                  </button>
                )}
              </div>
            </section>
          )}

          {deleteConfirmation && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="farmer-delete-history-title"
                className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
              >
                <h2 id="farmer-delete-history-title" className="text-xl font-bold text-gray-900">
                  {selectedOrderIds.length === 1
                    ? "Delete this order from history?"
                    : `Delete ${selectedOrderIds.length} selected orders?`}
                </h2>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    disabled={Boolean(updatingId)}
                    onClick={() => setDeleteConfirmation(false)}
                    className="min-h-11 rounded-xl border border-gray-300 px-4 font-semibold text-gray-700 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(updatingId)}
                    onClick={hideSelectedHistoryOrders}
                    className="min-h-11 rounded-xl bg-red-600 px-4 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {updatingId === "archiving-history" ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </section>
            </div>
          )}

          {filteredOrders.length === 0 ? (
            <section className="bg-white rounded-2xl shadow-sm p-8 text-center">
              <div className="text-6xl">📦</div>

              <h2 className="text-xl font-bold text-green-900 mt-4">
                No orders found
              </h2>

              <p className="text-gray-600 text-sm mt-2">
                {selectedFilter === "history"
                  ? "Completed and rejected orders will appear here."
                  : "Your current orders will appear here."}
              </p>
              {selectedFilter === "active" && <button
                type="button"
                onClick={() => navigate("/farmer/dealer-products")}
                className="w-full bg-green-700 text-white min-h-12 rounded-xl font-semibold mt-5"
              >
                Browse Products
              </button>}
            </section>
          ) : (
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 items-start">
              {filteredOrders.map((order) => {
                const status = getStatusDetails(order.status);
                const updating = updatingId === order.id;
                const selectable = isEligibleHistoryOrder(order);
                const selected = selectedOrderIds.includes(order.id);

                return (
                  <article
                    key={order.id}
                    onClickCapture={(event) => {
                      if (suppressOrderClick.current) {
                        suppressOrderClick.current = false;
                        event.preventDefault();
                        event.stopPropagation();
                      }
                    }}
                    onClick={(event) => handleOrderCardClick(order, event)}
                    onMouseDown={() => startOrderLongPress(order)}
                    onMouseUp={stopOrderLongPress}
                    onMouseLeave={stopOrderLongPress}
                    onTouchStart={() => startOrderLongPress(order)}
                    onTouchEnd={stopOrderLongPress}
                    onTouchMove={stopOrderLongPress}
                    onContextMenu={(event) => {
                      if (selectedFilter === "history" && selectable) {
                        event.preventDefault();
                        setSelectionMode(true);
                        setSelectedOrderIds((currentIds) =>
                          currentIds.includes(order.id) ? currentIds : [...currentIds, order.id]
                        );
                      }
                    }}
                    className={`relative select-none touch-manipulation rounded-2xl border shadow-sm overflow-hidden transition ${
                      selected
                        ? "border-green-600 bg-green-50 ring-2 ring-green-300"
                        : "border-green-100 bg-white"
                    } ${selectable && selectedFilter === "history" ? "cursor-pointer" : ""}`}
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="flex items-center gap-2 text-lg font-bold text-green-900 truncate">
                            {selected && <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-700 text-sm text-white">✓</span>}
                            {order.productName || "Farm Product"}
                          </h2>

                          <p className="text-sm text-gray-500 mt-1 truncate">
                            🏪 {order.dealerName || "Dealer"}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            Ordered {formatDate(order.createdAt)}
                          </p>
                        </div>

                        <span className={`${status.className} shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold`}>
                          {status.icon} {status.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="bg-green-50 rounded-xl p-3">
                          <p className="text-xs text-gray-500">
                            Quantity
                          </p>

                          <p className="font-bold text-green-900 mt-1">
                            {order.quantity || 0}{" "}
                            {order.unit || "units"}
                          </p>
                        </div>

                        <div className="bg-blue-50 rounded-xl p-3">
                          <p className="text-xs text-gray-500">
                            Total Amount
                          </p>

                          <p className="font-bold text-blue-900 mt-1">
                            {formatMoney(order.totalAmount)}
                          </p>
                        </div>
                      </div>

                      {["accepted", "delivered_by_dealer"].includes(order.status) && !order.farmerReceived && (
                        <button
                          type="button"
                          disabled={updating}
                          onClick={() => confirmProductReceived(order)}
                          className="w-full sm:w-auto px-4 py-2.5 text-sm bg-green-700 text-white rounded-xl font-semibold mt-4 disabled:bg-gray-400"
                        >
                          {updating ? "Please wait..." : "📦 Confirm Order Received"}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setExpandedOrderId((current) => current === order.id ? "" : order.id)}
                        className="mt-3 text-sm font-semibold text-green-700 underline underline-offset-2"
                      >
                          {expandedOrderId === order.id ? "Hide Details" : "View Order Details"}
                      </button>

                      {expandedOrderId === order.id && <div className="mt-3">
                      <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
                        <p className="flex justify-between"><span>Product/Subtotal</span><strong>{formatMoney(order.subtotalAmount ?? (Number(order.price || 0) * Number(order.quantity || 0)))}</strong></p>
                        {order.deliveryCharge !== undefined && <p className="flex justify-between"><span>Delivery Charges</span><strong>{formatMoney(order.deliveryCharge)}</strong></p>}
                        <p className="flex justify-between border-t pt-1"><span>Total Amount</span><strong>{formatMoney(order.totalAmount)}</strong></p>
                      </div>
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-gray-500 mb-2">
                          <span>Order progress</span>
                          <span>{status.progress}%</span>
                        </div>

                        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-600 rounded-full"
                            style={{
                              width: `${status.progress}%`,
                            }}
                          />
                        </div>

                        <p className="text-sm text-gray-600 mt-2">
                          {status.message}
                        </p>
                      </div>

                      <div className="bg-gray-50 rounded-xl p-3 mt-4">
                        <p className="text-xs text-gray-500">
                          Ordered on
                        </p>

                        <p className="text-sm font-semibold mt-1">
                          {formatDate(order.createdAt)}
                        </p>
                      </div>

                      {order.deliveryAddress && (
                        <div className="bg-gray-50 rounded-xl p-3 mt-3">
                          <p className="text-xs text-gray-500">
                            Delivery address
                          </p>

                          <p className="text-sm font-semibold mt-1">
                            {order.deliveryAddress}
                          </p>
                        </div>
                      )}

                      <div className="space-y-3 mt-4">
                        {order.dealerPhone &&
                          ![
                            "rejected",
                            "completed",
                          ].includes(order.status) && (
                            <a
                              href={`tel:${order.dealerPhone}`}
                            className="w-full sm:w-auto px-4 py-2.5 text-sm border border-blue-200 bg-blue-50 text-blue-700 rounded-xl font-semibold flex items-center justify-center"
                            >
                              📞 Call Dealer
                            </a>
                          )}

                        {order.status === "completed" && (
                          <div className="bg-green-50 text-green-700 px-4 py-2.5 text-sm rounded-xl font-bold flex items-center justify-center">
                            ✅ Order Completed
                          </div>
                        )}

                        {order.status === "rejected" && (
                          <div className="bg-red-50 text-red-700 px-4 py-2.5 text-sm rounded-xl font-bold flex items-center justify-center">
                            ❌ Rejected by Dealer
                          </div>
                        )}

                      </div>
                      </div>}
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </div>

      </main>
    </div>
  );
}
