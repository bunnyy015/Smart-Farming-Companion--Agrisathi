import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  equalTo,
  get,
  orderByChild,
  push,
  query,
  ref,
  runTransaction,
  set,
  update,
} from "firebase/database";
import { auth, database } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";

export default function DealerOrdersPage() {
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadOrders();
  }, []);

  function showMessage(type, text) {
    setMessage({ type, text });

    window.setTimeout(() => {
      setMessage(null);
    }, 5000);
  }

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  async function loadOrders() {
    setLoading(true);

    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        navigate("/login", { replace: true });
        return;
      }

      const ordersQuery = query(
        ref(database, "dealerOrders"),
        orderByChild("dealerUid"),
        equalTo(currentUser.uid)
      );

      const snapshot = await get(ordersQuery);

      if (!snapshot.exists()) {
        setOrders([]);
        return;
      }

      const list = Object.entries(snapshot.val())
        .map(([id, value]) => ({
          id,
          ...value,
        }))
        .sort(
          (first, second) =>
            new Date(second.createdAt || 0) -
            new Date(first.createdAt || 0)
        );

      setOrders(list);
    } catch (error) {
      console.error("Dealer orders error:", error);

      showMessage(
        "error",
        String(error?.message || "")
          .toLowerCase()
          .includes("permission denied")
          ? "Order access is blocked by Firebase rules."
          : "Orders could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  async function findOrderProduct(order) {
    const dealerUid = order.dealerUid;

    if (!dealerUid) {
      return null;
    }

    if (order.productId) {
      const directProductSnapshot = await get(
        ref(
          database,
          `dealerProducts/${dealerUid}/${order.productId}`
        )
      );

      if (directProductSnapshot.exists()) {
        return {
          id: order.productId,
          reference: ref(
            database,
            `dealerProducts/${dealerUid}/${order.productId}`
          ),
          data: directProductSnapshot.val(),
          recovered: false,
        };
      }
    }

    const dealerProductsSnapshot = await get(
      ref(database, `dealerProducts/${dealerUid}`)
    );

    if (!dealerProductsSnapshot.exists()) {
      return null;
    }

    const requestedName = normalizeText(order.productName);
    const requestedCategory = normalizeText(order.category);
    const requestedBrand = normalizeText(order.brand);
    const requestedUnit = normalizeText(order.unit);

    const dealerProducts = dealerProductsSnapshot.val();

    const exactMatch = Object.entries(dealerProducts).find(
      ([, product]) => {
        const sameName =
          normalizeText(product?.productName) === requestedName;

        const sameCategory =
          !requestedCategory ||
          normalizeText(product?.category) === requestedCategory;

        const sameBrand =
          !requestedBrand ||
          normalizeText(product?.brand) === requestedBrand;

        const sameUnit =
          !requestedUnit ||
          normalizeText(product?.unit) === requestedUnit;

        return (
          sameName &&
          sameCategory &&
          sameBrand &&
          sameUnit
        );
      }
    );

    const nameMatch =
      exactMatch ||
      Object.entries(dealerProducts).find(
        ([, product]) =>
          normalizeText(product?.productName) === requestedName
      );

    if (!nameMatch) {
      return null;
    }

    const [matchedProductId, matchedProduct] = nameMatch;

    return {
      id: matchedProductId,
      reference: ref(
        database,
        `dealerProducts/${dealerUid}/${matchedProductId}`
      ),
      data: matchedProduct,
      recovered: true,
    };
  }

  function openConfirmation(type, order) {
    setConfirmAction({
      type,
      order,
    });
  }

  function closeConfirmation() {
    if (updatingId) {
      return;
    }

    setConfirmAction(null);
  }

  async function acceptOrder(order) {
    if (order.status !== "pending") {
      showMessage(
        "warning",
        "Only pending orders can be accepted."
      );
      return;
    }

    try {
      setUpdatingId(order.id);

      const productMatch = await findOrderProduct(order);

      if (!productMatch) {
        showMessage(
          "warning",
          "This order refers to an old or deleted product. Add the product again with the same name, category and unit, then accept the order."
        );
        return;
      }

      const requiredQuantity = Number(order.quantity || 0);

      if (
        !Number.isInteger(requiredQuantity) ||
        requiredQuantity <= 0
      ) {
        showMessage(
          "error",
          "This order contains an invalid quantity."
        );
        return;
      }

      let failureReason = "";

      const transactionResult = await runTransaction(
        productMatch.reference,
        (product) => {
          if (!product) {
            failureReason = "missing";
            return;
          }

          const availableQuantity = Number(
            product.quantity || 0
          );

          if (availableQuantity < requiredQuantity) {
            failureReason = "insufficient";
            return;
          }

          const remainingQuantity =
            availableQuantity - requiredQuantity;

          return {
            ...product,

            quantity: remainingQuantity,

            reservedQuantity:
              Number(product.reservedQuantity || 0) +
              requiredQuantity,

            soldQuantity: Number(
              product.soldQuantity || 0
            ),

            status:
              remainingQuantity > 0
                ? "available"
                : "out_of_stock",

            updatedAt: new Date().toISOString(),
          };
        }
      );

      if (!transactionResult.committed) {
        showMessage(
          "warning",
          failureReason === "insufficient"
            ? `Not enough stock is available. The order needs ${requiredQuantity} ${order.unit || "units"}. Update stock or reject the order.`
            : "The product could not be found. Refresh the product list and try again."
        );
        return;
      }

      const now = new Date().toISOString();

      try {
        await update(
          ref(database, `dealerOrders/${order.id}`),
          {
            productId: productMatch.id,
            status: "accepted",
            stockReserved: true,
            reservedQuantity: requiredQuantity,
            dealerAcceptedAt: now,
            productRecovered:
              productMatch.recovered || false,
            updatedAt: now,
          }
        );
      } catch (orderUpdateError) {
        await runTransaction(
          productMatch.reference,
          (product) => {
            if (!product) {
              return product;
            }

            const restoredQuantity =
              Number(product.quantity || 0) +
              requiredQuantity;

            return {
              ...product,

              quantity: restoredQuantity,

              reservedQuantity: Math.max(
                0,
                Number(product.reservedQuantity || 0) -
                  requiredQuantity
              ),

              status:
                restoredQuantity > 0
                  ? "available"
                  : "out_of_stock",

              updatedAt: new Date().toISOString(),
            };
          }
        );

        throw orderUpdateError;
      }

      showMessage(
        "success",
        productMatch.recovered
          ? "Order accepted. The older order was linked to the matching current product and stock was reserved."
          : "Order accepted and stock was reserved."
      );

      setConfirmAction(null);
      await loadOrders();
    } catch (error) {
      console.error("Accept order error:", error);

      showMessage(
        "error",
        String(error?.message || "")
          .toLowerCase()
          .includes("permission denied")
          ? "Firebase denied the stock update. Check the latest database rules."
          : "Order could not be accepted."
      );
    } finally {
      setUpdatingId("");
    }
  }

  async function rejectOrder(order) {
    if (order.status !== "pending") {
      showMessage(
        "warning",
        "Only pending orders can be rejected."
      );
      return;
    }

    try {
      setUpdatingId(order.id);

      const now = new Date().toISOString();

      await update(
        ref(database, `dealerOrders/${order.id}`),
        {
          status: "rejected",
          rejectedBy: "dealer",
          rejectedAt: now,
          updatedAt: now,
        }
      );

      showMessage("success", "Order rejected.");

      setConfirmAction(null);
      await loadOrders();
    } catch (error) {
      console.error("Reject order error:", error);

      showMessage(
        "error",
        "Order could not be rejected."
      );
    } finally {
      setUpdatingId("");
    }
  }

  async function markDelivered(order) {
    if (order.status !== "accepted") {
      showMessage(
        "warning",
        "Only accepted orders can be marked as delivered."
      );
      return;
    }

    try {
      setUpdatingId(order.id);

      const now = new Date().toISOString();

      await update(
        ref(database, `dealerOrders/${order.id}`),
        {
          status: "delivered_by_dealer",
          dealerDelivered: true,
          dealerDeliveredAt: now,
          updatedAt: now,
        }
      );

      showMessage(
        "success",
        "Delivery marked. Waiting for the farmer to confirm receipt."
      );

      setConfirmAction(null);
      await loadOrders();
    } catch (error) {
      console.error("Delivery update error:", error);

      showMessage(
        "error",
        "Delivery status could not be updated."
      );
    } finally {
      setUpdatingId("");
    }
  }

  async function confirmPayment(order) {
    if (
      ![
        "delivered_by_dealer",
        "received_by_farmer",
        "payment_received",
      ].includes(order.status)
    ) {
      showMessage(
        "warning",
        "Mark the order as delivered before confirming payment."
      );
      return;
    }

    try {
      setUpdatingId(order.id);

      const now = new Date().toISOString();

      await update(
        ref(database, `dealerOrders/${order.id}`),
        {
          dealerPaymentReceived: true,
          dealerPaymentReceivedAt: now,
          status: "payment_received",
          updatedAt: now,
        }
      );

      showMessage(
        "success",
        order.farmerReceived
          ? "Payment confirmed. The sale is ready to complete."
          : "Payment confirmed. Waiting for farmer delivery confirmation."
      );

      setConfirmAction(null);
      await loadOrders();
    } catch (error) {
      console.error("Payment confirmation error:", error);

      showMessage(
        "error",
        "Payment could not be confirmed."
      );
    } finally {
      setUpdatingId("");
    }
  }

  async function completeSale(order) {
    if (
      !order.farmerReceived ||
      !order.dealerPaymentReceived
    ) {
      showMessage(
        "warning",
        "Farmer receipt and payment confirmation are required."
      );
      return;
    }

    if (order.status === "completed") {
      return;
    }

    try {
      setUpdatingId(order.id);

      const productMatch = await findOrderProduct(order);

      if (!productMatch) {
        showMessage(
          "error",
          "The linked product could not be found. Restore the product before completing this sale."
        );
        return;
      }

      const orderQuantity = Number(order.quantity || 0);
      let failureReason = "";

      const productResult = await runTransaction(
        productMatch.reference,
        (product) => {
          if (!product) {
            failureReason = "missing";
            return;
          }

          const reservedQuantity = Number(
            product.reservedQuantity || 0
          );

          if (reservedQuantity < orderQuantity) {
            failureReason = "reserved";
            return;
          }

          return {
            ...product,

            reservedQuantity:
              reservedQuantity - orderQuantity,

            soldQuantity:
              Number(product.soldQuantity || 0) +
              orderQuantity,

            updatedAt: new Date().toISOString(),
          };
        }
      );

      if (!productResult.committed) {
        showMessage(
          "error",
          failureReason === "reserved"
            ? "The reserved stock is lower than the order quantity. Check the product inventory."
            : "The product could not be found."
        );
        return;
      }

      const completedAt = new Date().toISOString();
      const saleReference = push(
        ref(database, `sales/${order.dealerUid}`)
      );

      try {
        await set(saleReference, {
          orderId: order.id,
          dealerUid: order.dealerUid,
          farmerUid: order.farmerUid,
          farmerName: order.farmerName || "Farmer",

          productId: productMatch.id,
          productName: order.productName || "",
          category: order.category || "",
          brand: order.brand || "",

          quantity: orderQuantity,
          unit: order.unit || "",

          price: Number(order.price || 0),
          totalAmount: Number(order.totalAmount || 0),

          paymentMode:
            order.paymentMode || "Cash on Delivery",

          completedAt,
          createdAt: completedAt,
        });

        await update(
          ref(database, `dealerOrders/${order.id}`),
          {
            productId: productMatch.id,
            status: "completed",
            saleRecorded: true,
            completedAt,
            updatedAt: completedAt,
          }
        );
      } catch (completionError) {
        await runTransaction(
          productMatch.reference,
          (product) => {
            if (!product) {
              return product;
            }

            return {
              ...product,

              reservedQuantity:
                Number(product.reservedQuantity || 0) +
                orderQuantity,

              soldQuantity: Math.max(
                0,
                Number(product.soldQuantity || 0) -
                  orderQuantity
              ),

              updatedAt: new Date().toISOString(),
            };
          }
        );

        throw completionError;
      }

      showMessage(
        "success",
        "Sale completed and inventory updated."
      );

      setConfirmAction(null);
      await loadOrders();
    } catch (error) {
      console.error("Complete sale error:", error);

      showMessage(
        "error",
        "Sale could not be completed."
      );
    } finally {
      setUpdatingId("");
    }
  }

  function executeConfirmedAction() {
    if (!confirmAction) {
      return;
    }

    const { type, order } = confirmAction;

    if (type === "accept") {
      acceptOrder(order);
      return;
    }

    if (type === "reject") {
      rejectOrder(order);
      return;
    }

    if (type === "deliver") {
      markDelivered(order);
      return;
    }

    if (type === "payment") {
      confirmPayment(order);
      return;
    }

    if (type === "complete") {
      completeSale(order);
    }
  }

  function confirmationDetails() {
    if (!confirmAction) {
      return null;
    }

    const details = {
      accept: {
        icon: "✅",
        title: "Accept this order?",
        text: "The requested quantity will be moved from available stock to reserved stock.",
        buttonText: "Accept Order",
        buttonClass: "bg-blue-600 text-white",
      },

      reject: {
        icon: "❌",
        title: "Reject this order?",
        text: "The farmer will see that the request was rejected. Stock will not change.",
        buttonText: "Reject Order",
        buttonClass: "bg-red-600 text-white",
      },

      deliver: {
        icon: "🚚",
        title: "Mark product as delivered?",
        text: "The farmer will be asked to confirm that the product was received.",
        buttonText: "Mark Delivered",
        buttonClass: "bg-purple-600 text-white",
      },

      payment: {
        icon: "💵",
        title: "Confirm payment received?",
        text: "Use this only after receiving the Cash on Delivery payment.",
        buttonText: "Confirm Payment",
        buttonClass: "bg-orange-600 text-white",
      },

      complete: {
        icon: "🎉",
        title: "Complete this sale?",
        text: "Reserved stock will move to sold stock and the transaction will be recorded in sales.",
        buttonText: "Complete Sale",
        buttonClass: "bg-green-700 text-white",
      },
    };

    return details[confirmAction.type];
  }

  function statusStyle(status) {
    const styles = {
      pending: "bg-yellow-100 text-yellow-700",
      accepted: "bg-blue-100 text-blue-700",
      rejected: "bg-red-100 text-red-700",
      cancelled: "bg-gray-100 text-gray-700",
      delivered_by_dealer:
        "bg-purple-100 text-purple-700",
      received_by_farmer:
        "bg-indigo-100 text-indigo-700",
      payment_received:
        "bg-orange-100 text-orange-700",
      completed: "bg-green-100 text-green-700",
    };

    return styles[status] || styles.pending;
  }

  function statusLabel(status) {
    const labels = {
      pending: "Pending",
      accepted: "Accepted",
      rejected: "Rejected",
      cancelled: "Cancelled",
      delivered_by_dealer: "Delivery Marked",
      received_by_farmer: "Farmer Received",
      payment_received: "Payment Received",
      completed: "Completed",
    };

    return labels[status] || "Pending";
  }

  const confirmation = confirmationDetails();

  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow p-6 text-center">
          <div className="text-4xl">🛒</div>

          <p className="text-xl font-bold text-green-700 mt-3">
            Loading orders...
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

        {confirmAction && confirmation && (
          <section className="bg-white border border-gray-200 rounded-2xl shadow-lg p-5 mb-5">
            <div className="flex items-start gap-3">
              <span className="text-2xl">
                {confirmation.icon}
              </span>

              <div className="flex-1">
                <h2 className="text-lg font-bold text-gray-900">
                  {confirmation.title}
                </h2>

                <p className="text-sm text-gray-600 mt-1">
                  {confirmation.text}
                </p>

                <div className="bg-gray-50 rounded-xl p-3 mt-3 text-sm">
                  <p className="font-semibold text-green-800">
                    {confirmAction.order.productName}
                  </p>

                  <p className="text-gray-600 mt-1">
                    {confirmAction.order.quantity}{" "}
                    {confirmAction.order.unit || "units"} • ₹
                    {Number(
                      confirmAction.order.totalAmount || 0
                    ).toFixed(2)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 mt-4">
                  <button
                    type="button"
                    disabled={
                      updatingId === confirmAction.order.id
                    }
                    onClick={executeConfirmedAction}
                    className={`${confirmation.buttonClass} px-4 py-2.5 rounded-xl font-semibold disabled:bg-gray-400`}
                  >
                    {updatingId === confirmAction.order.id
                      ? "Please wait..."
                      : confirmation.buttonText}
                  </button>

                  <button
                    type="button"
                    disabled={Boolean(updatingId)}
                    onClick={closeConfirmation}
                    className="border border-gray-300 text-gray-700 px-4 py-2.5 rounded-xl font-semibold disabled:opacity-50"
                  >
                    Go Back
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        <header className="bg-white rounded-2xl shadow p-5 mb-5">
          <button
            type="button"
            onClick={() => navigate("/dealer")}
            className="text-green-700 font-semibold"
          >
            ← Dealer Dashboard
          </button>

          <h1 className="text-3xl font-bold text-green-800 mt-3">
            🛒 Farmer Orders
          </h1>

          <p className="text-gray-600 mt-2">
            Accept requests, deliver products and complete sales.
          </p>
        </header>

        {orders.length === 0 ? (
          <section className="bg-white rounded-2xl shadow p-8 text-center">
            <div className="text-4xl">🛒</div>

            <h2 className="text-xl font-bold text-green-800 mt-3">
              No farmer orders
            </h2>

            <p className="text-gray-600 mt-1">
              New requests will appear here.
            </p>
          </section>
        ) : (
          <section className="space-y-4">
            {orders.map((order) => {
              const updating = updatingId === order.id;
              const actionOpen =
                confirmAction?.order?.id === order.id;

              return (
                <article
                  key={order.id}
                  className={`bg-white rounded-2xl shadow p-5 ${
                    actionOpen
                      ? "ring-2 ring-green-500"
                      : ""
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-green-800">
                        {order.productName || "Farm Product"}
                      </h2>

                      <p className="text-sm text-gray-600 mt-1">
                        👨‍🌾{" "}
                        {order.farmerName || "Farmer"}
                      </p>

                      <p className="text-sm text-gray-600 mt-1">
                        📦 {order.quantity || 0}{" "}
                        {order.unit || "units"}
                      </p>

                      <p className="text-sm font-semibold text-gray-800 mt-1">
                        ₹
                        {Number(
                          order.totalAmount || 0
                        ).toFixed(2)}
                      </p>

                      <p className="text-sm text-gray-600 mt-2">
                        📍{" "}
                        {order.deliveryAddress ||
                          "Address not available"}
                      </p>

                      {order.farmerPhone && (
                        <a
                          href={`tel:${order.farmerPhone}`}
                          className="inline-block text-blue-700 font-semibold mt-2"
                        >
                          📞 Call Farmer
                        </a>
                      )}
                    </div>

                    <span
                      className={`${statusStyle(
                        order.status
                      )} px-3 py-1.5 rounded-full text-sm font-semibold self-start`}
                    >
                      {statusLabel(order.status)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 text-sm">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-gray-500">
                        Stock Reserved
                      </p>

                      <p className="font-bold mt-1">
                        {order.stockReserved ? "Yes" : "No"}
                      </p>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-gray-500">
                        Farmer Received
                      </p>

                      <p className="font-bold mt-1">
                        {order.farmerReceived ? "Yes" : "No"}
                      </p>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-gray-500">
                        Payment Received
                      </p>

                      <p className="font-bold mt-1">
                        {order.dealerPaymentReceived
                          ? "Yes"
                          : "No"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 mt-5">
                    {order.status === "pending" && (
                      <>
                        <button
                          type="button"
                          disabled={updating}
                          onClick={() =>
                            openConfirmation("accept", order)
                          }
                          className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold disabled:bg-gray-400"
                        >
                          Accept
                        </button>

                        <button
                          type="button"
                          disabled={updating}
                          onClick={() =>
                            openConfirmation("reject", order)
                          }
                          className="border border-red-600 text-red-700 px-4 py-2.5 rounded-xl font-semibold disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </>
                    )}

                    {order.status === "accepted" && (
                      <button
                        type="button"
                        disabled={updating}
                        onClick={() =>
                          openConfirmation("deliver", order)
                        }
                        className="bg-purple-600 text-white px-4 py-2.5 rounded-xl font-semibold disabled:bg-gray-400"
                      >
                        Mark Delivered
                      </button>
                    )}

                    {[
                      "delivered_by_dealer",
                      "received_by_farmer",
                    ].includes(order.status) &&
                      !order.dealerPaymentReceived && (
                        <button
                          type="button"
                          disabled={updating}
                          onClick={() =>
                            openConfirmation("payment", order)
                          }
                          className="bg-orange-600 text-white px-4 py-2.5 rounded-xl font-semibold disabled:bg-gray-400"
                        >
                          Payment Received
                        </button>
                      )}

                    {order.farmerReceived &&
                      order.dealerPaymentReceived &&
                      order.status !== "completed" && (
                        <button
                          type="button"
                          disabled={updating}
                          onClick={() =>
                            openConfirmation("complete", order)
                          }
                          className="bg-green-700 text-white px-4 py-2.5 rounded-xl font-semibold disabled:bg-gray-400"
                        >
                          Complete Sale
                        </button>
                      )}

                    {order.status === "completed" && (
                      <span className="bg-green-50 text-green-700 px-4 py-2.5 rounded-xl font-bold">
                        ✅ Sale Completed
                      </span>
                    )}

                    {order.status === "rejected" && (
                      <span className="bg-red-50 text-red-700 px-4 py-2.5 rounded-xl font-bold">
                        Order Rejected
                      </span>
                    )}

                    {order.status === "cancelled" && (
                      <span className="bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl font-bold">
                        Cancelled by Farmer
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}