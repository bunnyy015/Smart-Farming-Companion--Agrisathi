import {
  BrowserRouter,
  Route,
  Routes,
} from "react-router-dom";

// ==============================
// Authentication
// ==============================
import SplashPage from "./modules/splash/SplashPage";
import LoginPage from "./modules/auth/LoginPage";
import RegisterPage from "./modules/auth/RegisterPage";
import LanguageSelection from "./modules/auth/LanguageSelection";
import RoleSelectionPage from "./modules/auth/RoleSelectionPage";
import ForgotPasswordPage from "./modules/auth/ForgotPasswordPage";

// ==============================
// Farmer
// ==============================
import DashboardPage from "./modules/dashboard/DashboardPage";
import VoiceAssistantPage from "./utils/VoiceAssistantPage";
import WeatherPage from "./modules/weather/WeatherPage";
import MarketPricesPage from "./modules/market/MarketPricesPage";
import CropDiseasePage from "./modules/cropDisease/CropDiseasePage";
import FarmerProfilePage from "./modules/profile/FarmerProfilePage";
import GovtSchemesPage from "./modules/schemes/GovtSchemesPage";

import FarmerDealerProductsPage from "./modules/farmer/FarmerDealerProductsPage";
import FarmerProductDetailsPage from "./modules/farmer/FarmerProductDetailsPage";
import FarmerOrdersPage from "./modules/farmer/FarmerOrdersPage";
import FarmerOrderHistoryPage from "./modules/farmer/FarmerOrderHistoryPage";
import CropCareCalendarPage from "./modules/farmer/CropCareCalendarPage";
import FarmerNotificationsPage from "./modules/farmer/FarmerNotificationsPage";

import CommunityPage from "./modules/community/CommunityPage";
import NetworkStatusBanner from "./components/NetworkStatusBanner";

// ==============================
// Admin
// ==============================
import AdminDashboard from "./modules/admin/AdminDashboard";
import FarmersListPage from "./modules/admin/FarmersListPage";
import FarmerManagementPage from "./modules/admin/FarmerManagementPage";
import OrderManagementPage from "./modules/admin/OrderManagementPage";
import DealerRequestsPage from "./modules/admin/DealerRequestsPage";
import ApprovedDealersPage from "./modules/admin/ApprovedDealersPage";
import MarketPricesManagementPage from "./modules/admin/MarketPricesManagementPage";
import DealerManagementPage from "./modules/admin/DealerManagementPage";
import ReportsStatisticsPage from "./modules/admin/ReportsStatisticsPage";
import AdminProductsPage from "./modules/admin/AdminProductsPage";
import AdminOrderManagementPage from "./modules/admin/AdminOrderManagementPage";

// ==============================
// Dealer
// ==============================
import DealerDashboard from "./modules/dealer/DealerDashboard";
import DealerRegistrationPage from "./modules/dealer/DealerRegistrationPage";
import DealerProductsPage from "./modules/dealer/DealerProductsPage";
import DealerStockPage from "./modules/dealer/DealerStockPage";
import DealerOrdersPage from "./modules/dealer/DealerOrdersPage";
import DealerSalesPage from "./modules/dealer/DealerSalesPage";
import DealerNotificationsPage from "./modules/dealer/DealerNotificationsPage";
import DealerProfilePage from "./modules/dealer/DealerProfilePage";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* =====================================================
            AUTHENTICATION ROUTES
        ===================================================== */}

        <Route
          path="/"
          element={<SplashPage />}
        />

        <Route
          path="/login"
          element={<LoginPage />}
        />

        <Route
          path="/register"
          element={<RegisterPage />}
        />

        <Route
          path="/language"
          element={<LanguageSelection />}
        />

        <Route
          path="/role-selection"
          element={<RoleSelectionPage />}
        />

        <Route
          path="/forgot-password"
          element={<ForgotPasswordPage />}
        />


        {/* =====================================================
            FARMER ROUTES
        ===================================================== */}

        <Route
          path="/dashboard"
          element={<DashboardPage />}
        />

        <Route
          path="/farmer/voice"
          element={<VoiceAssistantPage />}
        />

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
          path="/farmer/history"
          element={<FarmerOrderHistoryPage />}
        />

        <Route
          path="/farmer/crop-calendar"
          element={<CropCareCalendarPage />}
        />

        <Route
          path="/farmer/notifications"
          element={<FarmerNotificationsPage />}
        />

        <Route
          path="/weather"
          element={<WeatherPage />}
        />

        <Route
          path="/market-prices"
          element={<MarketPricesPage />}
        />

        <Route
          path="/crop-disease"
          element={<CropDiseasePage />}
        />

        <Route
          path="/profile"
          element={<FarmerProfilePage />}
        />

        <Route
          path="/govt-schemes"
          element={<GovtSchemesPage />}
        />

        <Route
          path="/community"
          element={<CommunityPage />}
        />


        {/* =====================================================
            ADMIN DASHBOARD
        ===================================================== */}

        <Route
          path="/admin"
          element={<AdminDashboard />}
        />


        {/* =====================================================
            ADMIN - FARMERS
        ===================================================== */}

        <Route
          path="/admin/farmers"
          element={<FarmersListPage />}
        />

        <Route
          path="/admin/farmer-management"
          element={<FarmerManagementPage />}
        />


        {/* =====================================================
            ADMIN - DEALERS
        ===================================================== */}

        <Route
          path="/admin/dealer-requests"
          element={<DealerRequestsPage />}
        />

        <Route
          path="/admin/dealers"
          element={<ApprovedDealersPage />}
        />

        <Route
          path="/admin/dealer-management"
          element={<DealerManagementPage />}
        />


        {/* =====================================================
            ADMIN - MARKET PRICES
        ===================================================== */}

        <Route
          path="/admin/market-prices"
          element={<MarketPricesManagementPage />}
        />


        {/* =====================================================
            ADMIN - ORDERS
        ===================================================== */}

        <Route
          path="/admin/orders"
          element={<AdminOrderManagementPage />}
        />


        {/* =====================================================
            ADMIN - PRODUCTS
        ===================================================== */}

        <Route
          path="/admin/products"
          element={<AdminProductsPage />}
        />


        {/* =====================================================
            ADMIN - REPORTS
        ===================================================== */}

        <Route
          path="/admin/reports"
          element={<ReportsStatisticsPage />}
        />

        <Route
          path="/admin/reports-statistics"
          element={<ReportsStatisticsPage />}
        />


        {/* =====================================================
            DEALER
        ===================================================== */}

        <Route
          path="/dealer"
          element={<DealerDashboard />}
        />

        <Route
          path="/dealer/register"
          element={<DealerRegistrationPage />}
        />

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


        {/* =====================================================
            DEALER PROFILE
        ===================================================== */}

        <Route
          path="/dealer/profile"
          element={<DealerProfilePage />}
        />


        {/* =====================================================
            INVALID ROUTE
        ===================================================== */}

        <Route
          path="*"
          element={<SplashPage />}
        />

      </Routes>
      <NetworkStatusBanner />
    </BrowserRouter>
  );
}

export default App;