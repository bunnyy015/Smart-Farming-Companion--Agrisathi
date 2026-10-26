function toCreationTimestamp(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed);
    const timestamp = Number.isFinite(numeric) ? numeric : Date.parse(trimmed);
    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
  }

  if (value && typeof value === "object") {
    const seconds = Number(value.seconds ?? value._seconds);
    if (Number.isFinite(seconds) && seconds > 0) {
      return seconds * 1000;
    }
  }

  return null;
}

export function getOrderCreationTimestamp(order) {
  const creationFields = [
    order?.createdAt,
    order?.createdAtMs,
    order?.orderDate,
    order?.createdDate,
    order?.date,
    order?.timestamp,
  ];

  for (const value of creationFields) {
    const timestamp = toCreationTimestamp(value);
    if (timestamp !== null) return timestamp;
  }

  return null;
}

export function compareOrdersNewestFirst(first, second) {
  const firstCreatedAt = getOrderCreationTimestamp(first);
  const secondCreatedAt = getOrderCreationTimestamp(second);

  if (firstCreatedAt === null && secondCreatedAt === null) return 0;
  if (firstCreatedAt === null) return 1;
  if (secondCreatedAt === null) return -1;
  return secondCreatedAt - firstCreatedAt;
}

export function sortOrdersNewestFirst(orders) {
  return [...orders].sort(compareOrdersNewestFirst);
}
