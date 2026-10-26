import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function SplashPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/role-selection");
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <img
        src="/agrisathi-logo.png"
        alt="AgriSaathi — Smart Farming Companion"
        className="block w-full max-w-sm sm:max-w-md h-auto object-contain"
      />
    </div>
  );
}
