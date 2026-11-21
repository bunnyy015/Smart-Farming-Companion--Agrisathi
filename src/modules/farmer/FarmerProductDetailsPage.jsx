import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { get, push, ref, set } from "firebase/database";
import { auth, database, getAuthUser } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";
import QuantitySelector from "../../components/marketplace/QuantitySelector";
import useLanguage from "../../utils/useLanguage";
import { t } from "../../utils/language";
import { createOrderAcceptanceFields } from "../../utils/orderAcceptanceTimer";
import "./FarmerProductDetailsPage.css";

function getProductImage(product) {
  return [
    product?.imageUrl,
    product?.imageURL,
    product?.image,
    product?.productImage,
    product?.productImageUrl,
    product?.photoURL,
    product?.photoUrl,
  ].find((value) => typeof value === "string" && value.trim()) || "";
}

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

      const acceptanceFields = await createOrderAcceptanceFields(database);
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
        dealerShopName: dealer?.shopName || dealer?.businessName || "",
        dealerAddress:
          dealer?.address || dealer?.shopAddress || dealer?.businessAddress || "",

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
        reservationType: "shop_collection",
        dealerResponseDeadline: acceptanceFields.acceptanceDeadlineAt,

        stockReserved: false,
        farmerReceived: false,
        dealerPaymentReceived: false,
        saleRecorded: false,

        source: "product_details",

        ...acceptanceFields,
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
      <div className="farmer-product-details-page farmer-product-details-page--loading min-h-screen flex items-center justify-center p-4">
        <div className="farmer-product-unavailable-card rounded-2xl p-7 text-center">
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
      <div className="farmer-product-details-page min-h-screen p-4 md:p-6">
        <div className="w-full">
          <StatusMessage
            message={message}
            onClose={() => setMessage(null)}
          />

          <div className="farmer-product-unavailable-card rounded-2xl p-8 text-center">
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
  const productImage = getProductImage(product);

  return (
    <div className="farmer-product-details-page min-h-screen p-4 md:p-6">
      <div className="farmer-product-details-content w-full">
        <StatusMessage
          message={message}
          onClose={() => setMessage(null)}
        />

        <header className="farmer-product-details-nav mb-5 rounded-2xl p-4 sm:p-5">
          <button
            type="button"
            onClick={() =>
              navigate("/farmer/dealer-products")
            }
            className="farmer-product-details-back font-semibold"
          >
            {t("localMarketplace", {}, language)}
          </button>
        </header>

        <main className="farmer-product-details-card overflow-hidden rounded-3xl">
          <section className="farmer-product-details-hero p-5 text-white sm:p-7">
            <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
              <div className="farmer-product-image relative flex h-36 w-36 shrink-0 items-center justify-center overflow-hidden rounded-2xl sm:h-40 sm:w-40">
                {productImage ? (
                  <img
                    src={productImage}
                    alt={product.productName || t("farmProduct", {}, language)}
                    className="farmer-product-image__media absolute inset-0 h-full w-full object-contain"
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                      const fallback = event.currentTarget.nextElementSibling;
                      if (fallback) fallback.style.display = "flex";
                    }}
                  />
                ) : null}
                <div className={`${productImage ? "hidden" : "flex"} farmer-product-image__fallback absolute inset-0 items-center justify-center`}>
                  <span aria-hidden="true">{getCategoryIcon(product.category)}</span>
                </div>
              </div>

              <div className="min-w-0">
                <h1 className="break-words text-3xl font-extrabold tracking-tight sm:text-4xl">
                  {product.productName}
                </h1>

                <p className="farmer-product-details-subtitle mt-2">
                  {product.category || t("farmProduct", {}, language)}
                  {product.brand
                    ? ` • ${product.brand}`
                    : ""}
                </p>
              </div>
            </div>
          </section>

          <section className="farmer-product-details-body p-4 sm:p-7">
            <div className="farmer-product-stats grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="farmer-product-stat farmer-product-stat--price rounded-2xl p-4 sm:p-5">
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

              <div className="farmer-product-stat farmer-product-stat--stock rounded-2xl p-4 sm:p-5">
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
              <div className="farmer-product-description mt-5 rounded-2xl p-4 sm:p-5">
                <h2 className="font-bold text-green-950">
                  {t("productInformation", {}, language)}
                </h2>

                <p className="mt-2 leading-7 text-gray-700">
                  {product.description}
                </p>
              </div>
            )}

            <div className="farmer-product-dealer mt-5 border-t pt-5">
              <h2 className="font-bold text-green-950">
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
                  className="farmer-product-call-dealer ml-2 inline-block rounded-full px-3 py-1 text-xs font-semibold"
                >
                  {t("callDealer", {}, language)}
                </a>
              )}
            </div>

            <div className="farmer-product-order-panel mt-5 border-t pt-5">
              <h2 className="font-bold text-green-950">
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

                <p className="farmer-product-total font-bold text-green-950">
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
                className="farmer-product-request-order mt-5 w-full rounded-xl py-3 font-semibold text-white disabled:bg-gray-400"
              >
                {sending
                  ? t("sendingOrderRequest", {}, language)
                  : t("requestOrder", {}, language)}
              </button>

              <p className="text-center text-sm text-gray-500 mt-3">
                Reserve now and collect from the dealer’s shop after confirmation. Payment is made directly at the shop.
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
