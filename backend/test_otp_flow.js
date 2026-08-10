const axios = require('axios');
const db = require('./database');
const crypto = require('crypto');

// Require server to boot up on its configured port
require('./server');

const PORT = process.env.PORT || 5001;

async function runTests() {
    console.log("--- Starting Secure OTP & Attendance Integration Tests ---");

    // Clean up existing test data
    db.prepare("DELETE FROM attendance WHERE user_id IN (SELECT id FROM users WHERE employee_id IN (?, ?))").run('EMP_TEST_1', 'EMP_TEST_2');
    db.prepare("DELETE FROM users WHERE employee_id IN (?, ?)").run('EMP_TEST_1', 'EMP_TEST_2');
    db.prepare("DELETE FROM attendance_otps WHERE employee_id IN (?, ?)").run('EMP_TEST_1', 'EMP_TEST_2');

    // 1. Setup Active Test User
    db.prepare(`
        INSERT INTO users (name, phone, role, department, employee_id, status)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run('Test Employee 1', '917410800888', 'staff', 'Engineering', 'EMP_TEST_1', 'active');
    
    // Setup Inactive Test User
    db.prepare(`
        INSERT INTO users (name, phone, role, department, employee_id, status)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run('Test Employee 2', '919876543210', 'staff', 'HR', 'EMP_TEST_2', 'inactive');

    console.log("Setup completed: EMP_TEST_1 (active), EMP_TEST_2 (inactive)");

    // Give server 1 second to bind to port
    await new Promise(resolve => setTimeout(resolve, 1000));

    const client = axios.create({
        baseURL: `http://localhost:${PORT}`,
        validateStatus: () => true // Allow handling non-200 statuses
    });

    try {
        console.log(`Test client pointing to http://localhost:${PORT}`);

        // TEST 1: Request OTP for non-existent employee
        console.log("\nTEST 1: Send OTP for non-existent employee ID");
        let res = await client.post('/api/attendance/send-otp', { employeeId: 'EMP_NON_EXISTENT' });
        
        console.log(`Status: ${res.status}`);
        console.log(`Response: ${JSON.stringify(res.data)}`);
        if (res.status === 404 && res.data.error.includes("not found")) {
            console.log("✅ TEST 1 PASSED");
        } else {
            console.log("❌ TEST 1 FAILED");
        }

        // TEST 2: Request OTP for inactive employee
        console.log("\nTEST 2: Send OTP for inactive employee ID");
        res = await client.post('/api/attendance/send-otp', { employeeId: 'EMP_TEST_2' });
        
        console.log(`Status: ${res.status}`);
        console.log(`Response: ${JSON.stringify(res.data)}`);
        if (res.status === 404 && res.data.error.includes("inactive")) {
            console.log("✅ TEST 2 PASSED");
        } else {
            console.log("❌ TEST 2 FAILED");
        }

        // TEST 3: Request OTP for active employee
        console.log("\nTEST 3: Send OTP for active employee ID");
        res = await client.post('/api/attendance/send-otp', { employeeId: 'EMP_TEST_1' });
        
        console.log(`Status: ${res.status}`);
        console.log(`Response: ${JSON.stringify(res.data)}`);
        if (res.status === 200 && res.data.success) {
            console.log("✅ TEST 3 PASSED");
        } else {
            console.log("❌ TEST 3 FAILED");
        }

        // Verify OTP is hashed in database and NOT returned in API response
        console.log("\nTEST 4: Check OTP security properties");
        if (res.data.otp === undefined) {
            console.log("✅ Security: Raw OTP was NOT returned in response.");
        } else {
            console.log("❌ Security: Raw OTP was leaked in API response!");
        }

        const latestOtp = db.prepare("SELECT * FROM attendance_otps WHERE employee_id = ?").get('EMP_TEST_1');
        console.log(`DB Row: ${JSON.stringify(latestOtp)}`);
        if (latestOtp && latestOtp.otp.length === 64) {
            console.log("✅ Security: OTP is stored in database as a 64-char SHA-256 hash.");
        } else {
            console.log("❌ Security: OTP is NOT stored as SHA-256 hash!");
        }

        // TEST 5: Rate Limiting (Count requests)
        console.log("\nTEST 5: Verify Rate Limiting (max 3 requests in 10 mins)");
        // Request 2 (success)
        let resRate2 = await client.post('/api/attendance/send-otp', { employeeId: 'EMP_TEST_1' });
        console.log(`Request 2: Status ${resRate2.status}`);
        // Request 3 (success)
        let resRate3 = await client.post('/api/attendance/send-otp', { employeeId: 'EMP_TEST_1' });
        console.log(`Request 3: Status ${resRate3.status}`);
        // Request 4 (should be rate-limited, status 429)
        let resRate4 = await client.post('/api/attendance/send-otp', { employeeId: 'EMP_TEST_1' });
        console.log(`Request 4: Status ${resRate4.status}`);
        console.log(`Response: ${JSON.stringify(resRate4.data)}`);

        if (resRate4.status === 429 && resRate4.data.error.includes("Too many OTP requests")) {
            console.log("✅ TEST 5 PASSED (Rate limited at 4th request)");
        } else {
            console.log("❌ TEST 5 FAILED");
        }

        // Let's clear rate limits for the next test by deleting test OTP entries
        db.prepare("DELETE FROM attendance_otps WHERE employee_id = ?").run('EMP_TEST_1');
        
        // Re-generate OTP for verification test
        console.log("\nGenerating fresh OTP for verification tests...");
        await client.post('/api/attendance/send-otp', { employeeId: 'EMP_TEST_1' });
        
        // Let's bypass SMS delivery mock to grab OTP directly from DB for verification tests
        const testOtpRaw = '112233';
        const testOtpHash = crypto.createHash('sha256').update(testOtpRaw).digest('hex');
        db.prepare("UPDATE attendance_otps SET otp = ? WHERE employee_id = ? AND is_used = 0").run(testOtpHash, 'EMP_TEST_1');
        console.log(`Overrode test OTP hash in database to match raw code: ${testOtpRaw}`);

        // TEST 6: Verify incorrect OTP
        console.log("\nTEST 6: Verify with incorrect OTP");
        res = await client.post('/api/attendance/verify-otp', { employeeId: 'EMP_TEST_1', otp: '999999' });
        
        console.log(`Status: ${res.status}`);
        console.log(`Response: ${JSON.stringify(res.data)}`);
        if (res.status === 400 && res.data.error.includes("Invalid")) {
            console.log("✅ TEST 6 PASSED");
        } else {
            console.log("❌ TEST 6 FAILED");
        }

        // TEST 7: Verify correct OTP (Session creation, no location)
        console.log("\nTEST 7: Verify with correct OTP (Session creation)");
        res = await client.post('/api/attendance/verify-otp', { employeeId: 'EMP_TEST_1', otp: testOtpRaw });
        
        console.log(`Status: ${res.status}`);
        console.log(`Response: ${JSON.stringify(res.data)}`);
        if (res.status === 200 && res.data.otpVerified && res.data.token) {
            console.log("✅ TEST 7 PASSED");
        } else {
            console.log("❌ TEST 7 FAILED");
        }

        // TEST 8: Verify used OTP
        console.log("\nTEST 8: Verify OTP that has already been marked as used");
        res = await client.post('/api/attendance/verify-otp', { employeeId: 'EMP_TEST_1', otp: testOtpRaw });
        
        console.log(`Status: ${res.status}`);
        console.log(`Response: ${JSON.stringify(res.data)}`);
        if (res.status === 400 && res.data.error.includes("used")) {
            console.log("✅ TEST 8 PASSED");
        } else {
            console.log("❌ TEST 8 FAILED");
        }

        // TEST 9: Verify OTP with coordinates outside geofence
        console.log("\nTEST 9: Verify OTP with coordinates OUTSIDE geofence");
        // Generate another fresh OTP
        await client.post('/api/attendance/send-otp', { employeeId: 'EMP_TEST_1' });
        db.prepare("UPDATE attendance_otps SET otp = ? WHERE employee_id = ? AND is_used = 0").run(testOtpHash, 'EMP_TEST_1');

        res = await client.post('/api/attendance/verify-otp', { employeeId: 'EMP_TEST_1', otp: testOtpRaw, lat: 10.0, lng: 10.0 });
        
        console.log(`Status: ${res.status}`);
        console.log(`Response: ${JSON.stringify(res.data)}`);
        if (res.status === 400 && res.data.error.includes("outside the campus")) {
            console.log("✅ TEST 9 PASSED");
        } else {
            console.log("❌ TEST 9 FAILED");
        }

        // TEST 10: Verify OTP with coordinates INSIDE geofence (Successful Punch In)
        console.log("\nTEST 10: Verify OTP with coordinates INSIDE geofence");
        // Clean up attendance record for today if exists
        const testUser = db.prepare("SELECT id FROM users WHERE employee_id = ?").get('EMP_TEST_1');
        const today = new Date().toISOString().split('T')[0];
        db.prepare("DELETE FROM attendance WHERE user_id = ? AND date = ?").run(testUser.id, today);

        // Generate another fresh OTP
        await client.post('/api/attendance/send-otp', { employeeId: 'EMP_TEST_1' });
        db.prepare("UPDATE attendance_otps SET otp = ? WHERE employee_id = ? AND is_used = 0").run(testOtpHash, 'EMP_TEST_1');

        res = await client.post('/api/attendance/verify-otp', { employeeId: 'EMP_TEST_1', otp: testOtpRaw, lat: 16.42578, lng: 74.58970 });
        
        console.log(`Status: ${res.status}`);
        console.log(`Response: ${JSON.stringify(res.data)}`);
        if (res.status === 200 && res.data.success && res.data.punchRecord) {
            console.log("✅ TEST 10 PASSED");
        } else {
            console.log("❌ TEST 10 FAILED");
        }

    } catch (err) {
        console.error("Test process encountered error:", err);
    } finally {
        // Cleanup database
        const testUser = db.prepare("SELECT id FROM users WHERE employee_id = ?").get('EMP_TEST_1');
        if (testUser) {
            db.prepare("DELETE FROM attendance WHERE user_id = ?").run(testUser.id);
        }
        db.prepare("DELETE FROM users WHERE employee_id IN (?, ?)").run('EMP_TEST_1', 'EMP_TEST_2');
        db.prepare("DELETE FROM attendance_otps WHERE employee_id IN (?, ?)").run('EMP_TEST_1', 'EMP_TEST_2');
        console.log("\nDatabase cleanup complete.");
        process.exit(0);
    }
}

runTests();
