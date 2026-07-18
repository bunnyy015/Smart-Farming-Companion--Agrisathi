import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { push, ref, set } from "firebase/database";
import { database } from "../../firebase";

export default function DealerRegistrationPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    dealerName: "",
    shopName: "",
    ownerName: "",
    email: "",
    phone: "",
    licenseNumber: "",
    gstNumber: "",
    district: "",
    state: "",
    address: "",
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  function handleChange(event) {
    setForm({
      ...form,
      [event.target.name]: event.target.value,
    });

    setErrorMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.dealerName.trim()) {
      setErrorMessage("Please enter dealer name.");
      return;
    }

    if (!form.shopName.trim()) {
      setErrorMessage("Please enter shop name.");
      return;
    }

    if (!form.ownerName.trim()) {
      setErrorMessage("Please enter owner name.");
      return;
    }

    if (!form.email.trim()) {
      setErrorMessage("Please enter email.");
      return;
    }

    if (!form.phone.trim()) {
      setErrorMessage("Please enter mobile number.");
      return;
    }

    if (!form.licenseNumber.trim()) {
      setErrorMessage("Please enter license number.");
      return;
    }

    if (!form.district.trim()) {
      setErrorMessage("Please enter district.");
      return;
    }

    if (!form.state.trim()) {
      setErrorMessage("Please enter state.");
      return;
    }

    try {
      setLoading(true);

      const requestRef = push(
        ref(database, "dealerRequests")
      );

      await set(requestRef, {
        ...form,
        role: "dealer",
        status: "pending",
        createdAt: new Date().toISOString(),
      });

      alert(
        "Dealer registration request submitted successfully. Please wait for Admin approval."
      );

      navigate("/login");
    } catch (error) {
      console.error(error);
      setErrorMessage(
        "Failed to submit request. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-lg p-6">

        <h1 className="text-3xl font-bold text-green-700 text-center">
          🏪 Dealer Registration Request
        </h1>

        <p className="text-gray-600 text-center mt-2 mb-6">
          Submit your request for Admin approval
        </p>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >

          <input
            name="dealerName"
            placeholder="Dealer Name"
            value={form.dealerName}
            onChange={handleChange}
            className="w-full border rounded-lg px-4 py-3"
          />

          <input
            name="shopName"
            placeholder="Shop Name"
            value={form.shopName}
            onChange={handleChange}
            className="w-full border rounded-lg px-4 py-3"
          />

          <input
            name="ownerName"
            placeholder="Owner Name"
            value={form.ownerName}
            onChange={handleChange}
            className="w-full border rounded-lg px-4 py-3"
          />

          <input
            name="email"
            type="email"
            placeholder="Business Email"
            value={form.email}
            onChange={handleChange}
            className="w-full border rounded-lg px-4 py-3"
          />

          <input
            name="phone"
            placeholder="Mobile Number"
            value={form.phone}
            onChange={handleChange}
            className="w-full border rounded-lg px-4 py-3"
          />

          <input
            name="licenseNumber"
            placeholder="Seed/Fertilizer License Number"
            value={form.licenseNumber}
            onChange={handleChange}
            className="w-full border rounded-lg px-4 py-3"
          />

          <input
            name="gstNumber"
            placeholder="GST Number (Optional)"
            value={form.gstNumber}
            onChange={handleChange}
            className="w-full border rounded-lg px-4 py-3"
          />

          <input
            name="district"
            placeholder="District"
            value={form.district}
            onChange={handleChange}
            className="w-full border rounded-lg px-4 py-3"
          />

          <input
            name="state"
            placeholder="State"
            value={form.state}
            onChange={handleChange}
            className="w-full border rounded-lg px-4 py-3"
          />

          <textarea
            name="address"
            placeholder="Shop Address"
            value={form.address}
            onChange={handleChange}
            rows="4"
            className="w-full border rounded-lg px-4 py-3"
          />

          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-700 text-white py-3 rounded-lg font-semibold"
          >
            {loading
              ? "Submitting..."
              : "Request Admin Approval"}
          </button>

        </form>

        <button
          onClick={() => navigate("/login")}
          className="w-full mt-4 text-green-700 font-semibold"
        >
          Back to Login
        </button>

      </div>
    </div>
  );
}