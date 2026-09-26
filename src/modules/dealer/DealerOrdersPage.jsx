import { useEffect, useMemo, useState } from "react";
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
            setLoading(false);

            navigate("/login", {
              replace: true,
            });

            return;
          }

          setCurrentUser(user);

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
     MARK DELIVERED
  ======================================================= */

  async function markDelivered(
    order
  ) {
    if (
      !order?.id ||
      processingOrderId
    ) {
      return;
    }

    const status =
      getOrderStatus(
        order
      );

    if (
      status !==
      "accepted"
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
            "delivered_by_dealer",

          [`dealerOrders/${order.id}/deliveredAt`]:
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
                      "delivered_by_dealer",
                    deliveredAt:
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
          "Order marked as delivered.",
      });
    } catch (error) {
      console.error(
        "Delivery update error:",
        error
      );

      setMessage({
        type: "error",
        text:
          "The order could not be marked as delivered.",
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

  async function markPaymentReceived(
    order
  ) {
    if (
      !order?.id ||
      processingOrderId
    ) {
      return;
    }

    const status =
      getOrderStatus(
        order
      );

    if (
      status !==
        "delivered_by_dealer" &&
      status !==
        "payment_pending"
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
            "payment_received",

          [`dealerOrders/${order.id}/dealerPaymentReceived`]:
            true,

          [`dealerOrders/${order.id}/dealerPaymentReceivedAt`]:
            now,

          [`dealerOrders/${order.id}/paymentReceivedAt`]:
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
                      "payment_received",
                    dealerPaymentReceived:
                      true,
                    dealerPaymentReceivedAt:
                      now,
                    paymentReceivedAt:
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
          "Payment completed. The order is now recorded in the farmer's history.",
      });
    } catch (error) {
      console.error(
        "Payment update error:",
        error
      );

      setMessage({
        type: "error",
        text:
          "Payment status could not be updated.",
      });
    } finally {
      setProcessingOrderId(
        null
      );
    }
  }

  /* =======================================================
     COMPLETE ORDER
  ======================================================= */

  async function completeOrder(
    order
  ) {
    if (
      !order?.id ||
      processingOrderId
    ) {
      return;
    }

    const status =
      getOrderStatus(
        order
      );

    if (
      status !==
      "payment_received"
    ) {
      return;
    }

    setProcessingOrderId(
      order.id
    );

    setMessage(null);

    try {
      const dealerUid =
        getOrderDealerUid(
          order
        ) ||
        currentUser?.uid;

      let productId =
        getOrderProductId(
          order
        );

      const quantity =
        getOrderQuantity(
          order
        );

      const now =
        new Date().toISOString();

      const updates = {};

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

      updates[
        `dealerOrders/${order.id}/status`
      ] = "completed";

      updates[
        `dealerOrders/${order.id}/completedAt`
      ] = now;

      updates[
        `dealerOrders/${order.id}/updatedAt`
      ] = now;

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

      await update(
        ref(database),
        updates
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
                      "completed",
                    completedAt:
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
          "Order completed successfully.",
      });
    } catch (error) {
      console.error(
        "Order completion error:",
        error
      );

      setMessage({
        type: "error",
        text:
          "The order could not be completed.",
      });
    } finally {
      setProcessingOrderId(
        null
      );
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
          const status =
            getOrderStatus(
              order
            );

          if (
            statusFilter !==
              "all" &&
            status !==
              statusFilter
          ) {
            return false;
          }

          if (!search) {
            return true;
          }

          const searchableText =
            [
              order.id,
              order.orderId,
              order.farmerUid,
              order.farmerName,
              order.customerName,
              order.farmerEmail,
              order.productName,
              order.product?.productName,
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
      searchTerm,
      statusFilter,
    ]);

  /* =======================================================
     COUNTS
  ======================================================= */

  const counts =
    useMemo(() => {
      const result = {
        all: orders.length,
        pending: 0,
        accepted: 0,
        rejected: 0,
        delivered_by_dealer: 0,
        payment_received: 0,
        completed: 0,
        cancelled: 0,
      };

      orders.forEach(
        (order) => {
          const status =
            getOrderStatus(
              order
            );

          if (
            Object.prototype.hasOwnProperty.call(
              result,
              status
            )
          ) {
            result[status]++;
          }
        }
      );

      return result;
    }, [orders]);

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

    if (
      status ===
      "accepted"
    ) {
      return (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            markDelivered(order)
          }
          className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-xl font-semibold disabled:opacity-50 transition"
        >
          {busy
            ? "Processing..."
            : "Mark Delivered"}
        </button>
      );
    }

    if (
      status ===
      "delivered_by_dealer"
    ) {
      return (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            markPaymentReceived(
              order
            )
          }
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl font-semibold disabled:opacity-50 transition"
        >
          {busy
            ? "Processing..."
            : "Payment Received"}
        </button>
      );
    }

    if (
      status ===
      "payment_received"
    ) {
      return (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            completeOrder(order)
          }
          className="bg-green-700 hover:bg-green-800 text-white px-4 py-2.5 rounded-xl font-semibold disabled:opacity-50 transition"
        >
          {busy
            ? "Processing..."
            : "Complete Order"}
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

      rejected:
        "bg-red-50 text-red-700 border-red-200",

      delivered_by_dealer:
        "bg-indigo-50 text-indigo-700 border-indigo-200",

      payment_received:
        "bg-purple-50 text-purple-700 border-purple-200",

      completed:
        "bg-green-50 text-green-700 border-green-200",

      cancelled:
        "bg-gray-100 text-gray-600 border-gray-200",
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

        <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">

          <SummaryCard
            label="All"
            value={
              counts.all
            }
            active={
              statusFilter ===
              "all"
            }
            onClick={() =>
              setStatusFilter(
                "all"
              )
            }
          />

          <SummaryCard
            label="Pending"
            value={
              counts.pending
            }
            active={
              statusFilter ===
              "pending"
            }
            onClick={() =>
              setStatusFilter(
                "pending"
              )
            }
          />

          <SummaryCard
            label="Accepted"
            value={
              counts.accepted
            }
            active={
              statusFilter ===
              "accepted"
            }
            onClick={() =>
              setStatusFilter(
                "accepted"
              )
            }
          />

          <SummaryCard
            label="Delivered"
            value={
              counts.delivered_by_dealer
            }
            active={
              statusFilter ===
              "delivered_by_dealer"
            }
            onClick={() =>
              setStatusFilter(
                "delivered_by_dealer"
              )
            }
          />

          <SummaryCard
            label="Payment"
            value={
              counts.payment_received
            }
            active={
              statusFilter ===
              "payment_received"
            }
            onClick={() =>
              setStatusFilter(
                "payment_received"
              )
            }
          />

          <SummaryCard
            label="Completed"
            value={
              counts.completed
            }
            active={
              statusFilter ===
              "completed"
            }
            onClick={() =>
              setStatusFilter(
                "completed"
              )
            }
          />

          <SummaryCard
            label="Rejected"
            value={
              counts.rejected
            }
            active={
              statusFilter ===
              "rejected"
            }
            onClick={() =>
              setStatusFilter(
                "rejected"
              )
            }
          />

        </section>

        {/* =================================================
            SEARCH
        ================================================== */}

        <section className="bg-white rounded-2xl border border-blue-100 shadow-sm p-5 mb-6">

          <div className="flex flex-col md:flex-row gap-4">

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
                onChange={(event) =>
                  setSearchTerm(
                    event.target.value
                  )
                }
                placeholder="Search farmer, product, order ID..."
                className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 transition"
              />
            </div>

            <div className="md:w-56">
              <label
                htmlFor="status-filter"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Status
              </label>

              <select
                id="status-filter"
                value={
                  statusFilter
                }
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
                className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 transition"
              >
                <option value="all">
                  All Orders
                </option>

                <option value="pending">
                  Pending
                </option>

                <option value="accepted">
                  Accepted
                </option>

                <option value="delivered_by_dealer">
                  Delivered
                </option>

                <option value="payment_received">
                  Payment Received
                </option>

                <option value="completed">
                  Completed
                </option>

                <option value="rejected">
                  Rejected
                </option>

                <option value="cancelled">
                  Cancelled
                </option>
              </select>
            </div>

          </div>

        </section>

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

                return (
                  <article
                    key={
                      order.id
                    }
                    className="bg-white rounded-3xl border border-blue-100 shadow-sm overflow-hidden hover:shadow-md transition"
                  >

                    <div className="p-5 md:p-6">

                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">

                        <div className="flex-1">

                          <div className="flex flex-wrap items-center gap-2">

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
                          label="Price"
                          value={formatCurrency(
                            price
                          )}
                        />

                        <InfoCard
                          label="Total"
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