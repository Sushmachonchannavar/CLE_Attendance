const assert = require('assert');
const path = require('path');
const jwt = require('jsonwebtoken');

// Ensure test environment JWT secret
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_must_be_minimum_32_characters_long!';
process.env.DEMO_LOGIN_ENABLED = 'true';
process.env.DEMO_PRINCIPAL_PHONE = '8888888888';
process.env.DEMO_OTP = '123456';

const db = require(path.resolve(__dirname, 'database'));
const authController = require(path.resolve(__dirname, 'controllers/authController'));
const sessionManager = require(path.resolve(__dirname, 'utils/sessionManager'));
const authMiddleware = require(path.resolve(__dirname, 'middleware/authMiddleware'));

function createMockRes() {
    let statusCode = 200;
    let responseData = null;
    let cookiesSet = {};
    let cookiesCleared = {};

    return {
        status: (code) => {
            statusCode = code;
            return {
                json: (data) => { responseData = data; return data; }
            };
        },
        json: (data) => { responseData = data; return data; },
        cookie: (name, val, opts) => { cookiesSet[name] = { val, opts }; },
        clearCookie: (name, opts) => { cookiesCleared[name] = opts; },
        getStatus: () => statusCode,
        getData: () => responseData,
        getCookies: () => cookiesSet,
        getClearedCookies: () => cookiesCleared
    };
}

async function runTestSuite() {
    console.log('='.repeat(75));
    console.log(' MULTI-DEVICE SESSION MANAGEMENT & TRUSTED DEVICES AUDIT TEST SUITE');
    console.log('='.repeat(75));

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

    const testPrincipalPhone = '8888888888';
    const testUser = db.prepare("SELECT * FROM users WHERE phone = ?").get(testPrincipalPhone);
    assert(testUser, 'Principal user (8888888888) must exist in database for testing.');

    // Clean up any old sessions for this user to start clean test
    db.prepare("DELETE FROM user_sessions WHERE user_id = ?").run(testUser.id);
    db.pragma('wal_checkpoint(TRUNCATE)');

    const deviceIdA = 'dev_laptop_windows_chrome_' + Date.now();
    const userAgentA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    const deviceIdB = 'dev_mobile_iphone_safari_' + Date.now();
    const userAgentB = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

    let tokenA, refreshTokenA, sessionIdA;
    let tokenB, refreshTokenB, sessionIdB;

    // -------------------------------------------------------------
    // TEST 1: Initial Login on Device A (Laptop)
    // -------------------------------------------------------------
    console.log('\n--- Step 1: Initial OTP Login on Device A (Laptop) ---');
    {
        const req = {
            body: {
                phone: testPrincipalPhone,
                otp: '123456',
                role: 'hoi',
                deviceId: deviceIdA,
                deviceInfo: {
                    platform: 'web',
                    browser: 'Chrome 120.0.0.0',
                    os: 'Windows 10',
                    deviceType: 'desktop'
                }
            },
            headers: {
                'user-agent': userAgentA
            },
            ip: '192.168.1.10'
        };
        const res = createMockRes();

        await authController.verify(req, res);
        const data = res.getData();

        report('Device A login succeeds', res.getStatus() === 200 && data.success === true);
        report('Device A returns access token', typeof data.token === 'string' && data.token.length > 20);
        report('Device A returns refresh token', typeof data.refreshToken === 'string' && data.refreshToken.length > 20);
        report('Device A sets HttpOnly cookies', Boolean(res.getCookies().token && res.getCookies().refreshToken));

        tokenA = data.token;
        refreshTokenA = data.refreshToken;

        // Verify in SQLite
        const sessionsA = db.prepare("SELECT * FROM user_sessions WHERE user_id = ? AND device_id = ?").all(testUser.id, deviceIdA);
        report('Device A session stored in SQLite', sessionsA.length === 1);
        report('Device A session is active (is_revoked = 0)', sessionsA[0]?.is_revoked === 0);
        report('Device A refresh token is hashed in SQLite', sessionsA[0]?.refresh_token_hash !== refreshTokenA);
        sessionIdA = sessionsA[0]?.id;
    }

    // -------------------------------------------------------------
    // TEST 2: Initial Login on Device B (Mobile Phone) for SAME User
    // -------------------------------------------------------------
    console.log('\n--- Step 2: Login on Device B (Mobile Phone) for SAME User ---');
    {
        const req = {
            body: {
                phone: testPrincipalPhone,
                otp: '123456',
                role: 'hoi',
                deviceId: deviceIdB,
                deviceInfo: {
                    platform: 'mobile-web',
                    browser: 'Mobile Safari 17.0',
                    os: 'iOS 17.0',
                    deviceType: 'mobile'
                }
            },
            headers: {
                'user-agent': userAgentB
            },
            ip: '10.0.0.25'
        };
        const res = createMockRes();

        await authController.verify(req, res);
        const data = res.getData();

        report('Device B login succeeds', res.getStatus() === 200 && data.success === true);
        report('Device B returns independent access token', typeof data.token === 'string' && data.token !== tokenA);
        report('Device B returns independent refresh token', typeof data.refreshToken === 'string' && data.refreshToken !== refreshTokenA);

        tokenB = data.token;
        refreshTokenB = data.refreshToken;

        // Verify in SQLite that BOTH sessions exist and neither overwrote the other
        const allSessions = db.prepare("SELECT * FROM user_sessions WHERE user_id = ? AND is_revoked = 0").all(testUser.id);
        report('Both Device A and Device B sessions coexist in SQLite', allSessions.length === 2);

        const sessA = allSessions.find(s => s.device_id === deviceIdA);
        const sessB = allSessions.find(s => s.device_id === deviceIdB);
        report('Device A session still active', sessA && sessA.is_revoked === 0);
        report('Device B session is active', sessB && sessB.is_revoked === 0);
        sessionIdB = sessB?.id;
    }

    // -------------------------------------------------------------
    // TEST 3: Retrieve Sessions via API from Device A
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Fetch Sessions via API from Device A ---');
    {
        const req = {
            user: { id: testUser.id, sessionId: sessionIdA, deviceId: deviceIdA },
            headers: { 'x-device-id': deviceIdA }
        };
        const res = createMockRes();

        authController.getSessions(req, res);
        const data = res.getData();

        report('Get sessions returns 2 active sessions', data.sessions?.length === 2);
        const currentSess = data.sessions?.find(s => s.deviceId === deviceIdA);
        const otherSess = data.sessions?.find(s => s.deviceId === deviceIdB);

        report('Device A correctly identified as current session (isCurrent = true)', currentSess?.isCurrent === true);
        report('Device B correctly identified as non-current session (isCurrent = false)', otherSess?.isCurrent === false);
    }

    // -------------------------------------------------------------
    // TEST 4: Transparent Refresh Token Rotation on Device A
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Refresh Token Rotation on Device A ---');
    let newRefreshTokenA;
    {
        const req = {
            cookies: { refreshToken: refreshTokenA },
            headers: { 'x-device-id': deviceIdA, 'user-agent': userAgentA },
            ip: '192.168.1.10'
        };
        const res = createMockRes();

        await authController.refreshToken(req, res);
        const data = res.getData();

        report('Refresh token rotation succeeds', res.getStatus() === 200 && data.success === true);
        report('Issues new access token', typeof data.token === 'string' && data.token.length > 20);
        report('Issues rotated refresh token', typeof data.refreshToken === 'string' && data.refreshToken !== refreshTokenA);

        newRefreshTokenA = data.refreshToken;

        // Verify replay protection: using OLD refresh token must fail
        const replayReq = {
            cookies: { refreshToken: refreshTokenA },
            headers: { 'x-device-id': deviceIdA },
            ip: '192.168.1.10'
        };
        const replayRes = createMockRes();
        await authController.refreshToken(replayReq, replayRes);
        report('Old refresh token is invalidated (replay protection)', replayRes.getStatus() === 401);

        // Verify Device B's session was unaffected by Device A's refresh rotation
        const sessB = db.prepare("SELECT is_revoked FROM user_sessions WHERE id = ?").get(sessionIdB);
        report('Device B session remains active after Device A rotation', sessB?.is_revoked === 0);
    }

    // -------------------------------------------------------------
    // TEST 5: Single-Device Logout from Device A
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Single-Device Logout from Device A ---');
    {
        const req = {
            user: { id: testUser.id, sessionId: sessionIdA, deviceId: deviceIdA },
            headers: { 'x-device-id': deviceIdA }
        };
        const res = createMockRes();

        authController.logout(req, res);
        report('Device A logout returns success', res.getStatus() === 200);

        // Check SQLite
        const sessA = db.prepare("SELECT is_revoked FROM user_sessions WHERE id = ?").get(sessionIdA);
        const sessB = db.prepare("SELECT is_revoked FROM user_sessions WHERE id = ?").get(sessionIdB);

        report('Device A session revoked in SQLite (is_revoked = 1)', sessA?.is_revoked === 1);
        report('Device B session remains completely UNTOUCHED (is_revoked = 0)', sessB?.is_revoked === 0);
    }

    // -------------------------------------------------------------
    // TEST 6: authMiddleware Rejection for Revoked Device A
    // -------------------------------------------------------------
    console.log('\n--- Step 6: Verify authMiddleware Rejects Revoked Device A Session ---');
    {
        const req = {
            headers: { authorization: `Bearer ${tokenA}` },
            cookies: {}
        };
        const res = createMockRes();
        let nextCalled = false;

        authMiddleware(req, res, () => { nextCalled = true; });

        report('Revoked session token is rejected by authMiddleware', res.getStatus() === 401 && nextCalled === false);
        report('Error explains session revocation', res.getData()?.error?.includes('revoked'));
    }

    // -------------------------------------------------------------
    // TEST 7: authMiddleware Accepts Active Device B
    // -------------------------------------------------------------
    console.log('\n--- Step 7: Verify authMiddleware Accepts Active Device B Session ---');
    {
        const req = {
            headers: { authorization: `Bearer ${tokenB}` },
            cookies: {}
        };
        const res = createMockRes();
        let nextCalled = false;

        authMiddleware(req, res, () => { nextCalled = true; });

        report('Active Device B session token accepted by authMiddleware', nextCalled === true);
        report('req.user populated with user, sessionId, and deviceId', req.user?.id === testUser.id && req.user?.sessionId === sessionIdB);
    }

    // -------------------------------------------------------------
    // TEST 8: Revoke Other Sessions from Device B
    // -------------------------------------------------------------
    console.log('\n--- Step 8: Revoke Other Sessions from Device B ---');
    {
        // First create a third device C
        const deviceIdC = 'dev_tablet_ipad_' + Date.now();
        const sessionC = sessionManager.createSession(db, {
            userId: testUser.id,
            deviceId: deviceIdC,
            deviceInfo: { platform: 'tablet', browser: 'Safari', os: 'iPadOS', deviceType: 'tablet' }
        });
        const sessionIdC = sessionC.sessionId;

        const req = {
            user: { id: testUser.id, sessionId: sessionIdB, deviceId: deviceIdB }
        };
        const res = createMockRes();

        authController.revokeOtherSessions(req, res);
        report('revokeOtherSessions returns success', res.getStatus() === 200 && res.getData()?.success === true);

        const checkB = db.prepare("SELECT is_revoked FROM user_sessions WHERE id = ?").get(sessionIdB);
        const checkC = db.prepare("SELECT is_revoked FROM user_sessions WHERE id = ?").get(sessionIdC);

        report('Device B (calling device) remains active', checkB?.is_revoked === 0);
        report('Device C session was revoked', checkC?.is_revoked === 1);
    }

    // -------------------------------------------------------------
    // TEST 9: Logout All Devices
    // -------------------------------------------------------------
    console.log('\n--- Step 9: Logout All Devices ---');
    {
        const req = {
            user: { id: testUser.id, sessionId: sessionIdB, deviceId: deviceIdB }
        };
        const res = createMockRes();

        authController.logoutAll(req, res);
        report('logoutAll returns success', res.getStatus() === 200 && res.getData()?.success === true);

        const activeSessions = db.prepare("SELECT COUNT(*) as count FROM user_sessions WHERE user_id = ? AND is_revoked = 0").get(testUser.id);
        report('Zero active sessions remain in SQLite after logoutAll', activeSessions.count === 0);
    }

    // Clean up test sessions
    db.prepare("DELETE FROM user_sessions WHERE user_id = ?").run(testUser.id);
    db.pragma('wal_checkpoint(TRUNCATE)');

    console.log('\n' + '='.repeat(75));
    console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('='.repeat(75));

    if (failed > 0) {
        process.exit(1);
    }
}

runTestSuite().catch(err => {
    console.error('Fatal error during test suite:', err);
    process.exit(1);
});
