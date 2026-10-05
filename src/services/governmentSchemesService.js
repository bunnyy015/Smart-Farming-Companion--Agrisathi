import { get, onValue, ref } from "firebase/database";
import { database } from "../firebase";

export const GOVERNMENT_SCHEMES_PATH = "governmentSchemes";
const LEGACY_SCHEMES_PATH = "schemes";

export async function resolveGovernmentSchemesPath() {
  const current = await get(ref(database, GOVERNMENT_SCHEMES_PATH));
  if (current.exists()) return GOVERNMENT_SCHEMES_PATH;

  const legacy = await get(ref(database, LEGACY_SCHEMES_PATH));
  return legacy.exists() ? LEGACY_SCHEMES_PATH : GOVERNMENT_SCHEMES_PATH;
}

export function subscribeToGovernmentSchemes(path, onSchemes, onError) {
  return onValue(
    ref(database, path),
    (snapshot) => {
      const value = snapshot.val() || {};
      const schemes = Object.entries(value)
        .filter(([, scheme]) => scheme && typeof scheme === "object")
        .map(([id, scheme]) => ({ id, ...scheme }));
      onSchemes(schemes, value._initialized === true || schemes.length > 0);
    },
    onError
  );
}
