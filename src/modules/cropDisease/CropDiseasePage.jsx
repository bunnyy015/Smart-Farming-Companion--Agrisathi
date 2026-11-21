import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { get, push, ref, set } from "firebase/database";
import { auth, database } from "../../firebase";
import { getLanguage, t } from "../../utils/language";
import useLanguage from "../../utils/useLanguage";
import "./CropDiseasePage.css";

const MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
];

// Keep crop diagnosis available if one model is temporarily overloaded.
const DISEASE_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
];

const languageNames = {
  en: "English",
  te: "Telugu",
  hi: "Hindi",
  ta: "Tamil",
  kn: "Kannada",
  ml: "Malayalam",
  mr: "Marathi",
  bn: "Bengali",
  gu: "Gujarati",
  pa: "Punjabi",
  ur: "Urdu",
  or: "Odia",
};

function getPythonApiUrl() {
  const configuredUrl = import.meta.env.VITE_PYTHON_API_URL?.trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }
  if (typeof window === "undefined") {
    return "http://127.0.0.1:8000";
  }
  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://127.0.0.1:8000";
  }
  return `http://${hostname}:8000`;
}

async function assessCropPhotoClarity(file) {
  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("The crop photo could not be opened."));
      element.src = imageUrl;
    });

    const sampleSize = 320;
    const scale = Math.min(1, sampleSize / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(3, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(3, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("The crop photo could not be checked.");

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const gray = new Float32Array(canvas.width * canvas.height);
    let brightnessTotal = 0;

    for (let pixel = 0; pixel < gray.length; pixel += 1) {
      const offset = pixel * 4;
      const luminance = 0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2];
      gray[pixel] = luminance;
      brightnessTotal += luminance;
    }

    const meanBrightness = brightnessTotal / gray.length;
    let luminanceVariance = 0;
    let laplacianTotal = 0;
    let laplacianSquaredTotal = 0;
    let sampleCount = 0;

    for (let y = 1; y < canvas.height - 1; y += 1) {
      for (let x = 1; x < canvas.width - 1; x += 1) {
        const index = y * canvas.width + x;
        const value = gray[index];
        const difference = value - meanBrightness;
        luminanceVariance += difference * difference;
        const laplacian = 4 * value - gray[index - 1] - gray[index + 1]
          - gray[index - canvas.width] - gray[index + canvas.width];
        laplacianTotal += laplacian;
        laplacianSquaredTotal += laplacian * laplacian;
        sampleCount += 1;
      }
    }

    const contrast = Math.sqrt(luminanceVariance / Math.max(1, sampleCount));
    const meanLaplacian = laplacianTotal / Math.max(1, sampleCount);
    const sharpness = Math.max(0, laplacianSquaredTotal / Math.max(1, sampleCount) - meanLaplacian ** 2);
    return {
      needsEnhancement: meanBrightness < 45 || meanBrightness > 225 || contrast < 18 || sharpness < 75,
    };
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function extractJson(responseText) {
  if (typeof responseText !== "string" || !responseText.trim()) {
    throw new Error("The disease service returned an empty response.");
  }

  const cleanedText = responseText
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const firstBrace = cleanedText.indexOf("{");
  const lastBrace = cleanedText.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("The disease result was not valid.");
  }

  return JSON.parse(cleanedText.slice(firstBrace, lastBrace + 1));
}

function validateAnalysis(result) {
  if (!result || typeof result !== "object") {
    throw new Error("The disease result was invalid.");
  }

  return {
    isPlant: result.isPlant !== false,
    crop: typeof result.crop === "string" ? result.crop : "Unknown",
    disease: typeof result.disease === "string" ? result.disease : "Unknown",
    confidence: ["high", "medium", "low"].includes(
      String(result.confidence).toLowerCase()
    )
      ? String(result.confidence).toLowerCase()
      : "low",
    symptoms: Array.isArray(result.symptoms) ? result.symptoms : [],
    causes: Array.isArray(result.causes) ? result.causes : [],
    fertilizer: {
      name: typeof result.fertilizer?.name === "string" ? result.fertilizer.name : "",
      purpose: typeof result.fertilizer?.purpose === "string" ? result.fertilizer.purpose : "",
    },
    pesticide: {
      name: typeof result.pesticide?.name === "string" ? result.pesticide.name : "",
      purpose: typeof result.pesticide?.purpose === "string" ? result.pesticide.purpose : "",
    },
    immediateActions: Array.isArray(result.immediateActions) ? result.immediateActions : [],
    treatment: Array.isArray(result.treatment) ? result.treatment : [],
    prevention: Array.isArray(result.prevention) ? result.prevention : [],
    expertAdvice: typeof result.expertAdvice === "string" ? result.expertAdvice : "",
    safetyNote: typeof result.safetyNote === "string" ? result.safetyNote : "This AI result is not a final diagnosis.",
  };
}

const CROP_RECOMMENDATIONS = [
  {
    name: "Rice",
    soil: ["Loamy Soil", "Clay Soil"],
    water: ["High", "Moderate"],
    climate: ["Humid", "Coastal"],
    land: ["Lowland", "Irrigated"],
    note: "Ideal for wet, irrigated lowlands and humid conditions.",
  },
  {
    name: "Maize",
    soil: ["Loamy Soil", "Black Soil", "Red Soil"],
    water: ["Moderate", "High"],
    climate: ["Semi-arid", "Temperate"],
    land: ["Irrigated", "Upland"],
    note: "Balanced crop that grows well with moderate water and open sunlight.",
  },
  {
    name: "Cotton",
    soil: ["Black Soil", "Sandy Soil", "Loamy Soil"],
    water: ["Low", "Moderate"],
    climate: ["Dry", "Semi-arid"],
    land: ["Rainfed", "Upland"],
    note: "Suitable for warm climates and soils that drain well.",
  },
  {
    name: "Groundnut",
    soil: ["Red Soil", "Sandy Soil", "Loamy Soil"],
    water: ["Low", "Moderate"],
    climate: ["Semi-arid", "Dry"],
    land: ["Rainfed", "Upland"],
    note: "Works well in dry, warm fields with moderate moisture.",
  },
  {
    name: "Chilli",
    soil: ["Black Soil", "Loamy Soil", "Red Soil"],
    water: ["Moderate", "High"],
    climate: ["Humid", "Semi-arid", "Coastal"],
    land: ["Irrigated", "Upland"],
    note: "Produces better when water and nutrient support are steady.",
  },
  {
    name: "Turmeric",
    soil: ["Black Soil", "Loamy Soil"],
    water: ["Moderate", "High"],
    climate: ["Humid", "Coastal"],
    land: ["Irrigated", "Lowland"],
    note: "A moisture-loving crop that benefits from rich, well-drained soils.",
  },
  {
    name: "Red Gram",
    soil: ["Black Soil", "Red Soil", "Loamy Soil"],
    water: ["Low", "Moderate"],
    climate: ["Semi-arid", "Dry"],
    land: ["Rainfed", "Upland"],
    note: "A hardy pulse crop with low water needs and good drought tolerance.",
  },
  {
    name: "Soybean",
    soil: ["Black Soil", "Loamy Soil"],
    water: ["Moderate", "High"],
    climate: ["Semi-arid", "Humid"],
    land: ["Irrigated", "Upland"],
    note: "Performs best in warm, moderately moist fields with good drainage.",
  },
  {
    name: "Wheat",
    soil: ["Loamy Soil", "Clay Soil"],
    water: ["Moderate", "High"],
    climate: ["Temperate", "Semi-arid"],
    land: ["Irrigated", "Upland"],
    note: "A strong winter crop for fertile, well-managed fields.",
  },
  {
    name: "Sugarcane",
    soil: ["Loamy Soil", "Clay Soil", "Black Soil"],
    water: ["High", "Moderate"],
    climate: ["Humid", "Semi-arid"],
    land: ["Irrigated", "Lowland"],
    note: "A high-water crop that performs best with consistent irrigation.",
  },
  {
    name: "Bajra",
    soil: ["Sandy Soil", "Red Soil", "Loamy Soil"],
    water: ["Low", "Moderate"],
    climate: ["Dry", "Semi-arid"],
    land: ["Rainfed", "Upland"],
    note: "Excellent for dry and drought-prone conditions.",
  },
  {
    name: "Vegetables",
    soil: ["Loamy Soil", "Black Soil", "Red Soil"],
    water: ["Moderate", "High"],
    climate: ["Humid", "Temperate", "Coastal"],
    land: ["Irrigated", "Lowland"],
    note: "High-value crops that need consistent moisture and nutrient management.",
  },
];

function ResultList({ title, items }) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  return (
    <div className="mt-5">
      <h3 className="font-bold text-green-800">{title}</h3>
      <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-700">
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\p{Script=Devanagari}\p{Script=Telugu}]+/gu, " ")
    .trim();
}

function recommendationTokens(recommendation) {
  return normalizeText(`${recommendation?.name || ""} ${recommendation?.purpose || ""}`)
    .split(" ")
    .filter((token) => token.length >= 4);
}

function findMatchingProducts(products, recommendation, category) {
  const tokens = recommendationTokens(recommendation);
  const categoryProducts = products.filter(
    (product) =>
      normalizeText(product.category) === normalizeText(category) &&
      Number(product.quantity || 0) > 0 &&
      product.status !== "out_of_stock"
  );

  const scored = categoryProducts
    .map((product) => {
      const searchableText = normalizeText(
        `${product.productName || ""} ${product.brand || ""} ${
          product.description || ""
        }`
      );
      const score = tokens.reduce(
        (total, token) => (searchableText.includes(token) ? total + 1 : total),
        0
      );
      return { product, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((first, second) => second.score - first.score);

  if (scored.length > 0) {
    return scored.slice(0, 3).map((entry) => entry.product);
  }

  return categoryProducts.slice(0, 3);
}

function getSoilMatches(soilType) {
  const value = String(soilType || "").trim();
  if (!value) {
    return [];
  }

  const normalized = value.toLowerCase();
  if (normalized.includes("black")) return ["Black Soil"];
  if (normalized.includes("red")) return ["Red Soil"];
  if (normalized.includes("sandy")) return ["Sandy Soil"];
  if (normalized.includes("loam")) return ["Loamy Soil"];
  if (normalized.includes("clay")) return ["Clay Soil"];
  return [value];
}

function getWaterAvailability(irrigationType, fallback = "Moderate") {
  const irrigation = String(irrigationType || "").trim().toLowerCase();
  if (!irrigation) {
    return fallback;
  }

  if (["rainfed", "tank"].includes(irrigation)) {
    return "Low";
  }

  if (["borewell", "sprinkler", "canal"].includes(irrigation)) {
    return "Moderate";
  }

  if (["drip"].includes(irrigation)) {
    return "High";
  }

  return fallback;
}

function inferClimateZone(profile = {}) {
  const district = String(profile.district || "").toLowerCase();
  const state = String(profile.state || "").toLowerCase();

  if (/[coastal|kerala|odisha|andhra|tamil|goa|karnataka]/.test(`${district} ${state}`)) {
    return "Coastal";
  }

  if (/[telangana|rajasthan|gujarat|maharashtra|karnataka|madhya|andhra|punjab|haryana]/.test(`${district} ${state}`)) {
    return "Semi-arid";
  }

  if (/[west bengal|assam|kerala|odisha]/.test(`${district} ${state}`)) {
    return "Humid";
  }

  return "Semi-arid";
}

function recommendCropsForProfile(profile, selectedValues = {}) {
  const cropRecommendations = CROP_RECOMMENDATIONS.map((crop) => {
    const soilMatches = getSoilMatches(selectedValues.soilType || profile.soilType)
      .some((soil) => crop.soil.includes(soil));

    const waterLevel = selectedValues.waterAvailability || getWaterAvailability(profile.irrigationType, "Moderate");
    const climateZone = selectedValues.climateZone || inferClimateZone(profile);
    const landType = selectedValues.landType || (profile.irrigationType === "Rainfed" ? "Rainfed" : "Irrigated");

    const soilScore = soilMatches ? 5 : 0;
    const waterScore = crop.water.includes(waterLevel) ? 4 : 0;
    const climateScore = crop.climate.includes(climateZone) ? 3 : 0;
    const landScore = crop.land.includes(landType) ? 2 : 0;
    const cropNameScore = (profile.mainCrop && profile.mainCrop.toLowerCase() === crop.name.toLowerCase()) ? 2 : 0;

    const totalScore = soilScore + waterScore + climateScore + landScore + cropNameScore;
    const reasons = [];

    if (soilMatches) reasons.push("Matches your soil type");
    if (crop.water.includes(waterLevel)) reasons.push("Suitable for your water availability");
    if (crop.climate.includes(climateZone)) reasons.push(`Works in ${climateZone} climate`);
    if (crop.land.includes(landType)) reasons.push(`Fits ${landType} land conditions`);
    if (profile.mainCrop && profile.mainCrop.toLowerCase() === crop.name.toLowerCase()) {
      reasons.push("Matches your current crop focus");
    }

    return {
      ...crop,
      totalScore,
      reasons: reasons.length > 0 ? reasons : ["Good general option for local farming conditions"],
    };
  });

  return cropRecommendations
    .filter((crop) => crop.totalScore > 0)
    .sort((first, second) => second.totalScore - first.totalScore)
    .slice(0, 4);
}

function getCropInputGuidance(crop, soilType) {
  const legumes = ["Groundnut", "Red Gram", "Soybean"].includes(crop.name);
  const soil = String(soilType || "").toLowerCase();
  const soilCare = soil.includes("sandy")
    ? "Sandy soil: build organic matter and avoid applying nutrients in one large dose; follow local split-application advice."
    : soil.includes("clay") || soil.includes("black")
      ? "Clay/black soil: maintain drainage and avoid over-irrigation; base nutrient amendments on a soil test."
      : soil.includes("red")
        ? "Red soil: check organic carbon and soil-test nutrient status before choosing amendments."
        : "Use a soil test to choose nutrient sources and rates; maintain organic matter and suitable drainage.";

  return {
    fertilizer: legumes
      ? `For ${crop.name}, ask your local agriculture office about crop-appropriate seed inoculation and apply nutrients only as indicated by the soil test. ${soilCare}`
      : `For ${crop.name}, use a crop-specific NPK and organic-manure plan based on the soil test and local crop calendar. ${soilCare}`,
    pesticide: "No pesticide can be selected from soil/land type alone. Monitor the crop, identify the pest or disease first, and use locally approved integrated pest management advice only when needed.",
  };
}

function ProductCard({ product, onOpen }) {
  return (
    <article className="border border-green-200 rounded-2xl p-4 bg-white">
      <div className="flex gap-4">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.productName || "Dealer product"}
            className="w-24 h-24 object-contain bg-gray-50 border rounded-xl"
          />
        ) : (
          <div className="w-24 h-24 flex items-center justify-center bg-green-50 rounded-xl text-3xl">
            🌾
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-green-900">
            {product.productName || "Product"}
          </h4>
          <p className="text-sm text-gray-600 mt-1">
            {product.brand || product.category || ""}
          </p>
          <p className="font-semibold mt-2">
            ₹{Number(product.price || 0).toFixed(2)} / {product.unit || "unit"}
          </p>
          <p className="text-sm text-green-700 mt-1">
            Stock: {Number(product.quantity || 0)}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="w-full bg-green-700 text-white rounded-xl py-2.5 mt-4 font-semibold hover:bg-green-800 transition"
      >
        View from Dealer
      </button>
    </article>
  );
}

export default function CropDiseasePage() {
  const language = useLanguage();
  const navigate = useNavigate();
  const [photo, setPhoto] = useState(null);
  const [preparedPhoto, setPreparedPhoto] = useState(null);
  const [preview, setPreview] = useState("");
  const [cropName, setCropName] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processingStage, setProcessingStage] = useState("");
  const [error, setError] = useState("");
  const [dealerProducts, setDealerProducts] = useState([]);
  const [matchingPesticides, setMatchingPesticides] = useState([]);
  const [matchingFertilizers, setMatchingFertilizers] = useState([]);
  const [profile, setProfile] = useState({});
  const [recommendationInputs, setRecommendationInputs] = useState({
    soilType: "",
    waterAvailability: "",
    climateZone: "",
    landType: "",
  });
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [recommendationError, setRecommendationError] = useState("");
  const [landPhoto, setLandPhoto] = useState(null);
  const [landPhotoPreview, setLandPhotoPreview] = useState("");
  const [landAnalysis, setLandAnalysis] = useState(null);
  const [landAnalysisLoading, setLandAnalysisLoading] = useState(false);
  const [landAnalysisStage, setLandAnalysisStage] = useState("");
  const [landAnalysisError, setLandAnalysisError] = useState("");
  const cropFileInput = useRef(null);
  const landFileInput = useRef(null);
  const cameraVideo = useRef(null);
  const cameraStream = useRef(null);
  const [cameraTarget, setCameraTarget] = useState("");
  const recommendationResults = useMemo(() => {
    if (!landAnalysis) return [];
    return recommendCropsForProfile(profile, recommendationInputs);
  }, [landAnalysis, profile, recommendationInputs]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setProfile({});
        setRecommendationError(t("cropRecommendationLoginRequired", {}, language));
        return;
      }

      try {
        setRecommendationLoading(true);
        const profileSnapshot = await get(ref(database, `farmers/${user.uid}`));
        const farmerData = profileSnapshot.exists() ? profileSnapshot.val() : {};

        setProfile(farmerData);
        setRecommendationInputs((current) => ({
          soilType: current.soilType || farmerData.soilType || "",
          waterAvailability: current.waterAvailability || getWaterAvailability(farmerData.irrigationType, "Moderate"),
          climateZone: current.climateZone || inferClimateZone(farmerData),
          landType: current.landType || (farmerData.irrigationType === "Rainfed" ? "Rainfed" : "Irrigated"),
        }));
      } catch (profileError) {
        console.error("Farm profile loading error:", profileError);
        setRecommendationError(t("cropRecommendationLoadFailed", {}, language));
      } finally {
        setRecommendationLoading(false);
      }
    });

    return () => unsubscribe();
  }, [language]);

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  useEffect(() => {
    return () => {
      if (landPhotoPreview) URL.revokeObjectURL(landPhotoPreview);
    };
  }, [landPhotoPreview]);

  useEffect(() => {
    if (cameraVideo.current && cameraStream.current) {
      cameraVideo.current.srcObject = cameraStream.current;
      cameraVideo.current.play().catch(() => {});
    }
  }, [cameraTarget]);

  useEffect(() => () => {
    cameraStream.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function openCamera(target) {
    const setTargetError = target === "land" ? setLandAnalysisError : setError;
    setTargetError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setTargetError("Camera access is unavailable. Use Choose photo to select an image.");
      return;
    }
    try {
      cameraStream.current?.getTracks().forEach((track) => track.stop());
      cameraStream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      setCameraTarget(target);
    } catch (cameraError) {
      setTargetError(cameraError.name === "NotAllowedError"
        ? "Camera permission was denied. Allow camera access or choose a photo file."
        : "Could not open the camera. Use Choose photo to select an image.");
    }
  }

  function closeCamera() {
    cameraStream.current?.getTracks().forEach((track) => track.stop());
    cameraStream.current = null;
    setCameraTarget("");
  }

  function captureCameraPhoto() {
    const video = cameraVideo.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `${cameraTarget}-photo.jpg`, { type: "image/jpeg" });
      const selectionEvent = { target: { files: [file] } };
      if (cameraTarget === "land") selectLandPhoto(selectionEvent);
      else selectPhoto(selectionEvent);
      closeCamera();
    }, "image/jpeg", 0.9);
  }

  function selectPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid JPG, PNG or WEBP image.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("The image must be smaller than 10 MB.");
      return;
    }

    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setPhoto(file);
    setPreparedPhoto(null);
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setMatchingPesticides([]);
    setMatchingFertilizers([]);
    setError("");
    setProcessingStage("");
  }

  function selectLandPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLandAnalysisError("Please select a valid JPG, PNG or WEBP image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setLandAnalysisError("The image must be smaller than 10 MB.");
      return;
    }
    setLandPhoto(file);
    setLandPhotoPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
    setLandAnalysis(null);
    setLandAnalysisError("");
  }

  async function analyzeLandPhoto() {
    if (!landPhoto) return;
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      setLandAnalysisError("Land photo detection requires VITE_GEMINI_API_KEY.");
      return;
    }
    setLandAnalysisLoading(true);
    setLandAnalysisError("");
    try {
      setLandAnalysisStage("Preparing photo...");
      const optimizedPhoto = await optimizeLandPhoto(landPhoto);
      const { base64, mimeType } = await fileToBase64(optimizedPhoto);
      const outputLanguage = languageNames[getLanguage()] || "English";
      const prompt = `Inspect this farmland/soil photo. Estimate only visible soil texture/color and landform; do not claim lab-level certainty. If no soil or farmland is visible, set isLandPhoto false. Return only JSON in ${outputLanguage}: {"isLandPhoto":true,"soilType":"Black Soil|Red Soil|Sandy Soil|Loamy Soil|Clay Soil|Unclear","landType":"Irrigated|Rainfed|Lowland|Upland|Unclear","confidence":"high|medium|low","observation":""}. Mention visual uncertainty in observation.`;
      let lastError;
      const modelAttempts = MODELS.slice(0, 2);
      for (let modelIndex = 0; modelIndex < modelAttempts.length; modelIndex += 1) {
        const model = modelAttempts[modelIndex];
        const controller = new AbortController();
        // Vision requests can take longer on mobile networks. Keep the request
        // alive long enough for a normal response, then try one backup model.
        const timeoutId = window.setTimeout(() => controller.abort(), 30000);
        try {
          setLandAnalysisStage("Analyzing soil and land type...");
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{ role: "user", parts: [
                { inline_data: { mime_type: mimeType || "image/jpeg", data: base64 } },
                { text: prompt },
              ] }],
              generationConfig: {
                temperature: 0.2,
                responseMimeType: "application/json",
                maxOutputTokens: 256,
              },
            }),
          });
          const responseData = await response.json();
          if (!response.ok) {
            const error = new Error(responseData?.error?.message || `Land analysis failed (${response.status}).`);
            error.status = response.status;
            throw error;
          }
          const responseText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!responseText) throw new Error("The land analysis service returned no result.");
          const parsed = extractJson(responseText);
          if (!parsed.isLandPhoto) throw new Error("Please choose a clear photo showing soil or farmland.");
          const result = {
            soilType: ["Black Soil", "Red Soil", "Sandy Soil", "Loamy Soil", "Clay Soil"].includes(parsed.soilType) ? parsed.soilType : "Unclear",
            landType: ["Irrigated", "Rainfed", "Lowland", "Upland"].includes(parsed.landType) ? parsed.landType : "Unclear",
            confidence: ["high", "medium", "low"].includes(String(parsed.confidence).toLowerCase()) ? String(parsed.confidence).toLowerCase() : "low",
            observation: typeof parsed.observation === "string" ? parsed.observation : "",
          };
          setLandAnalysis(result);
          setRecommendationInputs((current) => ({
            ...current,
            soilType: result.soilType !== "Unclear" ? result.soilType : current.soilType,
            landType: result.landType !== "Unclear" ? result.landType : current.landType,
          }));
          return;
        } catch (error) {
          lastError = error;
          const mayRetry = error.name === "AbortError" ||
            error.status === 404 || error.status === 429 || error.status >= 500;
          if (!mayRetry || modelIndex === modelAttempts.length - 1) {
            throw error.name === "AbortError"
              ? new Error("Land detection timed out. Try a smaller, clearer photo.")
              : error;
          }
        } finally {
          window.clearTimeout(timeoutId);
        }
      }
      throw lastError || new Error("Land photo analysis is unavailable.");
    } catch (error) {
      setLandAnalysisError(error.message || "Land photo analysis failed. Please try another image.");
    } finally {
      setLandAnalysisStage("");
      setLandAnalysisLoading(false);
    }
  }

  async function optimizeLandPhoto(file) {
    const imageUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error("The land photo could not be opened."));
        element.src = imageUrl;
      });
      const maxDimension = 1024;
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("The land photo could not be prepared.");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.76));
      if (!blob) throw new Error("The land photo could not be compressed.");
      return new File([blob], "land-photo.jpg", { type: "image/jpeg" });
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || "");
        const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : "";
        if (!base64) {
          reject(new Error("The selected image could not be read."));
          return;
        }
        resolve({
          base64,
          mimeType: file.type || "image/jpeg",
        });
      };
      reader.onerror = () => {
        reject(new Error("The selected image could not be read."));
      };
      reader.readAsDataURL(file);
    });
  }

  async function enhanceWithPython(file) {
    const pythonApiUrl = getPythonApiUrl();
    const formData = new FormData();
    formData.append("file", file);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(`${pythonApiUrl}/enhance-image`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.detail || data?.message || "Python image enhancement failed.");
      }

      const base64 = data?.image?.base64;
      if (!base64) {
        throw new Error("The enhanced image was not returned.");
      }

      return {
        base64,
        mimeType: data?.image?.mimeType || "image/jpeg",
        enhanced: true,
        information: data?.information || null,
      };
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function prepareImage(file, needsEnhancement) {
    if (needsEnhancement) {
      setProcessingStage("Improving crop image...");
      try {
        return await enhanceWithPython(file);
      } catch (enhancementError) {
        console.warn("Python enhancement unavailable; analyzing the original crop photo:", enhancementError);
      }
    }

    const original = await fileToBase64(file);
    return {
      ...original,
      enhanced: false,
      information: null,
    };
  }

  async function loadDealerProducts() {
    try {
      const snapshot = await get(ref(database, "dealerProducts"));
      if (!snapshot.exists()) {
        setDealerProducts([]);
        return [];
      }

      const allProducts = [];
      Object.entries(snapshot.val()).forEach(([dealerUid, dealerValue]) => {
        Object.entries(dealerValue || {}).forEach(([productId, productValue]) => {
          allProducts.push({
            id: productId,
            dealerUid,
            ...productValue,
          });
        });
      });

      setDealerProducts(allProducts);
      return allProducts;
    } catch (productError) {
      console.error("Dealer products loading error:", productError);
      setDealerProducts([]);
      return [];
    }
  }

  async function detectDisease({ base64, mimeType }) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key is missing from the environment.");
    }

    const outputLanguage = languageNames[getLanguage()] || "English";

    const prompt = `
You are AgriSaathi, a cautious crop-health assistant for Indian farmers.
Analyze the supplied plant image.
Farmer-entered crop:
${cropName.trim() || "Unknown"}

Rules:
- First determine whether the image contains a crop, leaf or plant.
- Inspect the crop, affected plant part, lesion shape, color, edges, distribution and surrounding visible symptoms before deciding.
- Give the single best-supported likely diagnosis and explain the visible evidence in symptoms and expertAdvice. Do not return a generic "Uncertain" when the image supports a plausible diagnosis.
- Do not claim certainty or invent symptoms. If the photo truly lacks enough evidence for a responsible diagnosis, state exactly what is missing and give the best-supported possibilities with low confidence.
- When the farmer-entered crop is "Unknown", identify the crop only if visually clear; otherwise do not guess a crop-specific disease.
- If the plant appears healthy, use "Healthy" as the disease value.
- Recommend one commonly used pesticide active ingredient only when appropriate.
- Recommend one commonly used fertilizer only when nutrient support is relevant.
- If pesticide or fertilizer is not needed, keep its name and purpose empty.
- Do not recommend banned or highly restricted chemicals.
- Give only general, safe guidance.
- Never provide pesticide or fertilizer dosage.
- Tell the farmer to follow the product label and local agriculture-officer guidance.
- Mention when professional confirmation is needed.
- Write all farmer-facing values in ${outputLanguage}.
- Return only valid JSON.

Required JSON structure:
{
  "isPlant": true,
  "crop": "",
  "disease": "",
  "confidence": "",
  "symptoms": [],
  "causes": [],
  "fertilizer": {
    "name": "",
    "purpose": ""
  },
  "pesticide": {
    "name": "",
    "purpose": ""
  },
  "immediateActions": [],
  "treatment": [],
  "prevention": [],
  "expertAdvice": "",
  "safetyNote": ""
}
`.trim();

    let lastError = null;
    let sawTemporaryCapacityError = false;
    let lastCapacityError = null;
    // Leave enough time for backup models when the first one is overloaded.
    const analysisDeadline = Date.now() + 90_000;

    for (let modelIndex = 0; modelIndex < DISEASE_MODELS.length; modelIndex += 1) {
      const remainingTime = analysisDeadline - Date.now();
      if (remainingTime <= 0) break;

      const model = DISEASE_MODELS[modelIndex];
      const attempts = 1;

      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const requestTimeout = Math.min(modelIndex === 0 ? 20_000 : 12_000, analysisDeadline - Date.now());
        if (requestTimeout <= 0) break;
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), requestTimeout);

        try {
          setProcessingStage(
            modelIndex === 0
              ? "Checking crop health..."
              : `Trying backup crop model ${modelIndex} of ${DISEASE_MODELS.length - 1}...`
          );
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: controller.signal,
              body: JSON.stringify({
                contents: [{
                  role: "user",
                  parts: [
                    { inline_data: { mime_type: mimeType || "image/jpeg", data: base64 } },
                    { text: prompt },
                  ],
                }],
                generationConfig: {
                  thinkingConfig: { thinkingLevel: "high" },
                  responseMimeType: "application/json",
                },
              }),
            }
          );
          const data = await response.json();

          if (!response.ok) {
            const message = data?.error?.message || `Disease service failed with status ${response.status}.`;
            console.warn(`Disease model ${model} returned HTTP ${response.status}:`, message);
            const temporaryCapacityError = [408, 429, 500, 502, 503, 504].includes(response.status) ||
              /high demand|overloaded|temporarily unavailable|try again later/i.test(message);
            lastError = new Error(message);
            if (temporaryCapacityError) {
              sawTemporaryCapacityError = true;
              lastCapacityError = { status: response.status, message };
            }

            break;
          }

          const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!responseText) {
            lastError = new Error("The disease service returned no result.");
            break;
          }

          return validateAnalysis(extractJson(responseText));
        } catch (modelError) {
          console.warn(`Disease model ${model} failed; trying the next available model:`, modelError);
          lastError = modelError;
          if (modelError.name === "AbortError") {
            sawTemporaryCapacityError = true;
            break;
          }
          if (modelError instanceof TypeError) {
            sawTemporaryCapacityError = true;
          }
        } finally {
          window.clearTimeout(timeoutId);
        }
      }
    }

    if (sawTemporaryCapacityError) {
      const status = lastCapacityError?.status ? `HTTP ${lastCapacityError.status}: ` : "";
      const details = lastCapacityError?.message || lastError?.message || "The model service is temporarily unavailable.";
      throw new Error(`Crop analysis service error (${status}${details}). Your photo is still selected.`);
    }
    throw lastError || new Error("The image analysis service is unavailable.");
  }

  async function saveDiseaseReport(analysis, enhanced) {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return;
    }

    try {
      const reportReference = push(ref(database, "diseaseReports"));
      await set(reportReference, {
        farmerId: currentUser.uid,
        crop: analysis.crop || cropName.trim() || "Unknown",
        disease: analysis.disease || "Unknown",
        confidence: analysis.confidence || "low",
        imageEnhanced: Boolean(enhanced),
        createdAt: Date.now(),
      });
    } catch (saveError) {
      console.error("Disease report saving error:", saveError);
    }
  }

  async function analyze() {
    if (!photo) {
      setError(t("imageRequired", {}, language));
      return;
    }

    try {
      setLoading(true);
      setError("");
      setResult(null);
      setMatchingPesticides([]);
      setMatchingFertilizers([]);

      let image = preparedPhoto?.file === photo ? preparedPhoto.image : null;
      if (!image) {
        setProcessingStage("Checking crop photo clarity...");
        let needsEnhancement = false;
        try {
          ({ needsEnhancement } = await assessCropPhotoClarity(photo));
        } catch (clarityError) {
          console.warn("Crop photo clarity check failed; using the original photo:", clarityError);
        }
        image = await prepareImage(photo, needsEnhancement);
        setPreparedPhoto({ file: photo, image });
      }
      const analysis = await detectDisease(image);

      if (!analysis.isPlant) {
        setError(
          t("photoNotClearPlant", {}, language)
        );
        return;
      }

      setResult(analysis);

      const products = dealerProducts.length > 0 ? dealerProducts : await loadDealerProducts();

      setMatchingPesticides(
        findMatchingProducts(products, analysis.pesticide, "Pesticide")
      );

      setMatchingFertilizers(
        findMatchingProducts(products, analysis.fertilizer, "Fertilizer")
      );

      await saveDiseaseReport(analysis, image.enhanced);

    } catch (analysisError) {
      console.error("Crop disease detection error:", analysisError);
      setError(
        analysisError?.name === "AbortError"
          ? t("imageImproveTimeout", {}, language)
          : analysisError?.message || t("diseaseDetectionFailed", {}, language)
      );
    } finally {
      setLoading(false);
      setProcessingStage("");
    }
  }

  return (
    <div className="crop-disease-page min-h-screen p-4 pb-10 sm:p-6">
      <div className="crop-disease-content mx-auto">
        {/* Header */}
        <header className="crop-disease-hero relative isolate overflow-hidden rounded-2xl p-5 text-white shadow-lg sm:rounded-3xl sm:p-7">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="text-sm font-semibold text-green-100 hover:text-white transition"
          >
            {t("back", {}, language)}
          </button>
          <h1 className="text-2xl font-bold mt-3">
            {t("cropDiseasePageTitle", {}, language)}
          </h1>
          <p className="text-sm text-green-100 mt-1">
            {t("cropDiseasePageIntro", {}, language)}
          </p>
        </header>

        <div className="crop-disease-workspace mt-5">
        {/* Upload Section */}
        <section className="crop-disease-card crop-disease-upload rounded-2xl p-5 sm:p-6">
          <label className="block font-semibold text-gray-700">
            {t("cropNameOptional", {}, language)}
          </label>
          <input
            type="text"
            value={cropName}
            disabled={loading}
            onChange={(event) => setCropName(event.target.value)}
            placeholder={t("cropNameExample", {}, language)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-2 focus:outline-none focus:ring-2 focus:ring-green-600 disabled:bg-gray-100"
          />

          <label className="block font-semibold text-gray-700 mt-5">
            {t("cropOrLeafPhoto", {}, language)}
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => openCamera("crop")} disabled={loading} className="crop-disease-action-button rounded-lg px-4 py-2.5 text-sm font-semibold">{t("takeCropPhotoLabel", {}, language)}</button>
            <button type="button" onClick={() => cropFileInput.current?.click()} disabled={loading} className="crop-disease-secondary-button rounded-lg px-4 py-2.5 text-sm font-semibold">{t("chooseCropPhotoLabel", {}, language)}</button>
          </div>
          <input ref={cropFileInput} type="file" accept="image/jpeg,image/png,image/webp" disabled={loading} onChange={selectPhoto} className="hidden" />

          <p className="text-sm text-gray-500 mt-2">
            {t("imageAutoEnhancement", {}, language)}
          </p>

          {!preview && !loading && (
            <div className="crop-disease-visual-stage mt-5">
              <div className="crop-disease-visual-copy">
                <span className="crop-disease-visual-kicker">FIELD HEALTH · PHOTO ANALYSIS</span>
                <h2>Give your crop a closer look</h2>
                <p>Choose a clear leaf photo to get started with crop health guidance.</p>
                <span className="crop-disease-visual-hint"><span aria-hidden="true">✦</span> Clear leaf photos work best</span>
              </div>
              <svg className="crop-disease-plant-art" viewBox="0 0 360 220" role="img" aria-label="A young crop growing in a field">
                <defs>
                  <linearGradient id="crop-leaf-gradient" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#8edc78" />
                    <stop offset="1" stopColor="#16834e" />
                  </linearGradient>
                  <linearGradient id="crop-field-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#c2e9ad" />
                    <stop offset="1" stopColor="#e9f6df" />
                  </linearGradient>
                </defs>
                <circle className="crop-disease-sun" cx="278" cy="48" r="24" />
                <path className="crop-disease-field" d="M0 151 Q80 126 164 151 T360 147 V220 H0Z" />
                <path className="crop-disease-field-line crop-disease-field-line--one" d="M8 180 Q94 151 177 179 T352 173" />
                <path className="crop-disease-field-line crop-disease-field-line--two" d="M-2 198 Q87 172 177 197 T362 193" />
                <path className="crop-disease-stem" d="M180 177 C176 146 180 117 181 91 C182 76 180 64 178 53" />
                <path className="crop-disease-leaf crop-disease-leaf--left" d="M180 132 C145 132 119 113 117 87 C145 86 171 100 180 132Z" />
                <path className="crop-disease-leaf crop-disease-leaf--right" d="M181 106 C188 77 211 59 240 64 C235 91 212 108 181 106Z" />
                <path className="crop-disease-leaf crop-disease-leaf--top" d="M179 77 C157 61 153 37 166 18 C188 33 195 55 179 77Z" />
                <path className="crop-disease-leaf-vein" d="M180 129 Q153 107 129 92 M183 103 Q207 83 229 70 M179 76 Q173 51 168 27" />
                <circle className="crop-disease-sparkle crop-disease-sparkle--one" cx="91" cy="56" r="3" />
                <circle className="crop-disease-sparkle crop-disease-sparkle--two" cx="305" cy="112" r="4" />
                <circle className="crop-disease-sparkle crop-disease-sparkle--three" cx="118" cy="129" r="2.5" />
              </svg>
            </div>
          )}

          {preview && (
            <img
              src={preview}
              alt={t("detectedCrop", {}, language)}
              className="w-full max-h-80 object-contain bg-gray-50 rounded-xl mt-4"
            />
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mt-4" role="alert">
              ❌ {error}
            </div>
          )}

          <button
            type="button"
            onClick={analyze}
            disabled={loading || !photo}
            className="crop-disease-action-button crop-disease-detect-button mt-5 w-full rounded-xl py-3.5 font-bold"
          >
            {loading
              ? processingStage || t("processingPhoto", {}, language)
              : t("detectDiseaseButton", {}, language)}
          </button>
        </section>

        <section className="crop-disease-card crop-disease-recommendation rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm text-green-700 font-semibold uppercase tracking-wide">
                {t("cropRecommendationBadge", {}, language)}
              </p>
              <h2 className="text-xl font-bold text-green-900 mt-1">
                {t("cropRecommendationTitle", {}, language)}
              </h2>
            </div>
          </div>

          <p className="text-sm text-gray-600 mt-2">
            {t("cropRecommendationSubtitle", {}, language)}
          </p>

          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4">
            <label className="block text-sm font-semibold text-gray-800">
              {t("landPhotoDetectionLabel", {}, language)}
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => openCamera("land")} disabled={landAnalysisLoading} className="crop-disease-action-button rounded-lg px-4 py-2.5 text-sm font-semibold">{t("takeLandPhotoLabel", {}, language)}</button>
              <button type="button" onClick={() => landFileInput.current?.click()} disabled={landAnalysisLoading} className="crop-disease-secondary-button rounded-lg px-4 py-2.5 text-sm font-semibold">{t("chooseLandPhotoLabel", {}, language)}</button>
            </div>
            <input ref={landFileInput} type="file" accept="image/jpeg,image/png,image/webp" disabled={landAnalysisLoading} onChange={selectLandPhoto} className="hidden" />
            {landPhotoPreview && (
            <img src={landPhotoPreview} alt={t("landPhotoDetectionLabel", {}, language)} className="mt-3 max-h-64 w-full rounded-lg bg-white object-contain" />
            )}
            <p className="mt-2 text-xs text-gray-600">
              {t("soilEstimateDisclaimer", {}, language)}
            </p>
            {landAnalysisError && <p role="alert" className="mt-2 text-sm text-red-700">{landAnalysisError}</p>}
            {landAnalysis && (
              <p className="mt-2 text-sm text-green-900">
                Estimated {landAnalysis.soilType} soil, {landAnalysis.landType} land ({landAnalysis.confidence} confidence). {landAnalysis.observation}
              </p>
            )}
            <button
              type="button"
              onClick={analyzeLandPhoto}
              disabled={!landPhoto || landAnalysisLoading}
              className="crop-disease-action-button mt-3 rounded-lg px-4 py-2.5 text-sm font-semibold"
            >
              {landAnalysisLoading ? (landAnalysisStage || t("detectingLandLabel", {}, language)) : t("detectLandLabel", {}, language)}
            </button>
          </div>

          {recommendationError && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 mt-4 text-sm">
              ⚠️ {recommendationError}
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {t("cropRecommendationSoil", {}, language)}
              </label>
              <select
                value={recommendationInputs.soilType || ""}
                onChange={(event) =>
                  setRecommendationInputs((current) => ({
                    ...current,
                    soilType: event.target.value,
                  }))
                }
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-600"
              >
                <option value="">{t("cropRecommendationSelectSoil", {}, language)}</option>
                <option value="Black Soil">{t("blackSoilLabel", {}, language)}</option>
                <option value="Red Soil">{t("redSoilLabel", {}, language)}</option>
                <option value="Sandy Soil">{t("sandySoilLabel", {}, language)}</option>
                <option value="Loamy Soil">{t("loamySoilLabel", {}, language)}</option>
                <option value="Clay Soil">{t("claySoilLabel", {}, language)}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {t("cropRecommendationWater", {}, language)}
              </label>
              <select
                value={recommendationInputs.waterAvailability || ""}
                onChange={(event) =>
                  setRecommendationInputs((current) => ({
                    ...current,
                    waterAvailability: event.target.value,
                  }))
                }
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-600"
              >
                <option value="">{t("cropRecommendationSelectWater", {}, language)}</option>
                <option value="Low">{t("lowLabel", {}, language)}</option>
                <option value="Moderate">{t("moderateLabel", {}, language)}</option>
                <option value="High">{t("highLabel", {}, language)}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {t("cropRecommendationClimate", {}, language)}
              </label>
              <select
                value={recommendationInputs.climateZone || ""}
                onChange={(event) =>
                  setRecommendationInputs((current) => ({
                    ...current,
                    climateZone: event.target.value,
                  }))
                }
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-600"
              >
                <option value="">{t("cropRecommendationSelectClimate", {}, language)}</option>
                <option value="Dry">{t("dryLabel", {}, language)}</option>
                <option value="Semi-arid">{t("semiAridLabel", {}, language)}</option>
                <option value="Humid">{t("humidLabel", {}, language)}</option>
                <option value="Coastal">{t("coastalLabel", {}, language)}</option>
                <option value="Temperate">{t("temperateLabel", {}, language)}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {t("cropRecommendationLand", {}, language)}
              </label>
              <select
                value={recommendationInputs.landType || ""}
                onChange={(event) =>
                  setRecommendationInputs((current) => ({
                    ...current,
                    landType: event.target.value,
                  }))
                }
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-600"
              >
                <option value="">{t("cropRecommendationSelectLand", {}, language)}</option>
                <option value="Irrigated">{t("irrigatedLabel", {}, language)}</option>
                <option value="Rainfed">{t("rainfedLabel", {}, language)}</option>
                <option value="Lowland">{t("lowlandLabel", {}, language)}</option>
                <option value="Upland">{t("uplandLabel", {}, language)}</option>
              </select>
            </div>
          </div>

          {recommendationLoading ? (
            <div className="mt-4 text-sm text-gray-600">
              {t("cropRecommendationLoading", {}, language)}
            </div>
          ) : recommendationResults.length > 0 ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {recommendationResults.map((crop) => {
                const guidance = getCropInputGuidance(crop, recommendationInputs.soilType || profile.soilType);
                return (
                  <article key={crop.name} className="border border-green-200 rounded-2xl p-4 bg-green-50">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-bold text-green-900">{crop.name}</h3>
                    <span className="bg-green-700 text-white px-2 py-1 rounded-full text-xs font-semibold">
                      {crop.totalScore}/16 match points
                    </span>
                  </div>

                  <p className="text-sm text-gray-700 mt-2">{crop.note}</p>

                  <ul className="mt-3 space-y-1 text-sm text-gray-700 list-disc pl-5">
                    {crop.reasons.map((reason) => (
                      <li key={`${crop.name}-${reason}`}>{reason}</li>
                    ))}
                  </ul>
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-white p-3">
                    <h4 className="text-sm font-semibold text-emerald-900">{t("fertilizerGuidanceLabel", {}, language)}</h4>
                    <p className="mt-1 text-sm text-gray-700">{guidance.fertilizer}</p>
                  </div>
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <h4 className="text-sm font-semibold text-amber-900">{t("pestControlLabel", {}, language)}</h4>
                    <p className="mt-1 text-sm text-amber-900">{guidance.pesticide}</p>
                  </div>
                  </article>
                );
              })}
            </div>
          ) : !landAnalysis ? (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              {t("landPhotoInstruction", {}, language)}
            </div>
          ) : (
            <div className="mt-4 text-sm text-gray-600">
              {t("cropRecommendationNoMatch", {}, language)}
            </div>
          )}
        </section>
        </div>

        {/* Results Section */}
        {result && (
          <section className="crop-disease-card crop-disease-results mt-5 rounded-2xl p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">{t("detectedCrop", {}, language)}</p>
                <h2 className="text-2xl font-bold text-green-800 mt-1">
                  {result.crop || "Unknown"}
                </h2>
              </div>
              <span className={`px-3 py-1.5 rounded-full text-sm font-semibold capitalize ${
                result.confidence === "high"
                  ? "bg-green-100 text-green-800"
                  : result.confidence === "medium"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-red-100 text-red-800"
              }`}>
                {result.confidence} confidence
              </span>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mt-5">
              <p className="text-sm text-yellow-800">{t("possibleCondition", {}, language)}</p>
              <p className="text-xl font-bold text-yellow-900 mt-1">
                {result.disease || "Unknown"}
              </p>
            </div>

            <ResultList title={t("visibleSymptoms", {}, language)} items={result.symptoms} />
            <ResultList title={t("likelyCauses", {}, language)} items={result.causes} />
            <ResultList title={t("immediateActions", {}, language)} items={result.immediateActions} />

            {/* Pesticide Recommendation */}
            {result.pesticide?.name && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mt-5">
                <p className="text-sm text-red-700">{t("recommendedPesticide", {}, language)}</p>
                <h3 className="text-lg font-bold text-red-900 mt-1">
                  {result.pesticide.name}
                </h3>
                {result.pesticide.purpose && (
                  <p className="text-sm text-red-800 mt-2">{result.pesticide.purpose}</p>
                )}
              </div>
            )}

            {matchingPesticides.length > 0 && (
              <div className="mt-4 space-y-3">
                <h3 className="font-bold text-green-800">{t("availablePesticides", {}, language)}</h3>
                {matchingPesticides.map((product) => (
                  <ProductCard
                    key={`${product.dealerUid}-${product.id}`}
                    product={product}
                    onOpen={() => navigate("/farmer/dealer-products")}
                  />
                ))}
              </div>
            )}

            {/* Fertilizer Recommendation */}
            {result.fertilizer?.name && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mt-5">
                <p className="text-sm text-emerald-700">{t("recommendedFertilizer", {}, language)}</p>
                <h3 className="text-lg font-bold text-emerald-900 mt-1">
                  {result.fertilizer.name}
                </h3>
                {result.fertilizer.purpose && (
                  <p className="text-sm text-emerald-800 mt-2">{result.fertilizer.purpose}</p>
                )}
              </div>
            )}

            {matchingFertilizers.length > 0 && (
              <div className="mt-4 space-y-3">
                <h3 className="font-bold text-green-800">{t("availableFertilizers", {}, language)}</h3>
                {matchingFertilizers.map((product) => (
                  <ProductCard
                    key={`${product.dealerUid}-${product.id}`}
                    product={product}
                    onOpen={() => navigate("/farmer/dealer-products")}
                  />
                ))}
              </div>
            )}

            <ResultList title={t("treatmentGuidance", {}, language)} items={result.treatment} />
            <ResultList title={t("prevention", {}, language)} items={result.prevention} />

            {result.expertAdvice && (
              <div className="bg-blue-50 text-blue-900 rounded-xl p-4 mt-5">
                <strong>Expert advice:</strong> {result.expertAdvice}
              </div>
            )}

            <p className="text-sm text-gray-600 border-t mt-5 pt-4">
              ⚠️ {result.safetyNote || "This AI result is not a final diagnosis. Confirm serious or spreading disease with a agriculture officer."}
            </p>
          </section>
        )}

        {/* Detection History Link */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="text-green-700 font-semibold hover:underline"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
      {cameraTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label={cameraTarget === "land" ? "Land camera" : "Crop camera"}>
          <div className="w-full max-w-xl rounded-xl bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-gray-900">{cameraTarget === "land" ? t("takeLandPhotoLabel", {}, language) : t("takeCropPhotoLabel", {}, language)}</h2>
            <button type="button" onClick={closeCamera} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">{t("cancel", {}, language)}</button>
            </div>
            <video ref={cameraVideo} autoPlay playsInline className="max-h-[65vh] w-full rounded-lg bg-black object-contain" />
            <button type="button" onClick={captureCameraPhoto} className="mt-3 w-full rounded-lg bg-green-700 px-4 py-3 font-semibold text-white hover:bg-green-800">{t("capturePhotoLabel", {}, language)}</button>
          </div>
        </div>
      )}
    </div>
  );
}
