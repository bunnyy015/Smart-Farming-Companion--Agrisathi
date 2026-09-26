import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  get,
  ref,
  update,
} from "firebase/database";

import { auth, database } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";
import "./DealerTheme.css";

/* =========================================================
   HELPERS
========================================================= */

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function getFirstValue(...values) {
  for (const value of values) {
    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      return value;
    }
  }

  return "";
}

function getDealerName(data) {
  return getFirstValue(
    data?.dealerName,
    data?.name,
    data?.businessName,
    data?.dealer?.dealerName,
    data?.dealer?.name
  );
}

function getShopName(data) {
  return getFirstValue(
    data?.shopName,
    data?.shop,
    data?.storeName,
    data?.businessName,
    data?.dealer?.shopName
  );
}

function getOwnerName(data) {
  return getFirstValue(
    data?.ownerName,
    data?.owner,
    data?.dealer?.ownerName
  );
}

function getPhone(data) {
  return getFirstValue(
    data?.phone,
    data?.mobile,
    data?.mobileNumber,
    data?.phoneNumber,
    data?.contactNumber
  );
}

function getLicenseNumber(data) {
  return getFirstValue(
    data?.licenseNumber,
    data?.licenseNo,
    data?.license,
    data?.dealerLicenseNumber
  );
}

function getGstNumber(data) {
  return getFirstValue(
    data?.gstNumber,
    data?.gstNo,
    data?.gst,
    data?.GSTNumber
  );
}

function getDistrict(data) {
  return getFirstValue(
    data?.district,
    data?.location?.district
  );
}

function getState(data) {
  return getFirstValue(
    data?.state,
    data?.location?.state
  );
}

function getAddress(data) {
  return getFirstValue(
    data?.address,
    data?.shopAddress,
    data?.businessAddress,
    data?.location?.address
  );
}

function getRole(data) {
  return normalize(
    getFirstValue(
      data?.role,
      data?.userRole
    )
  );
}

function getStatus(data) {
  return getFirstValue(
    data?.status,
    data?.accountStatus,
    data?.approvalStatus,
    "active"
  );
}

/* =========================================================
   EMPTY FORM
========================================================= */

const EMPTY_FORM = {
  dealerName: "",
  shopName: "",
  ownerName: "",
  email: "",
  phone: "",
  licenseNumber: "",
  gstNumber: "",
  district: "",
  state: "",
  address: "",
};

/* =========================================================
   MAIN PAGE
========================================================= */

export default function DealerProfilePage() {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] =
    useState(null);

  const [form, setForm] =
    useState(EMPTY_FORM);

  const [originalForm, setOriginalForm] =
    useState(EMPTY_FORM);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [editing, setEditing] =
    useState(false);

  const [message, setMessage] =
    useState(null);

  const [accountStatus, setAccountStatus] =
    useState("Active");

  const [createdAt, setCreatedAt] =
    useState("");

  const [updatedAt, setUpdatedAt] =
    useState("");

  /* =======================================================
     AUTH + LOAD PROFILE
  ======================================================= */

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            setCurrentUser(null);
            setLoading(false);

            navigate("/login", {
              replace: true,
            });

            return;
          }

          setCurrentUser(user);

          await loadDealerProfile(user);
        }
      );

    return () => unsubscribe();
  }, [navigate]);

  /* =======================================================
     LOAD DEALER PROFILE
  ======================================================= */

  async function loadDealerProfile(user) {
    try {
      setLoading(true);
      setMessage(null);

      const uid = user.uid;

      /*
       * -----------------------------------------------------
       * PRIMARY USER PROFILE
       * users/{uid}
       * -----------------------------------------------------
       */

      const userSnapshot =
        await get(
          ref(
            database,
            `users/${uid}`
          )
        );

      const userData =
        userSnapshot.exists()
          ? userSnapshot.val()
          : {};

      /*
       * -----------------------------------------------------
       * DEALER REQUEST
       *
       * Registration currently stores dealer information
       * here before/around admin approval.
       *
       * dealerRequests/{uid}
       * -----------------------------------------------------
       */

      let requestData = {};

      try {
        const requestSnapshot =
          await get(
            ref(
              database,
              `dealerRequests/${uid}`
            )
          );

        if (
          requestSnapshot.exists()
        ) {
          requestData =
            requestSnapshot.val() || {};
        }
      } catch (requestError) {
        console.warn(
          "Dealer request profile could not be read:",
          requestError
        );
      }

      /*
       * -----------------------------------------------------
       * OPTIONAL DEALER PROFILE BRANCH
       *
       * If the project already has:
       *
       * dealerProfiles/{uid}
       *
       * this page will also read it.
       *
       * -----------------------------------------------------
       */

      let dealerProfileData = {};

      try {
        const dealerProfileSnapshot =
          await get(
            ref(
              database,
              `dealerProfiles/${uid}`
            )
          );

        if (
          dealerProfileSnapshot.exists()
        ) {
          dealerProfileData =
            dealerProfileSnapshot.val() || {};
        }
      } catch (profileError) {
        console.warn(
          "Dealer profile branch could not be read:",
          profileError
        );
      }

      /*
       * -----------------------------------------------------
       * MERGE PROFILE DATA
       *
       * Priority:
       *
       * dealerProfiles
       *      ↓
       * users
       *      ↓
       * dealerRequests
       *      ↓
       * Firebase Authentication
       * -----------------------------------------------------
       */

      const mergedData = {
        ...requestData,
        ...userData,
        ...dealerProfileData,
      };

      const loadedForm = {
        dealerName:
          String(
            getDealerName(
              mergedData
            )
          ),

        shopName:
          String(
            getShopName(
              mergedData
            )
          ),

        ownerName:
          String(
            getOwnerName(
              mergedData
            )
          ),

        email:
          String(
            getFirstValue(
              mergedData?.email,
              user.email
            )
          ),

        phone:
          String(
            getPhone(
              mergedData
            )
          ),

        licenseNumber:
          String(
            getLicenseNumber(
              mergedData
            )
          ),

        gstNumber:
          String(
            getGstNumber(
              mergedData
            )
          ),

        district:
          String(
            getDistrict(
              mergedData
            )
          ),

        state:
          String(
            getState(
              mergedData
            )
          ),

        address:
          String(
            getAddress(
              mergedData
            )
          ),
      };

      setForm(
        loadedForm
      );

      setOriginalForm(
        loadedForm
      );

      setAccountStatus(
        String(
          getStatus(
            mergedData
          )
        )
          .replace(
            /^./,
            (character) =>
              character.toUpperCase()
          )
      );

      setCreatedAt(
        getFirstValue(
          mergedData?.createdAt,
          requestData?.createdAt,
          userData?.createdAt
        )
      );

      setUpdatedAt(
        getFirstValue(
          mergedData?.updatedAt,
          dealerProfileData?.updatedAt,
          userData?.updatedAt
        )
      );
    } catch (error) {
      console.error(
        "Dealer profile loading error:",
        error
      );

      const errorText =
        String(
          error?.message || ""
        ).toLowerCase();

      setMessage({
        type: "error",
        text:
          errorText.includes(
            "permission"
          )
            ? "Unable to load dealer information because Firebase access is restricted. Check the users profile read rule."
            : "Unable to load dealer information. Please refresh the page and try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     FORM CHANGE
  ======================================================= */

  function handleChange(event) {
    const {
      name,
      value,
    } = event.target;

    setForm(
      (current) => ({
        ...current,
        [name]: value,
      })
    );
  }

  /* =======================================================
     VALIDATION
  ======================================================= */

  function validateForm() {
    if (
      !form.dealerName.trim()
    ) {
      return "Dealer name is required.";
    }

    if (
      !form.shopName.trim()
    ) {
      return "Shop name is required.";
    }

    if (
      !form.ownerName.trim()
    ) {
      return "Owner name is required.";
    }

    if (
      !form.phone.trim()
    ) {
      return "Mobile number is required.";
    }

    if (
      !form.licenseNumber.trim()
    ) {
      return "License number is required.";
    }

    if (
      !form.district.trim()
    ) {
      return "District is required.";
    }

    if (
      !form.state.trim()
    ) {
      return "State is required.";
    }

    if (
      !form.address.trim()
    ) {
      return "Shop address is required.";
    }

    return "";
  }

  /* =======================================================
     SAVE PROFILE
  ======================================================= */

  async function handleSave() {
    if (!currentUser) {
      return;
    }

    const validationError =
      validateForm();

    if (validationError) {
      setMessage({
        type: "error",
        text: validationError,
      });

      return;
    }

    try {
      setSaving(true);
      setMessage(null);

      const uid =
        currentUser.uid;

      const now =
        new Date().toISOString();

      /*
       * -----------------------------------------------------
       * SAVE TO users/{uid}
       * -----------------------------------------------------
       */

      const userUpdates = {
        dealerName:
          form.dealerName.trim(),

        shopName:
          form.shopName.trim(),

        ownerName:
          form.ownerName.trim(),

        phone:
          form.phone.trim(),

        licenseNumber:
          form.licenseNumber.trim(),

        gstNumber:
          form.gstNumber.trim(),

        district:
          form.district.trim(),

        state:
          form.state.trim(),

        address:
          form.address.trim(),

        role: "dealer",

        updatedAt: now,
      };

      /*
       * -----------------------------------------------------
       * SAVE TO dealerProfiles/{uid}
       *
       * This creates a dedicated profile branch for the
       * dealer while keeping users/{uid} compatible with
       * the existing authentication/user structure.
       * -----------------------------------------------------
       */

      const dealerProfileUpdates = {
        uid,

        dealerName:
          form.dealerName.trim(),

        shopName:
          form.shopName.trim(),

        ownerName:
          form.ownerName.trim(),

        email:
          form.email.trim(),

        phone:
          form.phone.trim(),

        licenseNumber:
          form.licenseNumber.trim(),

        gstNumber:
          form.gstNumber.trim(),

        district:
          form.district.trim(),

        state:
          form.state.trim(),

        address:
          form.address.trim(),

        role: "dealer",

        status:
          accountStatus.toLowerCase(),

        updatedAt: now,
      };

      /*
       * -----------------------------------------------------
       * UPDATE BOTH PATHS AT ONCE
       * -----------------------------------------------------
       */

      await update(
        ref(database),
        {
          ...Object.fromEntries(
            Object.entries(
              userUpdates
            ).map(
              ([
                key,
                value,
              ]) => [
                `users/${uid}/${key}`,
                value,
              ]
            )
          ),

          ...Object.fromEntries(
            Object.entries(
              dealerProfileUpdates
            ).map(
              ([
                key,
                value,
              ]) => [
                `dealerProfiles/${uid}/${key}`,
                value,
              ]
            )
          ),
        }
      );

      /*
       * -----------------------------------------------------
       * UPDATE LOCAL STATE
       * -----------------------------------------------------
       */

      const savedForm = {
        ...form,
        dealerName:
          form.dealerName.trim(),
        shopName:
          form.shopName.trim(),
        ownerName:
          form.ownerName.trim(),
        email:
          form.email.trim(),
        phone:
          form.phone.trim(),
        licenseNumber:
          form.licenseNumber.trim(),
        gstNumber:
          form.gstNumber.trim(),
        district:
          form.district.trim(),
        state:
          form.state.trim(),
        address:
          form.address.trim(),
      };

      setForm(
        savedForm
      );

      setOriginalForm(
        savedForm
      );

      setUpdatedAt(
        now
      );

      setEditing(false);

      setMessage({
        type: "success",
        text:
          "Dealer profile updated successfully.",
      });
    } catch (error) {
      console.error(
        "Dealer profile save error:",
        error
      );

      const errorText =
        String(
          error?.message || ""
        ).toLowerCase();

      if (
        errorText.includes(
          "permission denied"
        ) ||
        errorText.includes(
          "permission_denied"
        )
      ) {
        setMessage({
          type: "error",
          text:
            "Firebase denied the profile update. Your database rules must allow the logged-in dealer to update their own profile.",
        });
      } else {
        setMessage({
          type: "error",
          text:
            "Dealer profile could not be saved. Please try again.",
        });
      }
    } finally {
      setSaving(false);
    }
  }

  /* =======================================================
     CANCEL EDIT
  ======================================================= */

  function handleCancel() {
    setForm(
      originalForm
    );

    setEditing(false);

    setMessage(null);
  }

  /* =======================================================
     REFRESH
  ======================================================= */

  async function handleRefresh() {
    if (!currentUser) {
      return;
    }

    await loadDealerProfile(
      currentUser
    );
  }

  /* =======================================================
     DATE FORMAT
  ======================================================= */

  function formatDate(value) {
    if (!value) {
      return "Not available";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return String(value);
    }

    return date.toLocaleString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  /* =======================================================
     LOADING SCREEN
  ======================================================= */

  if (loading) {
    return (
      <div className="dealer-theme min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl border border-blue-100 p-8 text-center max-w-md w-full">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white flex items-center justify-center text-3xl shadow-lg">
            👤
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mt-5">
            Loading Dealer Profile
          </h1>

          <p className="text-slate-500 mt-2">
            Loading your dealer information...
          </p>
        </div>
      </div>
    );
  }

  /* =======================================================
     MAIN RENDER
  ======================================================= */

  return (
    <div className="dealer-theme min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">

        {/* =================================================
            STATUS MESSAGE
        ================================================== */}

        <StatusMessage
          message={message}
          onClose={() =>
            setMessage(null)
          }
        />

        {/* =================================================
            HEADER
        ================================================== */}

        <header className="relative overflow-hidden bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 text-white rounded-3xl shadow-xl p-6 md:p-8 mb-6">

          <div className="absolute -top-20 -right-16 w-56 h-56 bg-white/10 rounded-full" />

          <div className="absolute -bottom-24 -left-12 w-52 h-52 bg-white/10 rounded-full" />

          <div className="relative">

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">

              <div className="flex items-center gap-4">

                <div className="w-16 h-16 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-4xl shadow-lg">
                  👤
                </div>

                <div>

                  <p className="text-blue-100 text-sm font-semibold uppercase tracking-wide">
                    AgriSaathi Dealer Portal
                  </p>

                  <h1 className="text-3xl md:text-4xl font-bold mt-1">
                    Dealer Profile
                  </h1>

                  <p className="text-blue-100 mt-1">
                    View and manage your dealer information.
                  </p>

                </div>

              </div>

              <div className="flex flex-wrap gap-3">

                <button
                  type="button"
                  onClick={() =>
                    navigate("/dealer")
                  }
                  className="bg-white/15 hover:bg-white/25 border border-white/25 px-4 py-2.5 rounded-xl font-semibold transition"
                >
                  ← Dashboard
                </button>

                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={saving}
                  className="bg-white text-blue-700 px-4 py-2.5 rounded-xl font-semibold hover:bg-blue-50 transition shadow-sm disabled:opacity-50"
                >
                  ↻ Refresh
                </button>

              </div>

            </div>

            <div className="mt-6 flex flex-wrap gap-3">

              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 px-4 py-2 rounded-xl text-sm">

                <span className="w-2.5 h-2.5 rounded-full bg-emerald-300" />

                Account {accountStatus}

              </div>

              {currentUser?.email && (
                <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 px-4 py-2 rounded-xl text-sm">
                  ✉️ {currentUser.email}
                </div>
              )}

            </div>

          </div>

        </header>

        {/* =================================================
            PROFILE CARD
        ================================================== */}

        <section className="bg-white border border-blue-100 rounded-3xl shadow-sm overflow-hidden">

          {/* TOP BAR */}

          <div className="p-5 md:p-6 border-b border-slate-100">

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

              <div>

                <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">
                  Business Information
                </p>

                <h2 className="text-2xl font-bold text-slate-900 mt-1">
                  Your Dealer Details
                </h2>

                <p className="text-sm text-slate-500 mt-1">
                  Keep your business and contact information up to date.
                </p>

              </div>

              {!editing ? (
                <button
                  type="button"
                  onClick={() => {
                    setMessage(null);
                    setEditing(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-semibold transition shadow-sm"
                >
                  ✏️ Edit Profile
                </button>
              ) : (
                <div className="flex flex-wrap gap-3">

                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={saving}
                    className="border border-slate-300 text-slate-700 px-5 py-3 rounded-xl font-semibold hover:bg-slate-50 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-semibold transition disabled:opacity-50"
                  >
                    {saving
                      ? "Saving..."
                      : "Save Changes"}
                  </button>

                </div>
              )}

            </div>

          </div>

          {/* =================================================
              FORM
          ================================================== */}

          <div className="p-5 md:p-6">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* DEALER NAME */}

              <ProfileField
                label="Dealer Name"
                name="dealerName"
                value={form.dealerName}
                editing={editing}
                onChange={handleChange}
                placeholder="Dealer name"
              />

              {/* SHOP NAME */}

              <ProfileField
                label="Shop / Business Name"
                name="shopName"
                value={form.shopName}
                editing={editing}
                onChange={handleChange}
                placeholder="Shop name"
              />

              {/* OWNER NAME */}

              <ProfileField
                label="Owner Name"
                name="ownerName"
                value={form.ownerName}
                editing={editing}
                onChange={handleChange}
                placeholder="Owner name"
              />

              {/* EMAIL */}

              <ProfileField
                label="Business Email"
                name="email"
                value={form.email}
                editing={false}
                type="email"
                placeholder="Business email"
                helper="Email is managed through your login account."
              />

              {/* PHONE */}

              <ProfileField
                label="Mobile Number"
                name="phone"
                value={form.phone}
                editing={editing}
                onChange={handleChange}
                placeholder="Mobile number"
              />

              {/* LICENSE */}

              <ProfileField
                label="License Number"
                name="licenseNumber"
                value={form.licenseNumber}
                editing={editing}
                onChange={handleChange}
                placeholder="Seed / fertilizer license number"
              />

              {/* GST */}

              <ProfileField
                label="GST Number"
                name="gstNumber"
                value={form.gstNumber}
                editing={editing}
                onChange={handleChange}
                placeholder="GST number"
                optional
              />

              {/* DISTRICT */}

              <ProfileField
                label="District"
                name="district"
                value={form.district}
                editing={editing}
                onChange={handleChange}
                placeholder="District"
              />

              {/* STATE */}

              <ProfileField
                label="State"
                name="state"
                value={form.state}
                editing={editing}
                onChange={handleChange}
                placeholder="State"
              />

            </div>

            {/* ADDRESS */}

            <div className="mt-5">

              <label
                htmlFor="dealer-address"
                className="block text-sm font-semibold text-slate-700 mb-2"
              >
                Shop Address
              </label>

              {editing ? (
                <textarea
                  id="dealer-address"
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Enter complete shop address"
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition resize-none"
                />
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 min-h-24 text-slate-800">
                  {form.address || (
                    <span className="text-slate-400">
                      Address not provided
                    </span>
                  )}
                </div>
              )}

            </div>

          </div>

        </section>

        {/* =================================================
            ACCOUNT INFORMATION
        ================================================== */}

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">

          <AccountInfoCard
            icon="🟢"
            label="Account Status"
            value={accountStatus}
          />

          <AccountInfoCard
            icon="📅"
            label="Registered"
            value={formatDate(createdAt)}
          />

          <AccountInfoCard
            icon="🔄"
            label="Last Updated"
            value={formatDate(updatedAt)}
          />

        </section>

        {/* =================================================
            SECURITY INFORMATION
        ================================================== */}

        <section className="bg-white border border-blue-100 rounded-3xl shadow-sm p-5 md:p-6 mt-6">

          <div className="flex items-start gap-4">

            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-2xl shrink-0">
              🔐
            </div>

            <div>

              <h2 className="text-lg font-bold text-slate-900">
                Login & Security
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                Your login email is connected to your AgriSaathi account.
                Password management is handled by Firebase Authentication.
              </p>

              <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-4">

                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Login Email
                </p>

                <p className="font-semibold text-slate-800 mt-1 break-all">
                  {form.email ||
                    currentUser?.email ||
                    "Not available"}
                </p>

              </div>

            </div>

          </div>

        </section>

        {/* =================================================
            FOOTER
        ================================================== */}

        <footer className="text-center py-8 text-sm text-slate-400">
          AgriSaathi · Dealer Profile
        </footer>

      </div>
    </div>
  );
}

/* =========================================================
   PROFILE FIELD
========================================================= */

function ProfileField({
  label,
  name,
  value,
  editing,
  onChange,
  type = "text",
  placeholder,
  helper,
  optional = false,
}) {
  return (
    <div>

      <label
        htmlFor={`dealer-${name}`}
        className="block text-sm font-semibold text-slate-700 mb-2"
      >
        {label}

        {optional && (
          <span className="text-slate-400 font-normal ml-1">
            (Optional)
          </span>
        )}
      </label>

      {editing ? (
        <input
          id={`dealer-${name}`}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full border border-slate-300 rounded-xl px-4 py-3 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
        />
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 min-h-[48px] flex items-center">
          <span
            className={
              value
                ? "text-slate-800 break-words"
                : "text-slate-400"
            }
          >
            {value ||
              "Not provided"}
          </span>
        </div>
      )}

      {helper && (
        <p className="text-xs text-slate-400 mt-1.5">
          {helper}
        </p>
      )}

    </div>
  );
}

/* =========================================================
   ACCOUNT INFO CARD
========================================================= */

function AccountInfoCard({
  icon,
  label,
  value,
}) {
  return (
    <div className="bg-white border border-blue-100 rounded-2xl shadow-sm p-5">

      <div className="flex items-center gap-3">

        <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-xl">
          {icon}
        </div>

        <div className="min-w-0">

          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {label}
          </p>

          <p className="font-bold text-slate-800 mt-1 break-words">
            {value}
          </p>

        </div>

      </div>

    </div>
  );
}