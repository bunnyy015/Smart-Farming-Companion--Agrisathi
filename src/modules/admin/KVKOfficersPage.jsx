import { useEffect, useState } from "react";
import { ref, get } from "firebase/database";
import { database } from "../../firebase";

export default function KVKOfficersPage() {
  const [officers, setOfficers] = useState([]);

  useEffect(() => {
    loadOfficers();
  }, []);

  async function loadOfficers() {
    const snapshot = await get(ref(database, "users"));

    if (!snapshot.exists()) return;

    const users = snapshot.val();

    const kvkList = Object.values(users).filter(
      (user) => user.role === "kvk"
    );

    setOfficers(kvkList);
  }

  return (
    <div className="min-h-screen bg-green-50 p-6">

      <h1 className="text-4xl font-bold text-green-700 mb-6">
        🏛️ KVK Officers
      </h1>

      {officers.length === 0 ? (
        <div className="bg-white p-5 rounded-xl shadow">
          No KVK Officers Found
        </div>
      ) : (
        <div className="space-y-4">
          {officers.map((officer, index) => (
            <div
              key={index}
              className="bg-white p-5 rounded-2xl shadow"
            >
              <h2 className="text-xl font-bold">
                {officer.name}
              </h2>

              <p>Email: {officer.email}</p>
              <p>Phone: {officer.phone}</p>
              <p>District: {officer.district}</p>
              <p>State: {officer.state}</p>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}