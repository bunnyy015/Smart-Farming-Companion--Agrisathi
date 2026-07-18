import { useEffect, useState } from "react";
import { ref, get } from "firebase/database";
import { database } from "../../firebase";

export default function DealersPage() {
  const [dealers, setDealers] = useState([]);

  useEffect(() => {
    loadDealers();
  }, []);

  async function loadDealers() {
    try {
      const snapshot = await get(ref(database, "users"));

      if (!snapshot.exists()) {
        setDealers([]);
        return;
      }

      const users = snapshot.val();

      const dealerList = Object.values(users).filter(
        (user) => user.role === "dealer"
      );

      setDealers(dealerList);
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div className="min-h-screen bg-green-50 p-6">
      <h1 className="text-4xl font-bold text-green-700 mb-6">
        🏪 Dealers
      </h1>

      {dealers.length === 0 ? (
        <div className="bg-white p-5 rounded-xl shadow">
          No Dealers Found
        </div>
      ) : (
        <div className="space-y-4">
          {dealers.map((dealer, index) => (
            <div
              key={index}
              className="bg-white p-5 rounded-2xl shadow"
            >
              <h2 className="text-xl font-bold">
                {dealer.name}
              </h2>

              <p>Email: {dealer.email}</p>
              <p>Phone: {dealer.phone}</p>
              <p>District: {dealer.district}</p>
              <p>State: {dealer.state}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}