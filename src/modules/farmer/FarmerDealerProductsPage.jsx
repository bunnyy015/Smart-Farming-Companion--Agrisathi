import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ref, get, push, set } from "firebase/database";
import { auth, database } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";

export default function FarmerDealerProductsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const searchFromVoice = searchParams.get("search") || "";

  const [farmer, setFarmer] = useState(null);
  const [allProducts, setAllProducts] = useState([]);
  const [products, setProducts] = useState([]);
  const [searchText, setSearchText] = useState(searchFromVoice);
  const [orderQuantity, setOrderQuantity] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadLocalProducts();
  }, []);

  useEffect(() => {
    filterProducts(searchText, allProducts);
  }, [searchText, allProducts]);

  function showMessage(type, text) {
    setMessage({ type, text });

    setTimeout(() => {
      setMessage(null);
    }, 5000);
  }

  async function loadLocalProducts() {
    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        navigate("/login");
        return;
      }

      const farmerSnapshot = await get(
        ref(database, `users/${currentUser.uid}`)
      );

      if (!farmerSnapshot.exists()) {
        showMessage("error", "Farmer profile not found.");
        navigate("/login");
        return;
      }

      const farmerData = farmerSnapshot.val();

      setFarmer({
        uid: currentUser.uid,
        ...farmerData,
      });

      const productsSnapshot = await get(ref(database, "dealerProducts"));

      if (!productsSnapshot.exists()) {
        setAllProducts([]);
        setProducts([]);
        return;
      }

      const productsData = productsSnapshot.val();
      const productList = [];

      Object.entries(productsData).forEach(([dealerUid, dealerProducts]) => {
        Object.entries(dealerProducts).forEach(([productId, product]) => {
          productList.push({
            id: productId,
            dealerUid,
            ...product,
          });
        });
      });

      const dealerUsersSnapshot = await get(ref(database, "users"));
      const usersData = dealerUsersSnapshot.exists()
        ? dealerUsersSnapshot.val()
        : {};

      const localProducts = productList
        .map((product) => {
          const dealerData = usersData[product.dealerUid];

          return {
            ...product,
            dealerName:
              dealerData?.dealerName ||
              dealerData?.shopName ||
              "Dealer",
            dealerPhone: dealerData?.phone || "",
            dealerDistrict: dealerData?.district || "",
            dealerState: dealerData?.state || "",
            dealerAddress: dealerData?.address || "",
          };
        })
        .filter((product) => Number(product.quantity || 0) > 0)
        .filter((product) => {
          const productDistrict = String(product.dealerDistrict || "")
            .trim()
            .toLowerCase();

          const farmerDistrict = String(farmerData.district || "")
            .trim()
            .toLowerCase();

          const productState = String(product.dealerState || "")
            .trim()
            .toLowerCase();

          const farmerState = String(farmerData.state || "")
            .trim()
            .toLowerCase();

          if (!farmerDistrict && !farmerState) {
            return true;
          }

          return (
            productDistrict === farmerDistrict ||
            productState === farmerState
          );
        });

      setAllProducts(localProducts);
      filterProducts(searchFromVoice, localProducts);
    } catch (error) {
      console.error(error);
      showMessage("error", "Failed to load dealer products.");
    } finally {
      setLoading(false);
    }
  }

  function filterProducts(text, list) {
    const query = String(text || "").trim().toLowerCase();

    if (!query) {
      setProducts(list);
      return;
    }

    const filtered = list.filter((product) => {
      const searchableText = `
        ${product.productName || ""}
        ${product.category || ""}
        ${product.brand || ""}
        ${product.description || ""}
        ${product.dealerName || ""}
      `.toLowerCase();

      return searchableText.includes(query);
    });

    setProducts(filtered);
  }

  async function placeOrder(product) {
    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        navigate("/login");
        return;
      }

      const quantity = Number(orderQuantity[product.id] || 1);

      if (quantity <= 0) {
        showMessage("warning", "Please enter valid quantity.");
        return;
      }

      if (quantity > Number(product.quantity)) {
        showMessage(
          "warning",
          "Requested quantity is more than available stock."
        );
        return;
      }

      const orderRef = push(ref(database, "dealerOrders"));

      await set(orderRef, {
        farmerUid: currentUser.uid,
        farmerName:
          farmer?.fullName ||
          farmer?.name ||
          farmer?.farmerName ||
          "Farmer",
        farmerPhone: farmer?.phone || farmer?.mobile || "",
        farmerDistrict: farmer?.district || "",
        farmerState: farmer?.state || "",
        deliveryAddress:
          farmer?.address ||
          farmer?.village ||
          "Farmer address not available",

        dealerUid: product.dealerUid,
        dealerName: product.dealerName,
        dealerPhone: product.dealerPhone,

        productId: product.id,
        productName: product.productName,
        category: product.category,
        brand: product.brand || "",
        unit: product.unit,
        price: Number(product.price),
        quantity,
        totalAmount: Number(product.price) * quantity,

        paymentMode: "Cash on Delivery",
        status: "pending",
        farmerReceived: false,
        dealerPaymentReceived: false,
        source: "farmer_voice_or_manual_request",
        createdAt: new Date().toISOString(),
      });

      showMessage(
        "success",
        `Order request sent to ${product.dealerName}. Payment mode: Cash on Delivery. You can contact dealer at ${product.dealerPhone || "phone not available"}.`
      );

      setOrderQuantity({
        ...orderQuantity,
        [product.id]: "",
      });
    } catch (error) {
      console.error(error);
      showMessage("error", "Failed to send order request.");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center">
        <h1 className="text-2xl font-bold text-green-700">
          Loading local dealer products...
        </h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-50 p-6">
      <div className="max-w-6xl mx-auto">
        <StatusMessage message={message} />

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-green-700 font-semibold mb-4"
          >
            ← Back to Dashboard
          </button>

          <h1 className="text-4xl font-bold text-green-700">
            🏪 Seeds & Fertilizers
          </h1>

          <p className="text-gray-600 mt-2">
            Search and request seeds, fertilizers and farming products from local dealers.
          </p>

          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl p-4 mt-4 text-sm">
            Payment mode is <b>Cash on Delivery</b>. After dealer accepts your request,
            contact the dealer directly by phone and confirm delivery.
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-5 mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Search Product
          </label>

          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search urea, DAP, seeds, pesticide..."
            className="w-full border border-gray-300 p-3 rounded-lg"
          />

          {searchFromVoice && (
            <p className="text-sm text-green-700 mt-2">
              Voice search applied: {searchFromVoice}
            </p>
          )}
        </div>

        {products.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <h2 className="text-2xl font-bold text-green-700">
              No products found
            </h2>

            <p className="text-gray-600 mt-2">
              Try another product name or ask nearby dealers to add stock.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {products.map((product) => (
              <div
                key={`${product.dealerUid}-${product.id}`}
                className="bg-white rounded-2xl shadow-lg p-6"
              >
                <h2 className="text-2xl font-bold text-green-700">
                  {product.productName}
                </h2>

                <p className="text-sm text-gray-600 mt-1">
                  {product.category} | {product.brand || "No brand"}
                </p>

                <div className="mt-4 space-y-1 text-sm text-gray-700">
                  <p>
                    <span className="font-semibold">Price:</span> ₹
                    {product.price} / {product.unit}
                  </p>

                  <p>
                    <span className="font-semibold">Available:</span>{" "}
                    {product.quantity} {product.unit}
                  </p>

                  <p>
                    <span className="font-semibold">Dealer:</span>{" "}
                    {product.dealerName}
                  </p>

                  <p>
                    <span className="font-semibold">Dealer Phone:</span>{" "}
                    {product.dealerPhone || "Not available"}
                  </p>

                  {product.dealerPhone && (
                    <a
                      href={`tel:${product.dealerPhone}`}
                      className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold mt-2"
                    >
                      📞 Call Dealer
                    </a>
                  )}

                  <p>
                    <span className="font-semibold">Location:</span>{" "}
                    {product.dealerDistrict || "District not available"},{" "}
                    {product.dealerState || "State not available"}
                  </p>

                  <p>
                    <span className="font-semibold">Address:</span>{" "}
                    {product.dealerAddress || "Not available"}
                  </p>

                  <p>
                    <span className="font-semibold">Payment:</span>{" "}
                    Cash on Delivery
                  </p>

                  {product.description && (
                    <p>
                      <span className="font-semibold">Description:</span>{" "}
                      {product.description}
                    </p>
                  )}
                </div>

                <div className="mt-5 flex flex-col md:flex-row gap-3">
                  <input
                    type="number"
                    min="1"
                    placeholder="Quantity"
                    value={orderQuantity[product.id] || ""}
                    onChange={(event) =>
                      setOrderQuantity({
                        ...orderQuantity,
                        [product.id]: event.target.value,
                      })
                    }
                    className="flex-1 border border-gray-300 p-3 rounded-lg"
                  />

                  <button
                    onClick={() => placeOrder(product)}
                    className="bg-green-700 text-white px-5 py-3 rounded-lg font-semibold hover:bg-green-800 transition"
                  >
                    Request Order
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}