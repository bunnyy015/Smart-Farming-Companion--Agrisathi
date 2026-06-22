import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { ref, set } from "firebase/database";
import { auth, database } from "../../firebase";

export default function RegisterPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    village: "",
    district: "",
    state: "",
    mainCrop: "",
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

  function getFriendlyError(error) {
    if (error.code === "auth/email-already-in-use") {
      return "This email is already registered. Please login instead.";
    }

    if (error.code === "auth/invalid-email") {
      return "Please enter a valid email address.";
    }

    if (error.code === "auth/weak-password") {
      return "Password should be at least 6 characters.";
    }

    return "Account creation failed. Please try again.";
  }

  async function handleRegister(event) {
    event.preventDefault();

    setErrorMessage("");

    if (!form.name.trim()) {
      setErrorMessage("Please enter farmer name.");
      return;
    }

    if (!form.email.trim()) {
      setErrorMessage("Please enter email.");
      return;
    }

    if (!form.password.trim()) {
      setErrorMessage("Please enter password.");
      return;
    }

    if (form.password.length < 6) {
      setErrorMessage("Password should be at least 6 characters.");
      return;
    }

    if (!form.phone.trim()) {
      setErrorMessage("Please enter mobile number.");
      return;
    }

    if (!form.village.trim()) {
      setErrorMessage("Please enter village.");
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

    if (!form.mainCrop.trim()) {
      setErrorMessage("Please enter main crop.");
      return;
    }

    try {
      setLoading(true);

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        form.email,
        form.password
      );

      const userId = userCredential.user.uid;

      await set(ref(database, "farmers/" + userId), {
        name: form.name,
        email: form.email,
        phone: form.phone,
        village: form.village,
        district: form.district,
        state: form.state,
        mainCrop: form.mainCrop,
        createdAt: new Date().toISOString(),
      });

      navigate("/language");
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-lg p-6">
        <h1 className="text-3xl font-bold text-green-700 text-center">
          Create Farmer Account
        </h1>

        <p className="text-gray-600 text-center mt-2 mb-6">
          Enter farmer details
        </p>

        <form onSubmit={handleRegister} className="space-y-4">
          <input
            name="name"
            placeholder="Farmer name"
            value={form.name}
            onChange={handleChange}
            className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-600"
          />

          <input
            name="email"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-600"
          />

          <input
            name="password"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-600"
          />

          <input
            name="phone"
            placeholder="Mobile number"
            value={form.phone}
            onChange={handleChange}
            className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-600"
          />

          <input
            name="village"
            placeholder="Village"
            value={form.village}
            onChange={handleChange}
            className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-600"
          />

          <input
            name="district"
            placeholder="District"
            value={form.district}
            onChange={handleChange}
            className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-600"
          />

          <input
            name="state"
            placeholder="State"
            value={form.state}
            onChange={handleChange}
            className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-600"
          />

          <input
            name="mainCrop"
            placeholder="Main crop, example: Rice"
            value={form.mainCrop}
            onChange={handleChange}
            className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-600"
          />

          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-700 text-white py-3 rounded-lg font-semibold disabled:bg-gray-400"
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => navigate("/login")}
          className="w-full mt-4 text-green-700 font-semibold"
        >
          Already have account? Login
        </button>
      </div>
    </div>
  );
}