function requestPosition(options) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      const error = new Error("Geolocation is not supported");
      error.code = "UNSUPPORTED";
      reject(error);
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function toLocation(position, source) {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    timestamp: position.timestamp,
    source,
  };
}

// Approximate fallback (city level) for desktops without GPS / Wi-Fi location.
async function getIpLocation() {
  const response = await fetch("https://ipapi.co/json/");
  if (!response.ok) {
    const error = new Error("IP location failed");
    error.code = 2;
    throw error;
  }
  const data = await response.json();
  if (typeof data.latitude !== "number" || typeof data.longitude !== "number") {
    const error = new Error("IP location unavailable");
    error.code = 2;
    throw error;
  }
  return {
    latitude: data.latitude,
    longitude: data.longitude,
    accuracy: 5000,
    timestamp: Date.now(),
    source: "ip",
  };
}

export async function getCurrentLocation() {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    const error = new Error("Geolocation needs HTTPS or localhost");
    error.code = "INSECURE";
    throw error;
  }

  try {
    const position = await requestPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
    return toLocation(position, "gps");
  } catch (error) {
    // Permission denied / unsupported: retrying will not help.
    if (error.code === 1 || error.code === "UNSUPPORTED") throw error;
  }

  try {
    const position = await requestPosition({
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 5 * 60 * 1000,
    });
    return toLocation(position, "network");
  } catch (error) {
    if (error.code === 1) throw error;
    // Last resort: approximate location from IP address.
    try {
      return await getIpLocation();
    } catch {
      throw error;
    }
  }
}

export function getLocationErrorTranslationKey(error) {
  switch (error?.code) {
    case 1:
      return "locationPermissionDenied";
    case 3:
      return "locationTimeout";
    case "UNSUPPORTED":
      return "locationUnsupported";
    case "INSECURE":
      return "locationInsecure";
    default:
      return "locationUnavailable";
  }
}

export async function reverseGeocodeCoordinates({ latitude, longitude }) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    localityLanguage: "en",
  });
  const response = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`
  );
  if (!response.ok) throw new Error("Reverse geocoding failed");
  return response.json();
}