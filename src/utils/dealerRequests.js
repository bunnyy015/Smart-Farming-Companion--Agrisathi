function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function isPendingDealerRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    return false;
  }

  const status = normalize(request.status);
  const role = normalize(request.role);

  return (
    (!role || role === "dealer") &&
    (!status || ["pending", "requested", "waiting"].includes(status))
  );
}

export function getPendingDealerRequests(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return [];
  }

  return Object.entries(data)
    .filter(([, request]) => isPendingDealerRequest(request))
    .map(([requestKey, request]) => ({ ...request, requestKey }))
    .sort((first, second) =>
      String(second.createdAt ?? "").localeCompare(String(first.createdAt ?? ""))
    );
}
