import { useEffect, useMemo, useState } from "react";
import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  get,
  push,
  ref,
  set,
} from "firebase/database";
import { auth, database } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";
import CategoryFilter from "../../components/marketplace/CategoryFilter";
import MarketplaceProductCard from "../../components/marketplace/MarketplaceProductCard";
import MarketplaceEmptyState from "../../components/marketplace/MarketplaceEmptyState";
import useLanguage from "../../utils/useLanguage";
import { t } from "../../utils/language";

export default function FarmerDealerProductsPage() {
  const navigate = useNavigate();
  const language = useLanguage();
  const [searchParams] = useSearchParams();

  const voiceSearch =
    searchParams.get("search") || "";

  const [farmer, setFarmer] = useState(null);
  const [allProducts, setAllProducts] = useState([]);
  const [searchText, setSearchText] =
    useState(voiceSearch);
  const [selectedCategory, setSelectedCategory] =
    useState("all");
  const [quantities, setQuantities] = useState({});
  const [submittingKey, setSubmittingKey] =
    useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadMarketplace();
  }, []);

  const products = useMemo(() => {
    const searchQuery = searchText
      .trim()
      .toLowerCase();

    return allProducts.filter((product) => {
      const categoryMatches =
        selectedCategory === "all" ||
        product.category === selectedCategory;

      if (!categoryMatches) {
        return false;
      }

      if (!searchQuery) {
        return true;
      }

      const searchableText = [
        product.productName,
        product.category,
        product.brand,
        product.description,
        product.dealerName,
        product.dealerDistrict,
        product.dealerState,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(searchQuery);
    });
  }, [
    allProducts,
    searchText,
    selectedCategory,
  ]);

  function showMessage(type, text) {
    setMessage({ type, text });

    window.setTimeout(() => {
      setMessage(null);
    }, 5000);
  }

  function normalize(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  function getProductKey(product) {
    return `${product.dealerUid}-${product.id}`;
  }

  function updateQuantity(product, quantity) {
    const key = getProductKey(product);

    setQuantities((current) => ({
      ...current,
      [key]: quantity,
    }));
  }

  function getQuantity(product) {
    const key = getProductKey(product);

    return Number(quantities[key] || 1);
  }

  async function loadMarketplace() {
    setLoading(true);

    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        navigate("/login", { replace: true });
        return;
      }

      const [userSnapshot, farmerSnapshot] =
        await Promise.all([
          get(
            ref(
              database,
              `users/${currentUser.uid}`
            )
          ),
          get(
            ref(
              database,
              `farmers/${currentUser.uid}`
            )
          ),
        ]);

      if (!userSnapshot.exists()) {
        showMessage(
          "error",
          "Farmer account was not found."
        );
        return;
      }

      const userData = userSnapshot.val();
      const farmerDetails = farmerSnapshot.exists()
        ? farmerSnapshot.val()
        : {};

      if (userData.role !== "farmer") {
        navigate("/role-selection", {
          replace: true,
        });
        return;
      }

      const farmerData = {
        ...userData,
        ...farmerDetails,
        role: userData.role,
      };

      const farmerProfile = {
        uid: currentUser.uid,
        ...farmerData,
      };

      setFarmer(farmerProfile);

      const productsSnapshot = await get(
        ref(database, "dealerProducts")
      );

      if (!productsSnapshot.exists()) {
        setAllProducts([]);
        return;
      }

      const flattenedProducts = [];

      Object.entries(
        productsSnapshot.val()
      ).forEach(
        ([dealerUid, dealerProducts]) => {
          if (
            !dealerProducts ||
            typeof dealerProducts !== "object"
          ) {
            return;
          }

          Object.entries(dealerProducts).forEach(
            ([productId, product]) => {
              if (
                !product ||
                typeof product !== "object"
              ) {
                return;
              }

              flattenedProducts.push({
                id: productId,
                dealerUid,
                ...product,
              });
            }
          );
        }
      );

      const dealerUids = [
        ...new Set(
          flattenedProducts.map(
            (product) => product.dealerUid
          )
        ),
      ];

      const dealerEntries = await Promise.all(
        dealerUids.map(async (dealerUid) => {
          try {
            const dealerSnapshot = await get(
              ref(
                database,
                `users/${dealerUid}`
              )
            );

            if (!dealerSnapshot.exists()) {
              return [dealerUid, null];
            }

            const dealerData =
              dealerSnapshot.val();

            if (dealerData.role !== "dealer") {
              return [dealerUid, null];
            }

            return [dealerUid, dealerData];
          } catch (error) {
            console.error(
              `Unable to load dealer ${dealerUid}:`,
              error
            );

            return [dealerUid, null];
          }
        })
      );

      const dealerMap =
        Object.fromEntries(dealerEntries);

      const farmerDistrict = normalize(
        farmerData.district
      );

      const farmerState = normalize(
        farmerData.state
      );

      const marketplaceProducts =
        flattenedProducts
          .map((product) => {
            const dealer =
              dealerMap[product.dealerUid];

            if (!dealer) {
              return null;
            }

            return {
              ...product,

              dealerName:
                dealer.dealerName ||
                dealer.shopName ||
                dealer.businessName ||
                dealer.name ||
                "Local Dealer",

              dealerPhone:
                dealer.phone ||
                dealer.mobile ||
                dealer.phoneNumber ||
                "",

              dealerDistrict:
                dealer.district || "",

              dealerState:
                dealer.state || "",

              dealerAddress:
                dealer.address ||
                dealer.shopAddress ||
                dealer.businessAddress ||
                "",
            };
          })
          .filter(Boolean)
          .filter(
            (product) =>
              product.status !== "inactive" &&
              Number(product.quantity || 0) > 0
          )
          .filter((product) => {
            if (
              !farmerDistrict &&
              !farmerState
            ) {
              return true;
            }

            const dealerDistrict = normalize(
              product.dealerDistrict
            );

            const dealerState = normalize(
              product.dealerState
            );

            return (
              (farmerDistrict &&
                dealerDistrict ===
                  farmerDistrict) ||
              (farmerState &&
                dealerState === farmerState)
            );
          })
          .sort((first, second) => {
            const firstIsSameDistrict =
              normalize(
                first.dealerDistrict
              ) === farmerDistrict;

            const secondIsSameDistrict =
              normalize(
                second.dealerDistrict
              ) === farmerDistrict;

            if (
              firstIsSameDistrict &&
              !secondIsSameDistrict
            ) {
              return -1;
            }

            if (
              !firstIsSameDistrict &&
              secondIsSameDistrict
            ) {
              return 1;
            }

            return String(
              first.productName || ""
            ).localeCompare(
              String(
                second.productName || ""
              )
            );
          });

      const initialQuantities = {};

      marketplaceProducts.forEach((product) => {
        initialQuantities[
          getProductKey(product)
        ] = 1;
      });

      setQuantities(initialQuantities);
      setAllProducts(marketplaceProducts);
    } catch (error) {
      console.error(
        "Marketplace error:",
        error
      );

      setAllProducts([]);

      showMessage(
        "error",
        String(error?.message || "")
          .toLowerCase()
          .includes("permission denied")
          ? "Marketplace access is blocked by Firebase rules."
          : "Products could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  async function requestOrder(product) {
    const key = getProductKey(product);

    try {
      const currentUser = auth.currentUser;

      if (!currentUser || !farmer) {
        navigate("/login", { replace: true });
        return;
      }

      const quantity = getQuantity(product);
      const availableQuantity = Number(
        product.quantity || 0
      );
      const price = Number(
        product.price || 0
      );

      if (
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        showMessage(
          "warning",
          "Choose a valid quantity."
        );
        return;
      }

      if (quantity > availableQuantity) {
        showMessage(
          "warning",
          `Only ${availableQuantity} ${
            product.unit || "units"
          } are available.`
        );
        return;
      }

      setSubmittingKey(key);

      const orderReference = push(
        ref(database, "dealerOrders")
      );

      const now = new Date().toISOString();
      const deliveryAddressDetails = {
        name: farmer.fullName || farmer.farmerName || farmer.name || "Farmer",
        phone: farmer.phone || farmer.mobile || farmer.phoneNumber || "",
        address: farmer.address || farmer.deliveryAddress || "",
        village: farmer.village || "",
        mandal: farmer.mandal || "",
        district: farmer.district || "",
        state: farmer.state || "",
        pincode: farmer.pincode || farmer.pinCode || farmer.postalCode || "",
      };
      const deliveryAddress = [
        deliveryAddressDetails.address,
        deliveryAddressDetails.village,
        deliveryAddressDetails.mandal,
        deliveryAddressDetails.district,
        deliveryAddressDetails.state,
        deliveryAddressDetails.pincode,
      ].filter(Boolean).join(", ") || "Address not added";

      await set(orderReference, {
        farmerUid: currentUser.uid,

        farmerName:
          farmer.fullName ||
          farmer.farmerName ||
          farmer.name ||
          "Farmer",

        farmerPhone:
          farmer.phone ||
          farmer.mobile ||
          farmer.phoneNumber ||
          "",

        farmerDistrict:
          farmer.district || "",

        farmerState:
          farmer.state || "",

        deliveryAddress,
        deliveryAddressDetails,

        dealerUid: product.dealerUid,
        dealerName: product.dealerName,
        dealerPhone:
          product.dealerPhone || "",

        productId: product.id,
        productName: product.productName,
        category: product.category || "",
        brand: product.brand || "",
        unit: product.unit || "unit",

        price,
        quantity,
        totalAmount: price * quantity,

        paymentMode: "Cash on Delivery",
        status: "pending",

        stockReserved: false,
        farmerReceived: false,
        dealerPaymentReceived: false,
        saleRecorded: false,

        source: voiceSearch
          ? "voice_marketplace"
          : "farmer_marketplace",

        createdAt: now,
        updatedAt: now,
      });

      updateQuantity(product, 1);

      showMessage(
        "success",
        t("orderRequestSent", {}, language)
      );
    } catch (error) {
      console.error(
        "Order request error:",
        error
      );

      showMessage(
        "error",
        String(error?.message || "")
          .toLowerCase()
          .includes("permission denied")
          ? t("orderAccessBlocked", {}, language)
          : t("orderRequestFailed", {}, language)
      );
    } finally {
      setSubmittingKey("");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-7 text-center">
          <div className="text-5xl">
            🌾
          </div>

          <h1 className="text-xl font-bold text-green-900 mt-4">
            {t("nearbyProductsLoading", {}, language)}
          </h1>

          <p className="text-sm text-gray-500 mt-2">
            {t("pleaseWait", {}, language)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <StatusMessage
          message={message}
          onClose={() => setMessage(null)}
        />

        <header className="bg-gradient-to-r from-green-800 to-green-600 text-white rounded-2xl shadow p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <button
                type="button"
                onClick={() =>
                  navigate("/dashboard")
                }
                className="text-green-100 font-semibold"
              >
                {t("dashboardLink", {}, language)}
              </button>

              <h1 className="text-3xl font-bold mt-3">
                {t("localMarketplace", {}, language)}
              </h1>

              <p className="text-green-100 mt-1">
                {t("marketplaceIntro", {}, language)}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                navigate("/farmer/orders")
              }
              className="bg-white text-green-800 px-4 py-2.5 rounded-xl font-semibold shadow-sm"
            >
              {t("myOrdersButton", {}, language)}
            </button>
          </div>

          <div className="bg-white/15 rounded-xl px-4 py-3 mt-4 text-sm">
            {t("nearLabel", {}, language)}{" "}
            <strong>
              {farmer?.district ||
                farmer?.state ||
                t("registeredArea", {}, language)}
            </strong>
          </div>
        </header>

        <section className="bg-white rounded-2xl border border-green-100 shadow-sm p-4 mt-5">
          <label
            htmlFor="marketplace-search"
            className="font-semibold text-gray-800"
          >
            {t("searchProduct", {}, language)}
          </label>

          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <input
              id="marketplace-search"
              type="search"
              value={searchText}
              onChange={(event) =>
                setSearchText(
                  event.target.value
                )
              }
              placeholder={t("marketplaceSearchPlaceholder", {}, language)}
              className="flex-1 border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-600"
            />

            <button
              type="button"
              onClick={() =>
                navigate("/farmer/voice")
              }
              className="border border-green-700 text-green-700 px-4 py-3 rounded-xl font-semibold"
            >
              {t("speak", {}, language)}
            </button>

            <button
              type="button"
              onClick={loadMarketplace}
              className="bg-green-700 text-white px-4 py-3 rounded-xl font-semibold"
            >
              {t("refresh", {}, language)}
            </button>
          </div>

          {voiceSearch && (
            <p className="text-sm text-green-700 mt-3">
              {t("voiceSearchLabel", {}, language)}{" "}
              <strong>{voiceSearch}</strong>
            </p>
          )}
        </section>

        <section className="mt-5">
          <CategoryFilter
            selectedCategory={
              selectedCategory
            }
            onSelect={setSelectedCategory}
          />
        </section>

        <section className="mt-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-green-900">
              {t("nearbyProducts", {}, language)}
            </h2>

            <span className="text-sm text-gray-500">
              {products.length} {t("productsFound", {}, language)}
            </span>
          </div>

          {products.length === 0 ? (
            <MarketplaceEmptyState
              searchText={searchText}
              onClear={() => {
                setSearchText("");
                setSelectedCategory("all");
              }}
              onRefresh={loadMarketplace}
            />
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {products.map((product) => {
                const key =
                  getProductKey(product);

                return (
                <MarketplaceProductCard
  key={key}
  product={product}
  quantity={getQuantity(product)}
  sending={submittingKey === key}
  onQuantityChange={(quantity) =>
    updateQuantity(product, quantity)
  }
  onRequestOrder={() =>
    requestOrder(product)
  }
  onViewDetails={() =>
    navigate(
      `/farmer/product/${product.dealerUid}/${product.id}`
    )
  }
/>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
