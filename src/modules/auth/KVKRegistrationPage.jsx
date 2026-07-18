import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { ref, set } from "firebase/database";
import { auth, database } from "../../firebase";

export default function KVKRegistrationPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    officerName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    employeeId: "",
    designation: "",
    kvkCenter: "",
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

    if (!form.officerName.trim()) {
      setErrorMessage("Please enter officer name.");
      return;
    }

    if (!form.email.trim()) {
      setErrorMessage("Please enter official email.");
      return;
    }

    if (!form.password.trim()) {
      setErrorMessage("Please create a password.");
      return;
    }

    if (form.password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setErrorMessage("Password and confirm password do not match.");
      return;
    }

    if (!form.phone.trim()) {
      setErrorMessage("Please enter mobile number.");
      return;
    }

    if (!form.employeeId.trim()) {
      setErrorMessage("Please enter employee ID.");
      return;
    }

    if (!form.designation.trim()) {
      setErrorMessage("Please enter designation.");
      return;
    }

    if (!form.kvkCenter.trim()) {
      setErrorMessage("Please enter KVK center.");
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

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        form.email,
        form.password
      );

      const uid = userCredential.user.uid;

      await set(ref(database, `kvkRequests/${uid}`), {
        uid,
        officerName: form.officerName,
        email: form.email,
        phone: form.phone,
        employeeId: form.employeeId,
        designation: form.designation,
        kvkCenter: form.kvkCenter,
        district: form.district,
        state: form.state,
        address: form.address,
        role: "kvk",
        status: "pending",
        createdAt: new Date().toISOString(),
      });

      await signOut(auth);

      localStorage.setItem("role", "kvk");

      alert(
        "KVK Officer request submitted successfully. Please wait for Admin approval."
      );

      navigate("/login");
    } catch (error) {
      console.error(error);

      if (error.code === "auth/email-already-in-use") {
        setErrorMessage("This email is already registered. Use a new email.");
      } else if (error.code === "auth/invalid-email") {
        setErrorMessage("Please enter a valid email address.");
      } else if (error.code === "auth/weak-password") {
        setErrorMessage("Password is too weak. Use at least 6 characters.");
      } else {
        setErrorMessage(error.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-lg p-6">
        <h1 className="text-3xl font-bold text-green-700 text-center">
          🏛️ KVK Officer Registration Request
        </h1>

        <p className="text-gray-600 text-center mt-2 mb-6">
          Create your KVK account. Admin approval is required before login.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            name="officerName"
            placeholder="Officer Name"
            value={form.officerName}
            onChange={handleChange}
            className="w-full border rounded-lg px-4 py-3"
          />

          <input
            name="email"
            type="email"
            placeholder="Official Email"
            value={form.email}
            onChange={handleChange}
            className="w-full border rounded-lg px-4 py-3"
          />

          <input
            name="password"
            type="password"
            placeholder="Create Password"
            value={form.password}
            onChange={handleChange}
            className="w-full border rounded-lg px-4 py-3"
          />

          <input
            name="confirmPassword"
            type="password"
            placeholder="Confirm Password"
            value={form.confirmPassword}
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
            name="employeeId"
            placeholder="Employee ID"
            value={form.employeeId}
            onChange={handleChange}
            className="w-full border rounded-lg px-4 py-3"
          />

          <input
            name="designation"
            placeholder="Designation"
            value={form.designation}
            onChange={handleChange}
            className="w-full border rounded-lg px-4 py-3"
          />

          <input
            name="kvkCenter"
            placeholder="KVK Center Name"
            value={form.kvkCenter}
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
            placeholder="Office Address"
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
            className="w-full bg-green-700 text-white py-3 rounded-lg font-semibold disabled:bg-gray-400"
          >
            {loading ? "Submitting..." : "Request Admin Approval"}
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