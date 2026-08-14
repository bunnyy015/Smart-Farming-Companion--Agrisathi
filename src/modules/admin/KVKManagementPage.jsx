import { useEffect, useMemo, useState } from "react";
import { get, ref, update } from "firebase/database";
import { database } from "../../firebase";

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function getName(user) {
  return (
    user?.name ||
    user?.fullName ||
    user?.officerName ||
    user?.kvkOfficerName ||
    "KVK Officer"
  );
}

function getDistrict(user) {
  return user?.district || user?.District || "Not provided";
}

function getState(user) {
  return user?.state || user?.State || "Not provided";
}

function getPhone(user) {
  return user?.phone || user?.mobile || user?.phoneNumber || "Not provided";
}

function getKvkName(user) {
  return (
    user?.kvkName ||
    user?.kvkCenter ||
    user?.instituteName ||
    user?.organization ||
    user?.organizationName ||
    "Not provided"
  );
}

function isDisabled(user) {
  return normalize(user?.status) === "disabled";
}

export default function KVKManagementPage() {
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [districtFilter, setDistrictFilter] = useState("all");
  const [selectedOfficer, setSelectedOfficer] = useState(null);

  useEffect(() => {
    loadOfficers();
  }, []);

  async function loadOfficers() {
    try {
      setLoading(true);
      setErrorMessage("");

      const snapshot = await get(ref(database, "users"));

      if (!snapshot.exists()) {
        setOfficers([]);
        return;
      }

      const data = snapshot.val();

      const officerList = Object.entries(data)
        .filter(([, user]) => normalize(user?.role) === "kvk")
        .map(([id, user]) => ({
          id,
          ...user,
        }))
        .sort((a, b) =>
          getName(a).localeCompare(getName(b))
        );

      setOfficers(officerList);
    } catch (error) {
      console.error("KVK management load error:", error);
      setErrorMessage(
        "Unable to load KVK officers. Check Firebase database access and database rules."
      );
    } finally {
      setLoading(false);
    }
  }

  const districts = useMemo(() => {
    const values = officers
      .map((officer) => getDistrict(officer))
      .filter(
        (district) =>
          district && normalize(district) !== "not provided"
      );

    return [...new Set(values)].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [officers]);

  const filteredOfficers = useMemo(() => {
    const query = normalize(search);

    return officers.filter((officer) => {
      const matchesSearch =
        !query ||
        [
          getName(officer),
          officer.email,
          getPhone(officer),
          getDistrict(officer),
          getState(officer),
          getKvkName(officer),
        ].some((value) =>
          normalize(value).includes(query)
        );

      const matchesDistrict =
        districtFilter === "all" ||
        getDistrict(officer) === districtFilter;

      return matchesSearch && matchesDistrict;
    });
  }, [officers, search, districtFilter]);

  const totalOfficers = officers.length;
  const disabledOfficers = officers.filter(isDisabled).length;
  const activeOfficers = totalOfficers - disabledOfficers;

  async function toggleStatus(officer) {
    const disabled = isDisabled(officer);
    const nextStatus = disabled ? "approved" : "disabled";

    const action = disabled ? "enable" : "disable";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${getName(officer)}?`
    );

    if (!confirmed) return;

    try {
      setUpdatingId(officer.id);
      setErrorMessage("");

      await update(ref(database, `users/${officer.id}`), {
        status: nextStatus,
        statusUpdatedAt: new Date().toISOString(),
      });

      setOfficers((current) =>
        current.map((item) =>
          item.id === officer.id
            ? {
                ...item,
                status: nextStatus,
                statusUpdatedAt: new Date().toISOString(),
              }
            : item
        )
      );

      setSelectedOfficer((current) =>
        current?.id === officer.id
          ? {
              ...current,
              status: nextStatus,
            }
          : current
      );
    } catch (error) {
      console.error("KVK status update error:", error);
      setErrorMessage(
        `Unable to ${action} the KVK officer. Please try again.`
      );
    } finally {
      setUpdatingId("");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="bg-gradient-to-r from-blue-900 via-blue-800 to-green-700 text-white rounded-3xl shadow-xl p-6 md:p-8 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center text-4xl">
                🏛️
              </div>

              <div>
                <h1 className="text-3xl md:text-4xl font-bold">
                  KVK Management
                </h1>
                <p className="text-blue-100 mt-1">
                  View and manage approved KVK officers.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={loadOfficers}
              disabled={loading}
              className="bg-white text-blue-800 px-5 py-2.5 rounded-xl font-semibold hover:bg-blue-50 transition disabled:opacity-50"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </header>

        {/* Error */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 mb-6">
            <strong>Error:</strong> {errorMessage}
          </div>
        )}

        {/* Statistics */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7">
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-blue-700 font-medium">
              Total KVK Officers
            </p>
            <p className="text-4xl font-bold text-blue-900 mt-2">
              {loading ? "..." : totalOfficers}
            </p>
          </div>

          <div className="bg-green-50 border border-green-100 rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-green-700 font-medium">
              Active Officers
            </p>
            <p className="text-4xl font-bold text-green-900 mt-2">
              {loading ? "..." : activeOfficers}
            </p>
          </div>

          <div className="bg-red-50 border border-red-100 rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-red-700 font-medium">
              Disabled Officers
            </p>
            <p className="text-4xl font-bold text-red-900 mt-2">
              {loading ? "..." : disabledOfficers}
            </p>
          </div>
        </section>

        {/* Search and filter */}
        <section className="bg-white border border-green-100 rounded-2xl shadow-sm p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label
                htmlFor="kvk-search"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Search KVK Officers
              </label>

              <input
                id="kvk-search"
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, email, phone, district or KVK name..."
                className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>

            <div>
              <label
                htmlFor="district-filter"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                District
              </label>

              <select
                id="district-filter"
                value={districtFilter}
                onChange={(event) =>
                  setDistrictFilter(event.target.value)
                }
                className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-600 bg-white"
              >
                <option value="all">All Districts</option>

                {districts.map((district) => (
                  <option key={district} value={district}>
                    {district}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
            <p className="text-sm text-gray-600">
              Showing{" "}
              <strong>{filteredOfficers.length}</strong> of{" "}
              <strong>{officers.length}</strong> KVK officers
            </p>

            {(search || districtFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setDistrictFilter("all");
                }}
                className="text-green-700 font-semibold text-sm hover:underline"
              >
                Clear Filters
              </button>
            )}
          </div>
        </section>

        {/* Officer list */}
        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-10 text-center">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-700 rounded-full animate-spin mx-auto" />
            <p className="text-gray-600 mt-4">
              Loading KVK officers...
            </p>
          </div>
        ) : filteredOfficers.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-10 text-center">
            <div className="text-5xl">🏛️</div>

            <h2 className="text-xl font-bold text-gray-800 mt-4">
              No KVK Officers Found
            </h2>

            <p className="text-gray-600 mt-2">
              {officers.length === 0
                ? "No approved KVK officer accounts are currently available."
                : "No officers match your current search or district filter."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredOfficers.map((officer) => {
              const disabled = isDisabled(officer);
              const updating = updatingId === officer.id;

              return (
                <article
                  key={officer.id}
                  className="bg-white rounded-2xl shadow-sm border border-green-100 p-5 hover:shadow-lg transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-3xl shrink-0">
                        🏛️
                      </div>

                      <div className="min-w-0">
                        <h2 className="text-xl font-bold text-gray-900 truncate">
                          {getName(officer)}
                        </h2>

                        <p className="text-sm text-gray-500 truncate">
                          {getKvkName(officer)}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 ${
                        disabled
                          ? "bg-red-100 text-red-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {disabled ? "Disabled" : "Active"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5 text-sm">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-gray-500">Email</p>
                      <p className="font-semibold text-gray-800 break-all mt-1">
                        {officer.email || "Not provided"}
                      </p>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-gray-500">Phone</p>
                      <p className="font-semibold text-gray-800 mt-1">
                        {getPhone(officer)}
                      </p>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-gray-500">District</p>
                      <p className="font-semibold text-gray-800 mt-1">
                        {getDistrict(officer)}
                      </p>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-gray-500">State</p>
                      <p className="font-semibold text-gray-800 mt-1">
                        {getState(officer)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 mt-5">
                    <button
                      type="button"
                      onClick={() => setSelectedOfficer(officer)}
                      className="flex-1 min-w-[140px] border border-blue-200 bg-blue-50 text-blue-800 px-4 py-2.5 rounded-xl font-semibold hover:bg-blue-100 transition"
                    >
                      View Details
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleStatus(officer)}
                      disabled={updating}
                      className={`flex-1 min-w-[140px] px-4 py-2.5 rounded-xl font-semibold text-white transition disabled:opacity-50 ${
                        disabled
                          ? "bg-green-700 hover:bg-green-800"
                          : "bg-red-600 hover:bg-red-700"
                      }`}
                    >
                      {updating
                        ? "Updating..."
                        : disabled
                        ? "Enable Account"
                        : "Disable Account"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Details modal */}
      {selectedOfficer && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedOfficer(null);
            }
          }}
        >
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-900 to-green-700 text-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-4xl">🏛️</div>

                  <h2 className="text-2xl font-bold mt-3">
                    {getName(selectedOfficer)}
                  </h2>

                  <p className="text-blue-100 mt-1">
                    KVK Officer Details
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedOfficer(null)}
                  className="text-white/90 hover:text-white text-2xl"
                  aria-label="Close details"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  ["Name", getName(selectedOfficer)],
                  ["Email", selectedOfficer.email || "Not provided"],
                  ["Phone", getPhone(selectedOfficer)],
                  ["KVK / Institute", getKvkName(selectedOfficer)],
                  ["District", getDistrict(selectedOfficer)],
                  ["State", getState(selectedOfficer)],
                  [
                    "Status",
                    isDisabled(selectedOfficer)
                      ? "Disabled"
                      : "Active",
                  ],
                  ["User ID", selectedOfficer.id],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="bg-gray-50 rounded-xl p-4"
                  >
                    <p className="text-sm text-gray-500">
                      {label}
                    </p>
                    <p className="font-semibold text-gray-900 mt-1 break-words">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex justify-end mt-6">
                <button
                  type="button"
                  onClick={() => setSelectedOfficer(null)}
                  className="bg-gray-800 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-gray-900 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}