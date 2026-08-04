import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get, push, ref, set } from "firebase/database";

import { auth, database } from "../../firebase";
import { getLanguage } from "../../utils/language";

const MODELS = [
  "gemini-2.5-flash",
  "gemini-1.5-flash",
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
  const configuredUrl =
    import.meta.env.VITE_PYTHON_API_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }

  if (typeof window === "undefined") {
    return "http://127.0.0.1:8000";
  }

  const hostname = window.location.hostname;

  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1"
  ) {
    return "http://127.0.0.1:8000";
  }

  return `http://${hostname}:8000`;
}

function extractJson(responseText) {
  if (
    typeof responseText !== "string" ||
    !responseText.trim()
  ) {
    throw new Error(
      "The disease service returned an empty response."
    );
  }

  const cleanedText = responseText
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const firstBrace = cleanedText.indexOf("{");
  const lastBrace = cleanedText.lastIndexOf("}");

  if (
    firstBrace === -1 ||
    lastBrace === -1 ||
    lastBrace <= firstBrace
  ) {
    throw new Error(
      "The disease result was not valid."
    );
  }

  return JSON.parse(
    cleanedText.slice(
      firstBrace,
      lastBrace + 1
    )
  );
}

function validateAnalysis(result) {
  if (
    !result ||
    typeof result !== "object"
  ) {
    throw new Error(
      "The disease result was invalid."
    );
  }

  return {
    isPlant: result.isPlant !== false,

    crop:
      typeof result.crop === "string"
        ? result.crop
        : "Unknown",

    disease:
      typeof result.disease === "string"
        ? result.disease
        : "Unknown",

    confidence:
      ["high", "medium", "low"].includes(
        String(result.confidence).toLowerCase()
      )
        ? String(result.confidence).toLowerCase()
        : "low",

    symptoms: Array.isArray(result.symptoms)
      ? result.symptoms
      : [],

    causes: Array.isArray(result.causes)
      ? result.causes
      : [],

    fertilizer: {
      name:
        typeof result.fertilizer?.name === "string"
          ? result.fertilizer.name
          : "",
      purpose:
        typeof result.fertilizer?.purpose === "string"
          ? result.fertilizer.purpose
          : "",
    },

    pesticide: {
      name:
        typeof result.pesticide?.name === "string"
          ? result.pesticide.name
          : "",
      purpose:
        typeof result.pesticide?.purpose === "string"
          ? result.pesticide.purpose
          : "",
    },

    immediateActions: Array.isArray(
      result.immediateActions
    )
      ? result.immediateActions
      : [],

    treatment: Array.isArray(result.treatment)
      ? result.treatment
      : [],

    prevention: Array.isArray(result.prevention)
      ? result.prevention
      : [],

    expertAdvice:
      typeof result.expertAdvice === "string"
        ? result.expertAdvice
        : "",

    safetyNote:
      typeof result.safetyNote === "string"
        ? result.safetyNote
        : "This AI result is not a final diagnosis.",
  };
}

function ResultList({ title, items }) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  return (
    <div className="mt-5">
      <h3 className="font-bold text-green-800">
        {title}
      </h3>

      <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-700">
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}


function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097f\u0c00-\u0c7f]+/g, " ")
    .trim();
}

function recommendationTokens(recommendation) {
  return normalizeText(
    `${recommendation?.name || ""} ${recommendation?.purpose || ""}`
  )
    .split(" ")
    .filter((token) => token.length >= 4);
}

function findMatchingProducts(products, recommendation, category) {
  const tokens = recommendationTokens(recommendation);

  const categoryProducts = products.filter(
    (product) =>
      normalizeText(product.category) ===
        normalizeText(category) &&
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
        (total, token) =>
          searchableText.includes(token) ? total + 1 : total,
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
            📦
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
            ₹{Number(product.price || 0).toFixed(2)} /{" "}
            {product.unit || "unit"}
          </p>

          <p className="text-sm text-green-700 mt-1">
            Stock: {Number(product.quantity || 0)}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="w-full bg-green-700 text-white rounded-xl py-2.5 mt-4 font-semibold"
      >
        View from Dealer
      </button>
    </article>
  );
}

export default function CropDiseasePage() {
  const navigate = useNavigate();

  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState("");
  const [cropName, setCropName] = useState("");

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const [processingStage, setProcessingStage] =
    useState("");

  const [error, setError] = useState("");
  const [enhancementMessage, setEnhancementMessage] =
    useState("");

  const [dealerProducts, setDealerProducts] =
    useState([]);

  const [matchingPesticides, setMatchingPesticides] =
    useState([]);

  const [matchingFertilizers, setMatchingFertilizers] =
    useState([]);

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  function selectPhoto(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError(
        "Please select a valid JPG, PNG or WEBP image."
      );

      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError(
        "The image must be smaller than 10 MB."
      );

      return;
    }

    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setPhoto(file);
    setPreview(URL.createObjectURL(file));

    setResult(null);
    setMatchingPesticides([]);
    setMatchingFertilizers([]);
    setError("");
    setEnhancementMessage("");
    setProcessingStage("");
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const dataUrl = String(
          reader.result || ""
        );

        const base64 = dataUrl.includes(",")
          ? dataUrl.split(",")[1]
          : "";

        if (!base64) {
          reject(
            new Error(
              "The selected image could not be read."
            )
          );

          return;
        }

        resolve({
          base64,
          mimeType:
            file.type || "image/jpeg",
        });
      };

      reader.onerror = () => {
        reject(
          new Error(
            "The selected image could not be read."
          )
        );
      };

      reader.readAsDataURL(file);
    });
  }

  async function enhanceWithPython(file) {
    const pythonApiUrl = getPythonApiUrl();

    const formData = new FormData();
    formData.append("file", file);

    const controller =
      new AbortController();

    const timeoutId = window.setTimeout(
      () => controller.abort(),
      20000
    );

    try {
      const response = await fetch(
        `${pythonApiUrl}/enhance-image`,
        {
          method: "POST",
          body: formData,
          signal: controller.signal,
        }
      );

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(
          data?.detail ||
            data?.message ||
            "Python image enhancement failed."
        );
      }

      const base64 =
        data?.image?.base64;

      if (!base64) {
        throw new Error(
          "The enhanced image was not returned."
        );
      }

      return {
        base64,
        mimeType:
          data?.image?.mimeType ||
          "image/jpeg",
        enhanced: true,
        information:
          data?.information || null,
      };
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function prepareImage(file) {
    setProcessingStage(
      "Improving crop image..."
    );

    try {
      const enhanced =
        await enhanceWithPython(file);

      setEnhancementMessage(
        "Image was improved automatically before disease detection."
      );

      return enhanced;
    } catch (enhancementError) {
      console.warn(
        "Python enhancement unavailable:",
        enhancementError
      );

      setEnhancementMessage(
        "Automatic image improvement was unavailable. The original photo was analyzed."
      );

      const original =
        await fileToBase64(file);

      return {
        ...original,
        enhanced: false,
        information: null,
      };
    }
  }

  async function loadDealerProducts() {
    try {
      const snapshot = await get(
        ref(database, "dealerProducts")
      );

      if (!snapshot.exists()) {
        setDealerProducts([]);
        return [];
      }

      const allProducts = [];

      Object.entries(snapshot.val()).forEach(
        ([dealerUid, dealerValue]) => {
          Object.entries(dealerValue || {}).forEach(
            ([productId, productValue]) => {
              allProducts.push({
                id: productId,
                dealerUid,
                ...productValue,
              });
            }
          );
        }
      );

      setDealerProducts(allProducts);
      return allProducts;
    } catch (productError) {
      console.error(
        "Dealer products loading error:",
        productError
      );

      setDealerProducts([]);
      return [];
    }
  }

  async function detectDisease({
    base64,
    mimeType,
  }) {
    const apiKey =
      import.meta.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error(
        "Gemini API key is missing from the environment."
      );
    }

    const outputLanguage =
      languageNames[getLanguage()] ||
      "English";

    const prompt = `
You are AgriSaathi, a cautious crop-health assistant for Indian farmers.

Analyze the supplied plant image.

Farmer-entered crop:
${cropName.trim() || "Unknown"}

Rules:
- First determine whether the image contains a crop, leaf or plant.
- If the image is unclear, do not invent a disease.
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

    for (const model of MODELS) {
      try {
        setProcessingStage(
          "Checking crop health..."
        );

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              contents: [
                {
                  role: "user",

                  parts: [
                    {
                      inline_data: {
                        mime_type:
                          mimeType ||
                          "image/jpeg",

                        data: base64,
                      },
                    },

                    {
                      text: prompt,
                    },
                  ],
                },
              ],

              generationConfig: {
                temperature: 0.2,
                responseMimeType:
                  "application/json",
              },
            }),
          }
        );

        const data =
          await response.json();

        if (!response.ok) {
          lastError = new Error(
            data?.error?.message ||
              `Disease service failed with status ${response.status}.`
          );

          continue;
        }

        const responseText =
          data?.candidates?.[0]
            ?.content?.parts?.[0]
            ?.text;

        if (!responseText) {
          lastError = new Error(
            "The disease service returned no result."
          );

          continue;
        }

        return validateAnalysis(
          extractJson(responseText)
        );
      } catch (modelError) {
        console.error(
          `Disease model ${model} failed:`,
          modelError
        );

        lastError = modelError;
      }
    }

    throw (
      lastError ||
      new Error(
        "The image analysis service is unavailable."
      )
    );
  }

  async function saveDiseaseReport(
    analysis,
    enhanced
  ) {
    const currentUser =
      auth.currentUser;

    if (!currentUser) {
      return;
    }

    try {
      const reportReference = push(
        ref(database, "diseaseReports")
      );

      await set(reportReference, {
        farmerId: currentUser.uid,

        crop:
          analysis.crop ||
          cropName.trim() ||
          "Unknown",

        disease:
          analysis.disease ||
          "Unknown",

        confidence:
          analysis.confidence ||
          "low",

        imageEnhanced:
          Boolean(enhanced),

        createdAt: Date.now(),
      });
    } catch (saveError) {
      console.error(
        "Disease report saving error:",
        saveError
      );
    }
  }

  async function analyze() {
    if (!photo) {
      setError(
        "Upload a photo of the affected leaf or plant first."
      );

      return;
    }

    try {
      setLoading(true);
      setError("");
      setResult(null);
      setMatchingPesticides([]);
      setMatchingFertilizers([]);
      setEnhancementMessage("");

      const preparedImage =
        await prepareImage(photo);

      const analysis =
        await detectDisease(preparedImage);

      if (!analysis.isPlant) {
        setError(
          "A crop or plant was not clearly detected. Please take another photo showing the affected leaf or plant."
        );

        return;
      }

      setResult(analysis);

      const products =
        dealerProducts.length > 0
          ? dealerProducts
          : await loadDealerProducts();

      setMatchingPesticides(
        findMatchingProducts(
          products,
          analysis.pesticide,
          "Pesticide"
        )
      );

      setMatchingFertilizers(
        findMatchingProducts(
          products,
          analysis.fertilizer,
          "Fertilizer"
        )
      );

      await saveDiseaseReport(
        analysis,
        preparedImage.enhanced
      );
    } catch (analysisError) {
      console.error(
        "Crop disease detection error:",
        analysisError
      );

      setError(
        analysisError?.name ===
          "AbortError"
          ? "Image improvement took too long. Please try again."
          : analysisError?.message ||
              "Disease detection failed. Please try another photo."
      );
    } finally {
      setLoading(false);
      setProcessingStage("");
    }
  }

  return (
    <div className="min-h-screen bg-green-50 p-4 pb-10">
      <div className="max-w-xl mx-auto">
        <header className="bg-green-700 text-white rounded-2xl p-5 shadow-lg">
          <button
            type="button"
            onClick={() =>
              navigate("/dashboard")
            }
            className="text-sm font-semibold text-green-100"
          >
            ← Back
          </button>

          <h1 className="text-2xl font-bold mt-3">
            🌿 Crop Disease Detection
          </h1>

          <p className="text-sm text-green-100 mt-1">
            Take or upload a crop photo for
            AI-based guidance.
          </p>
        </header>

        <section className="bg-white rounded-2xl shadow p-5 mt-5">
          <label className="block font-semibold text-gray-700">
            Crop name (optional)
          </label>

          <input
            type="text"
            value={cropName}
            disabled={loading}
            onChange={(event) =>
              setCropName(
                event.target.value
              )
            }
            placeholder="Example: Cotton, rice"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-2 focus:outline-none focus:ring-2 focus:ring-green-600 disabled:bg-gray-100"
          />

          <label className="block font-semibold text-gray-700 mt-5">
            Crop or leaf photo
          </label>

          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            disabled={loading}
            onChange={selectPhoto}
            className="w-full border-2 border-dashed border-green-300 bg-green-50 rounded-xl p-4 mt-2 disabled:opacity-60"
          />

          <p className="text-sm text-gray-500 mt-2">
            The app will automatically improve
            brightness, contrast and clarity when
            possible.
          </p>

          {preview && (
            <img
              src={preview}
              alt="Selected crop"
              className="w-full max-h-80 object-contain bg-gray-50 rounded-xl mt-4"
            />
          )}

          {enhancementMessage && (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl p-3 mt-4 text-sm">
              {enhancementMessage}
            </div>
          )}

          {error && (
            <div
              className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mt-4"
              role="alert"
            >
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={analyze}
            disabled={loading || !photo}
            className="w-full bg-green-700 hover:bg-green-800 disabled:bg-gray-400 text-white rounded-xl py-3.5 mt-5 font-bold"
          >
            {loading
              ? processingStage ||
                "Processing photo..."
              : "Detect Disease"}
          </button>
        </section>

        {result && (
          <section className="bg-white rounded-2xl shadow p-5 mt-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">
                  Detected crop
                </p>

                <h2 className="text-2xl font-bold text-green-800 mt-1">
                  {result.crop || "Unknown"}
                </h2>
              </div>

              <span className="bg-green-100 text-green-800 rounded-full px-3 py-1.5 text-sm font-semibold capitalize">
                {result.confidence}
              </span>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mt-5">
              <p className="text-sm text-yellow-800">
                Possible condition
              </p>

              <p className="text-xl font-bold text-yellow-900 mt-1">
                {result.disease ||
                  "Unknown"}
              </p>
            </div>

            <ResultList
              title="Visible symptoms"
              items={result.symptoms}
            />

            <ResultList
              title="Likely causes"
              items={result.causes}
            />

            <ResultList
              title="Immediate actions"
              items={
                result.immediateActions
              }
            />

            {result.pesticide?.name && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mt-5">
                <p className="text-sm text-red-700">
                  Recommended pesticide
                </p>

                <h3 className="text-lg font-bold text-red-900 mt-1">
                  {result.pesticide.name}
                </h3>

                {result.pesticide.purpose && (
                  <p className="text-sm text-red-800 mt-2">
                    {result.pesticide.purpose}
                  </p>
                )}
              </div>
            )}

            {matchingPesticides.length > 0 && (
              <div className="mt-4 space-y-3">
                <h3 className="font-bold text-green-800">
                  Available pesticide products
                </h3>

                {matchingPesticides.map((product) => (
                  <ProductCard
                    key={`${product.dealerUid}-${product.id}`}
                    product={product}
                    onOpen={() =>
                      navigate("/farmer/dealer-products")
                    }
                  />
                ))}
              </div>
            )}

            {result.fertilizer?.name && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mt-5">
                <p className="text-sm text-emerald-700">
                  Recommended fertilizer
                </p>

                <h3 className="text-lg font-bold text-emerald-900 mt-1">
                  {result.fertilizer.name}
                </h3>

                {result.fertilizer.purpose && (
                  <p className="text-sm text-emerald-800 mt-2">
                    {result.fertilizer.purpose}
                  </p>
                )}
              </div>
            )}

            {matchingFertilizers.length > 0 && (
              <div className="mt-4 space-y-3">
                <h3 className="font-bold text-green-800">
                  Available fertilizer products
                </h3>

                {matchingFertilizers.map((product) => (
                  <ProductCard
                    key={`${product.dealerUid}-${product.id}`}
                    product={product}
                    onOpen={() =>
                      navigate("/farmer/dealer-products")
                    }
                  />
                ))}
              </div>
            )}

            <ResultList
              title="Treatment guidance"
              items={result.treatment}
            />

            <ResultList
              title="Prevention"
              items={result.prevention}
            />

            {result.expertAdvice && (
              <div className="bg-blue-50 text-blue-900 rounded-xl p-4 mt-5">
                <strong>
                  Expert advice:
                </strong>{" "}
                {result.expertAdvice}
              </div>
            )}

            <p className="text-sm text-gray-600 border-t mt-5 pt-4">
              ⚠️{" "}
              {result.safetyNote ||
                "This AI result is not a final diagnosis. Confirm serious or spreading disease with a KVK or agriculture officer."}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}