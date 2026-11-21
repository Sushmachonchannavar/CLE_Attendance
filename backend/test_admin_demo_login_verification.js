const assert = require('assert');
const path = require('path');
const crypto = require('crypto');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_must_be_minimum_32_characters_long!';
process.env.DEMO_LOGIN_ENABLED = 'true';
process.env.DEMO_ADMIN_PHONE = '9999999999';
process.env.DEMO_PRINCIPAL_PHONE = '8888888888';
process.env.DEMO_OTP = '123456';
process.env.ADMIN_PHONE = '9448378417';

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

async function runAllTests() {
    console.log('='.repeat(75));
    console.log('CLE SOCIETY - ADMIN DEMO & REAL AUTHENTICATION VERIFICATION SUITE');
    console.log('='.repeat(75));

    let passedCount = 0;
    let failedCount = 0;
    const testResults = [];

    function recordResult(testNum, testTitle, passed, details = '') {
        testResults.push({ testNum, testTitle, passed, details });
        if (passed) {
            console.log(`[PASS] Case ${testNum}: ${testTitle}`);
            passedCount++;
        } else {
            console.error(`[FAIL] Case ${testNum}: ${testTitle} -> ${details}`);
            failedCount++;
        }
    }

    const demoAdminPhone = '9999999999';
    const realAdminPhone = '9448378417';

    // Ensure clean state before running test suite
    db.prepare("DELETE FROM auth_lockouts WHERE identifier LIKE ? OR identifier LIKE ?").run(`%${demoAdminPhone}%`, `%${realAdminPhone}%`);
    db.prepare("DELETE FROM otps WHERE phone LIKE ? OR phone LIKE ?").run(`%${demoAdminPhone}%`, `%${realAdminPhone}%`);

    // -----------------------------------------------------------------------------------
    // Case 1: Demo Admin number (9999999999) + '123456' -> Login successful (200 OK)
    // -----------------------------------------------------------------------------------
    try {
        const resLogin = createMockRes();
        await authController.login({ body: { phone: demoAdminPhone, role: 'admin' } }, resLogin);
        assert.strictEqual(resLogin.getStatus(), 200, 'Demo admin login request should return 200');
        assert.strictEqual(resLogin.getData().success, true, 'Demo admin login should succeed');

        const resVerify = createMockRes();
        await authController.verify({ body: { phone: demoAdminPhone, otp: '123456', role: 'admin' } }, resVerify);
        assert.strictEqual(resVerify.getStatus(), 200, 'Demo admin verify should return 200');
        assert.strictEqual(resVerify.getData().success, true);
        assert.strictEqual(resVerify.getData().user.role, 'admin');
        assert.strictEqual(resVerify.getData().user.phone, demoAdminPhone);
        assert.ok(resVerify.getData().token, 'Should return valid JWT access token');
        recordResult(1, 'Demo Admin number (9999999999) + 123456 -> Login successful', true);
    } catch (e) {
        recordResult(1, 'Demo Admin number (9999999999) + 123456 -> Login successful', false, e.message);
    }

    // -----------------------------------------------------------------------------------
    // Case 2: Demo Admin number (9999999999) + incorrect OTP -> Login rejected (400 Bad Request)
    // -----------------------------------------------------------------------------------
    try {
        // First re-initiate demo OTP
        const resLogin = createMockRes();
        await authController.login({ body: { phone: demoAdminPhone, role: 'admin' } }, resLogin);
        assert.strictEqual(resLogin.getStatus(), 200);

        // Attempt verify with incorrect OTP '999999'
        const resVerify = createMockRes();
        await authController.verify({ body: { phone: demoAdminPhone, otp: '999999', role: 'admin' } }, resVerify);
        assert.strictEqual(resVerify.getStatus(), 400, 'Demo admin with invalid OTP should receive 400');
        assert.ok(resVerify.getData().error.includes('Invalid OTP'), 'Error message should indicate invalid OTP');
        recordResult(2, 'Demo Admin number (9999999999) + incorrect OTP -> Login rejected', true);
    } catch (e) {
        recordResult(2, 'Demo Admin number (9999999999) + incorrect OTP -> Login rejected', false, e.message);
    }

    // -----------------------------------------------------------------------------------
    // Case 3: Real Admin number (9448378417) + actual SMS OTP -> Login successful
    // -----------------------------------------------------------------------------------
    try {
        // Reset any lockouts for real admin
        db.prepare("DELETE FROM auth_lockouts WHERE identifier LIKE ?").run(`%${realAdminPhone}%`);
        
        // Simulate genuine carrier-dispatched SMS OTP in database
        const actualSmsOtp = '748291';
        const hashedSmsOtp = crypto.createHash('sha256').update(actualSmsOtp).digest('hex');
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at, attempts) VALUES (?, ?, ?, 0)').run('+91' + realAdminPhone, hashedSmsOtp, expiresAt);
        db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at, attempts) VALUES (?, ?, ?, 0)').run(realAdminPhone, hashedSmsOtp, expiresAt);

        const resVerify = createMockRes();
        await authController.verify({ body: { phone: realAdminPhone, otp: actualSmsOtp, role: 'admin' } }, resVerify);
        assert.strictEqual(resVerify.getStatus(), 200, 'Real admin with genuine SMS OTP must return 200');
        assert.strictEqual(resVerify.getData().success, true);
        assert.strictEqual(resVerify.getData().user.role, 'admin');
        assert.strictEqual(resVerify.getData().user.phone, realAdminPhone);
        assert.ok(resVerify.getData().token, 'Should return valid JWT access token');
        recordResult(3, 'Real Admin number (9448378417) + actual SMS OTP -> Login successful', true);
    } catch (e) {
        recordResult(3, 'Real Admin number (9448378417) + actual SMS OTP -> Login successful', false, e.message);
    }

    // -----------------------------------------------------------------------------------
    // Case 4: Real Admin number (9448378417) + '123456' -> Login rejected unless it matches real OTP
    // -----------------------------------------------------------------------------------
    try {
        // Genuine SMS OTP is '583920', NOT '123456'
        const genuineOtp = '583920';
        const hashedGenuineOtp = crypto.createHash('sha256').update(genuineOtp).digest('hex');
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at, attempts) VALUES (?, ?, ?, 0)').run('+91' + realAdminPhone, hashedGenuineOtp, expiresAt);
        db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at, attempts) VALUES (?, ?, ?, 0)').run(realAdminPhone, hashedGenuineOtp, expiresAt);

        // Attempt verify with demo OTP '123456'
        const resVerify = createMockRes();
        await authController.verify({ body: { phone: realAdminPhone, otp: '123456', role: 'admin' } }, resVerify);
        assert.strictEqual(resVerify.getStatus(), 400, 'Real admin attempting demo OTP 123456 must be rejected with 400');
        assert.ok(resVerify.getData().error.includes('Invalid OTP'), 'Error message must specify Invalid OTP');
        recordResult(4, 'Real Admin number (9448378417) + 123456 -> Login rejected', true);
    } catch (e) {
        recordResult(4, 'Real Admin number (9448378417) + 123456 -> Login rejected', false, e.message);
    }

    // -----------------------------------------------------------------------------------
    // Case 5: Demo number (9999999999) used for Staff login -> Rejected
    // -----------------------------------------------------------------------------------
    try {
        const resLogin = createMockRes();
        await authController.login({ body: { phone: demoAdminPhone, role: 'staff' } }, resLogin);
        assert.strictEqual(resLogin.getStatus(), 403, 'Demo admin attempting Staff login must be rejected with 403');
        assert.ok(resLogin.getData().error.includes('not registered as Staff'), 'Error should state user is not registered as Staff');

        const resVerify = createMockRes();
        await authController.verify({ body: { phone: demoAdminPhone, otp: '123456', role: 'staff' } }, resVerify);
        assert.strictEqual(resVerify.getStatus(), 403, 'Demo admin attempting Staff verify must be rejected with 403');
        assert.ok(resVerify.getData().error.includes('not registered as Staff'));

        // Also verify isDemoLogin directly rejects staff role
        const isDemoStaff = demoAuth.isDemoLogin(demoAdminPhone, 'staff');
        assert.strictEqual(isDemoStaff, false, 'isDemoLogin must strictly return false for role staff');

        recordResult(5, 'Demo number (9999999999) used for Staff login -> Rejected', true);
    } catch (e) {
        recordResult(5, 'Demo number (9999999999) used for Staff login -> Rejected', false, e.message);
    }

    // -----------------------------------------------------------------------------------
    // Case 6: Demo number (9999999999) used for Principal login -> Rejected
    // -----------------------------------------------------------------------------------
    try {
        const resLogin = createMockRes();
        await authController.login({ body: { phone: demoAdminPhone, role: 'hoi' } }, resLogin);
        assert.strictEqual(resLogin.getStatus(), 403, 'Demo admin attempting Principal login must be rejected with 403');
        assert.ok(resLogin.getData().error.includes('not registered as Principal'), 'Error should state user is not registered as Principal');

        const resVerify = createMockRes();
        await authController.verify({ body: { phone: demoAdminPhone, otp: '123456', role: 'hoi' } }, resVerify);
        assert.strictEqual(resVerify.getStatus(), 403, 'Demo admin attempting Principal verify must be rejected with 403');
        assert.ok(resVerify.getData().error.includes('not registered as Principal'));

        // Also verify isDemoLogin directly rejects 9999999999 for hoi
        const isDemoPrincipal = demoAuth.isDemoLogin(demoAdminPhone, 'hoi');
        assert.strictEqual(isDemoPrincipal, false, 'isDemoLogin must return false for 9999999999 with role hoi');

        recordResult(6, 'Demo number (9999999999) used for Principal login -> Rejected', true);
    } catch (e) {
        recordResult(6, 'Demo number (9999999999) used for Principal login -> Rejected', false, e.message);
    }

    // -----------------------------------------------------------------------------------
    // Case 7: Real Admin OTP must never appear in frontend responses, logs, or console
    // -----------------------------------------------------------------------------------
    try {
        // Intercept console.log during real admin OTP dispatch to ensure no OTP is logged
        const loggedMessages = [];
        const originalConsoleLog = console.log;
        console.log = (...args) => {
            loggedMessages.push(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
            originalConsoleLog(...args);
        };

        const resLogin = createMockRes();
        await authController.login({ body: { phone: realAdminPhone, role: 'admin' } }, resLogin);
        
        console.log = originalConsoleLog;

        const responseData = resLogin.getData();
        assert.strictEqual(responseData.testOtp, undefined, 'Real Admin login response must never contain testOtp');
        assert.strictEqual(responseData.otp, undefined, 'Real Admin login response must never contain otp field');

        // Check response JSON string for any 6-digit OTP leak
        const responseJson = JSON.stringify(responseData);
        const containsSecret = /"testOtp"|"otp":\s*"\d{6}"/.test(responseJson);
        assert.strictEqual(containsSecret, false, 'Response payload must never contain OTP');

        // Check intercepted console logs: no log should print a 6-digit code for Real Admin
        const leakedInLogs = loggedMessages.some(msg => msg.includes(realAdminPhone) && /\b\d{6}\b/.test(msg));
        assert.strictEqual(leakedInLogs, false, 'Real Admin OTP must never be printed to console logs');

        recordResult(7, 'Real Admin OTP must never appear in frontend responses, logs, or console', true);
    } catch (e) {
        recordResult(7, 'Real Admin OTP must never appear in frontend responses, logs, or console', false, e.message);
    }

    console.log('='.repeat(75));
    console.log(`SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED out of 7 test cases.`);
    console.log('='.repeat(75));

    if (failedCount > 0) {
        process.exit(1);
    }
}

runAllTests().catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
