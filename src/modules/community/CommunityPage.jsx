import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  get,
  onValue,
  push,
  ref,
  remove,
  set,
  update,
} from "firebase/database";
import { auth, database } from "../../firebase";
import StatusMessage from "../../components/StatusMessage";

const emptyForm = {
  title: "",
  content: "",
  category: "Question",
  crop: "",
};

export default function CommunityPage() {
  const navigate = useNavigate();

  const [currentProfile, setCurrentProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchText, setSearchText] = useState("");
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let unsubscribe = () => {};

    async function initializeCommunity() {
      try {
        const currentUser = auth.currentUser;

        if (!currentUser) {
          navigate("/login", { replace: true });
          return;
        }

        const profileSnapshot = await get(
          ref(database, `users/${currentUser.uid}`)
        );

        if (!profileSnapshot.exists()) {
          showMessage("error", "User profile was not found.");
          return;
        }

        const profile = {
          uid: currentUser.uid,
          ...profileSnapshot.val(),
        };

        setCurrentProfile(profile);

        unsubscribe = onValue(
          ref(database, "communityPosts"),
          (snapshot) => {
            if (!snapshot.exists()) {
              setPosts([]);
              setLoading(false);
              return;
            }

            const postList = Object.entries(snapshot.val())
              .map(([id, value]) => ({
                id,
                ...value,
              }))
              .sort(
                (first, second) =>
                  new Date(second.createdAt || 0) -
                  new Date(first.createdAt || 0)
              );

            setPosts(postList);
            setLoading(false);
          },
          (error) => {
            console.error("Community loading error:", error);
            showMessage(
              "error",
              "Community posts could not be loaded."
            );
            setLoading(false);
          }
        );
      } catch (error) {
        console.error("Community initialization error:", error);
        showMessage("error", "Community could not be opened.");
        setLoading(false);
      }
    }

    initializeCommunity();

    return () => unsubscribe();
  }, [navigate]);

  const filteredPosts = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return posts.filter((post) => {
      const categoryMatches =
        selectedCategory === "All" ||
        post.category === selectedCategory;

      if (!categoryMatches) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchableText = [
        post.title,
        post.content,
        post.crop,
        post.authorName,
        post.district,
        post.category,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [posts, searchText, selectedCategory]);

  function showMessage(type, text) {
    setMessage({ type, text });

    window.setTimeout(() => {
      setMessage(null);
    }, 5000);
  }

  function handleFormChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function createPost(event) {
    event.preventDefault();

    if (!currentProfile) {
      return;
    }

    const title = form.title.trim();
    const content = form.content.trim();

    if (!title) {
      showMessage("warning", "Enter a short post title.");
      return;
    }

    if (!content) {
      showMessage("warning", "Enter your question or message.");
      return;
    }

    try {
      setCreating(true);

      const postReference = push(
        ref(database, "communityPosts")
      );

      const now = new Date().toISOString();

      await set(postReference, {
        authorUid: currentProfile.uid,

        authorName:
          currentProfile.fullName ||
          currentProfile.farmerName ||
          currentProfile.dealerName ||
          currentProfile.name ||
          "AgriSaathi User",

        authorRole: currentProfile.role || "farmer",

        district: currentProfile.district || "",
        state: currentProfile.state || "",

        title,
        content,
        category: form.category,
        crop: form.crop.trim(),

        likes: {},
        likeCount: 0,

        createdAt: now,
        updatedAt: now,
      });

      setForm(emptyForm);

      showMessage(
        "success",
        "Your post was shared with the community."
      );
    } catch (error) {
      console.error("Create post error:", error);

      showMessage(
        "error",
        "Your post could not be shared."
      );
    } finally {
      setCreating(false);
    }
  }

  async function toggleLike(post) {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      navigate("/login", { replace: true });
      return;
    }

    try {
      const alreadyLiked = Boolean(
        post.likes?.[currentUser.uid]
      );

      const updates = {};

      updates[
        `communityPosts/${post.id}/likes/${currentUser.uid}`
      ] = alreadyLiked ? null : true;

      updates[
        `communityPosts/${post.id}/likeCount`
      ] = Math.max(
        0,
        Number(post.likeCount || 0) +
          (alreadyLiked ? -1 : 1)
      );

      await update(ref(database), updates);
    } catch (error) {
      console.error("Like post error:", error);
      showMessage("error", "Like could not be updated.");
    }
  }

  async function deletePost() {
    if (!deleteTarget || !currentProfile) {
      return;
    }

    try {
      const canDelete =
        deleteTarget.authorUid === currentProfile.uid ||
        currentProfile.role === "admin";

      if (!canDelete) {
        showMessage(
          "error",
          "You cannot delete this post."
        );
        setDeleteTarget(null);
        return;
      }

      await remove(
        ref(
          database,
          `communityPosts/${deleteTarget.id}`
        )
      );

      setDeleteTarget(null);
      showMessage("success", "Post deleted.");
    } catch (error) {
      console.error("Delete post error:", error);
      showMessage("error", "Post could not be deleted.");
    }
  }

  function getRoleBadge(role) {
    const badges = {
      farmer: {
        label: "Farmer",
        className: "bg-green-100 text-green-700",
      },
      dealer: {
        label: "Dealer",
        className: "bg-blue-100 text-blue-700",
      },
      kvk: {
        label: "KVK Officer",
        className: "bg-purple-100 text-purple-700",
      },
      admin: {
        label: "Admin",
        className: "bg-red-100 text-red-700",
      },
    };

    return (
      badges[role] || {
        label: "Member",
        className: "bg-gray-100 text-gray-700",
      }
    );
  }

  function getCategoryIcon(category) {
    const icons = {
      Question: "❓",
      Advice: "💡",
      Experience: "🌱",
      Alert: "⚠️",
      Announcement: "📢",
    };

    return icons[category] || "💬";
  }

  function getBackPath() {
    const role = currentProfile?.role;

    if (role === "dealer") return "/dealer";
    if (role === "kvk") return "/kvk";
    if (role === "admin") return "/admin";

    return "/dashboard";
  }

  const categories = [
    "All",
    "Question",
    "Advice",
    "Experience",
    "Alert",
    "Announcement",
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm p-7 text-center">
          <div className="text-5xl">👥</div>

          <h1 className="text-xl font-bold text-green-900 mt-4">
            Loading community
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <StatusMessage
          message={message}
          onClose={() => setMessage(null)}
        />

        {deleteTarget && (
          <section className="bg-white border border-red-200 rounded-2xl shadow-lg p-5 mb-5">
            <h2 className="text-lg font-bold text-red-700">
              Delete this post?
            </h2>

            <p className="text-sm text-gray-600 mt-1">
              This action cannot be undone.
            </p>

            <div className="bg-gray-50 rounded-xl p-3 mt-3">
              <p className="font-semibold">
                {deleteTarget.title}
              </p>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={deletePost}
                className="bg-red-600 text-white px-4 py-2.5 rounded-xl font-semibold"
              >
                Delete Post
              </button>

              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="border border-gray-300 px-4 py-2.5 rounded-xl font-semibold"
              >
                Go Back
              </button>
            </div>
          </section>
        )}

        <header className="bg-gradient-to-r from-green-800 to-green-600 text-white rounded-2xl shadow p-5">
          <button
            type="button"
            onClick={() => navigate(getBackPath())}
            className="text-green-100 font-semibold"
          >
            ← Dashboard
          </button>

          <h1 className="text-3xl font-bold mt-3">
            👥 Farming Community
          </h1>

          <p className="text-green-100 mt-1">
            Ask questions and share farming knowledge.
          </p>

          <div className="bg-white/15 rounded-xl p-3 mt-4 text-sm">
            📍 Community posts from farmers, dealers and
            agriculture officers.
          </div>
        </header>

        <section className="bg-white rounded-2xl border border-green-100 shadow-sm p-5 mt-5">
          <h2 className="text-xl font-bold text-green-900">
            ✍️ Share with Community
          </h2>

          <form onSubmit={createPost} className="mt-4 space-y-3">
            <input
              name="title"
              value={form.title}
              onChange={handleFormChange}
              placeholder="Short title"
              className="w-full border border-gray-300 rounded-xl px-4 py-3"
            />

            <textarea
              name="content"
              value={form.content}
              onChange={handleFormChange}
              placeholder="Ask a question or share advice..."
              rows="4"
              className="w-full border border-gray-300 rounded-xl px-4 py-3"
            />

            <div className="grid sm:grid-cols-2 gap-3">
              <select
                name="category"
                value={form.category}
                onChange={handleFormChange}
                className="w-full border border-gray-300 rounded-xl px-4 py-3"
              >
                <option value="Question">Question</option>
                <option value="Advice">Advice</option>
                <option value="Experience">Experience</option>
                <option value="Alert">Alert</option>
                <option value="Announcement">
                  Announcement
                </option>
              </select>

              <input
                name="crop"
                value={form.crop}
                onChange={handleFormChange}
                placeholder="Crop name (optional)"
                className="w-full border border-gray-300 rounded-xl px-4 py-3"
              />
            </div>

            <button
              type="submit"
              disabled={creating}
              className="bg-green-700 text-white px-5 py-3 rounded-xl font-semibold disabled:bg-gray-400"
            >
              {creating ? "Sharing..." : "Share Post"}
            </button>
          </form>
        </section>

        <section className="bg-white rounded-2xl border border-green-100 shadow-sm p-4 mt-5">
          <label className="font-semibold text-gray-800">
            🔍 Search community
          </label>

          <input
            type="search"
            value={searchText}
            onChange={(event) =>
              setSearchText(event.target.value)
            }
            placeholder="Crop, question or district"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-2"
          />
        </section>

        <section className="flex gap-2 overflow-x-auto py-5">
          {categories.map((category) => (
            <button
              type="button"
              key={category}
              onClick={() =>
                setSelectedCategory(category)
              }
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold ${
                selectedCategory === category
                  ? "bg-green-700 text-white"
                  : "bg-white border border-green-200 text-green-800"
              }`}
            >
              {category}
            </button>
          ))}
        </section>

        {filteredPosts.length === 0 ? (
          <section className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <div className="text-5xl">🌱</div>

            <h2 className="text-xl font-bold text-green-900 mt-4">
              No community posts
            </h2>

            <p className="text-gray-600 mt-2">
              Be the first person to share a farming question.
            </p>
          </section>
        ) : (
          <section className="space-y-4">
            {filteredPosts.map((post) => {
              const badge = getRoleBadge(post.authorRole);

              const currentUserLiked = Boolean(
                post.likes?.[auth.currentUser?.uid]
              );

              const canDelete =
                post.authorUid === currentProfile?.uid ||
                currentProfile?.role === "admin";

              return (
                <article
                  key={post.id}
                  className="bg-white rounded-2xl border border-green-100 shadow-sm p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-gray-900">
                          {post.authorName || "Community Member"}
                        </p>

                        <span
                          className={`${badge.className} px-2.5 py-1 rounded-full text-xs font-semibold`}
                        >
                          {badge.label}
                        </span>
                      </div>

                      <p className="text-xs text-gray-500 mt-1">
                        📍 {post.district || post.state || "Location not added"}
                      </p>
                    </div>

                    <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
                      {getCategoryIcon(post.category)}{" "}
                      {post.category}
                    </span>
                  </div>

                  <h2 className="text-xl font-bold text-green-900 mt-4">
                    {post.title}
                  </h2>

                  <p className="text-gray-700 mt-2 whitespace-pre-wrap">
                    {post.content}
                  </p>

                  {post.crop && (
                    <span className="inline-block bg-yellow-50 text-yellow-800 px-3 py-1 rounded-full text-xs font-semibold mt-3">
                      🌾 {post.crop}
                    </span>
                  )}

                  <p className="text-xs text-gray-500 mt-4">
                    {post.createdAt
                      ? new Date(post.createdAt).toLocaleString("en-IN")
                      : ""}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 mt-4 pt-4">
                    <button
                      type="button"
                      onClick={() => toggleLike(post)}
                      className={`px-4 py-2 rounded-xl font-semibold ${
                        currentUserLiked
                          ? "bg-green-700 text-white"
                          : "bg-green-50 text-green-700"
                      }`}
                    >
                      👍 {Number(post.likeCount || 0)}
                    </button>

                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(post)}
                        className="border border-red-200 text-red-700 px-4 py-2 rounded-xl font-semibold"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}