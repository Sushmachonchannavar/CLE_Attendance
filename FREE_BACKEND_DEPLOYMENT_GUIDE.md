# 100% Free Backend Deployment Guide

This guide provides the best **completely free ($0/month)** options to deploy the **CLE Attendance Node.js/Express Backend** with zero credit card requirements.

---

## Comparison of Free Hosting Options

| Provider | Cost | Sleeps after inactivity? | Preserves SQLite DB? | Recommended For |
| :--- | :--- | :--- | :--- | :--- |
| **Render.com** (Web Service) | **$0** (Free Tier) | Yes (wakes in ~40s) | Resets on redeploy | Quickest setup, standard for college projects |
| **Koyeb** (Eco Nano) | **$0** (Free Tier) | **No** (Always on) | Resets on redeploy | Best performance & zero cold-start delay |
| **Alwaysdata** | **$0** (100MB Free) | **No** | **Yes** (True persistent disk) | Projects needing persistent SQLite data |
| **Cloudflare Tunnel** (Self-Host) | **$0** (Local/PC) | **No** (as long as PC is on) | **Yes** (Local SQLite) | College labs, final project demos, zero cloud hassle |

---

## Option 1: Render.com (Most Popular — 3 Minutes)

> [!IMPORTANT]
> Do **NOT** use "Blueprint / render.yaml" on the free tier because persistent disks require a paid plan ($0.25/mo). Deploy as a standard **Web Service** instead.

### Step 1: Push code to GitHub
Make sure your latest code is on GitHub:
```bash
git add .
git commit -m "Prepare backend for free deployment"
git push origin main
```

### Step 2: Create Web Service on Render
1. Go to [render.com](https://dashboard.render.com/) and sign up / log in with **GitHub**.
2. Click the **"New +"** button at the top right and select **"Web Service"**.
3. Select **"Build and deploy from a Git repository"** and connect `Sushmachonchannavar/CLE_Attendance`.
4. Configure the settings:
   - **Name:** `cle-attendance-backend` (or any name you prefer)
   - **Region:** `Singapore` (or nearest to your users)
   - **Branch:** `main`
   - **Root Directory:** `backend` *(CRITICAL: do not leave empty)*
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Select **Free** ($0/month)

### Step 3: Add Environment Variables
Scroll down to the **Environment Variables** section and add:

| Key | Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production mode |
| `JWT_SECRET` | `cle_attendance_super_secure_jwt_secret_key_2026_xyz` | Must be at least 32 characters |
| `FRONTEND_URL` | `https://cle-attendance.vercel.app` | Your Vercel frontend URL (or `*`) |
| `CAMPUS_LAT` | `16.426026` | Campus latitude |
| `CAMPUS_LNG` | `74.589353` | Campus longitude |

*(Optional SMS keys can be added if you have Twilio or XSMS credentials).*

### Step 4: Deploy & Test
1. Click **"Create Web Service"**.
2. Render will build and deploy your backend. Within 2 minutes, you will see `==> Your service is live 🎉`.
3. Your live API URL will look like:
   ```
   https://cle-attendance-backend.onrender.com
   ```
4. Test the health endpoint in your browser:
   `https://cle-attendance-backend.onrender.com/health`
   Should return: `{"status":"ok", ...}`

---

## Option 2: Koyeb (100% Free — No Cold Starts / Always On)

Koyeb offers 1 free Nano service with 512MB RAM that **does not sleep** like Render.

1. Go to [koyeb.com](https://app.koyeb.com/) and sign up with GitHub.
2. Click **"Create App"**.
3. Under **Deployment Method**, select **GitHub**.
4. Select your repository `CLE_Attendance`.
5. In **App configuration**:
   - Work directory: `backend`
   - Buildpack / Docker: Use default Node buildpack
   - Run command: `npm start`
6. Add the Environment Variables:
   - `NODE_ENV`: `production`
   - `JWT_SECRET`: `cle_attendance_super_secure_jwt_secret_key_2026_xyz`
   - `FRONTEND_URL`: `https://cle-attendance.vercel.app`
7. Click **Deploy**. Koyeb will generate an HTTPS URL (e.g. `https://cle-attendance-xxx.koyeb.app`).

---

## Option 3: Cloudflare Tunnel (Run on your Laptop / College PC for Free)

If you are presenting your project, running evaluations, or want 100% permanent SQLite data without cloud database limits, Cloudflare Tunnel exposes your local backend to a secure public HTTPS URL for free.

### Step 1: Start your local backend
In PowerShell or terminal:
```bash
cd backend
npm install
npm start
```
Your backend will run on `http://localhost:5001`.

### Step 2: Start Cloudflare Tunnel (No account needed)
Open a second terminal and run:
```bash
npx cloudflared tunnel --url http://localhost:5001
```

You will see output like:
```text
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
|  https://random-words-here.trycloudflare.com                                               |
+--------------------------------------------------------------------------------------------+
```

Your backend is now live on the internet with full HTTPS!
Test it: `https://random-words-here.trycloudflare.com/health`

---

## Connecting Your Vercel Frontend to the Backend

Once your backend is live (from Render, Koyeb, or Cloudflare Tunnel):

1. Go to your **Vercel Dashboard** -> Your Project (`cle-attendance`) -> **Settings** -> **Environment Variables**.
2. Add / Edit:
   - **Key:** `VITE_API_URL`
   - **Value:** `https://your-backend-url.onrender.com/api` *(Make sure to append `/api`)*
3. Redeploy your frontend on Vercel:
   - Go to **Deployments** -> Click the three dots on the latest commit -> **Redeploy**.

Your frontend is now fully communicating with your free live backend!
