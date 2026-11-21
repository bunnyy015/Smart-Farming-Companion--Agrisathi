import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref, update } from "firebase/database";
import { auth, database } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";
import CropSelector from "../../components/CropSelector";
import "./FarmerProfilePage.css";
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
  selectedCrops: [],
  cropAreas: {},
  cultivationStatus: "",
  age: "",
};

function normalizeSelectedCrops(values) {
  const crops = Array.isArray(values) ? values : [];
  const seen = new Set();
  return crops.map((crop) => String(crop || "").trim().replace(/\s+/g, " ")).filter((crop) => {
    const key = crop.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function profileTimestamp(profile) {
  const timestamp = Date.parse(profile?.updatedAt || profile?.createdAt || "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export default function FarmerProfilePage() {
  const navigate = useNavigate();
  const [farmer, setFarmer] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [whatsappSaving, setWhatsappSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [language, setCurrentLanguage] = useState(getLanguage());

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
      selectedCrops: normalizeSelectedCrops(Array.isArray(profile.selectedCrops) && profile.selectedCrops.length
        ? profile.selectedCrops
        : [profile.mainCrop, ...String(profile.otherCrops || "").split(",")]),
      cultivationStatus: profile.cultivationStatus || "",
      age: profile.age ? String(profile.age) : "",
      cropAreas: profile.cropAreas && typeof profile.cropAreas === "object" ? profile.cropAreas : {},
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
        showMessage("error", t("farmerAccountNotFound", {}, language));
        return;
      }

      const userData = userSnapshot.val();
      const farmerData = farmerSnapshot.exists() ? farmerSnapshot.val() : {};

      if (userData.role !== "farmer") {
        navigate("/role-selection", { replace: true });
        return;
      }

      const cropSource = profileTimestamp(userData) >= profileTimestamp(farmerData) ? userData : farmerData;
      const selectedCrops = normalizeSelectedCrops(Array.isArray(cropSource.selectedCrops) && cropSource.selectedCrops.length
        ? cropSource.selectedCrops
        : [cropSource.mainCrop, ...String(cropSource.otherCrops || "").split(",")]);
      const farmerProfile = {
        uid,
        ...userData,
        ...farmerData,
        mainCrop: selectedCrops[0] || cropSource.mainCrop || farmerData.mainCrop || userData.mainCrop || "",
        selectedCrops,
        otherCrops: cropSource.otherCrops ?? farmerData.otherCrops ?? userData.otherCrops ?? "",
        cropAreas: cropSource.cropAreas ?? farmerData.cropAreas ?? userData.cropAreas ?? {},
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
          ? t("profileAccessDenied", {}, language)
          : t("profileLoadFailed", {}, language)
      );
    } finally {
      setLoading(false);
    }
  }

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
    // This page intentionally registers its auth and language listeners once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

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
    const selectedCrops = normalizeSelectedCrops(form.selectedCrops);
    const mainCrop = selectedCrops[0] || form.mainCrop.trim();

    if (!name) {
      showMessage("warning", t("enterFarmerName", {}, language));
      return;
    }

    if (!phone) {
      showMessage("warning", t("enterPhoneNumber", {}, language));
      return;
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      showMessage("warning", t("enterValidPhone", {}, language));
      return;
    }

    if (!district) {
      showMessage("warning", t("enterDistrict", {}, language));
      return;
    }

    if (!state) {
      showMessage("warning", t("enterState", {}, language));
      return;
    }

    if (!mainCrop) {
      showMessage("warning", t("selectOneCrop", {}, language));
      return;
    }

    const landSize = form.landSize ? Number(form.landSize) : 0;
    if (form.landSize && (!Number.isFinite(landSize) || landSize < 0)) {
      showMessage("warning", t("enterValidLandSize", {}, language));
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
        selectedCrops: selectedCrops.length ? selectedCrops : [mainCrop],
        cropAreas: Object.fromEntries(Object.entries(form.cropAreas || {}).filter(([crop, area]) => (selectedCrops.length ? selectedCrops : [mainCrop]).includes(crop) && Number(area) > 0).map(([crop, area]) => [crop, Number(area)])),
        otherCrops: (selectedCrops.length ? selectedCrops.slice(1) : String(form.otherCrops || "").split(",")).join(", "),
        cultivationStatus: form.cultivationStatus,
        age: form.age ? Number(form.age) : null,
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

      await Promise.all([
        update(ref(database, `users/${currentUser.uid}`), {
          ...updates,
          role: "farmer",
          email: farmer.email || currentUser.email || "",
        }),
        update(ref(database, `farmers/${currentUser.uid}`), farmerUpdates),
      ]);

      const updatedProfile = {
        ...farmer,
        ...farmerUpdates,
      };

      setFarmer(updatedProfile);
      setForm(buildForm(updatedProfile));
      setEditing(false);
      showMessage("success", t("profileUpdated", {}, language));
    } catch (error) {
      console.error("Profile update error:", error);
      showMessage(
        "error",
        String(error?.message || "")
          .toLowerCase()
          .includes("permission denied")
          ? t("profileUpdateDenied", {}, language)
          : t("profileUpdateFailed", {}, language)
      );
    } finally {
      setSaving(false);
    }
  }

  async function setWhatsAppNotifications(enabled) {
    const currentUser = auth.currentUser;
    if (!currentUser || !farmer) return;
    if (enabled && !/^[6-9]\d{9}$/.test(String(farmer.phone || farmer.mobile || farmer.phoneNumber || "").trim())) {
      showMessage("warning", t("validPhoneRequired", {}, language));
      return;
    }
    setWhatsappSaving(true);
    try {
      const updates = {
        whatsappNotificationsEnabled: enabled,
        whatsappConsentAt: enabled ? new Date().toISOString() : null,
      };
      await update(ref(database), {
        [`users/${currentUser.uid}/whatsappNotificationsEnabled`]: updates.whatsappNotificationsEnabled,
        [`users/${currentUser.uid}/whatsappConsentAt`]: updates.whatsappConsentAt,
        [`farmers/${currentUser.uid}/whatsappNotificationsEnabled`]: updates.whatsappNotificationsEnabled,
        [`farmers/${currentUser.uid}/whatsappConsentAt`]: updates.whatsappConsentAt,
      });
      setFarmer((current) => ({ ...current, ...updates }));
      showMessage("success", t(enabled ? "whatsappEnabled" : "whatsappDisabled", {}, language));
    } catch (error) {
      console.error("WhatsApp preference update error:", error);
      showMessage("error", t("whatsappUpdateFailed", {}, language));
    } finally {
      setWhatsappSaving(false);
    }
  }

  function getProfileValue(...values) {
    const value = values.find((item) => String(item || "").trim());
    return value || t("notAdded", {}, language);
  }

  function localizeProfileTerm(value) {
    const keyByValue = {
      paddy: "cropPaddy", rice: "cropPaddy", wheat: "cropWheat", maize: "cropMaize", cotton: "cropCotton", chilli: "cropChilli", chili: "cropChilli", turmeric: "cropTurmeric", tomato: "cropTomato", potato: "cropPotato", onion: "cropOnion", brinjal: "cropBrinjal", vegetables: "cropVegetables", sugarcane: "cropSugarcane", groundnut: "cropGroundnut", soybean: "cropSoybean", "red gram": "cropRedGram", "green gram": "cropGreenGram", "black gram": "cropBlackGram", banana: "cropBanana", mango: "cropMango", apple: "cropApple", rainfed: "rainfed", borewell: "borewell", canal: "canal", drip: "drip", sprinkler: "sprinkler", tank: "tank", "black soil": "blackSoil", "red soil": "redSoil", "sandy soil": "sandySoil", "loamy soil": "loamySoil", "clay soil": "claySoil", acres: "acres", hectares: "hectares",
    };
    const normalizedValue = String(value || "").trim();
    const key = keyByValue[normalizedValue.toLowerCase()] || `crop${normalizedValue.replace(/[^a-z0-9]+/gi, "")}`;
    const translated = t(key, {}, language);
    return translated === key ? normalizedValue : translated;
  }

  if (loading) {
    return (
      <div className="farmer-profile-page farmer-profile-page--loading min-h-screen flex items-center justify-center p-4">
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
      <div className="farmer-profile-page min-h-screen p-4 md:p-6">
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
    <div className="farmer-profile-page min-h-screen p-4 md:p-6">
      <div className="farmer-profile-page__content w-full">
        <StatusMessage message={message} onClose={() => setMessage(null)} />

        {/* Header */}
        <header className="farmer-profile-hero relative isolate overflow-hidden rounded-3xl p-5 text-white sm:p-7">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="farmer-profile-back relative z-10 font-semibold transition"
          >
            {t("dashboardLink", {}, language)}
          </button>
          <div className="farmer-profile-hero__content relative z-10 mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">👤 {t("myProfile", {}, language)}</h1>
              <p className="mt-2 text-green-100">
                {t("personalFarmInformation", {}, language)}
              </p>
            </div>
            {!editing && (
              <button
                type="button"
                onClick={startEditing}
                className="farmer-profile-edit-button relative z-10 self-start rounded-xl px-4 py-2.5 font-semibold transition sm:self-auto"
              >
                ✏️ {t("editProfile", {}, language)}
              </button>
            )}
          </div>
        </header>

        {/* Profile Summary */}
        <section className="farmer-profile-summary mt-5 rounded-3xl border p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="farmer-profile-avatar flex h-20 w-20 items-center justify-center rounded-3xl text-4xl">
              👤
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-extrabold text-green-950 sm:text-3xl">
                {getProfileValue(farmer.name, farmer.fullName, farmer.farmerName)}
              </h2>
              <p className="text-gray-600 mt-1">
                {localizeProfileTerm(getProfileValue(farmer.mainCrop))} {t("farmer", {}, language)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                📍 {getProfileValue(farmer.village, farmer.district, farmer.state)}
              </p>
            </div>
          </div>

          <div className="farmer-profile-completion mt-5 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-800">{t("profileCompletion", {}, language)}</p>
              <p className="font-bold text-green-700">{profileCompletion}%</p>
            </div>
            <div className="farmer-profile-progress mt-3 h-3 overflow-hidden rounded-full">
              <div
                className="farmer-profile-progress__fill h-full rounded-full transition-all duration-500"
                style={{
                  width: `${profileCompletion}%`,
                }}
              />
            </div>
            {profileCompletion < 100 && (
              <p className="text-sm text-gray-500 mt-2">
                {t("profileCompletionHelp", {}, language)}
              </p>
            )}
          </div>
        </section>

        <section className="farmer-profile-whatsapp mt-5 rounded-3xl border p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-green-950">{t("whatsappOrderUpdates", {}, language)}</h2>
              <p className="text-sm text-gray-600 mt-1">{t("whatsappOrderUpdatesHelp", {}, language)}</p>
              <p className="text-xs text-gray-500 mt-2">{t("whatsappApprovedTemplates", {}, language)}</p>
            </div>
            <button type="button" role="switch" aria-checked={farmer.whatsappNotificationsEnabled === true} disabled={whatsappSaving} onClick={() => setWhatsAppNotifications(farmer.whatsappNotificationsEnabled !== true)} className={`farmer-profile-whatsapp-switch shrink-0 rounded-xl px-4 py-2 font-semibold disabled:opacity-50 ${farmer.whatsappNotificationsEnabled === true ? "bg-green-700 text-white" : "bg-gray-100 text-gray-700"}`}>
              {whatsappSaving ? t("saving", {}, language) : farmer.whatsappNotificationsEnabled === true ? t("on", {}, language) : t("off", {}, language)}
            </button>
          </div>
        </section>

        {/* Edit Mode */}
        {editing ? (
          <section className="farmer-profile-edit-panel mt-5 rounded-3xl border p-5 sm:p-7">
            <h2 className="farmer-profile-form-heading text-xl font-bold text-green-950">✏️ {t("editProfile", {}, language)}</h2>
            <form onSubmit={saveProfile} className="farmer-profile-form mt-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    {t("farmerName", {}, language)}
                  </label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder={t("farmerName", {}, language)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    {t("phoneNumber", {}, language)}
                  </label>
                  <input
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder={t("phoneNumber", {}, language)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">{t("email", {}, language)}</label>
                <input
                  value={farmer.email || ""}
                  disabled
                  className="w-full border border-gray-200 bg-gray-100 rounded-xl px-4 py-3 mt-1"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    {t("village", {}, language)}
                  </label>
                  <input
                    name="village"
                    value={form.village}
                    onChange={handleChange}
                    placeholder={t("village", {}, language)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    {t("mandal", {}, language)}
                  </label>
                  <input
                    name="mandal"
                    value={form.mandal}
                    onChange={handleChange}
                    placeholder={t("mandal", {}, language)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    {t("district", {}, language)}
                  </label>
                  <input
                    name="district"
                    value={form.district}
                    onChange={handleChange}
                    placeholder={t("district", {}, language)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    {t("state", {}, language)}
                  </label>
                  <input
                    name="state"
                    value={form.state}
                    onChange={handleChange}
                    placeholder={t("state", {}, language)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">
                    {t("address", {}, language)}
                </label>
                <textarea
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  placeholder={t("addressPlaceholder", {}, language)}
                  rows="3"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                />
              </div>

              <CropSelector selectedCrops={form.selectedCrops || []} onChange={(selectedCrops) => setForm((current) => ({ ...current, selectedCrops, mainCrop: selectedCrops[0] || "", cropAreas: Object.fromEntries(Object.entries(current.cropAreas || {}).filter(([crop]) => selectedCrops.includes(crop))) }))} disabled={saving} />

              <div className="farmer-profile-crop-areas rounded-2xl border p-4">
                <p className="text-sm font-semibold text-gray-800">{t("areaByCrop", {}, language)} <span className="font-normal text-gray-500">({t("optional", {}, language)} · {t(form.landUnit, {}, language)})</span></p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(form.selectedCrops || []).map((crop) => <label key={crop} className="text-sm text-gray-700">{localizeProfileTerm(crop)}<input type="number" min="0" step="0.01" value={form.cropAreas?.[crop] || ""} onChange={(event) => setForm((current) => ({ ...current, cropAreas: { ...(current.cropAreas || {}), [crop]: event.target.value } }))} disabled={saving} placeholder={`${t("areaByCrop", {}, language)} · ${t(form.landUnit, {}, language)}`} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label>)}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">{t("landCultivationStatus", {}, language)}</label>
                  <select name="cultivationStatus" value={form.cultivationStatus} onChange={handleChange} className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-green-500">
                    <option value="">{t("preferNotToSay", {}, language)}</option><option value="owner">{t("ownLand", {}, language)}</option><option value="tenant">{t("leasedLand", {}, language)}</option><option value="sharecropper">{t("sharecropper", {}, language)}</option><option value="other">{t("otherArrangement", {}, language)}</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">{t("ageOptional", {}, language)}</label>
                  <input name="age" type="number" min="1" max="120" value={form.age} onChange={handleChange} placeholder={t("ageYears", {}, language)} className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-green-500" />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    {t("landSize", {}, language)}
                  </label>
                  <div className="flex gap-2 mt-1">
                    <input
                      name="landSize"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.landSize}
                      onChange={handleChange}
                      placeholder={t("landSize", {}, language)}
                      className="flex-1 border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                    />
                    <select
                      name="landUnit"
                      value={form.landUnit}
                      onChange={handleChange}
                      className="border border-gray-300 rounded-xl px-3 py-3 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                    >
                      <option value="acres">{t("acres", {}, language)}</option>
                      <option value="hectares">{t("hectares", {}, language)}</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    {t("irrigationType", {}, language)}
                  </label>
                  <select
                    name="irrigationType"
                    value={form.irrigationType}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  >
                    <option value="">{t("selectIrrigation", {}, language)}</option>
                    <option value="Rainfed">{t("rainfed", {}, language)}</option>
                    <option value="Borewell">{t("borewell", {}, language)}</option>
                    <option value="Canal">{t("canal", {}, language)}</option>
                    <option value="Drip">{t("drip", {}, language)}</option>
                    <option value="Sprinkler">{t("sprinkler", {}, language)}</option>
                    <option value="Tank">{t("tank", {}, language)}</option>
                  </select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    {t("soilType", {}, language)}
                  </label>
                  <select
                    name="soilType"
                    value={form.soilType}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  >
                    <option value="">{t("selectSoil", {}, language)}</option>
                    <option value="Black Soil">{t("blackSoil", {}, language)}</option>
                    <option value="Red Soil">{t("redSoil", {}, language)}</option>
                    <option value="Sandy Soil">{t("sandySoil", {}, language)}</option>
                    <option value="Loamy Soil">{t("loamySoil", {}, language)}</option>
                    <option value="Clay Soil">{t("claySoil", {}, language)}</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-green-700 text-white px-5 py-3 rounded-xl font-semibold disabled:bg-gray-400 hover:bg-green-800 transition"
                >
                  {saving ? t("saving", {}, language) : `💾 ${t("saveProfile", {}, language)}`}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={cancelEditing}
                  className="border border-gray-300 text-gray-700 px-5 py-3 rounded-xl font-semibold hover:bg-gray-50 transition"
                >
                  {t("cancel", {}, language)}
                </button>
              </div>
            </form>
          </section>
        ) : (
          // View Mode
          <>
            <section className="farmer-profile-details-grid mt-5 grid gap-4 sm:grid-cols-2">
              <article className="farmer-profile-detail-card rounded-3xl border p-5 sm:p-6">
                <h2 className="farmer-profile-detail-title text-lg font-bold text-green-950">
                  📞 {t("contactDetails", {}, language)}
                </h2>
                <div className="space-y-4 mt-4">
                  <div>
                    <p className="text-sm text-gray-500">{t("email", {}, language)}</p>
                    <p className="font-semibold break-words">
                      {getProfileValue(farmer.email)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{t("phoneNumber", {}, language)}</p>
                    <p className="font-semibold">
                      {getProfileValue(farmer.phone, farmer.mobile, farmer.phoneNumber)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{t("address", {}, language)}</p>
                    <p className="font-semibold">
                      {getProfileValue(farmer.address, farmer.village)}
                    </p>
                  </div>
                </div>
              </article>

              <article className="farmer-profile-detail-card rounded-3xl border p-5 sm:p-6">
                <h2 className="farmer-profile-detail-title text-lg font-bold text-green-950">
                  📍 {t("location", {}, language)}
                </h2>
                <div className="space-y-4 mt-4">
                  <div>
                    <p className="text-sm text-gray-500">{t("village", {}, language)}</p>
                    <p className="font-semibold">
                      {getProfileValue(farmer.village)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{t("mandal", {}, language)}</p>
                    <p className="font-semibold">
                      {getProfileValue(farmer.mandal)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{t("districtAndState", {}, language)}</p>
                    <p className="font-semibold">
                      {getProfileValue(farmer.district)} • {getProfileValue(farmer.state)}
                    </p>
                  </div>
                </div>
              </article>
            </section>

            <section className="farmer-profile-farm-panel mt-5 rounded-3xl border p-5 sm:p-6">
              <h2 className="farmer-profile-detail-title text-lg font-bold text-green-950">🌾 {t("farmDetails", {}, language)}</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                <div className="farmer-profile-farm-item farmer-profile-farm-item--crops rounded-2xl p-4">
                  <p className="text-sm text-gray-500">{t("selectedCrops", {}, language)}</p>
                  <p className="font-bold text-green-900 mt-1">
                    {normalizeSelectedCrops(Array.isArray(farmer.selectedCrops) && farmer.selectedCrops.length ? farmer.selectedCrops : [farmer.mainCrop, ...String(farmer.otherCrops || "").split(",")]).map(localizeProfileTerm).join(", ") || t("notAdded", {}, language)}
                  </p>
                </div>
                <div className="farmer-profile-farm-item farmer-profile-farm-item--land rounded-2xl p-4">
                  <p className="text-sm text-gray-500">{t("landSize", {}, language)}</p>
                  <p className="font-bold text-blue-900 mt-1">
                    {farmer.landSize
                      ? `${farmer.landSize} ${localizeProfileTerm(farmer.landUnit || "acres")}`
                      : t("notAdded", {}, language)}
                  </p>
                </div>
                <div className="farmer-profile-farm-item farmer-profile-farm-item--water rounded-2xl p-4">
                  <p className="text-sm text-gray-500">{t("irrigation", {}, language)}</p>
                  <p className="font-bold text-blue-900 mt-1">
                    {localizeProfileTerm(getProfileValue(farmer.irrigationType))}
                  </p>
                </div>
                <div className="farmer-profile-farm-item farmer-profile-farm-item--soil rounded-2xl p-4">
                  <p className="text-sm text-gray-500">{t("soilType", {}, language)}</p>
                  <p className="font-bold text-yellow-900 mt-1">
                    {localizeProfileTerm(getProfileValue(farmer.soilType))}
                  </p>
                </div>
                <div className="farmer-profile-farm-item farmer-profile-farm-item--language rounded-2xl p-4">
                  <p className="text-sm text-gray-500">{t("language", {}, language)}</p>
                  <p className="font-bold text-purple-900 mt-1">
                    {getLanguageName(language)}
                  </p>
                </div>
              </div>
            </section>

            <section className="farmer-profile-quick-actions mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <button
                type="button"
                onClick={() => navigate("/weather")}
                className="farmer-profile-quick-action rounded-2xl border p-4 text-center transition"
              >
                <div className="text-2xl">🌦️</div>
                <p className="mt-2 font-semibold">{t("weather", {}, language)}</p>
              </button>
              <button
                type="button"
                onClick={() => navigate("/farmer/dealer-products")}
                className="farmer-profile-quick-action rounded-2xl border p-4 text-center transition"
              >
                <div className="text-2xl">🛒</div>
                <p className="font-semibold mt-2">{t("dealerProducts", {}, language)}</p>
              </button>
              <button
                type="button"
                onClick={() => navigate("/community")}
                className="farmer-profile-quick-action rounded-2xl border p-4 text-center transition"
              >
                <div className="text-2xl">👥</div>
                <p className="font-semibold mt-2">{t("community", {}, language)}</p>
              </button>
              <button
                type="button"
                onClick={() => navigate("/farmer/orders")}
                className="farmer-profile-quick-action rounded-2xl border p-4 text-center transition"
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
