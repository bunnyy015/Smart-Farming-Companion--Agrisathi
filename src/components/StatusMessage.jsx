export default function StatusMessage({
  message,
  onClose,
}) {
  if (!message) {
    return null;
  }

  const styles = {
    success: {
      box: "bg-green-50 border-green-500 text-green-800",
      icon: "✅",
    },

    error: {
      box: "bg-red-50 border-red-500 text-red-800",
      icon: "❌",
    },

    warning: {
      box: "bg-yellow-50 border-yellow-500 text-yellow-800",
      icon: "⚠️",
    },

    info: {
      box: "bg-blue-50 border-blue-500 text-blue-800",
      icon: "ℹ️",
    },
  };

  const selectedStyle =
    styles[message.type] || styles.info;

  return (
    <div
      role="alert"
      className={`border-l-4 rounded-xl p-4 mb-5 shadow-sm ${selectedStyle.box}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span aria-hidden="true">
            {selectedStyle.icon}
          </span>

          <p className="font-semibold">
            {message.text}
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close message"
            className="font-bold opacity-70 hover:opacity-100"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}