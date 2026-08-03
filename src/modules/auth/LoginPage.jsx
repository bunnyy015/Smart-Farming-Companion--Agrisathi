import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { get, ref } from "firebase/database";
import { auth, database } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";

const ROLE_CONFIG = {
  farmer: {
    title: "Farmer Login",
    icon: "👨‍🌾",
    subtitle: "Access crop services, orders and farm information.",
    path: "/dashboard",
  },

  dealer: {
    title: "Dealer Login",
    icon: "🏪",
    subtitle: "Manage products, stock, farmer orders and sales.",
    path: "/dealer",
  },

  kvk: {
    title: "KVK Officer Login",
    icon: "🏛️",
    subtitle: "Publish crop advisories and support farmers.",
    path: "/kvk",
  },

  admin: {
    title: "Admin Login",
    icon: "🛡️",
    subtitle: "Manage users, approvals and platform information.",
    path: "/admin",
  },
};

function getFriendlyAuthError(error) {
  const errorCode = error?.code || "";

  if (
    errorCode === "auth/invalid-credential" ||
    errorCode === "auth/wrong-password" ||
    errorCode === "auth/user-not-found"
  ) {
    return "The email or password is incorrect.";
  }

  if (errorCode === "auth/invalid-email") {
    return "Enter a valid email address.";
  }

  if (errorCode === "auth/user-disabled") {
    return "This account has been disabled.";
  }

  if (errorCode === "auth/too-many-requests") {
    return "Too many login attempts. Wait a few minutes and try again.";
  }

  if (errorCode === "auth/network-request-failed") {
    return "Check your internet connection and try again.";
  }

  return "Login failed. Please try again.";
}

export default function LoginPage() {
  const navigate = useNavigate();

  const selectedRole = localStorage.getItem("role");
  const roleDetails = ROLE_CONFIG[selectedRole];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resettingPassword, setResettingPassword] =
    useState(false);

  const [message, setMessage] = useState(null);

  const normalizedEmail = useMemo(
    () => email.trim().toLowerCase(),
    [email]
  );

  function showMessage(type, text) {
    setMessage({ type, text });
  }

  function clearMessage() {
    setMessage(null);
  }

  async function checkPendingRequest(uid) {
    const [dealerSnapshot, kvkSnapshot] = await Promise.all([
      get(ref(database, `dealerRequests/${uid}`)),
      get(ref(database, `kvkRequests/${uid}`)),
    ]);

    if (dealerSnapshot.exists()) {
      return {
        type: "dealer",
        text: "Your dealer registration is waiting for admin approval.",
      };
    }

    if (kvkSnapshot.exists()) {
      return {
        type: "kvk",
        text: "Your KVK registration is waiting for admin approval.",
      };
    }

    return null;
  }

  async function handleLogin(event) {
    event.preventDefault();
    clearMessage();

    if (!selectedRole || !roleDetails) {
      showMessage(
        "warning",
        "Select your role before logging in."
      );
      return;
    }

    if (!normalizedEmail) {
      showMessage("warning", "Enter your email address.");
      return;
    }

    if (!password.trim()) {
      showMessage("warning", "Enter your password.");
      return;
    }

    try {
      setLoading(true);

      const credential = await signInWithEmailAndPassword(
        auth,
        normalizedEmail,
        password
      );

      const uid = credential.user.uid;

      const userSnapshot = await get(
        ref(database, `users/${uid}`)
      );

      if (!userSnapshot.exists()) {
        const pendingRequest = await checkPendingRequest(uid);

        await signOut(auth);

        if (pendingRequest) {
          showMessage("warning", pendingRequest.text);
          return;
        }

        showMessage(
          "error",
          "Your account profile was not found. Contact the administrator."
        );
        return;
      }

      const userData = userSnapshot.val();
      const registeredRole = userData.role;

      if (!registeredRole || !ROLE_CONFIG[registeredRole]) {
        await signOut(auth);

        showMessage(
          "error",
          "This account has an invalid role configuration."
        );
        return;
      }

      if (registeredRole !== selectedRole) {
        await signOut(auth);

        showMessage(
          "warning",
          `This account is registered as ${ROLE_CONFIG[registeredRole].title.replace(
            " Login",
            ""
          )}. Change the selected role and log in again.`
        );
        return;
      }

      if (userData.status === "disabled") {
        await signOut(auth);

        showMessage(
          "error",
          "This account has been disabled by the administrator."
        );
        return;
      }

      localStorage.setItem("role", registeredRole);

      navigate(ROLE_CONFIG[registeredRole].path, {
        replace: true,
      });
    } catch (error) {
      console.error("Login error:", error);

      showMessage("error", getFriendlyAuthError(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    clearMessage();

    if (!normalizedEmail) {
      showMessage(
        "warning",
        "Enter your email first, then select Forgot Password."
      );
      return;
    }

    try {
      setResettingPassword(true);

      await sendPasswordResetEmail(auth, normalizedEmail);

      showMessage(
        "success",
        "Password reset instructions were sent to your email."
      );
    } catch (error) {
      console.error("Password reset error:", error);

      if (error?.code === "auth/invalid-email") {
        showMessage("error", "Enter a valid email address.");
      } else if (error?.code === "auth/user-not-found") {
        showMessage(
          "error",
          "No account was found with this email address."
        );
      } else if (
        error?.code === "auth/network-request-failed"
      ) {
        showMessage(
          "error",
          "Check your internet connection and try again."
        );
      } else {
        showMessage(
          "error",
          "Password reset email could not be sent."
        );
      }
    } finally {
      setResettingPassword(false);
    }
  }

  function openRegistration() {
    if (selectedRole === "farmer") {
      navigate("/register");
      return;
    }

    if (selectedRole === "dealer") {
      navigate("/dealer/register");
      return;
    }

    if (selectedRole === "kvk") {
      navigate("/kvk/register");
    }
  }

  if (!roleDetails) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-7 text-center">
          <div className="text-5xl">🌾</div>

          <h1 className="text-2xl font-bold text-green-800 mt-4">
            Select Your Role
          </h1>

          <p className="text-gray-600 mt-2">
            Choose Farmer, Dealer, KVK Officer or Admin before
            logging in.
          </p>

          <button
            type="button"
            onClick={() =>
              navigate("/role-selection", {
                replace: true,
              })
            }
            className="w-full bg-green-700 text-white py-3 rounded-xl font-semibold mt-6"
          >
            Select Role
          </button>
        </div>
      </div>
    );
  }

  const canRegister = ["farmer", "dealer", "kvk"].includes(
    selectedRole
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-100 to-green-50 flex items-center justify-center p-4">
      <main className="w-full max-w-md">
        <StatusMessage
          message={message}
          onClose={clearMessage}
        />

        <section className="bg-white rounded-3xl shadow-xl overflow-hidden">
          <header className="bg-gradient-to-r from-green-800 to-green-600 text-white p-6 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-white/20 flex items-center justify-center text-5xl">
              {roleDetails.icon}
            </div>

            <h1 className="text-3xl font-bold mt-4">
              {roleDetails.title}
            </h1>

            <p className="text-green-100 text-sm mt-2">
              {roleDetails.subtitle}
            </p>
          </header>

          <div className="p-6">
            <form onSubmit={handleLogin}>
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-sm font-semibold text-gray-700"
                >
                  Email Address
                </label>

                <input
                  id="login-email"
                  type="email"
                  value={email}
                  autoComplete="email"
                  disabled={loading}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    clearMessage();
                  }}
                  placeholder="Enter your email"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-2 outline-none focus:ring-2 focus:ring-green-600 disabled:bg-gray-100"
                />
              </div>

              <div className="mt-4">
                <label
                  htmlFor="login-password"
                  className="block text-sm font-semibold text-gray-700"
                >
                  Password
                </label>

                <div className="relative mt-2">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    autoComplete="current-password"
                    disabled={loading}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      clearMessage();
                    }}
                    placeholder="Enter your password"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 pr-20 outline-none focus:ring-2 focus:ring-green-600 disabled:bg-gray-100"
                  />

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() =>
                      setShowPassword((current) => !current)
                    }
                    className="absolute inset-y-0 right-3 text-sm font-semibold text-green-700 disabled:text-gray-400"
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div className="text-right mt-3">
                <button
                  type="button"
                  disabled={loading || resettingPassword}
                  onClick={handleForgotPassword}
                  className="text-sm text-green-700 font-semibold disabled:text-gray-400"
                >
                  {resettingPassword
                    ? "Sending..."
                    : "Forgot Password?"}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading || resettingPassword}
                className="w-full bg-green-700 text-white py-3 rounded-xl font-semibold mt-5 hover:bg-green-800 transition disabled:bg-gray-400"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    Logging in...
                  </span>
                ) : (
                  "Login"
                )}
              </button>
            </form>

            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-gray-200" />

              <span className="text-sm text-gray-500">or</span>

              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={() => navigate("/role-selection")}
              className="w-full border border-green-200 bg-green-50 text-green-800 py-3 rounded-xl font-semibold hover:bg-green-100 transition disabled:opacity-50"
            >
              Change Role
            </button>

            {canRegister && (
              <div className="bg-gray-50 rounded-xl p-4 text-center mt-5">
                <p className="text-sm text-gray-600">
                  {selectedRole === "farmer"
                    ? "New farmer?"
                    : selectedRole === "dealer"
                    ? "Want to register as a dealer?"
                    : "Want to register as a KVK officer?"}
                </p>

                <button
                  type="button"
                  disabled={loading}
                  onClick={openRegistration}
                  className="text-green-700 font-bold mt-2 disabled:text-gray-400"
                >
                  {selectedRole === "farmer"
                    ? "Create Farmer Account"
                    : "Request Admin Approval"}
                </button>
              </div>
            )}

            {selectedRole === "admin" && (
              <div className="bg-blue-50 border border-blue-100 text-blue-800 rounded-xl p-4 text-sm text-center mt-5">
                Admin accounts are created and managed centrally.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}