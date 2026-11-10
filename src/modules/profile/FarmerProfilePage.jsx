import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref, update } from "firebase/database";
import { auth, database } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";
import CropSelector from "../../components/CropSelector";
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
      selectedCrops: Array.isArray(profile.selectedCrops) && profile.selectedCrops.length
        ? profile.selectedCrops
        : [profile.mainCrop, ...String(profile.otherCrops || "").split(",")].map((crop) => crop.trim()).filter(Boolean),
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
    const selectedCrops = form.selectedCrops || [];
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
    const key = keyByValue[String(value || "").trim().toLowerCase()];
    return key ? t(key, {}, language) : value;
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
      <div className="w-full">
        <StatusMessage message={message} onClose={() => setMessage(null)} />

        {/* Header */}
        <header className="bg-gradient-to-r from-green-800 to-green-600 text-white rounded-2xl shadow p-5">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="text-green-100 font-semibold hover:text-white transition"
          >
            {t("dashboardLink", {}, language)}
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
                ✏️ {t("editProfile", {}, language)}
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
                {localizeProfileTerm(getProfileValue(farmer.mainCrop))} {t("farmer", {}, language)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                📍 {getProfileValue(farmer.village, farmer.district, farmer.state)}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-800">{t("profileCompletion", {}, language)}</p>
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
                {t("profileCompletionHelp", {}, language)}
              </p>
            )}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-green-100 shadow-sm p-5 mt-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-green-900">{t("whatsappOrderUpdates", {}, language)}</h2>
              <p className="text-sm text-gray-600 mt-1">{t("whatsappOrderUpdatesHelp", {}, language)}</p>
              <p className="text-xs text-gray-500 mt-2">{t("whatsappApprovedTemplates", {}, language)}</p>
            </div>
            <button type="button" role="switch" aria-checked={farmer.whatsappNotificationsEnabled === true} disabled={whatsappSaving} onClick={() => setWhatsAppNotifications(farmer.whatsappNotificationsEnabled !== true)} className={`shrink-0 rounded-xl px-4 py-2 font-semibold disabled:opacity-50 ${farmer.whatsappNotificationsEnabled === true ? "bg-green-700 text-white" : "bg-gray-100 text-gray-700"}`}>
              {whatsappSaving ? t("saving", {}, language) : farmer.whatsappNotificationsEnabled === true ? t("on", {}, language) : t("off", {}, language)}
            </button>
          </div>
        </section>

        {/* Edit Mode */}
        {editing ? (
          <section className="bg-white rounded-2xl border border-green-100 shadow-sm p-5 mt-5">
            <h2 className="text-xl font-bold text-green-900">✏️ {t("editProfile", {}, language)}</h2>
            <form onSubmit={saveProfile} className="space-y-4 mt-4">
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

              <div className="rounded-xl border border-green-100 p-3">
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
            <section className="grid sm:grid-cols-2 gap-4 mt-5">
              <article className="bg-white rounded-2xl border border-green-100 shadow-sm p-5">
                <h2 className="text-lg font-bold text-green-900">
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

              <article className="bg-white rounded-2xl border border-green-100 shadow-sm p-5">
                <h2 className="text-lg font-bold text-green-900">
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

            <section className="bg-white rounded-2xl border border-green-100 shadow-sm p-5 mt-5">
              <h2 className="text-lg font-bold text-green-900">🌾 {t("farmDetails", {}, language)}</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500">{t("selectedCrops", {}, language)}</p>
                  <p className="font-bold text-green-900 mt-1">
                    {(farmer.selectedCrops || [farmer.mainCrop, ...String(farmer.otherCrops || "").split(",")]).filter(Boolean).map(localizeProfileTerm).join(", ") || t("notAdded", {}, language)}
                  </p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500">{t("landSize", {}, language)}</p>
                  <p className="font-bold text-blue-900 mt-1">
                    {farmer.landSize
                      ? `${farmer.landSize} ${localizeProfileTerm(farmer.landUnit || "acres")}`
                      : t("notAdded", {}, language)}
                  </p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500">{t("irrigation", {}, language)}</p>
                  <p className="font-bold text-blue-900 mt-1">
                    {localizeProfileTerm(getProfileValue(farmer.irrigationType))}
                  </p>
                </div>
                <div className="bg-yellow-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500">{t("soilType", {}, language)}</p>
                  <p className="font-bold text-yellow-900 mt-1">
                    {localizeProfileTerm(getProfileValue(farmer.soilType))}
                  </p>
                </div>
                <div className="bg-purple-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500">{t("language", {}, language)}</p>
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
                <div className="text-2xl">🌦️</div>
                <p className="mt-2 font-semibold">{t("weather", {}, language)}</p>
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
