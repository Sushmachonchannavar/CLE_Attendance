# CLE Society – Staff Attendance & Location System
## Production Own-Server Deployment & Operations Manual

This guide provides complete, production-tested instructions for deploying the **CLE Society Staff Attendance & Location System** to an Ubuntu/Linux server using a persistent SQLite database, Node.js/Express backend, React + Vite frontend, Nginx reverse proxy, Let's Encrypt TLS (HTTPS), and real SMS OTP authentication.

---

### Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites & System Requirements](#2-prerequisites--system-requirements)
3. [Persistent SQLite Storage Architecture](#3-persistent-sqlite-storage-architecture)
4. [Step-by-Step Server Setup](#4-step-by-step-server-setup)
5. [Environment Variables Configuration](#5-environment-variables-configuration)
6. [Backend Service Configuration (systemd)](#6-backend-service-configuration-systemd)
7. [Nginx Reverse Proxy & SSL (HTTPS) Setup](#7-nginx-reverse-proxy--ssl-https-setup)
8. [Automated Database Backup & Safe Restoration](#8-automated-database-backup--safe-restoration)
9. [Real SMS OTP Authentication Verification](#9-real-sms-otp-authentication-verification)
10. [Attendance, Geofence & Mobile Browser Compatibility](#10-attendance-geofence--mobile-browser-compatibility)
11. [Post-Deployment Verification Checklist](#11-post-deployment-verification-checklist)
12. [Maintenance, Troubleshooting & Runbook](#12-maintenance-troubleshooting--runbook)

---

### 1. Architecture Overview

```
                                  [ Users & Mobile Devices ]
                                (Android, iPhone, iPad, PC)
                                             │
                                             │ HTTPS (Port 443 / TLS 1.3)
                                             ▼
                                  ┌──────────────────────┐
                                  │     Nginx Proxy      │
                                  │   (Rate limiting,    │
                                  │   HSTS, Certbot SSL) │
                                  └──────────┬───────────┘
                                             │
                   ┌─────────────────────────┴─────────────────────────┐
                   │                                                   │
                   ▼ (Static SPA)                                      ▼ (/api/ reverse proxy)
      ┌─────────────────────────┐                         ┌─────────────────────────┐
      │  React + Vite Frontend  │                         │     Node.js Backend     │
      │  /var/www/.../dist      │                         │  (systemd: cle-backend) │
      │  (HTML, JS, Leaflet)    │                         │  Listening on 127.0.0.1 │
      └─────────────────────────┘                         └────────────┬────────────┘
                                                                       │
                                             ┌─────────────────────────┴─────────────────────────┐
                                             ▼                                                   ▼
                                ┌─────────────────────────┐                         ┌─────────────────────────┐
                                │    Persistent SQLite    │                         │    Real SMS Gateway     │
                                │ /var/lib/cle-attendance │                         │  XSMS / DLT Approved    │
                                │ (WAL mode, busy_timeout)│                         │  Sender: TGSSVM         │
                                └─────────────────────────┘                         └─────────────────────────┘
```

- **Frontend**: React 19, Vite 7, Leaflet (Campus Map), TailwindCSS. Served as static files with client-side SPA routing.
- **Backend**: Node.js (>=20 LTS), Express 5, `better-sqlite3`, JSON Web Tokens (JWT), Multer.
- **Database**: SQLite 3 with Write-Ahead Logging (WAL) and `busy_timeout = 5000ms`, stored in `/var/lib/cle-attendance/database.sqlite`.
- **Reverse Proxy**: Nginx with HTTP to HTTPS redirect, modern SSL ciphers, and security headers.
- **SMS OTP Gateway**: Real-time SMS via XSMS (`m.xsms.in`) using DLT Template ID `1507166573508565333` and Sender ID `TGSSVM`.

---

### 2. Prerequisites & System Requirements

| Component | Minimum Requirement | Recommended |
|---|---|---|
| **Operating System** | Ubuntu 22.04 LTS or 24.04 LTS | Ubuntu 24.04 LTS (x86_64) |
| **CPU / RAM** | 1 vCPU / 1 GB RAM | 2 vCPU / 2 GB RAM |
| **Storage** | 15 GB SSD | 30+ GB SSD (Persistent disk) |
| **Node.js** | Node.js 20 LTS (`v20.x`) | Node.js 20.x or 22.x LTS |
| **Network** | Static Public IPv4, Domain Name (A Record) | Ports 80, 443 open in firewall |
| **Service User** | Dedicated non-root user `cleadmin` | Group: `cleadmin` |

---

### 3. Persistent SQLite Storage Architecture

To prevent data loss during code updates or deployments, the database and file uploads **must never live inside the application source or git directory**.

#### Storage Layout
- **Database File**: `/var/lib/cle-attendance/database.sqlite`
- **WAL & SHM Files**: `/var/lib/cle-attendance/database.sqlite-wal`, `/var/lib/cle-attendance/database.sqlite-shm`
- **Uploaded Documents**: `/var/lib/cle-attendance/uploads/od-documents/`
- **Backup Archives**: `/var/backups/cle-attendance/`

#### Concurrency & Reliability Settings
In `backend/database.js`, the SQLite engine is configured with:
```javascript
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000'); // Waits up to 5s if locked
db.pragma('journal_mode = WAL');   // Concurrent reads and writes
db.pragma('synchronous = NORMAL'); // Full ACID durability in WAL mode
```

#### Security Protection Against Public Access
1. **Filesystem Isolation**: `/var/lib/cle-attendance` is outside Nginx web root (`/var/www/`).
2. **Permissions**: Directory is `0750` owned by `cleadmin:cleadmin`.
3. **Nginx Block**: Nginx block rules explicitly return `404` for any request matching `*.sqlite`, `*.db`, `*.wal`, `*.shm`, or `.env`.

---

### 4. Step-by-Step Server Setup

Log in to your Ubuntu server via SSH:
```bash
ssh username@your-server-ip
```

#### Step 4.1: Automated Server Provisioning
The repository includes an automated initialization script (`deploy/scripts/setup_server.sh`):

```bash
# Clone the repository to the production directory
sudo mkdir -p /var/www/cle-attendance
sudo chown -R $USER:$USER /var/www/cle-attendance
git clone <your-repository-url> /var/www/cle-attendance

# Run the setup script as root
cd /var/www/cle-attendance
sudo chmod +x deploy/scripts/*.sh
sudo ./deploy/scripts/setup_server.sh
```

#### Step 4.2: Manual Setup (Alternative)
If setting up manually without the script:

```bash
# 1. Update packages
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw nginx sqlite3 certbot python3-certbot-nginx build-essential

# 2. Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs

# 3. Create service user
sudo useradd --system --shell /bin/false --no-create-home cleadmin

# 4. Create persistent directories
sudo mkdir -p /var/lib/cle-attendance/uploads/od-documents
sudo mkdir -p /var/backups/cle-attendance
sudo mkdir -p /etc/cle-attendance
sudo chown -R cleadmin:cleadmin /var/lib/cle-attendance
sudo chmod 750 /var/lib/cle-attendance
sudo chown -R root:root /var/backups/cle-attendance
sudo chmod 700 /var/backups/cle-attendance

# 5. Configure firewall (UFW)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

### 5. Environment Variables Configuration

Copy the production template to the protected system configuration directory:

```bash
sudo cp /var/www/cle-attendance/deploy/env/backend.env.production.example /etc/cle-attendance/backend.env
sudo chmod 600 /etc/cle-attendance/backend.env
sudo chown cleadmin:cleadmin /etc/cle-attendance/backend.env
sudo nano /etc/cle-attendance/backend.env
```

#### Production Backend Environment (`/etc/cle-attendance/backend.env`)
Fill in your actual production values:

```ini
# Server Network Binding
PORT=5001
HOST=127.0.0.1
NODE_ENV=production

# Frontend Origin (Strict CORS) - Must be your exact HTTPS domain
FRONTEND_URL=https://attendance.yourdomain.com

# Persistent SQLite Storage
DATABASE_PATH=/var/lib/cle-attendance/database.sqlite
UPLOAD_DIR=/var/lib/cle-attendance/uploads/od-documents

# Security - Strong JWT Secret (Generate with: openssl rand -hex 32)
JWT_SECRET=replace_with_a_secure_random_64_character_hex_key_generated_by_openssl

# Real SMS Gateway (XSMS Gateway)
SMS_AUTH_KEY=your_xsms_auth_key_here
SMS_API_KEY=your_xsms_api_key_here
SMS_SENDER=TGSSVM
DLT_TE_ID=1507166573508565333
SMS_BASE_URL=https://m.xsms.in/api/sendhttp.php
SMS_CAMPAIGN=production

# Geofence Coordinates (Campus Centroid)
CAMPUS_LAT=16.426026
CAMPUS_LNG=74.589353
```

---

### 6. Backend Service Configuration (systemd)

Install the systemd unit file to ensure the backend starts on boot and restarts automatically if it ever crashes:

```bash
sudo cp /var/www/cle-attendance/deploy/systemd/cle-backend.service /etc/systemd/system/cle-backend.service
sudo systemctl daemon-reload
sudo systemctl enable cle-backend
```

#### Service Management Commands
```bash
sudo systemctl start cle-backend    # Start backend
sudo systemctl stop cle-backend     # Stop backend
sudo systemctl restart cle-backend  # Restart backend
sudo systemctl status cle-backend   # Check status
journalctl -u cle-backend -f        # Follow live logs
```

---

### 7. Nginx Reverse Proxy & SSL (HTTPS) Setup

#### Step 7.1: Configure Nginx Site
```bash
sudo cp /var/www/cle-attendance/deploy/nginx/cle-attendance.conf /etc/nginx/sites-available/cle-attendance.conf

# Replace placeholder with your real domain
sudo sed -i 's/attendance.yourdomain.com/attendance.clesociety.edu.in/g' /etc/nginx/sites-available/cle-attendance.conf

# Enable site
sudo ln -sf /etc/nginx/sites-available/cle-attendance.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
```

#### Step 7.2: Obtain Free Let's Encrypt SSL Certificate
Ensure your domain's DNS A record points to your server IP, then run:

```bash
sudo certbot --nginx -d attendance.clesociety.edu.in --non-interactive --agree-tos -m admin@clesociety.edu.in --redirect
```

Certbot will automatically install the TLS certificate and configure daily automatic renewal via `certbot.timer`.

#### Step 7.3: Test and Reload Nginx
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

### 8. Automated Database Backup & Safe Restoration

#### Online Automated Backup
The system uses `better-sqlite3`'s online non-blocking backup API (`db.backup()`), creating consistent backups even under concurrent writes.

```bash
# Manual immediate backup
cd /var/www/cle-attendance/backend
npm run db:backup

# Automated cron backup script with 14-day retention
sudo /var/www/cle-attendance/deploy/scripts/backup.sh
```

#### Automated Cron Schedule
The setup script configures daily backups at 2:00 AM in root crontab:
```bash
0 2 * * * /var/www/cle-attendance/deploy/scripts/backup.sh >> /var/log/cle-backup.log 2>&1
```

#### Safe Restoration Procedure
To restore the database safely from backup without corruption:

```bash
# Option A: Automatic restore using latest backup
sudo /var/www/cle-attendance/deploy/scripts/restore.sh

# Option B: Restore from a specific backup archive
sudo /var/www/cle-attendance/deploy/scripts/restore.sh /var/backups/cle-attendance/cle_backup_20261014_140000.sqlite.gz

# Option C: Node.js CLI utility
cd /var/www/cle-attendance/backend
npm run db:restore
```

The restore script automatically:
1. Validates the backup file format (`SQLite format 3`) and tests integrity (`PRAGMA integrity_check`).
2. Stops `cle-backend` service to prevent in-flight writes.
3. Takes an emergency snapshot of the current active database (`database.sqlite.pre_restore_<timestamp>`).
4. Removes stale `-wal` and `-shm` files to prevent replay corruption.
5. Restores the database file and restores proper permissions (`chown cleadmin:cleadmin`, `chmod 640`).
6. Restarts `cle-backend` and verifies `/api/health`.

---

### 9. Real SMS OTP Authentication Verification

The production system enforces **real SMS OTP dispatch exclusively**:
- No demo OTPs or hardcoded codes (e.g., `123456` is strictly rejected with HTTP 400).
- OTPs are cryptographically hashed (SHA-256) before storing in the database.
- OTPs expire strictly after **5 minutes**.
- Single-use guarantee: OTP records are invalidated or deleted immediately upon successful verification.
- Brute-force protection: After **5 failed attempts**, the account is locked for **15 minutes** (HTTP 423 Locked).
- Rate limiting: Maximum **5 OTP requests per 10 minutes** per phone number/employee ID.
- Privacy protection: Mobile numbers are masked in server logs (e.g., `+91******7776`).

To test SMS OTP delivery on production:
```bash
curl -X POST https://attendance.yourdomain.com/api/attendance/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "9876543210"}'
```

---

### 10. Attendance, Geofence & Mobile Browser Compatibility

#### Campus Geofencing
- **Coordinates**: Lat `16.426026`, Lng `74.589353`
- **Boundary**: Polygon + 300-meter radius threshold
- Punch-in is strictly rejected if coordinates fall outside the campus boundary.
- Punch-out records exit time and coordinates.

#### Mobile Browser Compatibility & Background GPS Limitations
The web application runs on mobile browsers (Chrome, Safari, Edge, Firefox):
- **Foreground Punch**: Works seamlessly on Android and iOS mobile browsers when user grants browser location permission.
- **Mobile Browser Background Limitations**:
  - **Android (Chrome)**: Background JavaScript execution is throttled or suspended when switching tabs or locking the screen.
  - **iOS (Safari)**: WebKit freezes JavaScript timers after 10–30 seconds when the app is backgrounded or screen locked.
- **Handling in CLE Attendance**:
  - The web application updates location during active browser sessions and upon user interactions.
  - Offline location pings are queued securely in `localStorage` and synchronized automatically upon reconnecting.
  - For continuous OS-level background location tracking while screen is locked, use the provided Capacitor native Android/iOS build.

---

### 11. Post-Deployment Verification Checklist

Verify all 11 items below before announcing the deployment as ready:

- [ ] **1. Frontend Production Build**: `frontend/dist` exists, `dist/index.html` loads cleanly over HTTPS.
- [ ] **2. Backend Health Check**: `curl -i https://attendance.yourdomain.com/api/health` returns HTTP `200 OK` with `{"status":"ok"}`.
- [ ] **3. Real SMS OTP Delivery**: Staff member requests OTP and receives SMS message on registered phone from sender `TGSSVM`.
- [ ] **4. Rejection of Demo/Expired OTP**: Attempting login with `123456` returns HTTP `400 Invalid OTP`.
- [ ] **5. Geofenced Punch-in**: Punching in within 300m of campus succeeds; punching outside campus is rejected with distance message.
- [ ] **6. Punch-out & Tracking Termination**: Punching out marks attendance complete and sets `is_tracking = 0`.
- [ ] **7. Leave & OD Submission**: Staff can submit leaves and OD with PDF attachments; documents viewable by Principal/Admin.
- [ ] **8. Role-Based Permissions**: Admin can access map dashboard (`/api/admin/employee-locations`); staff token receives HTTP `403 Forbidden`.
- [ ] **9. Database Persistence**: Restart backend (`sudo systemctl restart cle-backend`), verify previous attendance and users remain intact.
- [ ] **10. Online Backup & Restore**: Run `npm run db:backup` and verify backup file in `/var/backups/cle-attendance/`.
- [ ] **11. Security Audit**: Attempt to access `https://attendance.yourdomain.com/database.sqlite` and `.env` — verify Nginx returns `404 Not Found`.

---

### 12. Maintenance, Troubleshooting & Runbook

#### Updating Application Code (Zero-Downtime Deploy)
```bash
sudo /var/www/cle-attendance/deploy/scripts/deploy.sh
```

#### Viewing Logs
```bash
# Backend application logs
journalctl -u cle-backend -f -n 100

# Nginx access and error logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Backup execution log
sudo tail -f /var/log/cle-backup.log
```

#### Troubleshooting Common Issues

| Symptom | Root Cause | Resolution |
|---|---|---|
| **502 Bad Gateway on `/api/`** | Backend service is stopped or crashed | Check `systemctl status cle-backend` and `journalctl -u cle-backend -n 50`. Verify `JWT_SECRET` is set in `/etc/cle-attendance/backend.env`. |
| **CORS Rejected in Browser Console** | `FRONTEND_URL` in `.env` doesn't match browser URL | Update `FRONTEND_URL` in `/etc/cle-attendance/backend.env` to match exact HTTPS URL (no trailing slash) and run `systemctl restart cle-backend`. |
| **SMS OTP not delivered** | Invalid SMS API key or DLT template ID | Check `SMS_AUTH_KEY` in backend env and verify credit balance on `m.xsms.in`. |
| **Database is locked (`SQLITE_BUSY`)** | Long write transaction or concurrency spike | SQLite `busy_timeout = 5000` is active. Ensure WAL mode is active (`PRAGMA journal_mode;`). Avoid opening SQLite in external GUI tools while server runs. |
| **Certbot SSL renewal fails** | Port 80 blocked or DNS not pointing to server | Verify `ufw status` shows port 80 allowed and DNS A record matches server public IP. |
