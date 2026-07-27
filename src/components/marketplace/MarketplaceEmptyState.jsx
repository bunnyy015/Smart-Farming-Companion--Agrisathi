export default function MarketplaceEmptyState({
  searchText,
  onClear,
  onRefresh,
}) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-green-100 p-8 text-center">
      <div className="text-5xl">🌱</div>

      <h2 className="text-xl font-bold text-green-900 mt-4">
        No products found
      </h2>

      <p className="text-gray-600 mt-2">
        {searchText
          ? "Try another product name or category."
          : "Nearby dealers have not added available products yet."}
      </p>

      <div className="flex flex-wrap justify-center gap-3 mt-5">
        {searchText && (
          <button
            type="button"
            onClick={onClear}
            className="border border-green-700 text-green-700 px-4 py-2.5 rounded-xl font-semibold"
          >
            Clear Search
          </button>
        )}

        <button
          type="button"
          onClick={onRefresh}
          className="bg-green-700 text-white px-4 py-2.5 rounded-xl font-semibold"
        >
          Refresh Products
        </button>
      </div>
    </section>
  );
}