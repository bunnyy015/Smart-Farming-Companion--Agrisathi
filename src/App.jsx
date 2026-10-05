import { lazy, Suspense } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

// ==============================
// Authentication
// ==============================
import SplashPage from "./modules/splash/SplashPage";
import LoginPage from "./modules/auth/LoginPage";
import RegisterPage from "./modules/auth/RegisterPage";
import RoleSelectionPage from "./modules/auth/RoleSelectionPage";
import ForgotPasswordPage from "./modules/auth/ForgotPasswordPage";
import DealerAccessGuard from "./components/DealerAccessGuard";

// ==============================
// Farmer
// ==============================
const DashboardPage = lazy(() => import("./modules/dashboard/DashboardPage"));
const VoiceAssistantPage = lazy(() => import("./utils/VoiceAssistantPage"));
const WeatherPage = lazy(() => import("./modules/weather/WeatherPage"));
const MarketPricesPage = lazy(() => import("./modules/market/MarketPricesPage"));
const CropDiseasePage = lazy(() => import("./modules/cropDisease/CropDiseasePage"));
const FarmerProfilePage = lazy(() => import("./modules/profile/FarmerProfilePage"));
const GovtSchemesPage = lazy(() => import("./modules/schemes/GovtSchemesPage"));
const FarmerDealerProductsPage = lazy(() => import("./modules/farmer/FarmerDealerProductsPage"));
const FarmerProductDetailsPage = lazy(() => import("./modules/farmer/FarmerProductDetailsPage"));
const FarmerOrdersPage = lazy(() => import("./modules/farmer/FarmerOrdersPage"));
const FarmerNotificationsPage = lazy(() => import("./modules/farmer/FarmerNotificationsPage"));
const CommunityPage = lazy(() => import("./modules/community/CommunityPage"));

// ==============================
// Admin
// ==============================
import AdminDashboard from "./modules/admin/AdminDashboard";
import FarmersListPage from "./modules/admin/FarmersListPage";
import DealerRequestsPage from "./modules/admin/DealerRequestsPage";
import MarketPricesManagementPage from "./modules/admin/MarketPricesManagementPage";
import DealerManagementPage from "./modules/admin/DealerManagementPage";
import ReportsStatisticsPage from "./modules/admin/ReportsStatisticsPage";
import AdminProductsPage from "./modules/admin/AdminProductsPage";
import AdminOrderManagementPage from "./modules/admin/AdminOrderManagementPage";
import AdminGovernmentSchemesPage from "./modules/admin/AdminGovernmentSchemesPage";

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
      <Suspense
        fallback={(
          <div className="min-h-screen flex items-center justify-center bg-green-50 text-green-800 font-medium">
            Loading page…
          </div>
        )}
      >
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
          element={<Navigate to="/role-selection" replace />}
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
          element={<Navigate to="/farmer/orders?filter=history" replace />}
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
          element={<Navigate to="/admin/farmers" replace />}
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
          element={<Navigate to="/admin/dealer-management" replace />}
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

        <Route
          path="/admin/schemes"
          element={<AdminGovernmentSchemesPage />}
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
          element={<DealerAccessGuard><DealerDashboard /></DealerAccessGuard>}
        />

        <Route
          path="/dealer/register"
          element={<DealerRegistrationPage />}
        />

        <Route
          path="/dealer/products"
          element={<DealerAccessGuard><DealerProductsPage /></DealerAccessGuard>}
        />

        <Route
          path="/dealer/stock"
          element={<DealerAccessGuard><DealerStockPage /></DealerAccessGuard>}
        />

        <Route
          path="/dealer/orders"
          element={<DealerAccessGuard><DealerOrdersPage /></DealerAccessGuard>}
        />

        <Route
          path="/dealer/sales"
          element={<DealerAccessGuard><DealerSalesPage /></DealerAccessGuard>}
        />

        <Route
          path="/dealer/notifications"
          element={<DealerAccessGuard><DealerNotificationsPage /></DealerAccessGuard>}
        />


        {/* =====================================================
            DEALER PROFILE
        ===================================================== */}

        <Route
          path="/dealer/profile"
          element={<DealerAccessGuard><DealerProfilePage /></DealerAccessGuard>}
        />


        {/* =====================================================
            INVALID ROUTE
        ===================================================== */}

        <Route
          path="*"
          element={<SplashPage />}
        />

        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
