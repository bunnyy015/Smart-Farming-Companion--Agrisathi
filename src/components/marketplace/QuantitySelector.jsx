import useLanguage from "../../utils/useLanguage";
import { t } from "../../utils/language";

export default function QuantitySelector({
  value,
  minimum = 1,
  maximum = 1,
  disabled = false,
  onChange,
}) {
  const language = useLanguage();
  const quantity = Number(value || minimum);

  function decrease() {
    if (disabled || quantity <= minimum) {
      return;
    }

    onChange(quantity - 1);
  }

  function increase() {
    if (disabled || quantity >= maximum) {
      return;
    }

    onChange(quantity + 1);
  }

  return (
    <div className="inline-flex items-center rounded-xl border border-gray-300 bg-white overflow-hidden">
      <button
        type="button"
        disabled={disabled || quantity <= minimum}
        onClick={decrease}
        aria-label={t("decreaseQuantity", {}, language)}
        className="w-11 h-11 text-xl font-bold text-green-700 hover:bg-green-50 disabled:text-gray-300 disabled:cursor-not-allowed"
      >
        −
      </button>

      <div className="min-w-12 h-11 flex items-center justify-center border-x border-gray-200 font-bold text-gray-800">
        {quantity}
      </div>

      <button
        type="button"
        disabled={disabled || quantity >= maximum}
        onClick={increase}
        aria-label={t("increaseQuantity", {}, language)}
        className="w-11 h-11 text-xl font-bold text-green-700 hover:bg-green-50 disabled:text-gray-300 disabled:cursor-not-allowed"
      >
        +
      </button>
    </div>
  );
}
