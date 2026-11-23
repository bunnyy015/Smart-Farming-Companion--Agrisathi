# Database Structure

AgriSaathi uses Firebase Realtime Database for application records. Firebase Authentication provides identities; user records are keyed by Firebase UID. `database.rules.json` is the checked-in rules file. Firestore is used by the optional Cloud Function for WhatsApp delivery idempotency (`whatsappDelivery`), not as the main application database.

## Principal paths observed in code and rules

| Path | Purpose / observed shape | Access summary from checked-in rules |
|---|---|---|
| `users/{uid}` | Account role, status, contact and profile fields | Owner/admin writes; reads owner/admin and certain dealer profile lookup cases |
| `farmers/{uid}` | Farmer profile and farm details, including crops/location/land fields | Owner/admin writes; farmer owner, dealers and admins read |
| `dealerProfiles/{uid}` | Dealer shop/profile | Owner dealer/admin writes; owner/admin reads |
| `dealerRequests/{uid}` | Dealer registration requests | Requesting UID/admin read/write; admin root read |
| `dealerProducts/{dealerUid}/{productId}` | Dealer catalogue, price, quantity and reserved/sold counts | Authenticated read; owning dealer/admin write with product validation |
| `dealerOrders/{orderId}` | Farmer reservation, dealer status and completion/archive metadata | Farmer/dealer scoped queries and admin access; write rules constrain create/status flows and selected fields |
| `sales/{dealerUid}` | Dealer sales summaries/records | Dealer/admin access |
| `marketPrices` | Market price records administered in-app | Authenticated read; admin write |
| `governmentSchemes`, `schemes` | Current and legacy scheme records | Authenticated read; admin write |
| `communityPosts/{postId}` | Community content | Authenticated read/write under current rules; tighten authorship/moderation before production |
| `notificationTokens/{uid}/{tokenKey}` | FCM token and update timestamp | Owner write/read with validation |
| `diseaseReports/{reportId}` | Disease summary report (crop, disease, confidence, imageEnhanced, createdAt) | Farmer create-only, with owner UID and field validation |

Rules are source evidence, not proof that deployed Firebase rules match. Compare the Firebase Console's published rules with this file before release. Do not use broad root-level permissions.

## Example records (synthetic)

```json
{
  "users": { "demo-farmer-uid": { "role": "farmer", "status": "active", "name": "Sample Farmer" } },
  "farmers": { "demo-farmer-uid": { "selectedCrops": ["Paddy", "Cotton"], "district": "Example District", "landSize": 2, "soilType": "Red soil" } },
  "dealerProducts": { "demo-dealer-uid": { "demo-product-id": { "productName": "Sample input", "category": "Fertilizer", "price": 500, "quantity": 20, "unit": "bag", "dealerUid": "demo-dealer-uid", "reservedQuantity": 0, "soldQuantity": 0 } } },
  "dealerOrders": { "demo-order-id": { "farmerUid": "demo-farmer-uid", "dealerUid": "demo-dealer-uid", "productName": "Sample input", "price": 500, "quantity": 1, "totalAmount": 500, "status": "pending" } }
}
```

The example values are synthetic. Exact optional fields vary by workflow; inspect the relevant page/service before adding fields. Back up using Firebase Console export or an authorized Admin SDK process, store backups privately, and periodically test restore procedures. Do not include real user records in academic materials.
