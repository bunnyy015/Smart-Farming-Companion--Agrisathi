import { initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { defineSecret, defineString } from "firebase-functions/params";
import { onValueCreated, onValueUpdated } from "firebase-functions/v2/database";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { setGlobalOptions } from "firebase-functions/v2";

initializeApp();
setGlobalOptions({ region: "asia-southeast1", maxInstances: 5 });

const whatsappAccessToken = defineSecret("WHATSAPP_ACCESS_TOKEN");
const dataGovApiKey = defineSecret("DATA_GOV_API_KEY");
const whatsappPhoneNumberId = defineString("WHATSAPP_PHONE_NUMBER_ID");
const whatsappTemplateName = defineString("WHATSAPP_TEMPLATE_NAME", { default: "agrisathi_order_update" });
const whatsappGraphApiVersion = defineString("WHATSAPP_GRAPH_API_VERSION");
const databaseUrl = defineString("FIREBASE_DATABASE_URL", {
  default: "https://agrisathi-a84f8-default-rtdb.asia-southeast1.firebasedatabase.app",
});

const db = getFirestore();
const statuses = new Set(["pending", "accepted", "rejected", "ready_for_pickup", "ready", "pickup_ready"]);
const statusCopy = {
  pending: { en: "Reservation received", te: "రిజర్వేషన్ అందింది", hi: "आरक्षण प्राप्त हुआ" },
  accepted: { en: "Reservation accepted", te: "రిజర్వేషన్ ఆమోదించబడింది", hi: "आरक्षण स्वीकार किया गया" },
  rejected: { en: "Reservation rejected", te: "రిజర్వేషన్ తిరస్కరించబడింది", hi: "आरक्षण अस्वीकार किया गया" },
  ready_for_pickup: { en: "Product ready for pickup", te: "ఉత్పత్తి తీసుకెళ్లడానికి సిద్ధంగా ఉంది", hi: "उत्पाद लेने के लिए तैयार है" },
};

function normalizedStatus(value) {
  const status = String(value || "").trim().toLowerCase().replace(/[ -]+/g, "_");
  if (status === "ready" || status === "pickup_ready") return "ready_for_pickup";
  return statuses.has(status) ? status : null;
}

function languageCode(profile) {
  const value = String(profile.preferredLanguage || "").toLowerCase();
  if (value.startsWith("telugu") || value === "te") return "te";
  if (value.startsWith("hindi") || value === "hi") return "hi";
  return "en";
}

function toWhatsAppNumber(value) {
  const original = String(value || "").trim();
  if (!original) return null;
  const digits = original.replace(/\D/g, "");
  if (/^\+?91[6-9]\d{9}$/.test(original.replace(/[\s()-]/g, ""))) return digits;
  if (/^[6-9]\d{9}$/.test(digits)) return `91${digits}`;
  return null;
}

async function sendOrderUpdate(orderId, order, status) {
  const eventId = `${orderId}_${status}`;
  const deliveryRef = db.collection("whatsappDelivery").doc(eventId);
  const userRef = getDatabase(undefined, databaseUrl.value());
  const profileSnapshot = await userRef.ref(`users/${order.farmerUid}`).get();
  const farmerSnapshot = await userRef.ref(`farmers/${order.farmerUid}`).get();
  const profile = { ...(profileSnapshot.val() || {}), ...(farmerSnapshot.val() || {}) };
  if (profile.role !== "farmer" || profile.whatsappNotificationsEnabled !== true) return;

  const phone = toWhatsAppNumber(profile.phone || profile.mobile || profile.phoneNumber);
  if (!phone) {
    logger.warn("WhatsApp delivery skipped: invalid farmer number", { eventId });
    return;
  }

  const claim = await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(deliveryRef);
    if (existing.exists) return false;
    transaction.create(deliveryRef, {
      status: "sending",
      eventType: status,
      orderId,
      farmerUid: order.farmerUid,
      createdAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
  if (!claim) return;

  try {
    const language = languageCode(profile);
    const body = statusCopy[status] || statusCopy.pending;
    const response = await fetch(`https://graph.facebook.com/${whatsappGraphApiVersion.value()}/${whatsappPhoneNumberId.value()}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${whatsappAccessToken.value()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phone,
        type: "template",
        template: {
          name: whatsappTemplateName.value(),
          language: { code: language === "te" ? "te" : language === "hi" ? "hi" : "en_US" },
          components: [{
            type: "body",
            parameters: [
              { type: "text", text: String(order.productName || "your product").slice(0, 80) },
              { type: "text", text: body[language] || body.en },
            ],
          }],
        },
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errorCode = String(result?.error?.code || "whatsapp_api_error");
      await deliveryRef.update({ status: "failed", errorCode, completedAt: FieldValue.serverTimestamp() });
      logger.error("WhatsApp template delivery failed", { eventId, errorCode, httpStatus: response.status });
      return;
    }
    await deliveryRef.update({ status: "sent", messageId: result?.messages?.[0]?.id || null, completedAt: FieldValue.serverTimestamp() });
  } catch (error) {
    await deliveryRef.update({ status: "failed", errorCode: String(error?.code || "delivery_error"), completedAt: FieldValue.serverTimestamp() });
    logger.error("WhatsApp delivery failed", { eventId, errorCode: String(error?.code || "delivery_error") });
  }
}

function processOrder(orderId, order, previousStatus = null) {
  const status = normalizedStatus(order?.status || order?.orderStatus);
  if (!order?.farmerUid || !status || !statusCopy[status] || status === previousStatus) return null;
  return sendOrderUpdate(orderId, order, status);
}

export const notifyFarmerOnReservation = onValueCreated({
  ref: "/dealerOrders/{orderId}",
  instance: "agrisathi-a84f8-default-rtdb",
  region: "asia-southeast1",
  secrets: [whatsappAccessToken],
}, (event) => processOrder(event.params.orderId, event.data.val()));

export const notifyFarmerOnReservationUpdate = onValueUpdated({
  ref: "/dealerOrders/{orderId}",
  instance: "agrisathi-a84f8-default-rtdb",
  region: "asia-southeast1",
  secrets: [whatsappAccessToken],
}, (event) => {
  const before = event.data.before.val() || {};
  const after = event.data.after.val() || {};
  const previousStatus = normalizedStatus(before.status || before.orderStatus);
  return processOrder(event.params.orderId, after, previousStatus);
});

const AGMARKNET_RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070";
const MARKET_QUERY_FIELDS = new Set([
  "format",
  "limit",
  "offset",
  "filters[state]",
  "filters[district]",
]);

export const fetchMarketPricePage = onCall({
  region: "asia-southeast1",
  maxInstances: 5,
  timeoutSeconds: 30,
  secrets: [dataGovApiKey],
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in to load market prices.");
  }

  const parameters = request.data?.parameters;
  if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) {
    throw new HttpsError("invalid-argument", "Invalid market price request.");
  }

  const query = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(parameters)) {
    if (!MARKET_QUERY_FIELDS.has(key) || typeof rawValue !== "string") {
      throw new HttpsError("invalid-argument", "Invalid market price filter.");
    }
    query.set(key, rawValue.trim());
  }

  const state = query.get("filters[state]");
  const limit = Number(query.get("limit"));
  const offset = Number(query.get("offset"));
  if (
    !state || state.length > 80 ||
    query.get("format") !== "json" ||
    !Number.isInteger(limit) || limit < 1 || limit > 1000 ||
    !Number.isInteger(offset) || offset < 0 || offset > 20000
  ) {
    throw new HttpsError("invalid-argument", "Invalid market price query.");
  }

  const apiKey = dataGovApiKey.value().trim();
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "MISSING_DATA_GOV_API_KEY");
  }

  const url = new URL(`https://api.data.gov.in/resource/${AGMARKNET_RESOURCE_ID}`);
  for (const [key, value] of query.entries()) url.searchParams.set(key, value);
  url.searchParams.set("api-key", apiKey);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const code = response.status === 429 ? "resource-exhausted" : "unavailable";
      throw new HttpsError(code, `MARKET_API_HTTP_${response.status}`);
    }
    const data = await response.json();
    if (!Array.isArray(data?.records)) {
      throw new HttpsError("internal", "MARKET_API_INVALID_RESPONSE");
    }
    return data;
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError(
      error?.name === "AbortError" ? "deadline-exceeded" : "unavailable",
      error?.name === "AbortError" ? "MARKET_API_TIMEOUT" : "MARKET_API_NETWORK_ERROR"
    );
  } finally {
    clearTimeout(timeoutId);
  }
});
