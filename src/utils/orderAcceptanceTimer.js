import {
  get,
  ref,
  runTransaction,
  serverTimestamp,
} from "firebase/database";

export const ORDER_ACCEPTANCE_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function createOrderAcceptanceFields(database) {
  let serverOffset = 0;

  try {
    const offsetSnapshot = await get(ref(database, ".info/serverTimeOffset"));
    serverOffset = Number(offsetSnapshot.val()) || 0;
  } catch {
    // Keep order placement available if the server offset cannot be read.
  }

  const createdAtMs = Date.now() + serverOffset;
  return {
    createdAt: serverTimestamp(),
    acceptanceDeadlineAt: createdAtMs + ORDER_ACCEPTANCE_WINDOW_MS,
    updatedAt: serverTimestamp(),
  };
}

export function getOrderAcceptanceDeadline(order) {
  const explicitDeadline = Number(order?.acceptanceDeadlineAt);
  if (Number.isFinite(explicitDeadline) && explicitDeadline > 0) {
    return explicitDeadline;
  }

  const createdAt = new Date(order?.createdAt || 0).getTime();
  return Number.isFinite(createdAt) && createdAt > 0
    ? createdAt + ORDER_ACCEPTANCE_WINDOW_MS
    : null;
}

export async function expirePendingOrders(database, orders) {
  const expired = [];

  await Promise.all(orders.map(async (order) => {
    const deadline = getOrderAcceptanceDeadline(order);
    if (!order?.id || !deadline || deadline > Date.now()) return;

    try {
      const result = await runTransaction(
        ref(database, `dealerOrders/${order.id}`),
        (current) => {
          if (!current || String(current.status || current.orderStatus || "").toLowerCase() !== "pending") {
            return;
          }
          const currentDeadline = getOrderAcceptanceDeadline(current);
          if (!currentDeadline || currentDeadline > Date.now()) return;

          return {
            ...current,
            status: "cancelled",
            cancellationReason: "dealer_acceptance_timeout",
            cancelledAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
        },
        { applyLocally: false }
      );

      if (result.committed && result.snapshot.val()?.cancellationReason === "dealer_acceptance_timeout") {
        expired.push({ ...result.snapshot.val(), id: order.id });
      }
    } catch (error) {
      console.warn("Could not check order acceptance expiry:", order.id, error);
    }
  }));

  return expired;
}

export function formatAcceptanceCountdown(deadline, now = Date.now()) {
  const remaining = Math.max(0, deadline - now);
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
