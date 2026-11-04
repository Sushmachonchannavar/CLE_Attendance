const assert = require('assert');
const path = require('path');
const crypto = require('crypto');

// Ensure test environment JWT secret
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_must_be_minimum_32_characters_long!';
process.env.DEMO_LOGIN_ENABLED = 'true';
process.env.DEMO_ADMIN_PHONE = '9999999999';
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
    console.log('='.repeat(65));
    console.log(' DEMO LOGIN & REAL STAFF OTP SECURITY TEST SUITE');
    console.log('='.repeat(65));

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

    // Clean any prior lockouts for test phones
    db.prepare("DELETE FROM auth_lockouts WHERE identifier LIKE '%9999999999%' OR identifier LIKE '%8888888888%' OR identifier LIKE '%1234567890%'").run();
    db.prepare("DELETE FROM otps WHERE phone LIKE '%9999999999%' OR phone LIKE '%8888888888%' OR phone LIKE '%1234567890%'").run();

    // -------------------------------------------------------------
    // Test 1: Admin demo number + valid demo OTP = Admin authenticated
    // -------------------------------------------------------------
    try {
        const resLogin = createMockRes();
        await authController.login({ body: { phone: '9999999999', role: 'admin' } }, resLogin);
        assert.strictEqual(resLogin.getStatus(), 200, 'Admin demo send-otp should succeed');
        assert.strictEqual(resLogin.getData().success, true);

        const resVerify = createMockRes();
        await authController.verify({ body: { phone: '9999999999', otp: '123456', role: 'admin' } }, resVerify);
        assert.strictEqual(resVerify.getStatus(), 200, 'Admin demo verify should succeed');
        assert.strictEqual(resVerify.getData().success, true);
        assert.strictEqual(resVerify.getData().user.role, 'admin');
        assert.ok(resVerify.getData().token, 'Should return JWT token');
        report('Scenario 1: Admin demo number + valid demo OTP authenticates as Admin', true);
    } catch (e) {
        report('Scenario 1: Admin demo number + valid demo OTP authenticates as Admin', false, e.message);
    }

    // -------------------------------------------------------------
    // Test 2: Principal demo number + valid demo OTP = Principal authenticated
    // -------------------------------------------------------------
    try {
        const resLogin = createMockRes();
        await authController.login({ body: { phone: '8888888888', role: 'hoi' } }, resLogin);
        assert.strictEqual(resLogin.getStatus(), 200, 'Principal demo send-otp should succeed');

        const resVerify = createMockRes();
        await authController.verify({ body: { phone: '8888888888', otp: '123456', role: 'hoi' } }, resVerify);
        assert.strictEqual(resVerify.getStatus(), 200, 'Principal demo verify should succeed');
        assert.strictEqual(resVerify.getData().success, true);
        assert.strictEqual(resVerify.getData().user.role, 'hoi');
        assert.ok(resVerify.getData().token, 'Should return JWT token');
        report('Scenario 2: Principal demo number + valid demo OTP authenticates as Principal/HOI', true);
    } catch (e) {
        report('Scenario 2: Principal demo number + valid demo OTP authenticates as Principal/HOI', false, e.message);
    }

    // -------------------------------------------------------------
    // Test 3: Staff number + demo OTP = Login rejected
    // -------------------------------------------------------------
    try {
        // Staff user 1234567890
        const resVerify = createMockRes();
        await authController.verify({ body: { phone: '1234567890', otp: '123456', role: 'staff' } }, resVerify);
        assert.notStrictEqual(resVerify.getStatus(), 200, 'Staff using demo OTP must NOT receive 200 OK');
        assert.ok(resVerify.getStatus() === 400 || resVerify.getStatus() === 403, 'Should return 400 or 403');
        report('Scenario 3: Staff number + demo OTP is rejected', true);
    } catch (e) {
        report('Scenario 3: Staff number + demo OTP is rejected', false, e.message);
    }

    // -------------------------------------------------------------
    // Test 4: Staff number + real SMS OTP = Staff dashboard
    // -------------------------------------------------------------
    try {
        // Simulate a real OTP dispatched to a registered staff member (phone 1234567890)
        const realOtp = '765432';
        const hashedRealOtp = crypto.createHash('sha256').update(realOtp).digest('hex');
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at, attempts) VALUES (?, ?, ?, 0)').run('+911234567890', hashedRealOtp, expiresAt);
        db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at, attempts) VALUES (?, ?, ?, 0)').run('1234567890', hashedRealOtp, expiresAt);

        const resVerify = createMockRes();
        await authController.verify({ body: { phone: '1234567890', otp: realOtp, role: 'staff' } }, resVerify);
        assert.strictEqual(resVerify.getStatus(), 200, 'Staff with real OTP should succeed');
        assert.strictEqual(resVerify.getData().success, true);
        assert.strictEqual(resVerify.getData().user.role, 'staff');
        report('Scenario 4: Staff number + real SMS OTP authenticates as Staff', true);
    } catch (e) {
        report('Scenario 4: Staff number + real SMS OTP authenticates as Staff', false, e.message);
    }

    // -------------------------------------------------------------
    // Test 5: Admin demo number + incorrect OTP = Login rejected
    // -------------------------------------------------------------
    try {
        // First initialize demo OTP
        const resLogin = createMockRes();
        await authController.login({ body: { phone: '9999999999', role: 'admin' } }, resLogin);

        const resVerify = createMockRes();
        await authController.verify({ body: { phone: '9999999999', otp: '000000', role: 'admin' } }, resVerify);
        assert.strictEqual(resVerify.getStatus(), 400, 'Admin with wrong OTP must be rejected with 400');
        assert.ok(resVerify.getData().error.includes('Invalid OTP'));
        report('Scenario 5: Admin demo number + incorrect OTP is rejected', true);
    } catch (e) {
        report('Scenario 5: Admin demo number + incorrect OTP is rejected', false, e.message);
    }

    // -------------------------------------------------------------
    // Test 6: Principal demo number + incorrect OTP = Login rejected
    // -------------------------------------------------------------
    try {
        const resLogin = createMockRes();
        await authController.login({ body: { phone: '8888888888', role: 'hoi' } }, resLogin);

        const resVerify = createMockRes();
        await authController.verify({ body: { phone: '8888888888', otp: '999999', role: 'hoi' } }, resVerify);
        assert.strictEqual(resVerify.getStatus(), 400, 'Principal with wrong OTP must be rejected with 400');
        assert.ok(resVerify.getData().error.includes('Invalid OTP'));
        report('Scenario 6: Principal demo number + incorrect OTP is rejected', true);
    } catch (e) {
        report('Scenario 6: Principal demo number + incorrect OTP is rejected', false, e.message);
    }

    // -------------------------------------------------------------
    // Test 7: Staff must NEVER receive demo authentication privileges
    // -------------------------------------------------------------
    try {
        // Verify demoAuth.isDemoLogin strictly returns false for role 'staff'
        assert.strictEqual(demoAuth.isDemoLogin('9999999999', 'staff'), false);
        assert.strictEqual(demoAuth.isDemoLogin('8888888888', 'staff'), false);
        assert.strictEqual(demoAuth.isDemoLogin('1234567890', 'staff'), false);

        // Verify trying to log in as Staff using the admin demo phone is rejected
        const resLogin = createMockRes();
        await authController.login({ body: { phone: '9999999999', role: 'staff' } }, resLogin);
        assert.strictEqual(resLogin.getStatus(), 403, 'Must reject role mismatch (admin account cannot log in under staff)');
        report('Scenario 7: Staff role never receives demo authentication privileges', true);
    } catch (e) {
        report('Scenario 7: Staff role never receives demo authentication privileges', false, e.message);
    }

    // -------------------------------------------------------------
    // Test 8: Demo login disabled = Demo login rejected
    // -------------------------------------------------------------
    try {
        process.env.DEMO_LOGIN_ENABLED = 'false';
        assert.strictEqual(demoAuth.isDemoLoginEnabled(), false);
        assert.strictEqual(demoAuth.isDemoLogin('9999999999', 'admin'), false);
        assert.strictEqual(demoAuth.isDemoLogin('8888888888', 'hoi'), false);

        // Clean any residual test OTPs
        db.prepare("DELETE FROM otps WHERE phone LIKE '%9999999999%'").run();
        db.prepare("DELETE FROM attendance_otps WHERE employee_id = 'EMP000'").run();

        const resVerify = createMockRes();
        await authController.verify({ body: { phone: '9999999999', otp: '123456', role: 'admin' } }, resVerify);
        assert.notStrictEqual(resVerify.getStatus(), 200, 'When DEMO_LOGIN_ENABLED=false, demo OTP must be rejected');

        // Restore for remaining tests
        process.env.DEMO_LOGIN_ENABLED = 'true';
        report('Scenario 8: When DEMO_LOGIN_ENABLED=false, demo authentication is strictly disabled', true);
    } catch (e) {
        process.env.DEMO_LOGIN_ENABLED = 'true';
        report('Scenario 8: When DEMO_LOGIN_ENABLED=false, demo authentication is strictly disabled', false, e.message);
    }

    // -------------------------------------------------------------
    // Test 9: Unauthorized role switching is rejected
    // -------------------------------------------------------------
    try {
        // Staff account 1234567890 attempts to log in as Admin
        const resLogin = createMockRes();
        await authController.login({ body: { phone: '1234567890', role: 'admin' } }, resLogin);
        assert.strictEqual(resLogin.getStatus(), 403, 'Staff user trying to claim Admin role must receive 403 Forbidden');

        // Principal account 8888888888 attempts to log in as Admin
        const resLogin2 = createMockRes();
        await authController.login({ body: { phone: '8888888888', role: 'admin' } }, resLogin2);
        assert.strictEqual(resLogin2.getStatus(), 403, 'Principal user trying to claim Admin role must receive 403 Forbidden');
        report('Scenario 9: Unauthorized role switching is strictly rejected with 403 Forbidden', true);
    } catch (e) {
        report('Scenario 9: Unauthorized role switching is strictly rejected with 403 Forbidden', false, e.message);
    }

    // -------------------------------------------------------------
    // Test 10: Refreshing page preserves authenticated session
    // -------------------------------------------------------------
    try {
        // Log in demo Admin to obtain token
        const resLogin = createMockRes();
        await authController.login({ body: { phone: '9999999999', role: 'admin' } }, resLogin);
        const resVerify = createMockRes();
        await authController.verify({ body: { phone: '9999999999', otp: '123456', role: 'admin' } }, resVerify);
        const token = resVerify.getData().token;

        // Verify session restoration endpoint (/api/auth/verify-token)
        const resRestore = createMockRes();
        const reqRestore = {
            user: { id: 1, role: 'admin' } // simulates decoded JWT from authMiddleware
        };
        authController.verifyToken(reqRestore, resRestore);
        assert.strictEqual(resRestore.getStatus(), 200, 'Session restore must return 200 OK');
        assert.strictEqual(resRestore.getData().user.id, 1);
        assert.strictEqual(resRestore.getData().user.role, 'admin');
        report('Scenario 10: Session restoration validates user and preserves role across page refresh', true);
    } catch (e) {
        report('Scenario 10: Session restoration validates user and preserves role across page refresh', false, e.message);
    }

    console.log('='.repeat(65));
    console.log(` SUMMARY: ${passed} / ${passed + failed} SCENARIOS PASSED`);
    console.log('='.repeat(65));

    if (failed > 0) {
        process.exit(1);
    }
}

runTestSuite();
