import { BrowserRouter, Routes, Route } from "react-router-dom";
import FarmerProfilePage from "./modules/profile/FarmerProfilePage";
import SplashPage from "./modules/splash/SplashPage";
import LoginPage from "./modules/auth/LoginPage";
import RegisterPage from "./modules/auth/RegisterPage";
import LanguageSelection from "./modules/auth/LanguageSelection";
import DashboardPage from "./modules/dashboard/DashboardPage";
import WeatherPage from "./modules/weather/WeatherPage";
import CropDiseasePage from "./modules/cropDisease/CropDiseasePage";
import MarketPricesPage from "./modules/market/MarketPricesPage";
import AnimalCarePage from "./modules/animalCare/AnimalCarePage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SplashPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/language" element={<LanguageSelection />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/weather" element={<WeatherPage />} />
        <Route path="/crop-disease" element={<CropDiseasePage />} />
        <Route path="/animal-care" element={<AnimalCarePage />} />
        <Route path="/profile" element={<FarmerProfilePage />} />
        <Route path="/market-prices" element={<MarketPricesPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
