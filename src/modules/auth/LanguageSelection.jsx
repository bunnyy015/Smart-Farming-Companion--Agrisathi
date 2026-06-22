import { useNavigate } from "react-router-dom";
import { languages, setLanguage, t } from "../../utils/language";

export default function LanguageSelection() {
  const navigate = useNavigate();

  function handleLanguageSelect(code) {
    setLanguage(code);
    navigate("/dashboard");
  }

  return (
    <div className="min-h-screen bg-green-50 p-6">
      <h1 className="text-3xl font-bold text-center text-green-800">
        {t("selectLanguage")}
      </h1>

      <p className="text-center text-gray-600 mt-2">
        {t("chooseLanguage")}
      </p>

      <div className="grid grid-cols-2 gap-4 mt-8 max-w-md mx-auto">
        {languages.map((language) => (
          <button
            key={language.code}
            onClick={() => handleLanguageSelect(language.code)}
            className="bg-white p-4 rounded-xl shadow hover:bg-green-100 transition font-semibold"
          >
            {language.name}
          </button>
        ))}
      </div>
    </div>
  );
}