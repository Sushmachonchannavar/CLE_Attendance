const assert = require('assert');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Ensure test JWT secret
process.env.JWT_SECRET = process.env.JWT_SECRET || 'cle_test_audit_secret_with_at_least_thirty_two_chars_123456';
process.env.DEMO_LOGIN_ENABLED = 'true';
process.env.DEMO_PRINCIPAL_PHONE = '8888888888';
process.env.DEMO_OTP = '123456';
process.env.ADMIN_PHONE = '9448378417';

const db = require(path.resolve(__dirname, 'database'));
const authController = require(path.resolve(__dirname, 'controllers/authController'));
const requestController = require(path.resolve(__dirname, 'controllers/requestController'));
const roleMiddleware = require(path.resolve(__dirname, 'middleware/roleMiddleware'));

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
    console.log('='.repeat(75));
    console.log(' STAFF REGISTRATION APPROVAL & PRINCIPAL EXCLUSIVITY TEST SUITE');
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

    const principalUser = { id: 2, role: 'hoi', name: 'Principal Dr. User' };
    const adminUser = { id: 155, role: 'admin', name: 'System Administrator' };
    const staffUser = { id: 100, role: 'staff', name: 'Demo Staff 1' };

    const testStaff1Phone = '9800112233';
    const testStaff2Phone = '9800112244';

    // Cleanup any prior test users
    db.prepare("DELETE FROM users WHERE phone IN (?, ?)").run(testStaff1Phone, testStaff2Phone);
    db.prepare("DELETE FROM auth_lockouts WHERE identifier LIKE ? OR identifier LIKE ?").run(`%${testStaff1Phone}%`, `%${testStaff2Phone}%`);
    db.prepare("DELETE FROM otps WHERE phone LIKE ? OR phone LIKE ?").run(`%${testStaff1Phone}%`, `%${testStaff2Phone}%`);

    let staff1Id = null;
    let staff2Id = null;

    try {
        // -----------------------------------------------------------------
        // Scenario 1: New staff registers successfully and is saved as 'pending'
        // -----------------------------------------------------------------
        const regRes = createMockRes();
        authController.register({
            body: {
                firstName: 'Anand',
                lastName: 'Patil',
                mobile: testStaff1Phone,
                collegeName: 'CLE Society College of Engineering',
                departmentName: 'Computer Science',
                designation: 'Assistant Professor'
            }
        }, regRes);

        assert.strictEqual(regRes.getStatus(), 201, 'Registration must return 201 Created');
        assert.ok(regRes.getData().message.includes('pending Principal approval'), 'Message must inform user that account is pending Principal approval');

        const savedUser1 = db.prepare("SELECT * FROM users WHERE phone = ?").get(testStaff1Phone);
        assert.ok(savedUser1, 'Staff 1 must exist in DB');
        assert.strictEqual(savedUser1.status, 'pending', 'Newly registered staff status must be pending');
        assert.strictEqual(savedUser1.designation, 'Assistant Professor', 'Designation must be saved');
        staff1Id = savedUser1.id;

        // Register second staff for rejection test
        const regRes2 = createMockRes();
        authController.register({
            body: {
                firstName: 'Deepak',
                lastName: 'Deshmukh',
                mobile: testStaff2Phone,
                collegeName: 'CLE Society College of Commerce',
                departmentName: 'Business Administration',
                designation: 'Lecturer'
            }
        }, regRes2);
        assert.strictEqual(regRes2.getStatus(), 201);
        const savedUser2 = db.prepare("SELECT * FROM users WHERE phone = ?").get(testStaff2Phone);
        assert.ok(savedUser2);
        assert.strictEqual(savedUser2.status, 'pending');
        staff2Id = savedUser2.id;

        report('Scenario 1: Staff registers and account is saved with status pending and Principal approval message', true);
    } catch (e) {
        report('Scenario 1: Staff registers and account is saved with status pending and Principal approval message', false, e.message);
    }

    try {
        // -----------------------------------------------------------------
        // Scenario 2: Pending staff cannot receive OTP or log in
        // -----------------------------------------------------------------
        const loginRes = createMockRes();
        await authController.login({ body: { phone: testStaff1Phone, role: 'staff' } }, loginRes);
        assert.strictEqual(loginRes.getStatus(), 403, 'Pending staff login request must return 403 Forbidden');
        assert.strictEqual(
            loginRes.getData().error,
            'Your account is pending Principal approval. Please contact the Principal.',
            'Must return exact Principal approval pending error message'
        );

        // Verify verify endpoint also rejects
        const verifyRes = createMockRes();
        await authController.verify({ body: { phone: testStaff1Phone, otp: '123456', role: 'staff' } }, verifyRes);
        assert.strictEqual(verifyRes.getStatus(), 403, 'Pending staff verify must return 403');
        assert.strictEqual(verifyRes.getData().error, 'Your account is pending Principal approval. Please contact the Principal.');

        report('Scenario 2: Pending staff cannot receive OTP or log in (HTTP 403 with Principal message)', true);
    } catch (e) {
        report('Scenario 2: Pending staff cannot receive OTP or log in (HTTP 403 with Principal message)', false, e.message);
    }

    try {
        // -----------------------------------------------------------------
        // Scenario 3: Admin CANNOT view staff registration requests (HTTP 403)
        // -----------------------------------------------------------------
        // Test roleMiddleware blocks Admin
        let middlewareCalledNext = false;
        const mockAdminRes = createMockRes();
        const checkRole = roleMiddleware(['hoi', 'principal']);
        checkRole({ user: adminUser }, mockAdminRes, () => { middlewareCalledNext = true; });
        assert.strictEqual(mockAdminRes.getStatus(), 403, 'roleMiddleware must block Admin with 403');
        assert.strictEqual(middlewareCalledNext, false, 'Admin must not reach handler');

        // Test controller directly rejects Admin
        const adminGetRes = createMockRes();
        requestController.getStaffRegistrations({ user: adminUser, query: {} }, adminGetRes);
        assert.strictEqual(adminGetRes.getStatus(), 403, 'Admin calling getStaffRegistrations must receive 403');
        assert.ok(adminGetRes.getData().error.includes('Only the Principal has authority'));

        report('Scenario 3: Admin role CANNOT view staff registration requests (strictly blocked with HTTP 403)', true);
    } catch (e) {
        report('Scenario 3: Admin role CANNOT view staff registration requests (strictly blocked with HTTP 403)', false, e.message);
    }

    try {
        // -----------------------------------------------------------------
        // Scenario 4: Admin CANNOT approve or reject staff registrations (HTTP 403)
        // -----------------------------------------------------------------
        const adminApproveRes = createMockRes();
        requestController.updateStaffRegistrationStatus({
            user: adminUser,
            params: { id: staff1Id },
            body: { status: 'approved' }
        }, adminApproveRes);

        assert.strictEqual(adminApproveRes.getStatus(), 403, 'Admin attempting to approve staff must receive 403');
        assert.ok(adminApproveRes.getData().error.includes('Only the Principal has authority'));

        // Verify status in DB did NOT change
        const checkStaff1 = db.prepare("SELECT status FROM users WHERE id = ?").get(staff1Id);
        assert.strictEqual(checkStaff1.status, 'pending', 'Staff status must remain pending after admin attempt');

        report('Scenario 4: Admin role CANNOT approve or reject staff registrations (strictly blocked with HTTP 403)', true);
    } catch (e) {
        report('Scenario 4: Admin role CANNOT approve or reject staff registrations (strictly blocked with HTTP 403)', false, e.message);
    }

    try {
        // -----------------------------------------------------------------
        // Scenario 5: Staff CANNOT approve or reject other staff (HTTP 403)
        // -----------------------------------------------------------------
        const staffGetRes = createMockRes();
        requestController.getStaffRegistrations({ user: staffUser, query: {} }, staffGetRes);
        assert.strictEqual(staffGetRes.getStatus(), 403, 'Staff calling getStaffRegistrations must receive 403');

        const staffApproveRes = createMockRes();
        requestController.updateStaffRegistrationStatus({
            user: staffUser,
            params: { id: staff1Id },
            body: { status: 'approved' }
        }, staffApproveRes);
        assert.strictEqual(staffApproveRes.getStatus(), 403, 'Staff attempting to approve staff must receive 403');

        report('Scenario 5: Staff role CANNOT approve or reject other staff (strictly blocked with HTTP 403)', true);
    } catch (e) {
        report('Scenario 5: Staff role CANNOT approve or reject other staff (strictly blocked with HTTP 403)', false, e.message);
    }

    try {
        // -----------------------------------------------------------------
        // Scenario 6: Principal CAN view pending staff registration requests
        // -----------------------------------------------------------------
        const principalGetRes = createMockRes();
        requestController.getStaffRegistrations({ user: principalUser, query: { status: 'pending' } }, principalGetRes);
        assert.strictEqual(principalGetRes.getStatus(), 200, 'Principal must receive 200 OK');
        const regList = principalGetRes.getData().registrations;
        assert.ok(Array.isArray(regList), 'Must return array of registrations');
        const foundStaff1 = regList.find(s => s.id === staff1Id);
        assert.ok(foundStaff1, 'Pending staff 1 must be in Principal list');
        assert.strictEqual(foundStaff1.name, 'Anand Patil');
        assert.strictEqual(foundStaff1.phone, testStaff1Phone);
        assert.strictEqual(foundStaff1.designation, 'Assistant Professor');
        assert.strictEqual(foundStaff1.department, 'Computer Science');
        assert.ok(foundStaff1.created_at, 'Registration date must be present');

        report('Scenario 6: Principal CAN view pending staff registration requests with full details', true);
    } catch (e) {
        report('Scenario 6: Principal CAN view pending staff registration requests with full details', false, e.message);
    }

    try {
        // -----------------------------------------------------------------
        // Scenario 7: Principal CAN approve pending staff account
        // -----------------------------------------------------------------
        const principalApproveRes = createMockRes();
        requestController.updateStaffRegistrationStatus({
            user: principalUser,
            params: { id: staff1Id },
            body: { status: 'approved' }
        }, principalApproveRes);

        assert.strictEqual(principalApproveRes.getStatus(), 200, 'Principal approve must return 200 OK');
        assert.strictEqual(principalApproveRes.getData().success, true);
        assert.strictEqual(principalApproveRes.getData().staff.status, 'approved');

        // Check database persistence
        const updatedStaff1 = db.prepare("SELECT status FROM users WHERE id = ?").get(staff1Id);
        assert.strictEqual(updatedStaff1.status, 'approved', 'Staff status in SQLite must be approved');

        report('Scenario 7: Principal approves staff registration -> Status changes to approved', true);
    } catch (e) {
        report('Scenario 7: Principal approves staff registration -> Status changes to approved', false, e.message);
    }

    try {
        // -----------------------------------------------------------------
        // Scenario 8: Approved staff can now receive real SMS OTP and log in
        // -----------------------------------------------------------------
        const realStaffOtp = '482910';
        const hashedOtp = crypto.createHash('sha256').update(realStaffOtp).digest('hex');
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at, attempts) VALUES (?, ?, ?, 0)').run('+91' + testStaff1Phone, hashedOtp, expiresAt);
        db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at, attempts) VALUES (?, ?, ?, 0)').run(testStaff1Phone, hashedOtp, expiresAt);

        const verifyApprovedRes = createMockRes();
        await authController.verify({ body: { phone: testStaff1Phone, otp: realStaffOtp, role: 'staff' } }, verifyApprovedRes);

        assert.strictEqual(verifyApprovedRes.getStatus(), 200, 'Approved staff verify must succeed with 200 OK');
        assert.strictEqual(verifyApprovedRes.getData().success, true);
        assert.ok(verifyApprovedRes.getData().token, 'Must issue JWT token');
        assert.strictEqual(verifyApprovedRes.getData().user.id, staff1Id);
        assert.strictEqual(verifyApprovedRes.getData().user.status, 'approved');

        // Verify token verification endpoint confirms approved status
        const tokenVerifyRes = createMockRes();
        authController.verifyToken({ user: { id: staff1Id } }, tokenVerifyRes);
        assert.strictEqual(tokenVerifyRes.getStatus(), 200, 'verifyToken must succeed for approved user');

        report('Scenario 8: Approved staff can receive OTP, verify, and authenticate successfully', true);
    } catch (e) {
        report('Scenario 8: Approved staff can receive OTP, verify, and authenticate successfully', false, e.message);
    }

    try {
        // -----------------------------------------------------------------
        // Scenario 9: Principal CAN reject pending staff account
        // -----------------------------------------------------------------
        const principalRejectRes = createMockRes();
        requestController.updateStaffRegistrationStatus({
            user: principalUser,
            params: { id: staff2Id },
            body: { status: 'rejected', reason: 'Unverified credentials' }
        }, principalRejectRes);

        assert.strictEqual(principalRejectRes.getStatus(), 200, 'Principal reject must return 200 OK');
        assert.strictEqual(principalRejectRes.getData().staff.status, 'rejected');

        const updatedStaff2 = db.prepare("SELECT status FROM users WHERE id = ?").get(staff2Id);
        assert.strictEqual(updatedStaff2.status, 'rejected', 'Staff status in SQLite must be rejected');

        report('Scenario 9: Principal rejects staff registration -> Status changes to rejected', true);
    } catch (e) {
        report('Scenario 9: Principal rejects staff registration -> Status changes to rejected', false, e.message);
    }

    try {
        // -----------------------------------------------------------------
        // Scenario 10: Rejected staff CANNOT receive OTP or log in
        // -----------------------------------------------------------------
        const rejectLoginRes = createMockRes();
        await authController.login({ body: { phone: testStaff2Phone, role: 'staff' } }, rejectLoginRes);
        assert.strictEqual(rejectLoginRes.getStatus(), 403, 'Rejected staff login must return 403');
        assert.strictEqual(
            rejectLoginRes.getData().error,
            'Your registration request has been rejected by the Principal. Please contact the Principal.',
            'Must return rejection message'
        );

        const rejectVerifyRes = createMockRes();
        await authController.verify({ body: { phone: testStaff2Phone, otp: '123456', role: 'staff' } }, rejectVerifyRes);
        assert.strictEqual(rejectVerifyRes.getStatus(), 403, 'Rejected staff verify must return 403');
        assert.strictEqual(
            rejectVerifyRes.getData().error,
            'Your registration request has been rejected by the Principal. Please contact the Principal.'
        );

        report('Scenario 10: Rejected staff cannot receive OTP or log in (HTTP 403 with rejection message)', true);
    } catch (e) {
        report('Scenario 10: Rejected staff cannot receive OTP or log in (HTTP 403 with rejection message)', false, e.message);
    }

    try {
        // -----------------------------------------------------------------
        // Scenario 11: Approval & Rejection persist across database re-read
        // -----------------------------------------------------------------
        const persistedStaff1 = db.prepare("SELECT id, status FROM users WHERE id = ?").get(staff1Id);
        assert.strictEqual(persistedStaff1.status, 'approved', 'Staff 1 must remain approved in database');

        const persistedStaff2 = db.prepare("SELECT id, status FROM users WHERE id = ?").get(staff2Id);
        assert.strictEqual(persistedStaff2.status, 'rejected', 'Staff 2 must remain rejected in database');

        report('Scenario 11: Approval and rejection statuses persist permanently in database', true);
    } catch (e) {
        report('Scenario 11: Approval and rejection statuses persist permanently in database', false, e.message);
    } finally {
        // Clean up test staff records
        db.prepare("DELETE FROM users WHERE phone IN (?, ?)").run(testStaff1Phone, testStaff2Phone);
        db.prepare("DELETE FROM auth_lockouts WHERE identifier LIKE ? OR identifier LIKE ?").run(`%${testStaff1Phone}%`, `%${testStaff2Phone}%`);
        db.prepare("DELETE FROM otps WHERE phone LIKE ? OR phone LIKE ?").run(`%${testStaff1Phone}%`, `%${testStaff2Phone}%`);
        try {
            db.prepare("DELETE FROM approval_audit_logs WHERE request_type = 'staff_registration' AND request_id IN (?, ?)").run(staff1Id, staff2Id);
        } catch (e) {}
    }

    console.log('='.repeat(75));
    console.log(` SUMMARY: ${passed} / ${passed + failed} SCENARIOS PASSED`);
    console.log('='.repeat(75));

    if (failed > 0) {
        process.exit(1);
    }
}

runTestSuite();
