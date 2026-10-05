import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { get, push, ref, set } from "firebase/database";
import { auth, database, getAuthUser } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";
import QuantitySelector from "../../components/marketplace/QuantitySelector";
import useLanguage from "../../utils/useLanguage";
import { t } from "../../utils/language";

function getCategoryIcon(category) {
  const icons = {
    Seeds: "🌾",
    Fertilizer: "🧪",
    Pesticide: "🛡️",
    Tools: "🛠️",
    "Animal Feed": "🐄",
  };

  return icons[category] || "🌱";
}

export default function FarmerProductDetailsPage() {
  const language = useLanguage();
  const navigate = useNavigate();
  const { dealerUid, productId } = useParams();

  const [farmer, setFarmer] = useState(null);
  const [product, setProduct] = useState(null);
  const [dealer, setDealer] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadProductDetails();
  }, [dealerUid, productId]);

  function showMessage(type, text) {
    setMessage({ type, text });

    window.setTimeout(() => {
      setMessage(null);
    }, 5000);
  }

  async function loadProductDetails() {
    setLoading(true);

    try {
      const currentUser = await getAuthUser();

      if (!currentUser) {
        navigate("/login", { replace: true });
        return;
      }

      const farmerSnapshot = await get(
        ref(database, `users/${currentUser.uid}`)
      );

      if (
        !farmerSnapshot.exists() ||
        farmerSnapshot.val().role !== "farmer"
      ) {
        navigate("/role-selection", { replace: true });
        return;
      }

      setFarmer({
        uid: currentUser.uid,
        ...farmerSnapshot.val(),
      });

      const productSnapshot = await get(
        ref(
          database,
          `dealerProducts/${dealerUid}/${productId}`
        )
      );

      if (!productSnapshot.exists()) {
        setProduct(null);
        showMessage(
          "error",
          "This product is no longer available."
        );
        return;
      }

      const productData = productSnapshot.val();

      if (
        productData.status === "inactive" ||
        Number(productData.quantity || 0) <= 0
      ) {
        setProduct(null);
        showMessage(
          "warning",
          "This product is currently out of stock."
        );
        return;
      }

      setProduct({
        id: productId,
        dealerUid,
        ...productData,
      });

      const dealerSnapshot = await get(
        ref(database, `users/${dealerUid}`)
      );

      if (
        dealerSnapshot.exists() &&
        dealerSnapshot.val().role === "dealer"
      ) {
        setDealer(dealerSnapshot.val());
      } else {
        setDealer(null);
      }
    } catch (error) {
      console.error("Product details error:", error);

      showMessage(
        "error",
        String(error?.message || "")
          .toLowerCase()
          .includes("permission denied")
          ? "Product access is blocked by Firebase rules."
          : "Product details could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  async function requestOrder() {
    try {
      const currentUser = auth.currentUser;

      if (!currentUser || !farmer || !product) {
        navigate("/login", { replace: true });
        return;
      }

      const availableQuantity = Number(
        product.quantity || 0
      );

      const selectedQuantity = Number(quantity || 1);
      const price = Number(product.price || 0);

      if (
        !Number.isInteger(selectedQuantity) ||
        selectedQuantity <= 0
      ) {
        showMessage(
          "warning",
          "Choose a valid quantity."
        );
        return;
      }

      if (selectedQuantity > availableQuantity) {
        showMessage(
          "warning",
          `Only ${availableQuantity} ${
            product.unit || "units"
          } are available.`
        );
        return;
      }

      setSending(true);

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

        farmerDistrict: farmer.district || "",
        farmerState: farmer.state || "",

        deliveryAddress,
        deliveryAddressDetails,

        dealerUid,
        dealerName:
          dealer?.dealerName ||
          dealer?.shopName ||
          dealer?.businessName ||
          dealer?.name ||
          "Local Dealer",

        dealerPhone:
          dealer?.phone ||
          dealer?.mobile ||
          dealer?.phoneNumber ||
          "",

        productId,
        productName: product.productName,
        category: product.category || "",
        brand: product.brand || "",
        unit: product.unit || "unit",

        price,
        quantity: selectedQuantity,
        totalAmount: price * selectedQuantity,

        paymentMode: "Cash on Delivery",
        status: "pending",

        stockReserved: false,
        farmerReceived: false,
        dealerPaymentReceived: false,
        saleRecorded: false,

        source: "product_details",

        createdAt: now,
        updatedAt: now,
      });

      setQuantity(1);

      showMessage(
        "success",
        t("orderRequestSent", {}, language)
      );
    } catch (error) {
      console.error("Order request error:", error);

      showMessage(
        "error",
        String(error?.message || "")
          .toLowerCase()
          .includes("permission denied")
          ? t("orderAccessBlocked", {}, language)
          : t("orderRequestFailed", {}, language)
      );
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm p-7 text-center">
          <div className="text-5xl">🌱</div>

          <h1 className="text-xl font-bold text-green-900 mt-4">
            {t("productLoading", {}, language)}
          </h1>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-green-50 p-4 md:p-6">
        <div className="w-full">
          <StatusMessage
            message={message}
            onClose={() => setMessage(null)}
          />

          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <div className="text-5xl">📦</div>

            <h1 className="text-xl font-bold text-green-900 mt-4">
              {t("productUnavailable", {}, language)}
            </h1>

            <button
              type="button"
              onClick={() =>
                navigate("/farmer/dealer-products")
              }
              className="bg-green-700 text-white px-5 py-3 rounded-xl font-semibold mt-5"
            >
              {t("viewOtherProducts", {}, language)}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const availableQuantity = Number(
    product.quantity || 0
  );

  const dealerName =
    dealer?.dealerName ||
    dealer?.shopName ||
    dealer?.businessName ||
    dealer?.name ||
    "Local Dealer";

  const dealerPhone =
    dealer?.phone ||
    dealer?.mobile ||
    dealer?.phoneNumber ||
    "";

  const dealerLocation =
    dealer?.district ||
    dealer?.state ||
    "Location not available";

  return (
    <div className="min-h-screen bg-green-50 p-4 md:p-6">
      <div className="w-full">
        <StatusMessage
          message={message}
          onClose={() => setMessage(null)}
        />

        <header className="bg-white rounded-2xl shadow-sm p-5 mb-5">
          <button
            type="button"
            onClick={() =>
              navigate("/farmer/dealer-products")
            }
            className="text-green-700 font-semibold"
          >
            {t("localMarketplace", {}, language)}
          </button>
        </header>

        <main className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <section className="bg-gradient-to-r from-green-800 to-green-600 text-white p-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-4xl">
                {getCategoryIcon(product.category)}
              </div>

              <div>
                <h1 className="text-3xl font-bold">
                  {product.productName}
                </h1>

                <p className="text-green-100 mt-1">
                  {product.category || t("farmProduct", {}, language)}
                  {product.brand
                    ? ` • ${product.brand}`
                    : ""}
                </p>
              </div>
            </div>
          </section>

          <section className="p-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 rounded-xl p-4">
                <p className="text-sm text-gray-500">
                  {t("priceLabel", {}, language)}
                </p>

                <p className="text-xl font-bold text-green-900 mt-1">
                  ₹{Number(product.price || 0).toFixed(2)}
                </p>

                <p className="text-sm text-gray-500">
                  {t("perUnit", { unit: product.unit || "unit" }, language)}
                </p>
              </div>

              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-sm text-gray-500">
                  {t("availableLabel", {}, language)}
                </p>

                <p className="text-xl font-bold text-blue-900 mt-1">
                  {availableQuantity}
                </p>

                <p className="text-sm text-gray-500">
                  {product.unit || t("unitsLabel", {}, language)}
                </p>
              </div>
            </div>

            {product.description && (
              <div className="mt-5">
                <h2 className="font-bold text-green-900">
                  {t("productInformation", {}, language)}
                </h2>

                <p className="text-gray-600 mt-2">
                  {product.description}
                </p>
              </div>
            )}

            <div className="border-t border-gray-100 mt-5 pt-5">
              <h2 className="font-bold text-green-900">
                {t("dealerLabel", {}, language)}
              </h2>

              <p className="font-semibold text-gray-800 mt-2">
                {dealerName}
              </p>

              <p className="text-sm text-gray-500 mt-1">
                📍 {dealerLocation}
              </p>

              <span className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold mt-3">
                {t("approvedDealer", {}, language)}
              </span>

              {dealerPhone && (
                <a
                  href={`tel:${dealerPhone}`}
                  className="inline-block ml-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold"
                >
                  {t("callDealer", {}, language)}
                </a>
              )}
            </div>

            <div className="border-t border-gray-100 mt-5 pt-5">
              <h2 className="font-bold text-green-900">
                {t("selectQuantity", {}, language)}
              </h2>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-4">
                <QuantitySelector
                  value={quantity}
                  minimum={1}
                  maximum={availableQuantity}
                  disabled={sending}
                  onChange={setQuantity}
                />

                <p className="font-bold text-green-900">
                  {t("totalLabel", {}, language)} ₹
                  {(
                    Number(product.price || 0) *
                    quantity
                  ).toFixed(2)}
                </p>
              </div>

              <button
                type="button"
                disabled={sending}
                onClick={requestOrder}
                className="w-full bg-green-700 text-white py-3 rounded-xl font-semibold mt-5 disabled:bg-gray-400"
              >
                {sending
                  ? t("sendingOrderRequest", {}, language)
                  : t("requestOrder", {}, language)}
              </button>

              <p className="text-center text-sm text-gray-500 mt-3">
                {t("paymentCashOnDelivery", {}, language)}
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
