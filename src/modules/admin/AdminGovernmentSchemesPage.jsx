import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { get, push, ref, remove, update } from "firebase/database";
import { auth, database } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";
import useLanguage from "../../utils/useLanguage";
import { t } from "../../utils/language";
import { DEFAULT_SCHEMES } from "../schemes/defaultGovernmentSchemes";
import { resolveGovernmentSchemesPath } from "../../services/governmentSchemesService";

const EMPTY_FORM = {
  title: "", description: "", eligibility: "", benefits: "",
  requiredDocuments: "", applicationProcess: "", category: "",
  department: "", state: "", applicationLink: "", applyLabel: "",
  applicationNote: "", icon: "🌾",
};

const FIELD_DEFINITIONS = [
  ["title", "schemeFieldName", true],
  ["description", "schemeFieldDescription", true, true],
  ["eligibility", "schemeFieldEligibility", true, true],
  ["benefits", "schemeFieldBenefits", true, true],
  ["requiredDocuments", "schemeFieldDocuments", true, true],
  ["applicationProcess", "schemeFieldProcess", false, true],
  ["category", "schemeFieldCategory", true],
  ["department", "schemeFieldDepartment", false],
  ["state", "schemeFieldState", false],
  ["applicationLink", "schemeFieldLink", false],
  ["applyLabel", "schemeFieldLinkLabel", false],
  ["applicationNote", "schemeFieldNote", false, true],
  ["icon", "schemeFieldIcon", false],
];

function schemeValues(scheme, language) {
  const steps = scheme.applicationProcess || scheme.registrationSteps || [];
  return {
    title: scheme.title || scheme.schemeName || t(scheme.titleKey, {}, language) || "",
    description: scheme.description || scheme.applicationNote || t(scheme.benefitKey, {}, "en") || "",
    eligibility: scheme.eligibility || t(scheme.eligibilityKey, {}, language) || "",
    benefits: scheme.benefits || scheme.benefit || t(scheme.benefitKey, {}, language) || "",
    requiredDocuments: scheme.requiredDocuments || scheme.documents || t(scheme.documentsKey, {}, language) || "",
    applicationProcess: Array.isArray(steps) ? steps.join("\n") : String(steps || ""),
    category: scheme.category || t(scheme.categoryKey, {}, language) || "",
    department: scheme.department || "",
    state: scheme.state || "",
    applicationLink: scheme.applicationLink || scheme.applyUrl || "",
    applyLabel: scheme.applyLabel || "",
    applicationNote: scheme.applicationNote || "",
    icon: scheme.icon || "🌾",
  };
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

export default function AdminGovernmentSchemesPage() {
  const navigate = useNavigate();
  const language = useLanguage();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schemes, setSchemes] = useState([]);
  const [schemesPath, setSchemesPath] = useState("governmentSchemes");
  const [message, setMessage] = useState(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }
      try {
        const profile = await get(ref(database, `users/${user.uid}`));
        if (!profile.exists() || normalize(profile.val()?.role) !== "admin") {
          navigate("/dashboard", { replace: true });
          return;
        }
        if (!active) return;
        setAuthorized(true);
        await loadSchemes();
      } catch (error) {
        console.error("Admin authorization or schemes load failed:", error);
        if (active) {
          setMessage({ type: "error", text: t("schemeLoadError", {}, language) });
          setLoading(false);
        }
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [navigate, language]);

  async function loadSchemes() {
    setLoading(true);
    try {
      const path = await resolveGovernmentSchemesPath();
      const snapshot = await get(ref(database, path));
      const stored = snapshot.val() || {};
      const existingEntries = Object.entries(stored).filter(([id, value]) => id !== "_initialized" && value && typeof value === "object");
      if (existingEntries.length === 0 && stored._initialized !== true && path === "governmentSchemes") {
        const migrated = Object.fromEntries(DEFAULT_SCHEMES.map((scheme, index) => [
          `legacy-${index + 1}`,
          {
            ...scheme,
            title: t(scheme.titleKey, {}, "en"),
            category: t(scheme.categoryKey, {}, "en"),
            benefits: t(scheme.benefitKey, {}, "en"),
            eligibility: t(scheme.eligibilityKey, {}, "en"),
            requiredDocuments: t(scheme.documentsKey, {}, "en"),
            description: scheme.applicationNote || t(scheme.benefitKey, {}, "en"),
            applicationProcess: scheme.registrationSteps,
            defaultValues: {
              title: t(scheme.titleKey, {}, "en"),
              category: t(scheme.categoryKey, {}, "en"),
              benefits: t(scheme.benefitKey, {}, "en"),
              eligibility: t(scheme.eligibilityKey, {}, "en"),
              requiredDocuments: t(scheme.documentsKey, {}, "en"),
            },
            migratedFromFarmerDefaults: true,
          },
        ]));
        migrated._initialized = true;
        await update(ref(database, path), migrated);
        setSchemes(Object.entries(migrated).filter(([id]) => id !== "_initialized").map(([id, scheme]) => ({ id, ...scheme })));
      } else {
        if (stored._initialized !== true) await update(ref(database, path), { _initialized: true });
        setSchemes(existingEntries.map(([id, scheme]) => ({ id, ...scheme })));
      }
      setSchemesPath(path);
      setMessage(null);
    } catch (error) {
      console.error("Government schemes loading error:", error);
      setMessage({ type: "error", text: t("schemeLoadError", {}, language) });
    } finally {
      setLoading(false);
    }
  }

  const categories = useMemo(() => [...new Set(schemes.map((scheme) => scheme.category || t(scheme.categoryKey, {}, language)).filter(Boolean))].sort(), [schemes, language]);
  const states = useMemo(() => [...new Set(schemes.map((scheme) => scheme.state).filter(Boolean))].sort(), [schemes]);
  const departments = useMemo(() => [...new Set(schemes.map((scheme) => scheme.department).filter(Boolean))].sort(), [schemes]);

  const filteredSchemes = useMemo(() => schemes.filter((scheme) => {
    const values = schemeValues(scheme, language);
    const searchable = [values.title, values.description, values.eligibility, values.benefits, values.requiredDocuments, values.category, values.department, values.state].map(normalize).join(" ");
    return (!search || searchable.includes(normalize(search)))
      && (categoryFilter === "all" || values.category === categoryFilter)
      && (stateFilter === "all" || values.state === stateFilter)
      && (departmentFilter === "all" || values.department === departmentFilter);
  }), [schemes, language, search, categoryFilter, stateFilter, departmentFilter]);

  function resetForm() {
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  function openEdit(scheme) {
    setEditing(scheme);
    setForm(schemeValues(scheme, language));
  }

  async function saveScheme(event) {
    event.preventDefault();
    if (!authorized) return;
    const values = { ...form, title: form.title.trim() };
    if (!values.title || !values.description.trim() || !values.eligibility.trim() || !values.benefits.trim() || !values.requiredDocuments.trim() || !values.category.trim()) {
      setMessage({ type: "error", text: t("schemeRequiredError", {}, language) });
      return;
    }
    const applicationProcess = values.applicationProcess.split(/\r?\n/).map((step) => step.trim()).filter(Boolean);
    const record = {
      ...values,
      schemeName: values.title,
      requiredDocuments: values.requiredDocuments.trim(),
      applicationProcess,
      registrationSteps: applicationProcess,
      applyUrl: values.applicationLink.trim(),
      updatedAt: new Date().toISOString(),
    };
    try {
      setSaving(true);
      if (editing) {
        await update(ref(database, `${schemesPath}/${editing.id}`), record);
        setSchemes((current) => current.map((item) => item.id === editing.id ? { id: editing.id, ...record } : item));
        setMessage({ type: "success", text: t("schemeUpdated", {}, language) });
      } else {
        const newRef = push(ref(database, schemesPath));
        await update(newRef, record);
        setSchemes((current) => [...current, { id: newRef.key, ...record }]);
        setMessage({ type: "success", text: t("schemeAdded", {}, language) });
      }
      resetForm();
    } catch (error) {
      console.error("Government scheme save error:", error);
      setMessage({ type: "error", text: t("schemeSaveError", {}, language) });
    } finally {
      setSaving(false);
    }
  }

  async function deleteScheme() {
    if (!authorized || !deleting) return;
    try {
      await remove(ref(database, `${schemesPath}/${deleting.id}`));
      setSchemes((current) => current.filter((scheme) => scheme.id !== deleting.id));
      setMessage({ type: "success", text: t("schemeDeleted", {}, language) });
      setDeleting(null);
    } catch (error) {
      console.error("Government scheme delete error:", error);
      setMessage({ type: "error", text: t("schemeDeleteError", {}, language) });
    }
  }

  function clearFilters() {
    setSearch("");
    setCategoryFilter("all");
    setStateFilter("all");
    setDepartmentFilter("all");
  }

  if (loading && !authorized) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-indigo-900">{t("loading", {}, language)}</div>;
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <StatusMessage message={message} onClose={() => setMessage(null)} />
        <header className="mb-6 rounded-3xl bg-gradient-to-r from-slate-950 via-indigo-950 to-indigo-800 p-6 text-white shadow-xl md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-3xl">🌾</div><div><h1 className="text-3xl font-bold md:text-4xl">{t("adminSchemesTitle", {}, language)}</h1><p className="mt-1 text-indigo-200">{t("adminSchemesIntro", {}, language)}</p></div></div>
            <div className="flex flex-wrap gap-3"><button type="button" onClick={() => navigate("/admin")} className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 font-semibold hover:bg-white/20">← {t("adminDashboard", {}, language)}</button><button type="button" onClick={loadSchemes} disabled={loading} className="rounded-xl bg-white px-4 py-2.5 font-semibold text-indigo-900 hover:bg-indigo-50 disabled:opacity-50">↻ {t("refresh", {}, language)}</button><button type="button" onClick={() => { resetForm(); setEditing(false); }} className="rounded-xl bg-emerald-500 px-4 py-2.5 font-semibold text-white hover:bg-emerald-600">+ {t("schemeAdd", {}, language)}</button></div>
          </div>
        </header>

        <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[["schemeTotal", schemes.length, "🌾", "bg-white border-indigo-100", "text-indigo-900"], ["schemeCategories", categories.length, "🗂️", "bg-emerald-50 border-emerald-100", "text-emerald-800"], ["schemeStates", states.length, "📍", "bg-blue-50 border-blue-100", "text-blue-800"], ["schemeDepartments", departments.length, "🏛️", "bg-yellow-50 border-yellow-100", "text-yellow-800"]].map(([label, value, icon, style, valueStyle]) => <div key={label} className={`flex items-center justify-between rounded-2xl border p-5 shadow-sm ${style}`}><div><p className="text-sm font-medium text-gray-600">{t(label, {}, language)}</p><p className={`mt-2 text-3xl font-bold ${valueStyle}`}>{loading ? "..." : value}</p></div><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/70 text-2xl">{icon}</span></div>)}
        </section>

        <section className="mb-6 rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_repeat(3,minmax(150px,190px))_auto] lg:items-end">
            <label className="text-sm font-semibold text-gray-700">{t("searchSchemesPlaceholder", {}, language)}<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 font-normal outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500" /></label>
            {[["schemeFieldCategory", categoryFilter, setCategoryFilter, categories], ["schemeFieldState", stateFilter, setStateFilter, states], ["schemeFieldDepartment", departmentFilter, setDepartmentFilter, departments]].map(([label, value, setter, options]) => <label key={label} className="text-sm font-semibold text-gray-700">{t(label, {}, language)}<select value={value} onChange={(event) => setter(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3"><option value="all">{t("schemeFilterAll", {}, language)}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>)}
            <button type="button" onClick={clearFilters} className="rounded-xl border border-gray-300 px-5 py-3 font-semibold text-gray-700 hover:bg-gray-50">{t("schemeClear", {}, language)}</button>
          </div>
          <p className="mt-4 text-sm text-gray-500">{t("schemeShowing", {}, language)} <strong className="text-gray-700">{filteredSchemes.length}</strong> {t("schemeOf", {}, language)} <strong className="text-gray-700">{schemes.length}</strong></p>
        </section>

        <div className="overflow-x-auto rounded-2xl border border-indigo-100 bg-white shadow-sm">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="bg-indigo-50 text-xs uppercase tracking-wide text-indigo-950"><tr><th className="px-4 py-3">{t("schemeFieldName", {}, language)}</th><th className="px-4 py-3">{t("schemeFieldCategory", {}, language)}</th><th className="px-4 py-3">{t("schemeFieldDepartment", {}, language)}</th><th className="px-4 py-3">{t("schemeFieldState", {}, language)}</th><th className="px-4 py-3">{t("schemeFieldEligibility", {}, language)}</th><th className="px-4 py-3">{t("schemeActions", {}, language)}</th></tr></thead>
            {loading ? <tbody><tr><td colSpan="6" className="p-8 text-center text-gray-500">{t("loading", {}, language)}</td></tr></tbody>
              : filteredSchemes.length === 0 ? <tbody><tr><td colSpan="6" className="p-10 text-center"><p className="font-semibold text-gray-800">{t("schemeEmpty", {}, language)}</p></td></tr></tbody>
                : <tbody className="divide-y divide-indigo-100">{filteredSchemes.map((scheme) => { const values = schemeValues(scheme, language); return <tr key={scheme.id} className="align-top hover:bg-indigo-50/60"><td className="px-4 py-3"><button type="button" onClick={() => setViewing(scheme)} className="text-left"><span className="font-semibold text-gray-900 hover:text-indigo-800">{values.title}</span><span className="mt-1 block max-w-sm line-clamp-2 text-gray-500">{values.description}</span></button></td><td className="px-4 py-3">{values.category}</td><td className="px-4 py-3">{values.department || "—"}</td><td className="px-4 py-3">{values.state || "—"}</td><td className="px-4 py-3"><span className="line-clamp-2 max-w-xs">{values.eligibility}</span></td><td className="px-4 py-3"><div className="flex gap-2"><button type="button" onClick={() => openEdit(scheme)} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700">{t("schemeEditAction", {}, language)}</button><button type="button" onClick={() => setDeleting(scheme)} className="rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">{t("schemeDeleteAction", {}, language)}</button></div></td></tr>; })}</tbody>}
          </table>
        </div>
      </div>

      {viewing && <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={() => setViewing(null)}><section role="dialog" aria-modal="true" aria-labelledby="scheme-view-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}><header className="flex items-start justify-between gap-4 rounded-t-2xl bg-gradient-to-r from-slate-950 via-indigo-950 to-indigo-800 p-5 text-white"><div><h2 id="scheme-view-title" className="text-2xl font-bold">{schemeValues(viewing, language).title}</h2><p className="mt-1 text-indigo-200">{schemeValues(viewing, language).category}</p></div><button type="button" onClick={() => setViewing(null)} aria-label={t("schemeClose", {}, language)} className="rounded-lg bg-white/10 px-3 py-1 text-xl hover:bg-white/20">×</button></header><div className="space-y-4 p-5">{[["schemeFieldDescription", schemeValues(viewing, language).description], ["schemeFieldEligibility", schemeValues(viewing, language).eligibility], ["schemeFieldBenefits", schemeValues(viewing, language).benefits], ["schemeFieldDocuments", schemeValues(viewing, language).requiredDocuments], ["schemeFieldDepartment", schemeValues(viewing, language).department], ["schemeFieldCategory", schemeValues(viewing, language).category], ["schemeFieldState", schemeValues(viewing, language).state], ["schemeFieldNote", schemeValues(viewing, language).applicationNote]].map(([label, value]) => value && <div key={label}><h3 className="text-sm font-semibold text-gray-500">{t(label, {}, language)}</h3><p className="mt-1 whitespace-pre-wrap text-gray-800">{value}</p></div>)}{schemeValues(viewing, language).applicationProcess && <div><h3 className="text-sm font-semibold text-gray-500">{t("schemeFieldProcess", {}, language)}</h3><ol className="mt-1 list-decimal space-y-1 pl-5">{schemeValues(viewing, language).applicationProcess.split(/\r?\n/).filter(Boolean).map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}</ol></div>}{schemeValues(viewing, language).applicationLink && <div><h3 className="text-sm font-semibold text-gray-500">{t("schemeFieldLink", {}, language)}</h3><a className="mt-1 block break-all text-indigo-700 underline" href={schemeValues(viewing, language).applicationLink} target="_blank" rel="noopener noreferrer">{schemeValues(viewing, language).applicationLink}</a></div>}<div className="flex justify-end gap-2 border-t border-gray-100 pt-4"><button type="button" onClick={() => { openEdit(viewing); setViewing(null); }} className="rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white">{t("schemeEditAction", {}, language)}</button><button type="button" onClick={() => setViewing(null)} className="rounded-xl border border-gray-300 px-4 py-2 font-semibold">{t("schemeClose", {}, language)}</button></div></div></section></div>}

      {(editing !== null) && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={resetForm}><section role="dialog" aria-modal="true" aria-labelledby="scheme-form-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}><header className="rounded-t-2xl bg-gradient-to-r from-slate-950 via-indigo-950 to-indigo-800 p-5 text-white"><h2 id="scheme-form-title" className="text-xl font-bold">{t(editing ? "schemeEdit" : "schemeAdd", {}, language)}</h2></header><form onSubmit={saveScheme} className="grid gap-4 p-5 sm:grid-cols-2">{FIELD_DEFINITIONS.map(([name, label, required, multiline]) => <label key={name} className={`text-sm font-semibold text-gray-700 ${multiline ? "sm:col-span-2" : ""}`}>{t(label, {}, language)}{multiline ? <textarea required={required} rows={name === "applicationProcess" ? 4 : 3} value={form[name]} onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 font-normal focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500" /> : <input required={required} type={name === "applicationLink" ? "url" : "text"} value={form[name]} onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 font-normal focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500" />}</label>)}<div className="flex justify-end gap-3 border-t border-gray-100 pt-4 sm:col-span-2"><button type="button" onClick={resetForm} className="rounded-xl border border-gray-300 px-4 py-2 font-semibold text-gray-700">{t("cancel", {}, language)}</button><button type="submit" disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? t("schemeSaving", {}, language) : t("save", {}, language)}</button></div></form></section></div>}

      {deleting && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><section role="alertdialog" aria-modal="true" aria-labelledby="scheme-delete-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h2 id="scheme-delete-title" className="text-lg font-bold text-gray-900">{t("schemeDeleteConfirm", {}, language)}</h2><p className="mt-2 text-gray-600">{schemeValues(deleting, language).title}</p><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setDeleting(null)} className="rounded-xl border border-gray-300 px-4 py-2 font-semibold">{t("cancel", {}, language)}</button><button type="button" onClick={deleteScheme} className="rounded-xl bg-red-700 px-4 py-2 font-semibold text-white hover:bg-red-800">{t("schemeDeleteAction", {}, language)}</button></div></section></div>}
    </main>
  );
}
