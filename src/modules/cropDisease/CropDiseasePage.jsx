import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { appText, appValue, responseLanguage } from "../../utils/appText";

export default function CropDiseasePage() {
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  function handleImageUpload(event) {
    const selectedFile = event.target.files[0];

    if (!selectedFile) return;

    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
    setResult(null);
    setError("");
  }

  function fileToBase64(selectedFile) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        resolve(reader.result.split(",")[1]);
      };

      reader.onerror = reject;
      reader.readAsDataURL(selectedFile);
    });
  }

  function cleanGeminiJson(text) {
    return text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
  }

  function getProductImageUrl(product) {
    const query = `${product.name} ${product.type} pesticide fungicide fertilizer agriculture product bottle`;

    return `https://tse1.mm.bing.net/th?q=${encodeURIComponent(
      query
    )}&w=600&h=400&c=7&rs=1&p=0&o=5&dpr=1.3&pid=1.7`;
  }

  async function callGemini(base64Image, apiKey) {
    const prompt = `
You are an agriculture crop disease expert for Indian farmers.

Analyze the uploaded crop/leaf image and identify:
1. crop name
2. disease or pest problem
3. confidence
4. symptoms visible
5. likely cause
6. best pesticide/fungicide/fertilizer category
7. farmer-friendly treatment advice

Return ONLY valid JSON. No markdown.

JSON format:
{
  "crop": "crop name or unknown",
  "disease": "disease name or healthy/unknown",
  "confidence": "high/medium/low",
  "cause": "fungal/bacterial/viral/pest/nutrient deficiency/healthy/unknown",
  "severity": "low/medium/high",
  "symptoms": ["symptom 1", "symptom 2", "symptom 3"],
  "suggestedProducts": [
    {
      "type": "fungicide/insecticide/fertilizer/bio-control/none",
      "name": "generic product or active ingredient, not brand",
      "why": "why this helps"
    },
    {
      "type": "fungicide/insecticide/fertilizer/bio-control/none",
      "name": "generic product or active ingredient, not brand",
      "why": "why this helps"
    }
  ],
  "farmerAdvice": ["step 1", "step 2", "step 3", "step 4"],
  "safetyNote": "short safety note"
}

Rules:
- If the image is not a crop leaf or crop disease image, disease must be "unknown".
- Do not give exact chemical dosage.
- Do not invent a brand name.
- Prefer common Indian agriculture recommendations like neem oil, copper fungicide, sulfur fungicide, bio-fungicide, NPK fertilizer, micronutrient mix only when relevant.
- Always tell farmer to follow local agriculture officer or product label instructions.
- Every farmer-facing JSON value must be in ${responseLanguage()}.
- Do not mix English words in symptoms, product explanations, farmer advice, or safety note when ${responseLanguage()} is not English.
- Keep JSON property names exactly in English, but translate all displayed values.
`;

    const models = ["gemini-2.5-flash", "gemini-1.5-flash"];

    for (const model of models) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inline_data: {
                      mime_type: file.type || "image/jpeg",
                      data: base64Image,
                    },
                  },
                  {
                    text: prompt,
                  },
                ],
              },
            ],
          }),
        }
      );

      const data = await response.json();

      if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text;
      }
    }

    throw new Error("No valid Gemini response");
  }

  async function detectDisease() {
    if (!file) {
      setError(appText("uploadLeafFirst"));
      return;
    }

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      setError(appText("missingGemini"));
      return;
    }

    try {
      setLoading(true);
      setError("");
      setResult(null);

      const base64Image = await fileToBase64(file);
      const geminiText = await callGemini(base64Image, apiKey);
      const parsed = JSON.parse(cleanGeminiJson(geminiText));

      setResult(parsed);
    } catch (error) {
      setError(appText("diseaseFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-green-50 p-4">
      <div className="bg-green-700 text-white p-4 rounded-xl shadow">
        <button
          onClick={() => navigate("/dashboard")}
          className="text-sm mb-2"
        >
          {appText("back")}
        </button>

        <h1 className="text-2xl font-bold">{appText("cropDiseaseTitle")}</h1>
        <p>{appText("cropDiseaseSubtitle")}</p>
      </div>

      <div className="bg-white rounded-xl shadow p-5 mt-5">
        <h2 className="text-lg font-bold text-green-700 mb-3">
          {appText("uploadCropImage")}
        </h2>

        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleImageUpload}
          className="w-full border rounded-lg p-3"
        />

        {preview && (
          <img
            src={preview}
            alt="Selected crop"
            className="w-full rounded-xl shadow mt-5 max-h-80 object-cover"
          />
        )}

        <button
          onClick={detectDisease}
          disabled={loading}
          className="w-full bg-green-700 text-white py-3 rounded-lg mt-5 font-semibold disabled:bg-gray-400"
        >
          {loading ? appText("identifyingDisease") : appText("detectDisease")}
        </button>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mt-4 text-sm">
            {error}
          </div>
        )}
      </div>

      {result && (
        <div className="bg-white rounded-xl shadow p-5 mt-5">
          <h2 className="text-xl font-bold text-green-700">
            {appText("detectionResult")}
          </h2>

          <div className="mt-4 space-y-2 text-gray-800">
            <p><b>{appText("crop")}:</b> {appValue(result.crop)}</p>
            <p><b>{appText("disease")}:</b> {appValue(result.disease)}</p>
            <p><b>{appText("confidence")}:</b> {appValue(result.confidence)}</p>
            <p><b>{appText("cause")}:</b> {appValue(result.cause)}</p>
            <p><b>{appText("severity")}:</b> {appValue(result.severity)}</p>
          </div>

          <div className="mt-5">
            <h3 className="font-bold text-green-700">{appText("visibleSymptoms")}</h3>

            <ul className="list-disc pl-5 mt-2 text-gray-700">
              {result.symptoms?.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="mt-5">
            <h3 className="font-bold text-green-700">
              {appText("suggestedProducts")}
            </h3>

            <div className="space-y-4 mt-3">
              {result.suggestedProducts?.map((product, index) => (
                <div
                  key={index}
                  className="border rounded-xl p-4 bg-green-50"
                >
                  <img
                    src={getProductImageUrl(product)}
                    alt={product.name}
                    className="w-full h-52 object-contain bg-white rounded-lg shadow"
                    onError={(event) => {
                      event.currentTarget.src =
                        `https://tse1.mm.bing.net/th?q=${encodeURIComponent(
                          "pesticide fungicide fertilizer agriculture product bottle"
                        )}&w=600&h=400&c=7&rs=1&p=0&o=5&dpr=1.3&pid=1.7`;
                    }}
                  />

                  <div className="mt-3 space-y-1">
                    <p><b>{appText("type")}:</b> {appValue(product.type)}</p>
                    <p><b>{appText("suggested")}:</b> {product.name}</p>
                    <p><b>{appText("why")}:</b> {product.why}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <h3 className="font-bold text-green-700">{appText("farmerAdvice")}</h3>

            <ul className="list-disc pl-5 mt-2 text-gray-700">
              {result.farmerAdvice?.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="bg-yellow-100 text-yellow-800 p-3 rounded-lg mt-5 text-sm">
            {result.safetyNote}
          </div>
        </div>
      )}
    </div>
  );
}
