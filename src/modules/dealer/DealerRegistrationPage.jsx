import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  setPersistence,
  signOut,
} from "firebase/auth";
import { ref, set } from "firebase/database";
import { auth, database } from "../../firebase";
import "./DealerTheme.css";

export default function DealerRegistrationPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    dealerName: "",
    shopName: "",
    ownerName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    licenseNumber: "",
    gstNumber: "",
    district: "",
    state: "",
    address: "",
  });

  const [loading, setLoading] = useState(false);

  function handleChange(event) {
    setForm({
      ...form,
      [event.target.name]: event.target.value,
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.dealerName.trim()) {
      alert("Please enter dealer name.");
      return;
    }

    if (!form.shopName.trim()) {
      alert("Please enter shop name.");
      return;
    }

    if (!form.ownerName.trim()) {
      alert("Please enter owner name.");
      return;
    }

    if (!form.email.trim()) {
      alert("Please enter business email.");
      return;
    }

    if (!form.password.trim()) {
      alert("Please create a password.");
      return;
    }

    if (form.password.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      alert("Password and confirm password do not match.");
      return;
    }

    if (!form.phone.trim()) {
      alert("Please enter mobile number.");
      return;
    }

    if (!form.licenseNumber.trim()) {
      alert("Please enter seed/fertilizer license number.");
      return;
    }

    if (!form.district.trim()) {
      alert("Please enter district.");
      return;
    }

    if (!form.state.trim()) {
      alert("Please enter state.");
      return;
    }

    if (!form.address.trim()) {
      alert("Please enter shop address.");
      return;
    }

    try {
      setLoading(true);

      await setPersistence(auth, browserSessionPersistence);

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        form.email,
        form.password
      );

      const uid = userCredential.user.uid;

      await set(ref(database, `dealerRequests/${uid}`), {
        uid: uid,
        dealerName: form.dealerName,
        shopName: form.shopName,
        ownerName: form.ownerName,
        email: form.email,
        phone: form.phone,
        licenseNumber: form.licenseNumber,
        gstNumber: form.gstNumber,
        district: form.district,
        state: form.state,
        address: form.address,
        role: "dealer",
        status: "pending",
        createdAt: new Date().toISOString(),
      });

      await signOut(auth);

      sessionStorage.setItem("role", "dealer");

      alert("Dealer request submitted successfully. Wait for admin approval.");

      navigate("/login");
    } catch (error) {
      console.error(error);

      if (error.code === "auth/email-already-in-use") {
        alert("This email is already registered. Use a new email.");
      } else if (error.code === "auth/invalid-email") {
        alert("Please enter a valid email address.");
      } else if (error.code === "auth/weak-password") {
        alert("Password is too weak. Use at least 6 characters.");
      } else {
        alert(error.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dealer-theme min-h-screen bg-green-50 p-6">
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-lg p-6">
        <h1 className="text-3xl font-bold text-green-700 mb-2">
          🏪 Dealer Registration Request
        </h1>

        <p className="text-gray-600 mb-6">
          Create your dealer account. Admin approval is required before login access.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            name="dealerName"
            placeholder="Dealer Name"
            value={form.dealerName}
            onChange={handleChange}
            className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
          />

          <input
            name="shopName"
            placeholder="Shop Name"
            value={form.shopName}
            onChange={handleChange}
            className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
          />

          <input
            name="ownerName"
            placeholder="Owner Name"
            value={form.ownerName}
            onChange={handleChange}
            className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
          />

          <input
            name="email"
            type="email"
            placeholder="Business Email"
            value={form.email}
            onChange={handleChange}
            className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
          />

          <input
            name="password"
            type="password"
            placeholder="Create Password"
            value={form.password}
            onChange={handleChange}
            className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
          />

          <input
            name="confirmPassword"
            type="password"
            placeholder="Confirm Password"
            value={form.confirmPassword}
            onChange={handleChange}
            className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
          />

          <input
            name="phone"
            placeholder="Mobile Number"
            value={form.phone}
            onChange={handleChange}
            className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
          />

          <input
            name="licenseNumber"
            placeholder="Seed/Fertilizer License Number"
            value={form.licenseNumber}
            onChange={handleChange}
            className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
          />

          <input
            name="gstNumber"
            placeholder="GST Number (Optional)"
            value={form.gstNumber}
            onChange={handleChange}
            className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
          />

          <input
            name="district"
            placeholder="District"
            value={form.district}
            onChange={handleChange}
            className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
          />

          <input
            name="state"
            placeholder="State"
            value={form.state}
            onChange={handleChange}
            className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
          />

          <textarea
            name="address"
            placeholder="Shop Address"
            value={form.address}
            onChange={handleChange}
            rows={4}
            className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-700 text-white py-3 rounded-lg font-semibold hover:bg-green-800 transition disabled:bg-gray-400"
          >
            {loading ? "Submitting..." : "Send Request To Admin"}
          </button>

          <button
            type="button"
            onClick={() => navigate("/login")}
            className="w-full border border-gray-300 py-3 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            Back To Dealer Login
          </button>
        </form>
      </div>
    </div>
  );
}
