import {
  BrowserRouter,
  Route,
  Routes,
} from "react-router-dom";

import SplashPage from "./modules/splash/SplashPage";
import LoginPage from "./modules/auth/LoginPage";
import RegisterPage from "./modules/auth/RegisterPage";
import LanguageSelection from "./modules/auth/LanguageSelection";
import RoleSelectionPage from "./modules/auth/RoleSelectionPage";
import KVKRegistrationPage from "./modules/auth/KVKRegistrationPage";

import VoiceAssistantPage from "./utils/VoiceAssistantPage";

import DashboardPage from "./modules/dashboard/DashboardPage";
import WeatherPage from "./modules/weather/WeatherPage";
import MarketPricesPage from "./modules/market/MarketPricesPage";
import AnimalCarePage from "./modules/animalCare/AnimalCarePage";
import CropDiseasePage from "./modules/cropDisease/CropDiseasePage";
import FarmerProfilePage from "./modules/profile/FarmerProfilePage";
import SOSPage from "./modules/sos/SOSPage";
import GovtSchemesPage from "./modules/schemes/GovtSchemesPage";

import FarmerDealerProductsPage from "./modules/farmer/FarmerDealerProductsPage";
import FarmerProductDetailsPage from "./modules/farmer/FarmerProductDetailsPage";
import FarmerOrdersPage from "./modules/farmer/FarmerOrdersPage";
import FarmerNotificationsPage from "./modules/farmer/FarmerNotificationsPage";

import CommunityPage from "./modules/community/CommunityPage";

import AdminDashboard from "./modules/admin/AdminDashboard";
import FarmersListPage from "./modules/admin/FarmersListPage";
import SOSRequestsPage from "./modules/admin/SOSRequestsPage";
import DealerRequestsPage from "./modules/admin/DealerRequestsPage";
import KVKRequestsPage from "./modules/admin/KVKRequestsPage";

import KVKDashboard from "./modules/kvk/KVKDashboard";
import KVKSOSRequestsPage from "./modules/kvk/KVKSOSRequestsPage";

import DealerDashboard from "./modules/dealer/DealerDashboard";
import DealerRegistrationPage from "./modules/dealer/DealerRegistrationPage";
import DealerProductsPage from "./modules/dealer/DealerProductsPage";
import DealerStockPage from "./modules/dealer/DealerStockPage";
import DealerOrdersPage from "./modules/dealer/DealerOrdersPage";
import DealerSalesPage from "./modules/dealer/DealerSalesPage";
import DealerNotificationsPage from "./modules/dealer/DealerNotificationsPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SplashPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/language" element={<LanguageSelection />} />
        <Route path="/role-selection" element={<RoleSelectionPage />} />

        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/farmer/voice" element={<VoiceAssistantPage />} />
        <Route
          path="/farmer/dealer-products"
          element={<FarmerDealerProductsPage />}
        />
        <Route
          path="/farmer/product/:dealerUid/:productId"
          element={<FarmerProductDetailsPage />}
        />
        <Route
          path="/farmer/orders"
          element={<FarmerOrdersPage />}
        />
        <Route
          path="/farmer/notifications"
          element={<FarmerNotificationsPage />}
        />

        <Route path="/community" element={<CommunityPage />} />

        <Route path="/weather" element={<WeatherPage />} />
        <Route path="/market-prices" element={<MarketPricesPage />} />
        <Route path="/animal-care" element={<AnimalCarePage />} />
        <Route path="/crop-disease" element={<CropDiseasePage />} />
        <Route path="/profile" element={<FarmerProfilePage />} />
        <Route path="/sos" element={<SOSPage />} />
        <Route path="/govt-schemes" element={<GovtSchemesPage />} />

        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/farmers" element={<FarmersListPage />} />
        <Route path="/admin/sos" element={<SOSRequestsPage />} />
        <Route
          path="/admin/dealer-requests"
          element={<DealerRequestsPage />}
        />
        <Route
          path="/admin/kvk-requests"
          element={<KVKRequestsPage />}
        />

        <Route
          path="/kvk/register"
          element={<KVKRegistrationPage />}
        />
        <Route path="/kvk" element={<KVKDashboard />} />
        <Route path="/kvk/sos" element={<KVKSOSRequestsPage />} />

        <Route
          path="/dealer/register"
          element={<DealerRegistrationPage />}
        />
        <Route path="/dealer" element={<DealerDashboard />} />
        <Route
          path="/dealer/products"
          element={<DealerProductsPage />}
        />
        <Route
          path="/dealer/stock"
          element={<DealerStockPage />}
        />
        <Route
          path="/dealer/orders"
          element={<DealerOrdersPage />}
        />
        <Route
          path="/dealer/sales"
          element={<DealerSalesPage />}
        />
        <Route
          path="/dealer/notifications"
          element={<DealerNotificationsPage />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;