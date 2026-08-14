import { useState } from "react";
import { Link } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../firebase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    setMessage("");
    setErrorMessage("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setErrorMessage("Please enter your email address.");
      return;
    }

    if (!cleanEmail.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    try {
      setLoading(true);

      await sendPasswordResetEmail(auth, cleanEmail);

      /*
       * Do not reveal whether the email actually exists.
       * This is safer from an account-enumeration perspective.
       */
      setMessage(
        "If an account exists with this email, a password reset link has been sent. Please check your inbox and spam folder."
      );

      setEmail("");
    } catch (error) {
      console.error("Password reset error:", error);

      /*
       * Show a generic message instead of revealing
       * whether a particular email is registered.
       */
      setMessage(
        "If an account exists with this email, a password reset link has been sent. Please check your inbox and spam folder."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-green-700 text-white flex items-center justify-center text-3xl shadow-lg">
            🔐
          </div>

          <h1 className="text-3xl font-bold text-green-900 mt-4">
            Forgot Password?
          </h1>

          <p className="text-gray-600 mt-2">
            Enter your registered email address and we will send you a
            password reset link.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-green-100 p-6 md:p-8">

          {/* Success message */}
          {message && (
            <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-4 mb-5 text-sm">
              <div className="flex gap-3">
                <span className="text-xl">✓</span>

                <p>{message}</p>
              </div>
            </div>
          )}

          {/* Error */}
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-5 text-sm">
              {errorMessage}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Registered Email
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="Enter your email"
                autoComplete="email"
                disabled={loading}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-700 hover:bg-green-800 text-white py-3 rounded-xl font-semibold transition disabled:bg-gray-400"
            >
              {loading
                ? "Sending Reset Link..."
                : "Send Reset Link"}
            </button>
          </form>

          {/* Back to login */}
          <div className="text-center mt-6">
            <Link
              to="/login"
              className="text-green-700 hover:text-green-900 font-semibold"
            >
              ← Back to Login
            </Link>
          </div>
        </div>

        {/* Information */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mt-5 text-sm text-blue-800">
          <p className="font-semibold mb-1">
            📧 Check your email
          </p>

          <p>
            The password reset link may take a few minutes to arrive.
            Also check your spam or junk folder.
          </p>
        </div>
      </div>
    </div>
  );
}