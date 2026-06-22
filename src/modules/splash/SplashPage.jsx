import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function SplashPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/login");
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-green-700 flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4">🌾</div>

        <h1 className="text-4xl font-bold text-white">
          AgriSathi
        </h1>

        <p className="text-green-100 mt-2">
          Smart Farming Companion
        </p>
      </div>
    </div>
  );
}