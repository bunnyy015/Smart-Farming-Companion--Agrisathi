import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  sendEmailVerification,
  setPersistence,
} from "firebase/auth";
import { ref, update } from "firebase/database";
import { auth, database } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";
import CropSelector from "../../components/CropSelector";

const INITIAL_FORM = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  phone: "",
  address: "",
  village: "",
  mandal: "",
  district: "",
  state: "",
  pincode: "",
  mainCrop: "",
  otherCrops: "",
  landSize: "",
  landUnit: "acres",
  irrigationType: "",
  soilType: "",
  preferredLanguage: "English",
  age: "",
  cultivationStatus: "",
};

const STATES = [
  "Telangana",
  "Andhra Pradesh",
  "Karnataka",
  "Maharashtra",
  "Tamil Nadu",
  "Kerala",
  "Odisha",
  "Chhattisgarh",
  "Madhya Pradesh",
  "Uttar Pradesh",
  "Rajasthan",
  "Gujarat",
  "Punjab",
  "Haryana",
  "Bihar",
  "West Bengal",
  "Assam",
  "Jharkhand",
  "Other",
];

const SOIL_TYPES = ["Black Soil", "Red Soil", "Alluvial Soil", "Laterite Soil", "Sandy Soil", "Clay Soil", "Loamy Soil", "Mountain/Forest Soil", "Saline Soil", "Other"];
const unitLabel = (unit) => unit === "hectares" ? "hectares" : "acres";
const areaToAcres = (value, unit) => Number(value || 0) * (unit === "hectares" ? 2.47105 : 1);
const formatArea = (value) => Number(value.toFixed(2)).toString();

function getFriendlyError(error) {
  const code = error?.code || "";

  if (code === "auth/email-already-in-use") {
    return "This email is already registered. Please log in instead.";
  }

  if (code === "auth/invalid-email") {
    return "Enter a valid email address.";
  }

  if (code === "auth/weak-password") {
    return "Use a stronger password with at least 6 characters.";
  }

  if (code === "auth/network-request-failed") {
    return "Check your internet connection and try again.";
  }

  if (code === "auth/operation-not-allowed") {
    return "Email registration is not enabled in Firebase Authentication.";
  }

  return "Farmer account could not be created. Please try again.";
}

export default function RegisterPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState(INITIAL_FORM);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [selectedCrops, setSelectedCrops] = useState([]);
  const [cropAreas, setCropAreas] = useState({});
  const [soilDistribution, setSoilDistribution] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const normalizedEmail = useMemo(
    () => form.email.trim().toLowerCase(),
    [form.email]
  );
  const landAcres = areaToAcres(form.landSize, form.landUnit);
  const cropAreaAcres = selectedCrops.reduce((sum, crop) => sum + areaToAcres(cropAreas[crop], form.landUnit), 0);
  const soilAreaAcres = soilDistribution.reduce((sum, soil) => sum + areaToAcres(soil.area, form.landUnit), 0);
  const cropAllocationInvalid = Boolean(form.landSize) && Number.isFinite(landAcres) && cropAreaAcres > landAcres + 1e-8;
  const soilAllocationInvalid = Boolean(form.landSize) && Number.isFinite(landAcres) && soilAreaAcres > landAcres + 1e-8;
  const invalidAreaInput = [form.landSize, ...selectedCrops.map((crop) => cropAreas[crop] ?? ""), ...soilDistribution.map((soil) => soil.area ?? "")]
    .some((value) => value !== "" && (!Number.isFinite(Number(value)) || Number(value) < 0));

  function showMessage(type, text) {
    setMessage({ type, text });
  }

  function clearMessage() {
    setMessage(null);
  }

  function handleChange(event) {
    const { name, value } = event.target;

    if (name === "landUnit" && value !== form.landUnit) {
      const factor = form.landUnit === "acres" && value === "hectares" ? 1 / 2.47105 : 2.47105;
      const convert = (amount) => amount === "" || amount == null ? amount : String(Number((Number(amount) * factor).toFixed(4)));
      setForm((current) => ({ ...current, landUnit: value, landSize: convert(current.landSize) }));
      setCropAreas((current) => Object.fromEntries(Object.entries(current).map(([crop, area]) => [crop, convert(area)])));
      setSoilDistribution((current) => current.map((soil) => ({ ...soil, area: convert(soil.area) })));
      clearMessage();
      return;
    }

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    clearMessage();
  }

  function validateForm() {
    const name = form.name.trim();
    const phone = form.phone.replace(/\D/g, "");
    const landSize = Number(form.landSize || 0);

    if (!name) {
      return "Enter the farmer's name.";
    }

    if (!normalizedEmail) {
      return "Enter an email address.";
    }

    if (!form.password) {
      return "Enter a password.";
    }

    if (form.password.length < 6) {
      return "Password must contain at least 6 characters.";
    }

    if (form.password !== form.confirmPassword) {
      return "Password and confirm password do not match.";
    }

    if (form.age && (!Number.isInteger(Number(form.age)) || Number(form.age) < 1 || Number(form.age) > 120)) {
      return "Enter an age between 1 and 120, or leave it blank.";
    }

    if (!phone) {
      return "Enter a mobile number.";
    }

    if (phone.length !== 10) {
      return "Enter a valid 10-digit mobile number.";
    }

    if (!form.village.trim()) {
      return "Enter the village or town.";
    }

    if (!form.address.trim()) {
      return "Enter the house, street, or delivery address.";
    }

    if (!form.district.trim()) {
      return "Enter the district.";
    }

    if (!form.state.trim()) {
      return "Select the state.";
    }

    if (!/^\d{6}$/.test(form.pincode.trim())) {
      return "Enter a valid 6-digit PIN code.";
    }

    if (!form.mainCrop.trim()) {
      return "Select the main crop.";
    }

    if (
      form.landSize &&
      (!Number.isFinite(landSize) || landSize <= 0)
    ) {
      return "Enter a valid land size.";
    }

    if (invalidAreaInput) return "Land, crop, and soil areas must be valid non-negative numbers.";
    if (cropAllocationInvalid) return `Total crop area (${formatArea(cropAreaAcres)} acres) exceeds your available land size (${formatArea(landAcres)} acres). Please adjust the crop areas or land size.`;
    if (soilAllocationInvalid) return `Total soil area (${formatArea(soilAreaAcres)} acres) exceeds your available land size (${formatArea(landAcres)} acres). Please correct the allocation.`;

    return "";
  }

  async function handleRegister(event) {
    event.preventDefault();
    clearMessage();

    if (onboardingStep === 1) {
      if (!selectedCrops.length) {
        showMessage("warning", "Select at least one crop to continue.");
        return;
      }
      setForm((current) => ({
        ...current,
        mainCrop: selectedCrops[0],
        otherCrops: selectedCrops.slice(1).join(", "),
      }));
      setOnboardingStep(2);
      return;
    }

    if (invalidAreaInput || cropAllocationInvalid || soilAllocationInvalid) {
      showMessage("warning", invalidAreaInput ? "Land, crop, and soil areas must be valid non-negative numbers." : cropAllocationInvalid ? `Total crop area (${formatArea(cropAreaAcres)} acres) exceeds your available land size (${formatArea(landAcres)} acres). Please adjust the crop areas or land size.` : `Total soil area (${formatArea(soilAreaAcres)} acres) exceeds your available land size (${formatArea(landAcres)} acres). Please correct the allocation.`);
      return;
    }

    const validationError = validateForm();

    if (validationError) {
      showMessage("warning", validationError);
      return;
    }

    if (onboardingStep === 2) {
      setOnboardingStep(3);
      return;
    }

    let createdUser = null;

    try {
      setLoading(true);

      await setPersistence(auth, browserSessionPersistence);

      const credential =
        await createUserWithEmailAndPassword(
          auth,
          normalizedEmail,
          form.password
        );

      createdUser = credential.user;

      const now = new Date().toISOString();
      const phone = form.phone.replace(/\D/g, "");

      const farmerData = {
        uid: createdUser.uid,

        name: form.name.trim(),
        fullName: form.name.trim(),
        farmerName: form.name.trim(),

        email: normalizedEmail,

        phone,
        mobile: phone,
        phoneNumber: phone,

        village: form.village.trim(),
        address: form.address.trim(),
        mandal: form.mandal.trim(),
        district: form.district.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),

        mainCrop: form.mainCrop.trim(),
        selectedCrops,
        cropAreas: Object.fromEntries(Object.entries(cropAreas).filter(([, area]) => Number(area) > 0).map(([crop, area]) => [crop, Number(area)])),
        cropAreaUnit: form.landUnit,
        otherCrops: form.otherCrops.trim(),

        landSize: form.landSize
          ? Number(form.landSize)
          : 0,

        landUnit: form.landUnit,
        irrigationType: form.irrigationType,
        cultivationStatus: form.cultivationStatus,
        age: form.age ? Number(form.age) : null,
        soilType: soilDistribution.find((soil) => soil.soilType)?.customType || soilDistribution.find((soil) => soil.soilType)?.soilType || "",
        soilDistribution: soilDistribution.filter((soil) => soil.soilType || soil.area || soil.customType).map((soil) => ({ soilType: soil.soilType === "Other" ? soil.customType.trim() : soil.soilType, area: soil.area === "" ? null : Number(soil.area), unit: form.landUnit })),
        preferredLanguage: form.preferredLanguage,

        role: "farmer",
        status: "active",

        emailVerified: false,
        profileCompleted: true,
        onboardingCompletedAt: now,

        createdAt: now,
        updatedAt: now,
      };

      await update(ref(database), {
        [`users/${createdUser.uid}`]: farmerData,
        [`farmers/${createdUser.uid}`]: farmerData,
      });

      try {
        await sendEmailVerification(createdUser);
      } catch (verificationError) {
        console.error(
          "Email verification error:",
          verificationError
        );
      }

      sessionStorage.setItem("role", "farmer");

      navigate("/language", {
        replace: true,
      });
    } catch (error) {
      console.error("Farmer registration error:", error);

      if (
        createdUser &&
        error?.code !== "auth/email-already-in-use"
      ) {
        try {
          await deleteUser(createdUser);
        } catch (cleanupError) {
          console.error(
            "Registration cleanup error:",
            cleanupError
          );
        }
      }

      showMessage("error", getFriendlyError(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-100 to-green-50 p-4 md:p-6">
      <main className="max-w-3xl mx-auto">

        {/* Back Button */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-2 bg-white text-green-700 px-4 py-2 rounded-lg shadow-sm border border-green-200 hover:bg-green-50 transition font-medium"
        >
          ← Back
        </button>

        <StatusMessage
          message={message}
          onClose={clearMessage}
        />

        <section className="bg-white rounded-3xl shadow-xl overflow-hidden">

          {/* Header */}
          <header className="bg-gradient-to-r from-green-800 to-green-600 text-white p-6 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-white/20 flex items-center justify-center text-5xl">
              👨‍🌾
            </div>

            <h1 className="text-3xl font-bold mt-4">
              Create Farmer Account
            </h1>

            <p className="text-green-100 mt-2">
              Add personal and farm details for better services.
            </p>
          </header>

          <form
            onSubmit={handleRegister}
            className="p-5 md:p-7 space-y-6"
          >
            {onboardingStep === 1 ? (
              <CropSelector selectedCrops={selectedCrops} onChange={(nextCrops) => {
                setSelectedCrops(nextCrops);
                setCropAreas((current) => Object.fromEntries(Object.entries(current).filter(([crop]) => nextCrops.includes(crop))));
              }} disabled={loading} />
            ) : onboardingStep === 3 ? (
              <section aria-labelledby="registration-review-title" className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-green-700">Step 3 of 3</p>
                  <h2 id="registration-review-title" className="mt-1 text-2xl font-bold text-green-950">Review your details</h2>
                  <p className="mt-1 text-sm text-gray-600">Check your information before creating your account.</p>
                </div>
                <div className="rounded-xl border border-green-100 bg-green-50 p-4">
                  <div className="flex items-center justify-between gap-2"><h3 className="font-bold text-green-950">Selected crops</h3><button type="button" onClick={() => setOnboardingStep(1)} className="text-sm font-semibold text-green-800 underline">Edit crops</button></div>
                  <div className="mt-2 flex flex-wrap gap-2">{selectedCrops.map((crop) => <span key={crop} className="rounded-full bg-white px-3 py-1 text-sm text-green-900">{crop}{cropAreas[crop] ? ` · ${cropAreas[crop]} ${form.landUnit}` : ""}</span>)}</div>
                </div>
                <div className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between gap-2"><h3 className="font-bold text-gray-900">Farmer and farm details</h3><button type="button" onClick={() => setOnboardingStep(2)} className="text-sm font-semibold text-green-800 underline">Edit details</button></div>
                  <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                    {[["Name", form.name], ["Age", form.age || "Not provided"], ["Email", normalizedEmail], ["Mobile", form.phone], ["Delivery address", [form.address, form.village, form.mandal, form.district, form.state, form.pincode].filter(Boolean).join(", ")], ["Land", form.landSize ? `${form.landSize} ${form.landUnit}` : "Not provided"], ["Cultivation", form.cultivationStatus || "Not provided"], ["Irrigation", form.irrigationType || "Not provided"], ["Language", form.preferredLanguage]].map(([label, value]) => <div key={label}><dt className="text-gray-500">{label}</dt><dd className="font-medium text-gray-900">{value}</dd></div>)}
                  </dl>
                  <div className="mt-3 border-t border-gray-100 pt-3 text-sm"><p className="text-gray-500">Soil distribution</p><p className="font-medium text-gray-900">{soilDistribution.filter((soil) => soil.soilType || soil.area).map((soil) => `${soil.soilType === "Other" ? soil.customType || "Other" : soil.soilType || "Unclassified"}${soil.area ? ` · ${soil.area} ${form.landUnit}` : ""}`).join("; ") || "Not provided"}</p></div>
                </div>
                <p className="text-sm text-gray-600">Your profile is saved to your AgriSaathi account. Government scheme matches are informational and do not guarantee approval.</p>
              </section>
            ) : (
              <>
            <div className="mb-2"><p className="text-sm font-semibold text-green-700">Step 2 of 3</p><div className="mt-2 h-2 rounded-full bg-gray-100"><div className="h-2 w-2/3 rounded-full bg-green-700" /></div></div>

            {/* Personal Details */}
            <section>
              <h2 className="text-lg font-bold text-green-900">
                👤 Personal Details
              </h2>

              <div className="grid md:grid-cols-2 gap-4 mt-4">

                <div>
                  <label htmlFor="farmer-age" className="text-sm font-semibold text-gray-700">Age <span className="font-normal text-gray-500">(optional)</span></label>
                  <input id="farmer-age" name="age" type="number" min="1" max="120" value={form.age} onChange={handleChange} disabled={loading} placeholder="Age in years" className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-green-600" />
                </div>

                <div>
                  <label
                    htmlFor="farmer-name"
                    className="text-sm font-semibold text-gray-700"
                  >
                    Farmer Name
                  </label>

                  <input
                    id="farmer-name"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    disabled={loading}
                    placeholder="Enter farmer name"
                    autoComplete="name"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 outline-none focus:ring-2 focus:ring-green-600 disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="farmer-phone"
                    className="text-sm font-semibold text-gray-700"
                  >
                    Mobile Number
                  </label>

                  <input
                    id="farmer-phone"
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    maxLength="10"
                    value={form.phone}
                    onChange={handleChange}
                    disabled={loading}
                    placeholder="10-digit mobile number"
                    autoComplete="tel"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 outline-none focus:ring-2 focus:ring-green-600 disabled:bg-gray-100"
                  />
                </div>

                <div className="md:col-span-2">
                  <label
                    htmlFor="farmer-email"
                    className="text-sm font-semibold text-gray-700"
                  >
                    Email Address
                  </label>

                  <input
                    id="farmer-email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    disabled={loading}
                    placeholder="Enter email address"
                    autoComplete="email"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 outline-none focus:ring-2 focus:ring-green-600 disabled:bg-gray-100"
                  />
                </div>

                {/* Password */}
                <div>
                  <label
                    htmlFor="farmer-password"
                    className="text-sm font-semibold text-gray-700"
                  >
                    Password
                  </label>

                  <div className="relative mt-1">
                    <input
                      id="farmer-password"
                      name="password"
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      value={form.password}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="Minimum 6 characters"
                      autoComplete="new-password"
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 pr-20 outline-none focus:ring-2 focus:ring-green-600 disabled:bg-gray-100"
                    />

                    <button
                      type="button"
                      disabled={loading}
                      onClick={() =>
                        setShowPassword(
                          (current) => !current
                        )
                      }
                      className="absolute inset-y-0 right-3 text-sm font-semibold text-green-700 disabled:text-gray-400"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label
                    htmlFor="confirm-password"
                    className="text-sm font-semibold text-gray-700"
                  >
                    Confirm Password
                  </label>

                  <div className="relative mt-1">
                    <input
                      id="confirm-password"
                      name="confirmPassword"
                      type={
                        showConfirmPassword
                          ? "text"
                          : "password"
                      }
                      value={form.confirmPassword}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="Re-enter password"
                      autoComplete="new-password"
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 pr-20 outline-none focus:ring-2 focus:ring-green-600 disabled:bg-gray-100"
                    />

                    <button
                      type="button"
                      disabled={loading}
                      onClick={() =>
                        setShowConfirmPassword(
                          (current) => !current
                        )
                      }
                      className="absolute inset-y-0 right-3 text-sm font-semibold text-green-700 disabled:text-gray-400"
                    >
                      {showConfirmPassword
                        ? "Hide"
                        : "Show"}
                    </button>
                  </div>
                </div>

              </div>
            </section>

            {/* Location Details */}
            <section className="border-t border-gray-100 pt-6">
              <h2 className="text-lg font-bold text-green-900">
                📍 Location Details
              </h2>
              <p className="mt-2 text-sm text-green-800 bg-green-50 border border-green-100 rounded-xl p-3">
                The address in your farmer profile will be used as the delivery address for your orders. Each order saves a copy, so later profile changes will not change an existing order.
              </p>

              <div className="grid md:grid-cols-2 gap-4 mt-4">

                <div className="md:col-span-2">
                  <label htmlFor="farmer-address" className="text-sm font-semibold text-gray-700">
                    House, Street, or Delivery Address
                  </label>
                  <input
                    id="farmer-address"
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    disabled={loading}
                    placeholder="House number, street, or landmark"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 outline-none focus:ring-2 focus:ring-green-600 disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="farmer-village"
                    className="text-sm font-semibold text-gray-700"
                  >
                    Village or Town
                  </label>

                  <input
                    id="farmer-village"
                    name="village"
                    value={form.village}
                    onChange={handleChange}
                    disabled={loading}
                    placeholder="Village or town"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 outline-none focus:ring-2 focus:ring-green-600 disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="farmer-mandal"
                    className="text-sm font-semibold text-gray-700"
                  >
                    Mandal or Taluk
                  </label>

                  <input
                    id="farmer-mandal"
                    name="mandal"
                    value={form.mandal}
                    onChange={handleChange}
                    disabled={loading}
                    placeholder="Mandal or taluk"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 outline-none focus:ring-2 focus:ring-green-600 disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="farmer-district"
                    className="text-sm font-semibold text-gray-700"
                  >
                    District
                  </label>

                  <input
                    id="farmer-district"
                    name="district"
                    value={form.district}
                    onChange={handleChange}
                    disabled={loading}
                    placeholder="District"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 outline-none focus:ring-2 focus:ring-green-600 disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="farmer-state"
                    className="text-sm font-semibold text-gray-700"
                  >
                    State
                  </label>

                  <select
                    id="farmer-state"
                    name="state"
                    value={form.state}
                    onChange={handleChange}
                    disabled={loading}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 outline-none focus:ring-2 focus:ring-green-600 disabled:bg-gray-100"
                  >
                    <option value="">
                      Select state
                    </option>

                    {STATES.map((state) => (
                      <option
                        key={state}
                        value={state}
                      >
                        {state}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="farmer-pincode" className="text-sm font-semibold text-gray-700">
                    PIN Code
                  </label>
                  <input
                    id="farmer-pincode"
                    name="pincode"
                    inputMode="numeric"
                    maxLength={6}
                    value={form.pincode}
                    onChange={handleChange}
                    disabled={loading}
                    placeholder="6-digit PIN code"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 outline-none focus:ring-2 focus:ring-green-600 disabled:bg-gray-100"
                  />
                </div>

              </div>
            </section>

            {/* Farm Details */}
            <section className="border-t border-gray-100 pt-6">
              <h2 className="text-lg font-bold text-green-900">
                🌾 Farm Details
              </h2>

              <div className="grid md:grid-cols-2 gap-4 mt-4">

                <div>
                  <p className="text-sm font-semibold text-gray-700">Selected crops</p>
                  <div className="mt-1 flex min-h-12 flex-wrap items-center gap-2 rounded-xl border border-gray-200 p-2">
                    {selectedCrops.map((crop) => <span key={crop} className="rounded-full bg-green-100 px-3 py-1 text-sm text-green-900">{crop}{cropAreas[crop] ? ` · ${cropAreas[crop]} ${form.landUnit}` : ""}</span>)}
                    <button type="button" onClick={() => setOnboardingStep(1)} className="text-sm font-semibold text-green-800 underline">Change</button>
                  </div>
                </div>

                <div className="md:col-span-2 rounded-xl border border-green-100 p-3">
                  <p className="text-sm font-semibold text-gray-800">Area by crop <span className="font-normal text-gray-500">(optional · {form.landUnit})</span></p>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {selectedCrops.map((crop) => <label key={crop} className="text-sm text-gray-700">{crop}<input type="number" min="0" step="0.01" value={cropAreas[crop] || ""} onChange={(event) => setCropAreas((current) => ({ ...current, [crop]: event.target.value }))} disabled={loading} placeholder={`Area in ${form.landUnit}`} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label>)}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">Areas are optional; enter them only if you know them.</p>
                  <p className="mt-2 text-sm text-gray-700">{form.landSize ? `Total land: ${form.landSize} ${unitLabel(form.landUnit)} · Allocated: ${formatArea(cropAreaAcres / (form.landUnit === "hectares" ? 2.47105 : 1))} ${unitLabel(form.landUnit)} · Remaining: ${formatArea(Math.max(0, landAcres - cropAreaAcres) / (form.landUnit === "hectares" ? 2.47105 : 1))} ${unitLabel(form.landUnit)}.` : "Enter total land size to see crop allocation totals."}</p>
                  {cropAllocationInvalid && <p role="alert" className="mt-2 text-sm font-medium text-red-700">Total crop area ({formatArea(cropAreaAcres)} acres) exceeds your available land size ({formatArea(landAcres)} acres). Please adjust the crop areas or land size.</p>}
                </div>

                <div>
                  <label htmlFor="cultivation-status" className="text-sm font-semibold text-gray-700">Land / cultivation status <span className="font-normal text-gray-500">(optional)</span></label>
                  <select id="cultivation-status" name="cultivationStatus" value={form.cultivationStatus} onChange={handleChange} disabled={loading} className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-green-600">
                    <option value="">Prefer not to say</option><option value="owner">I own the cultivated land</option><option value="tenant">I cultivate leased land</option><option value="sharecropper">I cultivate as a sharecropper</option><option value="other">Other arrangement</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="land-size"
                    className="text-sm font-semibold text-gray-700"
                  >
                    Land Size
                  </label>

                  <div className="flex gap-2 mt-1">
                    <input
                      id="land-size"
                      name="landSize"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.landSize}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="Land size"
                      className="min-w-0 flex-1 border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-600 disabled:bg-gray-100"
                    />

                    <select
                      name="landUnit"
                      value={form.landUnit}
                      onChange={handleChange}
                      disabled={loading}
                      className="border border-gray-300 rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-green-600 disabled:bg-gray-100"
                    >
                      <option value="acres">
                        Acres
                      </option>
                      <option value="hectares">
                        Hectares
                      </option>
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="irrigation-type"
                    className="text-sm font-semibold text-gray-700"
                  >
                    Irrigation Type
                  </label>

                  <select
                    id="irrigation-type"
                    name="irrigationType"
                    value={form.irrigationType}
                    onChange={handleChange}
                    disabled={loading}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 outline-none focus:ring-2 focus:ring-green-600 disabled:bg-gray-100"
                  >
                    <option value="">
                      Select irrigation
                    </option>
                    <option value="Rainfed">
                      Rainfed
                    </option>
                    <option value="Borewell">
                      Borewell
                    </option>
                    <option value="Canal">
                      Canal
                    </option>
                    <option value="Drip">
                      Drip
                    </option>
                    <option value="Sprinkler">
                      Sprinkler
                    </option>
                    <option value="Tank">
                      Tank
                    </option>
                    <option value="Other">
                      Other
                    </option>
                  </select>
                </div>

                <div className="md:col-span-2 rounded-xl border border-green-100 bg-green-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-green-950">Soil Distribution</h3><p className="mt-1 text-sm text-gray-600">Add the different soil types found across your farmland and specify their areas.</p></div><button type="button" onClick={() => setSoilDistribution((rows) => [...rows, { soilType: "", customType: "", area: "" }])} className="min-h-11 rounded-xl border border-green-700 bg-white px-4 py-2 font-semibold text-green-800">+ Add Soil Type</button></div>
                  <div className="mt-3 space-y-3">{soilDistribution.map((soil, index) => <div key={index} className="grid min-w-0 gap-3 rounded-xl border border-green-100 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)_auto] sm:items-end"><label className="min-w-0 text-sm font-semibold text-gray-700">Soil Type<select value={soil.soilType} onChange={(event) => setSoilDistribution((rows) => rows.map((row, i) => i === index ? { ...row, soilType: event.target.value, customType: event.target.value === "Other" ? row.customType : "" } : row))} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-3"><option value="">Select soil type</option>{SOIL_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label><label className="min-w-0 text-sm font-semibold text-gray-700">Area ({unitLabel(form.landUnit)})<input type="number" min="0" step="any" inputMode="decimal" value={soil.area} onChange={(event) => setSoilDistribution((rows) => rows.map((row, i) => i === index ? { ...row, area: event.target.value } : row))} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-3" /></label><button type="button" onClick={() => setSoilDistribution((rows) => rows.filter((_, i) => i !== index))} className="min-h-11 rounded-xl border border-red-200 px-4 py-2 font-semibold text-red-700">Remove</button>{soil.soilType === "Other" && <label className="sm:col-span-2 text-sm font-semibold text-gray-700">Custom soil type<input value={soil.customType} onChange={(event) => setSoilDistribution((rows) => rows.map((row, i) => i === index ? { ...row, customType: event.target.value } : row))} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-3" /></label>}</div>)}</div>
                  <p className="mt-3 text-sm text-gray-700">{form.landSize ? `Total land: ${form.landSize} ${unitLabel(form.landUnit)} · Allocated: ${formatArea(soilAreaAcres / (form.landUnit === "hectares" ? 2.47105 : 1))} ${unitLabel(form.landUnit)} · Unclassified: ${formatArea(Math.max(0, landAcres - soilAreaAcres) / (form.landUnit === "hectares" ? 2.47105 : 1))} ${unitLabel(form.landUnit)}.` : "Enter total land size to see soil allocation totals."}</p>
                  {soilAllocationInvalid && <p role="alert" className="mt-2 text-sm font-medium text-red-700">Total soil area ({formatArea(soilAreaAcres)} acres) exceeds your available land size ({formatArea(landAcres)} acres). Please correct the allocation.</p>}
                </div>

                <div>
                  <label
                    htmlFor="preferred-language"
                    className="text-sm font-semibold text-gray-700"
                  >
                    Preferred Language
                  </label>

                  <select
                    id="preferred-language"
                    name="preferredLanguage"
                    value={form.preferredLanguage}
                    onChange={handleChange}
                    disabled={loading}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 outline-none focus:ring-2 focus:ring-green-600 disabled:bg-gray-100"
                  >
                    <option value="English">
                      English
                    </option>
                    <option value="Telugu">
                      Telugu
                    </option>
                    <option value="Hindi">
                      Hindi
                    </option>
                    <option value="Tamil">
                      Tamil
                    </option>
                    <option value="Kannada">
                      Kannada
                    </option>
                    <option value="Malayalam">
                      Malayalam
                    </option>
                    <option value="Marathi">
                      Marathi
                    </option>
                    <option value="Bengali">
                      Bengali
                    </option>
                    <option value="Gujarati">
                      Gujarati
                    </option>
                    <option value="Punjabi">
                      Punjabi
                    </option>
                    <option value="Urdu">
                      Urdu
                    </option>
                    <option value="Odia">
                      Odia
                    </option>
                  </select>
                </div>

              </div>
            </section>

            {/* Verification Notice */}
            <div className="bg-blue-50 border border-blue-100 text-blue-800 rounded-xl p-4 text-sm">
              A verification link will be sent to the registered
              email address.
            </div>
              </>
            )}

            <div className="flex gap-3">
            {onboardingStep > 1 && <button type="button" disabled={loading} onClick={() => setOnboardingStep((step) => step - 1)} className="flex-1 rounded-xl border border-green-200 bg-white py-3 font-semibold text-green-800 disabled:opacity-50">Back</button>}
            <button
              type="submit"
              disabled={loading || (onboardingStep >= 2 && (invalidAreaInput || cropAllocationInvalid || soilAllocationInvalid))}
              className="flex-1 bg-green-700 text-white py-3 rounded-xl font-semibold hover:bg-green-800 transition disabled:bg-gray-400"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  Creating Account...
                </span>
              ) : (
                onboardingStep === 1 ? "Continue with selected crops" : onboardingStep === 2 ? "Review details" : "Create Farmer Account"
              )}
            </button>
            </div>

            {/* Login Button */}
            {onboardingStep === 1 && <button
              type="button"
              disabled={loading}
              onClick={() => navigate("/login")}
              className="w-full border border-green-200 bg-green-50 text-green-800 py-3 rounded-xl font-semibold disabled:opacity-50"
            >
              Already Have an Account? Login
            </button>}

          </form>
        </section>
      </main>
    </div>
  );
}
