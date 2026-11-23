# Installation Instructions

## Local Windows 10/11 setup

1. Install Node.js LTS from https://nodejs.org/en/download/ (Vite 8 requires Node.js 20.19+ or 22.12+; use a supported LTS release). npm is included with Node.js.
2. Install Git for Windows from https://git-scm.com/download/win and VS Code from https://code.visualstudio.com/Download. Chrome is useful for browser testing; it is not required to build.
3. Obtain the repository from https://github.com/bunnyy015/Smart-Farming-Companion--Agrisathi or extract `AgriSaathi_Source.zip`.
4. Open the project folder in VS Code, open Terminal, and run:

```powershell
node --version
npm --version
npm install
```

5. Create `.env` from `.env.example`. Set API values only for features requiring them. `VITE_*` values are exposed in the built client bundle; never put server secrets there.
6. Configure Firebase Authentication providers and Realtime Database for the Firebase project. Configure Realtime Database rules from `database.rules.json`. The repository's `src/firebase.js` currently contains client configuration in source; use your own Firebase project's web app configuration.
7. Start the development server with `npm run dev`. Open the URL Vite prints (normally `http://localhost:5173`).
8. Run `npm run lint` and `npm run build` for static checks and production build.

## Optional services and mobile build

- Weather uses Open-Meteo; browser/device location permission is needed for local results.
- Web market prices use the Vite `/api/market-prices` proxy; native Capacitor uses the callable `fetchMarketPricePage` function. Configure `DATA_GOV_API_KEY` server-side for the function. The web development proxy configuration must also be checked in `vite.config.js`.
- AI crop analysis and voice responses use a Gemini API key configured by the app. Because Vite variables are public, use a restricted key and do not treat it as a server secret.
- Product image uploads use Cloudinary configuration where enabled.
- Push messaging uses Firebase Messaging and a VAPID public key.
- WhatsApp order updates use Firebase Functions and approved WhatsApp Business templates. This is optional and requires Meta configuration, opt-in, secrets, Firestore and a deploy. Do not enable it just to run the web demo.
- Android requires Android Studio, Android SDK and a configured device/emulator. `npm run android:sync` builds the web app and syncs Capacitor; `npm run android:open` opens Android Studio.

## Troubleshooting

| Symptom | Check |
|---|---|
| `npm` not recognized | Reinstall Node.js LTS and reopen the terminal. |
| Vite reports unsupported Node | Install Node 20.19+ or 22.12+, then run `npm install` again. |
| Firebase permission denied | Confirm signed-in role and published Realtime Database rules. |
| Market prices unavailable | Verify network, AGMARKNET API key/proxy or deployed callable function configuration. |
| Location unavailable | Use HTTPS or localhost, allow location permission, and check device location services. |
| Voice says no speech | Check Chrome microphone permission, selected speech language, input device and internet; browser speech recognition availability varies. |
| Product images fail | Verify Cloudinary cloud name and upload preset; use a configured valid preset. |
| Port is occupied | Use the alternative URL/port printed by Vite or stop the process using the port. |

## Official references

- Node.js: https://nodejs.org/en/download/
- Vite: https://vite.dev/guide/
- VS Code: https://code.visualstudio.com/docs/setup/windows
- Git: https://git-scm.com/book/en/v2/Getting-Started-Installing-Git
- Firebase web setup: https://firebase.google.com/docs/web/setup
- Firebase Realtime Database rules: https://firebase.google.com/docs/database/security
- Capacitor Android: https://capacitorjs.com/docs/android
- Android Studio: https://developer.android.com/studio
- Open-Meteo API: https://open-meteo.com/en/docs
- data.gov.in API: https://www.data.gov.in/help/how-use-api
- Nominatim usage policy: https://operations.osmfoundation.org/policies/nominatim/
- Cloudinary upload: https://cloudinary.com/documentation/upload_images
- WhatsApp Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api/
