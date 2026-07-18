import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ref, get, update } from "firebase/database";
import { auth, database } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";

export default function DealerOrdersPage() {
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadOrders();
  }, []);

  function showMessage(type, text) {
    setMessage({ type, text });

    setTimeout(() => {
      setMessage(null);
    }, 5000);
  }

  async function loadOrders() {
    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        navigate("/login");
        return;
      }

      const snapshot = await get(ref(database, "dealerOrders"));

      if (!snapshot.exists()) {
        setOrders([]);
        return;
      }

      const data = snapshot.val();

      const list = Object.entries(data)
        .map(([id, value]) => ({
          id,
          ...value,
        }))
        .filter((order) => order.dealerUid === currentUser.uid)
        .reverse();

      setOrders(list);
    } catch (error) {
      console.error(error);
      showMessage("error", "Failed to load dealer orders.");
    } finally {
      setLoading(false);
    }
  }

  async function updateOrder(orderId, updates, successMessage) {
    try {
      await update(ref(database, `dealerOrders/${orderId}`), {
        ...updates,
        updatedAt: new Date().toISOString(),
      });

      showMessage("success", successMessage);
      loadOrders();
    } catch (error) {
      console.error(error);
      showMessage("error", "Failed to update order.");
    }
  }

  function acceptOrder(orderId) {
    updateOrder(
      orderId,
      {
        status: "accepted",
        dealerAcceptedAt: new Date().toISOString(),
      },
      "Order accepted. Farmer can contact you directly and payment will be Cash on Delivery."
    );
  }

  function rejectOrder(orderId) {
    updateOrder(
      orderId,
      {
        status: "rejected",
        rejectedAt: new Date().toISOString(),
      },
      "Order rejected."
    );
  }

  function markDelivered(orderId) {
    updateOrder(
      orderId,
      {
        status: "delivered_by_dealer",
        dealerDelivered: true,
        dealerDeliveredAt: new Date().toISOString(),
      },
      "Delivery marked by dealer. Waiting for farmer to confirm product received."
    );
  }

  function confirmPaymentReceived(order) {
    const farmerReceived = Boolean(order.farmerReceived);

    updateOrder(
      order.id,
      {
        dealerPaymentReceived: true,
        dealerPaymentReceivedAt: new Date().toISOString(),
        status: farmerReceived ? "completed" : "payment_received",
        completedAt: farmerReceived ? new Date().toISOString() : "",
      },
      farmerReceived
        ? "Payment received and farmer already confirmed delivery. Order completed."
        : "Payment received. Waiting for farmer delivery confirmation."
    );
  }

  function getStatusClass(status) {
    if (status === "pending") return "bg-yellow-100 text-yellow-700";
    if (status === "accepted") return "bg-blue-100 text-blue-700";
    if (status === "delivered_by_dealer") return "bg-purple-100 text-purple-700";
    if (status === "received_by_farmer") return "bg-indigo-100 text-indigo-700";
    if (status === "payment_received") return "bg-orange-100 text-orange-700";
    if (status === "completed") return "bg-green-100 text-green-700";
    if (status === "rejected") return "bg-red-100 text-red-700";

    return "bg-gray-100 text-gray-700";
  }

  function getStatusLabel(status) {
    const labels = {
      pending: "Pending",
      accepted: "Accepted by Dealer",
      rejected: "Rejected",
      delivered_by_dealer: "Delivered by Dealer",
      received_by_farmer: "Received by Farmer",
      payment_received: "Payment Received",
      completed: "Completed",
    };

    return labels[status] || "Pending";
  }

  const totalOrders = orders.length;
  const pendingOrders = orders.filter((order) => order.status === "pending").length;
  const acceptedOrders = orders.filter((order) => order.status === "accepted").length;
  const completedOrders = orders.filter((order) => order.status === "completed").length;

  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center">
        <h1 className="text-2xl font-bold text-green-700">
          Loading orders...
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
            onClick={() => navigate("/dealer")}
            className="text-green-700 font-semibold mb-4"
          >
            ← Back to Dealer Dashboard
          </button>

          <h1 className="text-4xl font-bold text-green-700">
            🛒 Farmer Orders
          </h1>

          <p className="text-gray-600 mt-2">
            Accept orders, coordinate by phone, confirm delivery and confirm Cash on Delivery payment.
          </p>

          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl p-4 mt-4 text-sm">
            Workflow: Farmer request → Dealer accepts → Farmer contacts dealer → Dealer delivers → Farmer confirms received → Dealer confirms payment received → Completed.
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-5 mb-6">
          <div className="bg-white rounded-2xl shadow-lg p-5">
            <p className="text-gray-500 text-sm">Total Orders</p>
            <h2 className="text-3xl font-bold text-green-700">
              {totalOrders}
            </h2>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-5">
            <p className="text-gray-500 text-sm">Pending</p>
            <h2 className="text-3xl font-bold text-yellow-600">
              {pendingOrders}
            </h2>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-5">
            <p className="text-gray-500 text-sm">Accepted</p>
            <h2 className="text-3xl font-bold text-blue-600">
              {acceptedOrders}
            </h2>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-5">
            <p className="text-gray-500 text-sm">Completed</p>
            <h2 className="text-3xl font-bold text-green-700">
              {completedOrders}
            </h2>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-green-700 mb-4">
            Order List
          </h2>

          {orders.length === 0 ? (
            <p className="text-gray-600">
              No farmer orders found yet.
            </p>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div key={order.id} className="border rounded-xl p-4">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-green-700">
                        {order.productName || "Product"}
                      </h3>

                      <p className="text-sm text-gray-600 mt-1">
                        Farmer: {order.farmerName || "Not available"}
                      </p>

                      <p className="text-sm text-gray-600">
                        Farmer Phone: {order.farmerPhone || "Not available"}
                      </p>

                      {order.farmerPhone && (
                        <a
                          href={`tel:${order.farmerPhone}`}
                          className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold mt-2"
                        >
                          📞 Call Farmer
                        </a>
                      )}

                      <p className="text-sm text-gray-600 mt-2">
                        Quantity: {order.quantity || 0} {order.unit || ""}
                      </p>

                      <p className="text-sm text-gray-600">
                        Total Amount: ₹{order.totalAmount || 0}
                      </p>

                      <p className="text-sm text-gray-600">
                        Payment Mode: {order.paymentMode || "Cash on Delivery"}
                      </p>

                      <p className="text-sm text-gray-600">
                        Address: {order.deliveryAddress || "Not available"}
                      </p>

                      <p className="text-sm text-gray-500 mt-1">
                        Ordered At:{" "}
                        {order.createdAt
                          ? new Date(order.createdAt).toLocaleString()
                          : "Not available"}
                      </p>

                      <span
                        className={`inline-block mt-3 px-3 py-1 rounded-full text-xs font-semibold ${getStatusClass(
                          order.status
                        )}`}
                      >
                        {getStatusLabel(order.status)}
                      </span>

                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mt-4 text-sm">
                        <p>
                          Farmer Received Product:{" "}
                          <b>{order.farmerReceived ? "Yes" : "No"}</b>
                        </p>

                        <p>
                          Dealer Received Payment:{" "}
                          <b>{order.dealerPaymentReceived ? "Yes" : "No"}</b>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(order.status || "pending") === "pending" && (
                        <>
                          <button
                            onClick={() => acceptOrder(order.id)}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg"
                          >
                            Accept
                          </button>

                          <button
                            onClick={() => rejectOrder(order.id)}
                            className="bg-red-600 text-white px-4 py-2 rounded-lg"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {order.status === "accepted" && (
                        <button
                          onClick={() => markDelivered(order.id)}
                          className="bg-purple-600 text-white px-4 py-2 rounded-lg"
                        >
                          Mark Delivered
                        </button>
                      )}

                      {(order.status === "delivered_by_dealer" ||
                        order.status === "received_by_farmer" ||
                        order.status === "payment_received") &&
                        !order.dealerPaymentReceived && (
                          <button
                            onClick={() => confirmPaymentReceived(order)}
                            className="bg-green-700 text-white px-4 py-2 rounded-lg"
                          >
                            Payment Received
                          </button>
                        )}

                      {order.status === "completed" && (
                        <span className="text-green-700 font-semibold">
                          Completed
                        </span>
                      )}

                      {order.status === "rejected" && (
                        <span className="text-red-700 font-semibold">
                          Rejected
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}