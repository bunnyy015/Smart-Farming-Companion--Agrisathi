import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  sendEmailVerification,
} from "firebase/auth";
import { ref, set } from "firebase/database";
import { auth, database } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";

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
};

const CROPS = [
  "Paddy",
  "Cotton",
  "Maize",
  "Chilli",
  "Turmeric",
  "Groundnut",
  "Soybean",
  "Red Gram",
  "Green Gram",
  "Black Gram",
  "Wheat",
  "Sugarcane",
  "Vegetables",
  "Fruits",
  "Other",
];

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const normalizedEmail = useMemo(
    () => form.email.trim().toLowerCase(),
    [form.email]
  );

  function showMessage(type, text) {
    setMessage({ type, text });
  }

  function clearMessage() {
    setMessage(null);
  }

  function handleChange(event) {
    const { name, value } = event.target;

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

    return "";
  }

  async function handleRegister(event) {
    event.preventDefault();
    clearMessage();

    const validationError = validateForm();

    if (validationError) {
      showMessage("warning", validationError);
      return;
    }

    let createdUser = null;

    try {
      setLoading(true);

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
        otherCrops: form.otherCrops.trim(),

        landSize: form.landSize
          ? Number(form.landSize)
          : 0,

        landUnit: form.landUnit,
        irrigationType: form.irrigationType,
        soilType: form.soilType,
        preferredLanguage: form.preferredLanguage,

        role: "farmer",
        status: "active",

        emailVerified: false,
        profileCompleted: false,

        createdAt: now,
        updatedAt: now,
      };

      await set(
        ref(database, `users/${createdUser.uid}`),
        farmerData
      );

      try {
        await sendEmailVerification(createdUser);
      } catch (verificationError) {
        console.error(
          "Email verification error:",
          verificationError
        );
      }

      localStorage.setItem("role", "farmer");

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

            {/* Personal Details */}
            <section>
              <h2 className="text-lg font-bold text-green-900">
                👤 Personal Details
              </h2>

              <div className="grid md:grid-cols-2 gap-4 mt-4">

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
                  <label
                    htmlFor="main-crop"
                    className="text-sm font-semibold text-gray-700"
                  >
                    Main Crop
                  </label>

                  <select
                    id="main-crop"
                    name="mainCrop"
                    value={form.mainCrop}
                    onChange={handleChange}
                    disabled={loading}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 outline-none focus:ring-2 focus:ring-green-600 disabled:bg-gray-100"
                  >
                    <option value="">
                      Select main crop
                    </option>

                    {CROPS.map((crop) => (
                      <option
                        key={crop}
                        value={crop}
                      >
                        {crop}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="other-crops"
                    className="text-sm font-semibold text-gray-700"
                  >
                    Other Crops
                  </label>

                  <input
                    id="other-crops"
                    name="otherCrops"
                    value={form.otherCrops}
                    onChange={handleChange}
                    disabled={loading}
                    placeholder="Example: Maize, chilli"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 outline-none focus:ring-2 focus:ring-green-600 disabled:bg-gray-100"
                  />
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

                <div>
                  <label
                    htmlFor="soil-type"
                    className="text-sm font-semibold text-gray-700"
                  >
                    Soil Type
                  </label>

                  <select
                    id="soil-type"
                    name="soilType"
                    value={form.soilType}
                    onChange={handleChange}
                    disabled={loading}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 outline-none focus:ring-2 focus:ring-green-600 disabled:bg-gray-100"
                  >
                    <option value="">
                      Select soil type
                    </option>
                    <option value="Black Soil">
                      Black Soil
                    </option>
                    <option value="Red Soil">
                      Red Soil
                    </option>
                    <option value="Sandy Soil">
                      Sandy Soil
                    </option>
                    <option value="Loamy Soil">
                      Loamy Soil
                    </option>
                    <option value="Clay Soil">
                      Clay Soil
                    </option>
                    <option value="Other">
                      Other
                    </option>
                  </select>
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

            {/* Register Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-700 text-white py-3 rounded-xl font-semibold hover:bg-green-800 transition disabled:bg-gray-400"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  Creating Account...
                </span>
              ) : (
                "Create Farmer Account"
              )}
            </button>

            {/* Login Button */}
            <button
              type="button"
              disabled={loading}
              onClick={() => navigate("/login")}
              className="w-full border border-green-200 bg-green-50 text-green-800 py-3 rounded-xl font-semibold disabled:opacity-50"
            >
              Already Have an Account? Login
            </button>

          </form>
        </section>
      </main>
    </div>
  );
}
