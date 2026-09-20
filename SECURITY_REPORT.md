# Security Review & Audit Report: OTP Authentication & Staff Attendance System

**Date:** 16 September 2026  
**Auditor:** Automated Deep Code Security & Verification Agent  
**Scope:** Backend (Express, SQLite, JWT, SMS utils, Controllers, Middleware) & Frontend (React/Vite, AuthContext, Location Tracking, Attendance Panel)  
**System Status:** **NOT READY FOR PRODUCTION DEPLOYMENT** until Critical & High findings are remediated.

---

## Executive Summary

A comprehensive, zero-trust security audit was conducted on the OTP-based Staff Attendance & Location Tracking System. The evaluation covered the 20 deployment verification criteria specified by institution leadership, including OTP lifecycle, credential storage, authorization enforcement, geofencing, rate limiting, and network communication.

While substantial security improvements have been implemented—such as removal of mock-token bypasses, strict JWT secret validation, role authorization middleware, single-use OTP enforcement, and 5-attempt lockout rules—**critical vulnerabilities remain that must be resolved prior to public or production deployment**. Most notably:
1. **No rate limiting exists on `/api/auth/login`**, allowing SMS credit exhaustion and denial-of-service.
2. **Unauthenticated profile overwriting** via the public `/api/auth/register` endpoint.
3. **Login OTPs are stored in plaintext** in the SQLite database (`otps` table).
4. **Historical SMS credentials and SQLite databases** remain exposed in the repository's Git commit history.

---

## Summary of Verification Checklist (20 Items)

| # | Verification Requirement | Status | Summary Findings |
|---|--------------------------|--------|------------------|
| 1 | OTP generated only on backend | **PASSED (with note)** | OTP generation occurs only on backend (`attendanceController.js` & `sms.js`). Note: Uses non-crypto `Math.random()`. |
| 2 | OTP never returned in API response | **PASSED** | Omitted in production (`devOtp` only set if `NODE_ENV === 'test'`). |
| 3 | OTP never displayed in frontend | **PASSED** | Frontend UI collects and sends OTP; does not display generated OTPs. |
| 4 | OTP not logged in console or server logs | **PASSED** | Server request logger only records method and path; phone numbers are masked. |
| 5 | OTP expires after configured time | **PASSED** | 5-min expiry for Attendance OTPs, 10-min expiry for Login OTPs. Verified with tests. |
| 6 | OTP cannot be reused after verification | **PASSED** | Marked `is_used = 1` or deleted from DB immediately upon successful verification. |
| 7 | Limit on incorrect OTP attempts | **PASSED** | 5 failed attempts trigger 15-minute account lockout (HTTP 423). Verified with tests. |
| 8 | Rate limiting for OTP requests | **FAILED (CRITICAL)** | Enforced on attendance OTP (5 per 10 mins), but **completely missing on `/api/auth/login`**. |
| 9 | SMS API keys/secrets only on server | **PARTIAL (WARNING)** | Present only in backend `.env` today, but **exposed in historical Git commits**. |
| 10 | No SMS credentials in `VITE_*` vars | **PASSED** | Only `VITE_API_URL`, `VITE_LOCATION_INTERVAL`, and coordinates exist in frontend. |
| 11 | JWT/session tokens securely handled | **PASSED (with note)** | JWT signature & expiration verified; startup secret validated. Token stored in `localStorage`. |
| 12 | No plaintext passwords/credentials | **FAILED (HIGH)** | No passwords used, but **login OTPs are stored in plaintext in SQLite `otps` table**. |
| 13 | CORS allows only production frontend | **FAILED (MEDIUM)** | `localhost:5173`, `localhost:3000`, and loopback IPs are hardcoded and open by default. |
| 14 | HTTPS used for frontend & backend | **FAILED (MEDIUM)** | Configured with `http://` URLs; lacks `helmet`, HSTS, or TLS redirection. |
| 15 | Database files not downloadable via URL | **PASSED** | No static file serving on backend root; OD uploads protected from directory traversal. |
| 16 | Sensitive info not in API responses | **PARTIAL (LOW)** | User fields sanitized, but raw `err.message` in 500 handler can leak database errors. |
| 17 | Protected endpoints reject unauthenticated | **PASSED** | All protected routes require Bearer token and return 401 when unauthenticated. Verified with tests. |
| 18 | Staff cannot access other staff data | **FAILED (CRITICAL)** | Data queries are scoped, but **`/api/auth/register` allows unauthenticated profile overwriting**. |
| 19 | Admin/Principal permissions on backend | **PASSED** | Enforced via `roleMiddleware` and controller checks; cannot be bypassed with headers. Verified. |
| 20 | Location data sent only to intended backend | **PASSED** | LocationTracker and AttendancePanel send GPS coordinates strictly to application backend. |

---

## Detailed Vulnerability Analysis & Findings

### Finding 1: [CRITICAL] Missing Rate Limiting on Login OTP Requests (`/api/auth/login`)
- **Vulnerability Type:** Denial of Service / Financial SMS Depletion / Abuse
- **Severity:** Critical (CVSS: 8.2)
- **Affected Files:**
  - `backend/controllers/authController.js` (lines 23–61)
  - `backend/utils/sms.js` (lines 40–93)
- **Description:**
  While `attendanceController.sendOTP` implements a rate limit of 5 requests per 10 minutes, the primary login endpoint `/api/auth/login` contains **no rate limiting whatsoever**.
  Any automated script or malicious user knowing an employee's mobile number can issue thousands of rapid POST requests to `/api/auth/login`. This triggers external HTTP requests to the SMS gateway (`https://m.xsms.in/api/sendhttp.php`), leading to:
  1. Complete exhaustion of institutional SMS gateway credits within minutes.
  2. Financial costs / SMS quota depletion.
  3. SMS harassment and flooding of staff mobile devices.
- **Recommended Remediation:**
  Implement rate limiting on `/api/auth/login` and `/api/auth/verify`:
  1. Use `express-rate-limit` to restrict requests per IP address (e.g., maximum 5 login requests per 5 minutes).
  2. Add database-level tracking in `otps` or `auth_lockouts` to enforce a cooldown of at least 60 seconds between OTP dispatches to the same phone number, and a maximum of 5 requests per 10 minutes.

```javascript
// Recommended fix in backend/controllers/authController.js
const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
const recentCount = db.prepare(`
    SELECT COUNT(*) as count FROM otps 
    WHERE phone = ? AND created_at > datetime(?)
`).get(formattedPhone, tenMinutesAgo);

if (recentCount && recentCount.count >= 5) {
    return res.status(429).json({ 
        error: 'Too many login OTP requests. Please wait 10 minutes before requesting again.' 
    });
}
```

---

### Finding 2: [CRITICAL] Unauthenticated Profile Overwriting via Registration Endpoint (`/api/auth/register`)
- **Vulnerability Type:** Insecure Direct Object Reference / Broken Access Control / Data Tampering
- **Severity:** Critical (CVSS: 8.5)
- **Affected Files:**
  - `backend/controllers/authController.js` (lines 63–89)
  - `backend/routes/authRoutes.js` (line 7)
- **Description:**
  The `/api/auth/register` endpoint is public and unauthenticated. When a request is received, the code searches for existing users:
  ```javascript
  const existingUser = db.prepare('SELECT * FROM users WHERE phone = ? OR (employee_id = ? AND employee_id IS NOT NULL)').get(mobile, cleanEmpId);
  if (existingUser) {
      db.prepare('UPDATE users SET name = ?, college = ?, department = ?, employee_id = ? WHERE phone = ? OR employee_id = ?')
          .run(name, collegeName, departmentName, cleanEmpId, mobile, cleanEmpId);
      return res.json({ message: 'Profile updated successfully' });
  }
  ```
  An unauthenticated attacker can submit any staff, principal, or administrator mobile number (`9999999999`, `8888888888`, etc.) and arbitrarily overwrite their name, department, college, and employee ID without entering an OTP or password.
- **Recommended Remediation:**
  1. **Disallow profile modification on registration:** If `existingUser` is found, return `409 Conflict`:
     `return res.status(409).json({ error: 'A user with this mobile number or employee ID already exists. Please log in.' });`
  2. Move profile updates to an authenticated endpoint: `PUT /api/auth/profile` protected by `authMiddleware`, ensuring users can only edit their own profile unless they have the `admin` role.

---

### Finding 3: [HIGH] Plaintext Storage of Login OTPs in SQLite Database
- **Vulnerability Type:** Cryptographic Failure / Plaintext Sensitive Data Storage
- **Severity:** High (CVSS: 7.4)
- **Affected Files:**
  - `backend/utils/sms.js` (lines 57, 87, 105, 119)
- **Description:**
  In `backend/controllers/attendanceController.js`, attendance OTPs are hashed using SHA-256 (`crypto.createHash('sha256').update(otp).digest('hex')`) before database insertion.
  However, in `backend/utils/sms.js` (which handles user login verification), the OTP is inserted into the `otps` table in raw plaintext:
  ```javascript
  db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at, attempts) VALUES (?, ?, ?, 0)').run(formattedPhone, otp, expiresAt);
  ```
  And during check:
  ```javascript
  if (row.otp === code) { ... }
  ```
  If database backups, SQLite files, or diagnostic dumps are compromised, all valid, unexpired login OTPs are immediately readable.
- **Recommended Remediation:**
  Store only the cryptographic hash of the login OTP in the `otps` table:
  ```javascript
  const crypto = require('crypto');
  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
  db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at, attempts) VALUES (?, ?, ?, 0)').run(formattedPhone, hashedOtp, expiresAt);
  ```
  In `checkVerification`:
  ```javascript
  const hashedInput = crypto.createHash('sha256').update(code.trim()).digest('hex');
  if (row.otp === hashedInput) { ... }
  ```

---

### Finding 4: [HIGH] Historical Secrets & Database File Exposure in Git Repository
- **Vulnerability Type:** Secret Exposure in Version Control
- **Severity:** High (CVSS: 7.5)
- **Affected Files:**
  - Git Commit History (Commit `d254f7c9e08c26f4a3a0284e6a3f4331c71d5748`)
  - `backend/test_out.txt`
  - `backend/database.sqlite`
- **Description:**
  Git inspection reveals that `backend/test_out.txt` (containing live SMS gateway API credentials) and `backend/database.sqlite` (containing live staff phone numbers, employee IDs, names, and GPS attendance records) were committed to the Git repository.
  Even though `.gitignore` now excludes `backend/.env` and `*.sqlite`, any developer, collaborator, or CI/CD runner cloning the repository can extract historical secrets and database files using `git show` or `git checkout`.
- **Recommended Remediation:**
  1. **Credential Rotation (Immediate):** Immediately rotate the `SMS_API_KEY`, `SMS_AUTH_KEY`, and Twilio credentials at the provider dashboard. Treat the existing keys as publicly compromised.
  2. **Repository Sanitization:** Run `git-filter-repo` or BFG Repo-Cleaner to permanently purge `backend/test_out.txt` and `backend/database.sqlite` from all Git history before pushing to GitHub or any remote repository:
     ```bash
     git filter-repo --invert-paths --path backend/test_out.txt --path backend/database.sqlite
     ```

---

### Finding 5: [MEDIUM] Permissive CORS Configuration with Hardcoded Development Origins
- **Vulnerability Type:** Security Misconfiguration
- **Severity:** Medium (CVSS: 5.3)
- **Affected Files:**
  - `backend/server.js` (lines 19–36)
- **Description:**
  The CORS configuration allows origins from `localhost:5173`, `localhost:3000`, `127.0.0.1:5173`, and `127.0.0.1:3000` regardless of the environment (`process.env.NODE_ENV`).
  If deployed to production, an attacker could host an exploit or CSRF-like web page on a developer's local machine or loopback and trigger authenticated API actions if credentials/cookies were enabled.
  Furthermore, `callback(new Error('Not allowed by CORS'))` causes Express to throw an unhandled internal 500 error instead of a standard CORS refusal header.
- **Recommended Remediation:**
  In production, strictly permit only the verified production domain:
  ```javascript
  const allowedOrigins = process.env.NODE_ENV === 'production'
      ? [process.env.FRONTEND_URL].filter(Boolean)
      : [process.env.FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'].filter(Boolean);

  app.use(cors({
      origin: (origin, callback) => {
          if (!origin || allowedOrigins.includes(origin)) {
              return callback(null, true);
          }
          return callback(null, false); // Return false instead of throwing Error
      },
      credentials: true
  }));
  ```

---

### Finding 6: [MEDIUM] Pseudo-Random Number Generator (`Math.random()`) Used for OTP Generation
- **Vulnerability Type:** Weak Cryptography / Insecure Randomness
- **Severity:** Medium (CVSS: 5.3)
- **Affected Files:**
  - `backend/utils/sms.js` (line 18)
  - `backend/controllers/attendanceController.js` (line 255)
- **Description:**
  Both OTP generation routines use:
  ```javascript
  Math.floor(100000 + Math.random() * 900000).toString()
  ```
  `Math.random()` in the V8 engine is not a Cryptographically Secure Pseudo-Random Number Generator (CSPRNG). If an attacker observes several generated random sequences from the same Node process, the internal PRNG state (xorshift128+) can theoretically be reconstructed to predict subsequent OTPs.
- **Recommended Remediation:**
  Use Node.js's built-in `crypto.randomInt`:
  ```javascript
  const crypto = require('crypto');
  const otp = crypto.randomInt(100000, 1000000).toString();
  ```

---

### Finding 7: [MEDIUM] Browser `localStorage` Used for JWT Token Storage
- **Vulnerability Type:** Insecure Credential Storage (XSS Vulnerability Window)
- **Severity:** Medium (CVSS: 5.4)
- **Affected Files:**
  - `frontend/src/context/AuthContext.jsx` (lines 14, 82, 93)
- **Description:**
  Tokens are stored in `localStorage.getItem('token')`. Data stored in `localStorage` has no protection against Cross-Site Scripting (XSS). Any malicious script injected via third-party dependencies, unsanitized inputs, or CDNs can read `localStorage` and exfiltrate user JWT tokens.
- **Recommended Remediation:**
  Store authentication tokens in `httpOnly`, `Secure`, `SameSite=Strict` cookies. This ensures the browser automatically sends tokens with requests while keeping them completely inaccessible to client-side JavaScript.

---

### Finding 8: [MEDIUM] Missing HTTPS Enforcement & Missing Security Headers (`helmet`)
- **Vulnerability Type:** Insecure Transport / Missing Security Headers
- **Severity:** Medium (CVSS: 5.9)
- **Affected Files:**
  - `backend/server.js`
  - `backend/.env`
  - `frontend/.env`
- **Description:**
  1. The API currently runs over plain HTTP (`http://localhost:5001/api`). In transit over local Wi-Fi or public campus networks, unencrypted HTTP exposes JWT bearer tokens, employee phone numbers, and location coordinates to network eavesdroppers.
  2. The Express server does not use `helmet` to set defensive HTTP headers:
     - `Strict-Transport-Security` (HSTS)
     - `X-Content-Type-Options: nosniff`
     - `X-Frame-Options: DENY`
     - `Content-Security-Policy`
- **Recommended Remediation:**
  1. Install and mount `helmet`:
     ```javascript
     const helmet = require('helmet');
     app.use(helmet());
     ```
  2. In production, configure reverse-proxy TLS termination (Nginx / Cloudflare) with `app.set('trust proxy', 1)`, and ensure `VITE_API_URL` uses `https://`.

---

### Finding 9: [LOW] Unhandled Server Error Stack Leakage in 500 Responses
- **Vulnerability Type:** Information Disclosure
- **Severity:** Low (CVSS: 3.7)
- **Affected Files:**
  - `backend/server.js` (lines 71–74)
- **Description:**
  The Express error handling middleware returns:
  ```javascript
  res.status(500).json({ error: err.message || 'Internal server error' });
  ```
  If an unhandled SQLite database error occurs (e.g. syntax error or table lock), `err.message` can leak database schema details, file paths, and SQL statements to external clients.
- **Recommended Remediation:**
  Sanitize error responses in production:
  ```javascript
  app.use((err, req, res, next) => {
      console.error('Server error:', err);
      const isProd = process.env.NODE_ENV === 'production';
      res.status(500).json({ 
          error: isProd ? 'Internal server error. Please contact the administrator.' : (err.message || 'Internal server error')
      });
  });
  ```

---

### Finding 10: [LOW] Geolocation Coordinates Output to Browser Console
- **Vulnerability Type:** Information Disclosure (Client Side)
- **Severity:** Low (CVSS: 2.3)
- **Affected Files:**
  - `frontend/src/components/LocationTracker.jsx` (line 41)
- **Description:**
  `LocationTracker.jsx` outputs live GPS latitude, longitude, and accuracy to the client console on every GPS watch update:
  ```javascript
  console.log("Sending background location update:", { lat, lng, accuracy });
  ```
- **Recommended Remediation:**
  Remove debug `console.log` statements before building the production bundle, or gate behind `if (import.meta.env.DEV)`.

---

## Verification Test Results

All existing test suites were executed to verify active system behavior:

1. **Security Remediation Suite (`test_security_remediation.js`):**
   - **Result:** **12 PASSED, 0 FAILED**
   - Verified: Startup abort on weak/empty `JWT_SECRET`; rejection of `mock-jwt-token`; immunity against header spoofing (`X-User-Role`); Principal barred from approving self-leaves; Principal permitted to approve Staff leaves; Admin permitted to approve Principal leaves; unauthenticated access to `/api/sms/send-otp` rejected with 401.

2. **Priority 1 Integrity Suite (`test_priority1_remediation.js`):**
   - **Result:** **37 PASSED, 0 FAILED**
   - Verified: Database migrations applied (versions 001–004); unique constraint on `(user_id, date)` prevents double punch-in; UTC timestamps saved; invalid calendar dates rejected; overlapping leave dates rejected; approval audit trail recorded; rate-limiting and 5-attempt lockout on attendance OTP; online SQLite backup generation.

3. **Leave Approval Date Rule Suite (`test_leave_approval_date.js`):**
   - **Result:** **3 PASSED, 0 FAILED**
   - Verified: Expired leave (yesterday end-date) cannot be approved/rejected (status remains pending in DB); active today leave approved; future tomorrow leave rejected.

4. **Playwright End-to-End Suite (`tests/critical-ui.spec.ts`):**
   - **Result:** **7 PASSED, 0 FAILED** (tested on Chromium)
   - Verified: Required mobile validation; invalid OTP error display; valid OTP login redirection to `/dashboard`; unauthenticated route protection redirecting to `/login`; navigation links and logout flow; admin-only links rendered and staff-only hidden; geofence breach auto-logout.

---

## Pre-Deployment Remediation Roadmap

To ensure institutional compliance and data safety, the following remediation steps must be completed in order of priority:

| Step | Action Item | Target Component | Complexity |
|---|---|---|---|
| **1** | **Rotate SMS Credentials immediately** | SMS Gateway Provider / `.env` | Immediate |
| **2** | **Add Rate Limiting on `/api/auth/login`** | `backend/controllers/authController.js` | Low (1 hour) |
| **3** | **Disable Profile Overwrite in `/api/auth/register`** | `backend/controllers/authController.js` | Low (30 mins) |
| **4** | **Hash Login OTPs with SHA-256 in `otps` table** | `backend/utils/sms.js` | Low (1 hour) |
| **5** | **Switch `Math.random()` to `crypto.randomInt()`** | `backend/utils/sms.js` & `attendanceController.js` | Low (15 mins) |
| **6** | **Purge Git History of `test_out.txt` and `database.sqlite`** | Git Repository | Medium (2 hours) |
| **7** | **Restrict CORS allowedOrigins to production URL only** | `backend/server.js` | Low (30 mins) |
| **8** | **Install `helmet` and configure HTTPS** | `backend/server.js` | Medium (1 hour) |

---
*Report generated strictly from source code inspection and automated test execution. No application code, business logic, or UI was modified during this review.*
