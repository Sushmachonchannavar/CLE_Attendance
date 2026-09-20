# Test Execution Report — 16 September 2026

| Test ID | Feature/Page | Test scenario and steps | Expected result | Actual result | Status |
| --- | --- | --- | --- | --- | --- |
| TC-UI-001 | Login | Submit the empty login form. | Browser blocks a missing mobile number. | Native required-field validation shown. | PASS |
| TC-UI-002 | Login / OTP | Send an OTP, then submit an invalid code. | OTP dialog opens; readable error is shown. | Dialog opened and `Invalid OTP` displayed. | PASS |
| TC-UI-003 | Login / OTP | Send OTP and submit valid code. | User reaches dashboard. | Dashboard loaded. | PASS |
| TC-UI-004 | Route security | Open `/attendance` without a session. | Redirect to login. | Redirected to `/login`. | PASS |
| TC-UI-005 | Staff navigation | Open every staff sidebar page, refresh, then log out. | Pages remain usable; logout clears the session. | Attendance, Leave, OD, refresh, and logout succeeded. | PASS |
| TC-UI-006 | Admin navigation | Open admin dashboard and inspect role-specific links. | Admin links visible; staff attendance link absent. | Sidebar role links matched permissions. | PASS |
| TC-UI-007 | Attendance restriction | Simulate three accurate, consecutive locations outside the polygon during an active shift. | Automatic punch-out and session logout. | Active shift ended and user was redirected to login. | PASS |
| TC-AUTH-001 | Authentication API | Submit an active user's phone number. | OTP dispatch succeeds. | HTTP 200, successful dispatch response. | PASS |
| TC-AUTH-002 | Authentication API | Submit an unknown phone number. | Unknown account is rejected. | HTTP 403 with registration guidance. | PASS |
| TC-AUTH-003 | Authentication API | Submit no phone number. | Validation error. | HTTP 400, required field error. | PASS |
| TC-AUTH-004 | Authentication API | Verify a valid token. | Current user is returned. | HTTP 200 with user data. | PASS |
| TC-AUTH-005 | Logout security | Call protected endpoint without bearer token. | Access denied. | HTTP 401. | PASS |
| TC-AUTH-006 | Role security | Staff calls admin location endpoint. | Access denied. | HTTP 403. | PASS |
| TC-ROLE-001 | Role permissions | Exercise admin, principal, and staff management endpoints. | Only authorized roles can manage requests. | Admin/principal allowed; staff blocked. | PASS |
| TC-ATT-001 | Attendance | Punch in at campus coordinates; query database. | Attendance row and time saved. | HTTP 200 and row persisted. | PASS |
| TC-ATT-003 | Attendance | Punch out at campus coordinates; query database. | Punch-out time/location saved. | HTTP 200 and fields persisted. | PASS |
| TC-ATT-002 | Attendance | Attempt a third punch after completed attendance. | Duplicate is prevented. | HTTP 400. | PASS |
| TC-ATT-006 | Attendance | Retrieve attendance history. | User's records are returned. | HTTP 200 array returned. | PASS |
| TC-GEO-001 | Geofence | Punch in inside the campus polygon. | Punch-in allowed. | HTTP 200 and record created. | PASS |
| TC-GEO-002 | Geofence | Punch in far outside campus. | Punch-in blocked. | HTTP 400 with geofence error. | PASS |
| TC-GEO-004 | Geofence | Submit non-numeric coordinates. | Input validation error without a crash. | HTTP 400, clear invalid-coordinate error. | PASS |
| TC-GEO-005 | Location security | Send another user's ID in a location update body. | JWT user identity cannot be overridden. | Authenticated user's location only was written. | PASS |
| TC-LOC-001 | Location tracking | Punch in and inspect tracking row. | Tracking starts. | `is_tracking = 1`. | PASS |
| TC-LOC-002 | Location tracking | Admin requests active employee locations. | Active locations are returned. | HTTP 200 with employee list. | PASS |
| TC-LOC-003 | Location tracking | Staff requests active employee locations. | Access denied. | HTTP 403. | PASS |
| TC-LOC-004 | Location tracking | Punch out and inspect tracking row. | Tracking stops. | `is_tracking = 0`. | PASS |
| TC-LEAVE-001 | Leave requests | Submit a complete, valid leave request. | Row is stored. | HTTP 200; generated ID returned. | PASS |
| TC-LEAVE-002 | Leave requests | Submit leave with required fields omitted. | Validation error. | HTTP 400. | PASS |
| TC-LEAVE-003 | Leave approval | Admin approves a pending leave; inspect database. | Status becomes approved. | Status persisted as approved. | PASS |
| TC-LEAVE-007 | Leave approval | Approve leave on its end date. | Existing end-date rule permits it. | HTTP 200. | PASS |
| TC-LEAVE-008 | Leave approval | Approve a leave after its end date. | Existing end-date rule rejects it. | HTTP 400. | PASS |
| TC-OD-001 | OD requests | Submit a valid OD request with document. | Row is stored. | HTTP 200; generated ID returned. | PASS |
| TC-OD-002 | OD requests | Admin/principal retrieves OD requests. | Authorized list returned. | HTTP 200. | PASS |
| TC-OD-004 | OD approval | Principal approves a staff OD. | Status becomes approved. | Status persisted as approved. | PASS |
| TC-VAL-001 | OD validation | Submit OD with required fields omitted. | Validation error. | HTTP 400. | PASS |

## Execution notes

- Browser scenarios use controlled API responses so UI behavior is tested deterministically; backend scenarios use the real Express routes, middleware, migrations, and an isolated `database.test.sqlite` database.
- The browser suite covers validation, successful and failed OTP UI, navigation, refresh, logout, and route/role guards. API scenarios cover storage, validation, authorization, geofence, duplicate actions, and approval rules.
- Production build and ESLint both completed successfully. The build emitted only Vite's advisory warning that the main JavaScript bundle is above 500 kB.
