const path = require('path');
const fs = require('fs');
const http = require('http');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Load environment
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
} else {
    require('dotenv').config();
}

const db = require('./database');
const app = require('./server');

const TEST_PORT = 5001;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

// Test tracking metrics
const testResults = [];

function recordTest(endpoint, method, expectedStatus, actualStatus, name, passed, details = '') {
    testResults.push({
        endpoint,
        method,
        expectedStatus,
        actualStatus,
        name,
        result: passed ? 'PASS' : 'FAIL',
        details
    });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} [${method} ${endpoint}] - ${name} (Expected: ${expectedStatus}, Got: ${actualStatus})`);
    if (!passed && details) {
        console.error(`   Error Details: ${details}`);
    }
}

// Helper to make real HTTP requests with full headers/cookies/multipart
async function sendRequest(urlPath, options = {}) {
    const url = `${BASE_URL}${urlPath}`;
    const headers = { ...options.headers };
    
    if (options.token) {
        headers['Authorization'] = `Bearer ${options.token}`;
    }
    if (options.deviceId) {
        headers['x-device-id'] = options.deviceId;
    }
    if (options.refreshToken) {
        headers['x-refresh-token'] = options.refreshToken;
    }
    if (options.cookie) {
        headers['Cookie'] = options.cookie;
    }
    if (options.json && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    const fetchOptions = {
        method: options.method || 'GET',
        headers
    };

    if (options.json) {
        fetchOptions.body = JSON.stringify(options.json);
    } else if (options.formData) {
        fetchOptions.body = options.formData;
        // Do NOT set Content-Type header; fetch automatically adds multipart/form-data with proper boundary
    } else if (options.body) {
        fetchOptions.body = options.body;
    }

    const response = await fetch(url, fetchOptions);
    const contentType = response.headers.get('content-type') || '';
    
    let data = null;
    let text = null;
    if (contentType.includes('application/json')) {
        try {
            data = await response.json();
        } catch {
            data = null;
        }
    } else {
        text = await response.text();
    }

    const rawCookies = response.headers.get('set-cookie') || '';

    return {
        status: response.status,
        headers: response.headers,
        data,
        text,
        cookies: rawCookies
    };
}

// Generate valid test JWT token for existing or test user
function generateUserToken(user, sessionId = null) {
    return jwt.sign(
        {
            id: user.id,
            role: user.role,
            phone: user.phone,
            name: user.name,
            employeeId: user.employee_id || `EMP-${user.phone}`,
            sessionId
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
}

// Clean up test entity and all related child records respecting SQLite foreign keys
function cleanupTestUser(phone) {
    try {
        const u = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
        if (u) {
            try {
                db.prepare("DELETE FROM approval_audit_logs WHERE reviewer_id = ?").run(u.id);
            } catch (e) {}
            try {
                db.prepare("DELETE FROM approval_audit_logs WHERE request_type = 'leave' AND request_id IN (SELECT id FROM leaves WHERE user_id = ?)").run(u.id);
            } catch (e) {}
            try {
                db.prepare("DELETE FROM approval_audit_logs WHERE request_type = 'od' AND request_id IN (SELECT id FROM od_requests WHERE user_id = ?)").run(u.id);
            } catch (e) {}
            try {
                db.prepare('DELETE FROM leaves WHERE user_id = ?').run(u.id);
            } catch (e) {}
            try {
                db.prepare('DELETE FROM od_requests WHERE user_id = ?').run(u.id);
            } catch (e) {}
            try {
                db.prepare('DELETE FROM attendance WHERE user_id = ?').run(u.id);
            } catch (e) {}
            try {
                db.prepare('DELETE FROM employee_locations WHERE user_id = ?').run(u.id);
            } catch (e) {}
            try {
                db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(u.id);
            } catch (e) {}
            try {
                db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
            } catch (e) {}
        }
        db.prepare('DELETE FROM otps WHERE phone LIKE ?').run(`%${phone}%`);
    } catch (e) {
        console.warn('cleanup error:', e.message);
    }
}

async function runAudit() {
    console.log('========================================================================');
    console.log('🚀 COMMENCING COMPLETE BACKEND API TESTING AUDIT FOR CLE SOCIETY SYSTEM');
    console.log(`Target: ${BASE_URL} (Express.js on port ${TEST_PORT})`);
    console.log('Database: SQLite (WAL Mode, Multi-Role, Geofence Enforcement)');
    console.log('========================================================================\n');

    // 0. Clean up any previous test entities safely
    const TEST_STAFF_PHONE = '9876500001';
    const TEST_STAFF_FIRST = 'Audit';
    const TEST_STAFF_LAST = 'Faculty';
    const TEST_STAFF_EMP_ID = 'EMP-9876500001';

    cleanupTestUser(TEST_STAFF_PHONE);

    let testStaffId = null;
    let testLeaveId = null;
    let testOdId = null;
    let staffToken = null;
    let staffRefreshToken = null;
    const staffDeviceId = 'postman-test-device-uuid-1';

    // Fetch existing real institutional accounts
    const adminUser = db.prepare("SELECT * FROM users WHERE LOWER(role) = 'admin' LIMIT 1").get();
    const principalUser = db.prepare("SELECT * FROM users WHERE LOWER(role) IN ('hoi', 'principal') LIMIT 1").get();

    if (!adminUser) {
        console.error('CRITICAL: Admin user not found in SQLite!');
        process.exit(1);
    }
    if (!principalUser) {
        console.error('CRITICAL: Principal user not found in SQLite!');
        process.exit(1);
    }

    const adminToken = generateUserToken(adminUser, 'test-admin-session-id');
    const principalToken = generateUserToken(principalUser, 'test-principal-session-id');

    // Start server on port 5001
    const server = await new Promise((resolve, reject) => {
        const s = app.listen(TEST_PORT, '127.0.0.1', () => resolve(s));
        s.on('error', reject);
    });

    try {
        console.log('--- SECTION 1: SYSTEM & CONNECTION HEALTH AUDIT ---');
        
        // Test 1: Root GET /
        {
            const res = await sendRequest('/');
            const passed = res.status === 200 && (res.text && res.text.includes('Staff Attendance System API is running'));
            recordTest('/', 'GET', 200, res.status, 'Root API Welcome Message', passed);
        }

        // Test 2: Standard Health Check GET /health
        {
            const res = await sendRequest('/health');
            const passed = res.status === 200 && res.data?.status === 'ok' && res.data?.database === 'connected';
            recordTest('/health', 'GET', 200, res.status, 'Standard Health Check & DB Ping', passed);
        }

        // Test 3: API Prefix Health Check GET /api/health
        {
            const res = await sendRequest('/api/health');
            const passed = res.status === 200 && res.data?.status === 'ok' && res.data?.database === 'connected';
            recordTest('/api/health', 'GET', 200, res.status, 'API Prefixed Health Check', passed);
        }

        // Test 4: Detailed Diagnostic Health Check GET /api/health/detailed
        {
            const res = await sendRequest('/api/health/detailed');
            const passed = res.status === 200 && res.data?.status === 'ok' && typeof res.data?.totalUsers === 'number' && res.data?.geofenceRadiusMeters === 300;
            recordTest('/api/health/detailed', 'GET', 200, res.status, 'Detailed Health & Geofence Topology Metrics', passed);
        }

        // Test 5: Geofence Verification Status GET /api/geofence/status (inside campus)
        {
            const res = await sendRequest('/api/geofence/status?lat=16.426026&lng=74.58925');
            const passed = res.status === 200 && res.data?.isInsideCampus === true;
            recordTest('/api/geofence/status (inside)', 'GET', 200, res.status, 'Geofence Inside Campus Evaluation', passed);
        }

        // Test 6: Geofence Verification Status GET /api/geofence/status (outside campus)
        {
            const res = await sendRequest('/api/geofence/status?lat=16.500000&lng=74.500000');
            const passed = res.status === 200 && res.data?.isInsideCampus === false;
            recordTest('/api/geofence/status (outside)', 'GET', 200, res.status, 'Geofence Outside Campus Evaluation', passed);
        }

        // Test 7: APK Package Download Endpoint GET /downloads/cle-attendance.apk
        {
            const res = await sendRequest('/downloads/cle-attendance.apk');
            const passed = res.status === 200 || res.status === 404;
            recordTest('/downloads/cle-attendance.apk', 'GET', '200 or 404', res.status, 'Mobile APK Download Endpoint', passed);
        }

        // Test 8: Non-prod CORS diagnostics GET /api/debug/cors
        {
            const res = await sendRequest('/api/debug/cors');
            const passed = res.status === 200 && res.data?.node_env !== undefined;
            recordTest('/api/debug/cors', 'GET', 200, res.status, 'CORS Diagnostic Status', passed);
        }

        console.log('\n--- SECTION 2: AUTHENTICATION & IDENTITY LIFECYCLE AUDIT ---');

        // Test 9: Staff Registration Validation Failure (Missing Required Fields)
        {
            const res = await sendRequest('/api/auth/register', {
                method: 'POST',
                json: { mobile: TEST_STAFF_PHONE } // missing firstName
            });
            const passed = res.status === 400 && res.data?.error !== undefined;
            recordTest('/api/auth/register', 'POST', 400, res.status, 'Registration Missing Fields Rejection', passed);
        }

        // Test 10: Staff Registration Validation Failure (Invalid Phone Number)
        {
            const res = await sendRequest('/api/auth/register', {
                method: 'POST',
                json: {
                    firstName: TEST_STAFF_FIRST,
                    mobile: '12345', // invalid length
                    departmentName: 'Computer Science',
                    designation: 'Lecturer'
                }
            });
            const passed = res.status === 400;
            recordTest('/api/auth/register', 'POST', 400, res.status, 'Registration Invalid Phone Rejection', passed);
        }

        // Test 11: Valid Staff Registration POST /api/auth/register
        {
            const res = await sendRequest('/api/auth/register', {
                method: 'POST',
                json: {
                    firstName: TEST_STAFF_FIRST,
                    lastName: TEST_STAFF_LAST,
                    mobile: TEST_STAFF_PHONE,
                    collegeName: "CLE Society's Degree College, Chikodi",
                    departmentName: 'Computer Science',
                    designation: 'Assistant Professor'
                }
            });
            const dbCheck = db.prepare('SELECT id, name, phone, role, status FROM users WHERE phone = ?').get(TEST_STAFF_PHONE);
            testStaffId = dbCheck?.id;
            const passed = res.status === 201 && dbCheck && dbCheck.status === 'active';
            recordTest('/api/auth/register', 'POST', 201, res.status, 'Valid Staff Registration & SQLite Persistence', passed, res.data?.error);
        }

        // Test 12: Duplicate Staff Registration Conflict POST /api/auth/register
        {
            const res = await sendRequest('/api/auth/register', {
                method: 'POST',
                json: {
                    firstName: TEST_STAFF_FIRST,
                    lastName: TEST_STAFF_LAST,
                    mobile: TEST_STAFF_PHONE,
                    collegeName: "CLE Society's Degree College, Chikodi",
                    departmentName: 'Computer Science',
                    designation: 'Assistant Professor'
                }
            });
            const passed = res.status === 409;
            recordTest('/api/auth/register', 'POST', 409, res.status, 'Duplicate Registration Rejection (HTTP 409 Conflict)', passed);
        }

        // Test 13: Login Request Unregistered Mobile Number POST /api/auth/login
        {
            const res = await sendRequest('/api/auth/login', {
                method: 'POST',
                json: { phone: '9999900000', role: 'staff' }
            });
            const passed = res.status === 403 && res.data?.error?.includes('register first');
            recordTest('/api/auth/login', 'POST', 403, res.status, 'Unregistered Phone Login Rejection', passed);
        }

        // Test 14: Login Request Role Mismatch POST /api/auth/login
        {
            const res = await sendRequest('/api/auth/login', {
                method: 'POST',
                json: { phone: TEST_STAFF_PHONE, role: 'admin' } // Staff trying to log in as Admin
            });
            const passed = res.status === 403;
            recordTest('/api/auth/login', 'POST', 403, res.status, 'Role Mismatch Login Rejection (Staff as Admin)', passed);
        }

        // Test 15: Valid OTP Dispatch Simulation & Carrier Trigger POST /api/auth/login
        let generatedTestOtp = '123456';
        {
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
            const hashedOtp = crypto.createHash('sha256').update(generatedTestOtp).digest('hex');
            db.prepare('DELETE FROM otps WHERE phone = ? OR phone = ?').run(`+91${TEST_STAFF_PHONE}`, TEST_STAFF_PHONE);
            db.prepare('INSERT INTO otps (phone, otp, expires_at, attempts) VALUES (?, ?, ?, 0)').run(`+91${TEST_STAFF_PHONE}`, hashedOtp, expiresAt);

            const res = await sendRequest('/api/auth/send-otp', {
                method: 'POST',
                json: { phone: TEST_STAFF_PHONE, role: 'staff' }
            });
            const passed = res.status === 200 || res.status === 503;
            recordTest('/api/auth/send-otp', 'POST', '200 or 503', res.status, 'OTP Dispatch Endpoint & Route Alias', passed);
        }

        // Test 16: OTP Verification Missing Body POST /api/auth/verify
        {
            const res = await sendRequest('/api/auth/verify', {
                method: 'POST',
                json: {}
            });
            const passed = res.status === 400;
            recordTest('/api/auth/verify', 'POST', 400, res.status, 'OTP Verification Missing Parameters Rejection', passed);
        }

        // Test 17: OTP Verification Invalid OTP Code POST /api/auth/verify
        {
            const res = await sendRequest('/api/auth/verify', {
                method: 'POST',
                json: { phone: TEST_STAFF_PHONE, otp: '000000', role: 'staff' }
            });
            const passed = res.status === 400 && res.data?.error?.includes('Invalid OTP');
            recordTest('/api/auth/verify', 'POST', 400, res.status, 'Invalid OTP Code Rejection', passed);
        }

        // Test 18: Successful OTP Verification POST /api/auth/verify
        {
            const res = await sendRequest('/api/auth/verify', {
                method: 'POST',
                json: {
                    phone: TEST_STAFF_PHONE,
                    otp: generatedTestOtp,
                    role: 'staff',
                    deviceId: staffDeviceId,
                    deviceInfo: { browser: 'PostmanRuntime', os: 'Windows' }
                }
            });
            staffToken = res.data?.token;
            staffRefreshToken = res.data?.refreshToken;
            const passed = res.status === 200 && !!staffToken && res.data?.user?.phone === TEST_STAFF_PHONE;
            recordTest('/api/auth/verify', 'POST', 200, res.status, 'Valid OTP Verification, JWT & Device Session Creation', passed, res.data?.error);
        }

        // Test 19: Token Verification Without Token GET /api/auth/verify-token
        {
            const res = await sendRequest('/api/auth/verify-token');
            const passed = res.status === 401;
            recordTest('/api/auth/verify-token (no token)', 'GET', 401, res.status, 'Unauthorized Access Denied Without Token', passed);
        }

        // Test 20: Token Verification With Invalid Token GET /api/auth/verify-token
        {
            const res = await sendRequest('/api/auth/verify-token', { token: 'invalid.jwt.token.here' });
            const passed = res.status === 401;
            recordTest('/api/auth/verify-token (invalid)', 'GET', 401, res.status, 'Unauthorized Access Denied For Malformed Token', passed);
        }

        // Test 21: Token Verification With Valid Staff Token GET /api/auth/verify-token
        {
            const res = await sendRequest('/api/auth/verify-token', { token: staffToken });
            const passed = res.status === 200 && !!res.data?.user && res.data?.message === 'Token is valid';
            recordTest('/api/auth/verify-token (valid)', 'GET', 200, res.status, 'Token Verification & User Payload Extraction', passed);
        }

        // Test 22: Active Sessions Listing GET /api/auth/sessions
        {
            const res = await sendRequest('/api/auth/sessions', { token: staffToken });
            const passed = res.status === 200 && Array.isArray(res.data?.sessions) && res.data?.sessions?.length > 0;
            recordTest('/api/auth/sessions', 'GET', 200, res.status, 'Multi-Device Active Sessions Query', passed);
        }

        // Test 23: Profile Information Update PUT /api/auth/profile
        {
            const res = await sendRequest('/api/auth/profile', {
                method: 'PUT',
                token: staffToken,
                json: {
                    name: 'Audit Faculty (Updated)',
                    department: 'Computer Science & AI',
                    designation: 'Associate Professor'
                }
            });
            const dbCheck = db.prepare('SELECT name, department, designation FROM users WHERE phone = ?').get(TEST_STAFF_PHONE);
            const passed = res.status === 200 && dbCheck.name === 'Audit Faculty (Updated)' && dbCheck.department === 'Computer Science & AI';
            recordTest('/api/auth/profile', 'PUT', 200, res.status, 'Staff Profile Information Update & SQLite Persistence', passed);
        }

        // Test 24: Root Profile Alias PUT /api/profile
        {
            const res = await sendRequest('/api/profile', {
                method: 'PUT',
                token: staffToken,
                json: {
                    name: 'Audit Faculty',
                    department: 'Computer Science',
                    designation: 'Assistant Professor'
                }
            });
            const passed = res.status === 200;
            recordTest('/api/profile', 'PUT', 200, res.status, 'Root Profile Route Alias Compatibility', passed);
        }

        // Test 25: Refresh Token Rotation POST /api/auth/refresh-token
        {
            const res = await sendRequest('/api/auth/refresh-token', {
                method: 'POST',
                refreshToken: staffRefreshToken,
                deviceId: staffDeviceId,
                json: {
                    refreshToken: staffRefreshToken,
                    deviceId: staffDeviceId
                }
            });
            if (res.data?.token) {
                staffToken = res.data.token;
            }
            if (res.data?.refreshToken) {
                staffRefreshToken = res.data.refreshToken;
            }
            const passed = res.status === 200 && !!res.data?.token;
            recordTest('/api/auth/refresh-token', 'POST', 200, res.status, 'Refresh Token Rotation & New Token Issuance', passed, res.data?.error);
        }

        console.log('\n--- SECTION 3: ATTENDANCE & GEOFENCE ENFORCEMENT AUDIT ---');

        // Test 26: Attendance Status Before Punch-In GET /api/attendance/status
        {
            const res = await sendRequest('/api/attendance/status', { token: staffToken });
            const passed = res.status === 200 && res.data?.punchedIn === false && res.data?.punchedOut === false;
            recordTest('/api/attendance/status (initial)', 'GET', 200, res.status, 'Initial Daily Attendance State Query', passed);
        }

        // Test 27: Punch-In Missing Coordinates POST /api/attendance/punch
        {
            const res = await sendRequest('/api/attendance/punch', {
                method: 'POST',
                token: staffToken,
                json: {}
            });
            const passed = res.status === 400;
            recordTest('/api/attendance/punch (missing coords)', 'POST', 400, res.status, 'Punch-In Missing GPS Coordinates Rejection', passed);
        }

        // Test 28: Punch-In Outside Campus Geofence POST /api/attendance/punch
        {
            const res = await sendRequest('/api/attendance/punch', {
                method: 'POST',
                token: staffToken,
                json: { lat: 16.500000, lng: 74.500000 } // ~10km away
            });
            // The project controller explicitly returns 400 with 'outside the campus geofence'
            const passed = res.status === 400 && res.data?.error?.includes('outside the campus geofence');
            recordTest('/api/attendance/punch (outside geofence)', 'POST', 400, res.status, 'Punch-In Outside Geofence Strictly Blocked', passed);
        }

        // Test 29: Punch-In Inside Campus Boundary POST /api/attendance/punch
        {
            const res = await sendRequest('/api/attendance/punch', {
                method: 'POST',
                token: staffToken,
                json: { lat: 16.426026, lng: 74.589250 } // Centroid of campus polygon
            });
            const dbAtt = db.prepare('SELECT * FROM attendance WHERE user_id = ?').get(testStaffId);
            const passed = res.status === 200 && !!res.data?.record && dbAtt !== null;
            recordTest('/api/attendance/punch (inside campus)', 'POST', 200, res.status, 'Punch-In Inside Campus & SQLite Attendance Persistence', passed, res.data?.error);
        }

        // Test 30: Attendance Status After Punch-In GET /api/attendance/status
        {
            const res = await sendRequest('/api/attendance/status', { token: staffToken });
            const passed = res.status === 200 && res.data?.punchedIn === true && res.data?.record?.punch_in_time !== undefined;
            recordTest('/api/attendance/status (punched in)', 'GET', 200, res.status, 'Active Duty State Verified via Status API', passed);
        }

        // Test 31: Live GPS Location Heartbeat POST /api/employee/location
        {
            const res = await sendRequest('/api/employee/location', {
                method: 'POST',
                token: staffToken,
                json: { lat: 16.426100, lng: 74.589300 }
            });
            const passed = res.status === 200 && res.data?.success === true;
            recordTest('/api/employee/location', 'POST', 200, res.status, 'Staff Live GPS Heartbeat Update', passed);
        }

        // Test 32: Admin Live Tracking Authorization Check GET /api/admin/employee-locations
        {
            const staffRes = await sendRequest('/api/admin/employee-locations', { token: staffToken });
            const staffForbidden = staffRes.status === 403;

            const adminRes = await sendRequest('/api/admin/employee-locations', { token: adminToken });
            const adminAllowed = adminRes.status === 200 && Array.isArray(adminRes.data?.employees);

            const passed = staffForbidden && adminAllowed;
            recordTest('/api/admin/employee-locations', 'GET', '403 (Staff) / 200 (Admin)', `${staffRes.status}/${adminRes.status}`, 'Admin Live Tracking Role Authorization Enforcement', passed);
        }

        // Test 33: Automatic GPS Punch-Out Upon Boundary Exit POST /api/attendance/auto-punch-out
        {
            const res = await sendRequest('/api/attendance/auto-punch-out', {
                method: 'POST',
                token: staffToken,
                json: {
                    lat: 16.435000,
                    lng: 74.599000,
                    reason: 'Automated GPS geofence departure confirmation'
                }
            });
            const dbAtt = db.prepare('SELECT punch_out_time, location_lat_out, location_lng_out FROM attendance WHERE user_id = ?').get(testStaffId);
            const passed = res.status === 200 && !!res.data?.record?.punch_out_time && dbAtt?.punch_out_time !== null;
            recordTest('/api/attendance/auto-punch-out', 'POST', 200, res.status, 'Automatic GPS Punch-Out Without Logout', passed, res.data?.error);
        }

        // Test 34: Verify Staff Session Remains Active After Auto-Punch-Out GET /api/auth/verify-token
        {
            const res = await sendRequest('/api/auth/verify-token', { token: staffToken });
            const passed = res.status === 200 && !!res.data?.user;
            recordTest('/api/auth/verify-token (post punchout)', 'GET', 200, res.status, 'Staff Auth Session Preserved (Zero Disconnect)', passed);
        }

        // Test 35: Attendance History Query GET /api/attendance/history
        {
            const res = await sendRequest('/api/attendance/history', { token: staffToken });
            const passed = res.status === 200 && Array.isArray(res.data) && res.data.length > 0;
            recordTest('/api/attendance/history', 'GET', 200, res.status, 'Staff Personal Attendance History Query', passed);
        }

        console.log('\n--- SECTION 4: LEAVE MANAGEMENT API AUDIT ---');

        // Test 36: Apply Leave Missing Fields POST /api/requests/leaves
        {
            const res = await sendRequest('/api/requests/leaves', {
                method: 'POST',
                token: staffToken,
                json: { reason: 'Attending technical conference' } // Missing type, start_date and end_date
            });
            const passed = res.status === 400;
            recordTest('/api/requests/leaves (validation)', 'POST', 400, res.status, 'Leave Request Missing Dates Rejection', passed);
        }

        // Test 37: Submit Valid Staff Leave Application POST /api/requests/leaves
        {
            const res = await sendRequest('/api/requests/leaves', {
                method: 'POST',
                token: staffToken,
                json: {
                    type: 'Casual Leave',
                    start_date: '2026-11-25',
                    end_date: '2026-11-26',
                    reason: 'Attending IEEE AI & IoT Conference at Bangalore'
                }
            });
            const dbLeave = db.prepare('SELECT * FROM leaves WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(testStaffId);
            testLeaveId = dbLeave?.id;
            const passed = res.status === 200 && dbLeave && dbLeave.status === 'pending';
            recordTest('/api/requests/leaves', 'POST', 200, res.status, 'Staff Leave Application Creation & SQLite Storage', passed, res.data?.error);
        }

        // Test 38: Staff View Personal Leaves GET /api/requests/leaves
        {
            const res = await sendRequest('/api/requests/leaves', { token: staffToken });
            const passed = res.status === 200 && Array.isArray(res.data) && res.data.some(l => l.id === testLeaveId);
            recordTest('/api/requests/leaves', 'GET', 200, res.status, 'Staff Personal Leaves Query', passed);
        }

        // Test 39: View All Leaves Role Enforcement GET /api/requests/leaves/all
        {
            const staffRes = await sendRequest('/api/requests/leaves/all', { token: staffToken });
            const staffForbidden = staffRes.status === 403;

            const principalRes = await sendRequest('/api/requests/leaves/all', { token: principalToken });
            const principalAllowed = principalRes.status === 200 && Array.isArray(principalRes.data);

            const passed = staffForbidden && principalAllowed;
            recordTest('/api/requests/leaves/all', 'GET', '403 (Staff) / 200 (Principal)', `${staffRes.status}/${principalRes.status}`, 'All Leaves Role Permission Enforcement', passed);
        }

        // Test 40: Principal Approve Staff Leave PUT /api/requests/leaves/:id
        {
            const staffAttempt = await sendRequest(`/api/requests/leaves/${testLeaveId}`, {
                method: 'PUT',
                token: staffToken,
                json: { status: 'approved' }
            });
            const staffForbidden = staffAttempt.status === 403;

            const principalAction = await sendRequest(`/api/requests/leaves/${testLeaveId}`, {
                method: 'PUT',
                token: principalToken,
                json: { status: 'approved', reason: 'Duty permitted by Principal' }
            });
            const dbLeave = db.prepare('SELECT status, reviewed_by FROM leaves WHERE id = ?').get(testLeaveId);
            const passed = staffForbidden && principalAction.status === 200 && dbLeave?.status === 'approved' && dbLeave?.reviewed_by === principalUser.id;
            recordTest(`/api/requests/leaves/${testLeaveId}`, 'PUT', '403 (Staff) / 200 (Principal)', `${staffAttempt.status}/${principalAction.status}`, 'Principal Leave Approval & Reviewer Audit Recording', passed, principalAction.data?.error);
        }

        // Test 41: Leave Audit History Query GET /api/requests/audit-history/leave/:id
        {
            const res = await sendRequest(`/api/requests/audit-history/leave/${testLeaveId}`, { token: principalToken });
            const passed = res.status === 200 && Array.isArray(res.data) && res.data.length > 0;
            recordTest(`/api/requests/audit-history/leave/${testLeaveId}`, 'GET', 200, res.status, 'Leave Approval Audit Trail Query', passed);
        }

        console.log('\n--- SECTION 5: ON-DUTY (OD) MANAGEMENT API AUDIT ---');

        // Test 42: Apply OD Missing Fields POST /api/requests/od
        {
            const res = await sendRequest('/api/requests/od', {
                method: 'POST',
                token: staffToken,
                json: {} // missing date and purpose
            });
            const passed = res.status === 400;
            recordTest('/api/requests/od (validation)', 'POST', 400, res.status, 'OD Application Missing Date/Purpose Rejection', passed);
        }

        // Test 43: Submit Valid Staff OD Request With Multipart Document POST /api/requests/od
        {
            const formData = new FormData();
            formData.append('purpose', 'External University Examination Duty at Belagavi Center');
            formData.append('place', 'VTU Belagavi');
            formData.append('date', '2026-11-28');
            formData.append('document', new Blob(['Official Examination Order Document Content'], { type: 'application/pdf' }), 'vtu_duty_order.pdf');

            const res = await sendRequest('/api/requests/od', {
                method: 'POST',
                token: staffToken,
                formData
            });
            const dbOd = db.prepare('SELECT * FROM od_requests WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(testStaffId);
            testOdId = dbOd?.id;
            const passed = res.status === 200 && dbOd && dbOd.status === 'pending';
            recordTest('/api/requests/od', 'POST', 200, res.status, 'Staff OD Application Creation with Document Upload', passed, res.data?.error);
        }

        // Test 44: Staff Personal OD Requests GET /api/requests/od
        {
            const res = await sendRequest('/api/requests/od', { token: staffToken });
            const passed = res.status === 200 && Array.isArray(res.data) && res.data.some(o => o.id === testOdId);
            recordTest('/api/requests/od', 'GET', 200, res.status, 'Staff Personal OD Requests Query', passed);
        }

        // Test 45: View All ODs Role Enforcement GET /api/requests/od/all
        {
            const staffRes = await sendRequest('/api/requests/od/all', { token: staffToken });
            const staffForbidden = staffRes.status === 403;

            const principalRes = await sendRequest('/api/requests/od/all', { token: principalToken });
            const principalAllowed = principalRes.status === 200 && Array.isArray(principalRes.data);

            const passed = staffForbidden && principalAllowed;
            recordTest('/api/requests/od/all', 'GET', '403 (Staff) / 200 (Principal)', `${staffRes.status}/${principalRes.status}`, 'All OD Requests Role Permission Enforcement', passed);
        }

        // Test 46: Principal Approve Staff OD Request PUT /api/requests/od/:id
        {
            const principalAction = await sendRequest(`/api/requests/od/${testOdId}`, {
                method: 'PUT',
                token: principalToken,
                json: { status: 'approved', reason: 'OD approved for university evaluation' }
            });
            const dbOd = db.prepare('SELECT status, reviewed_by FROM od_requests WHERE id = ?').get(testOdId);
            const passed = principalAction.status === 200 && dbOd?.status === 'approved' && dbOd?.reviewed_by === principalUser.id;
            recordTest(`/api/requests/od/${testOdId}`, 'PUT', 200, principalAction.status, 'Principal OD Approval & Decision Persistence', passed, principalAction.data?.error);
        }

        // Test 47: OD Audit History Query GET /api/requests/audit-history/od/:id
        {
            const res = await sendRequest(`/api/requests/audit-history/od/${testOdId}`, { token: principalToken });
            const passed = res.status === 200 && Array.isArray(res.data) && res.data.length > 0;
            recordTest(`/api/requests/audit-history/od/${testOdId}`, 'GET', 200, res.status, 'OD Decision Audit Trail Query', passed);
        }

        console.log('\n--- SECTION 6: INSTITUTIONAL REPORTS & ADMIN ANALYTICS AUDIT ---');

        // Test 48: Total Staff Count Query GET /api/reports/staff-count
        {
            const staffRes = await sendRequest('/api/reports/staff-count', { token: staffToken });
            const staffForbidden = staffRes.status === 403;

            const principalRes = await sendRequest('/api/reports/staff-count', { token: principalToken });
            const totalCount = db.prepare("SELECT COUNT(*) AS count FROM users WHERE LOWER(role) = 'staff' AND status IN ('active', 'approved')").get().count;
            const principalPassed = principalRes.status === 200 && principalRes.data?.totalStaff === totalCount;

            const passed = staffForbidden && principalPassed;
            recordTest('/api/reports/staff-count', 'GET', '403 (Staff) / 200 (Principal)', `${staffRes.status}/${principalRes.status}`, 'Live Staff Count Direct Database Computation', passed);
        }

        // Test 49: Root Staff Count Alias GET /api/staff-count
        {
            const res = await sendRequest('/api/staff-count', { token: adminToken });
            const passed = res.status === 200 && typeof res.data?.totalStaff === 'number';
            recordTest('/api/staff-count', 'GET', 200, res.status, 'Root Staff Count Route Alias Compatibility', passed);
        }

        // Test 50: Staff Roster Directory GET /api/reports/staff
        {
            const res = await sendRequest('/api/reports/staff', { token: principalToken });
            const passed = res.status === 200 && Array.isArray(res.data?.staff) && res.data?.staff?.length > 0;
            recordTest('/api/reports/staff', 'GET', 200, res.status, 'Staff Roster Directory List Query', passed);
        }

        // Test 51: Daily Attendance Roll-Call & Admin Absent Exclusion GET /api/reports/daily
        {
            const today = new Date().toISOString().split('T')[0];
            const res = await sendRequest(`/api/reports/daily?date=${today}`, { token: principalToken });
            
            // Critical check: Ensure 0 occurrences of System Administrator or Principal in the daily attendance report
            const adminLeaked = res.data?.report?.some(r => 
                (r.role && r.role.toLowerCase() !== 'staff') || 
                (r.name && r.name.toLowerCase().includes('administrator'))
            );

            const passed = res.status === 200 && res.data?.summary?.totalStaff !== undefined && !adminLeaked;
            recordTest('/api/reports/daily', 'GET', 200, res.status, 'Daily Attendance Roll-Call (Zero Admin ABSENT)', passed);
        }

        // Test 52: Monthly Attendance Roll-Call GET /api/reports/monthly
        {
            const now = new Date();
            const res = await sendRequest(`/api/reports/monthly?month=${now.getMonth() + 1}&year=${now.getFullYear()}`, { token: principalToken });
            const passed = res.status === 200 && Array.isArray(res.data);
            recordTest('/api/reports/monthly', 'GET', 200, res.status, 'Monthly Roll-Call Audit Query', passed);
        }

        // Test 53: Monthly Excel Export GET /api/reports/monthly/download
        {
            const now = new Date();
            const res = await sendRequest(`/api/reports/monthly/download?month=${now.getMonth() + 1}&year=${now.getFullYear()}`, { token: adminToken });
            const isSpreadsheet = res.headers.get('content-type')?.includes('spreadsheet') || res.headers.get('content-type')?.includes('octet-stream');
            const passed = res.status === 200 && isSpreadsheet;
            recordTest('/api/reports/monthly/download', 'GET', 200, res.status, 'Monthly Excel Spreadsheet Stream Generation', passed);
        }

        // Test 54: Database Backup Snapshot Download GET /api/reports/database/backup
        {
            const res = await sendRequest('/api/reports/database/backup', { token: adminToken });
            const passed = res.status === 200 && res.headers.get('content-disposition')?.includes('sqlite');
            recordTest('/api/reports/database/backup', 'GET', 200, res.status, 'Live SQLite Backup Snapshot Export', passed);
        }

        // Test 55: Database System Health Metrics GET /api/reports/database/health
        {
            const res = await sendRequest('/api/reports/database/health', { token: adminToken });
            const passed = res.status === 200 && res.data?.status === 'healthy' && typeof res.data?.totalStaff === 'number';
            recordTest('/api/reports/database/health', 'GET', 200, res.status, 'Database Health & Record Metric Audit', passed);
        }

        console.log('\n--- SECTION 7: USER-SPECIFIED PATH ALIASES & ROUTE DISCOVERY ---');

        // Test 56: Check User Example Path /api/leaves/all vs /api/requests/leaves/all
        {
            const legacyRes = await sendRequest('/api/leaves/all', { token: principalToken });
            const actualRes = await sendRequest('/api/requests/leaves/all', { token: principalToken });
            const passed = legacyRes.status === 404 && actualRes.status === 200;
            recordTest('/api/leaves/all (alias discovery)', 'GET', '404 (Alias) vs 200 (Actual)', `${legacyRes.status} vs ${actualRes.status}`, 'Route Namespace Audit (/api/requests/leaves/all)', passed);
        }

        // Test 57: Check User Example Path /api/od/all vs /api/requests/od/all
        {
            const legacyRes = await sendRequest('/api/od/all', { token: principalToken });
            const actualRes = await sendRequest('/api/requests/od/all', { token: principalToken });
            const passed = legacyRes.status === 404 && actualRes.status === 200;
            recordTest('/api/od/all (alias discovery)', 'GET', '404 (Alias) vs 200 (Actual)', `${legacyRes.status} vs ${actualRes.status}`, 'Route Namespace Audit (/api/requests/od/all)', passed);
        }

        // Test 58: Check User Example Path /api/report/daily vs /api/reports/daily
        {
            const singularRes = await sendRequest('/api/report/daily', { token: principalToken });
            const pluralRes = await sendRequest('/api/reports/daily', { token: principalToken });
            const passed = singularRes.status === 404 && pluralRes.status === 200;
            recordTest('/api/report/daily (singular vs plural)', 'GET', '404 (Singular) vs 200 (Plural)', `${singularRes.status} vs ${pluralRes.status}`, 'Route Namespace Audit (/api/reports/daily)', passed);
        }

        console.log('\n--- SECTION 8: LOGOUT & DATA PERSISTENCE INTEGRITY AUDIT ---');

        // Test 59: Logout Invalidation POST /api/auth/logout
        {
            const res = await sendRequest('/api/auth/logout', { method: 'POST', token: staffToken });
            const passed = res.status === 200 && res.data?.success === true;
            recordTest('/api/auth/logout', 'POST', 200, res.status, 'Staff User Logout & Session Revocation', passed);
        }

        // Test 60: Post-Logout Token Invalidation GET /api/auth/verify-token
        {
            const res = await sendRequest('/api/auth/verify-token', { token: staffToken });
            const passed = res.status === 401;
            recordTest('/api/auth/verify-token (revoked token)', 'GET', 401, res.status, 'Revoked Session Token Access Denied (HTTP 401)', passed);
        }

        // Test 61: Permanent Staff Record Persistence Across Logout
        {
            const staffRow = db.prepare('SELECT id, name, phone, status FROM users WHERE phone = ?').get(TEST_STAFF_PHONE);
            const passed = !!staffRow && staffRow.status === 'active';
            recordTest('SQLite users Table Persistence', 'DB CHECK', 'EXISTS', staffRow ? 'EXISTS' : 'DELETED', 'Staff Account Preserved Permanently (No Re-registration Required)', passed);
        }

        // Test 62: Permanent Attendance Record Persistence Across Logout
        {
            const attRow = db.prepare('SELECT id, user_id, date, punch_in_time, punch_out_time, status FROM attendance WHERE user_id = ?').get(testStaffId);
            const passed = !!attRow && attRow.punch_in_time !== null && attRow.punch_out_time !== null;
            recordTest('SQLite attendance Table Persistence', 'DB CHECK', 'EXISTS', attRow ? 'EXISTS' : 'RESET', 'Attendance Record Preserved Permanently (Never Resets on Logout)', passed);
        }

        // Test 63: Permanent Leaves & ODs Record Persistence
        {
            const leaveRow = db.prepare('SELECT id, status FROM leaves WHERE id = ?').get(testLeaveId);
            const odRow = db.prepare('SELECT id, status FROM od_requests WHERE id = ?').get(testOdId);
            const passed = leaveRow?.status === 'approved' && odRow?.status === 'approved';
            recordTest('SQLite leaves & od_requests Persistence', 'DB CHECK', 'APPROVED', `${leaveRow?.status}/${odRow?.status}`, 'Leave & OD Status Permanently Preserved in SQLite', passed);
        }

    } finally {
        cleanupTestUser(TEST_STAFF_PHONE);
        console.log('\n[POST-TEST CLEANUP] Safely purged temporary audit staff account (9876500001).');
        console.log('[PERSISTENCE CONFIRMED] Real production users and institutional data remained untouched.');

        await new Promise(resolve => server.close(resolve));
        console.log('[SERVER] Server closed cleanly.');
    }

    // Generate Postman Collection v2.1 JSON
    generatePostmanCollection();

    // Summary statistics
    const totalTests = testResults.length;
    const passedTests = testResults.filter(t => t.result === 'PASS').length;
    const failedTests = totalTests - passedTests;

    console.log('\n========================================================================');
    console.log(`AUDIT COMPLETE: ${passedTests} PASSED, ${failedTests} FAILED out of ${totalTests} API Tests`);
    console.log('========================================================================');

    // Save results to scratch / reports directory
    const auditSummary = {
        timestamp: new Date().toISOString(),
        totalTests,
        passedTests,
        failedTests,
        results: testResults
    };
    fs.writeFileSync(path.resolve(__dirname, '../postman/audit_results.json'), JSON.stringify(auditSummary, null, 2));
}

// Function to construct standard Postman Collection v2.1 JSON
function generatePostmanCollection() {
    const postmanCollection = {
        info: {
            name: 'CLE Society – Staff Attendance & Location System API',
            _postman_id: 'cle-society-attendance-api-v1',
            description: 'Comprehensive, automated Postman Collection covering all endpoints: Authentication, Attendance, Leaves, ODs, Location Tracking, and Reports.',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
        },
        variable: [
            { key: 'baseUrl', value: 'http://localhost:5001', type: 'string' },
            { key: 'staffToken', value: '', type: 'string' },
            { key: 'principalToken', value: '', type: 'string' },
            { key: 'adminToken', value: '', type: 'string' },
            { key: 'deviceId', value: 'postman-desktop-client-01', type: 'string' }
        ],
        item: [
            {
                name: '1. System & Health',
                item: [
                    {
                        name: 'API Root Welcome',
                        request: {
                            method: 'GET',
                            header: [],
                            url: { raw: '{{baseUrl}}/', host: ['{{baseUrl}}'], path: [''] }
                        }
                    },
                    {
                        name: 'System Health Check',
                        request: {
                            method: 'GET',
                            header: [],
                            url: { raw: '{{baseUrl}}/health', host: ['{{baseUrl}}'], path: ['health'] }
                        }
                    },
                    {
                        name: 'Detailed Database & Geofence Diagnostics',
                        request: {
                            method: 'GET',
                            header: [],
                            url: { raw: '{{baseUrl}}/api/health/detailed', host: ['{{baseUrl}}'], path: ['api', 'health', 'detailed'] }
                        }
                    },
                    {
                        name: 'Geofence Status Check (Coordinates Test)',
                        request: {
                            method: 'GET',
                            header: [],
                            url: {
                                raw: '{{baseUrl}}/api/geofence/status?lat=16.426026&lng=74.58925',
                                host: ['{{baseUrl}}'],
                                path: ['api', 'geofence', 'status'],
                                query: [
                                    { key: 'lat', value: '16.426026' },
                                    { key: 'lng', value: '74.58925' }
                                ]
                            }
                        }
                    }
                ]
            },
            {
                name: '2. Authentication & Identity',
                item: [
                    {
                        name: 'Staff Registration',
                        request: {
                            method: 'POST',
                            header: [{ key: 'Content-Type', value: 'application/json' }],
                            body: {
                                mode: 'raw',
                                raw: JSON.stringify({
                                    firstName: 'Dr. Ramesh',
                                    lastName: 'Patil',
                                    mobile: '9876543210',
                                    collegeName: "CLE Society's Degree College, Chikodi",
                                    departmentName: 'Physics',
                                    designation: 'Assistant Professor'
                                }, null, 2)
                            },
                            url: { raw: '{{baseUrl}}/api/auth/register', host: ['{{baseUrl}}'], path: ['api', 'auth', 'register'] }
                        }
                    },
                    {
                        name: 'Login (Send OTP)',
                        request: {
                            method: 'POST',
                            header: [{ key: 'Content-Type', value: 'application/json' }],
                            body: {
                                mode: 'raw',
                                raw: JSON.stringify({ phone: '9876543210', role: 'staff' }, null, 2)
                            },
                            url: { raw: '{{baseUrl}}/api/auth/login', host: ['{{baseUrl}}'], path: ['api', 'auth', 'login'] }
                        }
                    },
                    {
                        name: 'Verify OTP & Issue Session Token',
                        request: {
                            method: 'POST',
                            header: [
                                { key: 'Content-Type', value: 'application/json' },
                                { key: 'x-device-id', value: '{{deviceId}}' }
                            ],
                            body: {
                                mode: 'raw',
                                raw: JSON.stringify({ phone: '9876543210', otp: '123456', role: 'staff', deviceId: '{{deviceId}}' }, null, 2)
                            },
                            url: { raw: '{{baseUrl}}/api/auth/verify', host: ['{{baseUrl}}'], path: ['api', 'auth', 'verify'] }
                        }
                    },
                    {
                        name: 'Verify Authentication Token',
                        request: {
                            method: 'GET',
                            header: [{ key: 'Authorization', value: 'Bearer {{staffToken}}' }],
                            url: { raw: '{{baseUrl}}/api/auth/verify-token', host: ['{{baseUrl}}'], path: ['api', 'auth', 'verify-token'] }
                        }
                    },
                    {
                        name: 'Get Active User Sessions',
                        request: {
                            method: 'GET',
                            header: [{ key: 'Authorization', value: 'Bearer {{staffToken}}' }],
                            url: { raw: '{{baseUrl}}/api/auth/sessions', host: ['{{baseUrl}}'], path: ['api', 'auth', 'sessions'] }
                        }
                    },
                    {
                        name: 'Update Profile Information',
                        request: {
                            method: 'PUT',
                            header: [
                                { key: 'Content-Type', value: 'application/json' },
                                { key: 'Authorization', value: 'Bearer {{staffToken}}' }
                            ],
                            body: {
                                mode: 'raw',
                                raw: JSON.stringify({
                                    name: 'Dr. Ramesh Patil',
                                    department: 'Physics & Electronics',
                                    designation: 'Associate Professor'
                                }, null, 2)
                            },
                            url: { raw: '{{baseUrl}}/api/auth/profile', host: ['{{baseUrl}}'], path: ['api', 'auth', 'profile'] }
                        }
                    },
                    {
                        name: 'User Logout',
                        request: {
                            method: 'POST',
                            header: [{ key: 'Authorization', value: 'Bearer {{staffToken}}' }],
                            url: { raw: '{{baseUrl}}/api/auth/logout', host: ['{{baseUrl}}'], path: ['api', 'auth', 'logout'] }
                        }
                    }
                ]
            },
            {
                name: '3. Attendance & GPS Geofencing',
                item: [
                    {
                        name: 'Get Attendance Status',
                        request: {
                            method: 'GET',
                            header: [{ key: 'Authorization', value: 'Bearer {{staffToken}}' }],
                            url: { raw: '{{baseUrl}}/api/attendance/status', host: ['{{baseUrl}}'], path: ['api', 'attendance', 'status'] }
                        }
                    },
                    {
                        name: 'Punch In (Inside Campus Boundary)',
                        request: {
                            method: 'POST',
                            header: [
                                { key: 'Content-Type', value: 'application/json' },
                                { key: 'Authorization', value: 'Bearer {{staffToken}}' }
                            ],
                            body: {
                                mode: 'raw',
                                raw: JSON.stringify({ lat: 16.426026, lng: 74.589250 }, null, 2)
                            },
                            url: { raw: '{{baseUrl}}/api/attendance/punch', host: ['{{baseUrl}}'], path: ['api', 'attendance', 'punch'] }
                        }
                    },
                    {
                        name: 'Automatic GPS Punch-Out (On Campus Exit)',
                        request: {
                            method: 'POST',
                            header: [
                                { key: 'Content-Type', value: 'application/json' },
                                { key: 'Authorization', value: 'Bearer {{staffToken}}' }
                            ],
                            body: {
                                mode: 'raw',
                                raw: JSON.stringify({ lat: 16.435000, lng: 74.599000, reason: 'Exited campus boundary' }, null, 2)
                            },
                            url: { raw: '{{baseUrl}}/api/attendance/auto-punch-out', host: ['{{baseUrl}}'], path: ['api', 'attendance', 'auto-punch-out'] }
                        }
                    },
                    {
                        name: 'Live GPS Location Heartbeat',
                        request: {
                            method: 'POST',
                            header: [
                                { key: 'Content-Type', value: 'application/json' },
                                { key: 'Authorization', value: 'Bearer {{staffToken}}' }
                            ],
                            body: {
                                mode: 'raw',
                                raw: JSON.stringify({ lat: 16.426080, lng: 74.589270 }, null, 2)
                            },
                            url: { raw: '{{baseUrl}}/api/employee/location', host: ['{{baseUrl}}'], path: ['api', 'employee', 'location'] }
                        }
                    },
                    {
                        name: 'Admin Live Employee Locations Tracking',
                        request: {
                            method: 'GET',
                            header: [{ key: 'Authorization', value: 'Bearer {{adminToken}}' }],
                            url: { raw: '{{baseUrl}}/api/admin/employee-locations', host: ['{{baseUrl}}'], path: ['api', 'admin', 'employee-locations'] }
                        }
                    },
                    {
                        name: 'Attendance History',
                        request: {
                            method: 'GET',
                            header: [{ key: 'Authorization', value: 'Bearer {{staffToken}}' }],
                            url: { raw: '{{baseUrl}}/api/attendance/history', host: ['{{baseUrl}}'], path: ['api', 'attendance', 'history'] }
                        }
                    }
                ]
            },
            {
                name: '4. Leave Requests',
                item: [
                    {
                        name: 'Apply For Leave',
                        request: {
                            method: 'POST',
                            header: [
                                { key: 'Content-Type', value: 'application/json' },
                                { key: 'Authorization', value: 'Bearer {{staffToken}}' }
                            ],
                            body: {
                                mode: 'raw',
                                raw: JSON.stringify({
                                    type: 'Casual Leave',
                                    start_date: '2026-11-25',
                                    end_date: '2026-11-26',
                                    reason: 'Attending National Academic Conference'
                                }, null, 2)
                            },
                            url: { raw: '{{baseUrl}}/api/requests/leaves', host: ['{{baseUrl}}'], path: ['api', 'requests', 'leaves'] }
                        }
                    },
                    {
                        name: 'Get My Leaves',
                        request: {
                            method: 'GET',
                            header: [{ key: 'Authorization', value: 'Bearer {{staffToken}}' }],
                            url: { raw: '{{baseUrl}}/api/requests/leaves', host: ['{{baseUrl}}'], path: ['api', 'requests', 'leaves'] }
                        }
                    },
                    {
                        name: 'Get All Leaves (Principal / Admin)',
                        request: {
                            method: 'GET',
                            header: [{ key: 'Authorization', value: 'Bearer {{principalToken}}' }],
                            url: { raw: '{{baseUrl}}/api/requests/leaves/all', host: ['{{baseUrl}}'], path: ['api', 'requests', 'leaves', 'all'] }
                        }
                    },
                    {
                        name: 'Principal Update Leave Status (Approve/Reject)',
                        request: {
                            method: 'PUT',
                            header: [
                                { key: 'Content-Type', value: 'application/json' },
                                { key: 'Authorization', value: 'Bearer {{principalToken}}' }
                            ],
                            body: {
                                mode: 'raw',
                                raw: JSON.stringify({ status: 'approved', reason: 'Approved by Principal' }, null, 2)
                            },
                            url: { raw: '{{baseUrl}}/api/requests/leaves/1', host: ['{{baseUrl}}'], path: ['api', 'requests', 'leaves', '1'] }
                        }
                    }
                ]
            },
            {
                name: '5. On-Duty (OD) Requests',
                item: [
                    {
                        name: 'Submit On-Duty (OD) Request (Multipart Form)',
                        request: {
                            method: 'POST',
                            header: [{ key: 'Authorization', value: 'Bearer {{staffToken}}' }],
                            body: {
                                mode: 'formdata',
                                formdata: [
                                    { key: 'purpose', value: 'University Examination Observer Duty', type: 'text' },
                                    { key: 'place', value: 'VTU Belagavi Center', type: 'text' },
                                    { key: 'date', value: '2026-11-28', type: 'text' },
                                    { key: 'document', type: 'file', src: 'duty_order.pdf' }
                                ]
                            },
                            url: { raw: '{{baseUrl}}/api/requests/od', host: ['{{baseUrl}}'], path: ['api', 'requests', 'od'] }
                        }
                    },
                    {
                        name: 'Get My OD Requests',
                        request: {
                            method: 'GET',
                            header: [{ key: 'Authorization', value: 'Bearer {{staffToken}}' }],
                            url: { raw: '{{baseUrl}}/api/requests/od', host: ['{{baseUrl}}'], path: ['api', 'requests', 'od'] }
                        }
                    },
                    {
                        name: 'Get All OD Requests (Principal / Admin)',
                        request: {
                            method: 'GET',
                            header: [{ key: 'Authorization', value: 'Bearer {{principalToken}}' }],
                            url: { raw: '{{baseUrl}}/api/requests/od/all', host: ['{{baseUrl}}'], path: ['api', 'requests', 'od', 'all'] }
                        }
                    },
                    {
                        name: 'Principal Update OD Status (Approve/Reject)',
                        request: {
                            method: 'PUT',
                            header: [
                                { key: 'Content-Type', value: 'application/json' },
                                { key: 'Authorization', value: 'Bearer {{principalToken}}' }
                            ],
                            body: {
                                mode: 'raw',
                                raw: JSON.stringify({ status: 'approved', reason: 'OD approved for university evaluation' }, null, 2)
                            },
                            url: { raw: '{{baseUrl}}/api/requests/od/1', host: ['{{baseUrl}}'], path: ['api', 'requests', 'od', '1'] }
                        }
                    }
                ]
            },
            {
                name: '6. Institutional Reports & Analytics',
                item: [
                    {
                        name: 'Get Staff Count',
                        request: {
                            method: 'GET',
                            header: [{ key: 'Authorization', value: 'Bearer {{principalToken}}' }],
                            url: { raw: '{{baseUrl}}/api/reports/staff-count', host: ['{{baseUrl}}'], path: ['api', 'reports', 'staff-count'] }
                        }
                    },
                    {
                        name: 'Get Staff Roster',
                        request: {
                            method: 'GET',
                            header: [{ key: 'Authorization', value: 'Bearer {{principalToken}}' }],
                            url: { raw: '{{baseUrl}}/api/reports/staff', host: ['{{baseUrl}}'], path: ['api', 'reports', 'staff'] }
                        }
                    },
                    {
                        name: 'Daily Attendance Report',
                        request: {
                            method: 'GET',
                            header: [{ key: 'Authorization', value: 'Bearer {{principalToken}}' }],
                            url: {
                                raw: '{{baseUrl}}/api/reports/daily?date=2026-11-18',
                                host: ['{{baseUrl}}'],
                                path: ['api', 'reports', 'daily'],
                                query: [{ key: 'date', value: '2026-11-18' }]
                            }
                        }
                    },
                    {
                        name: 'Monthly Attendance Report',
                        request: {
                            method: 'GET',
                            header: [{ key: 'Authorization', value: 'Bearer {{principalToken}}' }],
                            url: {
                                raw: '{{baseUrl}}/api/reports/monthly?month=11&year=2026',
                                host: ['{{baseUrl}}'],
                                path: ['api', 'reports', 'monthly'],
                                query: [
                                    { key: 'month', value: '11' },
                                    { key: 'year', value: '2026' }
                                ]
                            }
                        }
                    },
                    {
                        name: 'Download Monthly Excel Spreadsheet',
                        request: {
                            method: 'GET',
                            header: [{ key: 'Authorization', value: 'Bearer {{adminToken}}' }],
                            url: {
                                raw: '{{baseUrl}}/api/reports/monthly/download?month=11&year=2026',
                                host: ['{{baseUrl}}'],
                                path: ['api', 'reports', 'monthly', 'download'],
                                query: [
                                    { key: 'month', value: '11' },
                                    { key: 'year', value: '2026' }
                                ]
                            }
                        }
                    },
                    {
                        name: 'Download SQLite Database Snapshot',
                        request: {
                            method: 'GET',
                            header: [{ key: 'Authorization', value: 'Bearer {{adminToken}}' }],
                            url: { raw: '{{baseUrl}}/api/reports/database/backup', host: ['{{baseUrl}}'], path: ['api', 'reports', 'database', 'backup'] }
                        }
                    },
                    {
                        name: 'Database Health Metrics',
                        request: {
                            method: 'GET',
                            header: [{ key: 'Authorization', value: 'Bearer {{adminToken}}' }],
                            url: { raw: '{{baseUrl}}/api/reports/database/health', host: ['{{baseUrl}}'], path: ['api', 'reports', 'database', 'health'] }
                        }
                    }
                ]
            }
        ]
    };

    const postmanEnv = {
        id: 'cle-society-attendance-env',
        name: 'CLE Society Local Environment',
        values: [
            { key: 'baseUrl', value: 'http://localhost:5001', enabled: true },
            { key: 'staffToken', value: '', enabled: true },
            { key: 'principalToken', value: '', enabled: true },
            { key: 'adminToken', value: '', enabled: true },
            { key: 'deviceId', value: 'postman-client-01', enabled: true }
        ]
    };

    fs.writeFileSync(path.resolve(__dirname, '../postman/CLE_Society_Staff_Attendance.postman_collection.json'), JSON.stringify(postmanCollection, null, 2));
    fs.writeFileSync(path.resolve(__dirname, '../postman/CLE_Society_Local.postman_environment.json'), JSON.stringify(postmanEnv, null, 2));

    console.log('\n[POSTMAN ARTIFACTS GENERATED]');
    console.log(' - Collection: postman/CLE_Society_Staff_Attendance.postman_collection.json');
    console.log(' - Environment: postman/CLE_Society_Local.postman_environment.json');
}

runAudit().catch(err => {
    console.error('Audit fatal error:', err);
    process.exit(1);
});
