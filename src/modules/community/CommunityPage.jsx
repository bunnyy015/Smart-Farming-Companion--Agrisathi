import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ref, get, push, set, update } from "firebase/database";
import { auth, database } from "../../firebase";

export default function CommunityPage() {
  const navigate = useNavigate();

  const [posts, setPosts] = useState([]);
  const [userData, setUserData] = useState(null);
  const [commentText, setCommentText] = useState({});
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    crop: "",
    title: "",
    description: "",
    district: "",
  });

  useEffect(() => {
    loadUserAndPosts();
  }, []);

  function handleChange(event) {
    setForm({
      ...form,
      [event.target.name]: event.target.value,
    });
  }

  async function loadUserAndPosts() {
    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        navigate("/login");
        return;
      }

      const userSnapshot = await get(ref(database, `users/${currentUser.uid}`));

      if (userSnapshot.exists()) {
        setUserData({
          uid: currentUser.uid,
          ...userSnapshot.val(),
        });
      }

      const postsSnapshot = await get(ref(database, "communityPosts"));

      if (!postsSnapshot.exists()) {
        setPosts([]);
        return;
      }

      const data = postsSnapshot.val();

      const list = Object.entries(data).map(([id, value]) => ({
        id,
        ...value,
      }));

      setPosts(list.reverse());
    } catch (error) {
      console.error(error);
      alert("Failed to load community posts.");
    } finally {
      setLoading(false);
    }
  }

  async function createPost(event) {
    event.preventDefault();

    if (!form.title.trim()) {
      alert("Please enter post title.");
      return;
    }

    if (!form.description.trim()) {
      alert("Please enter description.");
      return;
    }

    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        navigate("/login");
        return;
      }

      const postRef = push(ref(database, "communityPosts"));

      await set(postRef, {
        farmerUid: currentUser.uid,
        farmerName:
          userData?.fullName ||
          userData?.name ||
          userData?.farmerName ||
          userData?.dealerName ||
          userData?.officerName ||
          "AgriSaathi User",
        role: userData?.role || "farmer",
        crop: form.crop,
        title: form.title,
        description: form.description,
        district: form.district || userData?.district || "",
        likes: 0,
        likedBy: {},
        comments: {},
        createdAt: new Date().toISOString(),
      });

      setForm({
        crop: "",
        title: "",
        description: "",
        district: "",
      });

      alert("Post shared successfully.");
      loadUserAndPosts();
    } catch (error) {
      console.error(error);
      alert("Failed to create post.");
    }
  }

  async function likePost(post) {
    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        navigate("/login");
        return;
      }

      const likedBy = post.likedBy || {};

      if (likedBy[currentUser.uid]) {
        alert("You already liked this post.");
        return;
      }

      await update(ref(database, `communityPosts/${post.id}`), {
        likes: Number(post.likes || 0) + 1,
        [`likedBy/${currentUser.uid}`]: true,
      });

      loadUserAndPosts();
    } catch (error) {
      console.error(error);
      alert("Failed to like post.");
    }
  }

  async function addComment(postId) {
    const text = commentText[postId];

    if (!text || !text.trim()) {
      alert("Please write a comment.");
      return;
    }

    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        navigate("/login");
        return;
      }

      const commentRef = push(
        ref(database, `communityPosts/${postId}/comments`)
      );

      await set(commentRef, {
        userUid: currentUser.uid,
        userName:
          userData?.fullName ||
          userData?.name ||
          userData?.farmerName ||
          userData?.dealerName ||
          userData?.officerName ||
          "AgriSaathi User",
        role: userData?.role || "farmer",
        text,
        createdAt: new Date().toISOString(),
      });

      setCommentText({
        ...commentText,
        [postId]: "",
      });

      loadUserAndPosts();
    } catch (error) {
      console.error(error);
      alert("Failed to add comment.");
    }
  }

  function getRoleBadge(role) {
    if (role === "kvk") {
      return "bg-blue-100 text-blue-700";
    }

    if (role === "dealer") {
      return "bg-purple-100 text-purple-700";
    }

    if (role === "admin") {
      return "bg-red-100 text-red-700";
    }

    return "bg-green-100 text-green-700";
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center">
        <h1 className="text-2xl font-bold text-green-700">
          Loading Farmer Community...
        </h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="bg-green-700 text-white rounded-2xl shadow-lg p-6 mb-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-sm mb-3"
          >
            ← Back
          </button>

          <h1 className="text-4xl font-bold">
            👥 Farmer Community
          </h1>

          <p className="text-green-100 mt-2">
            Ask questions, share farming problems, and get help from farmers,
            KVK officers, and dealers.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-green-700 mb-4">
            Create Community Post
          </h2>

          <form onSubmit={createPost} className="space-y-4">
            <input
              name="crop"
              placeholder="Crop name example: Rice, Tomato, Cotton"
              value={form.crop}
              onChange={handleChange}
              className="w-full border border-gray-300 p-3 rounded-lg"
            />

            <input
              name="title"
              placeholder="Post title"
              value={form.title}
              onChange={handleChange}
              className="w-full border border-gray-300 p-3 rounded-lg"
            />

            <textarea
              name="description"
              placeholder="Describe your crop problem or farming question"
              value={form.description}
              onChange={handleChange}
              rows={4}
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
              className="w-full bg-green-700 text-white py-3 rounded-lg font-semibold"
            >
              Share Post
            </button>
          </form>
        </div>

        <div className="space-y-5">
          {posts.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
              <h2 className="text-2xl font-bold text-green-700">
                No community posts yet
              </h2>

              <p className="text-gray-600 mt-2">
                Be the first farmer to ask a question.
              </p>
            </div>
          ) : (
            posts.map((post) => {
              const comments = post.comments
                ? Object.entries(post.comments).map(([id, value]) => ({
                    id,
                    ...value,
                  }))
                : [];

              return (
                <div
                  key={post.id}
                  className="bg-white rounded-2xl shadow-lg p-6"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div>
                      <h2 className="text-2xl font-bold text-green-700">
                        {post.title}
                      </h2>

                      <p className="text-sm text-gray-500 mt-1">
                        By {post.farmerName} • {post.district || "District not added"}
                      </p>

                      <span
                        className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${getRoleBadge(
                          post.role
                        )}`}
                      >
                        {post.role || "farmer"}
                      </span>
                    </div>

                    <div className="text-sm text-gray-500">
                      {post.createdAt
                        ? new Date(post.createdAt).toLocaleString()
                        : ""}
                    </div>
                  </div>

                  {post.crop && (
                    <p className="text-sm text-gray-600 mt-4">
                      <b>Crop:</b> {post.crop}
                    </p>
                  )}

                  <p className="text-gray-700 mt-3">
                    {post.description}
                  </p>

                  <div className="flex gap-3 mt-5">
                    <button
                      onClick={() => likePost(post)}
                      className="bg-green-100 text-green-700 px-4 py-2 rounded-lg font-semibold"
                    >
                      👍 Like ({post.likes || 0})
                    </button>
                  </div>

                  <div className="mt-6">
                    <h3 className="font-bold text-green-700 mb-3">
                      Comments
                    </h3>

                    {comments.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        No comments yet.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {comments.map((comment) => (
                          <div
                            key={comment.id}
                            className="bg-green-50 border border-green-100 rounded-xl p-3"
                          >
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-green-700">
                                {comment.userName}
                              </p>

                              <span
                                className={`px-2 py-1 rounded-full text-xs font-semibold ${getRoleBadge(
                                  comment.role
                                )}`}
                              >
                                {comment.role}
                              </span>
                            </div>

                            <p className="text-gray-700 mt-1">
                              {comment.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-col md:flex-row gap-3 mt-4">
                      <input
                        value={commentText[post.id] || ""}
                        onChange={(event) =>
                          setCommentText({
                            ...commentText,
                            [post.id]: event.target.value,
                          })
                        }
                        placeholder="Write a helpful comment..."
                        className="flex-1 border border-gray-300 p-3 rounded-lg"
                      />

                      <button
                        onClick={() => addComment(post.id)}
                        className="bg-green-700 text-white px-5 py-3 rounded-lg font-semibold"
                      >
                        Comment
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}