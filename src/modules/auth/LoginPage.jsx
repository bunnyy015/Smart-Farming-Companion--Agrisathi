import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, database } from "../../firebase";

export default function LoginPage() {
  const navigate = useNavigate();

  const selectedRole = localStorage.getItem("role");

  const roleTitle = {
    farmer: "Farmer Login",
    admin: "Admin Login",
    kvk: "KVK Officer Login",
    dealer: "Dealer Login",
  };

  const rolePath = {
    farmer: "/dashboard",
    admin: "/admin",
    kvk: "/kvk",
    dealer: "/dealer",
  };

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event) {
    event.preventDefault();

    setErrorMessage("");

    if (!selectedRole) {
      setErrorMessage("Please select a role before login.");
      return;
    }

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

      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      const uid = userCredential.user.uid;

      const userSnapshot = await get(ref(database, `users/${uid}`));

      if (!userSnapshot.exists()) {
        const dealerSnapshot = await get(
          ref(database, `dealerRequests/${uid}`)
        );

        if (dealerSnapshot.exists()) {
          await signOut(auth);
          setErrorMessage(
            "Your dealer account is awaiting admin approval."
          );
          return;
        }

        const kvkSnapshot = await get(
          ref(database, `kvkRequests/${uid}`)
        );

        if (kvkSnapshot.exists()) {
          await signOut(auth);
          setErrorMessage(
            "Your KVK account is awaiting admin approval."
          );
          return;
        }

        await signOut(auth);
        setErrorMessage("User account not found.");
        return;
      }

      const userData = userSnapshot.val();

      if (userData.role !== selectedRole) {
        await signOut(auth);
        setErrorMessage(
          `This account is registered as ${userData.role}. Please login from ${userData.role} login.`
        );
        return;
      }

      navigate(rolePath[userData.role]);
    } catch (error) {
      console.error(error);
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
            {roleTitle[selectedRole] || "AgriSaathi"}
          </h1>

          <p className="text-gray-600 mt-2">
            Login to your account
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
          onClick={() => navigate("/role-selection")}
          className="w-full border border-gray-300 py-3 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition"
        >
          Change Role
        </button>

        <div className="text-center text-sm text-gray-600 mt-6">
          {selectedRole === "farmer" && (
            <>
              New farmer?{" "}
              <button
                type="button"
                onClick={() => navigate("/register")}
                className="text-green-700 font-semibold"
              >
                Create account
              </button>
            </>
          )}

          {selectedRole === "kvk" && (
            <>
              <p>Don't have a KVK account?</p>

              <button
                type="button"
                onClick={() => navigate("/kvk/register")}
                className="text-green-700 font-semibold w-full mt-2"
              >
                Request Admin Approval
              </button>
            </>
          )}

          {selectedRole === "dealer" && (
            <>
              <p>Don't have a Dealer account?</p>

              <button
                type="button"
                onClick={() => navigate("/dealer/register")}
                className="text-green-700 font-semibold w-full mt-2"
              >
                Request Admin Approval
              </button>
            </>
          )}

          {selectedRole === "admin" && (
            <span>Admin accounts are managed centrally.</span>
          )}
        </div>
      </div>
    </div>
  );
}