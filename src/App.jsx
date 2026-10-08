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
const LoginPage = lazy(() => import("./modules/auth/LoginPage"));
const RegisterPage = lazy(() => import("./modules/auth/RegisterPage"));
const RoleSelectionPage = lazy(() => import("./modules/auth/RoleSelectionPage"));
const ForgotPasswordPage = lazy(() => import("./modules/auth/ForgotPasswordPage"));
const DealerAccessGuard = lazy(() => import("./components/DealerAccessGuard"));

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
const NearbyServicesPage = lazy(() => import("./modules/farmer/NearbyServicesPage"));

// ==============================
// Admin
// ==============================
const AdminDashboard = lazy(() => import("./modules/admin/AdminDashboard"));
const FarmersListPage = lazy(() => import("./modules/admin/FarmersListPage"));
const DealerRequestsPage = lazy(() => import("./modules/admin/DealerRequestsPage"));
const MarketPricesManagementPage = lazy(() => import("./modules/admin/MarketPricesManagementPage"));
const DealerManagementPage = lazy(() => import("./modules/admin/DealerManagementPage"));
const ReportsStatisticsPage = lazy(() => import("./modules/admin/ReportsStatisticsPage"));
const AdminProductsPage = lazy(() => import("./modules/admin/AdminProductsPage"));
const AdminOrderManagementPage = lazy(() => import("./modules/admin/AdminOrderManagementPage"));
const AdminGovernmentSchemesPage = lazy(() => import("./modules/admin/AdminGovernmentSchemesPage"));

// ==============================
// Dealer
// ==============================
const DealerDashboard = lazy(() => import("./modules/dealer/DealerDashboard"));
const DealerRegistrationPage = lazy(() => import("./modules/dealer/DealerRegistrationPage"));
const DealerProductsPage = lazy(() => import("./modules/dealer/DealerProductsPage"));
const DealerStockPage = lazy(() => import("./modules/dealer/DealerStockPage"));
const DealerOrdersPage = lazy(() => import("./modules/dealer/DealerOrdersPage"));
const DealerSalesPage = lazy(() => import("./modules/dealer/DealerSalesPage"));
const DealerNotificationsPage = lazy(() => import("./modules/dealer/DealerNotificationsPage"));
const DealerProfilePage = lazy(() => import("./modules/dealer/DealerProfilePage"));

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
          path="/farmer/nearby-services"
          element={<NearbyServicesPage />}
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
