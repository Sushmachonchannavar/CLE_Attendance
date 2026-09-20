# Staff Attendance Management Application

## Test Report and Enhancement Document

**Audit date:** 15 September 2026  
**Scope:** React/Vite frontend, Express/SQLite backend, authentication, attendance, GPS tracking, leave, OD requests, reports, and existing automated tests.

## Executive Summary

The application has the main workflows required for a staff attendance system: OTP login, attendance punch-in/out, campus geofencing, live location tracking, leave management, OD requests with documents, approval flows, and reports.

It is **not ready for production use** yet. The most important blockers are an authentication bypass in demo mode, exposed SMS credentials, sensitive request logging, and frontend lint failures.

## Test Scope and Method

The review included a code audit and the configured frontend lint check.

The existing backend API test scripts were **not executed** because they insert, update, and delete records in the live `backend/database.sqlite` file. They should be converted to use an isolated test database before execution.

## Test Results

| Area | Status | Result |
| --- | --- | --- |
| Frontend quality gate | Failed | `npm run lint` returned 7 errors and 5 warnings. |
| Authentication and OTP | At risk | Functional flow exists, but demo fallback and inconsistent OTP behaviour are unsafe. |
| Authorization | Failed | Mock token flow trusts role and user ID supplied by the browser. |
| Attendance | Partially verified | Punch in/out, late flag, history, and geofence checks are implemented. |
| GPS tracking | Partially verified | Tracking begins at punch-in and stops at punch-out; admin map is implemented. |
| Leave management | Partially verified | Application, review, approval/rejection and deletion are implemented. |
| OD management | Partially verified | Application, mandatory document upload, review, approval/rejection and document access are implemented. |
| Reports | Partially verified | Daily, monthly, and Excel report functionality is implemented. |
| Automated API suite | Not run | Current scripts modify the application database. |

## Frontend Lint Findings

The lint command currently fails due to 7 errors and reports 5 warnings.

Errors include unused variables in:

- `frontend/src/components/Sidebar.jsx`
- `frontend/src/context/AuthContext.jsx`
- `frontend/src/pages/Dashboard.jsx`
- `frontend/src/pages/LeaveRequests.jsx`
- `frontend/src/pages/Login.jsx`
- `frontend/src/pages/ODRequests.jsx`

Warnings include missing React Hook dependencies in the attendance panel, location tracker, leave requests, and OD requests pages. These can lead to stale state or unpredictable GPS tracking behaviour.

## Security and Functional Findings

### Critical: mock authentication bypass

`backend/middleware/authMiddleware.js` accepts `mock-jwt-token` and creates the authenticated identity from `X-User-Role` and `X-User-Id` headers. Because a browser user can change these headers, a user could impersonate an administrator.

**Required action:** Remove mock-token support and do not trust browser-supplied role or user ID headers. Derive identity and role only from a verified JWT and database record.

### Critical: SMS credentials and sensitive test output

An SMS credential appears in `backend/test_out.txt`, and a fallback SMS key appears in `backend/utils/sms.js`.

**Required action:** Rotate the credential immediately, remove credentials from source/history, use environment variables only, and add secret scanning to CI.

### High: sensitive data is logged

`backend/server.js` logs complete request headers and request bodies. This can include JWT tokens, OTPs, phone numbers, locations, and document metadata.

**Required action:** Remove full request logging. Use structured logs with redaction for authentication, OTP, phone, and location fields.

### High: client-side demo login

`frontend/src/context/AuthContext.jsx` can create a local mock session after an API failure.

**Required action:** Remove this behaviour from production. If demo mode is required, gate it behind a server-side development-only environment setting.

### High: server-side role scope is incomplete

The backend allows admin, HOI, and principal users to retrieve and approve all leave and OD requests. Frontend filtering is not a security control.

**Required action:** Define a role-permission matrix and enforce ownership, department, and approval scope in backend queries and update endpoints.

### Medium: report validation and accuracy

The monthly report uses day 31 as the end of every month and does not fully validate month/year values. The daily report may fail if location data is null.

**Required action:** Validate report parameters, calculate the actual last day of the month, and safely handle absent location fields.

### Medium: attendance integrity

The attendance schema does not enforce one attendance record per user per date.

**Required action:** Add a unique database constraint on `(user_id, date)` and handle duplicate-insert errors safely.

### Medium: upload hardening

OD document upload permits files up to 100 MB and relies on MIME type and extension checks.

**Required action:** Reduce the maximum upload size, inspect file signatures, malware-scan uploads where possible, and store documents outside the application source tree.

### Medium: GPS is not anti-spoofing protection

The backend validates the coordinates sent by the browser but cannot prove that they originate from real device GPS.

**Required action:** Record accuracy and timestamp, reject invalid/stale locations, display confidence to administrators, and define policy for mock locations and off-campus punch-out.

## Enhancement Roadmap

### Priority 0 — before deployment

1. Remove mock token and demo-login bypasses.
2. Rotate exposed SMS credentials and remove secrets from tracked files.
3. Stop logging tokens, OTPs, phone numbers, exact GPS coordinates, and full request bodies.
4. Require `JWT_SECRET` at server startup and use strong environment-managed values.
5. Fix all frontend lint errors and warnings.
6. Enforce backend role scope and authorization rules.

### Priority 1 — reliability and data integrity

1. Add versioned database migrations.
2. Add a unique attendance constraint for user/date.
3. Add indexes for attendance, request status, employee ID, and date filters.
4. Add approval audit data: reviewer, decision time, decision reason, and change history.
5. Validate leave/OD dates and reject invalid date ranges.
6. Use UTC storage with consistent local-time display.
7. Rate-limit OTP requests and failed verification attempts.
8. Separate development, staging, test, and production databases.
9. Automate SQLite backups or migrate production data to PostgreSQL.

### Priority 2 — product improvements

1. Attendance correction workflow with evidence and approval.
2. Leave balances, leave types, holiday calendar, weekends, half-days, and shift rules.
3. Forgotten punch-out reminders and automated end-of-day exception reports.
4. Email/SMS/in-app notifications for approval decisions and late attendance.
5. Department, employee, role, and status filters for reports.
6. Per-campus configurable geofences and location freshness indicators.
7. Admin user management: activate/deactivate staff, change departments, reset employee IDs.
8. Privacy notice, location consent, retention policy, and access audit logging.

## Recommended Automated Test Plan

Create a separate test database for every run. Do not run test scripts against `backend/database.sqlite`.

| Test group | Important scenarios |
| --- | --- |
| Authentication | Valid OTP, invalid OTP, expired OTP, replayed OTP, rate limits, inactive account, token expiry. |
| Authorization | Staff cannot access reports/admin data; forged headers and mock tokens are rejected; scope rules are enforced. |
| Attendance | Valid punch-in, outside geofence rejection, punch-out, duplicate punch, late threshold, concurrent requests. |
| Location | Updates only while punched in, stale location flag, invalid values, admin-only visibility. |
| Leave and OD | Valid and invalid date ranges, ownership, approval, rejection, deletion rules, document authorization. |
| Reports | February/leap year, invalid dates, missing location data, CSV/Excel output. |
| Browser E2E | Login, punch flow, leave/OD submission, approval, reporting, logout, responsive navigation. |

## Release Decision

**Do not deploy to real users until Priority 0 items are completed and the lint/build/API test suite passes using an isolated test database.**

