import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref, update } from "firebase/database";
import { auth, database } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";
import {
  getLanguage,
  getLanguageName,
  subscribeLanguageChange,
  t,
} from "../../utils/language";

const emptyForm = {
  name: "",
  phone: "",
  village: "",
  mandal: "",
  district: "",
  state: "",
  address: "",
  mainCrop: "",
  otherCrops: "",
  landSize: "",
  landUnit: "acres",
  irrigationType: "",
  soilType: "",
  preferredLanguage: "English",
};

export default function FarmerProfilePage() {
  const navigate = useNavigate();
  const [farmer, setFarmer] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [language, setCurrentLanguage] = useState(getLanguage());

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }
      await loadProfile(user.uid, user.email);
    });

    const unsubscribeLanguage = subscribeLanguageChange((nextLanguage) => {
      setCurrentLanguage(nextLanguage);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeLanguage();
    };
  }, [navigate]);

  const profileCompletion = useMemo(() => {
    if (!farmer) {
      return 0;
    }
    const requiredFields = [
      farmer.name || farmer.fullName || farmer.farmerName,
      farmer.phone || farmer.mobile || farmer.phoneNumber,
      farmer.village,
      farmer.district,
      farmer.state,
      farmer.mainCrop,
      farmer.landSize,
      farmer.irrigationType,
    ];
    const completedFields = requiredFields.filter((value) =>
      String(value || "").trim()
    ).length;
    return Math.round((completedFields / requiredFields.length) * 100);
  }, [farmer]);

  function showMessage(type, text) {
    setMessage({ type, text });
    window.setTimeout(() => {
      setMessage(null);
    }, 5000);
  }

  function buildForm(profile) {
    return {
      name: profile.name || profile.fullName || profile.farmerName || "",
      phone: profile.phone || profile.mobile || profile.phoneNumber || "",
      village: profile.village || "",
      mandal: profile.mandal || "",
      district: profile.district || "",
      state: profile.state || "",
      address: profile.address || "",
      mainCrop: profile.mainCrop || "",
      otherCrops: profile.otherCrops || "",
      landSize: String(profile.landSize || ""),
      landUnit: profile.landUnit || "acres",
      irrigationType: profile.irrigationType || "",
      soilType: profile.soilType || "",
      preferredLanguage: profile.preferredLanguage || "English",
    };
  }

  async function loadProfile(uid, email) {
    setLoading(true);
    try {
      const [userSnapshot, farmerSnapshot] = await Promise.all([
        get(ref(database, `users/${uid}`)),
        get(ref(database, `farmers/${uid}`)),
      ]);

      if (!userSnapshot.exists()) {
        setFarmer(null);
        showMessage("error", "Farmer account was not found.");
        return;
      }

      const userData = userSnapshot.val();
      const farmerData = farmerSnapshot.exists() ? farmerSnapshot.val() : {};

      if (userData.role !== "farmer") {
        navigate("/role-selection", { replace: true });
        return;
      }

      const farmerProfile = {
        uid,
        ...userData,
        ...farmerData,
        role: userData.role,
        email: farmerData.email || userData.email || email || "",
      };

      setFarmer(farmerProfile);
      setForm(buildForm(farmerProfile));
    } catch (error) {
      console.error("Farmer profile error:", error);
      showMessage(
        "error",
        String(error?.message || "")
          .toLowerCase()
          .includes("permission denied")
          ? "Profile access is blocked by Firebase rules."
          : "Profile could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function startEditing() {
    if (!farmer) {
      return;
    }
    setForm(buildForm(farmer));
    setEditing(true);
    setMessage(null);
  }

  function cancelEditing() {
    if (farmer) {
      setForm(buildForm(farmer));
    }
    setEditing(false);
  }

  async function saveProfile(event) {
    event.preventDefault();
    const currentUser = auth.currentUser;
    if (!currentUser || !farmer) {
      navigate("/login", { replace: true });
      return;
    }

    const name = form.name.trim();
    const phone = form.phone.trim();
    const district = form.district.trim();
    const state = form.state.trim();
    const mainCrop = form.mainCrop.trim();

    if (!name) {
      showMessage("warning", "Enter farmer name.");
      return;
    }

    if (!phone) {
      showMessage("warning", "Enter phone number.");
      return;
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      showMessage("warning", "Enter a valid 10-digit mobile number.");
      return;
    }

    if (!district) {
      showMessage("warning", "Enter district.");
      return;
    }

    if (!state) {
      showMessage("warning", "Enter state.");
      return;
    }

    if (!mainCrop) {
      showMessage("warning", "Enter main crop.");
      return;
    }

    const landSize = form.landSize ? Number(form.landSize) : 0;
    if (form.landSize && (!Number.isFinite(landSize) || landSize < 0)) {
      showMessage("warning", "Enter a valid land size.");
      return;
    }

    try {
      setSaving(true);
      const now = new Date().toISOString();

      const updates = {
        name,
        fullName: name,
        farmerName: name,
        phone,
        mobile: phone,
        phoneNumber: phone,
        village: form.village.trim(),
        mandal: form.mandal.trim(),
        district,
        state,
        address: form.address.trim(),
        mainCrop,
        otherCrops: form.otherCrops.trim(),
        landSize,
        landUnit: form.landUnit,
        irrigationType: form.irrigationType,
        soilType: form.soilType,
        preferredLanguage: form.preferredLanguage,
        role: "farmer",
        updatedAt: now,
      };

      const farmerUpdates = {
        ...updates,
        email: farmer.email || currentUser.email || "",
      };

      await update(ref(database), {
        [`users/${currentUser.uid}`]: {
          ...updates,
          role: "farmer",
          email: farmer.email || currentUser.email || "",
        },
        [`farmers/${currentUser.uid}`]: farmerUpdates,
      });

      const updatedProfile = {
        ...farmer,
        ...farmerUpdates,
      };

      setFarmer(updatedProfile);
      setForm(buildForm(updatedProfile));
      setEditing(false);
      showMessage("success", "Profile updated successfully.");
    } catch (error) {
      console.error("Profile update error:", error);
      showMessage(
        "error",
        String(error?.message || "")
          .toLowerCase()
          .includes("permission denied")
          ? "Profile update is blocked by Firebase rules."
          : "Profile could not be updated."
      );
    } finally {
      setSaving(false);
    }
  }

  function getProfileValue(...values) {
    const value = values.find((item) => String(item || "").trim());
    return value || "Not added";
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm p-7 text-center">
          <div className="text-5xl">👤</div>
          <h1 className="text-xl font-bold text-green-900 mt-4">
            {t("loading", {}, language)}
          </h1>
        </div>
      </div>
    );
  }

  if (!farmer) {
    return (
      <div className="min-h-screen bg-green-50 p-4 md:p-6">
        <div className="max-w-3xl mx-auto">
          <StatusMessage message={message} onClose={() => setMessage(null)} />
          <section className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <div className="text-5xl">⚠️</div>
            <h1 className="text-xl font-bold text-green-900 mt-4">
              Profile not found
            </h1>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="bg-green-700 text-white px-5 py-3 rounded-xl font-semibold mt-5 hover:bg-green-800 transition"
            >
              Back to Dashboard
            </button>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <StatusMessage message={message} onClose={() => setMessage(null)} />

        {/* Header */}
        <header className="bg-gradient-to-r from-green-800 to-green-600 text-white rounded-2xl shadow p-5">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="text-green-100 font-semibold hover:text-white transition"
          >
            ← Dashboard
          </button>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mt-3">
            <div>
              <h1 className="text-3xl font-bold">👤 {t("myProfile", {}, language)}</h1>
              <p className="text-green-100 mt-1">
                {t("personalFarmInformation", {}, language)}
              </p>
            </div>
            {!editing && (
              <button
                type="button"
                onClick={startEditing}
                className="bg-white text-green-800 px-4 py-2.5 rounded-xl font-semibold self-start hover:bg-green-50 transition"
              >
                ✏️ Edit Profile
              </button>
            )}
          </div>
        </header>

        {/* Profile Summary */}
        <section className="bg-white rounded-2xl border border-green-100 shadow-sm p-5 mt-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center text-4xl">
              👤
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-green-900">
                {getProfileValue(farmer.name, farmer.fullName, farmer.farmerName)}
              </h2>
              <p className="text-gray-600 mt-1">
                {getProfileValue(farmer.mainCrop)} Farmer
              </p>
              <p className="text-sm text-gray-500 mt-1">
                📍 {getProfileValue(farmer.village, farmer.district, farmer.state)}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-800">Profile Completion</p>
              <p className="font-bold text-green-700">{profileCompletion}%</p>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-green-600 rounded-full transition-all duration-500"
                style={{
                  width: `${profileCompletion}%`,
                }}
              />
            </div>
            {profileCompletion < 100 && (
              <p className="text-sm text-gray-500 mt-2">
                Add complete farm details for better weather, crop and product recommendations.
              </p>
            )}
          </div>
        </section>

        {/* Edit Mode */}
        {editing ? (
          <section className="bg-white rounded-2xl border border-green-100 shadow-sm p-5 mt-5">
            <h2 className="text-xl font-bold text-green-900">✏️ Edit Profile</h2>
            <form onSubmit={saveProfile} className="space-y-4 mt-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Farmer Name
                  </label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Farmer name"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Phone Number
                  </label>
                  <input
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="Phone number"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">Email</label>
                <input
                  value={farmer.email || ""}
                  disabled
                  className="w-full border border-gray-200 bg-gray-100 rounded-xl px-4 py-3 mt-1"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Village
                  </label>
                  <input
                    name="village"
                    value={form.village}
                    onChange={handleChange}
                    placeholder="Village"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Mandal
                  </label>
                  <input
                    name="mandal"
                    value={form.mandal}
                    onChange={handleChange}
                    placeholder="Mandal"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    District
                  </label>
                  <input
                    name="district"
                    value={form.district}
                    onChange={handleChange}
                    placeholder="District"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    State
                  </label>
                  <input
                    name="state"
                    value={form.state}
                    onChange={handleChange}
                    placeholder="State"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Address
                </label>
                <textarea
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="House, village or delivery address"
                  rows="3"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Main Crop
                  </label>
                  <input
                    name="mainCrop"
                    value={form.mainCrop}
                    onChange={handleChange}
                    placeholder="Example: Cotton"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Other Crops
                  </label>
                  <input
                    name="otherCrops"
                    value={form.otherCrops}
                    onChange={handleChange}
                    placeholder="Rice, maize, chilli"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Land Size
                  </label>
                  <div className="flex gap-2 mt-1">
                    <input
                      name="landSize"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.landSize}
                      onChange={handleChange}
                      placeholder="Land size"
                      className="flex-1 border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                    />
                    <select
                      name="landUnit"
                      value={form.landUnit}
                      onChange={handleChange}
                      className="border border-gray-300 rounded-xl px-3 py-3 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                    >
                      <option value="acres">Acres</option>
                      <option value="hectares">Hectares</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Irrigation Type
                  </label>
                  <select
                    name="irrigationType"
                    value={form.irrigationType}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  >
                    <option value="">Select irrigation</option>
                    <option value="Rainfed">Rainfed</option>
                    <option value="Borewell">Borewell</option>
                    <option value="Canal">Canal</option>
                    <option value="Drip">Drip</option>
                    <option value="Sprinkler">Sprinkler</option>
                    <option value="Tank">Tank</option>
                  </select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Soil Type
                  </label>
                  <select
                    name="soilType"
                    value={form.soilType}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  >
                    <option value="">Select soil type</option>
                    <option value="Black Soil">Black Soil</option>
                    <option value="Red Soil">Red Soil</option>
                    <option value="Sandy Soil">Sandy Soil</option>
                    <option value="Loamy Soil">Loamy Soil</option>
                    <option value="Clay Soil">Clay Soil</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-green-700 text-white px-5 py-3 rounded-xl font-semibold disabled:bg-gray-400 hover:bg-green-800 transition"
                >
                  {saving ? "Saving..." : "💾 Save Profile"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={cancelEditing}
                  className="border border-gray-300 text-gray-700 px-5 py-3 rounded-xl font-semibold hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        ) : (
          // View Mode
          <>
            <section className="grid sm:grid-cols-2 gap-4 mt-5">
              <article className="bg-white rounded-2xl border border-green-100 shadow-sm p-5">
                <h2 className="text-lg font-bold text-green-900">
                  📞 Contact Details
                </h2>
                <div className="space-y-4 mt-4">
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-semibold break-words">
                      {getProfileValue(farmer.email)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="font-semibold">
                      {getProfileValue(farmer.phone, farmer.mobile, farmer.phoneNumber)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Address</p>
                    <p className="font-semibold">
                      {getProfileValue(farmer.address, farmer.village)}
                    </p>
                  </div>
                </div>
              </article>

              <article className="bg-white rounded-2xl border border-green-100 shadow-sm p-5">
                <h2 className="text-lg font-bold text-green-900">
                  📍 Location
                </h2>
                <div className="space-y-4 mt-4">
                  <div>
                    <p className="text-sm text-gray-500">Village</p>
                    <p className="font-semibold">
                      {getProfileValue(farmer.village)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Mandal</p>
                    <p className="font-semibold">
                      {getProfileValue(farmer.mandal)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">District and State</p>
                    <p className="font-semibold">
                      {getProfileValue(farmer.district)} • {getProfileValue(farmer.state)}
                    </p>
                  </div>
                </div>
              </article>
            </section>

            <section className="bg-white rounded-2xl border border-green-100 shadow-sm p-5 mt-5">
              <h2 className="text-lg font-bold text-green-900">🌾 Farm Details</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500">Main Crop</p>
                  <p className="font-bold text-green-900 mt-1">
                    {getProfileValue(farmer.mainCrop)}
                  </p>
                </div>
                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500">Other Crops</p>
                  <p className="font-bold text-green-900 mt-1">
                    {getProfileValue(farmer.otherCrops)}
                  </p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500">Land Size</p>
                  <p className="font-bold text-blue-900 mt-1">
                    {farmer.landSize
                      ? `${farmer.landSize} ${farmer.landUnit || "acres"}`
                      : "Not added"}
                  </p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500">Irrigation</p>
                  <p className="font-bold text-blue-900 mt-1">
                    {getProfileValue(farmer.irrigationType)}
                  </p>
                </div>
                <div className="bg-yellow-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500">Soil Type</p>
                  <p className="font-bold text-yellow-900 mt-1">
                    {getProfileValue(farmer.soilType)}
                  </p>
                </div>
                <div className="bg-purple-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500">Language</p>
                  <p className="font-bold text-purple-900 mt-1">
                    {getLanguageName(language)}
                  </p>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
              <button
                type="button"
                onClick={() => navigate("/weather")}
                className="bg-white rounded-2xl border border-green-100 shadow-sm p-4 text-center hover:shadow-md hover:-translate-y-0.5 transition"
              >
                <div className="text-2xl">🌤️</div>
                <p className="font-semibold mt-2">{t("weather", {}, language)}</p>
              </button>
              <button
                type="button"
                onClick={() => navigate("/farmer/dealer-products")}
                className="bg-white rounded-2xl border border-green-100 shadow-sm p-4 text-center hover:shadow-md hover:-translate-y-0.5 transition"
              >
                <div className="text-2xl">🛒</div>
                <p className="font-semibold mt-2">{t("dealerProducts", {}, language)}</p>
              </button>
              <button
                type="button"
                onClick={() => navigate("/community")}
                className="bg-white rounded-2xl border border-green-100 shadow-sm p-4 text-center hover:shadow-md hover:-translate-y-0.5 transition"
              >
                <div className="text-2xl">👥</div>
                <p className="font-semibold mt-2">{t("community", {}, language)}</p>
              </button>
              <button
                type="button"
                onClick={() => navigate("/farmer/orders")}
                className="bg-white rounded-2xl border border-green-100 shadow-sm p-4 text-center hover:shadow-md hover:-translate-y-0.5 transition"
              >
                <div className="text-2xl">📦</div>
                <p className="font-semibold mt-2">{t("orders", {}, language)}</p>
              </button>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
