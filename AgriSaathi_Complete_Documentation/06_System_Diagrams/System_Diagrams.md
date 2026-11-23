# System Diagrams

## Architecture

```mermaid
flowchart LR
  U[Farmer / Dealer / Admin] --> UI[React 19 + Vite SPA]
  UI --> AUTH[Firebase Authentication]
  UI --> RTDB[(Firebase Realtime Database)]
  UI --> GEO[Browser or Capacitor location]
  UI --> WX[Open-Meteo forecast API]
  UI --> GEOAPI[Geocoding and nearby-service providers]
  UI --> AI[Gemini API integrations]
  UI --> IMG[Cloudinary uploads]
  UI --> MP[Market prices proxy]
  MP --> GOV[data.gov.in / AGMARKNET]
  UI --> FN[Firebase callable Functions]
  FN --> GOV
  FN --> WA[WhatsApp Cloud API]
  FN --> FS[(Firestore delivery ledger)]
```

## Reservation workflow

```mermaid
sequenceDiagram
  Farmer->>Marketplace: Browse dealer product
  Marketplace->>Realtime Database: Read dealerProducts
  Farmer->>Marketplace: Submit reservation
  Marketplace->>Realtime Database: Create dealerOrders record
  Dealer->>Orders: Review and update status
  Orders->>Realtime Database: Write permitted status transition
  Realtime Database-->>Farmer: Updated reservation state
```

## Use cases

```mermaid
flowchart TB
  Farmer((Farmer)) --> F1[View weather and market prices]
  Farmer --> F2[Review schemes and nearby services]
  Farmer --> F3[Analyze crop image]
  Farmer --> F4[Browse and reserve dealer products]
  Dealer((Dealer)) --> D1[Manage products and stock]
  Dealer --> D2[Process reservations]
  Dealer --> D3[Review sales and profile]
  Admin((Admin)) --> A1[Manage users, dealers, schemes and prices]
  Admin --> A2[Review reports and platform records]
```

Diagrams summarize code-observed integrations. Optional provider configuration and deployment are environment-dependent.
