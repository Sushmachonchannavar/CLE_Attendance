/**
 * Automated Verification Suite: Auto Staff Activation & Direct Login
 * Verifies:
 * 1. Staff registration automatically creates account with status 'active'.
 * 2. Newly registered staff can immediately request OTP (proceeds to SMS dispatch, not blocked by approval).
 * 3. Staff can verify OTP and receive JWT authentication token.
 * 4. Migration 014 updates any legacy 'pending' or 'rejected' accounts to 'active'.
 * 5. Unregistered numbers are strictly rejected with 403.
 * 6. Admin role is strictly restricted to constant phone 9448378417.
 * 7. Non-admin attempting Admin role receives 403.
 * 8. Principal demo login (8888888888 / 123456) works.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Use isolated test database
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'a_very_secure_and_strong_jwt_secret_key_for_testing_purposes_123456';
process.env.ADMIN_PHONE_NUMBER = '9448378417';
process.env.DEMO_LOGIN_ENABLED = 'true';
process.env.DEMO_PRINCIPAL_PHONE = '8888888888';
process.env.DEMO_OTP = '123456';

const db = require('./database');
const authController = require('./controllers/authController');

function mockReqRes(body = {}, params = {}, query = {}, user = null) {
    const req = { body, params, query, user };
    let statusCode = 200;
    let jsonResponse = null;
    let cookiesSet = {};

    const res = {
        status(code) {
            statusCode = code;
            return res;
        },
        json(data) {
            jsonResponse = data;
            return res;
        },
        send(data) {
            jsonResponse = data;
            return res;
        },
        cookie(name, val, opts) {
            cookiesSet[name] = { val, opts };
        },
        clearCookie(name) {
            delete cookiesSet[name];
        },
        getStatusCode() {
            return statusCode;
        },
        getResponse() {
            return jsonResponse;
        }
    };

    return { req, res };
}

async function runTests() {
    console.log('\n======================================================');
    console.log('STARTING AUTOMATED VERIFICATION: AUTO STAFF ACTIVATION');
    console.log('======================================================\n');

    let passed = 0;
    let failed = 0;

    function test(name, fn) {
        try {
            fn();
            console.log(`[PASS] ${name}`);
            passed++;
        } catch (err) {
            console.error(`[FAIL] ${name}`);
            console.error(err);
            failed++;
        }
    }

    async function testAsync(name, fn) {
        try {
            await fn();
            console.log(`[PASS] ${name}`);
            passed++;
        } catch (err) {
            console.error(`[FAIL] ${name}`);
            console.error(err);
            failed++;
        }
    }

    // 1. Staff Registration Auto-Activation
    const testStaffPhone = '9876543210';
    await testAsync('1. Staff Registration creates user with status active immediately', async () => {
        // Clean any existing user with testStaffPhone
        db.prepare('DELETE FROM users WHERE phone = ?').run(testStaffPhone);

        const { req, res } = mockReqRes({
            firstName: 'Ramesh',
            lastName: 'Patil',
            mobile: testStaffPhone,
            collegeName: 'CLE Society Degree College',
            departmentName: 'Computer Science',
            designation: 'Assistant Professor'
        });

        await authController.register(req, res);
        assert.strictEqual(res.getStatusCode(), 201, `Expected 201 Created, got ${res.getStatusCode()}`);
        assert.strictEqual(res.getResponse().success, true);
        assert.ok(res.getResponse().message.includes('completed successfully'));

        const userInDb = db.prepare('SELECT * FROM users WHERE phone = ?').get(testStaffPhone);
        assert.ok(userInDb, 'User must exist in database');
        assert.strictEqual(userInDb.status, 'active', `Status must be active, got ${userInDb.status}`);
        assert.strictEqual(userInDb.role, 'staff');
    });

    // 2. Newly registered staff can immediately request OTP (login)
    await testAsync('2. Newly registered staff can request OTP without pending/approval block', async () => {
        const { req, res } = mockReqRes({
            phone: testStaffPhone,
            role: 'staff'
        });

        await authController.login(req, res);
        // Note: In test mode without live SMS gateway credentials, sendVerification returns 503 SMS gateway unavailable.
        // What's critical is it did NOT return 403 Forbidden ("Your account is pending Principal approval").
        assert.notStrictEqual(res.getStatusCode(), 403, 'Must NOT be blocked by 403 pending approval');
        assert.ok(
            res.getStatusCode() === 200 || res.getStatusCode() === 503,
            `Expected 200 (SMS sent) or 503 (SMS gateway unconfigured in unit test), got ${res.getStatusCode()}`
        );
    });

    // 3. Newly registered staff can verify OTP and get token
    await testAsync('3. Staff can verify OTP and receive JWT token', async () => {
        const testOtp = '765432';
        const hashedOtp = crypto.createHash('sha256').update(testOtp).digest('hex');
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

        db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at, attempts) VALUES (?, ?, ?, 0)').run('+91' + testStaffPhone, hashedOtp, expiresAt);
        db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at, attempts) VALUES (?, ?, ?, 0)').run(testStaffPhone, hashedOtp, expiresAt);

        const { req, res } = mockReqRes({
            phone: testStaffPhone,
            otp: testOtp,
            role: 'staff'
        });

        await authController.verify(req, res);
        assert.strictEqual(res.getStatusCode(), 200, `Expected 200 OK, got ${res.getStatusCode()}`);
        const response = res.getResponse();
        assert.ok(response.token, 'Must return JWT token');
        assert.strictEqual(response.user.phone, testStaffPhone);
        assert.strictEqual(response.user.status, 'active');
    });

    // 4. Unregistered phone number is rejected
    await testAsync('4. Unregistered phone number is rejected with 403', async () => {
        const { req, res } = mockReqRes({
            phone: '9111111111',
            role: 'staff'
        });

        await authController.login(req, res);
        assert.strictEqual(res.getStatusCode(), 403, `Expected 403 Forbidden, got ${res.getStatusCode()}`);
        assert.ok(res.getResponse().error.includes('register first'));
    });

    // 5. Admin role restriction: Only constant 9448378417 is allowed
    await testAsync('5. Unauthorized phone number attempting Admin role is blocked with 403', async () => {
        const { req, res } = mockReqRes({
            phone: testStaffPhone,
            role: 'admin'
        });

        await authController.login(req, res);
        assert.strictEqual(res.getStatusCode(), 403, `Expected 403 Forbidden, got ${res.getStatusCode()}`);
        assert.ok(res.getResponse().error.includes('User is not registered as Admin') || res.getResponse().error.includes('not authorized'));
    });

    // 6. Authorized Admin login works past approval/role checks
    await testAsync('6. Authorized Admin (9448378417) passes role check to OTP dispatch', async () => {
        const adminPhone = '9448378417';
        // Ensure admin user exists in DB
        let adminUser = db.prepare('SELECT * FROM users WHERE phone = ?').get(adminPhone);
        if (!adminUser) {
            db.prepare(`
                INSERT INTO users (phone, name, college, department, designation, role, employee_id, status)
                VALUES (?, 'System Administrator', 'CLE Society', 'Administration', 'Admin', 'admin', 'ADM-001', 'active')
            `).run(adminPhone);
        }

        const { req, res } = mockReqRes({
            phone: adminPhone,
            role: 'admin'
        });

        await authController.login(req, res);
        // Did not fail with 403
        assert.notStrictEqual(res.getStatusCode(), 403, 'Admin must not receive 403');
        assert.ok(
            res.getStatusCode() === 200 || res.getStatusCode() === 503,
            `Expected 200 or 503, got ${res.getStatusCode()}`
        );
    });

    // 7. Principal demo login (8888888888 / 123456) works
    await testAsync('7. Principal demo login (8888888888) works directly', async () => {
        const principalPhone = '8888888888';
        const { req: loginReq, res: loginRes } = mockReqRes({
            phone: principalPhone,
            role: 'hoi'
        });

        await authController.login(loginReq, loginRes);
        assert.strictEqual(loginRes.getStatusCode(), 200);

        const { req: verifyReq, res: verifyRes } = mockReqRes({
            phone: principalPhone,
            otp: '123456',
            role: 'hoi'
        });

        await authController.verify(verifyReq, verifyRes);
        assert.strictEqual(verifyRes.getStatusCode(), 200);
        assert.ok(verifyRes.getResponse().token);
        assert.strictEqual(verifyRes.getResponse().user.role.toLowerCase(), 'hoi');
    });

    // 8. Migration 014 Auto-activation test
    test('8. Migration 014 converts pending and rejected staff accounts to active', () => {
        // Insert dummy pending and rejected users
        db.prepare('DELETE FROM users WHERE phone IN (\'9123456780\', \'9123456781\')').run();

        db.prepare(`
            INSERT INTO users (phone, name, college, department, designation, role, employee_id, status)
            VALUES ('9123456780', 'Pending Staff', 'CLE', 'Physics', 'Lecturer', 'staff', 'EMP-PEND-1', 'pending')
        `).run();

        db.prepare(`
            INSERT INTO users (phone, name, college, department, designation, role, employee_id, status)
            VALUES ('9123456781', 'Rejected Staff', 'CLE', 'Chemistry', 'Lecturer', 'staff', 'EMP-REJ-1', 'rejected')
        `).run();

        // Run migration 014
        const migration014 = require('./migrations/014_auto_activate_staff');
        migration014.up(db);

        const pendingUser = db.prepare("SELECT status FROM users WHERE phone = '9123456780'").get();
        const rejectedUser = db.prepare("SELECT status FROM users WHERE phone = '9123456781'").get();

        assert.strictEqual(pendingUser.status, 'active', 'Pending staff must be updated to active');
        assert.strictEqual(rejectedUser.status, 'active', 'Rejected staff must be updated to active');
    });

    console.log('\n======================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');

    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
