import { useEffect, useMemo, useState } from "react";
import { onValue, ref, remove, update } from "firebase/database";
import { database } from "../../firebase";

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function formatDate(value) {
  if (!value) return "N/A";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

function getOrderStatus(order) {
  const status = normalize(
    order?.status ||
    order?.orderStatus ||
    order?.order_status ||
    "pending"
  );

  // No status → Pending
  if (!status) return "pending";

  // Rejected → Cancelled
  if (
    status === "rejected" ||
    status === "reject" ||
    status === "cancel"
  ) {
    return "cancelled";
  }

  // Delivered
  if (
    status === "delivered" ||
    status === "delivery" ||
    status === "completed" ||
    status === "complete"
  ) {
    return "delivered";
  }

  // Processing
  if (
    status === "processing" ||
    status === "in progress" ||
    status === "inprogress" ||
    status === "shipped" ||
    status === "out for delivery"
  ) {
    return "processing";
  }

  // Pending
  if (
    status === "pending" ||
    status === "placed" ||
    status === "new" ||
    status === "confirmed"
  ) {
    return "pending";
  }

  return status;
}

export default function AdminOrderManagementPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  // Read orders from Firebase in realtime
  useEffect(() => {
    let dealerOrdersData = null;
    let ordersData = null;

    const buildOrderList = (data, sourcePath) => {
      if (!data || typeof data !== "object") return [];

      return Object.entries(data).map(([orderId, order]) => ({
        id: orderId,
        ...(order || {}),
        _sourcePath: sourcePath,
      }));
    };

    const updateOrdersList = () => {
      let orderList = [];

      if (
        dealerOrdersData &&
        typeof dealerOrdersData === "object" &&
        Object.keys(dealerOrdersData).length > 0
      ) {
        orderList = buildOrderList(
          dealerOrdersData,
          "dealerOrders"
        );
      } else if (
        ordersData &&
        typeof ordersData === "object" &&
        Object.keys(ordersData).length > 0
      ) {
        orderList = buildOrderList(
          ordersData,
          "orders"
        );
      }

      orderList.sort((a, b) => {
        const dateA = new Date(
          a.createdAt || 0
        ).getTime();

        const dateB = new Date(
          b.createdAt || 0
        ).getTime();

        return dateB - dateA;
      });

      setOrders(orderList);
      setLoading(false);
    };

    const unsubscribeDealerOrders = onValue(
      ref(database, "dealerOrders"),
      (snapshot) => {
        dealerOrdersData = snapshot.exists()
          ? snapshot.val()
          : null;

        updateOrdersList();
      },
      (error) => {
        console.error(
          "Error loading dealerOrders:",
          error
        );

        dealerOrdersData = null;
        updateOrdersList();
      }
    );

    const unsubscribeOrders = onValue(
      ref(database, "orders"),
      (snapshot) => {
        ordersData = snapshot.exists()
          ? snapshot.val()
          : null;

        updateOrdersList();
      },
      (error) => {
        console.error(
          "Error loading orders:",
          error
        );

        ordersData = null;
        updateOrdersList();
      }
    );

    return () => {
      unsubscribeDealerOrders();
      unsubscribeOrders();
    };
  }, []);

  // Order counts
  const totalOrders = orders.length;

  const pendingOrders = orders.filter(
    (order) =>
      getOrderStatus(order) === "pending"
  ).length;

  const processingOrders = orders.filter(
    (order) =>
      getOrderStatus(order) === "processing"
  ).length;

  const deliveredOrders = orders.filter(
    (order) =>
      getOrderStatus(order) === "delivered"
  ).length;

  const cancelledOrders = orders.filter(
    (order) =>
      getOrderStatus(order) === "cancelled"
  ).length;

  // Search + filter
  const filteredOrders = useMemo(() => {
    const searchText = normalize(search);

    return orders.filter((order) => {
      const status = getOrderStatus(order);

      const matchesStatus =
        !statusFilter ||
        (statusFilter === "completed" ? status === "delivered" : status === statusFilter);

      const searchableText = [
        order.id,
        order.orderId,
        order.farmerName,
        order.farmerId,
        order.productName,
        order.productId,
        order.phone,
        order.mobile,
        order.dealerName,
        order.dealerId,
        order.status,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !searchText ||
        searchableText.includes(searchText);

      const dateValue = status === "cancelled"
        ? order.cancelledAt || order.updatedAt || order.createdAt
        : status === "delivered"
          ? order.completedAt || order.updatedAt || order.createdAt
          : order.createdAt || order.updatedAt;
      const timestamp = dateValue ? new Date(dateValue).getTime() : NaN;
      const start = historyStartDate ? new Date(`${historyStartDate}T00:00:00`).getTime() : -Infinity;
      const end = historyEndDate ? new Date(`${historyEndDate}T23:59:59.999`).getTime() : Infinity;
      const matchesDate = !historyStartDate && !historyEndDate
        ? true
        : Number.isFinite(timestamp) && timestamp >= start && timestamp <= end;

      return matchesStatus && matchesSearch && matchesDate;
    });
  }, [orders, search, statusFilter, historyStartDate, historyEndDate]);

  // Update order status
  const handleStatusChange = async (
    orderId,
    newStatus
  ) => {
    try {
      setUpdatingId(orderId);

      const selectedOrder = orders.find(
        (order) => order.id === orderId
      );

      const sourcePath =
        selectedOrder?._sourcePath ||
        "dealerOrders";

      await update(
        ref(
          database,
          `${sourcePath}/${orderId}`
        ),
        {
          status: newStatus,
          updatedAt:
            new Date().toISOString(),
        }
      );
    } catch (error) {
      console.error(
        "Error updating order:",
        error
      );

      alert(
        "Failed to update order status."
      );
    } finally {
      setUpdatingId(null);
    }
  };

  // Delete order
  const handleDelete = async (orderId) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this order?"
    );

    if (!confirmDelete) return;

    try {
      const selectedOrder = orders.find(
        (order) => order.id === orderId
      );

      const sourcePath =
        selectedOrder?._sourcePath ||
        "dealerOrders";

      await remove(
        ref(
          database,
          `${sourcePath}/${orderId}`
        )
      );
    } catch (error) {
      console.error(
        "Error deleting order:",
        error
      );

      alert("Failed to delete order.");
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case "pending":
        return "status pending";

      case "processing":
        return "status processing";

      case "delivered":
        return "status delivered";

      case "cancelled":
        return "status cancelled";

      default:
        return "status";
    }
  };

  return (
    <div className="admin-orders-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .admin-orders-page {
          min-height: 100vh;
          background: #f5f7fb;
          padding: 30px;
          font-family: Arial, sans-serif;
          color: #1f2937;
        }

        .orders-container {
          max-width: 1400px;
          margin: 0 auto;
        }

        .page-header {
          background: linear-gradient(
            135deg,
            #24205f,
            #8b00e8
          );
          color: white;
          border-radius: 20px;
          padding: 28px 32px;
          margin-bottom: 25px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 8px 25px rgba(0,0,0,0.12);
        }

        .page-header h1 {
          margin: 0 0 7px;
          font-size: 30px;
        }

        .page-header p {
          margin: 0;
          opacity: 0.9;
        }

        .back-button {
          border: none;
          background: white;
          color: #4c1d95;
          padding: 11px 18px;
          border-radius: 10px;
          cursor: pointer;
          font-weight: bold;
        }

        .back-button:hover {
          opacity: 0.9;
        }

        .stats-grid {
          display: grid;
          grid-template-columns:
            repeat(5, 1fr);
          gap: 18px;
          margin-bottom: 25px;
        }

        .stat-card {
          background: white;
          border-radius: 15px;
          padding: 20px;
          box-shadow:
            0 4px 15px rgba(0,0,0,0.07);
          border: 1px solid #e5e7eb;
        }

        .stat-card h3 {
          margin: 0 0 10px;
          font-size: 15px;
          color: #6b7280;
        }

        .stat-number {
          font-size: 30px;
          font-weight: bold;
        }

        .filters {
          background: white;
          padding: 20px;
          border-radius: 15px;
          margin-bottom: 20px;
          display: flex;
          gap: 15px;
          flex-wrap: wrap;
          box-shadow:
            0 4px 15px rgba(0,0,0,0.06);
        }

        .search-input {
          flex: 1;
          min-width: 250px;
          padding: 12px 15px;
          border: 1px solid #d1d5db;
          border-radius: 9px;
          font-size: 15px;
          outline: none;
        }

        .search-input:focus {
          border-color: #7c3aed;
        }

        .filter-select {
          padding: 12px 15px;
          border: 1px solid #d1d5db;
          border-radius: 9px;
          background: white;
          min-width: 180px;
          font-size: 15px;
        }

        .orders-card {
          background: white;
          border-radius: 15px;
          padding: 20px;
          box-shadow:
            0 4px 15px rgba(0,0,0,0.06);
          overflow-x: auto;
        }

        .orders-title {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 18px;
        }

        .orders-title h2 {
          margin: 0;
        }

        .order-count {
          color: #6b7280;
          font-size: 14px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1000px;
        }

        th {
          background: #f8fafc;
          text-align: left;
          padding: 14px;
          font-size: 14px;
          color: #475569;
          border-bottom:
            1px solid #e5e7eb;
        }

        td {
          padding: 15px 14px;
          border-bottom:
            1px solid #eef0f3;
          font-size: 14px;
          vertical-align: middle;
        }

        tr:hover {
          background: #fafafa;
        }

        .order-id {
          font-weight: bold;
          color: #4f46e5;
        }

        .product-name {
          font-weight: 600;
        }

        .amount {
          font-weight: bold;
        }

        .status {
          display: inline-block;
          padding: 6px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: bold;
          background: #e5e7eb;
          color: #374151;
        }

        .status.pending {
          background: #fff7ed;
          color: #c2410c;
        }

        .status.processing {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .status.delivered {
          background: #ecfdf5;
          color: #047857;
        }

        .status.cancelled {
          background: #fef2f2;
          color: #dc2626;
        }

        .status-select {
          padding: 7px 9px;
          border: 1px solid #d1d5db;
          border-radius: 7px;
          background: white;
        }

        .delete-button {
          border: none;
          background: #fee2e2;
          color: #dc2626;
          padding: 8px 12px;
          border-radius: 7px;
          cursor: pointer;
          font-weight: bold;
        }

        .delete-button:hover {
          background: #fecaca;
        }

        .empty-state {
          text-align: center;
          padding: 50px 20px;
          color: #6b7280;
        }

        .loading {
          text-align: center;
          padding: 50px;
          color: #6b7280;
        }

        @media (max-width: 1000px) {
          .stats-grid {
            grid-template-columns:
              repeat(2, 1fr);
          }

          .page-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 15px;
          }
        }

        @media (max-width: 600px) {
          .admin-orders-page {
            padding: 15px;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="orders-container">

        {/* Header */}
        <div className="page-header">
          <div>
            <h1>
              📦 Admin Order Management
            </h1>

            <p>
              Manage and monitor all farmer orders
            </p>
          </div>

          <button
            className="back-button"
            onClick={() =>
              window.history.back()
            }
          >
            <option value="" disabled>
              Filter by status
            </option>
            ← Back
          </button>
        </div>

        {/* Statistics */}
        <div className="stats-grid">

          <div className="stat-card">
            <h3>Total Orders</h3>

            <div className="stat-number">
              {totalOrders}
            </div>
          </div>

          <div className="stat-card">
            <h3>Pending</h3>

            <div className="stat-number">
              {pendingOrders}
            </div>
          </div>

          <div className="stat-card">
            <h3>Processing</h3>

            <div className="stat-number">
              {processingOrders}
            </div>
          </div>

          <div className="stat-card">
            <h3>Delivered</h3>

            <div className="stat-number">
              {deliveredOrders}
            </div>
          </div>

          <div className="stat-card">
            <h3>Cancelled</h3>

            <div className="stat-number">
              {cancelledOrders}
            </div>
          </div>

        </div>

        {/* Search & Filter */}
        <div className="filters">

          <input
            type="text"
            className="search-input"
            placeholder="Search by farmer, product, phone or order ID..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
          />

          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value)
            }
          >
            <option value="" disabled>
              Filter by status
            </option>

            <option value="pending">
              Pending
            </option>

            <option value="processing">
              Processing
            </option>

            <option value="delivered">
              Delivered
            </option>

            <option value="completed">
              Completed
            </option>

            <option value="cancelled">
              Cancelled
            </option>
          </select>

          <label className="filter-select">
            From date
            <input
              type="date"
              value={historyStartDate}
              max={historyEndDate || undefined}
              onChange={(event) => setHistoryStartDate(event.target.value)}
              aria-label="Filter orders from date"
            />
          </label>

          <label className="filter-select">
            To date
            <input
              type="date"
              value={historyEndDate}
              min={historyStartDate || undefined}
              onChange={(event) => setHistoryEndDate(event.target.value)}
              aria-label="Filter orders to date"
            />
          </label>

        </div>

        {/* Orders */}
        <div className="orders-card">

          <div className="orders-title">
            <h2>All Orders</h2>

            <span className="order-count">
              Showing {filteredOrders.length} of{" "}
              {totalOrders} orders
            </span>
          </div>

          {loading ? (
            <div className="loading">
              Loading orders...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="empty-state">

              <h3>
                No orders found
              </h3>

              <p>
                There are no orders matching
                your search or filter.
              </p>

            </div>
          ) : (
            <table>

              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Farmer</th>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Amount</th>
                  <th>Phone</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Update</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>

                {filteredOrders.map(
                  (order) => {
                    const status =
                      getOrderStatus(order);

                    return (
                      <tr key={order.id}>

                        <td>
                          <span className="order-id">
                            {order.orderId ||
                              order.id}
                          </span>
                        </td>

                        <td>
                          <strong>
                            {order.farmerName ||
                              "Unknown Farmer"}
                          </strong>

                          {order.farmerId && (
                            <div>
                              {order.farmerId}
                            </div>
                          )}
                        </td>

                        <td>
                          <span className="product-name">
                            {order.productName ||
                              "Unknown Product"}
                          </span>

                          {order.productId && (
                            <div>
                              {order.productId}
                            </div>
                          )}
                        </td>

                        <td>
                          {order.quantity || 0}
                        </td>

                        <td>
                          <span className="amount">
                            ₹
                            {order.totalAmount ??
                              order.amount ??
                              0}
                          </span>
                        </td>

                        <td>
                          {order.phone ||
                            order.mobile ||
                            "N/A"}
                        </td>

                        <td>
                          {formatDate(
                            order.createdAt
                          )}
                        </td>

                        <td>
                          <span
                            className={getStatusClass(
                              status
                            )}
                          >
                            {status}
                          </span>
                        </td>

                        <td>
                          <select
                            className="status-select"
                            value={status}
                            disabled={
                              updatingId ===
                              order.id
                            }
                            onChange={(e) =>
                              handleStatusChange(
                                order.id,
                                e.target.value
                              )
                            }
                          >
                            <option value="pending">
                              Pending
                            </option>

                            <option value="processing">
                              Processing
                            </option>

                            <option value="delivered">
                              Delivered
                            </option>

                            <option value="cancelled">
                              Cancelled
                            </option>
                          </select>
                        </td>

                        <td>
                          <button
                            className="delete-button"
                            onClick={() =>
                              handleDelete(
                                order.id
                              )
                            }
                          >
                            Delete
                          </button>
                        </td>

                      </tr>
                    );
                  }
                )}

              </tbody>

            </table>
          )}

        </div>

      </div>
    </div>
  );
}
