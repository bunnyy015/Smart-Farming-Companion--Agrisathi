export default function StatusMessage({ message }) {
  if (!message) return null;

  const colors = {
    success: "bg-green-100 border-green-500 text-green-800",
    error: "bg-red-100 border-red-500 text-red-800",
    warning: "bg-yellow-100 border-yellow-500 text-yellow-800",
    info: "bg-blue-100 border-blue-500 text-blue-800",
  };

  return (
    <div
      className={`border-l-4 rounded-lg p-4 mb-5 ${
        colors[message.type] || colors.info
      }`}
    >
      <p className="font-semibold">{message.text}</p>
    </div>
  );
}