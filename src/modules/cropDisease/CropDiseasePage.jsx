import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { push, ref, set } from "firebase/database";
import { auth, database } from "../../firebase";
import { getLanguage } from "../../utils/language";

const MODELS = ["gemini-2.5-flash", "gemini-1.5-flash"];
const languageNames = { en: "English", te: "Telugu", hi: "Hindi", ta: "Tamil", kn: "Kannada", ml: "Malayalam", mr: "Marathi", bn: "Bengali", gu: "Gujarati", pa: "Punjabi", ur: "Urdu", or: "Odia" };

function ResultList({ title, items }) {
  if (!items?.length) return null;
  return <div className="mt-5"><h3 className="font-bold text-green-800">{title}</h3><ul className="list-disc pl-5 mt-2 space-y-1 text-gray-700">{items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}</ul></div>;
}

export default function CropDiseasePage() {
  const navigate = useNavigate();
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState("");
  const [cropName, setCropName] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function selectPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Please select a valid image file.");
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setError("");
  }

  function toBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function detect(imageData) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error("Gemini API key is missing from the environment.");
    const outputLanguage = languageNames[getLanguage()] || "English";
    const prompt = `You are a crop health assistant for Indian farmers. Analyze this plant photo. Farmer-entered crop: ${cropName || "unknown"}. Return ONLY valid JSON: {"isPlant":true,"crop":"name or unknown","disease":"likely disease, healthy, or unknown","confidence":"high, medium, or low","symptoms":["visible sign"],"causes":["likely cause"],"immediateActions":["safe farmer action"],"treatment":["general treatment guidance"],"prevention":["prevention step"],"expertAdvice":"when to contact an agriculture expert","safetyNote":"not a final diagnosis"}. Do not invent a disease if unclear. Do not give pesticide dosage; say to follow the label and local agriculture officer. Write farmer-facing values in ${outputLanguage}.`;

    for (const model of MODELS) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: photo.type || "image/jpeg", data: imageData } }, { text: prompt }] }] }) });
      const data = await response.json();
      const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (responseText) return JSON.parse(responseText.replace(/```json|```/g, "").trim());
    }
    throw new Error("The image analysis service is unavailable. Please try again.");
  }

  async function analyze() {
    if (!photo) return setError("Upload a clear photo of the affected leaf or plant first.");
    try {
      setLoading(true); setError(""); setResult(null);
      const analysis = await detect(await toBase64(photo));
      setResult(analysis);
      if (auth.currentUser) await set(push(ref(database, "diseaseReports")), { farmerId: auth.currentUser.uid, crop: analysis.crop || cropName || "Unknown", disease: analysis.disease || "Unknown", confidence: analysis.confidence || "low", createdAt: Date.now() });
    } catch (err) { setError(err.message || "Disease detection failed. Try a clearer photo."); }
    finally { setLoading(false); }
  }

  return <div className="min-h-screen bg-green-50 p-4 md:p-6"><div className="max-w-4xl mx-auto">
    <header className="bg-green-700 text-white rounded-2xl p-6 shadow-lg"><button onClick={() => navigate("/dashboard")} className="mb-3 text-green-100 hover:text-white">← Back to Dashboard</button><h1 className="text-3xl md:text-4xl font-bold">🌿 Crop Disease Detection</h1><p className="mt-2 text-green-100">Upload a clear plant photo for AI-based crop health guidance.</p></header>
    <section className="bg-white rounded-2xl shadow-lg p-6 mt-6"><label className="block font-semibold text-gray-700">Crop name (optional)</label><input value={cropName} onChange={(event) => setCropName(event.target.value)} placeholder="Example: Tomato, rice, cotton" className="w-full border border-gray-300 rounded-lg p-3 mt-2" /><label className="block font-semibold text-gray-700 mt-5">Photo of affected leaf or plant</label><input type="file" accept="image/*" capture="environment" onChange={selectPhoto} className="w-full border border-dashed border-green-400 bg-green-50 rounded-lg p-4 mt-2" /><p className="text-sm text-gray-500 mt-2">Use good daylight and keep the affected area in focus.</p>{preview && <img src={preview} alt="Selected crop" className="w-full max-h-96 object-contain bg-gray-50 rounded-xl mt-4" />}{error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mt-4">{error}</div>}<button onClick={analyze} disabled={loading} className="w-full bg-green-700 hover:bg-green-800 disabled:bg-gray-400 text-white rounded-lg py-3 mt-5 font-bold">{loading ? "Analyzing crop photo..." : "Detect Disease"}</button></section>
    {result && <section className="bg-white rounded-2xl shadow-lg p-6 mt-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-gray-500">Detected crop</p><h2 className="text-2xl font-bold text-green-800">{result.crop || "Unknown"}</h2></div><span className="bg-green-100 text-green-800 rounded-full px-4 py-2 font-semibold">Confidence: {result.confidence || "low"}</span></div><div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mt-5"><p className="text-sm text-yellow-800">Possible condition</p><p className="text-xl font-bold text-yellow-900 mt-1">{result.disease || "Unknown"}</p></div><ResultList title="Visible symptoms" items={result.symptoms} /><ResultList title="Likely causes" items={result.causes} /><ResultList title="Immediate actions" items={result.immediateActions} /><ResultList title="Treatment guidance" items={result.treatment} /><ResultList title="Prevention" items={result.prevention} />{result.expertAdvice && <p className="bg-blue-50 text-blue-900 rounded-xl p-4 mt-5"><strong>Expert advice:</strong> {result.expertAdvice}</p>}<p className="text-sm text-gray-600 border-t mt-5 pt-4">⚠️ {result.safetyNote || "This AI result is not a final diagnosis. Confirm serious or spreading disease with a KVK or agriculture officer."}</p></section>}
  </div></div>;
}
