import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase";

export default function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event) {
    event.preventDefault();

    setErrorMessage("");

    if (!email.trim()) {
      setErrorMessage("Please enter your email.");
      return;
    }

    if (!password.trim()) {
      setErrorMessage("Please enter your password.");
      return;
    }

    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/language");
    } catch (error) {
      setErrorMessage("You entered wrong email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-lg p-6">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🌾</div>

          <h1 className="text-3xl font-bold text-green-700">
            AgriSathi
          </h1>

          <p className="text-gray-600 mt-2">
            Sign in to continue
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Email
          </label>

          <input
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setErrorMessage("");
            }}
            placeholder="Enter email"
            className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-green-600"
          />

          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Password
          </label>

          <input
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setErrorMessage("");
            }}
            placeholder="Enter password"
            className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-2 focus:outline-none focus:ring-2 focus:ring-green-600"
          />

          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
              {errorMessage}
            </div>
          )}

          <div className="text-right mb-5">
            <button
              type="button"
              className="text-sm text-green-700 font-semibold"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-700 text-white py-3 rounded-lg font-semibold hover:bg-green-800 transition disabled:bg-gray-400"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-gray-200"></div>
          <span className="text-sm text-gray-500">or</span>
          <div className="flex-1 h-px bg-gray-200"></div>
        </div>

        <button
          onClick={() => navigate("/language")}
          className="w-full border border-gray-300 py-3 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition"
        >
          Continue as Demo Farmer
        </button>

        <p className="text-center text-sm text-gray-600 mt-6">
          New farmer?{" "}
          <button
            type="button"
            onClick={() => navigate("/register")}
            className="text-green-700 font-semibold"
          >
            Create account
          </button>
        </p>
      </div>
    </div>
  );
}