const assert = require('assert');
const path = require('path');
const crypto = require('crypto');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_must_be_minimum_32_characters_long!';
process.env.DEMO_LOGIN_ENABLED = 'true';
process.env.DEMO_PRINCIPAL_PHONE = '8888888888';
process.env.DEMO_OTP = '123456';

const db = require(path.resolve(__dirname, 'database'));
const authController = require(path.resolve(__dirname, 'controllers/authController'));
const demoAuth = require(path.resolve(__dirname, 'utils/demoAuth'));

function createMockRes() {
    let statusCode = 200;
    let responseData = null;
    let cookiesSet = {};

    return {
        status: (code) => {
            statusCode = code;
            return { json: (data) => { responseData = data; } };
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
    console.log(' DEMO LOGIN & REAL OTP AUTHENTICATION TEST SUITE');
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

    const adminPhone = '9187477277';
    const principalPhone = '8888888888';
    const staffPhone = '1234567890';
    const oldDemoAdminPhone = '9999999999';

    // Provision or ensure constant Admin exists for testing
    let testAdmin = db.prepare("SELECT id FROM users WHERE phone LIKE ?").get(`%${adminPhone}%`);
    if (!testAdmin) {
        const insertRes = db.prepare(`
            INSERT INTO users (name, phone, role, department, employee_id, status)
            VALUES ('System Administrator', ?, 'admin', 'Administration', ?, 'active')
        `).run(adminPhone, `EMP-${adminPhone}`);
        testAdmin = { id: insertRes.lastInsertRowid };
    } else {
        db.prepare("UPDATE users SET role = 'admin', status = 'active' WHERE id = ?").run(testAdmin.id);
    }
    const testAdminId = testAdmin.id;

    db.prepare("DELETE FROM auth_lockouts WHERE identifier LIKE ? OR identifier LIKE '%9999999999%' OR identifier LIKE '%8888888888%' OR identifier LIKE '%1234567890%'").run(`%${adminPhone}%`);
    db.prepare("DELETE FROM otps WHERE phone LIKE ? OR phone LIKE '%9999999999%' OR phone LIKE '%8888888888%' OR phone LIKE '%1234567890%'").run(`%${adminPhone}%`);

    // 1. Admin demo numbers are rejected; only real registered admin exists
    try {
        const resLogin = createMockRes();
        await authController.login({ body: { phone: oldDemoAdminPhone, role: 'admin' } }, resLogin);
        assert.strictEqual(resLogin.getStatus(), 403, 'Old demo admin 9999999999 must be rejected as not found');
        report('Scenario 1: Old demo Admin number (9999999999) is strictly rejected', true);
    } catch (e) {
        report('Scenario 1: Old demo Admin number (9999999999) is strictly rejected', false, e.message);
    }

    // 2. Admin cannot use demo OTP 123456
    try {
        const resVerify = createMockRes();
        await authController.verify({ body: { phone: adminPhone, otp: '123456', role: 'admin' } }, resVerify);
        assert.strictEqual(resVerify.getStatus(), 400, 'Admin using static demo OTP 123456 must be rejected');
        report('Scenario 2: Admin role strictly rejects static demo OTP', true);
    } catch (e) {
        report('Scenario 2: Admin role strictly rejects static demo OTP', false, e.message);
    }

    // 3. Admin with valid real OTP succeeds
    try {
        const adminRealOtp = '771234';
        const hashedOtp = crypto.createHash('sha256').update(adminRealOtp).digest('hex');
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at, attempts) VALUES (?, ?, ?, 0)').run('+91' + adminPhone, hashedOtp, expiresAt);
        db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at, attempts) VALUES (?, ?, ?, 0)').run(adminPhone, hashedOtp, expiresAt);

        const resVerify = createMockRes();
        await authController.verify({ body: { phone: adminPhone, otp: adminRealOtp, role: 'admin' } }, resVerify);
        assert.strictEqual(resVerify.getStatus(), 200, 'Admin verify with real OTP should return 200');
        assert.strictEqual(resVerify.getData().user.role, 'admin');
        report('Scenario 3: Registered Admin with real SMS OTP authenticates as Admin', true);
    } catch (e) {
        report('Scenario 3: Registered Admin with real SMS OTP authenticates as Admin', false, e.message);
    }

    // 4. Principal demo login succeeds
    try {
        const resLogin = createMockRes();
        await authController.login({ body: { phone: principalPhone, role: 'hoi' } }, resLogin);
        assert.strictEqual(resLogin.getStatus(), 200);

        const resVerify = createMockRes();
        await authController.verify({ body: { phone: principalPhone, otp: '123456', role: 'hoi' } }, resVerify);
        assert.strictEqual(resVerify.getStatus(), 200);
        assert.strictEqual(resVerify.getData().user.role, 'hoi');
        report('Scenario 4: Principal demo number (8888888888) + demo OTP (123456) authenticates as Principal', true);
    } catch (e) {
        report('Scenario 4: Principal demo number (8888888888) + demo OTP (123456) authenticates as Principal', false, e.message);
    }

    // 5. Staff with demo OTP is rejected
    try {
        const resVerify = createMockRes();
        await authController.verify({ body: { phone: staffPhone, otp: '123456', role: 'staff' } }, resVerify);
        assert.strictEqual(resVerify.getStatus(), 400);
        report('Scenario 5: Staff role with demo OTP is strictly rejected', true);
    } catch (e) {
        report('Scenario 5: Staff role with demo OTP is strictly rejected', false, e.message);
    }

    // 6. Staff with real OTP succeeds
    try {
        const staffRealOtp = '981245';
        const hashedOtp = crypto.createHash('sha256').update(staffRealOtp).digest('hex');
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at, attempts) VALUES (?, ?, ?, 0)').run('+91' + staffPhone, hashedOtp, expiresAt);
        db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at, attempts) VALUES (?, ?, ?, 0)').run(staffPhone, hashedOtp, expiresAt);

        const resVerify = createMockRes();
        await authController.verify({ body: { phone: staffPhone, otp: staffRealOtp, role: 'staff' } }, resVerify);
        assert.strictEqual(resVerify.getStatus(), 200);
        assert.strictEqual(resVerify.getData().user.role, 'staff');
        report('Scenario 6: Staff member with real SMS OTP authenticates as Staff', true);
    } catch (e) {
        report('Scenario 6: Staff member with real SMS OTP authenticates as Staff', false, e.message);
    }

    // 7. Principal with wrong OTP is rejected
    try {
        const resLogin = createMockRes();
        await authController.login({ body: { phone: principalPhone, role: 'hoi' } }, resLogin);

        const resVerify = createMockRes();
        await authController.verify({ body: { phone: principalPhone, otp: '999999', role: 'hoi' } }, resVerify);
        assert.strictEqual(resVerify.getStatus(), 400);
        report('Scenario 7: Principal demo with wrong OTP is rejected', true);
    } catch (e) {
        report('Scenario 7: Principal demo with wrong OTP is rejected', false, e.message);
    }

    // 8. Staff role cannot claim Admin role
    try {
        const resLogin = createMockRes();
        await authController.login({ body: { phone: staffPhone, role: 'admin' } }, resLogin);
        assert.strictEqual(resLogin.getStatus(), 403);
        report('Scenario 8: Staff user claiming Admin role is rejected with 403 Forbidden', true);
    } catch (e) {
        report('Scenario 8: Staff user claiming Admin role is rejected with 403 Forbidden', false, e.message);
    }

    // 9. When demo login is disabled, Principal demo fails
    try {
        process.env.DEMO_LOGIN_ENABLED = 'false';
        assert.strictEqual(demoAuth.isDemoLoginEnabled(), false);
        assert.strictEqual(demoAuth.isDemoLogin('8888888888', 'hoi'), false);
        db.prepare("DELETE FROM otps WHERE phone LIKE '%8888888888%'").run();
        db.prepare("DELETE FROM attendance_otps WHERE employee_id = 'EMP001'").run();

        const resVerify = createMockRes();
        await authController.verify({ body: { phone: principalPhone, otp: '123456', role: 'hoi' } }, resVerify);
        assert.notStrictEqual(resVerify.getStatus(), 200);

        process.env.DEMO_LOGIN_ENABLED = 'true';
        report('Scenario 9: When DEMO_LOGIN_ENABLED=false, all demo authentication is disabled', true);
    } catch (e) {
        process.env.DEMO_LOGIN_ENABLED = 'true';
        report('Scenario 9: When DEMO_LOGIN_ENABLED=false, all demo authentication is disabled', false, e.message);
    }

    // 10. Persistent session preserves Admin role
    try {
        const resRestore = createMockRes();
        authController.verifyToken({ user: { id: testAdminId, role: 'admin' } }, resRestore);
        assert.strictEqual(resRestore.getStatus(), 200);
        assert.strictEqual(resRestore.getData().user.id, testAdminId);
        assert.strictEqual(resRestore.getData().user.role, 'admin');

        // Verify purged user 102 no longer exists
        const resPurged = createMockRes();
        authController.verifyToken({ user: { id: 102, role: 'admin' } }, resPurged);
        assert.strictEqual(resPurged.getStatus(), 401, 'Purged user 102 must return 401');

        report('Scenario 10: Persistent session restores full Admin profile across page refresh', true);
    } catch (e) {
        report('Scenario 10: Persistent session restores full Admin profile across page refresh', false, e.message);
    } finally {
        db.prepare("UPDATE users SET role = 'admin', status = 'active' WHERE phone LIKE ?").run(`%${adminPhone}%`);
        db.prepare("DELETE FROM otps WHERE phone LIKE ?").run(`%${adminPhone}%`);
        db.prepare("DELETE FROM auth_lockouts WHERE identifier LIKE ?").run(`%${adminPhone}%`);
    }

    console.log('='.repeat(65));
    console.log(` SUMMARY: ${passed} / ${passed + failed} SCENARIOS PASSED`);
    console.log('='.repeat(65));

    if (failed > 0) process.exit(1);
}

runTestSuite();
