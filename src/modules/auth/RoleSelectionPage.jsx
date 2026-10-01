import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getLanguage,
  setLanguage,
  subscribeLanguageChange,
  t,
} from "../../utils/language";

const roles = [
  {
    id: "farmer",
    icon: "👨‍🌾",
    titleKey: "roleFarmer",
    descriptionKey: "roleFarmerDescription",
    color:
      "from-green-500 to-emerald-600",
    lightColor:
      "bg-green-50 border-green-200",
  },
  {
    id: "dealer",
    icon: "🏪",
    titleKey: "roleDealer",
    descriptionKey: "roleDealerDescription",
    color:
      "from-blue-500 to-cyan-600",
    lightColor:
      "bg-blue-50 border-blue-200",
  },
  {
    id: "admin",
    icon: "🛡️",
    titleKey: "roleAdmin",
    descriptionKey: "roleAdminDescription",
    color:
      "from-purple-500 to-indigo-600",
    lightColor:
      "bg-purple-50 border-purple-200",
  },
];

export default function RoleSelectionPage() {
  const navigate = useNavigate();

  const [selectedRole, setSelectedRole] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [language, setCurrentLanguage] = useState(getLanguage());

  useEffect(() => {
    const unsubscribe = subscribeLanguageChange(setCurrentLanguage);
    const timer = window.setTimeout(() => {
      setIsVisible(true);
    }, 100);

    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  function handleLanguageChange(event) {
    setCurrentLanguage(setLanguage(event.target.value));
  }

  function selectRole(role) {
    setSelectedRole(role);

    localStorage.setItem("role", role);

    window.setTimeout(() => {
      navigate("/login");
    }, 350);
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-green-100 via-emerald-50 to-green-100 flex items-center justify-center p-4 sm:p-6">
      {/* Background decorative elements */}
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-green-300/20 rounded-full blur-3xl animate-pulse" />

      <div
        className="absolute -bottom-24 -right-24 w-80 h-80 bg-emerald-300/20 rounded-full blur-3xl animate-pulse"
        style={{ animationDelay: "700ms" }}
      />

      <div
        className="absolute top-1/3 right-10 w-20 h-20 bg-yellow-200/30 rounded-full blur-2xl animate-pulse"
        style={{ animationDelay: "1200ms" }}
      />

      {/* Main container */}
      <main
        className={`relative z-10 w-full max-w-6xl transition-all duration-700 ease-out ${
          isVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-8"
        }`}
      >
        {/* Header */}
        <header className="text-center mb-8 sm:mb-10">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-green-400/30 rounded-3xl blur-xl animate-pulse" />

              <div className="relative w-20 h-20 sm:w-24 sm:h-24 bg-white rounded-3xl shadow-xl border border-green-100 flex items-center justify-center transform hover:rotate-3 hover:scale-105 transition-all duration-300">
                <span className="text-5xl sm:text-6xl">
                  🌾
                </span>
              </div>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-green-800">
            AgriSaathi
          </h1>

          <p className="text-gray-600 mt-2 text-sm sm:text-base">
            {t("roleSelectionSubtitle", {}, language)}
          </p>

          <label className="inline-flex items-center gap-3 mt-5 rounded-2xl border border-green-200 bg-white px-4 py-3 shadow-sm">
            <span className="font-semibold text-gray-700">🌐 {t("selectLanguage", {}, language)}</span>
            <select
              value={language}
              onChange={handleLanguageChange}
              className="rounded-lg border border-green-200 bg-white px-3 py-2 text-green-900"
              aria-label={t("selectLanguage", {}, language)}
            >
              <option value="en">English</option>
              <option value="te">తెలుగు</option>
              <option value="hi">हिन्दी</option>
            </select>
          </label>

          <div className="mt-5 inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-green-100 rounded-full px-4 py-2 shadow-sm">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />

            <span className="text-sm font-medium text-gray-600">
              {t("selectRoleToContinue", {}, language)}
            </span>
          </div>
        </header>

        {/* Role cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          {roles.map((role, index) => {
            const isSelected =
              selectedRole === role.id;
            const roleTitle = t(role.titleKey, {}, language);

            return (
              <button
                key={role.id}
                type="button"
                onClick={() =>
                  selectRole(role.id)
                }
                disabled={Boolean(selectedRole)}
                aria-label={t("continueAsRole", { role: roleTitle }, language)}
                className={`
                  group relative text-left
                  bg-white
                  rounded-3xl
                  border
                  ${role.lightColor}
                  shadow-lg
                  overflow-hidden
                  transition-all
                  duration-300
                  ease-out
                  focus:outline-none
                  focus:ring-4
                  focus:ring-green-300/50
                  ${
                    isSelected
                      ? "scale-[0.98] shadow-2xl"
                      : "hover:-translate-y-2 hover:shadow-2xl"
                  }
                  ${
                    selectedRole &&
                    !isSelected
                      ? "opacity-50 scale-[0.98]"
                      : ""
                  }
                `}
                style={{
                  animationDelay: `${index * 120}ms`,
                }}
              >
                {/* Top gradient */}
                <div
                  className={`h-2 bg-gradient-to-r ${role.color}`}
                />

                <div className="p-6 sm:p-7">
                  {/* Icon */}
                  <div className="flex items-center justify-between">
                    <div
                      className={`
                        w-20 h-20
                        rounded-2xl
                        bg-gradient-to-br
                        ${role.color}
                        flex
                        items-center
                        justify-center
                        shadow-lg
                        transform
                        transition-all
                        duration-300
                        ${
                          isSelected
                            ? "scale-110 rotate-3"
                            : "group-hover:scale-110 group-hover:-rotate-3"
                        }
                      `}
                    >
                      <span className="text-5xl">
                        {role.icon}
                      </span>
                    </div>

                    {/* Arrow */}
                    <div
                      className={`
                        w-10 h-10
                        rounded-full
                        bg-gray-50
                        flex
                        items-center
                        justify-center
                        text-gray-400
                        transition-all
                        duration-300
                        ${
                          isSelected
                            ? "bg-green-100 text-green-700 translate-x-1"
                            : "group-hover:bg-green-100 group-hover:text-green-700 group-hover:translate-x-1"
                        }
                      `}
                    >
                      →
                    </div>
                  </div>

                  {/* Content */}
                  <div className="mt-6">
                    <h2 className="text-2xl font-bold text-gray-900">
                      {roleTitle}
                    </h2>

                    <p className="text-gray-600 text-sm leading-6 mt-3 min-h-[72px]">
                      {t(role.descriptionKey, {}, language)}
                    </p>
                  </div>

                  {/* Continue indicator */}
                  <div
                    className={`
                      mt-6
                      w-full
                      rounded-xl
                      py-3
                      text-center
                      font-semibold
                      text-sm
                      bg-gradient-to-r
                      ${role.color}
                      text-white
                      shadow-md
                      transition-all
                      duration-300
                      ${
                        isSelected
                          ? "scale-[0.98]"
                          : "group-hover:shadow-lg"
                      }
                    `}
                  >
                    {isSelected
                      ? t("openingLogin", {}, language)
                      : t("continueAsRole", { role: roleTitle }, language)}
                  </div>
                </div>

                {/* Hover glow */}
                <div
                  className={`
                    absolute
                    inset-0
                    pointer-events-none
                    opacity-0
                    group-hover:opacity-100
                    transition-opacity
                    duration-300
                    bg-gradient-to-br
                    from-white/20
                    to-transparent
                  `}
                />
              </button>
            );
          })}
        </section>

        {/* Footer information */}
        <footer className="text-center mt-8">
          <div className="inline-flex flex-wrap justify-center items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="text-green-600">
                ✓
              </span>
              {t("simpleToUse", {}, language)}
            </span>

            <span className="hidden sm:block text-gray-300">
              |
            </span>

            <span className="flex items-center gap-1.5">
              <span className="text-green-600">
                ✓
              </span>
              {t("farmerFriendly", {}, language)}
            </span>

            <span className="hidden sm:block text-gray-300">
              |
            </span>

            <span className="flex items-center gap-1.5">
              <span className="text-green-600">
                ✓
              </span>
              {t("secureAccess", {}, language)}
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
}
