import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ref, get, push, set } from "firebase/database";
import { auth, database } from "../../firebase";

export default function KVKCommunityPage() {
  const navigate = useNavigate();

  const [officer, setOfficer] = useState(null);
  const [posts, setPosts] = useState([]);
  const [replyText, setReplyText] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        navigate("/login");
        return;
      }

      const officerSnapshot = await get(
        ref(database, `users/${currentUser.uid}`)
      );

      if (!officerSnapshot.exists()) {
        navigate("/login");
        return;
      }

      const officerData = officerSnapshot.val();

      if (officerData.role !== "kvk") {
        navigate("/role-selection");
        return;
      }

      setOfficer({
        uid: currentUser.uid,
        ...officerData,
      });

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

  async function addExpertReply(postId) {
    const text = replyText[postId];

    if (!text || !text.trim()) {
      alert("Please write expert reply.");
      return;
    }

    try {
      const currentUser = auth.currentUser;

      const commentRef = push(
        ref(database, `communityPosts/${postId}/comments`)
      );

      await set(commentRef, {
        userUid: currentUser.uid,
        userName: officer?.officerName || "KVK Officer",
        role: "kvk",
        expert: true,
        text,
        createdAt: new Date().toISOString(),
      });

      setReplyText({
        ...replyText,
        [postId]: "",
      });

      alert("Expert reply added.");
      loadData();
    } catch (error) {
      console.error(error);
      alert("Failed to add expert reply.");
    }
  }

  function getComments(post) {
    if (!post.comments) return [];

    return Object.entries(post.comments).map(([id, value]) => ({
      id,
      ...value,
    }));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center">
        <h1 className="text-2xl font-bold text-green-700">
          Loading Community Posts...
        </h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <button
            onClick={() => navigate("/kvk")}
            className="text-green-700 font-semibold mb-4"
          >
            ← Back to KVK Dashboard
          </button>

          <h1 className="text-4xl font-bold text-green-700">
            👥 Community Expert Replies
          </h1>

          <p className="text-gray-600 mt-2">
            Reply to farmer questions as a verified KVK expert.
          </p>
        </div>

        {posts.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <h2 className="text-2xl font-bold text-green-700">
              No community posts yet
            </h2>
          </div>
        ) : (
          <div className="space-y-5">
            {posts.map((post) => {
              const comments = getComments(post);

              return (
                <div
                  key={post.id}
                  className="bg-white rounded-2xl shadow-lg p-6"
                >
                  <h2 className="text-2xl font-bold text-green-700">
                    {post.title}
                  </h2>

                  <p className="text-sm text-gray-500 mt-1">
                    By {post.farmerName || "Farmer"} •{" "}
                    {post.district || "District not added"}
                  </p>

                  {post.crop && (
                    <p className="text-sm text-gray-600 mt-3">
                      <b>Crop:</b> {post.crop}
                    </p>
                  )}

                  <p className="text-gray-700 mt-3">
                    {post.description}
                  </p>

                  <div className="mt-5">
                    <h3 className="font-bold text-green-700">
                      Existing Comments
                    </h3>

                    {comments.length === 0 ? (
                      <p className="text-sm text-gray-500 mt-2">
                        No comments yet.
                      </p>
                    ) : (
                      <div className="space-y-3 mt-3">
                        {comments.map((comment) => (
                          <div
                            key={comment.id}
                            className={
                              comment.role === "kvk"
                                ? "bg-blue-50 border border-blue-200 rounded-xl p-3"
                                : "bg-green-50 border border-green-100 rounded-xl p-3"
                            }
                          >
                            <p className="font-semibold text-green-700">
                              {comment.userName}{" "}
                              {comment.role === "kvk" && "✅ KVK Expert"}
                            </p>

                            <p className="text-gray-700 mt-1">
                              {comment.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-5">
                    <textarea
                      value={replyText[post.id] || ""}
                      onChange={(event) =>
                        setReplyText({
                          ...replyText,
                          [post.id]: event.target.value,
                        })
                      }
                      placeholder="Write verified KVK expert advice..."
                      rows={3}
                      className="w-full border border-gray-300 p-3 rounded-lg"
                    />

                    <button
                      onClick={() => addExpertReply(post.id)}
                      className="bg-green-700 text-white px-5 py-3 rounded-lg font-semibold mt-3"
                    >
                      Add Expert Reply
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}