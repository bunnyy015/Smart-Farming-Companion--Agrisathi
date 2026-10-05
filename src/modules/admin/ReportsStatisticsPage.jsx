import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get, ref } from "firebase/database";
import {
  ArrowDownUp,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleDollarSign,
  Clock3,
  Database,
  Eye,
  Filter,
  IndianRupee,
  MapPin,
  Package,
  PackageCheck,
  PackageOpen,
  RefreshCw,
  Search,
  ShoppingCart,
  Store,
  Truck,
  UserRound,
  Users,
  Warehouse,
  X,
} from "lucide-react";

import { auth, database } from "../../firebase";
import { signOut } from "firebase/auth";
import StatusMessage from "../../components/StatusMessage";

/*
|--------------------------------------------------------------------------
| REPORT DEFAULTS
|--------------------------------------------------------------------------
*/

const EMPTY_REPORT = {
  farmers: 0,
  dealers: 0,
  admins: 0,
  totalUsers: 0,
  dealerRequests: 0,
  products: 0,
  orders: 0,
  schemes: 0,
  availableProducts: 0,
  outOfStockProducts: 0,
  lowStockProducts: 0,
  totalStock: 0,
  reservedStock: 0,
  soldStock: 0,
};

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function getArrayFromFirebase(data) {
  if (!isObject(data)) {
    return [];
  }

  return Object.entries(data).map(([id, value]) => ({
    id,
    ...(isObject(value) ? value : {}),
  }));
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

function formatCurrency(value) {
  const number = Number(
    String(value ?? "")
      .replace(/,/g, "")
      .replace(/[₹$]/g, "")
      .trim()
  );

  if (!Number.isFinite(number)) {
    return "₹0";
  }

  return `₹${number.toLocaleString("en-IN")}`;
}

function formatDate(value) {
  if (!value) {
    return "Date unavailable";
  }

  if (typeof value === "number") {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Date unavailable";
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  const raw = String(value).trim();

  /*
   * Handle DD/MM/YYYY.
   */
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split("/");

    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day)
    );

    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return raw;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getDateValue(value) {
  if (!value) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  const raw = String(value).trim();

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split("/");

    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day)
    ).getTime();
  }

  const timestamp = new Date(raw).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getOrderStatus(order) {
  const status =
    order?.status ||
    order?.orderStatus ||
    order?.deliveryStatus ||
    "";

  return normalize(status) || "unknown";
}

function displayStatus(status) {
  if (!status) {
    return "Unknown";
  }

  return String(status)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function isCompletedOrder(order) {
  const status = getOrderStatus(order);

  return [
    "completed",
    "complete",
    "delivered",
    "fulfilled",
    "closed",
    "success",
  ].includes(status);
}

function getProductCategory(product) {
  return (
    String(
      product?.category ||
        product?.productCategory ||
        "Other"
    ).trim() || "Other"
  );
}

function getProductQuantity(product) {
  const quantity = Number(
    product?.quantity ??
      product?.availableQuantity ??
      0
  );

  return Number.isFinite(quantity) ? quantity : 0;
}

function getReservedQuantity(product) {
  const quantity = Number(
    product?.reservedQuantity ?? 0
  );

  return Number.isFinite(quantity) ? quantity : 0;
}

function getSoldQuantity(product) {
  const quantity = Number(
    product?.soldQuantity ?? 0
  );

  return Number.isFinite(quantity) ? quantity : 0;
}

function getOrderAmount(order) {
  const possibleValues = [
    order?.totalAmount,
    order?.grandTotal,
    order?.orderTotal,
    order?.totalPrice,
    order?.amount,
    order?.finalAmount,
    order?.total,
    order?.price,
  ];

  for (const value of possibleValues) {
    const number = Number(
      String(value ?? "")
        .replace(/,/g, "")
        .replace(/[₹$]/g, "")
        .trim()
    );

    if (Number.isFinite(number)) {
      return number;
    }
  }

  /*
   * If there is no direct total, calculate from items.
   */
  const items =
    order?.items ||
    order?.cartItems ||
    order?.products ||
    [];

  if (Array.isArray(items)) {
    return items.reduce((total, item) => {
      const quantity = Number(
        item?.quantity ?? item?.qty ?? 1
      );

      const price = Number(
        String(
          item?.price ??
            item?.unitPrice ??
            item?.sellingPrice ??
            0
        )
          .replace(/,/g, "")
          .replace(/[₹$]/g, "")
      );

      if (
        Number.isFinite(quantity) &&
        Number.isFinite(price)
      ) {
        return total + quantity * price;
      }

      return total;
    }, 0);
  }

  if (isObject(items)) {
    return Object.values(items).reduce(
      (total, item) => {
        const quantity = Number(
          item?.quantity ?? item?.qty ?? 1
        );

        const price = Number(
          String(
            item?.price ??
              item?.unitPrice ??
              item?.sellingPrice ??
              0
          )
            .replace(/,/g, "")
            .replace(/[₹$]/g, "")
        );

        if (
          Number.isFinite(quantity) &&
          Number.isFinite(price)
        ) {
          return total + quantity * price;
        }

        return total;
      },
      0
    );
  }

  return 0;
}

/*
|--------------------------------------------------------------------------
| ORDER INFORMATION HELPERS
|--------------------------------------------------------------------------
*/

function getOrderId(order) {
  return (
    order?.orderId ||
    order?.id ||
    order?.orderID ||
    "Order"
  );
}

function getFarmerName(order) {
  return (
    order?.farmerName ||
    order?.customerName ||
    order?.customer ||
    order?.buyerName ||
    order?.userName ||
    order?.farmer?.name ||
    "Farmer"
  );
}

function getFarmerEmail(order) {
  return (
    order?.farmerEmail ||
    order?.customerEmail ||
    order?.buyerEmail ||
    order?.email ||
    order?.farmer?.email ||
    ""
  );
}

function getFarmerPhone(order) {
  return (
    order?.farmerPhone ||
    order?.customerPhone ||
    order?.buyerPhone ||
    order?.phone ||
    order?.mobile ||
    order?.farmer?.phone ||
    ""
  );
}

function getDealerName(order) {
  return (
    order?.dealerName ||
    order?.sellerName ||
    order?.shopName ||
    order?.dealer?.shopName ||
    order?.dealer?.name ||
    "Dealer"
  );
}

function getDealerOwner(order) {
  return (
    order?.dealerOwnerName ||
    order?.ownerName ||
    order?.dealer?.ownerName ||
    ""
  );
}

function getDealerPhone(order) {
  return (
    order?.dealerPhone ||
    order?.sellerPhone ||
    order?.dealer?.phone ||
    ""
  );
}

function getDealerEmail(order) {
  return (
    order?.dealerEmail ||
    order?.sellerEmail ||
    order?.dealer?.email ||
    ""
  );
}

function getFarmerAddress(order) {
  return (
    order?.farmerAddress ||
    order?.customerAddress ||
    order?.billingAddress ||
    order?.buyerAddress ||
    order?.fromAddress ||
    order?.pickupAddress ||
    order?.farmer?.address ||
    ""
  );
}

function getDealerAddress(order) {
  return (
    order?.dealerAddress ||
    order?.sellerAddress ||
    order?.shopAddress ||
    order?.fromDealerAddress ||
    order?.dealer?.address ||
    ""
  );
}

function getDeliveryAddress(order) {
  return (
    order?.deliveryAddress ||
    order?.shippingAddress ||
    order?.destinationAddress ||
    order?.toAddress ||
    order?.address ||
    ""
  );
}

function getPaymentMethod(order) {
  return (
    order?.paymentMethod ||
    order?.paymentType ||
    order?.paymentMode ||
    "Not specified"
  );
}

function getPaymentStatus(order) {
  return (
    order?.paymentStatus ||
    "Not specified"
  );
}

function getOrderDate(order) {
  return (
    order?.createdAt ||
    order?.orderDate ||
    order?.createdDate ||
    order?.date ||
    order?.timestamp ||
    0
  );
}

function getUpdatedDate(order) {
  return (
    order?.updatedAt ||
    order?.lastUpdated ||
    order?.modifiedAt ||
    ""
  );
}

function getItems(order) {
  const items =
    order?.items ||
    order?.cartItems ||
    order?.products ||
    order?.orderItems;

  if (Array.isArray(items)) {
    return items;
  }

  if (isObject(items)) {
    return Object.entries(items).map(
      ([id, item]) => ({
        id,
        ...(isObject(item) ? item : {}),
      })
    );
  }

  /*
   * Support single-product orders.
   */
  if (
    order?.productName ||
    order?.productId ||
    order?.product
  ) {
    return [
      {
        productName:
          order?.productName ||
          order?.product?.name ||
          order?.product?.productName ||
          "Product",
        quantity:
          order?.quantity ||
          order?.qty ||
          1,
        price:
          order?.price ||
          order?.unitPrice ||
          order?.sellingPrice ||
          0,
      },
    ];
  }

  return [];
}

function getItemName(item) {
  return (
    item?.productName ||
    item?.name ||
    item?.title ||
    item?.product?.name ||
    item?.product?.productName ||
    "Product"
  );
}

function getItemQuantity(item) {
  const quantity = Number(
    item?.quantity ??
      item?.qty ??
      item?.count ??
      1
  );

  return Number.isFinite(quantity)
    ? quantity
    : 1;
}

function getItemPrice(item) {
  const price = Number(
    String(
      item?.price ??
        item?.unitPrice ??
        item?.sellingPrice ??
        0
    )
      .replace(/,/g, "")
      .replace(/[₹$]/g, "")
  );

  return Number.isFinite(price)
    ? price
    : 0;
}

/*
|--------------------------------------------------------------------------
| DATA READING
|--------------------------------------------------------------------------
*/

async function readFirstExisting(paths) {
  for (const path of paths) {
    try {
      const snapshot = await get(
        ref(database, path)
      );

      if (snapshot.exists()) {
        return snapshot.val();
      }
    } catch (error) {
      console.warn(
        `Unable to read ${path}:`,
        error
      );
    }
  }

  return null;
}

function flattenOrders(ordersData) {
  if (!isObject(ordersData)) {
    return [];
  }

  const directOrders =
    getArrayFromFirebase(ordersData);

  /*
   * Detect nested structures such as:
   *
   * dealerOrders/
   *   dealerUid/
   *     orderId/
   *
   * or:
   *
   * orders/
   *   farmerUid/
   *     orderId/
   */
  const looksNested =
    directOrders.length > 0 &&
    directOrders.every(
      (item) =>
        isObject(item) &&
        !item.status &&
        !item.orderStatus &&
        Object.values(item).some(
          (value) => isObject(value)
        )
    );

  if (!looksNested) {
    return directOrders;
  }

  const flattened = [];

  Object.entries(ordersData).forEach(
    ([groupId, group]) => {
      if (!isObject(group)) {
        return;
      }

      Object.entries(group).forEach(
        ([orderId, order]) => {
          if (!isObject(order)) {
            return;
          }

          flattened.push({
            id: orderId,
            groupId,
            ...order,
          });
        }
      );
    }
  );

  return flattened;
}

/*
|--------------------------------------------------------------------------
| MAIN COMPONENT
|--------------------------------------------------------------------------
*/

export default function ReportsStatisticsPage() {
  const navigate = useNavigate();

  const [report, setReport] =
    useState(EMPTY_REPORT);

  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [dealerRequests, setDealerRequests] =
    useState([]);
  const [schemes, setSchemes] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);

  const [message, setMessage] =
    useState(null);

  /*
   * Orders modal.
   */
  const [ordersModalOpen, setOrdersModalOpen] =
    useState(false);

  const [selectedOrder, setSelectedOrder] =
    useState(null);

  const [orderSearch, setOrderSearch] =
    useState("");

  const [orderFilter, setOrderFilter] =
    useState("all");

  const [orderSort, setOrderSort] =
    useState("newest");

  useEffect(() => {
    loadReports();
  }, []);

  function showMessage(type, text) {
    setMessage({
      type,
      text,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | LOAD REPORTS
  |--------------------------------------------------------------------------
  */

  async function loadReports() {
    try {
      setLoading(true);

      /*
       * USERS
       */
      const usersSnapshot = await get(
        ref(database, "users")
      );

      const loadedUsers =
        usersSnapshot.exists()
          ? getArrayFromFirebase(
              usersSnapshot.val()
            )
          : [];

      /*
       * DEALER REQUESTS
       */
      const dealerRequestsSnapshot =
        await get(
          ref(database, "dealerRequests")
        );

      const loadedDealerRequests =
        dealerRequestsSnapshot.exists()
          ? getArrayFromFirebase(
              dealerRequestsSnapshot.val()
            )
          : [];

      /*
       * PRODUCTS
       *
       * dealerProducts/{dealerUid}/{productId}
       */
      const productsSnapshot = await get(
        ref(database, "dealerProducts")
      );

      const loadedProducts = [];

      if (productsSnapshot.exists()) {
        const dealerGroups =
          productsSnapshot.val();

        Object.entries(
          dealerGroups
        ).forEach(
          ([dealerUid, dealerProducts]) => {
            if (!isObject(dealerProducts)) {
              return;
            }

            Object.entries(
              dealerProducts
            ).forEach(
              ([productId, product]) => {
                if (!isObject(product)) {
                  return;
                }

                loadedProducts.push({
                  id: productId,
                  dealerUid,
                  ...product,
                });
              }
            );
          }
        );
      }

      /*
       * ORDERS
       *
       * Primary: dealerOrders
       * Fallback: orders
       */
      const ordersData =
        await readFirstExisting([
          "dealerOrders",
          "orders",
        ]);

      const loadedOrders =
        flattenOrders(ordersData);

      /*
       * GOVERNMENT SCHEMES
       */
      const schemesData =
        await readFirstExisting([
          "governmentSchemes",
          "schemes",
        ]);

      const loadedSchemes =
        schemesData
          ? getArrayFromFirebase(
              schemesData
            )
          : [];

      /*
       * USER COUNTS
       */
      let farmers = 0;
      let dealers = 0;
      let admins = 0;

      loadedUsers.forEach((user) => {
        const role = normalize(
          user.role
        );

        const status = normalize(
          user.status
        );

        const active =
          !status ||
          status === "approved" ||
          status === "active";

        if (role === "farmer") {
          farmers++;
        }

        if (
          role === "dealer" &&
          active
        ) {
          dealers++;
        }

        if (
          role === "admin" &&
          active
        ) {
          admins++;
        }
      });

      /*
       * PRODUCT STATISTICS
       */
      let availableProducts = 0;
      let outOfStockProducts = 0;
      let lowStockProducts = 0;
      let totalStock = 0;
      let reservedStock = 0;
      let soldStock = 0;

      loadedProducts.forEach(
        (product) => {
          const quantity =
            getProductQuantity(
              product
            );

          const reserved =
            getReservedQuantity(
              product
            );

          const sold =
            getSoldQuantity(
              product
            );

          const lowStockLevel =
            Number(
              product.lowStockLevel ?? 5
            );

          totalStock += quantity;
          reservedStock += reserved;
          soldStock += sold;

          if (quantity > 0) {
            availableProducts++;
          } else {
            outOfStockProducts++;
          }

          if (
            quantity <=
            lowStockLevel
          ) {
            lowStockProducts++;
          }
        }
      );

      /*
       * SAVE
       */
      setUsers(loadedUsers);
      setProducts(loadedProducts);
      setOrders(loadedOrders);
      setDealerRequests(
        loadedDealerRequests
      );
      setSchemes(loadedSchemes);

      setReport({
        farmers,
        dealers,
        admins,
        totalUsers:
          loadedUsers.length,
        dealerRequests:
          loadedDealerRequests.length,
        products:
          loadedProducts.length,
        orders:
          loadedOrders.length,
        schemes:
          loadedSchemes.length,
        availableProducts,
        outOfStockProducts,
        lowStockProducts,
        totalStock,
        reservedStock,
        soldStock,
      });

      setMessage(null);
    } catch (error) {
      console.error(
        "Reports statistics error:",
        error
      );

      showMessage(
        "error",
        "Unable to load reports. Check Firebase database access and rules."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadReports();
  }

  async function handleLogout() {
    try {
      await signOut(auth);
      sessionStorage.removeItem("role");
      navigate("/role-selection", { replace: true });
    } catch (error) {
      console.error("Admin logout error:", error);
      showMessage("error", "Unable to log out right now. Please try again.");
    }
  }

  /*
  |--------------------------------------------------------------------------
  | USER STATISTICS
  |--------------------------------------------------------------------------
  */

  const userRoleData = useMemo(
    () => [
      {
        label: "Farmers",
        value: report.farmers,
        icon: Users,
        className:
          "bg-emerald-50 border-emerald-100 text-emerald-800",
      },
      {
        label: "Dealers",
        value: report.dealers,
        icon: Store,
        className:
          "bg-orange-50 border-orange-100 text-orange-800",
      },
      {
        label: "Admins",
        value: report.admins,
        icon: Warehouse,
        className:
          "bg-indigo-50 border-indigo-100 text-indigo-800",
      },
    ],
    [report]
  );

  const largestUserRole =
    Math.max(
      report.farmers,
      report.dealers,
      report.admins,
      1
    );

  /*
  |--------------------------------------------------------------------------
  | PRODUCT CATEGORY STATISTICS
  |--------------------------------------------------------------------------
  */

  const categoryData = useMemo(() => {
    const counts = {};

    products.forEach((product) => {
      const category =
        getProductCategory(product);

      counts[category] =
        (counts[category] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([label, value]) => ({
        label,
        value,
      }))
      .sort(
        (a, b) =>
          b.value - a.value
      );
  }, [products]);

  const largestCategory =
    Math.max(
      ...categoryData.map(
        (item) => item.value
      ),
      1
    );

  /*
  |--------------------------------------------------------------------------
  | ORDER STATUS STATISTICS
  |--------------------------------------------------------------------------
  */

  const orderStatusData = useMemo(() => {
    const counts = {};

    orders.forEach((order) => {
      const status =
        getOrderStatus(order);

      counts[status] =
        (counts[status] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([label, value]) => ({
        label,
        value,
      }))
      .sort(
        (a, b) =>
          b.value - a.value
      );
  }, [orders]);

  /*
  |--------------------------------------------------------------------------
  | ORDER SUMMARY
  |--------------------------------------------------------------------------
  */

  const completedOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          isCompletedOrder(order)
      ),
    [orders]
  );

  const pendingOrders = useMemo(
    () =>
      orders.filter((order) => {
        const status =
          getOrderStatus(order);

        return [
          "pending",
          "processing",
          "confirmed",
          "accepted",
          "shipped",
          "out_for_delivery",
        ].includes(status);
      }),
    [orders]
  );

  const cancelledOrders = useMemo(
    () =>
      orders.filter((order) => {
        const status =
          getOrderStatus(order);

        return [
          "cancelled",
          "canceled",
          "rejected",
          "failed",
        ].includes(status);
      }),
    [orders]
  );

  const totalOrderValue = useMemo(
    () =>
      orders.reduce(
        (total, order) =>
          total +
          getOrderAmount(order),
        0
      ),
    [orders]
  );

  const completedOrderValue =
    useMemo(
      () =>
        completedOrders.reduce(
          (total, order) =>
            total +
            getOrderAmount(order),
          0
        ),
      [completedOrders]
    );

  /*
  |--------------------------------------------------------------------------
  | RECENT USERS
  |--------------------------------------------------------------------------
  */

  const recentUsers = useMemo(() => {
    return [...users]
      .sort((a, b) => {
        const first =
          getDateValue(
            b.createdAt ||
              b.registeredAt ||
              b.updatedAt
          );

        const second =
          getDateValue(
            a.createdAt ||
              a.registeredAt ||
              a.updatedAt
          );

        return first - second;
      })
      .slice(0, 8);
  }, [users]);

  /*
  |--------------------------------------------------------------------------
  | LOW STOCK
  |--------------------------------------------------------------------------
  */

  const lowStockProducts =
    useMemo(() => {
      return products
        .filter((product) => {
          const quantity =
            getProductQuantity(
              product
            );

          const level =
            Number(
              product.lowStockLevel ?? 5
            );

          return quantity <= level;
        })
        .sort(
          (a, b) =>
            getProductQuantity(a) -
            getProductQuantity(b)
        )
        .slice(0, 8);
    }, [products]);

  /*
  |--------------------------------------------------------------------------
  | FILTERED ORDERS FOR MODAL
  |--------------------------------------------------------------------------
  */

  const filteredOrders =
    useMemo(() => {
      const term =
        orderSearch
          .trim()
          .toLowerCase();

      const filtered =
        orders.filter((order) => {
          const status =
            getOrderStatus(order);

          /*
           * Status filter.
           */
          if (
            orderFilter ===
            "completed"
          ) {
            if (
              !isCompletedOrder(
                order
              )
            ) {
              return false;
            }
          } else if (
            orderFilter ===
            "cancelled"
          ) {
            if (
              ![
                "cancelled",
                "canceled",
                "rejected",
                "failed",
              ].includes(status)
            ) {
              return false;
            }
          } else if (
            orderFilter !== "all" &&
            status !== orderFilter
          ) {
            return false;
          }

          /*
           * Search.
           */
          if (!term) {
            return true;
          }

          const searchable = [
            getOrderId(order),
            getFarmerName(order),
            getFarmerEmail(order),
            getFarmerPhone(order),
            getDealerName(order),
            getDealerOwner(order),
            getDealerPhone(order),
            getDealerEmail(order),
            getFarmerAddress(order),
            getDeliveryAddress(order),
            getDealerAddress(order),
            order.status,
            order.orderStatus,
            order.paymentMethod,
            order.paymentStatus,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return searchable.includes(
            term
          );
        });

      /*
       * Sorting.
       */
      return [...filtered].sort(
        (a, b) => {
          if (
            orderSort === "newest"
          ) {
            return (
              getDateValue(
                getOrderDate(b)
              ) -
              getDateValue(
                getOrderDate(a)
              )
            );
          }

          if (
            orderSort === "oldest"
          ) {
            return (
              getDateValue(
                getOrderDate(a)
              ) -
              getDateValue(
                getOrderDate(b)
              )
            );
          }

          if (
            orderSort === "amount-high"
          ) {
            return (
              getOrderAmount(b) -
              getOrderAmount(a)
            );
          }

          if (
            orderSort === "amount-low"
          ) {
            return (
              getOrderAmount(a) -
              getOrderAmount(b)
            );
          }

          return 0;
        }
      );
    }, [
      orders,
      orderSearch,
      orderFilter,
      orderSort,
    ]);

  /*
  |--------------------------------------------------------------------------
  | OPEN ORDERS
  |--------------------------------------------------------------------------
  */

  function openOrdersModal() {
    setOrdersModalOpen(true);
    setSelectedOrder(null);
    setOrderSearch("");
    setOrderFilter("all");
    setOrderSort("newest");
  }

  function closeOrdersModal() {
    setOrdersModalOpen(false);
    setSelectedOrder(null);
  }

  /*
  |--------------------------------------------------------------------------
  | RENDER
  |--------------------------------------------------------------------------
  */

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">

        <StatusMessage
          message={message}
          onClose={() =>
            setMessage(null)
          }
        />

        {/* =====================================================
            ADMIN HEADER
        ====================================================== */}

        <header className="bg-gradient-to-r from-slate-950 via-indigo-950 to-indigo-800 text-white rounded-3xl shadow-xl p-6 md:p-8 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">

            <div>
              <button
                type="button"
                onClick={() =>
                  navigate("/admin")
                }
                className="inline-flex items-center gap-2 text-indigo-200 hover:text-white text-sm font-semibold mb-4 transition"
              >
                <ArrowLeft size={17} />
                Admin Dashboard
              </button>

              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
                  <BarChart3 size={30} />
                </div>

                <div>
                  <h1 className="text-3xl md:text-4xl font-bold">
                    Reports & Statistics
                  </h1>

                  <p className="text-indigo-200 mt-1">
                    Monitor AgriSathi platform activity,
                    inventory and order performance.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={
                  loading ||
                  refreshing
                }
                className="inline-flex items-center gap-2 bg-white/10 border border-white/20 hover:bg-white/20 px-5 py-3 rounded-xl font-semibold transition disabled:opacity-50"
              >
                <RefreshCw
                  size={18}
                  className={
                    refreshing
                      ? "animate-spin"
                      : ""
                  }
                />

                {refreshing
                  ? "Refreshing..."
                  : "Refresh"}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-2 bg-white text-indigo-900 px-5 py-3 rounded-xl font-semibold hover:bg-indigo-50 transition"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <InfoPill
              icon={Database}
              text="Live Firebase statistics"
            />

            <InfoPill
              icon={ShoppingCart}
              text={`${formatNumber(
                report.orders
              )} total orders`}
            />

            <InfoPill
              icon={CheckCircle2}
              text={`${formatNumber(
                completedOrders.length
              )} completed`}
            />
          </div>
        </header>

        {/* =====================================================
            TOP SUMMARY
        ====================================================== */}

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

          <ReportCard
            title="Total Users"
            value={report.totalUsers}
            icon={Users}
            description="Registered platform accounts"
            tone="indigo"
            loading={loading}
          />

          <ReportCard
            title="Products"
            value={report.products}
            icon={Package}
            description="Dealer product listings"
            tone="cyan"
            loading={loading}
          />

          <ReportCard
            title="Orders"
            value={report.orders}
            icon={ShoppingCart}
            description="All platform orders"
            tone="blue"
            loading={loading}
          />

          <ReportCard
            title="Schemes"
            value={report.schemes}
            icon={Warehouse}
            description="Government schemes"
            tone="amber"
            loading={loading}
          />

        </section>

        {/* =====================================================
            USER STATISTICS
        ====================================================== */}

        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 md:p-6 mb-6">

          <SectionHeader
            icon={Users}
            title="User Statistics"
            description="Distribution of registered platform users."
          />

          <div className="grid md:grid-cols-3 gap-4">

            {userRoleData.map(
              (item) => {
                const Icon =
                  item.icon;

                return (
                  <div
                    key={
                      item.label
                    }
                    className={`${item.className} border rounded-2xl p-5`}
                  >
                    <div className="flex items-center justify-between">

                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/70 flex items-center justify-center">
                          <Icon size={20} />
                        </div>

                        <span className="font-semibold">
                          {item.label}
                        </span>
                      </div>

                      <span className="text-2xl font-bold">
                        {loading
                          ? "..."
                          : formatNumber(
                              item.value
                            )}
                      </span>
                    </div>

                    <div className="h-2.5 bg-white/70 rounded-full mt-5 overflow-hidden">
                      <div
                        className="h-full bg-current rounded-full opacity-70 transition-all"
                        style={{
                          width: `${
                            (item.value /
                              largestUserRole) *
                            100
                          }%`,
                        }}
                      />
                    </div>

                  </div>
                );
              }
            )}

          </div>
        </section>

        {/* =====================================================
            DEALER REQUESTS + STOCK
        ====================================================== */}

        <section className="grid lg:grid-cols-2 gap-6 mb-6">

          <div className="bg-white rounded-2xl shadow-sm border border-orange-100 p-5 md:p-6">

            <SectionHeader
              icon={Store}
              title="Dealer Requests"
              description="Current dealer registration requests."
            />

            <div className="mt-5 bg-orange-50 border border-orange-100 rounded-2xl p-5">

              <div className="flex items-center justify-between">

                <div>
                  <p className="text-sm font-medium text-orange-700">
                    Pending Requests
                  </p>

                  <p className="text-4xl font-bold text-orange-900 mt-1">
                    {loading
                      ? "..."
                      : formatNumber(
                          report.dealerRequests
                        )}
                  </p>
                </div>

                <div className="w-12 h-12 rounded-xl bg-white/70 flex items-center justify-center">
                  <Clock3
                    size={23}
                    className="text-orange-700"
                  />
                </div>

              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                navigate(
                  "/admin/dealer-requests"
                )
              }
              className="w-full mt-4 inline-flex items-center justify-center gap-2 bg-orange-600 text-white py-3 rounded-xl font-semibold hover:bg-orange-700 transition"
            >
              Manage Dealer Requests
              <ChevronRight size={17} />
            </button>

          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-cyan-100 p-5 md:p-6">

            <SectionHeader
              icon={Package}
              title="Product Stock"
              description="Current inventory overview."
            />

            <div className="grid grid-cols-3 gap-3 mt-5">

              <MiniStat
                label="Available"
                value={
                  report.availableProducts
                }
                icon={PackageCheck}
                className="bg-emerald-50 text-emerald-800"
                loading={loading}
              />

              <MiniStat
                label="Low Stock"
                value={
                  report.lowStockProducts
                }
                icon={CircleAlert}
                className="bg-amber-50 text-amber-800"
                loading={loading}
              />

              <MiniStat
                label="Out"
                value={
                  report.outOfStockProducts
                }
                icon={PackageOpen}
                className="bg-red-50 text-red-800"
                loading={loading}
              />

            </div>

            <div className="grid grid-cols-3 gap-3 mt-3">

              <MiniStat
                label="Total Stock"
                value={
                  report.totalStock
                }
                icon={Database}
                className="bg-blue-50 text-blue-800"
                loading={loading}
              />

              <MiniStat
                label="Reserved"
                value={
                  report.reservedStock
                }
                icon={Warehouse}
                className="bg-purple-50 text-purple-800"
                loading={loading}
              />

              <MiniStat
                label="Sold"
                value={
                  report.soldStock
                }
                icon={ShoppingCart}
                className="bg-orange-50 text-orange-800"
                loading={loading}
              />

            </div>

          </div>

        </section>

        {/* =====================================================
            PRODUCT CATEGORIES
        ====================================================== */}

        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 md:p-6 mb-6">

          <SectionHeader
            icon={Package}
            title="Product Categories"
            description="Distribution of dealer products by category."
          />

          {categoryData.length ===
          0 ? (
            <EmptyState
              icon={Package}
              text="No product category data available."
            />
          ) : (
            <div className="space-y-4 mt-5">

              {categoryData.map(
                (item) => (
                  <div
                    key={
                      item.label
                    }
                  >

                    <div className="flex items-center justify-between text-sm mb-2">

                      <span className="font-semibold text-slate-700">
                        {item.label}
                      </span>

                      <span className="font-bold text-indigo-700">
                        {formatNumber(
                          item.value
                        )}
                      </span>

                    </div>

                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">

                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all"
                        style={{
                          width: `${
                            (item.value /
                              largestCategory) *
                            100
                          }%`,
                        }}
                      />

                    </div>

                  </div>
                )
              )}

            </div>
          )}

        </section>

        {/* =====================================================
            ORDER STATISTICS
        ====================================================== */}

        <section className="bg-white rounded-2xl shadow-sm border border-indigo-100 p-5 md:p-6 mb-6">

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

            <SectionHeader
              icon={ShoppingCart}
              title="Order Statistics"
              description="Monitor order activity and completion performance."
            />

            <button
              type="button"
              onClick={
                openOrdersModal
              }
              className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition shadow-sm"
            >
              <Eye size={18} />
              Open Orders
            </button>

          </div>

          {/* ORDER SUMMARY */}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">

            <OrderSummaryCard
              title="All Orders"
              value={orders.length}
              icon={ShoppingCart}
              className="bg-indigo-50 border-indigo-100 text-indigo-800"
            />

            <OrderSummaryCard
              title="Completed"
              value={
                completedOrders.length
              }
              icon={CheckCircle2}
              className="bg-emerald-50 border-emerald-100 text-emerald-800"
            />

            <OrderSummaryCard
              title="In Progress"
              value={
                pendingOrders.length
              }
              icon={Truck}
              className="bg-blue-50 border-blue-100 text-blue-800"
            />

            <OrderSummaryCard
              title="Cancelled"
              value={
                cancelledOrders.length
              }
              icon={X}
              className="bg-red-50 border-red-100 text-red-800"
            />

          </div>

          {/* ORDER VALUE */}

          <div className="grid md:grid-cols-2 gap-4 mt-4">

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">

              <div className="flex items-center gap-3">

                <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center">
                  <CircleDollarSign
                    size={22}
                    className="text-indigo-700"
                  />
                </div>

                <div>
                  <p className="text-sm text-slate-500">
                    Total Order Value
                  </p>

                  <p className="text-2xl font-bold text-slate-950 mt-1">
                    {formatCurrency(
                      totalOrderValue
                    )}
                  </p>
                </div>

              </div>

            </div>

            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5">

              <div className="flex items-center gap-3">

                <div className="w-11 h-11 rounded-xl bg-white/70 flex items-center justify-center">
                  <CheckCircle2
                    size={22}
                    className="text-emerald-700"
                  />
                </div>

                <div>
                  <p className="text-sm text-emerald-700">
                    Completed Order Value
                  </p>

                  <p className="text-2xl font-bold text-emerald-900 mt-1">
                    {formatCurrency(
                      completedOrderValue
                    )}
                  </p>
                </div>

              </div>

            </div>

          </div>

          {/* STATUS DISTRIBUTION */}

          {orderStatusData.length ===
          0 ? (
            <EmptyState
              icon={ShoppingCart}
              text="No order data available."
            />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">

              {orderStatusData.map(
                (item) => (
                  <button
                    type="button"
                    key={
                      item.label
                    }
                    onClick={() => {
                      setOrderFilter(
                        item.label
                      );
                      setOrdersModalOpen(
                        true
                      );
                    }}
                    className="text-left bg-slate-50 border border-slate-200 rounded-2xl p-5 hover:border-indigo-300 hover:shadow-md transition"
                  >

                    <p className="text-sm text-slate-500 capitalize">
                      {item.label.replace(
                        /_/g,
                        " "
                      )}
                    </p>

                    <p className="text-3xl font-bold text-slate-950 mt-1">
                      {formatNumber(
                        item.value
                      )}
                    </p>

                    <div className="flex items-center gap-1 text-xs font-semibold text-indigo-700 mt-3">
                      View orders
                      <ChevronRight
                        size={14}
                      />
                    </div>

                  </button>
                )
              )}

            </div>
          )}

        </section>

        {/* =====================================================
            LOW STOCK
        ====================================================== */}

        <section className="bg-white rounded-2xl shadow-sm border border-red-100 p-5 md:p-6 mb-6">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

            <SectionHeader
              icon={CircleAlert}
              title="Low Stock Alerts"
              description="Products that reached their configured low-stock level."
            />

            <button
              type="button"
              onClick={() =>
                navigate(
                  "/admin/products"
                )
              }
              className="inline-flex items-center justify-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-red-700 transition"
            >
              View Products
              <ChevronRight size={17} />
            </button>

          </div>

          {lowStockProducts.length ===
          0 ? (
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 mt-5 text-emerald-800">
              No low-stock products currently detected.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4 mt-5">

              {lowStockProducts.map(
                (product) => (
                  <div
                    key={`${product.dealerUid}-${product.id}`}
                    className="border border-red-100 rounded-2xl p-4"
                  >

                    <div className="flex justify-between gap-4">

                      <div>
                        <h3 className="font-bold text-slate-900">
                          {product.productName ||
                            product.name ||
                            "Unnamed product"}
                        </h3>

                        <p className="text-sm text-slate-500 mt-1">
                          {product.category ||
                            "Other"}
                        </p>
                      </div>

                      <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold h-fit">
                        Low stock
                      </span>

                    </div>

                    <div className="flex items-center justify-between mt-4">

                      <span className="text-sm text-slate-500">
                        Available
                      </span>

                      <span className="font-bold text-red-700">
                        {getProductQuantity(
                          product
                        )}{" "}
                        {product.unit ||
                          ""}
                      </span>

                    </div>

                  </div>
                )
              )}

            </div>
          )}

        </section>

        {/* =====================================================
            RECENT USERS
        ====================================================== */}

        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 md:p-6 mb-6">

          <SectionHeader
            icon={UserRound}
            title="Recent Registrations"
            description="Recently registered platform accounts."
          />

          {recentUsers.length ===
          0 ? (
            <EmptyState
              icon={Users}
              text="No registered users available."
            />
          ) : (
            <div className="overflow-x-auto mt-5">

              <table className="w-full text-left">

                <thead>
                  <tr className="border-b border-slate-200">

                    <th className="py-3 px-3 text-xs uppercase tracking-wide text-slate-500">
                      Name
                    </th>

                    <th className="py-3 px-3 text-xs uppercase tracking-wide text-slate-500">
                      Role
                    </th>

                    <th className="py-3 px-3 text-xs uppercase tracking-wide text-slate-500">
                      Email
                    </th>

                    <th className="py-3 px-3 text-xs uppercase tracking-wide text-slate-500">
                      Registered
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {recentUsers.map(
                    (user) => (
                      <tr
                        key={
                          user.id
                        }
                        className="border-b border-slate-100 hover:bg-slate-50"
                      >

                        <td className="py-3 px-3 font-semibold text-slate-800">
                          {user.name ||
                            user.fullName ||
                            user.dealerName ||
                            "Unknown"}
                        </td>

                        <td className="py-3 px-3">

                          <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-semibold capitalize">
                            {user.role ||
                              "Unknown"}
                          </span>

                        </td>

                        <td className="py-3 px-3 text-sm text-slate-600">
                          {user.email ||
                            "—"}
                        </td>

                        <td className="py-3 px-3 text-sm text-slate-600">
                          {formatDate(
                            user.createdAt ||
                              user.registeredAt
                          )}
                        </td>

                      </tr>
                    )
                  )}

                </tbody>

              </table>

            </div>
          )}

        </section>

        {/* =====================================================
            GOVERNMENT SCHEMES
        ====================================================== */}

        <section className="bg-white rounded-2xl shadow-sm border border-amber-100 p-5 md:p-6 mb-6">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

            <SectionHeader
              icon={Warehouse}
              title="Government Schemes"
              description="Government schemes currently available in AgriSathi."
            />

            <button
              type="button"
              onClick={() =>
                navigate(
                  "/admin/schemes"
                )
              }
              className="inline-flex items-center justify-center gap-2 bg-amber-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-amber-700 transition"
            >
              Manage Schemes
              <ChevronRight size={17} />
            </button>

          </div>

          <div className="mt-5 bg-amber-50 border border-amber-100 rounded-2xl p-5">

            <p className="text-sm text-amber-700">
              Total schemes
            </p>

            <p className="text-4xl font-bold text-amber-900 mt-1">
              {loading
                ? "..."
                : formatNumber(
                    report.schemes
                  )}
            </p>

          </div>

        </section>

        {/* =====================================================
            QUICK ACTIONS
        ====================================================== */}

        <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-8">

          <QuickAction
            icon={Users}
            title="Farmers"
            description="View registered farmers"
            path="/admin/farmers"
            navigate={navigate}
          />

          <QuickAction
            icon={Store}
            title="Dealers"
            description="Manage approved dealers"
            path="/admin/dealers"
            navigate={navigate}
          />

          <QuickAction
            icon={Package}
            title="Products"
            description="View dealer products"
            path="/admin/products"
            navigate={navigate}
          />

          <QuickAction
            icon={ShoppingCart}
            title="Orders"
            description="Open complete order history"
            onClick={
              openOrdersModal
            }
          />

        </section>

      </div>

      {/* =====================================================
          ALL ORDERS MODAL
      ====================================================== */}

      {ordersModalOpen && (
        <OrdersModal
          orders={filteredOrders}
          totalOrders={
            orders.length
          }
          completedCount={
            completedOrders.length
          }
          search={orderSearch}
          setSearch={
            setOrderSearch
          }
          filter={orderFilter}
          setFilter={
            setOrderFilter
          }
          sort={orderSort}
          setSort={setOrderSort}
          selectedOrder={
            selectedOrder
          }
          setSelectedOrder={
            setSelectedOrder
          }
          onClose={
            closeOrdersModal
          }
        />
      )}

    </div>
  );
}

/*
|--------------------------------------------------------------------------
| INFO PILL
|--------------------------------------------------------------------------
*/

function InfoPill({
  icon: Icon,
  text,
}) {
  return (
    <span className="inline-flex items-center gap-2 bg-white/10 border border-white/10 rounded-full px-3 py-1.5 text-sm text-indigo-100">
      <Icon size={15} />
      {text}
    </span>
  );
}

/*
|--------------------------------------------------------------------------
| REPORT CARD
|--------------------------------------------------------------------------
*/

function ReportCard({
  title,
  value,
  icon: Icon,
  description,
  tone,
  loading,
}) {
  const tones = {
    indigo:
      "bg-indigo-50 border-indigo-100 text-indigo-800",
    cyan:
      "bg-cyan-50 border-cyan-100 text-cyan-800",
    blue:
      "bg-blue-50 border-blue-100 text-blue-800",
    amber:
      "bg-amber-50 border-amber-100 text-amber-800",
  };

  return (
    <div
      className={`${
        tones[tone] ||
        tones.indigo
      } border rounded-2xl shadow-sm p-5`}
    >

      <div className="flex items-start justify-between gap-3">

        <div>
          <p className="text-sm font-semibold opacity-80">
            {title}
          </p>

          <p className="text-4xl font-bold mt-2">
            {loading
              ? "..."
              : formatNumber(
                  value
                )}
          </p>

          <p className="text-xs opacity-70 mt-1">
            {description}
          </p>
        </div>

        <div className="w-11 h-11 rounded-xl bg-white/70 flex items-center justify-center">
          <Icon size={21} />
        </div>

      </div>

    </div>
  );
}

/*
|--------------------------------------------------------------------------
| SECTION HEADER
|--------------------------------------------------------------------------
*/

function SectionHeader({
  icon: Icon,
  title,
  description,
}) {
  return (
    <div className="flex items-start gap-3">

      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
        <Icon size={20} />
      </div>

      <div>
        <h2 className="text-xl md:text-2xl font-bold text-slate-950">
          {title}
        </h2>

        <p className="text-sm text-slate-500 mt-1">
          {description}
        </p>
      </div>

    </div>
  );
}

/*
|--------------------------------------------------------------------------
| MINI STAT
|--------------------------------------------------------------------------
*/

function MiniStat({
  label,
  value,
  icon: Icon,
  className,
  loading,
}) {
  return (
    <div
      className={`${className} rounded-xl p-3 text-center border border-current/10`}
    >

      <div className="flex justify-center">
        <Icon size={17} />
      </div>

      <p className="text-xs opacity-70 mt-1">
        {label}
      </p>

      <p className="text-xl font-bold mt-1">
        {loading
          ? "..."
          : formatNumber(
              value
            )}
      </p>

    </div>
  );
}

/*
|--------------------------------------------------------------------------
| ORDER SUMMARY CARD
|--------------------------------------------------------------------------
*/

function OrderSummaryCard({
  title,
  value,
  icon: Icon,
  className,
}) {
  return (
    <div
      className={`${className} border rounded-2xl p-4`}
    >

      <div className="flex items-center justify-between">

        <div>
          <p className="text-sm opacity-75">
            {title}
          </p>

          <p className="text-2xl font-bold mt-1">
            {formatNumber(
              value
            )}
          </p>
        </div>

        <Icon size={21} />

      </div>

    </div>
  );
}

/*
|--------------------------------------------------------------------------
| EMPTY STATE
|--------------------------------------------------------------------------
*/

function EmptyState({
  icon: Icon,
  text,
}) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center mt-5">

      <div className="w-14 h-14 mx-auto rounded-2xl bg-white border border-slate-200 flex items-center justify-center">
        <Icon
          size={27}
          className="text-slate-400"
        />
      </div>

      <p className="text-slate-500 mt-3">
        {text}
      </p>

    </div>
  );
}

/*
|--------------------------------------------------------------------------
| QUICK ACTION
|--------------------------------------------------------------------------
*/

function QuickAction({
  icon: Icon,
  title,
  description,
  path,
  navigate,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (onClick) {
          onClick();
          return;
        }

        if (path) {
          navigate(path);
        }
      }}
      className="bg-white border border-slate-200 rounded-2xl p-5 text-left shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-indigo-200 transition-all"
    >

      <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
        <Icon size={21} />
      </div>

      <p className="font-bold text-slate-900 mt-4">
        {title}
      </p>

      <p className="text-sm text-slate-500 mt-1">
        {description}
      </p>

      <div className="flex items-center gap-1 text-sm font-semibold text-indigo-700 mt-4">
        Open
        <ChevronRight
          size={16}
        />
      </div>

    </button>
  );
}

/*
|--------------------------------------------------------------------------
| ORDERS MODAL
|--------------------------------------------------------------------------
*/

function OrdersModal({
  orders,
  totalOrders,
  completedCount,
  search,
  setSearch,
  filter,
  setFilter,
  sort,
  setSort,
  selectedOrder,
  setSelectedOrder,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 md:p-6">

      <div className="w-full max-w-7xl max-h-[94vh] overflow-hidden bg-slate-50 rounded-3xl shadow-2xl">

        {/* HEADER */}

        <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-indigo-800 text-white px-5 md:px-7 py-5">

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

            <div>

              <p className="text-xs uppercase tracking-wider text-indigo-300 font-semibold">
                Order Management
              </p>

              <h2 className="text-2xl md:text-3xl font-bold mt-1">
                All Orders
              </h2>

              <p className="text-indigo-200 text-sm mt-1">
                View complete order information from
                customer/farmer to dealer and delivery.
              </p>

            </div>

            <div className="flex items-center gap-3">

              <div className="hidden sm:flex items-center gap-2">

                <div className="bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-center">
                  <p className="text-xs text-indigo-200">
                    Total
                  </p>

                  <p className="font-bold">
                    {formatNumber(
                      totalOrders
                    )}
                  </p>
                </div>

                <div className="bg-emerald-500/20 border border-emerald-300/20 rounded-xl px-3 py-2 text-center">
                  <p className="text-xs text-emerald-200">
                    Completed
                  </p>

                  <p className="font-bold">
                    {formatNumber(
                      completedCount
                    )}
                  </p>
                </div>

              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
                aria-label="Close orders"
              >
                <X size={21} />
              </button>

            </div>

          </div>

        </div>

        {/* BODY */}

        <div className="overflow-y-auto max-h-[calc(94vh-120px)] p-4 md:p-6">

          {!selectedOrder ? (
            <>
              {/* FILTER BAR */}

              <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 mb-5">

                <div className="flex flex-col xl:flex-row gap-3">

                  {/* SEARCH */}

                  <div className="relative flex-1">

                    <Search
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      type="search"
                      value={search}
                      onChange={(event) =>
                        setSearch(
                          event.target
                            .value
                        )
                      }
                      placeholder="Search order ID, farmer, dealer, phone, address..."
                      className="w-full border border-slate-300 rounded-xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />

                  </div>

                  {/* STATUS */}

                  <div className="relative">

                    <Filter
                      size={17}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    />

                    <select
                      value={filter}
                      onChange={(event) =>
                        setFilter(
                          event.target
                            .value
                        )
                      }
                      className="appearance-none border border-slate-300 rounded-xl pl-10 pr-10 py-3 bg-white min-w-[190px] outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="all">
                        All Orders
                      </option>

                      <option value="completed">
                        Completed Orders
                      </option>

                      <option value="pending">
                        Pending
                      </option>

                      <option value="processing">
                        Processing
                      </option>

                      <option value="confirmed">
                        Confirmed
                      </option>

                      <option value="accepted">
                        Accepted
                      </option>

                      <option value="shipped">
                        Shipped
                      </option>

                      <option value="delivered">
                        Delivered
                      </option>

                      <option value="cancelled">
                        Cancelled
                      </option>
                    </select>

                    <ChevronDown
                      size={16}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    />

                  </div>

                  {/* SORT */}

                  <div className="relative">

                    <ArrowDownUp
                      size={17}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    />

                    <select
                      value={sort}
                      onChange={(event) =>
                        setSort(
                          event.target
                            .value
                        )
                      }
                      className="appearance-none border border-slate-300 rounded-xl pl-10 pr-10 py-3 bg-white min-w-[190px] outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="newest">
                        Newest First
                      </option>

                      <option value="oldest">
                        Oldest First
                      </option>

                      <option value="amount-high">
                        Amount: High to Low
                      </option>

                      <option value="amount-low">
                        Amount: Low to High
                      </option>
                    </select>

                    <ChevronDown
                      size={16}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    />

                  </div>

                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 mt-3 text-sm">

                  <p className="text-slate-500">
                    Showing{" "}
                    <strong className="text-slate-800">
                      {formatNumber(
                        orders.length
                      )}
                    </strong>{" "}
                    matching orders
                  </p>

                  {(search ||
                    filter !==
                      "all" ||
                    sort !==
                      "newest") && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch(
                          ""
                        );
                        setFilter(
                          "all"
                        );
                        setSort(
                          "newest"
                        );
                      }}
                      className="inline-flex items-center gap-1.5 text-indigo-700 font-semibold hover:text-indigo-900"
                    >
                      <X size={15} />
                      Reset filters
                    </button>
                  )}

                </div>

              </section>

              {/* ORDER LIST */}

             {orders.length === 0 ? (
  <EmptyState
    icon={ShoppingCart}
    text={
      search ||
      filter !== "all"
        ? "No matching orders found."
        : "No orders are currently available."
    }
  />
) : (
                <div className="space-y-3">

                  {orders.map(
                    (
                      order,
                      index
                    ) => (
                      <OrderListCard
                        key={
                          order.id ||
                          `${getOrderId(
                            order
                          )}-${index}`
                        }
                        order={
                          order
                        }
                        onClick={() =>
                          setSelectedOrder(
                            order
                          )
                        }
                      />
                    )
                  )}

                </div>
              )}

            </>
          ) : (
            <OrderDetails
              order={
                selectedOrder
              }
              onBack={() =>
                setSelectedOrder(
                  null
                )
              }
            />
          )}

        </div>

      </div>

    </div>
  );
}

/*
|--------------------------------------------------------------------------
| ORDER LIST CARD
|--------------------------------------------------------------------------
*/

function OrderListCard({
  order,
  onClick,
}) {
  const status =
    getOrderStatus(order);

  const completed =
    isCompletedOrder(order);

  const amount =
    getOrderAmount(order);

  const items =
    getItems(order);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white border border-slate-200 rounded-2xl p-4 md:p-5 hover:border-indigo-300 hover:shadow-md transition"
    >

      <div className="flex flex-col xl:flex-row xl:items-center gap-4">

        {/* ORDER ID */}

        <div className="flex items-start gap-3 flex-1 min-w-0">

          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              completed
                ? "bg-emerald-50 text-emerald-700"
                : "bg-indigo-50 text-indigo-700"
            }`}
          >
            {completed ? (
              <CheckCircle2
                size={21}
              />
            ) : (
              <ShoppingCart
                size={21}
              />
            )}
          </div>

          <div className="min-w-0">

            <div className="flex flex-wrap items-center gap-2">

              <h3 className="font-bold text-slate-950">
                {getOrderId(
                  order
                )}
              </h3>

              <StatusBadge
                status={
                  status
                }
              />

            </div>

            <p className="text-sm text-slate-500 mt-1">
              {formatDate(
                getOrderDate(
                  order
                )
              )}
            </p>

          </div>

        </div>

        {/* FROM */}

        <div className="xl:w-52">

          <p className="text-[11px] uppercase tracking-wide font-bold text-slate-400">
            From
          </p>

          <p className="font-semibold text-slate-800 mt-1 truncate">
            {getFarmerName(
              order
            )}
          </p>

          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {getFarmerAddress(
              order
            ) ||
              getDeliveryAddress(
                order
              ) ||
              "Address unavailable"}
          </p>

        </div>

        {/* TO */}

        <div className="xl:w-52">

          <p className="text-[11px] uppercase tracking-wide font-bold text-slate-400">
            To
          </p>

          <p className="font-semibold text-slate-800 mt-1 truncate">
            {getDealerName(
              order
            )}
          </p>

          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {getDealerAddress(
              order
            ) ||
              getDeliveryAddress(
                order
              ) ||
              "Address unavailable"}
          </p>

        </div>

        {/* ITEMS */}

        <div className="xl:w-32">

          <p className="text-[11px] uppercase tracking-wide font-bold text-slate-400">
            Items
          </p>

          <p className="font-semibold text-slate-800 mt-1">
            {items.length}
          </p>

          <p className="text-xs text-slate-500">
            product item
            {items.length ===
            1
              ? ""
              : "s"}
          </p>

        </div>

        {/* AMOUNT */}

        <div className="xl:w-32 xl:text-right">

          <p className="text-[11px] uppercase tracking-wide font-bold text-slate-400">
            Total
          </p>

          <p className="font-bold text-indigo-800 mt-1">
            {formatCurrency(
              amount
            )}
          </p>

          <div className="flex xl:justify-end items-center gap-1 text-xs text-indigo-600 mt-1">
            View
            <ChevronRight
              size={14}
            />
          </div>

        </div>

      </div>

    </button>
  );
}

/*
|--------------------------------------------------------------------------
| STATUS BADGE
|--------------------------------------------------------------------------
*/

function StatusBadge({
  status,
}) {
  const normalized =
    normalize(status);

  let className =
    "bg-slate-100 text-slate-700 border-slate-200";

  if (
    [
      "completed",
      "complete",
      "delivered",
      "fulfilled",
      "closed",
      "success",
    ].includes(normalized)
  ) {
    className =
      "bg-emerald-50 text-emerald-700 border-emerald-100";
  } else if (
    [
      "cancelled",
      "canceled",
      "rejected",
      "failed",
    ].includes(normalized)
  ) {
    className =
      "bg-red-50 text-red-700 border-red-100";
  } else if (
    [
      "shipped",
      "out_for_delivery",
    ].includes(normalized)
  ) {
    className =
      "bg-blue-50 text-blue-700 border-blue-100";
  } else if (
    [
      "processing",
      "confirmed",
      "accepted",
    ].includes(normalized)
  ) {
    className =
      "bg-indigo-50 text-indigo-700 border-indigo-100";
  } else if (
    normalized ===
    "pending"
  ) {
    className =
      "bg-amber-50 text-amber-700 border-amber-100";
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 border rounded-full px-2.5 py-1 text-xs font-bold ${className}`}
    >
      {[
        "completed",
        "complete",
        "delivered",
        "fulfilled",
        "closed",
        "success",
      ].includes(
        normalized
      ) ? (
        <CheckCircle2 size={12} />
      ) : (
        <Clock3 size={12} />
      )}

      {displayStatus(
        status
      )}
    </span>
  );
}

/*
|--------------------------------------------------------------------------
| ORDER DETAILS
|--------------------------------------------------------------------------
*/

function OrderDetails({
  order,
  onBack,
}) {
  const items =
    getItems(order);

  const amount =
    getOrderAmount(order);

  const status =
    getOrderStatus(order);

  return (
    <div>

      {/* BACK */}

      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-indigo-700 font-semibold hover:text-indigo-900 mb-5"
      >
        <ArrowLeft size={17} />
        Back to all orders
      </button>

      {/* TITLE */}

      <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 mb-5">

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">

          <div>

            <div className="flex flex-wrap items-center gap-2">

              <h2 className="text-2xl md:text-3xl font-bold text-slate-950">
                {getOrderId(
                  order
                )}
              </h2>

              <StatusBadge
                status={
                  status
                }
              />

            </div>

            <p className="text-sm text-slate-500 mt-2">
              Order placed:{" "}
              <strong className="text-slate-700">
                {formatDate(
                  getOrderDate(
                    order
                  )
                )}
              </strong>
            </p>

            {getUpdatedDate(
              order
            ) && (
              <p className="text-sm text-slate-500 mt-1">
                Last updated:{" "}
                <strong className="text-slate-700">
                  {formatDate(
                    getUpdatedDate(
                      order
                    )
                  )}
                </strong>
              </p>
            )}

          </div>

          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4">

            <p className="text-xs uppercase tracking-wide font-bold text-indigo-500">
              Order Total
            </p>

            <p className="text-2xl font-bold text-indigo-900 mt-1">
              {formatCurrency(
                amount
              )}
            </p>

          </div>

        </div>

      </div>

      {/* FROM → TO */}

      <section className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 mb-5">

        <div className="flex items-center gap-2 mb-5">

          <Truck
            size={20}
            className="text-indigo-700"
          />

          <h3 className="text-xl font-bold text-slate-950">
            Order Route
          </h3>

        </div>

        <div className="grid lg:grid-cols-[1fr_auto_1fr] gap-4 items-stretch">

          {/* FROM */}

          <AddressCard
            title="From — Farmer"
            icon={UserRound}
            name={
              getFarmerName(
                order
              )
            }
            phone={
              getFarmerPhone(
                order
              )
            }
            email={
              getFarmerEmail(
                order
              )
            }
            address={
              getFarmerAddress(
                order
              ) ||
              "Farmer address not available"
            }
          />

          {/* ARROW */}

          <div className="hidden lg:flex items-center justify-center">

            <div className="w-11 h-11 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <ChevronRight
                size={22}
              />
            </div>

          </div>

          {/* TO */}

          <AddressCard
            title="To — Dealer"
            icon={Store}
            name={
              getDealerName(
                order
              )
            }
            phone={
              getDealerPhone(
                order
              )
            }
            email={
              getDealerEmail(
                order
              )
            }
            address={
              getDealerAddress(
                order
              ) ||
              getDeliveryAddress(
                order
              ) ||
              "Dealer/delivery address not available"
            }
          />

        </div>

        {/* DELIVERY ADDRESS */}

        {getDeliveryAddress(
          order
        ) && (
          <div className="mt-4 bg-blue-50 border border-blue-100 rounded-2xl p-4">

            <div className="flex items-start gap-3">

              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0">
                <MapPin
                  size={19}
                  className="text-blue-700"
                />
              </div>

              <div>

                <p className="text-xs uppercase tracking-wide font-bold text-blue-600">
                  Delivery Address
                </p>

                <p className="text-sm text-blue-950 font-semibold mt-1">
                  {getDeliveryAddress(
                    order
                  )}
                </p>

              </div>

            </div>

          </div>
        )}

      </section>

      {/* FARMER + DEALER DETAILS */}

      <section className="grid lg:grid-cols-2 gap-5 mb-5">

        <InfoPanel
          title="Farmer Information"
          icon={UserRound}
          rows={[
            [
              "Name",
              getFarmerName(
                order
              ),
            ],
            [
              "Phone",
              getFarmerPhone(
                order
              ),
            ],
            [
              "Email",
              getFarmerEmail(
                order
              ),
            ],
            [
              "Address",
              getFarmerAddress(
                order
              ),
            ],
          ]}
        />

        <InfoPanel
          title="Dealer Information"
          icon={Store}
          rows={[
            [
              "Shop",
              getDealerName(
                order
              ),
            ],
            [
              "Owner",
              getDealerOwner(
                order
              ),
            ],
            [
              "Phone",
              getDealerPhone(
                order
              ),
            ],
            [
              "Email",
              getDealerEmail(
                order
              ),
            ],
            [
              "Address",
              getDealerAddress(
                order
              ),
            ],
          ]}
        />

      </section>

      {/* ITEMS */}

      <section className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 mb-5">

        <div className="flex items-center justify-between gap-3 mb-4">

          <div className="flex items-center gap-2">

            <Package
              size={20}
              className="text-indigo-700"
            />

            <h3 className="text-xl font-bold text-slate-950">
              Ordered Products
            </h3>

          </div>

          <span className="bg-slate-100 text-slate-700 rounded-full px-3 py-1 text-xs font-bold">
            {items.length} item
            {items.length ===
            1
              ? ""
              : "s"}
          </span>

        </div>

        {items.length ===
        0 ? (
          <EmptyState
            icon={Package}
            text="Product details were not stored with this order."
          />
        ) : (
          <div className="space-y-3">

            {items.map(
              (item, index) => {
                const quantity =
                  getItemQuantity(
                    item
                  );

                const price =
                  getItemPrice(
                    item
                  );

                return (
                  <div
                    key={
                      item.id ||
                      item.productId ||
                      index
                    }
                    className="bg-slate-50 border border-slate-200 rounded-xl p-4"
                  >

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

                      <div className="flex items-center gap-3">

                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center">
                          <Package
                            size={19}
                            className="text-indigo-700"
                          />
                        </div>

                        <div>

                          <p className="font-bold text-slate-900">
                            {getItemName(
                              item
                            )}
                          </p>

                          <p className="text-sm text-slate-500 mt-0.5">
                            Quantity:{" "}
                            <strong className="text-slate-700">
                              {quantity}
                            </strong>
                          </p>

                        </div>

                      </div>

                      <div className="text-left sm:text-right">

                        <p className="text-xs text-slate-500">
                          Unit Price
                        </p>

                        <p className="font-bold text-indigo-800">
                          {formatCurrency(
                            price
                          )}
                        </p>

                        <p className="text-xs text-slate-500 mt-0.5">
                          Subtotal:{" "}
                          {formatCurrency(
                            price *
                              quantity
                          )}
                        </p>

                      </div>

                    </div>

                  </div>
                );
              }
            )}

          </div>
        )}

      </section>

      {/* PAYMENT */}

      <section className="grid md:grid-cols-2 gap-5">

        <InfoPanel
          title="Payment Information"
          icon={IndianRupee}
          rows={[
            [
              "Payment Method",
              getPaymentMethod(
                order
              ),
            ],
            [
              "Payment Status",
              getPaymentStatus(
                order
              ),
            ],
            [
              "Order Amount",
              formatCurrency(
                amount
              ),
            ],
          ]}
        />

        <InfoPanel
          title="Order Information"
          icon={Database}
          rows={[
            [
              "Order ID",
              getOrderId(
                order
              ),
            ],
            [
              "Status",
              displayStatus(
                status
              ),
            ],
            [
              "Order Date",
              formatDate(
                getOrderDate(
                  order
                )
              ),
            ],
            [
              "Updated",
              getUpdatedDate(
                order
              )
                ? formatDate(
                    getUpdatedDate(
                      order
                    )
                  )
                : "Not available",
            ],
          ]}
        />

      </section>

    </div>
  );
}

/*
|--------------------------------------------------------------------------
| ADDRESS CARD
|--------------------------------------------------------------------------
*/

function AddressCard({
  title,
  icon: Icon,
  name,
  phone,
  email,
  address,
}) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">

      <div className="flex items-center gap-3">

        <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center">
          <Icon
            size={21}
            className="text-indigo-700"
          />
        </div>

        <div>

          <p className="text-xs uppercase tracking-wide font-bold text-slate-500">
            {title}
          </p>

          <h4 className="font-bold text-slate-950 mt-1">
            {name}
          </h4>

        </div>

      </div>

      <div className="mt-4 space-y-2 text-sm">

        {phone && (
          <p className="text-slate-600">
            <strong className="text-slate-800">
              Phone:
            </strong>{" "}
            {phone}
          </p>
        )}

        {email && (
          <p className="text-slate-600 break-all">
            <strong className="text-slate-800">
              Email:
            </strong>{" "}
            {email}
          </p>
        )}

        <div className="flex items-start gap-2 text-slate-600">

          <MapPin
            size={16}
            className="text-slate-400 mt-0.5 shrink-0"
          />

          <span>
            {address}
          </span>

        </div>

      </div>

    </div>
  );
}

/*
|--------------------------------------------------------------------------
| INFO PANEL
|--------------------------------------------------------------------------
*/

function InfoPanel({
  title,
  icon: Icon,
  rows,
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6">

      <div className="flex items-center gap-2 mb-4">

        <Icon
          size={20}
          className="text-indigo-700"
        />

        <h3 className="text-xl font-bold text-slate-950">
          {title}
        </h3>

      </div>

      <div className="space-y-3">

        {rows.map(
          ([label, value]) => (
            <div
              key={label}
              className="flex flex-col sm:flex-row sm:justify-between gap-1 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
            >

              <span className="text-sm text-slate-500">
                {label}
              </span>

              <span className="text-sm font-semibold text-slate-800 sm:text-right break-words max-w-full sm:max-w-[65%]">
                {value || "Not available"}
              </span>

            </div>
          )
        )}

      </div>

    </section>
  );
}
