import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getLanguage } from "../../utils/language";

const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-1.5-flash"];

const animalCareText = {
  en: {
    back: "Back",
    title: "Animal Care",
    subtitle: "Photo check, sound check, vet finder, and feeding guidance",
    photoTitle: "Scan Animal Photo",
    photoHelp: "Upload a clear photo of the affected part or full animal.",
    analyzePhoto: "Analyze Photo",
    checkingPhoto: "Checking Photo...",
    soundTitle: "Record Animal Sound",
    soundHelp: "Record cough, cry, breathing, or unusual sound for AI guidance.",
    start: "Start",
    stop: "Stop",
    recordingNow: "Recording now...",
    analyzeSound: "Analyze Sound",
    checkingSound: "Checking Sound...",
    nearbyVetTitle: "Nearby Veterinary Care",
    nearbyVetHelp: "Detect your location and find nearby veterinary clinics or animal hospitals.",
    findVet: "Find Vet Near Me",
    findingVet: "Finding Nearby Vets...",
    locationNear: "Location detected near",
    openVetSearch: "Open Vet Search in Google Maps",
    foodTitle: "Better Food Suggestions",
    goodFood: "Good food",
    avoid: "Avoid",
    emergencyTitle: "Emergency Quick Check",
    careResult: "Care Result",
    confidence: "Confidence",
    animal: "Animal",
    soundType: "Sound Type",
    possibleIssue: "Possible Issue",
    signs: "Signs / Observations",
    firstAid: "First Aid / Farmer Steps",
    foodAdvice: "Food Advice",
    callVet: "Call Vet",
    type: "Type",
    call: "Call",
    openMaps: "Open Maps",
    phoneUnavailable: "Phone number is not available in map data. Open in Google Maps to check contact details.",
    uploadPhotoFirst: "Please upload an animal photo first.",
    recordSoundFirst: "Please record the animal sound first.",
    missingApiKey: "Missing Gemini API key. Add VITE_GEMINI_API_KEY in .env file.",
    photoFailed: "Animal photo analysis failed. Try a clear full-body photo.",
    audioUnsupported: "Audio recording is not supported in this browser.",
    micPermission: "Microphone permission is needed to record animal sound.",
    soundFailed: "Animal sound analysis failed. Record a clearer sound and try again.",
    locationUnsupported: "Location is not supported on this device.",
    vetUnavailable: "Location detected, but nearby vet data is temporarily unavailable.",
    allowLocation: "Please allow location permission to find nearby veterinary care.",
    responseLanguage: "English",
    feedingGuides: [
      {
        animal: "Cow / Buffalo",
        feed: "Green fodder, dry fodder, clean water, mineral mixture, and balanced concentrate based on milk yield.",
        avoid: "Avoid spoiled fodder, sudden feed changes, plastic waste, and excess grain.",
      },
      {
        animal: "Goat / Sheep",
        feed: "Grazing leaves, legume fodder, dry roughage, mineral block, and fresh water.",
        avoid: "Avoid wet moldy feed and overfeeding grains during stomach upset.",
      },
      {
        animal: "Poultry",
        feed: "Balanced poultry feed, clean water, calcium source for layers, and dry bedding.",
        avoid: "Avoid dirty water, stale feed, and overcrowded feeding space.",
      },
    ],
    quickChecks: [
      "Check body temperature if fever is suspected.",
      "Keep the animal in shade with clean drinking water.",
      "Separate sick animals from healthy animals when infection is possible.",
      "Call a veterinary doctor quickly for swelling, breathing trouble, injury, poisoning, or no eating.",
    ],
  },
  te: {
    back: "వెనక్కి",
    title: "పశు సంరక్షణ",
    subtitle: "ఫోటో పరీక్ష, శబ్ద పరీక్ష, వెటర్నరీ డాక్టర్ శోధన మరియు ఆహార సూచనలు",
    photoTitle: "పశువు ఫోటో స్కాన్ చేయండి",
    photoHelp: "సమస్య ఉన్న భాగం లేదా మొత్తం పశువు స్పష్టమైన ఫోటో అప్లోడ్ చేయండి.",
    analyzePhoto: "ఫోటో విశ్లేషించండి",
    checkingPhoto: "ఫోటో పరిశీలిస్తోంది...",
    soundTitle: "పశువు శబ్దం రికార్డ్ చేయండి",
    soundHelp: "దగ్గు, అరుపు, శ్వాస సమస్య లేదా అసాధారణ శబ్దాన్ని రికార్డ్ చేయండి.",
    start: "ప్రారంభించు",
    stop: "ఆపు",
    recordingNow: "ఇప్పుడు రికార్డ్ అవుతోంది...",
    analyzeSound: "శబ్దం విశ్లేషించండి",
    checkingSound: "శబ్దం పరిశీలిస్తోంది...",
    nearbyVetTitle: "సమీప వెటర్నరీ సేవలు",
    nearbyVetHelp: "మీ స్థానాన్ని గుర్తించి సమీపంలోని వెటర్నరీ క్లినిక్ లేదా పశు ఆసుపత్రిని కనుగొనండి.",
    findVet: "సమీప వెట్‌ను కనుగొనండి",
    findingVet: "సమీప వెట్‌లను వెతుకుతోంది...",
    locationNear: "మీ స్థానం దగ్గరగా గుర్తించబడింది",
    openVetSearch: "Google Maps లో వెట్ శోధన తెరవండి",
    foodTitle: "మంచి ఆహార సూచనలు",
    goodFood: "మంచి ఆహారం",
    avoid: "ఇవి నివారించండి",
    emergencyTitle: "అత్యవసర త్వరిత తనిఖీ",
    careResult: "సంరక్షణ ఫలితం",
    confidence: "నమ్మక స్థాయి",
    animal: "పశువు",
    soundType: "శబ్ద రకం",
    possibleIssue: "సంభావ్య సమస్య",
    signs: "లక్షణాలు / గమనికలు",
    firstAid: "ప్రథమ చికిత్స / రైతు చర్యలు",
    foodAdvice: "ఆహార సూచనలు",
    callVet: "వెట్‌కు కాల్ చేయండి",
    type: "రకం",
    call: "కాల్",
    openMaps: "మ్యాప్స్ తెరవండి",
    phoneUnavailable: "మ్యాప్ డేటాలో ఫోన్ నంబర్ అందుబాటులో లేదు. సంప్రదింపు వివరాల కోసం Google Maps తెరవండి.",
    uploadPhotoFirst: "ముందుగా పశువు ఫోటో అప్లోడ్ చేయండి.",
    recordSoundFirst: "ముందుగా పశువు శబ్దాన్ని రికార్డ్ చేయండి.",
    missingApiKey: "Gemini API key లేదు. .env ఫైల్‌లో VITE_GEMINI_API_KEY జోడించండి.",
    photoFailed: "పశువు ఫోటో విశ్లేషణ విఫలమైంది. స్పష్టమైన ఫోటోతో మళ్లీ ప్రయత్నించండి.",
    audioUnsupported: "ఈ బ్రౌజర్‌లో ఆడియో రికార్డింగ్‌కు మద్దతు లేదు.",
    micPermission: "పశువు శబ్దాన్ని రికార్డ్ చేయడానికి మైక్రోఫోన్ అనుమతి అవసరం.",
    soundFailed: "పశువు శబ్ద విశ్లేషణ విఫలమైంది. స్పష్టమైన శబ్దంతో మళ్లీ ప్రయత్నించండి.",
    locationUnsupported: "ఈ పరికరంలో లొకేషన్‌కు మద్దతు లేదు.",
    vetUnavailable: "స్థానం గుర్తించబడింది, కానీ సమీప వెట్ డేటా తాత్కాలికంగా అందుబాటులో లేదు.",
    allowLocation: "సమీప వెటర్నరీ సేవలు కనుగొనడానికి లొకేషన్ అనుమతించండి.",
    responseLanguage: "Telugu",
    feedingGuides: [
      {
        animal: "ఆవు / గేదె",
        feed: "పచ్చి మేత, పొడి మేత, శుభ్రమైన నీరు, ఖనిజ మిశ్రమం, పాల ఉత్పత్తి ఆధారంగా సమతుల్య దాణా.",
        avoid: "పాడైన మేత, ఒక్కసారిగా ఆహారం మార్చడం, ప్లాస్టిక్ వ్యర్థాలు, అధిక ధాన్యం ఇవ్వడం నివారించండి.",
      },
      {
        animal: "మేక / గొర్రె",
        feed: "ఆకులు, పప్పు జాతి మేత, పొడి మేత, ఖనిజ బ్లాక్, శుభ్రమైన నీరు.",
        avoid: "బూజు పట్టిన తడి మేత మరియు కడుపు సమస్య ఉన్నప్పుడు అధిక ధాన్యం ఇవ్వడం నివారించండి.",
      },
      {
        animal: "కోళ్లు",
        feed: "సమతుల్య కోళ్ల దాణా, శుభ్రమైన నీరు, గుడ్లు పెట్టే కోళ్లకు కాల్షియం, పొడి పరుపు.",
        avoid: "మురికి నీరు, పాత దాణా, ఎక్కువ గుంపుగా ఉంచడం నివారించండి.",
      },
    ],
    quickChecks: [
      "జ్వరం అనుమానం ఉంటే శరీర ఉష్ణోగ్రత తనిఖీ చేయండి.",
      "పశువును నీడలో ఉంచి శుభ్రమైన తాగునీరు ఇవ్వండి.",
      "ఇన్ఫెక్షన్ అనుమానం ఉంటే అనారోగ్య పశువును ఆరోగ్యమైన పశువుల నుంచి వేరు చేయండి.",
      "వాపు, శ్వాస ఇబ్బంది, గాయం, విష ప్రభావం లేదా ఆహారం తినకపోతే వెంటనే వెటర్నరీ డాక్టర్‌ను పిలవండి.",
    ],
  },
};

function getAnimalCareText() {
  const language = getLanguage();

  return animalCareText[language] || animalCareText.en;
}

export default function AnimalCarePage() {
  const navigate = useNavigate();
  const text = getAnimalCareText();
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoResult, setPhotoResult] = useState(null);
  const [photoLoading, setPhotoLoading] = useState(false);

  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [soundResult, setSoundResult] = useState(null);
  const [soundLoading, setSoundLoading] = useState(false);

  const [location, setLocation] = useState(null);
  const [placeName, setPlaceName] = useState("");
  const [nearbyVets, setNearbyVets] = useState([]);
  const [vetLoading, setVetLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [photoPreview, audioUrl]);

  function handlePhotoUpload(event) {
    const selectedFile = event.target.files[0];

    if (!selectedFile) return;

    if (photoPreview) URL.revokeObjectURL(photoPreview);

    setPhotoFile(selectedFile);
    setPhotoPreview(URL.createObjectURL(selectedFile));
    setPhotoResult(null);
    setError("");
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        resolve(reader.result.split(",")[1]);
      };

      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function cleanGeminiJson(text) {
    return text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
  }

  async function callGemini(parts, prompt) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error(text.missingApiKey);
    }

    for (const model of GEMINI_MODELS) {
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
                parts: [...parts, { text: prompt }],
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

  async function analyzePhoto() {
    if (!photoFile) {
      setError(text.uploadPhotoFirst);
      return;
    }

    const prompt = `
You are a veterinary assistant for Indian farmers.

Analyze the animal photo and return ONLY valid JSON. No markdown.

JSON format:
{
  "animal": "cow/buffalo/goat/sheep/poultry/dog/other/unknown",
  "possibleIssue": "short likely issue or unknown",
  "confidence": "high/medium/low",
  "visibleSigns": ["sign 1", "sign 2", "sign 3"],
  "urgency": "emergency/today/monitor",
  "firstAid": ["safe step 1", "safe step 2", "safe step 3"],
  "foodAdvice": ["food or water advice 1", "food or water advice 2"],
  "whenToCallVet": "clear farmer-friendly rule",
  "safetyNote": "tell farmer this is not a final diagnosis and a vet should confirm"
}

Rules:
- Do not prescribe exact medicine dose.
- If the image is unclear or not an animal, say unknown.
- Give safe care advice only.
- For serious signs, recommend urgent veterinary care.
- Return farmer-facing values and advice in ${text.responseLanguage}.
`;

    try {
      setPhotoLoading(true);
      setError("");
      setPhotoResult(null);

      const base64Image = await fileToBase64(photoFile);
      const geminiText = await callGemini(
        [
          {
            inline_data: {
              mime_type: photoFile.type || "image/jpeg",
              data: base64Image,
            },
          },
        ],
        prompt
      );

      setPhotoResult(JSON.parse(cleanGeminiJson(geminiText)));
    } catch (errorObject) {
      setError(errorObject.message || text.photoFailed);
    } finally {
      setPhotoLoading(false);
    }
  }

  async function startRecording() {
    try {
      setError("");

      if (!navigator.mediaDevices?.getUserMedia) {
        setError(text.audioUnsupported);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        if (audioUrl) URL.revokeObjectURL(audioUrl);

        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setSoundResult(null);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError(text.micPermission);
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }

  async function analyzeSound() {
    if (!audioBlob) {
      setError(text.recordSoundFirst);
      return;
    }

    const prompt = `
You are a veterinary assistant for Indian farmers.

Analyze the animal sound recording and return ONLY valid JSON. No markdown.

JSON format:
{
  "soundType": "cough/cry/breathing distress/normal call/unknown",
  "possibleIssue": "short likely issue or unknown",
  "confidence": "high/medium/low",
  "observations": ["observation 1", "observation 2"],
  "urgency": "emergency/today/monitor",
  "farmerSteps": ["safe step 1", "safe step 2", "safe step 3"],
  "whenToCallVet": "clear farmer-friendly rule",
  "safetyNote": "tell farmer sound alone cannot confirm disease"
}

Rules:
- Do not prescribe exact medicine dose.
- If audio is noisy or unclear, say unknown.
- For breathing distress, repeated coughing, severe pain cries, or weakness, recommend urgent veterinary care.
- Return farmer-facing values and advice in ${text.responseLanguage}.
`;

    try {
      setSoundLoading(true);
      setError("");
      setSoundResult(null);

      const base64Audio = await fileToBase64(audioBlob);
      const geminiText = await callGemini(
        [
          {
            inline_data: {
              mime_type: audioBlob.type || "audio/webm",
              data: base64Audio,
            },
          },
        ],
        prompt
      );

      setSoundResult(JSON.parse(cleanGeminiJson(geminiText)));
    } catch (errorObject) {
      setError(errorObject.message || text.soundFailed);
    } finally {
      setSoundLoading(false);
    }
  }

  async function detectLocationAndVets() {
    if (!navigator.geolocation) {
      setError(text.locationUnsupported);
      return;
    }

    setVetLoading(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const currentLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        setLocation(currentLocation);

        try {
          const placeUrl =
            `https://api.bigdatacloud.net/data/reverse-geocode-client` +
            `?latitude=${currentLocation.latitude}` +
            `&longitude=${currentLocation.longitude}` +
            `&localityLanguage=en`;

          const placeResponse = await fetch(placeUrl);
          const placeData = await placeResponse.json();
          const detectedPlace =
            placeData.locality ||
            placeData.city ||
            placeData.principalSubdivision ||
            "your location";

          setPlaceName(detectedPlace);
          await fetchNearbyVets(currentLocation);
        } catch {
          setError(text.vetUnavailable);
        } finally {
          setVetLoading(false);
        }
      },
      () => {
        setVetLoading(false);
        setError(text.allowLocation);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }

  async function fetchNearbyVets(currentLocation) {
    const { latitude, longitude } = currentLocation;
    const query = `
[out:json][timeout:25];
(
  node["amenity"="veterinary"](around:30000, ${latitude}, ${longitude});
  way["amenity"="veterinary"](around:30000, ${latitude}, ${longitude});
  relation["amenity"="veterinary"](around:30000, ${latitude}, ${longitude});
  node["healthcare"="veterinary"](around:30000, ${latitude}, ${longitude});
  way["healthcare"="veterinary"](around:30000, ${latitude}, ${longitude});
  node["name"~"vet|veterinary|animal hospital|livestock", i](around:30000, ${latitude}, ${longitude});
  way["name"~"vet|veterinary|animal hospital|livestock", i](around:30000, ${latitude}, ${longitude});
);
out center tags 20;
`;

    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
    });

    if (!response.ok) {
      throw new Error("Vet search failed.");
    }

    const data = await response.json();
    const vets = (data?.elements || [])
      .map((item) => {
        const lat = item.lat || item.center?.lat;
        const lon = item.lon || item.center?.lon;
        const phone = item.tags?.phone || item.tags?.["contact:phone"] || "";

        return {
          id: `${item.type}-${item.id}`,
          name: item.tags?.name || "Veterinary care nearby",
          phone,
          type: item.tags?.amenity || item.tags?.healthcare || "veterinary",
          address:
            item.tags?.["addr:full"] ||
            [item.tags?.["addr:street"], item.tags?.["addr:city"]]
              .filter(Boolean)
              .join(", "),
          latitude: lat,
          longitude: lon,
        };
      })
      .filter((item) => item.latitude && item.longitude);

    setNearbyVets(vets);
  }

  function getMapsSearchUrl() {
    if (!location) {
      return "https://www.google.com/maps/search/veterinary+doctor+near+me";
    }

    return `https://www.google.com/maps/search/veterinary+doctor/@${location.latitude},${location.longitude},13z`;
  }

  function renderCareResult(result) {
    return (
      <div className="bg-white rounded-xl shadow p-5 mt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-green-700">
              {text.careResult}
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              {text.confidence}: {result.confidence || "unknown"}
            </p>
          </div>

          <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-semibold">
            {result.urgency || "monitor"}
          </span>
        </div>

        <div className="mt-4 space-y-2 text-gray-800">
          {result.animal && <p><b>{text.animal}:</b> {result.animal}</p>}
          {result.soundType && <p><b>{text.soundType}:</b> {result.soundType}</p>}
          <p><b>{text.possibleIssue}:</b> {result.possibleIssue || "unknown"}</p>
        </div>

        <CareList title={text.signs} items={result.visibleSigns || result.observations} />
        <CareList title={text.firstAid} items={result.firstAid || result.farmerSteps} />
        <CareList title={text.foodAdvice} items={result.foodAdvice} />

        {result.whenToCallVet && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg mt-5 text-sm">
            <b>{text.callVet}:</b> {result.whenToCallVet}
          </div>
        )}

        {result.safetyNote && (
          <div className="bg-yellow-100 text-yellow-800 p-3 rounded-lg mt-3 text-sm">
            {result.safetyNote}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-50 p-4">
      <div className="bg-green-700 text-white p-4 rounded-xl shadow">
        <button
          onClick={() => navigate("/dashboard")}
          className="text-sm mb-2"
        >
          {text.back}
        </button>

        <h1 className="text-2xl font-bold">{text.title}</h1>
        <p>{text.subtitle}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mt-4 text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-4 mt-5 sm:grid-cols-2">
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-lg font-bold text-green-700">
            {text.photoTitle}
          </h2>

          <p className="text-gray-600 text-sm mt-1">
            {text.photoHelp}
          </p>

          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoUpload}
            className="w-full border rounded-lg p-3 mt-4"
          />

          {photoPreview && (
            <img
              src={photoPreview}
              alt="Selected animal"
              className="w-full rounded-xl shadow mt-4 max-h-72 object-cover"
            />
          )}

          <button
            onClick={analyzePhoto}
            disabled={photoLoading}
            className="w-full bg-green-700 text-white py-3 rounded-lg mt-4 font-semibold disabled:bg-gray-400"
          >
            {photoLoading ? text.checkingPhoto : text.analyzePhoto}
          </button>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-lg font-bold text-green-700">
            {text.soundTitle}
          </h2>

          <p className="text-gray-600 text-sm mt-1">
            {text.soundHelp}
          </p>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <button
              onClick={startRecording}
              disabled={recording}
              className="bg-green-700 text-white py-3 rounded-lg font-semibold disabled:bg-gray-400"
            >
              {text.start}
            </button>

            <button
              onClick={stopRecording}
              disabled={!recording}
              className="bg-red-600 text-white py-3 rounded-lg font-semibold disabled:bg-gray-400"
            >
              {text.stop}
            </button>
          </div>

          {recording && (
            <div className="bg-red-50 text-red-700 rounded-lg p-3 mt-4 text-sm">
              {text.recordingNow}
            </div>
          )}

          {audioUrl && (
            <audio
              src={audioUrl}
              controls
              className="w-full mt-4"
            />
          )}

          <button
            onClick={analyzeSound}
            disabled={soundLoading}
            className="w-full bg-green-700 text-white py-3 rounded-lg mt-4 font-semibold disabled:bg-gray-400"
          >
            {soundLoading ? text.checkingSound : text.analyzeSound}
          </button>
        </div>
      </div>

      {photoResult && renderCareResult(photoResult)}
      {soundResult && renderCareResult(soundResult)}

      <div className="bg-white rounded-xl shadow p-5 mt-5">
        <h2 className="text-lg font-bold text-green-700">
          {text.nearbyVetTitle}
        </h2>

        <p className="text-gray-600 text-sm mt-1">
          {text.nearbyVetHelp}
        </p>

        <button
          onClick={detectLocationAndVets}
          disabled={vetLoading}
          className="w-full bg-green-700 text-white py-3 rounded-lg mt-4 font-semibold disabled:bg-gray-400"
        >
          {vetLoading ? text.findingVet : text.findVet}
        </button>

        {placeName && (
          <p className="text-xs text-gray-500 mt-3">
            {text.locationNear} {placeName}
          </p>
        )}

        <a
          href={getMapsSearchUrl()}
          target="_blank"
          rel="noreferrer"
          className="block text-center border border-green-700 text-green-700 py-3 rounded-lg mt-3 font-semibold"
        >
          {text.openVetSearch}
        </a>
      </div>

      {nearbyVets.length > 0 && (
        <div className="space-y-4 mt-5">
          {nearbyVets.map((vet) => (
            <div
              key={vet.id}
              className="bg-white rounded-xl shadow p-4"
            >
              <h3 className="text-lg font-bold text-green-700">
                {vet.name}
              </h3>

              <p className="text-gray-600 text-sm mt-1">
                {text.type}: {vet.type}
              </p>

              {vet.address && (
                <p className="text-gray-600 text-sm mt-1">
                  {vet.address}
                </p>
              )}

              {vet.phone ? (
                <a
                  href={`tel:${vet.phone}`}
                  className="inline-block bg-green-700 text-white px-4 py-2 rounded-lg mt-3 font-semibold"
                >
                  {text.call} {vet.phone}
                </a>
              ) : (
                <p className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-lg mt-3 text-sm">
                  {text.phoneUnavailable}
                </p>
              )}

              <a
                href={`https://www.google.com/maps?q=${vet.latitude},${vet.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="inline-block border border-green-700 text-green-700 px-4 py-2 rounded-lg mt-3 ml-2 font-semibold"
              >
                {text.openMaps}
              </a>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-5 mt-5">
        <h2 className="text-lg font-bold text-green-700">
          {text.foodTitle}
        </h2>

        <div className="space-y-4 mt-4">
          {text.feedingGuides.map((guide) => (
            <div
              key={guide.animal}
              className="border rounded-xl p-4 bg-green-50"
            >
              <h3 className="font-bold text-green-700">
                {guide.animal}
              </h3>

              <p className="text-sm text-gray-700 mt-2">
                <b>{text.goodFood}:</b> {guide.feed}
              </p>

              <p className="text-sm text-gray-700 mt-2">
                <b>{text.avoid}:</b> {guide.avoid}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-5 mt-5">
        <h2 className="text-lg font-bold text-green-700">
          {text.emergencyTitle}
        </h2>

        <ul className="list-disc pl-5 mt-3 text-gray-700 space-y-2">
          {text.quickChecks.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function CareList({ title, items }) {
  if (!items?.length) return null;

  return (
    <div className="mt-5">
      <h3 className="font-bold text-green-700">
        {title}
      </h3>

      <ul className="list-disc pl-5 mt-2 text-gray-700">
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
