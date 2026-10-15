# CLE Society – Mobile Applications (Android & iOS) Build & Deployment Guide

This guide explains how to package, build, test, and deploy the **CLE Society Staff Attendance & Location System** as native mobile applications for **Android** and **iOS** using Capacitor, while sharing the same React codebase, backend API, and real SMS OTP authentication.

---

### Table of Contents
1. [Multi-Platform Architecture Overview](#1-multi-platform-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Environment Configuration (Local vs. Production)](#3-environment-configuration-local-vs-production)
4. [Step-by-Step Android Build Guide](#4-step-by-step-android-build-guide)
5. [Step-by-Step iOS Build Guide (macOS + Xcode)](#5-step-by-step-ios-build-guide-macos--xcode)
6. [Native Background Location Tracking & Permissions](#6-native-background-location-tracking--permissions)
7. [Physical Device Testing Checklist](#7-physical-device-testing-checklist)
8. [Troubleshooting & FAQs](#8-troubleshooting--faqs)

---

### 1. Multi-Platform Architecture Overview

```
                      ┌──────────────────────────────────────┐
                      │    Single Shared React + Vite Code   │
                      │             (frontend/)              │
                      └──────────────────┬───────────────────┘
                                         │ npm run build
                                         ▼
                      ┌──────────────────────────────────────┐
                      │    Compiled Static Web Bundle (dist) │
                      │  (HTML, JS, CSS, Assets, Leaflet)    │
                      └──────────────────┬───────────────────┘
                                         │ npx cap sync
             ┌───────────────────────────┼───────────────────────────┐
             ▼                           ▼                           ▼
  ┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
  │   Web Application   │     │   Android Project   │     │     iOS Project     │
  │ (HTTPS / Nginx SPA) │     │ (frontend/android/) │     │   (frontend/ios/)   │
  │ Chrome, Safari, PC  │     │ APK / Google Play   │     │  IPA / Apple Store  │
  └─────────────────────┘     └─────────────────────┘     └─────────────────────┘
             │                           │                           │
             └───────────────────────────┼───────────────────────────┘
                                         │ HTTPS /api/ (JSON, JWT, SMS OTP)
                                         ▼
                      ┌──────────────────────────────────────┐
                      │       Unified Express Backend        │
                      │  (Persistent SQLite, Real SMS OTP)   │
                      └──────────────────────────────────────┘
```

- **Single Shared Codebase**: All views, dashboards, maps, forms, and business logic live in `frontend/src/`.
- **Offline Queuing**: If staff lose mobile connectivity while on campus, GPS coordinates are queued securely in local storage and synced automatically once internet is restored.
- **Native Capacitor Plugins**:
  - `@capacitor/core`: Native runtime bridge.
  - `@capacitor/app`: App state lifecycle (foreground/background transitions).
  - `@capacitor/geolocation`: High-accuracy foreground GPS fixes.
  - `@capacitor-community/background-geolocation`: Native Android foreground service and iOS CoreLocation background updates.

---

### 2. Prerequisites

#### For Android Builds:
- **Operating System**: Windows, macOS, or Linux.
- **Java Development Kit**: JDK 17 or JDK 21 (e.g., OpenJDK or Eclipse Temurin).
- **Android Studio**: Android Studio Jellyfish / Koala or newer.
- **Android SDK**: Android API Level 34 (Android 14) or Level 35 (Android 15), with Android SDK Build-Tools.

#### For iOS Builds:
- **Operating System**: macOS (Ventura 13.5+ or Sonoma 14+).
- **Apple Developer Account** (for signing and device installation).
- **Xcode**: Xcode 15 or 16 with iOS SDK.
- **CocoaPods** or **Swift Package Manager** (Capacitor 8 uses Swift Package Manager natively).

---

### 3. Environment Configuration (Local vs. Production)

Native mobile apps cannot use `http://localhost:5001` because `localhost` refers to the mobile phone itself.

#### Option A: Production Mobile Build (Recommended)
Set your deployed HTTPS backend URL in `frontend/.env.production`:
```ini
VITE_API_URL=https://attendance.clesociety.edu.in/api
VITE_CAMPUS_LAT=16.426026
VITE_CAMPUS_LNG=74.589353
```

#### Option B: Local Wi-Fi Testing (Development)
If testing a mobile phone connected to the same Wi-Fi network as your computer, use your computer's local LAN IP:
```ini
VITE_API_URL=http://192.168.1.100:5001/api
```
*(In `frontend/capacitor.config.json`, `"cleartext": true` is enabled to permit local HTTP testing on Android).*

---

### 4. Step-by-Step Android Build Guide

#### Step 4.1: Build Frontend and Sync Android Assets
From the `frontend` directory, run:
```bash
cd frontend
npm run build:android
```
*(This command runs `vite build` followed by `cap sync android`, copying the latest web assets into `android/app/src/main/assets/public`).*

#### Step 4.2: Open in Android Studio
```bash
npm run cap:android
```
Alternatively, open Android Studio and choose **Open an Existing Project**, selecting `frontend/android`.

#### Step 4.3: Build Debug APK
In Android Studio:
1. Wait for Gradle sync to complete.
2. Go to **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
3. The generated APK will be located at:
   `frontend/android/app/build/outputs/apk/debug/app-debug.apk`

#### Step 4.4: Command Line Build (Alternative)
If you have JDK and Android SDK installed on your command line:
```bash
cd frontend/android
./gradlew assembleDebug       # Linux / macOS
gradlew.bat assembleDebug     # Windows
```

#### Step 4.5: Installing APK on Physical Android Device
1. Enable **Developer Options** on your Android device (tap *Build Number* 7 times in Settings > About Phone).
2. Enable **USB Debugging**.
3. Connect device via USB, or transfer `app-debug.apk` to phone via USB/WhatsApp/Drive and tap to install.
4. When prompted, grant **Location** permission (*"While using the app"*, then *"Allow all the time"* for background shift tracking).

---

### 5. Step-by-Step iOS Build Guide (macOS + Xcode)

#### Step 5.1: Transfer Code to macOS Machine
Ensure the `frontend/` directory (including `frontend/ios`) is available on your Mac.

#### Step 5.2: Build Frontend and Sync iOS Assets
```bash
cd frontend
npm install
npm run build:ios
```

#### Step 5.3: Open in Xcode
```bash
npm run cap:ios
```
Or open `frontend/ios/App/App.xcworkspace` in Xcode.

#### Step 5.4: Configure Signing & Capabilities
1. In Xcode, select the **App** project in the left navigator.
2. Select the **App** target and open the **Signing & Capabilities** tab.
3. Select your **Team** (personal or organization Apple Developer Account).
4. Verify the Bundle Identifier: `org.clesociety.attendance`.
5. Under **Background Modes**, ensure **Location updates** is checked.

#### Step 5.5: Run on Physical iPhone or Simulator
1. Select your connected iPhone from the scheme selector at the top.
2. Click the **Play / Run** button (`Cmd + R`).
3. Xcode will compile, sign, and install the app on your device.

---

### 6. Native Background Location Tracking & Permissions

#### Privacy & Transparency Compliance
- **No Background Tracking Before Punch-In**: Location services are dormant until the backend confirms a successful punch-in.
- **Immediate Termination on Punch-Out**: When staff members punch out, the native watcher is terminated immediately.
- **Persistent Notification (Android)**: A persistent notification with title *"CLE Campus Duty Active"* and body *"Attendance location tracking active while on duty"* informs the user that location tracking is running.
- **Privacy Disclosure Modal**: Staff can tap the info banner in the app to view the data collection and retention policy.

#### Android Permissions (`AndroidManifest.xml`)
- `ACCESS_FINE_LOCATION`: For GPS accuracy to evaluate the 300m campus geofence.
- `ACCESS_COARSE_LOCATION`: For approximate cellular/Wi-Fi location.
- `ACCESS_BACKGROUND_LOCATION`: Required for Android 10+ background updates.
- `FOREGROUND_SERVICE` & `FOREGROUND_SERVICE_LOCATION`: Android 14+ requirement for location services.
- `POST_NOTIFICATIONS`: Android 13+ requirement to display active tracking notification.

#### iOS Usage Descriptions (`Info.plist`)
- `NSLocationWhenInUseUsageDescription`: *"CLE Society Attendance requires access to your location to verify your presence within the campus geofence for attendance marking."*
- `NSLocationAlwaysAndWhenInUseUsageDescription`: *"CLE Society Attendance requires background location access during your active shift to confirm on-campus attendance. Tracking stops automatically upon punch-out."*

---

### 7. Physical Device Testing Checklist

Perform this test checklist on a real physical device:

1. **App Launch & Clean Display**:
   - Launch app from home screen icon.
   - Verify CLE Society branding, logo, and responsive layout.
2. **Real SMS OTP Authentication**:
   - Enter registered staff mobile number.
   - Verify SMS OTP arrives on physical phone from sender `TGSSVM`.
   - Submit valid OTP; verify dashboard loads with JWT session stored.
3. **Location Permission Prompts**:
   - Verify system dialog requests location permissions.
   - Allow location access.
4. **Geofenced Punch-In**:
   - Attempt punch-in while outside campus boundary: verify rejection with distance message.
   - Punch-in within campus: verify punch-in confirmed with timestamp.
5. **Background Tracking Verification**:
   - Minimize the app or lock the screen.
   - Verify persistent Android notification remains visible: *"CLE Campus Duty Active"*.
   - Check backend logs: verify location coordinates continue to update periodically.
6. **Offline Location Queuing**:
   - Enable Airplane Mode on the mobile device while punched in.
   - Verify location indicator displays *"Offline - Queued (X)"*.
   - Disable Airplane Mode: verify queued locations flush automatically to the backend.
7. **Punch-Out & Service Termination**:
   - Tap **Punch Out**.
   - Verify punch-out timestamp recorded.
   - Verify tracking indicator turns off and Android foreground notification dismisses immediately.
   - Verify backend sets `is_tracking = 0`.
8. **Admin Map Verification**:
   - Log in as Admin on web or mobile.
   - Open **Live Map**: verify staff location marker matches actual campus position.

---

### 8. Institutional Distribution & The Universal QR Code Page

The system includes a dedicated, responsive institutional download portal at:
```
https://attendance.yourdomain.com/download
```
*(Also accessible via `/install` or by tapping **"Get Android / iOS Mobile App"** on the Login screen and Sidebar).*

#### Features of the Universal Installation Portal
1. **Single Universal QR Code:**
   - Displayed prominently when opened on a desktop PC or printed on campus bulletin boards.
   - Any staff member can point their phone camera at this **ONE QR code**.
2. **Automatic Device Detection:**
   - **Android Devices:** Automatically detects Android and displays a direct **"Download Android APK Directly"** button (~5.8 MB), version tags, and step-by-step instructions for institutional APK installation.
   - **iPhones / iPads:** Automatically detects iOS and displays options for Apple TestFlight / App Store and a 4-step **"Add to Home Screen"** guide for running the web app in native fullscreen mode.
   - **Desktop / Laptop:** Shows the large QR code and lets administrators copy the link or preview both platform installation guides.
3. **Self-Hosted APK Hosting:**
   - Place your compiled `app-debug.apk` or signed release APK into:
     ```
     backend/downloads/cle-attendance.apk
     ```
   - The backend and Nginx reverse proxy serve this file directly to Android devices with `application/vnd.android.package-archive` headers, allowing seamless one-tap distribution across staff without third-party file sharing services.

---

### 9. Troubleshooting & FAQs

| Issue | Cause | Fix |
|---|---|---|
| **Android: Network Error / API unreachable** | App configured with `localhost` or HTTP without cleartext | Ensure `VITE_API_URL` points to your public HTTPS server (e.g., `https://attendance.yourdomain.com/api`). If testing locally over Wi-Fi, ensure `"cleartext": true` is present in `capacitor.config.json`. |
| **Android: Location permission denied** | Staff selected "Never" or "Don't allow" | Direct staff to device **Settings** > **Apps** > **CLE Society Attendance** > **Permissions** > **Location** > Select **"Allow all the time"**. |
| **Android: Gradle build fails with Java version error** | Incompatible JDK version | Ensure JDK 17 or 21 is selected in Android Studio under **Settings** > **Build, Execution, Deployment** > **Build Tools** > **Gradle** > **Gradle JDK**. |
| **iOS: Build fails with Code Signing error** | No Apple Developer Team selected | Open Xcode, select the **App** target > **Signing & Capabilities**, and select a valid Team. |
| **iOS: Background tracking pauses after long idle** | iOS Low Power Mode active | iOS suspends background execution when Low Power Mode is enabled. Inform staff to disable Low Power Mode during working shifts. |
