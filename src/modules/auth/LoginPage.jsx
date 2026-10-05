import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  browserSessionPersistence,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
} from "firebase/auth";

import { get, ref } from "firebase/database";

import { auth, database } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";

const ROLE_CONFIG = {
  farmer: {
    title: "Farmer Login",
    icon: "👨‍🌾",
    subtitle:
      "Access crop services, orders and farm information.",
    path: "/dashboard",
    gradient:
      "from-green-700 via-green-600 to-emerald-500",
    ring: "focus:ring-green-500",
  },

  dealer: {
    title: "Dealer Login",
    icon: "🏪",
    subtitle:
      "Manage products, stock, farmer orders and sales.",
    path: "/dealer",
    gradient:
      "from-blue-700 via-blue-600 to-cyan-500",
    ring: "focus:ring-blue-500",
  },

  admin: {
    title: "Admin Login",
    icon: "🛡️",
    subtitle:
      "Manage users, approvals and platform information.",
    path: "/admin",
    gradient:
      "from-purple-700 via-indigo-600 to-blue-500",
    ring: "focus:ring-purple-500",
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

  if (errorCode === "auth/operation-not-allowed") {
    return "Email/password authentication is not enabled in Firebase.";
  }

  return "Login failed. Please try again.";
}

export default function LoginPage() {
  const navigate = useNavigate();

  const selectedRole = sessionStorage.getItem("role");
  const roleDetails = ROLE_CONFIG[selectedRole];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);
  const [resettingPassword, setResettingPassword] =
    useState(false);

  const [message, setMessage] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [focusedField, setFocusedField] =
    useState("");

  const normalizedEmail = useMemo(
    () => email.trim().toLowerCase(),
    [email]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsVisible(true);
    }, 80);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  function showMessage(type, text) {
    setMessage({
      type,
      text,
    });
  }

  function clearMessage() {
    setMessage(null);
  }

  /*
   * Check whether a dealer registration
   * is still waiting for administrator approval.
   */
  async function checkPendingRequest(uid) {
    const dealerSnapshot = await get(
      ref(database, `dealerRequests/${uid}`)
    );

    if (dealerSnapshot.exists()) {
      return {
        type: "dealer",
        text:
          "Your dealer registration is waiting for admin approval.",
      };
    }

    return null;
  }

  /*
   * Normal email/password login.
   */
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
      showMessage(
        "warning",
        "Enter your email address."
      );

      return;
    }

    if (!password.trim()) {
      showMessage(
        "warning",
        "Enter your password."
      );

      return;
    }

    try {
      setLoading(true);

      /*
       * Firebase Authentication login.
       */
      // Keep this tab's user separate from other tabs so a Farmer and a
      // Dealer can stay signed in side by side in the same browser profile.
      await setPersistence(auth, browserSessionPersistence);
      const credential =
        await signInWithEmailAndPassword(
          auth,
          normalizedEmail,
          password
        );

      const uid = credential.user.uid;

      /*
       * Read the corresponding profile
       * from Realtime Database.
       */
      const userSnapshot = await get(
        ref(database, `users/${uid}`)
      );

      /*
       * If there is no users/{uid} profile,
       * check whether the account is still pending.
       */
      if (!userSnapshot.exists()) {
        const pendingRequest =
          await checkPendingRequest(uid);

        if (pendingRequest) {
          showMessage(
            "warning",
            pendingRequest.text
          );

          return;
        }

        showMessage(
          "error",
          "Your account profile was not found. Contact the administrator."
        );

        return;
      }

      const userData = userSnapshot.val();

      const registeredRole = String(
        userData.role || ""
      )
        .trim()
        .toLowerCase();

      /*
       * Validate role configuration.
       */
      if (
        !registeredRole ||
        !ROLE_CONFIG[registeredRole]
      ) {
        showMessage(
          "error",
          "This account has an invalid role configuration."
        );

        return;
      }

      /*
       * Prevent users from selecting one role
       * and logging in using another role.
       */
      if (registeredRole !== selectedRole) {
        showMessage(
          "warning",
          `This account is registered as ${
            ROLE_CONFIG[
              registeredRole
            ].title.replace(" Login", "")
          }. Change the selected role and log in again.`
        );

        return;
      }

      /*
       * Check whether administrator disabled
       * this account.
       */
      const accountStatus = String(userData.status || "")
        .trim()
        .toLowerCase();

      if (
        registeredRole === "dealer" &&
        ["suspended", "deactivated", "blocked", "disabled"].includes(
          accountStatus
        )
      ) {
        showMessage(
          "error",
          "Your dealer account is suspended. Contact the administrator to reactivate it before logging in."
        );

        return;
      }

      if (accountStatus === "disabled") {
        showMessage(
          "error",
          "This account has been disabled by the administrator."
        );

        return;
      }

      /*
       * Store the verified role.
       */
      sessionStorage.setItem(
        "role",
        registeredRole
      );

      /*
       * Small delay gives the user visual feedback
       * before navigating to the dashboard.
       */
      await new Promise((resolve) =>
        window.setTimeout(resolve, 350)
      );

      /*
       * Send user to the correct dashboard.
       */
      navigate(
        ROLE_CONFIG[registeredRole].path,
        {
          replace: true,
        }
      );
    } catch (error) {
      console.error(
        "Login error:",
        error
      );

      showMessage(
        "error",
        getFriendlyAuthError(error)
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * PASSWORD RESET
   *
   * Firebase sends a secure password-reset
   * email to the entered address.
   */
  async function handleForgotPassword() {
    clearMessage();

    if (!normalizedEmail) {
      showMessage(
        "warning",
        "Enter your registered email address first."
      );

      return;
    }

    try {
      setResettingPassword(true);

      await sendPasswordResetEmail(
        auth,
        normalizedEmail
      );

      showMessage(
        "success",
        "Password reset instructions have been sent to your email. Check your inbox and spam folder."
      );

      setPassword("");
    } catch (error) {
      console.error(
        "Password reset error:",
        error
      );

      const code = error?.code || "";

      if (code === "auth/invalid-email") {
        showMessage(
          "error",
          "Enter a valid email address."
        );
      } else if (
        code === "auth/user-not-found"
      ) {
        showMessage(
          "error",
          "No Firebase Authentication account was found with this email address."
        );
      } else if (
        code === "auth/network-request-failed"
      ) {
        showMessage(
          "error",
          "Check your internet connection and try again."
        );
      } else if (
        code === "auth/operation-not-allowed"
      ) {
        showMessage(
          "error",
          "Password reset is unavailable because Email/Password authentication is not enabled in Firebase."
        );
      } else {
        showMessage(
          "error",
          "Password reset email could not be sent. Please try again."
        );
      }
    } finally {
      setResettingPassword(false);
    }
  }

  /*
   * Registration navigation.
   */
  function openRegistration() {
    if (selectedRole === "farmer") {
      navigate("/register");
      return;
    }

    if (selectedRole === "dealer") {
      navigate("/dealer/register");
    }
  }

  /*
   * If LoginPage is opened without selecting
   * a role first.
   */
  if (!roleDetails) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-green-100 via-emerald-50 to-green-100 flex items-center justify-center p-4">
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-green-300/30 rounded-full blur-3xl animate-pulse" />

        <div
          className="absolute -bottom-20 -right-20 w-72 h-72 bg-emerald-300/30 rounded-full blur-3xl animate-pulse"
          style={{
            animationDelay: "800ms",
          }}
        />

        <div className="relative z-10 w-full max-w-md bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl border border-green-100 p-7 text-center animate-[fadeIn_0.5s_ease-out]">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-green-50 flex items-center justify-center shadow-inner">
            <span className="text-5xl">
              🌾
            </span>
          </div>

          <h1 className="text-2xl font-bold text-green-800 mt-5">
            Select Your Role
          </h1>

          <p className="text-gray-600 mt-2">
            Choose Farmer, Dealer or Admin before
            logging in.
          </p>

          <button
            type="button"
            onClick={() =>
              navigate(
                "/role-selection",
                {
                  replace: true,
                }
              )
            }
            className="w-full bg-green-700 text-white py-3.5 rounded-xl font-semibold mt-6 hover:bg-green-800 hover:shadow-lg active:scale-[0.98] transition-all duration-200"
          >
            Select Role
          </button>
        </div>
      </div>
    );
  }

  const canRegister = [
    "farmer",
    "dealer",
  ].includes(selectedRole);

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-green-100 via-emerald-50 to-green-50 flex items-center justify-center p-4 sm:p-6">
      {/* Decorative background */}
      <div className="absolute -top-24 -left-24 w-80 h-80 bg-green-300/20 rounded-full blur-3xl animate-pulse" />

      <div
        className="absolute -bottom-24 -right-24 w-96 h-96 bg-emerald-300/20 rounded-full blur-3xl animate-pulse"
        style={{
          animationDelay: "900ms",
        }}
      />

      <div
        className="absolute top-1/4 right-5 w-24 h-24 bg-yellow-200/20 rounded-full blur-2xl animate-pulse"
        style={{
          animationDelay: "1500ms",
        }}
      />

      <main
        className={`relative z-10 w-full max-w-md transition-all duration-700 ease-out ${
          isVisible
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-8 scale-[0.98]"
        }`}
      >
        <StatusMessage
          message={message}
          onClose={clearMessage}
        />

        <section className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl border border-white overflow-hidden">
          {/* Header */}
          <header
            className={`relative bg-gradient-to-r ${roleDetails.gradient} text-white p-7 text-center overflow-hidden`}
          >
            {/* Header decoration */}
            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/10" />

            <div className="absolute -bottom-16 -left-10 w-40 h-40 rounded-full bg-white/10" />

            <div className="relative z-10">
              <div
                className="w-20 h-20 mx-auto rounded-3xl bg-white/20 backdrop-blur-sm border border-white/20 flex items-center justify-center text-5xl shadow-lg transition-transform duration-500 hover:scale-110 hover:rotate-3"
              >
                {roleDetails.icon}
              </div>

              <h1 className="text-3xl font-extrabold mt-4">
                {roleDetails.title}
              </h1>

              <p className="text-white/85 text-sm mt-2 leading-5">
                {roleDetails.subtitle}
              </p>

              <div className="inline-flex items-center gap-2 bg-white/15 rounded-full px-3 py-1.5 mt-4 text-xs font-medium">
                <span className="w-2 h-2 bg-green-300 rounded-full animate-pulse" />
                Secure login
              </div>
            </div>
          </header>

          {/* Form */}
          <div className="p-6 sm:p-7">
            <form
              onSubmit={handleLogin}
              className="space-y-5"
            >
              {/* Email */}
              <div
                className={`transition-all duration-200 ${
                  focusedField === "email"
                    ? "translate-y-[-1px]"
                    : ""
                }`}
              >
                <label
                  htmlFor="login-email"
                  className="block text-sm font-semibold text-gray-700"
                >
                  Email Address
                </label>

                <div
                  className={`relative mt-2 rounded-xl transition-all duration-200 ${
                    focusedField === "email"
                      ? "ring-2 ring-green-500/30"
                      : ""
                  }`}
                >
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">
                    ✉️
                  </span>

                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    autoComplete="email"
                    disabled={
                      loading ||
                      resettingPassword
                    }
                    onFocus={() =>
                      setFocusedField("email")
                    }
                    onBlur={() =>
                      setFocusedField("")
                    }
                    onChange={(event) => {
                      setEmail(event.target.value);
                      clearMessage();
                    }}
                    placeholder="Enter your registered email"
                    className="w-full border border-gray-300 rounded-xl pl-12 pr-4 py-3.5 outline-none focus:border-green-500 transition disabled:bg-gray-100"
                  />
                </div>
              </div>

              {/* Password */}
              <div
                className={`transition-all duration-200 ${
                  focusedField === "password"
                    ? "translate-y-[-1px]"
                    : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="login-password"
                    className="block text-sm font-semibold text-gray-700"
                  >
                    Password
                  </label>

                  <button
                    type="button"
                    disabled={
                      loading ||
                      resettingPassword
                    }
                    onClick={
                      handleForgotPassword
                    }
                    className="text-sm font-semibold text-green-700 hover:text-green-800 hover:underline disabled:text-gray-400 transition"
                  >
                    {resettingPassword
                      ? "Sending..."
                      : "Forgot Password?"}
                  </button>
                </div>

                <div
                  className={`relative mt-2 rounded-xl transition-all duration-200 ${
                    focusedField === "password"
                      ? "ring-2 ring-green-500/30"
                      : ""
                  }`}
                >
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">
                    🔒
                  </span>

                  <input
                    id="login-password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    value={password}
                    autoComplete="current-password"
                    disabled={
                      loading ||
                      resettingPassword
                    }
                    onFocus={() =>
                      setFocusedField(
                        "password"
                      )
                    }
                    onBlur={() =>
                      setFocusedField("")
                    }
                    onChange={(event) => {
                      setPassword(
                        event.target.value
                      );
                      clearMessage();
                    }}
                    placeholder="Enter your password"
                    className="w-full border border-gray-300 rounded-xl pl-12 pr-20 py-3.5 outline-none focus:border-green-500 transition disabled:bg-gray-100"
                  />

                  <button
                    type="button"
                    disabled={
                      loading ||
                      resettingPassword
                    }
                    onClick={() =>
                      setShowPassword(
                        (current) => !current
                      )
                    }
                    className="absolute inset-y-0 right-3 px-2 text-sm font-semibold text-green-700 hover:text-green-900 disabled:text-gray-400 transition"
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showPassword
                      ? "Hide"
                      : "Show"}
                  </button>
                </div>
              </div>

              {/* Login button */}
              <button
                type="submit"
                disabled={
                  loading ||
                  resettingPassword
                }
                className={`relative overflow-hidden w-full bg-gradient-to-r ${roleDetails.gradient} text-white py-3.5 rounded-xl font-bold shadow-md hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none`}
              >
                {loading && (
                  <span className="absolute inset-0 bg-white/10 animate-pulse" />
                )}

                <span className="relative flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    <>
                      Login
                      <span className="text-lg">
                        →
                      </span>
                    </>
                  )}
                </span>
              </button>
            </form>

            {/* Security information */}
            <div className="flex items-center justify-center gap-2 mt-5 text-xs text-gray-500">
              <span className="text-green-600">
                🔐
              </span>

              <span>
                Your login is protected by Firebase
                Authentication.
              </span>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-gray-200" />

              <span className="text-xs text-gray-400 uppercase tracking-wider">
                options
              </span>

              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Change role */}
            <button
              type="button"
              disabled={
                loading ||
                resettingPassword
              }
              onClick={() =>
                navigate(
                  "/role-selection"
                )
              }
              className="group w-full border border-green-200 bg-green-50 text-green-800 py-3 rounded-xl font-semibold hover:bg-green-100 hover:border-green-300 active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-2">
                <span className="transition-transform duration-200 group-hover:-translate-x-1">
                  ←
                </span>

                Change Role
              </span>
            </button>

            {/* Registration */}
            {canRegister && (
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-center mt-5">
                <p className="text-sm text-gray-600">
                  {selectedRole ===
                  "farmer"
                    ? "New farmer?"
                    : "Want to register as a dealer?"}
                </p>

                <button
                  type="button"
                  disabled={
                    loading ||
                    resettingPassword
                  }
                  onClick={
                    openRegistration
                  }
                  className="text-green-700 font-bold mt-2 hover:text-green-900 hover:underline disabled:text-gray-400 transition"
                >
                  {selectedRole ===
                  "farmer"
                    ? "Create Farmer Account →"
                    : "Request Admin Approval →"}
                </button>
              </div>
            )}

            {/* Admin information */}
            {selectedRole ===
              "admin" && (
              <div className="bg-blue-50 border border-blue-100 text-blue-800 rounded-2xl p-4 text-sm text-center mt-5">
                <div className="text-2xl mb-2">
                  🛡️
                </div>

                <p className="font-semibold">
                  Administrator Access
                </p>

                <p className="text-blue-700 mt-1">
                  Admin accounts are created and
                  managed centrally.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Bottom branding */}
        <div className="text-center mt-5">
          <p className="text-xs text-gray-500">
            🌾 AgriSaathi • Smart Farming
            Companion
          </p>
        </div>
      </main>
    </div>
  );
}
