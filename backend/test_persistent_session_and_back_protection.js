const assert = require('assert');
const path = require('path');
const jwt = require('jsonwebtoken');

// Ensure JWT_SECRET is set
process.env.JWT_SECRET = process.env.JWT_SECRET || 'a_very_strong_production_test_secret_key_32_characters_long';

const db = require('./database');
const authMiddleware = require('./middleware/authMiddleware');
const authController = require('./controllers/authController');
const { getAuthCookieOptions, getClearCookieOptions } = require('./utils/cookies');

console.log('\n============================================================');
console.log('   PERSISTENT SESSION & BACK NAVIGATION PROTECTION TEST     ');
console.log('============================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(description, testFn) {
    totalTests++;
    try {
        testFn();
        console.log(`[PASS] ${description}`);
        passedTests++;
    } catch (err) {
        console.error(`[FAIL] ${description}`);
        console.error(`       Error: ${err.message}`);
    }
}

async function runAsyncTest(description, testFn) {
    totalTests++;
    try {
        await testFn();
        console.log(`[PASS] ${description}`);
        passedTests++;
    } catch (err) {
        console.error(`[FAIL] ${description}`);
        console.error(`       Error: ${err.message}`);
    }
}

async function main() {
    // Setup test user in database
    const testPhone = '9876543210';
    const testEmpId = 'EMP-TEST-999';
    let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(testPhone);
    if (!user) {
        const info = db.prepare(`
            INSERT INTO users (name, phone, role, employee_id, status)
            VALUES (?, ?, ?, ?, ?)
        `).run('Test Staff', testPhone, 'staff', testEmpId, 'active');
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    }

    // 1. Test Cookie Configuration
    runTest('Cookie Options have httpOnly, maxAge (7 days), and path "/"', () => {
        const options = getAuthCookieOptions();
        assert.strictEqual(options.httpOnly, true, 'Must be httpOnly');
        assert.strictEqual(options.path, '/', 'Must have path /');
        assert.strictEqual(options.maxAge, 7 * 24 * 60 * 60 * 1000, 'Must expire in 7 days');
        assert.ok(options.sameSite === 'lax' || options.sameSite === 'none');
    });

    runTest('Clear Cookie Options have httpOnly and path "/"', () => {
        const options = getClearCookieOptions();
        assert.strictEqual(options.httpOnly, true, 'Must be httpOnly');
        assert.strictEqual(options.path, '/', 'Must have path /');
    });

    // 2. Test Auth Middleware with Header Bearer Token
    runTest('AuthMiddleware accepts valid Bearer Authorization header', () => {
        const validToken = jwt.sign(
            { id: user.id, role: user.role, employeeId: user.employee_id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        let nextCalled = false;
        const req = {
            header: (h) => h === 'Authorization' ? `Bearer ${validToken}` : null
        };
        const res = {};
        const next = () => { nextCalled = true; };

        authMiddleware(req, res, next);
        assert.strictEqual(nextCalled, true, 'next() must be called');
        assert.strictEqual(req.user.id, user.id);
        assert.strictEqual(req.user.role, 'staff');
    });

    // 3. Test Auth Middleware with HTTP-only Cookie
    runTest('AuthMiddleware accepts valid session cookie (req.cookies.token)', () => {
        const validToken = jwt.sign(
            { id: user.id, role: user.role, employeeId: user.employee_id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        let nextCalled = false;
        const req = {
            header: () => null,
            cookies: { token: validToken }
        };
        const res = {};
        const next = () => { nextCalled = true; };

        authMiddleware(req, res, next);
        assert.strictEqual(nextCalled, true, 'next() must be called with valid cookie');
        assert.strictEqual(req.user.id, user.id);
        assert.strictEqual(req.user.role, 'staff');
    });

    // 4. Test Auth Middleware with Raw Cookie Header Fallback
    runTest('AuthMiddleware parses raw Cookie header (req.headers.cookie)', () => {
        const validToken = jwt.sign(
            { id: user.id, role: user.role, employeeId: user.employee_id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        let nextCalled = false;
        const req = {
            header: () => null,
            headers: { cookie: `other_cookie=123; token=${validToken}; pref=dark` }
        };
        const res = {};
        const next = () => { nextCalled = true; };

        authMiddleware(req, res, next);
        assert.strictEqual(nextCalled, true, 'next() must be called with raw cookie');
        assert.strictEqual(req.user.id, user.id);
    });

    // 5. Test Auth Middleware rejects missing credentials
    runTest('AuthMiddleware rejects missing credentials with HTTP 401', () => {
        let statusCode = null;
        let responseJson = null;

        const req = {
            header: () => null,
            cookies: {},
            headers: {}
        };
        const res = {
            status: (code) => {
                statusCode = code;
                return {
                    json: (data) => { responseJson = data; }
                };
            }
        };
        const next = () => {};

        authMiddleware(req, res, next);
        assert.strictEqual(statusCode, 401, 'Status must be 401');
        assert.ok(responseJson && responseJson.error, 'Must return error message');
    });

    // 6. Test Auth Middleware rejects expired or tampered token
    runTest('AuthMiddleware rejects expired / invalid token with HTTP 401', () => {
        const expiredToken = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '-1s' }
        );

        let statusCode = null;
        const req = {
            header: (h) => h === 'Authorization' ? `Bearer ${expiredToken}` : null
        };
        const res = {
            status: (code) => {
                statusCode = code;
                return { json: () => {} };
            }
        };

        authMiddleware(req, res, () => {});
        assert.strictEqual(statusCode, 401, 'Expired token must return 401');
    });

    // 7. Test verifyToken Endpoint: Database validation of active user
    runTest('verifyToken validates active user and returns full profile', () => {
        let responseData = null;
        const req = {
            user: { id: user.id, role: user.role }
        };
        const res = {
            json: (data) => { responseData = data; }
        };

        authController.verifyToken(req, res);
        assert.ok(responseData, 'Must return data');
        assert.strictEqual(responseData.user.id, user.id);
        assert.strictEqual(responseData.user.status, 'active');
    });

    // 8. Test verifyToken Endpoint: Rejects deactivated / non-existent user
    runTest('verifyToken rejects non-existent user with HTTP 401', () => {
        let statusCode = null;
        let responseData = null;
        const req = {
            user: { id: 99999999, role: 'staff' }
        };
        const res = {
            status: (code) => {
                statusCode = code;
                return {
                    json: (data) => { responseData = data; }
                };
            }
        };

        authController.verifyToken(req, res);
        assert.strictEqual(statusCode, 401, 'Must return 401 for non-existent user');
    });

    // 9. Test Logout Endpoint
    runTest('logout clears session cookie with path "/"', () => {
        let clearedCookie = null;
        let clearedOptions = null;
        let responseData = null;

        const req = {};
        const res = {
            clearCookie: (name, options) => {
                clearedCookie = name;
                clearedOptions = options;
            },
            json: (data) => { responseData = data; }
        };

        authController.logout(req, res);
        assert.strictEqual(clearedCookie, 'token', 'Must clear "token" cookie');
        assert.strictEqual(clearedOptions.httpOnly, true, 'Clear options must be httpOnly');
        assert.strictEqual(clearedOptions.path, '/', 'Clear options must specify path /');
        assert.strictEqual(responseData.success, true);
    });

    // 10. Role Verification: Staff, Admin, HOI, Principal
    runTest('Supports Staff, Admin, HOI, and Principal role authentication', () => {
        const roles = ['staff', 'admin', 'hoi', 'principal'];
        for (const r of roles) {
            const token = jwt.sign(
                { id: 10, role: r, employeeId: `EMP-${r}` },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );
            const req = {
                header: () => `Bearer ${token}`
            };
            authMiddleware(req, {}, () => {});
            assert.strictEqual(req.user.role, r.toLowerCase());
        }
    });

    console.log('\n============================================================');
    console.log(`   TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
    console.log('============================================================\n');

    if (passedTests === totalTests) {
        process.exit(0);
    } else {
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Test execution error:', err);
    process.exit(1);
});

