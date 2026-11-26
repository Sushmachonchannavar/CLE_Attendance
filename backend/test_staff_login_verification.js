const path = require('path');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_must_be_minimum_32_characters_long!';
process.env.NODE_ENV = 'test';

const db = require(path.resolve(__dirname, 'database'));
const authController = require(path.resolve(__dirname, 'controllers/authController'));

function createMockRes() {
    let statusCode = 200;
    let responseData = null;

    return {
        status: (code) => {
            statusCode = code;
            return {
                json: (data) => { responseData = data; }
            };
        },
        json: (data) => { responseData = data; },
        getStatus: () => statusCode,
        getData: () => responseData
    };
}

async function runStaffLoginTests() {
    console.log('===========================================================================');
    console.log('CLE SOCIETY - STAFF LOGIN & NUMBER NORMALIZATION TEST SUITE');
    console.log('===========================================================================');

    let passed = 0;
    let failed = 0;

    function record(testName, ok, detail = '') {
        if (ok) {
            passed++;
            console.log(`[PASS] ${testName}`);
        } else {
            failed++;
            console.error(`[FAIL] ${testName}: ${detail}`);
        }
    }

    const staffNumber = '6360670247';

    // Case 1: Existing registered staff number without +91 (6360670247)
    try {
        const req = { body: { phone: staffNumber, role: 'staff' }, headers: {}, ip: '127.0.0.1' };
        const res = createMockRes();
        await authController.login(req, res);

        const data = res.getData();
        const status = res.getStatus();
        const notFoundError = data?.error === 'Mobile number not found. Please register first.';
        const isRecognized = !notFoundError && (status === 200 || status === 503 || (data?.success === true));
        record('Case 1: Existing registered staff number (6360670247) is recognized and not rejected as not found', isRecognized, `status: ${status}, error: ${data?.error}`);
    } catch (e) {
        record('Case 1: Existing registered staff number (6360670247)', false, e.message);
    }

    // Case 2: Unregistered mobile number (e.g. 9888877777)
    try {
        const req = { body: { phone: '9888877777', role: 'staff' }, headers: {}, ip: '127.0.0.1' };
        const res = createMockRes();
        await authController.login(req, res);

        const data = res.getData();
        const status = res.getStatus();
        const isNotFound = status === 403 && data?.error === 'Mobile number not found. Please register first.';
        record('Case 2: Unregistered mobile number is rejected with "Mobile number not found. Please register first."', isNotFound, `status: ${status}, data: ${JSON.stringify(data)}`);
    } catch (e) {
        record('Case 2: Unregistered mobile number', false, e.message);
    }

    // Case 3: Registered number entered with +91 (+916360670247)
    try {
        const req = { body: { phone: '+91' + staffNumber, role: 'staff' }, headers: {}, ip: '127.0.0.1' };
        const res = createMockRes();
        await authController.login(req, res);

        const data = res.getData();
        const notFoundError = data?.error === 'Mobile number not found. Please register first.';
        record('Case 3: Registered number entered with +91 (+916360670247) is recognized correctly', !notFoundError, data?.error);
    } catch (e) {
        record('Case 3: Registered number with +91', false, e.message);
    }

    // Case 4: Registered number entered with 91 prefix without plus (916360670247)
    try {
        const req = { body: { phone: '91' + staffNumber, role: 'staff' }, headers: {}, ip: '127.0.0.1' };
        const res = createMockRes();
        await authController.login(req, res);

        const data = res.getData();
        const notFoundError = data?.error === 'Mobile number not found. Please register first.';
        record('Case 4: Registered number entered with 91 prefix (916360670247) is recognized correctly', !notFoundError, data?.error);
    } catch (e) {
        record('Case 4: Registered number with 91 prefix', false, e.message);
    }

    // Case 5: Role mismatch check - staff number attempting Admin login is rejected
    try {
        const req = { body: { phone: staffNumber, role: 'admin' }, headers: {}, ip: '127.0.0.1' };
        const res = createMockRes();
        await authController.login(req, res);

        const data = res.getData();
        const status = res.getStatus();
        const isForbidden = status === 403 && (data?.error?.includes('not authorized') || data?.error?.includes('not registered as'));
        record('Case 5: Staff number attempting Admin login is strictly rejected with 403', isForbidden, `status: ${status}, error: ${data?.error}`);
    } catch (e) {
        record('Case 5: Role mismatch protection', false, e.message);
    }

    // Case 6: Existing staff account persistence across simulated restart and logout
    try {
        const staffRow = db.prepare("SELECT * FROM users WHERE phone LIKE '%6360670247%'").get();
        const existsInDb = Boolean(staffRow && staffRow.role === 'staff' && staffRow.status === 'active');
        record('Case 6: Existing staff account (6360670247) is persistent with active staff role in SQLite', existsInDb, `found: ${JSON.stringify(staffRow)}`);
    } catch (e) {
        record('Case 6: Database persistence check', false, e.message);
    }

    // Case 7: Formatted phone number with spaces (+91 63606 70247)
    try {
        const req = { body: { phone: '+91 63606 70247', role: 'staff' }, headers: {}, ip: '127.0.0.1' };
        const res = createMockRes();
        await authController.login(req, res);

        const data = res.getData();
        const notFoundError = data?.error === 'Mobile number not found. Please register first.';
        record('Case 7: Formatted number with spaces (+91 63606 70247) is normalized and recognized', !notFoundError, data?.error);
    } catch (e) {
        record('Case 7: Formatted phone with spaces', false, e.message);
    }

    // Case 8: Verify endpoint handles normalization for registered staff (+916360670247)
    try {
        const req = { body: { phone: '+916360670247', otp: '000000', role: 'staff' }, headers: {}, ip: '127.0.0.1' };
        const res = createMockRes();
        await authController.verify(req, res);

        const data = res.getData();
        // Should NOT say "User does not exist" - it should recognize user and evaluate the OTP
        const notExistError = data?.error === 'User does not exist. Please register first.';
        record('Case 8: Verify endpoint recognizes normalized staff phone and evaluates OTP', !notExistError, data?.error);
    } catch (e) {
        record('Case 8: Verify endpoint normalization', false, e.message);
    }

    console.log('===========================================================================');
    console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED out of ${passed + failed} test cases.`);
    console.log('===========================================================================');

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runStaffLoginTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
