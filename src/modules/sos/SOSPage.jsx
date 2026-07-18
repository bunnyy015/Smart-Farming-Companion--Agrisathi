import { useEffect, useState } from "react";
import { push, ref, set, get } from "firebase/database";
import { auth, database } from "../../firebase";
import { useNavigate } from "react-router-dom";

export default function SOSPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [farmer, setFarmer] = useState(null);

  const [form, setForm] = useState({
    issueType: "",
    description: "",
    village: "",
    district: "",
    phone: "",
  });

  useEffect(() => {
    loadFarmerProfile();
  }, []);

  async function loadFarmerProfile() {
    const user = auth.currentUser;

    if (!user) {
      navigate("/login");
      return;
    }

    const snapshot = await get(ref(database, `users/${user.uid}`));

    if (snapshot.exists()) {
      const data = snapshot.val();

      setFarmer(data);

      setForm({
        issueType: "",
        description: "",
        village: data.village || "",
        district: data.district || "",
        phone: data.phone || data.mobile || "",
      });
    }
  }

  function handleChange(event) {
    setForm({
      ...form,
      [event.target.name]: event.target.value,
    });
  }

  async function sendSOS(event) {
    event.preventDefault();

    if (!form.issueType.trim()) {
      alert("Please enter emergency type.");
      return;
    }

    if (!form.description.trim()) {
      alert("Please describe your emergency.");
      return;
    }

    if (!form.phone.trim()) {
      alert("Please enter phone number.");
      return;
    }

    try {
      setLoading(true);

      const user = auth.currentUser;

      if (!user) {
        alert("Please login first");
        return;
      }

      const sosRef = push(ref(database, "sosRequests"));

      await set(sosRef, {
        farmerId: user.uid,
        farmerName:
          farmer?.fullName ||
          farmer?.name ||
          farmer?.farmerName ||
          "Farmer",
        phone: form.phone,
        district: form.district,
        village: form.village,
        issueType: form.issueType,
        description: form.description,
        status: "pending",
        createdAt: new Date().toISOString(),
      });

      setMessage("SOS request sent successfully.");

      setForm({
        ...form,
        issueType: "",
        description: "",
      });
    } catch (error) {
      console.error(error);
      alert("Failed to send SOS");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-red-50 p-6">
      <button
        onClick={() => navigate("/dashboard")}
        className="text-red-700 font-semibold mb-4"
      >
        ← Back to Dashboard
      </button>

      <h1 className="text-4xl font-bold text-red-700 mb-4">
        🚨 Emergency SOS
      </h1>

      <div className="bg-white rounded-2xl shadow-lg p-6 max-w-xl">
        <p className="text-lg mb-5">
          Send an emergency request to KVK Officers.
        </p>

        <form onSubmit={sendSOS} className="space-y-4">
          <input
            name="issueType"
            placeholder="Emergency Type example: Crop disease, pest attack, irrigation problem"
            value={form.issueType}
            onChange={handleChange}
            className="w-full border border-gray-300 p-3 rounded-lg"
          />

          <textarea
            name="description"
            placeholder="Describe your emergency"
            value={form.description}
            onChange={handleChange}
            rows={4}
            className="w-full border border-gray-300 p-3 rounded-lg"
          />

          <input
            name="phone"
            placeholder="Phone Number"
            value={form.phone}
            onChange={handleChange}
            className="w-full border border-gray-300 p-3 rounded-lg"
          />

          <input
            name="village"
            placeholder="Village"
            value={form.village}
            onChange={handleChange}
            className="w-full border border-gray-300 p-3 rounded-lg"
          />

          <input
            name="district"
            placeholder="District"
            value={form.district}
            onChange={handleChange}
            className="w-full border border-gray-300 p-3 rounded-lg"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 text-white px-8 py-4 rounded-xl text-xl font-bold hover:bg-red-700 disabled:bg-gray-400"
          >
            {loading ? "Sending..." : "SEND SOS"}
          </button>
        </form>

        {message && (
          <p className="mt-4 text-green-700 font-semibold">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}