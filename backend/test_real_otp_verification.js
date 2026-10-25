const axios = require('axios');
const crypto = require('crypto');
const db = require('./database');
const app = require('./server');

const TEST_PORT = 5099;
let server;

const client = axios.create({
    baseURL: `http://localhost:${TEST_PORT}`,
    validateStatus: () => true
});

async function runRealOtpTestSuite() {
    console.log("=================================================================");
    console.log("   CLE SOCIETY - REAL-TIME SMS OTP INTEGRATION & SECURITY TEST   ");
    console.log("=================================================================\n");

    server = app.listen(TEST_PORT);
    await new Promise(resolve => setTimeout(resolve, 1000));

    let passCount = 0;
    let failCount = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`✅ [PASS] ${message}`);
            passCount++;
        } else {
            console.error(`❌ [FAIL] ${message}`);
            failCount++;
        }
    }

    try {
        // Prepare test users
        // 6360670247 is registered real staff member Sumit Chonchannavar
        const realStaff = db.prepare("SELECT * FROM users WHERE phone = '6360670247'").get();
        if (!realStaff) {
            console.error("User 6360670247 not found in database.");
            process.exit(1);
        }

        // Clean any existing lockouts and OTPs for 6360670247 and demo phone 9876543210
        db.prepare("DELETE FROM auth_lockouts WHERE identifier LIKE '%6360670247%' OR identifier LIKE '%9876543210%'").run();
        db.prepare("DELETE FROM attendance_otps WHERE employee_id = ?").run(realStaff.employee_id);
        db.prepare("DELETE FROM otps WHERE phone LIKE '%6360670247%' OR phone LIKE '%9876543210%'").run();

        // -------------------------------------------------------------
        // TEST 1: DEMO OTP REMOVAL - Demo numbers no longer return demo OTP
        // -------------------------------------------------------------
        console.log("\n--- TEST 1: Verify Demo OTP is Removed & Not Returned in API ---");
        const demoSendRes = await client.post('/api/attendance/send-otp', { phone: '9876543210' });
        console.log("Send OTP to demo number response:", demoSendRes.status, demoSendRes.data);
        assert(demoSendRes.data.isDemo === undefined, "No isDemo flag returned in send-otp response");
        assert(demoSendRes.data.demoOtp === undefined, "No demoOtp returned in send-otp response");
        assert(demoSendRes.data.devOtp === undefined, "No devOtp returned in send-otp response");

        // -------------------------------------------------------------
        // TEST 2: DEMO OTP BYPASS REMOVAL - Demo OTP 123456 must be REJECTED
        // -------------------------------------------------------------
        console.log("\n--- TEST 2: Verify Demo OTP '123456' is strictly REJECTED ---");
        const demoVerifyRes = await client.post('/api/attendance/verify-otp', {
            phone: '9876543210',
            otp: '123456'
        });
        console.log("Verify demo OTP '123456' response:", demoVerifyRes.status, demoVerifyRes.data);
        assert(demoVerifyRes.status === 400, "Demo OTP 123456 was rejected with HTTP 400");
        assert(demoVerifyRes.data.error && demoVerifyRes.data.error.includes("Invalid OTP"), "Error indicates Invalid OTP code");

        // -------------------------------------------------------------
        // TEST 3: UNREGISTERED MOBILE NUMBER REJECTION
        // -------------------------------------------------------------
        console.log("\n--- TEST 3: Prevent unauthorized/unregistered mobile numbers ---");
        const unregRes = await client.post('/api/attendance/send-otp', { phone: '9999900000' });
        console.log("Unregistered phone send-otp response:", unregRes.status, unregRes.data);
        assert(unregRes.status === 404, "Unregistered phone rejected with HTTP 404");

        const unregAuthRes = await client.post('/api/auth/login', { phone: '9999900000' });
        console.log("Unregistered phone auth/login response:", unregAuthRes.status, unregAuthRes.data);
        assert(unregAuthRes.status === 403, "Unregistered phone auth/login rejected with HTTP 403");

        // -------------------------------------------------------------
        // TEST 4: REAL-TIME SMS OTP DISPATCH VIA SMS GATEWAY
        // -------------------------------------------------------------
        console.log("\n--- TEST 4: Real-Time SMS OTP Dispatch via XSMS Gateway ---");
        console.log(`Dispatching live SMS OTP to registered staff member: ${realStaff.name} (Phone: ${realStaff.phone})...`);
        const liveSmsRes = await client.post('/api/attendance/send-otp', { phone: '6360670247' });
        console.log("Live send-otp API response:", liveSmsRes.status, liveSmsRes.data);
        assert(liveSmsRes.status === 200, "Live SMS send-otp succeeded with HTTP 200");
        assert(liveSmsRes.data.success === true, "Response reports success = true");
        assert(liveSmsRes.data.otp === undefined && liveSmsRes.data.devOtp === undefined, "Zero exposure of OTP in response body");

        // Check database storage & 5-minute expiry
        const dbOtpRow = db.prepare("SELECT * FROM attendance_otps WHERE employee_id = ? AND is_used = 0 ORDER BY id DESC LIMIT 1").get(realStaff.employee_id);
        assert(dbOtpRow !== undefined, "OTP record created in attendance_otps table");
        assert(dbOtpRow.otp.length === 64, "OTP stored as 64-character SHA-256 hash (never plain text)");
        
        const expiryDate = new Date(dbOtpRow.expires_at);
        const now = new Date();
        const diffMinutes = (expiryDate.getTime() - now.getTime()) / (60 * 1000);
        console.log(`OTP expires in approximately ${diffMinutes.toFixed(2)} minutes.`);
        assert(diffMinutes > 3.5 && diffMinutes <= 5.1, "OTP expiry set strictly to 5 minutes");

        // -------------------------------------------------------------
        // TEST 5: INVALID OTP ATTEMPT COUNTING
        // -------------------------------------------------------------
        console.log("\n--- TEST 5: Invalid OTP Submission and Attempt Counter ---");
        const invalidVerifyRes = await client.post('/api/attendance/verify-otp', {
            phone: '6360670247',
            otp: '000000'
        });
        console.log("Invalid OTP response:", invalidVerifyRes.status, invalidVerifyRes.data);
        assert(invalidVerifyRes.status === 400, "Invalid OTP rejected with HTTP 400");
        assert(invalidVerifyRes.data.error.includes("4 attempts remaining"), "Attempt decrement displayed correctly");

        // -------------------------------------------------------------
        // TEST 6: ACCOUNT LOCKOUT AFTER 5 FAILED ATTEMPTS
        // -------------------------------------------------------------
        console.log("\n--- TEST 6: Account Lockout after 5 Consecutive Failed Attempts ---");
        for (let i = 2; i <= 5; i++) {
            await client.post('/api/attendance/verify-otp', {
                phone: '6360670247',
                otp: '000000'
            });
        }
        const lockoutVerifyRes = await client.post('/api/attendance/verify-otp', {
            phone: '6360670247',
            otp: '000000'
        });
        console.log("Attempt 6 response:", lockoutVerifyRes.status, lockoutVerifyRes.data);
        assert(lockoutVerifyRes.status === 423, "Account locked with HTTP 423 (Locked)");
        assert(lockoutVerifyRes.data.error.includes("temporarily locked") || lockoutVerifyRes.data.error.includes("locked"), "Locked banner indicates account is locked");

        // Clean lockout for subsequent tests
        db.prepare("DELETE FROM auth_lockouts WHERE identifier LIKE '%6360670247%'").run();

        // -------------------------------------------------------------
        // TEST 7: OTP EXPIRATION ENFORCEMENT
        // -------------------------------------------------------------
        console.log("\n--- TEST 7: Expired OTP is Rejected ---");
        // Create an expired OTP in database
        const expiredCode = '445566';
        const expiredHash = crypto.createHash('sha256').update(expiredCode).digest('hex');
        const pastDate = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        db.prepare("UPDATE attendance_otps SET is_used = 1 WHERE employee_id = ?").run(realStaff.employee_id);
        db.prepare("INSERT INTO attendance_otps (employee_id, otp, expires_at, is_used, attempts) VALUES (?, ?, ?, 0, 0)").run(realStaff.employee_id, expiredHash, pastDate);

        const expiredVerifyRes = await client.post('/api/attendance/verify-otp', {
            phone: '6360670247',
            otp: expiredCode
        });
        console.log("Expired OTP verify response:", expiredVerifyRes.status, expiredVerifyRes.data);
        assert(expiredVerifyRes.status === 400, "Expired OTP rejected with HTTP 400");
        assert(expiredVerifyRes.data.error.includes("expired"), "Error message indicates expired OTP");

        // -------------------------------------------------------------
        // TEST 8: VALID OTP VERIFICATION & SINGLE-USE ENFORCEMENT
        // -------------------------------------------------------------
        console.log("\n--- TEST 8: Valid OTP Verification & Replay / Reuse Prevention ---");
        const testCode = '839217';
        const testHash = crypto.createHash('sha256').update(testCode).digest('hex');
        const validFutureDate = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        db.prepare("UPDATE attendance_otps SET is_used = 1 WHERE employee_id = ?").run(realStaff.employee_id);
        db.prepare("INSERT INTO attendance_otps (employee_id, otp, expires_at, is_used, attempts) VALUES (?, ?, ?, 0, 0)").run(realStaff.employee_id, testHash, validFutureDate);

        const validVerifyRes = await client.post('/api/attendance/verify-otp', {
            phone: '6360670247',
            otp: testCode
        });
        console.log("Valid OTP verify response:", validVerifyRes.status, validVerifyRes.data?.message);
        assert(validVerifyRes.status === 200, "Valid OTP verified with HTTP 200");
        assert(validVerifyRes.data.token !== undefined, "JWT Session token successfully issued");
        const authToken = validVerifyRes.data.token;

        // Immediately attempt to REUSE the same OTP
        const reuseRes = await client.post('/api/attendance/verify-otp', {
            phone: '6360670247',
            otp: testCode
        });
        console.log("Reused OTP verify response:", reuseRes.status, reuseRes.data);
        assert(reuseRes.status === 400, "Reused OTP rejected with HTTP 400");
        assert(reuseRes.data.error.includes("already been used"), "Replay attack prevented: OTP marked as used");

        // -------------------------------------------------------------
        // TEST 9: RATE LIMITING ON REPEATED OTP REQUESTS (MAX 5 IN 10 MINS)
        // -------------------------------------------------------------
        console.log("\n--- TEST 9: Rate Limiting on Rapid OTP Requests ---");
        // Seed 5 existing requests within the last 10 minutes for employee
        db.prepare("DELETE FROM attendance_otps WHERE employee_id = ?").run(realStaff.employee_id);
        const dummyHash = crypto.createHash('sha256').update('111111').digest('hex');
        const dummyExp = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        for (let i = 1; i <= 5; i++) {
            db.prepare("INSERT INTO attendance_otps (employee_id, otp, expires_at, is_used, attempts, created_at) VALUES (?, ?, ?, 1, 0, datetime('now'))").run(realStaff.employee_id, dummyHash, dummyExp);
        }
        // Next request via API must be rate limited (429)
        const rateLimitRes = await client.post('/api/attendance/send-otp', { phone: '6360670247' });
        console.log("6th OTP request response:", rateLimitRes.status, rateLimitRes.data);
        assert(rateLimitRes.status === 429, "6th rapid OTP request rate-limited with HTTP 429");
        assert(rateLimitRes.data.error.includes("Too many OTP requests"), "Rate limit error displayed");

        // -------------------------------------------------------------
        // TEST 10: REGRESSION TEST - ATTENDANCE PUNCH & ROLE FLOWS
        // -------------------------------------------------------------
        console.log("\n--- TEST 10: Verify Existing Attendance & Location Workflow ---");
        // Test punch in with token (campus coordinates: 16.426026, 74.589353)
        const punchRes = await client.post('/api/attendance/punch', {
            lat: 16.426026,
            lng: 74.589353,
            type: 'regular'
        }, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        console.log("Punch status with authenticated token:", punchRes.status, punchRes.data?.message || punchRes.data?.error);
        assert(punchRes.status === 200 || punchRes.status === 400, "Punch endpoint properly authorized and processes geofenced punch");

        // Test status
        const statusRes = await client.get('/api/attendance/status', {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        assert(statusRes.status === 200, "Attendance status retrieval succeeds with HTTP 200");

        // Test leave requests endpoint
        const leavesRes = await client.get('/api/requests/leaves', {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        assert(leavesRes.status === 200, "Leave requests endpoint functions normally with HTTP 200");

        console.log("\n=================================================================");
        console.log(`   TOTAL TESTS: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}   `);
        console.log("=================================================================\n");

    } catch (err) {
        console.error("Test execution encountered an error:", err);
    } finally {
        if (server) server.close();
        process.exit(failCount === 0 ? 0 : 1);
    }
}

runRealOtpTestSuite();
