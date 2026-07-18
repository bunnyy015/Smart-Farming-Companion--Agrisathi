import { useState } from "react";
import { push, ref, set } from "firebase/database";
import { database } from "../../firebase";

export default function KVKRegistrationPage() {
  const [form, setForm] = useState({
    officerName: "",
    employeeId: "",
    email: "",
    phone: "",
    district: "",
    state: "",
    designation: "",
    officeAddress: "",
  });

  function handleChange(event) {
    setForm({
      ...form,
      [event.target.name]: event.target.value,
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      const requestRef = push(
        ref(database, "kvkRequests")
      );

      await set(requestRef, {
        ...form,
        role: "kvk",
        status: "pending",
        createdAt: new Date().toISOString(),
      });

      alert(
        "Request submitted successfully. Waiting for Admin approval."
      );

      setForm({
        officerName: "",
        employeeId: "",
        email: "",
        phone: "",
        district: "",
        state: "",
        designation: "",
        officeAddress: "",
      });
    } catch (error) {
      console.error(error);
      alert("Failed to submit request");
    }
  }

  return (
    <div className="min-h-screen bg-green-50 p-6">
      <div className="max-w-2xl mx-auto bg-white p-6 rounded-2xl shadow-lg">

        <h1 className="text-3xl font-bold text-green-700 mb-6">
          🏛️ KVK Officer Registration Request
        </h1>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >

          <input
            name="officerName"
            placeholder="Officer Name"
            value={form.officerName}
            onChange={handleChange}
            className="w-full border p-3 rounded-lg"
          />

          <input
            name="employeeId"
            placeholder="Employee ID"
            value={form.employeeId}
            onChange={handleChange}
            className="w-full border p-3 rounded-lg"
          />

          <input
            name="designation"
            placeholder="Designation"
            value={form.designation}
            onChange={handleChange}
            className="w-full border p-3 rounded-lg"
          />

          <input
            name="email"
            placeholder="Official Email"
            value={form.email}
            onChange={handleChange}
            className="w-full border p-3 rounded-lg"
          />

          <input
            name="phone"
            placeholder="Phone Number"
            value={form.phone}
            onChange={handleChange}
            className="w-full border p-3 rounded-lg"
          />

          <input
            name="district"
            placeholder="District"
            value={form.district}
            onChange={handleChange}
            className="w-full border p-3 rounded-lg"
          />

          <input
            name="state"
            placeholder="State"
            value={form.state}
            onChange={handleChange}
            className="w-full border p-3 rounded-lg"
          />

          <textarea
            name="officeAddress"
            placeholder="KVK Office Address"
            value={form.officeAddress}
            onChange={handleChange}
            className="w-full border p-3 rounded-lg"
          />

          <button
            type="submit"
            className="w-full bg-green-700 text-white py-3 rounded-lg"
          >
            Request Admin Approval
          </button>

        </form>
      </div>
    </div>
  );
}