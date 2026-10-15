# Vercel Deployment & Mobile App Download Guide

This guide explains how to deploy the **CLE Society Staff Attendance & Location System** on **Vercel**, configure environment variables and routing, and generate the downloadable **Mobile Application (Android APK & iOS PWA)**.

---

## 1. Architecture: How Vercel Fits In

```
                  ┌─────────────────────────────────────────┐
                  │             Vercel Platform             │
                  │  (Frontend React 19 + Vite 7 SPA)       │
                  │  URL: https://cle-attendance.vercel.app │
                  └───────────────────┬─────────────────────┘
                                      │
              ┌───────────────────────┴───────────────────────┐
              │                                               │
              ▼                                               ▼
   ┌──────────────────────┐                       ┌──────────────────────┐
   │ Mobile App Downloads │                       │   Backend REST API   │
   │  /download & /install│                       │ (Render/VPS/Docker)  │
   │ Android APK & PWA    │                       │ /api/* endpoints     │
   └──────────────────────┘                       └──────────────────────┘
```

- **Frontend on Vercel**: Vercel serves the compiled React Single Page Application (SPA) on its global edge CDN with instant HTTPS and automatic client-side routing.
- **Backend API**: The Express backend uses SQLite (`better-sqlite3`) which requires persistent local disk storage (available on Render via `render.yaml`, Railway, Fly.io, or your institution's VPS).
- **Vercel API Proxy**: Both `vercel.json` and `frontend/vercel.json` are preconfigured to proxy `/api/*` and `/downloads/*` to your backend so browser requests have zero CORS issues.

---

## 2. Deploying on Vercel (Step-by-Step)

### Option A: Deploy via Vercel Web Dashboard (Recommended)

1. **Push your code to GitHub**:
   Ensure your changes are pushed to your GitHub repository:
   ```bash
   git add .
   git commit -m "Configure Vercel deployment and mobile app download"
   git push origin main
   ```

2. **Import Project into Vercel**:
   - Go to [vercel.com](https://vercel.com) and log in with your GitHub account.
   - Click **"Add New..."** > **"Project"**.
   - Select your repository: `Sushmachonchannavar/CLE_Attendance`.

3. **Configure Project Settings**:
   - **Framework Preset**: `Vite` (automatically detected).
   - **Root Directory**: Leave as `./` (or select `frontend` if deploying frontend alone).
   - **Build Command**: `cd frontend && npm install && npm run build` (auto-loaded from `vercel.json`).
   - **Output Directory**: `frontend/dist`.

4. **Add Environment Variables**:
   Under **Environment Variables**, add the following:

   | Key | Value | Purpose |
   | :--- | :--- | :--- |
   | `VITE_API_URL` | `https://cle-attendance.onrender.com/api` (or your live backend URL) | Backend API endpoint |
   | `VITE_CAMPUS_LAT` | `16.426026` | CLE Society campus latitude |
   | `VITE_CAMPUS_LNG` | `74.589353` | CLE Society campus longitude |

5. **Deploy**:
   - Click **"Deploy"**.
   - Vercel will build the frontend and provide your live HTTPS URL (e.g., `https://cle-attendance.vercel.app`).

---

### Option B: Deploy via Vercel CLI (Terminal)

If you have the Vercel CLI installed:

```bash
# 1. Login to Vercel
npx vercel login

# 2. Deploy preview build
npx vercel

# 3. Deploy to production
npx vercel --prod
```

---

## 3. How to Download the Mobile Application

### Method 1: Automated GitHub Actions Cloud Build (No Android Studio Needed!)

A preconfigured GitHub Actions workflow [`.github/workflows/build-apk.yml`](.github/workflows/build-apk.yml) is included in the project:

1. When you push to the `main` branch or trigger **"Run workflow"** under GitHub Actions:
   - GitHub builds the frontend.
   - Compiles native Android code using JDK 17 and Android Gradle.
   - Creates the release `cle-attendance.apk`.
2. Go to your GitHub repository:
   - Click **Releases** or **Actions** > **Build Android Mobile APK**.
   - Download `cle-attendance.apk` directly to your Android device.

---

### Method 2: Download Directly from the Web App

Once deployed on Vercel:
1. Open your Vercel URL on any mobile phone: `https://<your-project>.vercel.app/download`
2. Users can:
   - **Android**: Tap **"Download Android APK Directly"** or download via the GitHub cloud mirror.
   - **iPhone (iOS)**: Tap Safari's **Share** button > **"Add to Home Screen"** to instantly install the app in standalone fullscreen mode.
   - **Desktop**: Scan the QR code with their phone camera to open the installer page on their device.

---

### Method 3: Build APK Locally via Command Line / Android Studio

If you have Android Studio or JDK installed locally:

```bash
# 1. Build and sync web assets to Android
cd frontend
npm run build:android

# 2. Open project in Android Studio
npm run cap:android

# 3. Or build directly via Gradle:
cd android
./gradlew assembleDebug     # Linux / Mac
gradlew.bat assembleDebug   # Windows
```

The compiled APK will be located at:
`frontend/android/app/build/outputs/apk/debug/app-debug.apk`
