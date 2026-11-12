const assert = require('assert');
const path = require('path');
const crypto = require('crypto');

// Ensure test environment JWT secret
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_must_be_minimum_32_characters_long!';
process.env.DEMO_LOGIN_ENABLED = 'true';
process.env.DEMO_PRINCIPAL_PHONE = '8888888888';
process.env.DEMO_OTP = '123456';

const db = require(path.resolve(__dirname, 'database'));
const authController = require(path.resolve(__dirname, 'controllers/authController'));
const demoAuth = require(path.resolve(__dirname, 'utils/demoAuth'));

// Helper to simulate Express req/res
function createMockRes() {
    let statusCode = 200;
    let responseData = null;
    let cookiesSet = {};

    return {
        status: (code) => {
            statusCode = code;
            return {
                json: (data) => { responseData = data; }
            };
        },
        json: (data) => { responseData = data; },
        cookie: (name, val, opts) => { cookiesSet[name] = { val, opts }; },
        clearCookie: (name, opts) => { delete cookiesSet[name]; },
        getStatus: () => statusCode,
        getData: () => responseData,
        getCookies: () => cookiesSet
    };
}

async function runTestSuite() {
    console.log('='.repeat(70));
    console.log(' ADMIN REAL SMS OTP & PRINCIPAL DEMO AUTHENTICATION TEST SUITE');
    console.log('='.repeat(70));

    let passed = 0;
    let failed = 0;

    function report(name, condition, details = '') {
        if (condition) {
            console.log(`[PASS] ${name}`);
            passed++;
        } else {
            console.error(`[FAIL] ${name} ${details}`);
            failed++;
        }
    }

    const adminPhone = '6360670247';
    const principalPhone = '8888888888';
    const staffPhone = '1234567890';
    const demoAdminPhone = '9999999999';

    // Clean any prior lockouts and otps for test phones
    db.prepare("DELETE FROM auth_lockouts WHERE identifier LIKE '%6360670247%' OR identifier LIKE '%9999999999%' OR identifier LIKE '%8888888888%' OR identifier LIKE '%1234567890%'").run();
    db.prepare("DELETE FROM otps WHERE phone LIKE '%6360670247%' OR phone LIKE '%9999999999%' OR phone LIKE '%8888888888%' OR phone LIKE '%1234567890%'").run();

    // -------------------------------------------------------------
    // Test 1: Registered Admin with valid real OTP = Admin authenticated
    // -------------------------------------------------------------
    try {
        const realAdminOtp = '839201';
        const hashedOtp = crypto.createHash('sha256').update(realAdminOtp).digest('hex');
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at, attempts) VALUES (?, ?, ?, 0)').run('+91' + adminPhone, hashedOtp, expiresAt);
        db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at, attempts) VALUES (?, ?, ?, 0)').run(adminPhone, hashedOtp, expiresAt);

        const resVerify = createMockRes();
        await authController.verify({ body: { phone: adminPhone, otp: realAdminOtp, role: 'admin' } }, resVerify);
        assert.strictEqual(resVerify.getStatus(), 200, 'Admin verification with real OTP should return 200');
        assert.strictEqual(resVerify.getData().success, true);
        assert.strictEqual(resVerify.getData().user.role, 'admin');
        assert.strictEqual(resVerify.getData().user.phone, adminPhone);
        assert.ok(resVerify.getData().token, 'Should return JWT token');
        report('Scenario 1: Registered Admin number (6360670247) + valid real OTP authenticates as Admin', true);
    } catch (e) {
        report('Scenario 1: Registered Admin number (6360670247) + valid real OTP authenticates as Admin', false, e.message);
    }

    // -------------------------------------------------------------
    // Test 2: Unregistered mobile number = Rejected
    // -------------------------------------------------------------
    try {
        const resLogin = createMockRes();
        await authController.login({ body: { phone: '9123456780', role: 'admin' } }, resLogin);
        assert.strictEqual(resLogin.getStatus(), 403, 'Unregistered phone must receive 403');
        assert.ok(resLogin.getData().error.includes('not found') || resLogin.getData().error.includes('register first'));

        const resVerify = createMockRes();
        await authController.verify({ body: { phone: '9123456780', otp: '123456', role: 'admin' } }, resVerify);
        assert.strictEqual(resVerify.getStatus(), 403, 'Unregistered phone verify must receive 403');
        report('Scenario 2: Unregistered mobile number is rejected with 403 Forbidden', true);
    } catch (e) {
        report('Scenario 2: Unregistered mobile number is rejected with 403 Forbidden', false, e.message);
    }

    // -------------------------------------------------------------
    // Test 3: Admin number + incorrect OTP = Rejected
    // -------------------------------------------------------------
    try {
        const validOtp = '654321';
        const hashedOtp = crypto.createHash('sha256').update(validOtp).digest('hex');
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at, attempts) VALUES (?, ?, ?, 0)').run('+91' + adminPhone, hashedOtp, expiresAt);
        db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at, attempts) VALUES (?, ?, ?, 0)').run(adminPhone, hashedOtp, expiresAt);

        const resVerify = createMockRes();
        await authController.verify({ body: { phone: adminPhone, otp: '000000', role: 'admin' } }, resVerify);
        assert.strictEqual(resVerify.getStatus(), 400, 'Admin with wrong OTP must receive 400');
        assert.ok(resVerify.getData().error.includes('Invalid OTP'));
        report('Scenario 3: Admin number + incorrect OTP is rejected with 400 Bad Request', true);
    } catch (e) {
        report('Scenario 3: Admin number + incorrect OTP is rejected with 400 Bad Request', false, e.message);
    }

    // -------------------------------------------------------------
    // Test 4: Admin number + expired OTP = Rejected
    // -------------------------------------------------------------
    try {
        const expiredOtp = '112233';
        const hashedOtp = crypto.createHash('sha256').update(expiredOtp).digest('hex');
        const pastExpiresAt = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutes ago
        db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at, attempts) VALUES (?, ?, ?, 0)').run('+91' + adminPhone, hashedOtp, pastExpiresAt);
        db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at, attempts) VALUES (?, ?, ?, 0)').run(adminPhone, hashedOtp, pastExpiresAt);

        const resVerify = createMockRes();
        await authController.verify({ body: { phone: adminPhone, otp: expiredOtp, role: 'admin' } }, resVerify);
        assert.strictEqual(resVerify.getStatus(), 400, 'Expired OTP must receive 400');
        assert.ok(resVerify.getData().error.toLowerCase().includes('expired'));
        report('Scenario 4: Admin number + expired OTP is rejected', true);
    } catch (e) {
        report('Scenario 4: Admin number + expired OTP is rejected', false, e.message);
    }

    // -------------------------------------------------------------
    // Test 5: Former demo Admin number (9999999999) = Rejected
    // -------------------------------------------------------------
    try {
        const resLogin = createMockRes();
        await authController.login({ body: { phone: demoAdminPhone, role: 'admin' } }, resLogin);
        assert.strictEqual(resLogin.getStatus(), 403, 'Old demo admin number 9999999999 must be rejected as not found');

        const resVerify = createMockRes();
        await authController.verify({ body: { phone: demoAdminPhone, otp: '123456', role: 'admin' } }, resVerify);
        assert.strictEqual(resVerify.getStatus(), 403, 'Old demo admin number verify must be rejected');
        report('Scenario 5: Old demo Admin number (9999999999) is completely rejected', true);
    } catch (e) {
        report('Scenario 5: Old demo Admin number (9999999999) is completely rejected', false, e.message);
    }

    // -------------------------------------------------------------
    // Test 6: Admin cannot log in using demo OTP (123456)
    // -------------------------------------------------------------
    try {
        // Set real OTP to something else
        const realOtp = '948201';
        const hashedOtp = crypto.createHash('sha256').update(realOtp).digest('hex');
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at, attempts) VALUES (?, ?, ?, 0)').run('+91' + adminPhone, hashedOtp, expiresAt);
        db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at, attempts) VALUES (?, ?, ?, 0)').run(adminPhone, hashedOtp, expiresAt);

        // Attempt verify with demo OTP 123456
        const resVerify = createMockRes();
        await authController.verify({ body: { phone: adminPhone, otp: '123456', role: 'admin' } }, resVerify);
        assert.strictEqual(resVerify.getStatus(), 400, 'Admin attempting to use demo OTP 123456 must be rejected');
        assert.ok(resVerify.getData().error.includes('Invalid OTP'));
        report('Scenario 6: Admin cannot log in using static/demo OTP (123456 is rejected)', true);
    } catch (e) {
        report('Scenario 6: Admin cannot log in using static/demo OTP (123456 is rejected)', false, e.message);
    }

    // -------------------------------------------------------------
    // Test 7: Staff account attempting to access Admin privileges = Rejected
    // -------------------------------------------------------------
    try {
        // Staff user 1234567890 attempts to log in as Admin
        const resLogin = createMockRes();
        await authController.login({ body: { phone: staffPhone, role: 'admin' } }, resLogin);
        assert.strictEqual(resLogin.getStatus(), 403, 'Staff user attempting Admin role must receive 403');
        assert.ok(resLogin.getData().error.includes('User is not registered as Admin'));

        const resVerify = createMockRes();
        await authController.verify({ body: { phone: staffPhone, otp: '123456', role: 'admin' } }, resVerify);
        assert.strictEqual(resVerify.getStatus(), 403, 'Staff user attempting Admin verify must receive 403');
        report('Scenario 7: Staff account attempting Admin privileges is rejected with 403 Forbidden', true);
    } catch (e) {
        report('Scenario 7: Staff account attempting Admin privileges is rejected with 403 Forbidden', false, e.message);
    }

    // -------------------------------------------------------------
    // Test 8: Principal demo testing functionality is PRESERVED
    // -------------------------------------------------------------
    try {
        const resLogin = createMockRes();
        await authController.login({ body: { phone: principalPhone, role: 'hoi' } }, resLogin);
        assert.strictEqual(resLogin.getStatus(), 200, 'Principal demo login should succeed');

        const resVerify = createMockRes();
        await authController.verify({ body: { phone: principalPhone, otp: '123456', role: 'hoi' } }, resVerify);
        assert.strictEqual(resVerify.getStatus(), 200, 'Principal demo verify should succeed');
        assert.strictEqual(resVerify.getData().user.role, 'hoi');
        report('Scenario 8: Principal demo testing (8888888888 + 123456) is completely preserved', true);
    } catch (e) {
        report('Scenario 8: Principal demo testing (8888888888 + 123456) is completely preserved', false, e.message);
    }

    // -------------------------------------------------------------
    // Test 9: Principal with wrong OTP = Rejected
    // -------------------------------------------------------------
    try {
        const resLogin = createMockRes();
        await authController.login({ body: { phone: principalPhone, role: 'hoi' } }, resLogin);

        const resVerify = createMockRes();
        await authController.verify({ body: { phone: principalPhone, otp: '000000', role: 'hoi' } }, resVerify);
        assert.strictEqual(resVerify.getStatus(), 400, 'Principal with incorrect OTP must receive 400');
        assert.ok(resVerify.getData().error.includes('Invalid OTP'));
        report('Scenario 9: Principal with incorrect OTP is rejected with 400 Bad Request', true);
    } catch (e) {
        report('Scenario 9: Principal with incorrect OTP is rejected with 400 Bad Request', false, e.message);
    }

    // -------------------------------------------------------------
    // Test 10: Staff real SMS OTP functionality is PRESERVED
    // -------------------------------------------------------------
    try {
        const staffRealOtp = '556677';
        const hashedOtp = crypto.createHash('sha256').update(staffRealOtp).digest('hex');
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at, attempts) VALUES (?, ?, ?, 0)').run('+91' + staffPhone, hashedOtp, expiresAt);
        db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at, attempts) VALUES (?, ?, ?, 0)').run(staffPhone, hashedOtp, expiresAt);

        // Demo OTP for staff must fail
        const resDemoVerify = createMockRes();
        await authController.verify({ body: { phone: staffPhone, otp: '123456', role: 'staff' } }, resDemoVerify);
        assert.strictEqual(resDemoVerify.getStatus(), 400, 'Staff using demo OTP must be rejected');

        // Real OTP for staff must succeed
        const resRealVerify = createMockRes();
        await authController.verify({ body: { phone: staffPhone, otp: staffRealOtp, role: 'staff' } }, resRealVerify);
        assert.strictEqual(resRealVerify.getStatus(), 200, 'Staff using real OTP must succeed');
        assert.strictEqual(resRealVerify.getData().user.role, 'staff');
        report('Scenario 10: Staff real SMS OTP authentication is completely preserved', true);
    } catch (e) {
        report('Scenario 10: Staff real SMS OTP authentication is completely preserved', false, e.message);
    }

    // -------------------------------------------------------------
    // Test 11: Persistent session and role preservation for Admin
    // -------------------------------------------------------------
    try {
        const adminRealOtp = '349182';
        const hashedOtp = crypto.createHash('sha256').update(adminRealOtp).digest('hex');
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at, attempts) VALUES (?, ?, ?, 0)').run('+91' + adminPhone, hashedOtp, expiresAt);
        db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at, attempts) VALUES (?, ?, ?, 0)').run(adminPhone, hashedOtp, expiresAt);

        const resVerify = createMockRes();
        await authController.verify({ body: { phone: adminPhone, otp: adminRealOtp, role: 'admin' } }, resVerify);
        const user = resVerify.getData().user;

        // Verify session verification endpoint
        const resRestore = createMockRes();
        authController.verifyToken({ user: { id: user.id, role: 'admin' } }, resRestore);
        assert.strictEqual(resRestore.getStatus(), 200, 'verifyToken must return 200');
        assert.strictEqual(resRestore.getData().user.id, user.id);
        assert.strictEqual(resRestore.getData().user.role, 'admin');
        report('Scenario 11: Admin session token restores full Admin profile across page refresh', true);
    } catch (e) {
        report('Scenario 11: Admin session token restores full Admin profile across page refresh', false, e.message);
    }

    console.log('='.repeat(70));
    console.log(` SUMMARY: ${passed} / ${passed + failed} SCENARIOS PASSED`);
    console.log('='.repeat(70));

    if (failed > 0) {
        process.exit(1);
    }
}

runTestSuite();
