import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  equalTo,
  get,
  orderByChild,
  query,
  ref,
  update,
} from "firebase/database";

import { auth, database } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";

/* =========================================================
   HELPERS
========================================================= */

function normalize(value) {
  return String(value ?? "")
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

function formatCurrency(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return "₹0";
  }

  return number.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getOrderStatus(order) {
  return normalize(
    order?.status ||
      order?.orderStatus ||
      "pending"
  );
}

function getOrderSection(order) {
  const status = getOrderStatus(order);

  if (status === "pending") return "pending";
  if (status === "completed") return "completed";
  if ([
    "accepted",
    "delivered_by_dealer",
    "received_by_farmer",
    "payment_pending",
    "payment_received",
  ].includes(status)) {
    return "farmer_received";
  }

  // Rejected and unknown statuses are intentionally hidden
  // from the three primary order sections.
  return null;
}

function isEligibleHistoryOrder(order) {
  return [
    "completed",
    "complete",
    "rejected",
    "reject",
  ].includes(getOrderStatus(order));
}

function getOrderProductId(order) {
  return (
    order?.productId ||
    order?.productKey ||
    order?.productUid ||
    order?.productID ||
    order?.product?.id ||
    order?.product?.productId ||
    order?.product?.productKey ||
    order?.product?.productUid ||
    order?.product?.productID ||
    ""
  );
}

function getOrderDealerUid(order) {
  return (
    order?.dealerUid ||
    order?.dealerId ||
    order?.dealerUID ||
    order?.dealer?.uid ||
    order?.dealer?.id ||
    ""
  );
}

function getDeletedHistoryOrderIds(uid) {
  try {
    const saved = localStorage.getItem(`dealerOrderHistoryDeletes_${uid}`);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDeletedHistoryOrderIds(uid, ids) {
  localStorage.setItem(`dealerOrderHistoryDeletes_${uid}`, JSON.stringify(ids));
}

function getOrderProductName(order) {
  return String(
    order?.productName ||
      order?.product?.productName ||
      order?.product?.name ||
      order?.product?.title ||
      order?.name ||
      ""
  ).trim();
}

function getOrderQuantity(order) {
  const quantity = Number(
    order?.quantity ??
      order?.orderQuantity ??
      order?.qty ??
      0
  );

  return Number.isFinite(quantity)
    ? quantity
    : 0;
}

function getProductQuantity(product) {
  const quantity = Number(
    product?.quantity ??
      product?.availableQuantity ??
      product?.stock ??
      0
  );

  return Number.isFinite(quantity)
    ? quantity
    : 0;
}

function getReservedQuantity(product) {
  const value = Number(
    product?.reservedQuantity ?? 0
  );

  return Number.isFinite(value)
    ? value
    : 0;
}

function getSoldQuantity(product) {
  const value = Number(
    product?.soldQuantity ?? 0
  );

  return Number.isFinite(value)
    ? value
    : 0;
}

function getAllOrderProductIds(order) {
  return [
    order?.productId,
    order?.productKey,
    order?.productUid,
    order?.productID,
    order?.product?.id,
    order?.product?.productId,
    order?.product?.productKey,
    order?.product?.productUid,
    order?.product?.productID,
  ]
    .filter(
      (value) =>
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ""
    )
    .map((value) => String(value).trim());
}

function getAllOrderProductNames(order) {
  return [
    order?.productName,
    order?.product?.productName,
    order?.product?.name,
    order?.product?.title,
    order?.name,
  ]
    .filter(
      (value) =>
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ""
    )
    .map((value) => normalize(value));
}

/* =========================================================
   MAIN PAGE
========================================================= */

export default function DealerOrdersPage() {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] =
    useState(null);

  const [role, setRole] =
    useState("");

  const [orders, setOrders] =
    useState([]);

  const [deletedHistoryOrderIds, setDeletedHistoryOrderIds] =
    useState([]);

  const [products, setProducts] =
    useState({});

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [processingOrderId, setProcessingOrderId] =
    useState(null);

  const [searchTerm, setSearchTerm] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("pending");

  const [historyStatusFilter, setHistoryStatusFilter] = useState("completed");
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");

  const [selectedCompletedOrder, setSelectedCompletedOrder] =
    useState(null);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [deleteConfirmation, setDeleteConfirmation] = useState(false);
  const longPressTimer = useRef(null);
  const suppressOrderClick = useRef(false);

  const [message, setMessage] =
    useState(null);

  /* =======================================================
     AUTH
  ======================================================= */

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            setCurrentUser(null);
            setDeletedHistoryOrderIds([]);
            setLoading(false);

            navigate("/login", {
              replace: true,
            });

            return;
          }

          setCurrentUser(user);
          setDeletedHistoryOrderIds(getDeletedHistoryOrderIds(user.uid));

          try {
            const userSnapshot =
              await get(
                ref(
                  database,
                  `users/${user.uid}`
                )
              );

            if (!userSnapshot.exists()) {
              setLoading(false);

              navigate("/role-selection", {
                replace: true,
              });

              return;
            }

            const userData =
              userSnapshot.val();

            const userRole =
              normalize(
                userData?.role
              );

            if (
              userRole !== "dealer" &&
              userRole !== "admin"
            ) {
              setLoading(false);

              navigate("/role-selection", {
                replace: true,
              });

              return;
            }

            setRole(userRole);
          } catch (error) {
            console.error(
              "Dealer orders authorization error:",
              error
            );

            setMessage({
              type: "error",
              text:
                "Unable to verify your account role.",
            });

            setLoading(false);
          }
        }
      );

    return () => unsubscribe();
  }, [navigate]);

  /* =======================================================
     LOAD ORDERS
  ======================================================= */

  useEffect(() => {
    if (!currentUser || !role) {
      return;
    }

    loadOrders();
  }, [currentUser, role]);

  async function loadOrders(
    showRefreshing = false
  ) {
    if (!currentUser) {
      return;
    }

    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setMessage(null);

      let ordersSnapshot;

      if (role === "dealer") {
        const ordersQuery =
          query(
            ref(
              database,
              "dealerOrders"
            ),
            orderByChild(
              "dealerUid"
            ),
            equalTo(
              currentUser.uid
            )
          );

        ordersSnapshot =
          await get(ordersQuery);
      } else {
        ordersSnapshot =
          await get(
            ref(
              database,
              "dealerOrders"
            )
          );
      }

      const loadedOrders = [];

      if (ordersSnapshot.exists()) {
        const data =
          ordersSnapshot.val();

        Object.entries(
          data || {}
        ).forEach(
          ([orderId, order]) => {
            if (!isObject(order)) {
              return;
            }

            if (
              role === "dealer" &&
              getOrderDealerUid(order) !==
                currentUser.uid
            ) {
              return;
            }

            loadedOrders.push({
              id: orderId,
              ...order,
            });
          }
        );
      }

      loadedOrders.sort(
        (a, b) =>
          Number(
            b.createdAt || 0
          ) -
          Number(
            a.createdAt || 0
          )
      );

      setOrders(
        loadedOrders
      );

      await loadProducts(
        loadedOrders
      );

      if (showRefreshing) {
        setMessage({
          type: "success",
          text:
            "Orders and products refreshed successfully.",
        });
      }
    } catch (error) {
      console.error(
        "Dealer orders loading error:",
        error
      );

      const errorText =
        String(
          error?.message || ""
        ).toLowerCase();

      setMessage({
        type: "error",
        text:
          errorText.includes(
            "permission"
          )
            ? "Firebase permission denied while loading orders. Check your database rules."
            : "Orders could not be loaded.",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  /* =======================================================
     LOAD PRODUCTS
  ======================================================= */

  async function loadProducts(
    loadedOrders
  ) {
    const dealerUids =
      new Set();

    if (
      role === "dealer" &&
      currentUser?.uid
    ) {
      dealerUids.add(
        currentUser.uid
      );
    }

    loadedOrders.forEach(
      (order) => {
        const dealerUid =
          getOrderDealerUid(
            order
          );

        if (dealerUid) {
          dealerUids.add(
            dealerUid
          );
        }
      }
    );

    const productMap = {};

    await Promise.all(
      [...dealerUids].map(
        async (dealerUid) => {
          try {
            const snapshot =
              await get(
                ref(
                  database,
                  `dealerProducts/${dealerUid}`
                )
              );

            if (
              !snapshot.exists()
            ) {
              return;
            }

            const dealerProducts =
              snapshot.val();

            Object.entries(
              dealerProducts || {}
            ).forEach(
              ([productId, product]) => {
                if (
                  !isObject(product)
                ) {
                  return;
                }

                productMap[
                  `${dealerUid}/${productId}`
                ] = {
                  id: productId,
                  dealerUid,
                  ...product,
                };
              }
            );
          } catch (error) {
            console.error(
              `Unable to load products for dealer ${dealerUid}:`,
              error
            );
          }
        }
      )
    );

    setProducts(
      productMap
    );

    return productMap;
  }

  /* =======================================================
     FIND ORDER PRODUCT
  ======================================================= */

  async function findOrderProduct(
    order,
    productMap = products
  ) {
    let dealerUid =
      getOrderDealerUid(
        order
      );

    if (
      role === "dealer" &&
      currentUser?.uid
    ) {
      dealerUid =
        currentUser.uid;
    }

    if (!dealerUid) {
      dealerUid =
        productMap
          ? Object.values(
              productMap
            ).find(
              (product) =>
                product?.dealerUid
            )?.dealerUid
          : "";
    }

    if (!dealerUid) {
      console.error(
        "Product lookup failed: dealer UID missing",
        {
          orderId: order?.id,
          order,
        }
      );

      return null;
    }

    const requestedIds =
      getAllOrderProductIds(
        order
      );

    const requestedNames =
      getAllOrderProductNames(
        order
      );

    for (
      const requestedId of requestedIds
    ) {
      const exactKey =
        `${dealerUid}/${requestedId}`;

      if (
        productMap?.[exactKey]
      ) {
        return {
          ...productMap[
            exactKey
          ],
          matchedBy:
            "productId",
        };
      }
    }

    const localProducts =
      Object.values(
        productMap || {}
      ).filter(
        (product) =>
          product?.dealerUid ===
          dealerUid
      );

    const localIdMatch =
      localProducts.find(
        (product) => {
          const productIds = [
            product?.id,
            product?.productId,
            product?.productKey,
            product?.productUid,
            product?.productID,
          ]
            .filter(Boolean)
            .map(
              (value) =>
                String(value).trim()
            );

          return requestedIds.some(
            (requestedId) =>
              productIds.includes(
                requestedId
              )
          );
        }
      );

    if (localIdMatch) {
      return {
        ...localIdMatch,
        matchedBy:
          "productObjectId",
      };
    }

    const localNameMatch =
      localProducts.find(
        (product) => {
          const productName =
            normalize(
              product?.productName ||
                product?.name ||
                product?.title
            );

          return (
            productName &&
            requestedNames.includes(
              productName
            )
          );
        }
      );

    if (localNameMatch) {
      return {
        ...localNameMatch,
        matchedBy:
          "productName",
      };
    }

    try {
      const snapshot =
        await get(
          ref(
            database,
            `dealerProducts/${dealerUid}`
          )
        );

      if (
        !snapshot.exists()
      ) {
        console.error(
          "No dealerProducts branch exists for dealer:",
          dealerUid
        );

        return null;
      }

      const dealerProducts =
        snapshot.val();

      const entries =
        Object.entries(
          dealerProducts || {}
        );

      for (
        const [
          productId,
          product,
        ] of entries
      ) {
        if (
          !isObject(product)
        ) {
          continue;
        }

        if (
          requestedIds.includes(
            String(productId)
          )
        ) {
          return {
            id: productId,
            dealerUid,
            ...product,
            matchedBy:
              "databaseProductKey",
          };
        }
      }

      for (
        const [
          productId,
          product,
        ] of entries
      ) {
        if (
          !isObject(product)
        ) {
          continue;
        }

        const databaseProductIds = [
          product?.productId,
          product?.productKey,
          product?.productUid,
          product?.productID,
          product?.id,
        ]
          .filter(Boolean)
          .map(
            (value) =>
              String(value).trim()
          );

        const matched =
          requestedIds.some(
            (requestedId) =>
              databaseProductIds.includes(
                requestedId
              )
          );

        if (matched) {
          return {
            id: productId,
            dealerUid,
            ...product,
            matchedBy:
              "databaseProductId",
          };
        }
      }

      for (
        const [
          productId,
          product,
        ] of entries
      ) {
        if (
          !isObject(product)
        ) {
          continue;
        }

        const databaseProductName =
          normalize(
            product?.productName ||
              product?.name ||
              product?.title
          );

        if (
          databaseProductName &&
          requestedNames.includes(
            databaseProductName
          )
        ) {
          return {
            id: productId,
            dealerUid,
            ...product,
            matchedBy:
              "databaseProductName",
          };
        }
      }

      for (
        const [
          productId,
          product,
        ] of entries
      ) {
        if (
          !isObject(product)
        ) {
          continue;
        }

        const databaseProductName =
          normalize(
            product?.productName ||
              product?.name ||
              product?.title
          );

        if (
          !databaseProductName
        ) {
          continue;
        }

        const partialMatch =
          requestedNames.some(
            (requestedName) =>
              requestedName &&
              (
                databaseProductName.includes(
                  requestedName
                ) ||
                requestedName.includes(
                  databaseProductName
                )
              )
          );

        if (partialMatch) {
          return {
            id: productId,
            dealerUid,
            ...product,
            matchedBy:
              "partialProductName",
          };
        }
      }
    } catch (error) {
      console.error(
        "Fresh product lookup failed:",
        error
      );
    }

    console.error(
      "PRODUCT RESOLUTION FAILED",
      {
        orderId:
          order?.id,
        dealerUid,
        requestedIds,
        requestedNames,
        order,
      }
    );

    return null;
  }

  /* =======================================================
     ACCEPT ORDER
  ======================================================= */

  async function acceptOrder(
    order
  ) {
    if (
      !order?.id ||
      processingOrderId
    ) {
      return;
    }

    const currentStatus =
      getOrderStatus(
        order
      );

    if (
      currentStatus !==
      "pending"
    ) {
      setMessage({
        type: "info",
        text:
          "This order is no longer pending.",
      });

      return;
    }

    const quantity =
      getOrderQuantity(
        order
      );

    if (
      !Number.isFinite(
        quantity
      ) ||
      quantity <= 0
    ) {
      setMessage({
        type: "error",
        text:
          "This order has an invalid quantity.",
      });

      return;
    }

    setProcessingOrderId(
      order.id
    );

    setMessage(null);

    try {
      const product =
        await findOrderProduct(
          order
        );

      if (!product) {
        console.error(
          "Product resolution failed:",
          {
            orderId:
              order.id,
            dealerUid:
              getOrderDealerUid(
                order
              ) ||
              currentUser?.uid,
            productIds:
              getAllOrderProductIds(
                order
              ),
            productNames:
              getAllOrderProductNames(
                order
              ),
            order,
          }
        );

        setMessage({
          type: "error",
          text:
            "The product could not be found. Refresh the product list and try again.",
        });

        return;
      }

      let dealerUid =
        product?.dealerUid ||
        getOrderDealerUid(
          order
        );

      if (
        role === "dealer" &&
        currentUser?.uid
      ) {
        dealerUid =
          currentUser.uid;
      }

      if (!dealerUid) {
        setMessage({
          type: "error",
          text:
            "This order does not contain a dealer reference.",
        });

        return;
      }

      if (
        role === "dealer" &&
        dealerUid !==
          currentUser.uid
      ) {
        setMessage({
          type: "error",
          text:
            "You cannot accept an order belonging to another dealer.",
        });

        return;
      }

      const productId =
        product?.id;

      if (!productId) {
        setMessage({
          type: "error",
          text:
            "The product ID is missing. Refresh the product list and try again.",
        });

        return;
      }

      const availableQuantity =
        getProductQuantity(
          product
        );

      const reservedQuantity =
        getReservedQuantity(
          product
        );

      const soldQuantity =
        getSoldQuantity(
          product
        );

      if (
        availableQuantity <
        quantity
      ) {
        setMessage({
          type: "error",
          text:
            `Insufficient stock. Available: ${availableQuantity}, requested: ${quantity}.`,
        });

        return;
      }

      const newQuantity =
        availableQuantity -
        quantity;

      const newReservedQuantity =
        reservedQuantity +
        quantity;

      const productName =
        String(
          product?.productName ||
            product?.name ||
            getOrderProductName(
              order
            ) ||
            ""
        ).trim();

      const category =
        String(
          product?.category ||
            order?.category ||
            ""
        ).trim();

      const unit =
        String(
          product?.unit ||
            order?.unit ||
            ""
        ).trim();

      const price =
        Number(
          product?.price ??
            order?.price ??
            0
        );

      if (
        !productName ||
        !category ||
        !unit ||
        !Number.isFinite(
          price
        ) ||
        price < 0
      ) {
        console.error(
          "Product failed Firebase validation requirements:",
          {
            product,
            productName,
            category,
            unit,
            price,
          }
        );

        setMessage({
          type: "error",
          text:
            "The product data is incomplete. Product name, category, price and unit are required.",
        });

        return;
      }

      const now =
        new Date().toISOString();

      const updates = {};

      updates[
        `dealerProducts/${dealerUid}/${productId}/productName`
      ] = productName;

      updates[
        `dealerProducts/${dealerUid}/${productId}/category`
      ] = category;

      updates[
        `dealerProducts/${dealerUid}/${productId}/price`
      ] = price;

      updates[
        `dealerProducts/${dealerUid}/${productId}/quantity`
      ] = newQuantity;

      updates[
        `dealerProducts/${dealerUid}/${productId}/unit`
      ] = unit;

      updates[
        `dealerProducts/${dealerUid}/${productId}/dealerUid`
      ] = dealerUid;

      updates[
        `dealerProducts/${dealerUid}/${productId}/reservedQuantity`
      ] = newReservedQuantity;

      updates[
        `dealerProducts/${dealerUid}/${productId}/soldQuantity`
      ] = soldQuantity;

      updates[
        `dealerOrders/${order.id}/status`
      ] = "accepted";

      updates[
        `dealerOrders/${order.id}/productId`
      ] = productId;

      updates[
        `dealerOrders/${order.id}/acceptedAt`
      ] = now;

      updates[
        `dealerOrders/${order.id}/updatedAt`
      ] = now;

      const orderDealerUid =
        getOrderDealerUid(
          order
        );

      if (
        orderDealerUid ===
        dealerUid
      ) {
        updates[
          `dealerOrders/${order.id}/dealerUid`
        ] = dealerUid;
      }

      await update(
        ref(database),
        updates
      );

      setOrders(
        (currentOrders) =>
          currentOrders.map(
            (currentOrder) =>
              currentOrder.id ===
              order.id
                ? {
                    ...currentOrder,
                    status:
                      "accepted",
                    productId,
                    acceptedAt:
                      now,
                    updatedAt:
                      now,
                  }
                : currentOrder
          )
      );

      setProducts(
        (currentProducts) => ({
          ...currentProducts,
          [`${dealerUid}/${productId}`]:
            {
              ...product,
              id: productId,
              dealerUid,
              productName,
              category,
              price,
              unit,
              quantity:
                newQuantity,
              reservedQuantity:
                newReservedQuantity,
              soldQuantity:
                soldQuantity,
            },
        })
      );

      setMessage({
        type: "success",
        text:
          "Order accepted successfully. The requested quantity has been reserved.",
      });
    } catch (error) {
      console.error(
        "Order acceptance error:",
        error
      );

      const errorText =
        String(
          error?.message || ""
        ).toLowerCase();

      if (
        errorText.includes(
          "permission denied"
        ) ||
        errorText.includes(
          "permission_denied"
        )
      ) {
        setMessage({
          type: "error",
          text:
            "Order acceptance was blocked by Firebase permissions. Check the dealerProducts and dealerOrders write rules.",
        });
      } else if (
        errorText.includes(
          "validation"
        )
      ) {
        setMessage({
          type: "error",
          text:
            "Firebase rejected the product update because the product data does not match the database validation rules.",
        });
      } else {
        setMessage({
          type: "error",
          text:
            "The order could not be accepted. Please refresh the page and try again.",
        });
      }
    } finally {
      setProcessingOrderId(
        null
      );
    }
  }

  /* =======================================================
     REJECT ORDER
  ======================================================= */

  async function rejectOrder(
    order
  ) {
    if (
      !order?.id ||
      processingOrderId
    ) {
      return;
    }

    if (
      getOrderStatus(order) !==
      "pending"
    ) {
      return;
    }

    setProcessingOrderId(
      order.id
    );

    setMessage(null);

    try {
      const now =
        new Date().toISOString();

      await update(
        ref(database),
        {
          [`dealerOrders/${order.id}/status`]:
            "rejected",

          [`dealerOrders/${order.id}/rejectedAt`]:
            now,

          [`dealerOrders/${order.id}/updatedAt`]:
            now,
        }
      );

      setOrders(
        (currentOrders) =>
          currentOrders.map(
            (item) =>
              item.id ===
              order.id
                ? {
                    ...item,
                    status:
                      "rejected",
                    rejectedAt:
                      now,
                    updatedAt:
                      now,
                  }
                : item
          )
      );

      setMessage({
        type: "success",
        text:
          "Order rejected successfully.",
      });
    } catch (error) {
      console.error(
        "Order rejection error:",
        error
      );

      setMessage({
        type: "error",
        text:
          "The order could not be rejected.",
      });
    } finally {
      setProcessingOrderId(
        null
      );
    }
  }

  /* =======================================================
     MARK PAYMENT RECEIVED
  ======================================================= */

  async function markPaymentReceived(order) {
    if (!order?.id || processingOrderId) return;
    const status = getOrderStatus(order);
    const farmerConfirmedReceipt =
      status === "received_by_farmer" && order.farmerReceived;
    if (
      !farmerConfirmedReceipt &&
      !["delivered_by_dealer", "payment_pending", "payment_received"].includes(status)
    ) {
      return;
    }

    setProcessingOrderId(order.id);
    setMessage(null);
    try {
      const dealerUid = getOrderDealerUid(order) || currentUser?.uid;
      let productId = getOrderProductId(order);
      const quantity = getOrderQuantity(order);
      const now = new Date().toISOString();
      const updates = {
        [`dealerOrders/${order.id}/status`]: "completed",
        [`dealerOrders/${order.id}/dealerPaymentReceived`]: true,
        [`dealerOrders/${order.id}/dealerPaymentReceivedAt`]:
          order.dealerPaymentReceivedAt || now,
        [`dealerOrders/${order.id}/paymentReceivedAt`]:
          order.paymentReceivedAt || now,
        [`dealerOrders/${order.id}/completedAt`]: now,
        [`dealerOrders/${order.id}/updatedAt`]: now,
      };

      if (
        dealerUid &&
        !productId
      ) {
        const resolvedProduct =
          await findOrderProduct(
            order
          );

        if (
          resolvedProduct
        ) {
          productId =
            resolvedProduct.id;
        }
      }

      if (
        dealerUid &&
        productId
      ) {
        let product =
          products[
            `${dealerUid}/${productId}`
          ];

        if (!product) {
          const snapshot =
            await get(
              ref(
                database,
                `dealerProducts/${dealerUid}/${productId}`
              )
            );

          if (
            snapshot.exists()
          ) {
            product = {
              id: productId,
              dealerUid,
              ...snapshot.val(),
            };
          }
        }

        if (product) {
          const reserved =
            getReservedQuantity(
              product
            );

          const sold =
            getSoldQuantity(
              product
            );

          const newReserved =
            Math.max(
              0,
              reserved -
                quantity
            );

          const newSold =
            sold + quantity;

          updates[
            `dealerProducts/${dealerUid}/${productId}/reservedQuantity`
          ] = newReserved;

          updates[
            `dealerProducts/${dealerUid}/${productId}/soldQuantity`
          ] = newSold;

          updates[
            `dealerProducts/${dealerUid}/${productId}/dealerUid`
          ] = dealerUid;
        }
      }

      await update(ref(database), updates);
      setOrders((currentOrders) => currentOrders.map((item) => item.id === order.id
        ? {
            ...item,
            status: "completed",
            dealerPaymentReceived: true,
            dealerPaymentReceivedAt: item.dealerPaymentReceivedAt || now,
            paymentReceivedAt: item.paymentReceivedAt || now,
            completedAt: now,
            updatedAt: now,
          }
        : item));
      setMessage({ type: "success", text: "Payment received. The order is now in completed history." });
    } catch (error) {
      console.error("Payment and order completion error:", error);
      setMessage({ type: "error", text: "Payment could not be recorded and the order could not be completed." });
    } finally {
      setProcessingOrderId(null);
    }
  }

  /* =======================================================
     FILTERED ORDERS
  ======================================================= */

  const filteredOrders =
    useMemo(() => {
      const search =
        normalize(
          searchTerm
        );

      return orders.filter(
        (order) => {
          if (
            role === "dealer" &&
            statusFilter === "completed" &&
            deletedHistoryOrderIds.includes(order.id)
          ) {
            return false;
          }

          const status =
            getOrderStatus(
              order
            );

          const inSelectedSection = getOrderSection(order) === statusFilter;

          if (!inSelectedSection) {
            return false;
          }

          if (statusFilter === "completed") {
            const statusMatches = historyStatusFilter === "all" ||
              (historyStatusFilter === "completed" && status === "completed");
            if (!statusMatches) return false;

            const dateValue = order.completedAt || order.updatedAt || order.createdAt;
            const timestamp = dateValue ? new Date(dateValue).getTime() : NaN;
            const start = historyStartDate ? new Date(`${historyStartDate}T00:00:00`).getTime() : -Infinity;
            const end = historyEndDate ? new Date(`${historyEndDate}T23:59:59.999`).getTime() : Infinity;
            if (historyStartDate || historyEndDate) {
              if (!Number.isFinite(timestamp) || timestamp < start || timestamp > end) return false;
            }
          }

          if (!search) {
            return true;
          }

          const searchableText =
            [
              order.id,
              order.orderId,
              getOrderProductId(order),
              order.farmerUid,
              order.farmerName,
              order.customerName,
              order.farmerEmail,
              order.productName,
              order.product?.productName,
              order.productId,
              order.productKey,
              order.status,
              order.orderStatus,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

          return searchableText.includes(
            search
          );
        }
      );
    }, [
      orders,
      role,
      deletedHistoryOrderIds,
      searchTerm,
      statusFilter,
      historyStatusFilter,
      historyStartDate,
      historyEndDate,
    ]);

  useEffect(() => {
    if (statusFilter !== "completed") {
      clearTimeout(longPressTimer.current);
      setSelectionMode(false);
      setSelectedOrderIds([]);
      setDeleteConfirmation(false);
    }
  }, [statusFilter]);

  useEffect(() => () => clearTimeout(longPressTimer.current), []);

  const selectableVisibleOrderIds = filteredOrders
    .filter(isEligibleHistoryOrder)
    .map((order) => order.id);
  const allVisibleOrdersSelected =
    selectableVisibleOrderIds.length > 0 &&
    selectableVisibleOrderIds.every((id) => selectedOrderIds.includes(id));

  function toggleOrderSelection(order) {
    if (!isEligibleHistoryOrder(order)) {
      return;
    }

    setSelectionMode(true);
    setSelectedOrderIds((currentIds) =>
      currentIds.includes(order.id)
        ? currentIds.filter((id) => id !== order.id)
        : [...currentIds, order.id]
    );
  }

  function startOrderLongPress(order, event) {
    if (
      statusFilter !== "completed" ||
      !isEligibleHistoryOrder(order) ||
      event.target.closest?.("button, a, input, select, textarea")
    ) {
      return;
    }

    clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      suppressOrderClick.current = true;
      setSelectionMode(true);
      setSelectedOrderIds((currentIds) =>
        currentIds.includes(order.id) ? currentIds : [...currentIds, order.id]
      );
    }, 600);
  }

  function stopOrderLongPress() {
    clearTimeout(longPressTimer.current);
  }

  function handleOrderCardClick(order, event) {
    if (suppressOrderClick.current) {
      suppressOrderClick.current = false;
      event.preventDefault();
      return;
    }

    if (selectionMode && !event.target.closest?.("button, a, input, select, textarea")) {
      toggleOrderSelection(order);
    }
  }

  function cancelSelection() {
    clearTimeout(longPressTimer.current);
    setSelectionMode(false);
    setSelectedOrderIds([]);
    setDeleteConfirmation(false);
  }

  function toggleSelectAll() {
    setSelectionMode(true);
    setSelectedOrderIds((currentIds) => {
      if (allVisibleOrdersSelected) {
        return currentIds.filter((id) => !selectableVisibleOrderIds.includes(id));
      }
      return [...new Set([...currentIds, ...selectableVisibleOrderIds])];
    });
  }

  async function deleteSelectedHistoryOrders() {
    const selectedOrders = filteredOrders.filter(
      (order) =>
        selectedOrderIds.includes(order.id) &&
        isEligibleHistoryOrder(order) &&
        (role !== "dealer" || getOrderDealerUid(order) === currentUser?.uid)
    );

    if (selectedOrders.length === 0) {
      setDeleteConfirmation(false);
      return;
    }

    try {
      setProcessingOrderId("deleting-history");
      if (!currentUser || role !== "dealer") {
        throw new Error("A signed-in dealer is required to delete these orders.");
      }
      const deletedIds = new Set(selectedOrders.map((order) => order.id));
      const nextDeletedIds = [...new Set([...deletedHistoryOrderIds, ...deletedIds])];
      saveDeletedHistoryOrderIds(currentUser.uid, nextDeletedIds);
      setDeletedHistoryOrderIds(nextDeletedIds);
      setOrders((currentOrders) =>
        currentOrders.filter((order) => !deletedIds.has(order.id))
      );
      setSelectedCompletedOrder((currentOrder) =>
        currentOrder && deletedIds.has(currentOrder.id) ? null : currentOrder
      );
      setDeleteConfirmation(false);
      setSelectionMode(false);
      setSelectedOrderIds([]);
      setMessage({
        type: "success",
        text:
          selectedOrders.length === 1
            ? "Order deleted from history."
            : "Orders deleted from history.",
      });
    } catch (error) {
      console.error("Delete history orders error:", error);
      setMessage({
        type: "error",
        text: "The selected orders could not be deleted from history.",
      });
    } finally {
      setProcessingOrderId(null);
    }
  }

  /* =======================================================
     COUNTS
  ======================================================= */

  const counts =
    useMemo(() => {
      const result = {
        pending: 0,
        farmer_received: 0,
        completed: 0,
      };

      orders.forEach(
        (order) => {
          if (role === "dealer" && deletedHistoryOrderIds.includes(order.id)) return;
          const section = getOrderSection(order);
          if (section === "completed" && getOrderStatus(order) !== "completed") return;
          if (section && Object.prototype.hasOwnProperty.call(result, section)) {
            result[section]++;
          }
        }
      );

      return result;
    }, [orders, role, deletedHistoryOrderIds]);

  /* =======================================================
     PRODUCT FOR DISPLAY
  ======================================================= */

  function getProductForOrder(
    order
  ) {
    let dealerUid =
      getOrderDealerUid(
        order
      );

    if (
      role === "dealer" &&
      currentUser?.uid
    ) {
      dealerUid =
        currentUser.uid;
    }

    const productIds =
      getAllOrderProductIds(
        order
      );

    if (
      dealerUid &&
      productIds.length
    ) {
      for (
        const productId of productIds
      ) {
        const product =
          products[
            `${dealerUid}/${productId}`
          ];

        if (product) {
          return product;
        }
      }
    }

    const names =
      getAllOrderProductNames(
        order
      );

    if (
      dealerUid &&
      names.length
    ) {
      const product =
        Object.values(
          products
        ).find(
          (item) =>
            item?.dealerUid ===
              dealerUid &&
            names.includes(
              normalize(
                item?.productName ||
                  item?.name
              )
            )
        );

      if (product) {
        return product;
      }
    }

    return null;
  }

  /* =======================================================
     ACTION BUTTONS
  ======================================================= */

  function renderActions(
    order
  ) {
    const status =
      getOrderStatus(
        order
      );

    const busy =
      processingOrderId ===
      order.id;

    if (
      status ===
      "pending"
    ) {
      return (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              acceptOrder(order)
            }
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-semibold disabled:opacity-50 transition"
          >
            {busy
              ? "Processing..."
              : "Accept Order"}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() =>
              rejectOrder(order)
            }
            className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-4 py-2.5 rounded-xl font-semibold disabled:opacity-50 transition"
          >
            Reject
          </button>
        </div>
      );
    }

    if (status === "accepted") {
      return <span className="text-sm font-semibold text-amber-700">Waiting for farmer to confirm order received</span>;
    }

    if (
      (status === "received_by_farmer" && order.farmerReceived) ||
      ["delivered_by_dealer", "payment_pending", "payment_received"].includes(status)
    ) {
      return (
        <button
          type="button"
          disabled={busy}
          onClick={() => markPaymentReceived(order)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl font-semibold disabled:opacity-50 transition"
        >
          {busy ? "Processing..." : "Payment Received"}
        </button>
      );
    }

    return (
      <span className="text-sm text-gray-500">
        No action required
      </span>
    );
  }

  /* =======================================================
     STATUS BADGE
  ======================================================= */

  function renderStatus(
    status
  ) {
    const styles = {
      pending:
        "bg-amber-50 text-amber-700 border-amber-200",

      accepted:
        "bg-blue-50 text-blue-700 border-blue-200",

      received_by_farmer:
        "bg-indigo-50 text-indigo-700 border-indigo-200",

      rejected:
        "bg-red-50 text-red-700 border-red-200",

      delivered_by_dealer:
        "bg-indigo-50 text-indigo-700 border-indigo-200",

      payment_received:
        "bg-purple-50 text-purple-700 border-purple-200",

      completed:
        "bg-green-50 text-green-700 border-green-200",

    };

    return (
      <span
        className={`inline-flex items-center px-3 py-1.5 rounded-full border text-xs font-bold ${
          styles[
            status
          ] ||
          "bg-gray-100 text-gray-600 border-gray-200"
        }`}
      >
        {status
          .replaceAll(
            "_",
            " "
          )
          .replace(
            /^\w/,
            (character) =>
              character.toUpperCase()
          )}
      </span>
    );
  }

  const completedOrderProduct = selectedCompletedOrder
    ? getProductForOrder(selectedCompletedOrder)
    : null;
  const completedOrderAddress =
    selectedCompletedOrder?.deliveryAddressDetails || {};

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl border border-blue-100 p-8 text-center max-w-md w-full">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-3xl">
            🛒
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mt-5">
            Loading Orders
          </h1>

          <p className="text-gray-500 mt-2">
            Loading farmer orders and
            product information...
          </p>
        </div>
      </div>
    );
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-cyan-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">

        <StatusMessage
          message={message}
          onClose={() =>
            setMessage(null)
          }
        />

        {/* =================================================
            HEADER
        ================================================== */}

        <header className="bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 text-white rounded-3xl shadow-xl p-6 md:p-8 mb-6 overflow-hidden relative">
          <div className="absolute -right-10 -top-16 w-48 h-48 rounded-full bg-cyan-300/20" />
          <div className="absolute -left-16 -bottom-24 w-56 h-56 rounded-full bg-blue-900/20" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">

            <div>
              <button
                type="button"
                onClick={() =>
                  navigate(
                    role === "admin"
                      ? "/admin"
                      : "/dealer"
                  )
                }
                className="text-blue-100 hover:text-white text-sm font-semibold mb-3 transition"
              >
                ←{" "}
                {role ===
                "admin"
                  ? "Admin Dashboard"
                  : "Dealer Dashboard"}
              </button>

              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-3xl shadow-lg">
                  🛒
                </div>

                <div>
                  <p className="text-blue-100 text-xs md:text-sm font-semibold uppercase tracking-wide">
                    AGRISAATHI DEALER PORTAL
                  </p>

                  <h1 className="text-3xl md:text-4xl font-bold">
                    Farmer Orders
                  </h1>

                  <p className="text-blue-50 mt-1">
                    Review, accept and
                    process farmer
                    orders.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={
                refreshing
              }
              onClick={() =>
                loadOrders(true)
              }
              className="bg-white text-blue-700 px-5 py-3 rounded-xl font-semibold hover:bg-blue-50 transition disabled:opacity-50 shadow-sm"
            >
              {refreshing
                ? "Refreshing..."
                : "↻ Refresh Orders"}
            </button>

          </div>
        </header>

        {/* =================================================
            SUMMARY
        ================================================== */}

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6" aria-label="Order sections">
          <SummaryCard label="Pending Orders" value={counts.pending} active={statusFilter === "pending"} onClick={() => setStatusFilter("pending")} />
          <SummaryCard label="Farmer Received" value={counts.farmer_received} active={statusFilter === "farmer_received"} onClick={() => setStatusFilter("farmer_received")} />
          <SummaryCard label="Completed" value={counts.completed} active={statusFilter === "completed"} onClick={() => setStatusFilter("completed")} />
        </section>

        {/* =================================================
            SEARCH
        ================================================== */}

        <section className="bg-white rounded-2xl border border-blue-100 shadow-sm p-5 mb-6">

          <div className="flex gap-4">

            <div className="flex-1">
              <label
                htmlFor="order-search"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Search Orders
              </label>

              <input
                id="order-search"
                type="search"
                value={
                  searchTerm
                }
                onChange={(event) => {
                  cancelSelection();
                  setSearchTerm(event.target.value);
                }}
                placeholder="Search order ID, farmer, email, product or product ID..."
                className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 transition"
              />
            </div>

          </div>

        </section>

        {statusFilter === "completed" && (
          <section className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:grid-cols-3">
            <label className="text-sm font-semibold text-gray-700">
              History status
              <select value={historyStatusFilter} onChange={(event) => { cancelSelection(); setHistoryStatusFilter(event.target.value); }} className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 font-normal">
                <option value="completed">Completed</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-gray-700">
              From date
              <input type="date" value={historyStartDate} max={historyEndDate || undefined} onChange={(event) => { cancelSelection(); setHistoryStartDate(event.target.value); }} className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal" />
            </label>
            <label className="text-sm font-semibold text-gray-700">
              To date
              <input type="date" value={historyEndDate} min={historyStartDate || undefined} onChange={(event) => { cancelSelection(); setHistoryEndDate(event.target.value); }} className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal" />
            </label>
          </section>
        )}

        {statusFilter === "completed" && selectionMode && (
          <section className="sticky top-2 z-20 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-white p-3 shadow-lg">
            <button
              type="button"
              onClick={cancelSelection}
              className="min-h-11 rounded-xl px-3 font-semibold text-gray-700 hover:bg-gray-100"
            >
              ← Cancel
            </button>
            <span className="font-bold text-blue-900">
              {selectedOrderIds.length} Selected
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={toggleSelectAll}
                disabled={selectableVisibleOrderIds.length === 0}
                className="min-h-11 rounded-xl border border-blue-200 px-3 font-semibold text-blue-800 disabled:opacity-50"
              >
                {allVisibleOrdersSelected ? "Deselect All" : "Select All"}
              </button>
              {selectedOrderIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setDeleteConfirmation(true)}
                  disabled={Boolean(processingOrderId)}
                  className="min-h-11 rounded-xl bg-red-600 px-4 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Delete Selected
                </button>
              )}
            </div>
          </section>
        )}

        {deleteConfirmation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="dealer-delete-history-title"
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            >
              <h2 id="dealer-delete-history-title" className="text-xl font-bold text-gray-900">
                {selectedOrderIds.length === 1
                  ? "Delete this order from history?"
                  : `Delete ${selectedOrderIds.length} selected orders?`}
              </h2>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={Boolean(processingOrderId)}
                  onClick={() => setDeleteConfirmation(false)}
                  className="min-h-11 rounded-xl border border-gray-300 px-4 font-semibold text-gray-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={Boolean(processingOrderId)}
                  onClick={deleteSelectedHistoryOrders}
                  className="min-h-11 rounded-xl bg-red-600 px-4 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {processingOrderId === "deleting-history" ? "Deleting..." : "Delete"}
                </button>
              </div>
            </section>
          </div>
        )}

        {/* =================================================
            ORDERS
        ================================================== */}

        {filteredOrders.length ===
        0 ? (
          <section className="bg-white rounded-3xl border border-blue-100 shadow-sm p-10 text-center">

            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100 flex items-center justify-center text-4xl">
              📦
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mt-5">
              No Orders Found
            </h2>

            <p className="text-gray-500 mt-2">
              {statusFilter ===
              "pending"
                ? "There are no pending farmer orders right now."
                : "No orders match the selected filter."}
            </p>

          </section>
        ) : (
          <section className="space-y-4">

            {filteredOrders.map(
              (order) => {
                const status =
                  getOrderStatus(
                    order
                  );

                const quantity =
                  getOrderQuantity(
                    order
                  );

                const product =
                  getProductForOrder(
                    order
                  );

                const productName =
                  getOrderProductName(
                    order
                  ) ||
                  product?.productName ||
                  product?.name ||
                  "Unknown Product";

                const orderId =
                  order.id ||
                  order.orderId ||
                  "Unknown";

                const farmerName =
                  order.farmerName ||
                  order.customerName ||
                  "Farmer";

                const price =
                  Number(
                    order.price ||
                      product?.price ||
                      0
                  );

                const totalAmount =
                  Number(
                    order.totalAmount ??
                      price *
                        quantity
                  );

                const busy =
                  processingOrderId ===
                  order.id;
                const selectable = isEligibleHistoryOrder(order);
                const selected = selectedOrderIds.includes(order.id);
                const address = order.deliveryAddressDetails || {};

                if (status === "completed") {
                  return (
                    <article
                      key={order.id}
                      onClick={(event) => handleOrderCardClick(order, event)}
                      onMouseDown={(event) => startOrderLongPress(order, event)}
                      onMouseUp={stopOrderLongPress}
                      onMouseLeave={stopOrderLongPress}
                      onTouchStart={(event) => startOrderLongPress(order, event)}
                      onTouchEnd={stopOrderLongPress}
                      onTouchMove={stopOrderLongPress}
                      onContextMenu={(event) => {
                        if (statusFilter === "completed" && selectable) {
                          event.preventDefault();
                          setSelectionMode(true);
                          setSelectedOrderIds((currentIds) =>
                            currentIds.includes(order.id) ? currentIds : [...currentIds, order.id]
                          );
                        }
                      }}
                      className={`rounded-2xl border p-4 shadow-sm transition md:p-5 flex flex-col sm:flex-row sm:items-center gap-4 select-none touch-manipulation ${
                        selected
                          ? "border-blue-600 bg-blue-50 ring-2 ring-blue-300"
                          : "border-blue-100 bg-white"
                      } ${selectable && statusFilter === "completed" ? "cursor-pointer" : ""}`}
                    >
                      {selected && (
                        <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-700 text-white">
                          ✓
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs uppercase tracking-wide font-bold text-gray-400">Order ID</p>
                        <p className="font-mono font-semibold text-gray-800 break-all">{orderId}</p>
                        <p className="mt-2 font-semibold text-gray-900 truncate">{farmerName} · {productName}</p>
                        <p className="text-sm text-gray-600">Quantity: {quantity} {order.unit || product?.unit || ""}</p>
                      </div>
                      <div className="text-sm sm:text-right text-gray-600">
                        <p><span className="font-semibold">Ordered:</span> {formatDate(order.createdAt)}</p>
                        <p className="mt-1"><span className="font-semibold">Completed:</span> {formatDate(order.completedAt)}</p>
                      </div>
                      <button type="button" onClick={() => setSelectedCompletedOrder(order)} className="shrink-0 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white hover:from-blue-700 hover:to-cyan-600 transition">
                        View Details →
                      </button>
                    </article>
                  );
                }

                return (
                  <article
                    key={
                      order.id
                    }
                    onClick={(event) => handleOrderCardClick(order, event)}
                    onMouseDown={(event) => startOrderLongPress(order, event)}
                    onMouseUp={stopOrderLongPress}
                    onMouseLeave={stopOrderLongPress}
                    onTouchStart={(event) => startOrderLongPress(order, event)}
                    onTouchEnd={stopOrderLongPress}
                    onTouchMove={stopOrderLongPress}
                    onContextMenu={(event) => {
                      if (statusFilter === "completed" && selectable) {
                        event.preventDefault();
                        setSelectionMode(true);
                        setSelectedOrderIds((currentIds) =>
                          currentIds.includes(order.id) ? currentIds : [...currentIds, order.id]
                        );
                      }
                    }}
                    className={`rounded-3xl border shadow-sm overflow-hidden transition ${
                      selected
                        ? "border-blue-600 bg-blue-50 ring-2 ring-blue-300"
                        : "border-blue-100 bg-white hover:shadow-md"
                    } ${selectable && statusFilter === "completed" ? "cursor-pointer" : ""}`}
                  >

                    <div className="p-5 md:p-6">

                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">

                        <div className="flex-1">

                          <div className="flex flex-wrap items-center gap-2">

                            {selected && (
                              <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-700 text-sm text-white">
                                ✓
                              </span>
                            )}
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                              Order
                            </span>

                            <span className="text-xs font-mono font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded-lg">
                              {orderId}
                            </span>

                            {renderStatus(
                              status
                            )}

                          </div>

                          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mt-3">
                            {productName}
                          </h2>

                          <p className="text-gray-500 mt-1">
                            Farmer:{" "}
                            <span className="font-semibold text-gray-700">
                              {farmerName}
                            </span>
                          </p>

                        </div>

                        <div className="text-left lg:text-right">

                          <p className="text-xs text-gray-400">
                            Order Date
                          </p>

                          <p className="font-semibold text-gray-700 mt-1">
                            {formatDate(
                              order.createdAt
                            )}
                          </p>

                        </div>

                      </div>

                      {/* DETAILS */}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">

                        <InfoCard
                          label="Quantity"
                          value={`${quantity} ${
                            order.unit ||
                            product?.unit ||
                            ""
                          }`}
                        />

                        <InfoCard
                          label="Product / Subtotal"
                          value={formatCurrency(order.subtotalAmount ?? price * quantity)}
                        />

                        <InfoCard
                          label="Delivery Charges"
                          value={order.deliveryCharge !== undefined ? formatCurrency(order.deliveryCharge) : "Not set"}
                        />

                        <InfoCard
                          label="Total Amount"
                          value={formatCurrency(
                            totalAmount
                          )}
                        />

                        <InfoCard
                          label="Product ID"
                          value={
                            getOrderProductId(
                              order
                            ) ||
                            product?.id ||
                            "Not stored"
                          }
                        />

                      </div>

                      <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                        <h3 className="text-sm font-bold uppercase tracking-wide text-emerald-800">
                          Delivery Address
                        </h3>
                        <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-1 text-sm text-gray-700">
                          <p><span className="font-semibold">Farmer:</span> {address.name || farmerName}</p>
                          {address.address && <p><span className="font-semibold">Address:</span> {address.address}</p>}
                          <p><span className="font-semibold">Village:</span> {address.village || order.farmerVillage || "Not provided"}</p>
                          <p><span className="font-semibold">Mandal:</span> {address.mandal || order.farmerMandal || "Not provided"}</p>
                          <p><span className="font-semibold">District:</span> {address.district || order.farmerDistrict || "Not provided"}</p>
                          <p><span className="font-semibold">State:</span> {address.state || order.farmerState || "Not provided"}</p>
                          <p><span className="font-semibold">PIN:</span> {address.pincode || "Not provided"}</p>
                          <p><span className="font-semibold">Phone:</span> {address.phone || order.farmerPhone || "Not provided"}</p>
                        </div>
                        {!address.name && !address.address && !address.village && order.deliveryAddress && (
                          <p className="mt-2 text-sm text-gray-700"><span className="font-semibold">Saved address:</span> {order.deliveryAddress}</p>
                        )}
                      </div>

                      {/* PRODUCT STOCK */}

                      {product && (
                        <div className="mt-5 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-100 rounded-2xl p-4">

                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

                            <div>
                              <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                                Current Product Stock
                              </p>

                              <p className="text-sm text-blue-900 mt-1">
                                {product.productName ||
                                  product.name ||
                                  productName}
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-4 text-sm">

                              <div>
                                <span className="text-blue-600">
                                  Available:
                                </span>{" "}
                                <strong>
                                  {getProductQuantity(
                                    product
                                  )}
                                </strong>
                              </div>

                              <div>
                                <span className="text-blue-600">
                                  Reserved:
                                </span>{" "}
                                <strong>
                                  {getReservedQuantity(
                                    product
                                  )}
                                </strong>
                              </div>

                              <div>
                                <span className="text-blue-600">
                                  Sold:
                                </span>{" "}
                                <strong>
                                  {getSoldQuantity(
                                    product
                                  )}
                                </strong>
                              </div>

                            </div>

                          </div>

                        </div>
                      )}

                      {!product &&
                        status ===
                          "pending" && (
                          <div className="mt-5 bg-amber-50 border border-amber-200 rounded-2xl p-4">

                            <p className="font-semibold text-amber-900">
                              Product reference needs verification
                            </p>

                            <p className="text-sm text-amber-800 mt-1">
                              The order is visible, but the
                              matching product is not currently
                              available in the local product list.
                              The system will perform a fresh
                              database lookup when you accept it.
                            </p>

                          </div>
                        )}

                      {/* ACTIONS */}

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-6 pt-5 border-t border-gray-100">

                        <div className="text-sm text-gray-500">

                          {order.farmerEmail && (
                            <div>
                              Email:{" "}
                              <span className="font-medium text-gray-700">
                                {
                                  order.farmerEmail
                                }
                              </span>
                            </div>
                          )}

                          {order.farmerUid && (
                            <div className="mt-1">
                              Farmer UID:{" "}
                              <span className="font-mono text-xs text-gray-600">
                                {
                                  order.farmerUid
                                }
                              </span>
                            </div>
                          )}

                        </div>

                        <div className="flex justify-end">
                          {renderActions(
                            order
                          )}
                        </div>

                      </div>

                      {busy && (
                        <div className="mt-4 text-center text-sm text-blue-700 font-semibold">
                          Updating order...
                        </div>
                      )}

                    </div>

                  </article>
                );
              }
            )}

          </section>
        )}

        {selectedCompletedOrder && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 p-0 sm:p-5"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setSelectedCompletedOrder(null);
            }}
          >
            <section role="dialog" aria-modal="true" aria-labelledby="completed-order-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl">
              <header className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-3xl bg-gradient-to-r from-blue-700 to-cyan-500 p-5 text-white sm:p-6">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-100">Completed order</p>
                  <h2 id="completed-order-title" className="mt-1 break-all text-xl font-bold sm:text-2xl">{selectedCompletedOrder.orderId || selectedCompletedOrder.id}</h2>
                </div>
                <button type="button" autoFocus onClick={() => setSelectedCompletedOrder(null)} aria-label="Close order details" className="shrink-0 rounded-xl bg-white/15 px-3 py-2 font-semibold hover:bg-white/25">Close ✕</button>
              </header>

              <div className="space-y-5 p-5 sm:p-6">
                <div>
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-blue-800">Order and farmer</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoCard label="Order ID" value={selectedCompletedOrder.orderId || selectedCompletedOrder.id || "Not available"} />
                    <InfoCard label="Current status" value={getOrderStatus(selectedCompletedOrder)} />
                    <InfoCard label="Farmer name" value={selectedCompletedOrder.farmerName || selectedCompletedOrder.customerName || completedOrderAddress.name || "Not available"} />
                    <InfoCard label="Farmer email" value={selectedCompletedOrder.farmerEmail || "Not available"} />
                    <InfoCard label="Farmer UID" value={selectedCompletedOrder.farmerUid || "Not available"} />
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-blue-800">Product and payment</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoCard label="Product name" value={getOrderProductName(selectedCompletedOrder) || completedOrderProduct?.productName || completedOrderProduct?.name || "Unknown Product"} />
                    <InfoCard label="Product ID" value={getOrderProductId(selectedCompletedOrder) || completedOrderProduct?.id || "Not stored"} />
                    <InfoCard label="Category" value={selectedCompletedOrder.category || completedOrderProduct?.category || "Not available"} />
                    <InfoCard label="Quantity" value={`${getOrderQuantity(selectedCompletedOrder)} ${selectedCompletedOrder.unit || completedOrderProduct?.unit || ""}`} />
                    <InfoCard label="Unit" value={selectedCompletedOrder.unit || completedOrderProduct?.unit || "Not available"} />
                    <InfoCard label="Price per unit" value={formatCurrency(selectedCompletedOrder.price ?? completedOrderProduct?.price)} />
                    <InfoCard label="Total amount" value={formatCurrency(selectedCompletedOrder.totalAmount ?? selectedCompletedOrder.total ?? (Number(selectedCompletedOrder.price ?? completedOrderProduct?.price ?? 0) * getOrderQuantity(selectedCompletedOrder)))} />
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-emerald-800">Delivery address</h3>
                  <div className="mt-2 grid gap-1 text-sm text-gray-700 sm:grid-cols-2">
                    <p><span className="font-semibold">Name:</span> {completedOrderAddress.name || selectedCompletedOrder.farmerName || selectedCompletedOrder.customerName || "Not provided"}</p>
                    <p><span className="font-semibold">Address:</span> {completedOrderAddress.address || selectedCompletedOrder.deliveryAddress || "Not provided"}</p>
                    <p><span className="font-semibold">Village:</span> {completedOrderAddress.village || selectedCompletedOrder.farmerVillage || "Not provided"}</p>
                    <p><span className="font-semibold">Mandal:</span> {completedOrderAddress.mandal || selectedCompletedOrder.farmerMandal || "Not provided"}</p>
                    <p><span className="font-semibold">District:</span> {completedOrderAddress.district || selectedCompletedOrder.farmerDistrict || "Not provided"}</p>
                    <p><span className="font-semibold">State:</span> {completedOrderAddress.state || selectedCompletedOrder.farmerState || "Not provided"}</p>
                    <p><span className="font-semibold">PIN:</span> {completedOrderAddress.pincode || "Not provided"}</p>
                    <p><span className="font-semibold">Phone:</span> {completedOrderAddress.phone || selectedCompletedOrder.farmerPhone || "Not provided"}</p>
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-blue-800">Order timeline</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoCard label="Order date" value={formatDate(selectedCompletedOrder.createdAt)} />
                    <InfoCard label="Accepted date" value={formatDate(selectedCompletedOrder.acceptedAt)} />
                    <InfoCard label="Delivered date" value={formatDate(selectedCompletedOrder.deliveredAt || selectedCompletedOrder.deliveryAt)} />
                    <InfoCard label="Farmer received date" value={formatDate(selectedCompletedOrder.farmerReceivedAt || selectedCompletedOrder.receivedAt)} />
                    <InfoCard label="Payment received date" value={formatDate(selectedCompletedOrder.paymentReceivedAt || selectedCompletedOrder.dealerPaymentReceivedAt)} />
                    <InfoCard label="Completed date" value={formatDate(selectedCompletedOrder.completedAt)} />
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* =================================================
            FOOTER
        ================================================== */}

        <footer className="text-center py-8 text-sm text-gray-400">
          AgriSaathi · Dealer Orders
        </footer>

      </div>
    </div>
  );
}

/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  label,
  value,
  active,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        active
          ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-blue-600 shadow-md"
          : "bg-white text-gray-800 border-blue-100 hover:border-blue-300 hover:shadow-sm"
      }`}
    >
      <p
        className={`text-xs font-semibold ${
          active
            ? "text-blue-50"
            : "text-gray-500"
        }`}
      >
        {label}
      </p>

      <p className="text-2xl font-bold mt-1">
        {value}
      </p>
    </button>
  );
}

/* =========================================================
   INFO CARD
========================================================= */

function InfoCard({
  label,
  value,
}) {
  return (
    <div className="bg-gradient-to-br from-gray-50 to-blue-50/40 border border-blue-100 rounded-xl p-4">
      <p className="text-xs text-gray-400">
        {label}
      </p>

      <p className="font-bold text-gray-800 mt-1 break-words">
        {value}
      </p>
    </div>
  );
}
