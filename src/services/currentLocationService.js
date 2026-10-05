const DEFAULT_GEOLOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
};
const MAX_POSITION_AGE_MS = 2 * 60 * 1000;
let inFlightLocationRequest = null;

function createLocationError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/** Request a fresh device/browser position without substituting profile/IP data. */
export function getCurrentLocation(options = {}) {
  if (inFlightLocationRequest) {
    return inFlightLocationRequest;
  }

  inFlightLocationRequest = requestCurrentLocation(options).finally(() => {
    inFlightLocationRequest = null;
  });
  return inFlightLocationRequest;
}

function requestCurrentLocation(options) {
  if (
    typeof navigator === "undefined" ||
    !navigator.geolocation
  ) {
    return Promise.reject(
      createLocationError("Geolocation is not supported.", "UNSUPPORTED")
    );
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = Number(position?.coords?.latitude);
        const longitude = Number(position?.coords?.longitude);
        const timestamp = Number(position?.timestamp);
        const accuracy = Number(position?.coords?.accuracy);

        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          latitude < -90 ||
          latitude > 90 ||
          longitude < -180 ||
          longitude > 180
        ) {
          reject(
            createLocationError("The device returned invalid coordinates.", "INVALID_COORDINATES")
          );
          return;
        }

        const now = Date.now();
        if (
          !Number.isFinite(timestamp) ||
          timestamp > now + 60_000 ||
          now - timestamp > MAX_POSITION_AGE_MS
        ) {
          reject(
            createLocationError(
              "The device returned an outdated location. Please try again.",
              "STALE_POSITION"
            )
          );
          return;
        }

        if (!Number.isFinite(accuracy) || accuracy < 0) {
          reject(
            createLocationError(
              "The device could not verify location accuracy. Please try again.",
              "INVALID_ACCURACY"
            )
          );
          return;
        }

        resolve({
          latitude,
          longitude,
          accuracy,
          timestamp,
          source: "device",
        });
      },
      (error) => {
        reject(
          createLocationError(
            error?.message || "Unable to determine the current location.",
            error?.code || "UNKNOWN"
          )
        );
      },
      {
        ...DEFAULT_GEOLOCATION_OPTIONS,
        ...options,
        enableHighAccuracy: true,
        // Never serve cached coordinates for a request explicitly asking for
        // the user's current location.
        maximumAge: 0,
      }
    );
  });
}

export function getLocationErrorTranslationKey(error) {
  if (error?.code === "UNSUPPORTED") return "locationUnsupported";
  if (error?.code === 1) return "locationAccessNeeded";
  if (error?.code === 2) return "locationPositionUnavailable";
  if (error?.code === 3) return "locationDetectionTimedOut";
  return "locationFallback";
}

/** Reverse-geocode only coordinates provided by the device. */
export async function reverseGeocodeCoordinates(
  { latitude, longitude },
  { signal } = {}
) {
  const parameters = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    localityLanguage: "en",
  });

  let requestSignal = signal;
  if (
    !requestSignal &&
    typeof AbortSignal !== "undefined" &&
    typeof AbortSignal.timeout === "function"
  ) {
    requestSignal = AbortSignal.timeout(7000);
  }

  const response = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?${parameters.toString()}`,
    requestSignal ? { signal: requestSignal } : undefined
  );

  if (!response.ok) {
    throw new Error(`Reverse geocoding failed (${response.status}).`);
  }

  return response.json();
}
