const PAGE_SIZE = 1000;
const MAX_PAGES = 20;
const MAX_ATTEMPTS = 3;
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const RECENT_CACHE_MS = 5 * 60 * 1000;
const CACHE_PREFIX = "agrisathi:mandi-cache:v1:";

const memoryCache = new Map();
const requestsInFlight = new Map();

export function getGovernmentMarketPriceErrorMessage(error) {
  const code = String(error?.message || "");
  if (code === "MISSING_DATA_GOV_API_KEY") {
    return "VITE_DATA_GOV_API_KEY is missing. Add it to .env.local, then fully restart the Vite server.";
  }

  const status = code.match(/^MARKET_API_HTTP_(\d{3})$/)?.[1];
  if (["400", "401", "403"].includes(status)) {
    return `data.gov.in rejected the API key or request (HTTP ${status}). Verify the key is valid and enabled for the AGMARKNET resource, then restart the Vite server.`;
  }
  if (status === "429") {
    return "The data.gov.in API rate limit was reached. Please wait and try again.";
  }
  if (["502", "503", "504"].includes(status)) {
    return "Live mandi prices are temporarily unavailable. We are trying to reconnect.";
  }
  if (status && Number(status) >= 500) {
    return "The Government market-price service is temporarily unavailable. Please try again later.";
  }
  if (code === "MARKET_API_NETWORK_ERROR" || code === "MARKET_API_TIMEOUT") {
    return code === "MARKET_API_TIMEOUT"
      ? "The Government market-price request took too long. Please retry."
      : "The app could not connect to the Government market-price service. Check internet access and try again.";
  }
  if (code === "MARKET_API_INVALID_RESPONSE") {
    return "The Government market-price service returned unreadable data. Please try again later.";
  }
  return "Government mandi prices could not be loaded. Please try again later.";
}

function normalizeSelection(value) {
  return String(value || "").trim().toLocaleLowerCase();
}

function makeCacheKey(state, district) {
  return `${CACHE_PREFIX}${encodeURIComponent(
    `${normalizeSelection(state)}|${normalizeSelection(district)}`
  )}`;
}

function readCache(key) {
  const memoryValue = memoryCache.get(key);
  if (memoryValue) return memoryValue;

  try {
    const stored = JSON.parse(localStorage.getItem(key) || "null");
    if (
      stored && Array.isArray(stored.records) &&
      Number.isFinite(Date.parse(stored.retrievedAt))
    ) {
      memoryCache.set(key, stored);
      return stored;
    }
  } catch {
    // Storage may be disabled or full. The live request can still proceed.
  }
  return null;
}

function saveCache(key, records, retrievedAt) {
  const value = { records, retrievedAt };
  memoryCache.set(key, value);
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Keep the in-memory fallback even when browser storage is unavailable.
  }
}

function logDevelopment(event, details = {}) {
  if (import.meta.env?.DEV) {
    console.info("[MandiPrices]", event, details);
  }
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function fetchPage(parameters, callerSignal) {
  let lastError;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    if (callerSignal?.aborted) throw new DOMException("Aborted", "AbortError");

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);
    const abortCaller = () => controller.abort();
    callerSignal?.addEventListener("abort", abortCaller, { once: true });

    try {
      logDevelopment("request", {
        endpoint: "/api/market-prices",
        attempt: attempt + 1,
        parameters: Object.fromEntries(parameters.entries()),
      });
      const response = await fetch(`/api/market-prices?${parameters}`, {
        signal: controller.signal,
      });
      logDevelopment("response", { status: response.status });

      if (!response.ok) {
        if (response.status === 503) {
          const body = await response.json().catch(() => null);
          if (body?.error === "MISSING_DATA_GOV_API_KEY") {
            throw new Error("MISSING_DATA_GOV_API_KEY");
          }
        }
        lastError = new Error(`MARKET_API_HTTP_${response.status}`);
        if (![502, 503, 504].includes(response.status)) throw lastError;
      } else {
        let result;
        try {
          result = await response.json();
        } catch (error) {
          throw new Error("MARKET_API_INVALID_RESPONSE", { cause: error });
        }
        if (!result || !Array.isArray(result.records)) {
          throw new Error("MARKET_API_INVALID_RESPONSE");
        }
        return result;
      }
    } catch (error) {
      if (callerSignal?.aborted || error?.name === "AbortError") {
        if (callerSignal?.aborted) throw error;
        lastError = new Error("MARKET_API_TIMEOUT");
      } else if (error?.message === "MISSING_DATA_GOV_API_KEY" ||
        error?.message === "MARKET_API_INVALID_RESPONSE" ||
        /^MARKET_API_HTTP_(?!502|503|504)\d{3}$/.test(error?.message || "")) {
        throw error;
      } else if (!String(error?.message || "").startsWith("MARKET_API_HTTP_")) {
        lastError = new Error("MARKET_API_NETWORK_ERROR", { cause: error });
      } else {
        lastError = error;
      }
    } finally {
      window.clearTimeout(timeoutId);
      callerSignal?.removeEventListener("abort", abortCaller);
    }

    if (attempt < MAX_ATTEMPTS - 1) await wait(400 * (2 ** attempt));
  }
  throw lastError || new Error("MARKET_API_NETWORK_ERROR");
}

async function fetchLivePrices(state, district, signal) {
  const records = [];
  let offset = 0;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const parameters = new URLSearchParams({
      format: "json",
      limit: String(PAGE_SIZE),
      offset: String(offset),
      "filters[state]": String(state).trim(),
    });
    if (district) parameters.set("filters[district]", district);

    const result = await fetchPage(parameters, signal);
    const pageRecords = result.records.filter(
      (record) => record && typeof record === "object" && !Array.isArray(record)
    );
    records.push(...pageRecords);
    offset += pageRecords.length;

    const total = Number(result.total ?? result.count);
    if (
      pageRecords.length < PAGE_SIZE ||
      (Number.isFinite(total) && total > 0 && offset >= total)
    ) break;
  }

  return records;
}

/** Official AGMARKNET data via the server-side proxy, with bounded retries and a labeled cache fallback. */
export async function fetchGovernmentMarketPrices({
  state,
  district,
  signal,
  forceRefresh = false,
} = {}) {
  if (!state) throw new Error("MARKET_STATE_REQUIRED");

  const normalizedDistrict = String(district || "")
    .replace(/\s+district$/i, "")
    .trim();
  const key = makeCacheKey(state, normalizedDistrict);
  const cached = readCache(key);
  const cacheAge = cached ? Date.now() - Date.parse(cached.retrievedAt) : Infinity;

  if (!forceRefresh && cached && cacheAge <= RECENT_CACHE_MS) {
    logDevelopment("cache-hit", { count: cached.records.length, ageMs: cacheAge });
    return { ...cached, source: "cache" };
  }

  if (requestsInFlight.has(key) && !forceRefresh) {
    return requestsInFlight.get(key);
  }

  const request = (async () => {
    try {
      const records = await fetchLivePrices(state, normalizedDistrict, signal);
      const retrievedAt = new Date().toISOString();
      if (records.length > 0) saveCache(key, records, retrievedAt);
      logDevelopment("records-received", { count: records.length });
      return { records, retrievedAt, source: "live" };
    } catch (error) {
      if (signal?.aborted || error?.name === "AbortError") throw error;
      if (cached && Date.now() - Date.parse(cached.retrievedAt) <= CACHE_MAX_AGE_MS) {
        logDevelopment("using-cached-data", {
          count: cached.records.length,
          retrievedAt: cached.retrievedAt,
          ageMs: Date.now() - Date.parse(cached.retrievedAt),
        });
        return { ...cached, source: "cache" };
      }
      throw error;
    }
  })();

  requestsInFlight.set(key, request);
  try {
    return await request;
  } finally {
    if (requestsInFlight.get(key) === request) requestsInFlight.delete(key);
  }
}
