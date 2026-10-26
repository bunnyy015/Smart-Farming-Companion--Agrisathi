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
  runTransaction,
  serverTimestamp,
  update,
} from "firebase/database";

import { auth, database } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";
import OrderAcceptanceTimer from "../../components/OrderAcceptanceTimer";
import { expirePendingOrders, getOrderAcceptanceDeadline } from "../../utils/orderAcceptanceTimer";
import { sortOrdersNewestFirst } from "../../utils/orderSorting";

const FILTERS = [
  { value: "active", label: "Active Orders" },
  { value: "accepted", label: "Accepted Orders" },
  { value: "history", label: "Order History" },
];

const ACCEPTED_STATUSES = [
  "accepted",
  "delivered_by_dealer",
  "received_by_farmer",
  "payment_pending",
  "payment_received",
];

const TERMINAL_STATUSES = ["completed", "complete", "rejected", "reject", "cancelled", "canceled", "expired"];
const HISTORY_STATUS_FILTERS = [
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
];

function isPaidOrder(order) {
  const status = String(order.status || order.orderStatus || "")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_");

  return (
    ["completed", "complete", "paid", "payment_completed"].includes(status) ||
    order.dealerPaymentReceived === true ||
    order.paymentStatus === "paid" ||
    order.paymentStatus === "completed"
  );
}

function getNormalizedOrderStatus(order) {
  return String(order?.status || order?.orderStatus || "pending")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_");
}

function isHistoryOrder(order) {
  const status = String(order.status || order.orderStatus || "")
    .trim()
    .toLowerCase();
  const normalizedStatus = status.replaceAll(" ", "_");

  return (
    isPaidOrder(order) ||
    order.farmerArchived === true ||
    TERMINAL_STATUSES.includes(normalizedStatus)
  );
}

function isEligibleHistoryOrder(order) {
  const status = String(order.status || order.orderStatus || "")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_");

  return (
    isPaidOrder(order) ||
    TERMINAL_STATUSES.includes(status)
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

function getHistoryStatus(order) {
  const status = getNormalizedOrderStatus(order);
  if (order.cancellationReason === "dealer_acceptance_timeout" || status === "expired") return "expired";
  if (["cancelled", "canceled"].includes(status)) return "cancelled";
  if (["rejected", "reject"].includes(status)) return "rejected";
  if (isPaidOrder(order)) return "completed";
  return "";
}

function matchesHistoryDateRange(order, startDate, endDate) {
  const dateValue = getHistoryStatus(order) === "completed"
    ? order.completedAt || order.paymentReceivedAt || order.updatedAt || order.createdAt
    : order.updatedAt || order.cancelledAt || order.rejectedAt || order.createdAt;
  const timestamp = dateValue ? new Date(dateValue).getTime() : NaN;
  const start = startDate ? new Date(`${startDate}T00:00:00`).getTime() : -Infinity;
  const end = endDate ? new Date(`${endDate}T23:59:59.999`).getTime() : Infinity;
  return !startDate && !endDate
    ? true
    : Number.isFinite(timestamp) && timestamp >= start && timestamp <= end;
}

function InfoCard({ label, value }) {
  return (
    <div className="rounded-xl border border-green-100 bg-green-50/60 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 break-words font-semibold text-green-950">{value || "Not available"}</p>
    </div>
  );
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
      message: "The dealer accepted your reservation. Collect the products from the shop, then confirm collection.",
    },

    delivered_by_dealer: {
      icon: "🏪",
      label: "Ready for pickup",
      className: "bg-purple-100 text-purple-800",
      progress: 70,
      message: "Your reserved products are ready for collection at the dealer shop.",
    },

    received_by_farmer: {
      icon: "📦",
      label: "Order Received",
      className: "bg-indigo-100 text-indigo-800",
      progress: 85,
      message: "You confirmed collection. Waiting for the dealer to complete the order.",
    },

    payment_pending: {
      icon: "💳",
      label: "Payment pending",
      className: "bg-orange-100 text-orange-800",
      progress: 90,
      message: "Collection is confirmed. The dealer is completing the payment step.",
    },

    payment_received: {
      icon: "💵",
      label: "Payment received",
      className: "bg-orange-100 text-orange-800",
      progress: 95,
      message: "Payment was recorded. The dealer will complete the order.",
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

    reject: {
      icon: "❌",
      label: "Rejected",
      className: "bg-red-100 text-red-800",
      progress: 0,
      message: "The dealer could not accept this request.",
    },

    cancelled: {
      icon: "✖",
      label: "Cancelled",
      className: "bg-gray-100 text-gray-800",
      progress: 0,
      message: "This reservation was cancelled.",
    },

    canceled: {
      icon: "✖",
      label: "Cancelled",
      className: "bg-gray-100 text-gray-800",
      progress: 0,
      message: "This reservation was cancelled.",
    },

    expired: {
      icon: "⌛",
      label: "Expired",
      className: "bg-gray-100 text-gray-800",
      progress: 0,
      message: "The dealer did not accept this reservation before the 24-hour deadline.",
    },

    complete: {
      icon: "🎉",
      label: "Completed",
      className: "bg-green-100 text-green-800",
      progress: 100,
      message: "The order was completed successfully.",
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
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [cancellationOrder, setCancellationOrder] = useState(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancellationNote, setCancellationNote] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("completed");
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [deleteConfirmation, setDeleteConfirmation] = useState(false);
  const [message, setMessage] = useState(null);
  const knownPaidOrderIds = useRef(new Set());
  const knownHistoryOrderIds = useRef(new Set());
  const shownTimeoutOrderIds = useRef(new Set());
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

  function showTimeoutNotice(uid, order) {
    if (order.cancellationReason !== "dealer_acceptance_timeout") return;
    const storageKey = `farmerOrderTimeoutNoticeIds_${uid}`;
    let shownIds = [];
    try {
      shownIds = JSON.parse(localStorage.getItem(storageKey) || "[]");
    } catch {
      shownIds = [];
    }
    if (shownIds.includes(order.id) || shownTimeoutOrderIds.current.has(order.id)) return;
    shownTimeoutOrderIds.current.add(order.id);
    try {
      localStorage.setItem(storageKey, JSON.stringify([...shownIds, order.id].slice(-100)));
    } catch {
      // Show the in-app notice even when storage is unavailable.
    }
    showMessage("info", `${order.productName || "Your order"} was cancelled because the dealer did not accept it within 24 hours.`);
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
        async (snapshot) => {
          const sortedOrderList = snapshot.exists()
            ? sortOrdersNewestFirst(
                Object.entries(snapshot.val()).map(([id, value]) => ({ id, ...value }))
              )
            : [];

          const paidOrderIds = new Set(
            sortedOrderList.filter(isPaidOrder).map((order) => order.id)
          );
          const newlyPaidOrder = sortedOrderList.find(
            (order) =>
              isPaidOrder(order) &&
              !knownPaidOrderIds.current.has(order.id)
          );
          const historyOnlyStatuses = ["completed", "complete"];
          const newlyMovedToHistory = sortedOrderList.find(
            (order) =>
              historyOnlyStatuses.includes(
                String(order.status || order.orderStatus || "").trim().toLowerCase().replaceAll(" ", "_")
              ) &&
              !knownHistoryOrderIds.current.has(order.id)
          );

          knownPaidOrderIds.current = paidOrderIds;
          knownHistoryOrderIds.current = new Set(
            sortedOrderList.filter(isHistoryOrder).map((order) => order.id)
          );
          setOrders(sortedOrderList);

          await expirePendingOrders(database, sortedOrderList);
          const timedOutOrder = sortedOrderList.find((order) => order.cancellationReason === "dealer_acceptance_timeout");
          if (timedOutOrder) showTimeoutNotice(user.uid, timedOutOrder);

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

  useEffect(() => {
    const timer = window.setInterval(() => {
      expirePendingOrders(database, orders);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [orders]);

  const filteredHistoryOrders = useMemo(
    () => sortOrdersNewestFirst(historyOrders.filter((order) =>
      !order.farmerArchived &&
      getHistoryStatus(order) === historyStatusFilter &&
      matchesHistoryDateRange(order, historyStartDate, historyEndDate)
    )),
    [historyOrders, historyStatusFilter, historyStartDate, historyEndDate]
  );

  const filteredOrders = useMemo(() => {
    if (selectedFilter === "history") {
      return filteredHistoryOrders;
    }

    if (selectedFilter === "active") {
      return sortOrdersNewestFirst(currentOrders.filter((order) => getNormalizedOrderStatus(order) === "pending"));
    }

    if (selectedFilter === "accepted") {
      return sortOrdersNewestFirst(currentOrders.filter((order) => ACCEPTED_STATUSES.includes(getNormalizedOrderStatus(order))));
    }

    return sortOrdersNewestFirst(currentOrders);
  }, [currentOrders, filteredHistoryOrders, selectedFilter]);

  const counts = useMemo(
    () => ({
      active: currentOrders.filter((order) =>
        getNormalizedOrderStatus(order) === "pending"
      ).length,
      accepted: currentOrders.filter((order) => ACCEPTED_STATUSES.includes(getNormalizedOrderStatus(order))).length,
      history: filteredHistoryOrders.length,
      historyStatuses: Object.fromEntries(HISTORY_STATUS_FILTERS.map(({ value }) => [
        value,
        historyOrders.filter((order) =>
          !order.farmerArchived &&
          getHistoryStatus(order) === value &&
          matchesHistoryDateRange(order, historyStartDate, historyEndDate)
        ).length,
      ])),
    }),
    [currentOrders, filteredHistoryOrders, historyOrders, historyStartDate, historyEndDate]
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

      const orderList = sortOrdersNewestFirst(Object.entries(snapshot.val())
        .map(([id, value]) => ({
          id,
          ...value,
        })));

      await expirePendingOrders(database, orderList);

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
    setSelectedOrder(null);
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
      return;
    }

    if (!event.target.closest?.("button, a, input, select, textarea")) {
      setSelectedOrder(order);
    }
  }

  function openCancellationDialog(order) {
    setCancellationReason("");
    setCancellationNote("");
    setSelectedOrder(null);
    setCancellationOrder(order);
  }

  async function cancelPendingOrder() {
    const user = auth.currentUser;
    const order = cancellationOrder;
    if (!user || !order?.id || !cancellationReason || (cancellationReason === "Other" && !cancellationNote.trim())) {
      return;
    }

    const deadline = getOrderAcceptanceDeadline(order);
    if (deadline && deadline <= Date.now()) {
      setCancellationOrder(null);
      await expirePendingOrders(database, [order]);
      showMessage("info", "The 24-hour acceptance window ended. This order is moving to Expired.");
      return;
    }

    setUpdatingId(`cancelling:${order.id}`);
    try {
      const result = await runTransaction(
        ref(database, `dealerOrders/${order.id}`),
        (current) => {
          if (
            !current ||
            current.farmerUid !== user.uid ||
            getNormalizedOrderStatus(current) !== "pending"
          ) {
            return;
          }

          const currentDeadline = getOrderAcceptanceDeadline(current);
          if (currentDeadline && currentDeadline <= Date.now()) return;

          return {
            ...current,
            status: "cancelled",
            cancellationReason: cancellationReason === "Other" ? `Other: ${cancellationNote.trim()}` : cancellationReason,
            cancelledBy: "farmer",
            cancelledAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
        },
        { applyLocally: false }
      );

      if (!result.committed) {
        const latestOrder = result.snapshot.val();
        const latestDeadline = getOrderAcceptanceDeadline(latestOrder);
        if (latestOrder && latestDeadline && latestDeadline <= Date.now() && getNormalizedOrderStatus(latestOrder) === "pending") {
          await expirePendingOrders(database, [{ ...latestOrder, id: order.id }]);
          showMessage("info", "The 24-hour acceptance window ended. This order is moving to Expired.");
        } else {
          showMessage("warning", "This order is no longer pending, so it could not be cancelled.");
        }
        setCancellationOrder(null);
        return;
      }

      const updatedOrder = { ...result.snapshot.val(), id: order.id };
      setOrders((currentOrders) => currentOrders.map((item) => item.id === order.id ? updatedOrder : item));
      setCancellationOrder(null);
      setHistoryStatusFilter("cancelled");
      changeFilter("history");
      showMessage("success", "Order cancelled. It is now in Cancelled orders.");
    } catch (error) {
      console.error("Farmer order cancellation error:", error);
      showMessage("error", "The order could not be cancelled. Check your connection and try again.");
    } finally {
      setUpdatingId("");
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
        setSelectedOrder((currentOrder) =>
          currentOrder && archivedIds.has(currentOrder.id) ? null : currentOrder
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
            <>
              <section className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Order history status filters">
                {HISTORY_STATUS_FILTERS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={historyStatusFilter === value}
                    onClick={() => { cancelSelection(); setHistoryStatusFilter(value); }}
                    className={`rounded-2xl border p-4 text-left transition ${historyStatusFilter === value ? "border-green-700 bg-green-700 text-white shadow-md" : "border-green-100 bg-white text-gray-800 hover:border-green-300 hover:shadow-sm"}`}
                  >
                    <span className={`block text-xs font-semibold ${historyStatusFilter === value ? "text-green-50" : "text-gray-500"}`}>{label}</span>
                    <span className="mt-1 block text-2xl font-bold">{counts.historyStatuses[value]}</span>
                  </button>
                ))}
              </section>
              <section className="mb-5 grid grid-cols-1 gap-3 rounded-2xl border border-green-100 bg-white p-4 shadow-sm sm:grid-cols-2">
              <label className="text-sm font-semibold text-gray-700">
                From date
                <input type="date" value={historyStartDate} max={historyEndDate || undefined} onChange={(event) => { cancelSelection(); setHistoryStartDate(event.target.value); }} className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal" />
              </label>
              <label className="text-sm font-semibold text-gray-700">
                To date
                <input type="date" value={historyEndDate} min={historyStartDate || undefined} onChange={(event) => { cancelSelection(); setHistoryEndDate(event.target.value); }} className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal" />
              </label>
              </section>
            </>
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
            <section className="space-y-3">
              {filteredOrders.map((order) => {
                const orderStatus = getNormalizedOrderStatus(order);
                const status = order.cancellationReason === "dealer_acceptance_timeout" || orderStatus === "expired"
                  ? { ...getStatusDetails(orderStatus), icon: "⌛", label: "Expired" }
                  : getStatusDetails(orderStatus);
                const updating = updatingId === order.id;
                const selectable = isEligibleHistoryOrder(order);
                const selected = selectedOrderIds.includes(order.id);
                const canContactDealer = auth.currentUser?.uid === order.farmerUid && ["accepted", "delivered_by_dealer"].includes(orderStatus) && !order.farmerReceived;
                const dealerPhone = String(order.dealerPhone || "").replace(/[^\d+]/g, "");
                const amount = order.totalAmount ?? (Number(order.price || 0) * Number(order.quantity || 0));

                return (
                  <article
                    key={order.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`View ${order.productName || "order"} details`}
                    onClickCapture={(event) => {
                      if (suppressOrderClick.current) {
                        suppressOrderClick.current = false;
                        event.preventDefault();
                        event.stopPropagation();
                      }
                    }}
                    onClick={(event) => handleOrderCardClick(order, event)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleOrderCardClick(order, event);
                      }
                    }}
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
                        setSelectedOrderIds((currentIds) => currentIds.includes(order.id) ? currentIds : [...currentIds, order.id]);
                      }
                    }}
                    className={`cursor-pointer rounded-xl border bg-white px-3 py-3 shadow-sm transition hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-400 ${selected ? "border-green-600 bg-green-50 ring-2 ring-green-300" : "border-green-100"}`}
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      {selected && <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-700 text-sm text-white">✓</span>}
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-green-950">{order.productName || "Farm Product"} <span className="font-normal text-gray-500">· {order.dealerName || "Dealer"}</span></span>
                      <span className="text-xs text-gray-600">{order.quantity || 0} {order.unit || "units"}</span>
                      <span className="text-xs font-semibold text-gray-700">{formatMoney(amount)}</span>
                      <span className={`${status.className} shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold`}>{status.icon} {status.label}</span>
                      <span className="w-full text-xs text-gray-500 sm:w-auto">Ordered {formatDate(order.createdAt)}</span>
                    </div>
                    {orderStatus === "pending" && <div className="pointer-events-none mt-2"><OrderAcceptanceTimer order={order} /></div>}
                    {orderStatus === "pending" && (
                      <button type="button" onClick={(event) => { event.stopPropagation(); openCancellationDialog(order); }} className="mt-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Cancel order</button>
                    )}
                    {order.cancellationReason === "dealer_acceptance_timeout" && <p className="mt-2 text-xs font-medium text-red-800">Expired: dealer did not accept within 24 hours.</p>}
                    {canContactDealer && (
                      <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-green-100 pt-2">
                        <span className="text-sm font-medium text-green-900">{order.dealerName || "Dealer"}{order.dealerPhone ? ` · ${order.dealerPhone}` : ""}</span>
                        {dealerPhone && <a href={`tel:${dealerPhone}`} onClick={(event) => event.stopPropagation()} className="rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white">Call Dealer</a>}
                      </div>
                    )}
                    {orderStatus === "rejected" && order.rejectionReason && <p className="mt-2 text-xs text-red-700">Reason: {order.rejectionReason}</p>}
                    {(orderStatus === "cancelled" || orderStatus === "canceled") && order.cancellationReason && order.cancellationReason !== "dealer_acceptance_timeout" && <p className="mt-2 text-xs text-gray-700">Reason: {order.cancellationReason}</p>}
                    {["accepted", "delivered_by_dealer"].includes(orderStatus) && !order.farmerReceived && (
                      <button type="button" disabled={updating} onClick={(event) => { event.stopPropagation(); confirmProductReceived(order); }} className="mt-2 rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white disabled:bg-gray-400">
                        {updating ? "Please wait..." : "Mark products collected"}
                      </button>
                    )}
                  </article>
                );
              })}
              {selectedOrder && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedOrder(null); }}>
                  <section role="dialog" aria-modal="true" aria-labelledby="farmer-order-details-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
                    <header className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-3xl bg-green-800 p-5 text-white">
                      <div><p className="text-xs font-semibold uppercase tracking-wider text-green-100">Order details</p><h2 id="farmer-order-details-title" className="mt-1 break-all text-xl font-bold">{selectedOrder.orderId || selectedOrder.id}</h2></div>
                      <button type="button" autoFocus onClick={() => setSelectedOrder(null)} aria-label="Close order details" className="rounded-xl bg-white/15 px-3 py-2 font-semibold">Close ✕</button>
                    </header>
                    <div className="space-y-4 p-5">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <InfoCard label="Status" value={selectedOrder.cancellationReason === "dealer_acceptance_timeout" || getNormalizedOrderStatus(selectedOrder) === "expired" ? "Expired" : getStatusDetails(getNormalizedOrderStatus(selectedOrder)).label} />
                        <InfoCard label="Product" value={selectedOrder.productName || "Farm Product"} />
                        <InfoCard label="Dealer" value={selectedOrder.dealerName || "Dealer"} />
                        <InfoCard label="Quantity" value={`${selectedOrder.quantity || 0} ${selectedOrder.unit || "units"}`} />
                        <InfoCard label="Price per unit" value={formatMoney(selectedOrder.price)} />
                        <InfoCard label="Total amount" value={formatMoney(selectedOrder.totalAmount ?? (Number(selectedOrder.price || 0) * Number(selectedOrder.quantity || 0)))} />
                        <InfoCard label="Order date" value={formatDate(selectedOrder.createdAt)} />
                        {selectedOrder.completedAt && <InfoCard label="Completed date" value={formatDate(selectedOrder.completedAt)} />}
                      </div>
                      {getNormalizedOrderStatus(selectedOrder) === "pending" && <OrderAcceptanceTimer order={selectedOrder} />}
                      {getNormalizedOrderStatus(selectedOrder) === "pending" && <button type="button" onClick={() => openCancellationDialog(selectedOrder)} className="rounded-xl border border-red-200 px-4 py-3 font-semibold text-red-700 hover:bg-red-50">Cancel order</button>}
                      {selectedOrder.cancellationReason === "dealer_acceptance_timeout" && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">Expired because the dealer did not accept within 24 hours.</p>}
                      {selectedOrder.cancellationReason && selectedOrder.cancellationReason !== "dealer_acceptance_timeout" && <InfoCard label="Cancellation reason" value={selectedOrder.cancellationReason} />}
                      {selectedOrder.rejectionReason && <InfoCard label="Rejection reason" value={selectedOrder.rejectionReason} />}
                      {selectedOrder.dealerAddress && <InfoCard label="Dealer shop address" value={selectedOrder.dealerAddress} />}
                      {auth.currentUser?.uid === selectedOrder.farmerUid && ["accepted", "delivered_by_dealer"].includes(getNormalizedOrderStatus(selectedOrder)) && !selectedOrder.farmerReceived && String(selectedOrder.dealerPhone || "").replace(/[^\d+]/g, "") && (
                        <a href={`tel:${String(selectedOrder.dealerPhone).replace(/[^\d+]/g, "")}`} className="inline-flex rounded-xl bg-green-700 px-4 py-3 font-semibold text-white">Call Dealer</a>
                      )}
                      {["accepted", "delivered_by_dealer"].includes(getNormalizedOrderStatus(selectedOrder)) && !selectedOrder.farmerReceived && (
                        <button type="button" disabled={updatingId === selectedOrder.id} onClick={() => { confirmProductReceived(selectedOrder); setSelectedOrder(null); }} className="ml-2 rounded-xl border border-green-700 px-4 py-3 font-semibold text-green-800 disabled:opacity-50">{updatingId === selectedOrder.id ? "Please wait..." : "Mark products collected"}</button>
                      )}
                    </div>
                  </section>
                </div>
              )}
              {cancellationOrder && (
                <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !updatingId) setCancellationOrder(null); }}>
                  <section role="dialog" aria-modal="true" aria-labelledby="cancel-farmer-order-title" className="w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
                    <h2 id="cancel-farmer-order-title" className="text-xl font-bold text-gray-900">Cancel this order?</h2>
                    <p className="mt-2 text-sm text-gray-600">The 24-hour acceptance timer will stop, and the order will move to Cancelled orders.</p>
                    <label className="mt-4 block text-sm font-semibold text-gray-700">
                      Reason for cancelling
                      <select value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 font-normal">
                        <option value="">Choose a reason</option>
                        <option value="Ordered by mistake">Ordered by mistake</option>
                        <option value="Changed my mind">Changed my mind</option>
                        <option value="No longer needed">No longer needed</option>
                        <option value="Other">Other</option>
                      </select>
                    </label>
                    {cancellationReason === "Other" && (
                      <label className="mt-3 block text-sm font-semibold text-gray-700">
                        Please specify
                        <textarea value={cancellationNote} onChange={(event) => setCancellationNote(event.target.value)} maxLength={240} rows={3} className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal" />
                      </label>
                    )}
                    <div className="mt-5 flex justify-end gap-3">
                      <button type="button" disabled={Boolean(updatingId)} onClick={() => setCancellationOrder(null)} className="min-h-11 rounded-xl border border-gray-300 px-4 font-semibold text-gray-700 disabled:opacity-50">Keep order</button>
                      <button type="button" disabled={Boolean(updatingId) || !cancellationReason || (cancellationReason === "Other" && !cancellationNote.trim())} onClick={cancelPendingOrder} className="min-h-11 rounded-xl bg-red-600 px-4 font-semibold text-white hover:bg-red-700 disabled:opacity-50">{updatingId === `cancelling:${cancellationOrder.id}` ? "Cancelling..." : "Confirm cancellation"}</button>
                    </div>
                  </section>
                </div>
              )}
            </section>
          )}
        </div>

      </main>
    </div>
  );
}
