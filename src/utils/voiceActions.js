export function executeVoiceAction(action, navigate) {
  switch (action) {
    case "weather":
      navigate("/weather");
      return true;

    case "crop_disease":
      navigate("/crop-disease");
      return true;

    case "market_prices":
      navigate("/market-prices");
      return true;

    case "government_schemes":
      navigate("/govt-schemes");
      return true;

    case "dealer_products":
      navigate("/farmer/dealer-products");
      return true;

    case "farmer_orders":
      navigate("/farmer/orders");
      return true;

    case "community":
      navigate("/community");
      return true;

    case "profile":
      navigate("/profile");
      return true;

    case "dashboard":
      navigate("/dashboard");
      return true;

    default:
      return false;
  }
}