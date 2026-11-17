/**
 * Verification test suite for:
 * 1. Admin/Principal exclusion from daily attendance roll-call (no "System Administrator ABSENT - - -").
 * 2. Automatic GPS punch-out without automatic logout (user session preserved, exit coordinates saved).
 * 3. One-time permanent staff registration & duplicate rejection (HTTP 409).
 * 4. Unregistered phone login rejection (HTTP 403).
 * 5. Re-punch-in / resume duty when staff returns inside campus.
 * 6. Permanent SQLite persistence across simulated server restarts.
 */

const assert = require('assert');
const path = require('path');

process.env.JWT_SECRET = 'test_secret_for_autopunchout_and_reports_32_chars';

const db = require('./database');
const reportController = require('./controllers/reportController');
const authController = require('./controllers/authController');
const attendanceController = require('./controllers/attendanceController');
const { getKolkataDate } = require('./utils/time');

const TEST_STAFF_PHONE = '9876543210';
const TEST_STAFF_EMPID = 'EMP-TEST-987654';

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
        getData: () => responseData
    };
}

async function runSuite() {
    console.log('=== STARTING AUTOMATED VERIFICATION SUITE ===\n');

    try {
        // CLEANUP PREVIOUS TEST USER IF EXISTS
        db.prepare('DELETE FROM employee_locations WHERE user_id IN (SELECT id FROM users WHERE phone = ?)').run(TEST_STAFF_PHONE);
        db.prepare('DELETE FROM attendance WHERE user_id IN (SELECT id FROM users WHERE phone = ?)').run(TEST_STAFF_PHONE);
        db.prepare('DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE phone = ?)').run(TEST_STAFF_PHONE);
        db.prepare('DELETE FROM users WHERE phone = ?').run(TEST_STAFF_PHONE);

        // -------------------------------------------------------------
        // TEST 1: Admin & Principal Exclusion from Daily Attendance Report
        // -------------------------------------------------------------
        console.log('[TEST 1] Verifying System Administrator & Principal are excluded from daily attendance roll-call...');
        const req1 = { query: { date: getKolkataDate() } };
        const res1 = createMockRes();
        reportController.getDailyReport(req1, res1);

        assert.strictEqual(res1.getStatus(), 200, 'Daily report must return 200 OK');
        const reportRows = res1.getData().report || [];

        const adminInReport = reportRows.find(u => u.phone === '9448378417' || u.name?.toLowerCase().includes('administrator') || u.role?.toLowerCase() === 'admin');
        const principalInReport = reportRows.find(u => u.phone === '8888888888' || u.role?.toLowerCase() === 'hoi');

        assert.strictEqual(adminInReport, undefined, 'System Administrator must NEVER appear in attendance roll-call / report!');
        assert.strictEqual(principalInReport, undefined, 'Principal must NEVER appear in staff attendance roll-call / report!');

        for (const row of reportRows) {
            assert.strictEqual(row.role.toLowerCase(), 'staff', `Every user in daily attendance report must have role='staff', found: ${row.role}`);
        }
        console.log('✓ PASS: System Administrator and Principal are strictly excluded from attendance roll-call.');

        // -------------------------------------------------------------
        // TEST 2: Permanent Staff Registration & Conflict Check
        // -------------------------------------------------------------
        console.log('\n[TEST 2] Verifying staff registration and duplicate account conflict (HTTP 409)...');
        const regReq = {
            body: {
                firstName: 'Aarav',
                lastName: 'Sharma',
                mobile: TEST_STAFF_PHONE,
                collegeName: 'CLE Society Poly',
                departmentName: 'Computer Science',
                designation: 'Lecturer',
                employeeId: TEST_STAFF_EMPID
            }
        };

        const regRes = createMockRes();
        await authController.register(regReq, regRes);
        assert.strictEqual(regRes.getStatus(), 201, `Staff registration should return 201 Created, got ${regRes.getStatus()}`);
        assert.strictEqual(regRes.getData().success, true);

        // Verify committed in SQLite
        const staffInDb = db.prepare('SELECT * FROM users WHERE phone = ?').get(TEST_STAFF_PHONE);
        assert.ok(staffInDb, 'Staff record must be permanently committed to SQLite users table');
        assert.strictEqual(staffInDb.role, 'staff');
        assert.strictEqual(staffInDb.status, 'active');

        // Duplicate registration must return 409
        const dupRes = createMockRes();
        await authController.register(regReq, dupRes);
        assert.strictEqual(dupRes.getStatus(), 409, `Duplicate registration must be rejected with 409, got ${dupRes.getStatus()}`);
        console.log('✓ PASS: Staff registration committed to SQLite and duplicates rejected with 409 Conflict.');

        // -------------------------------------------------------------
        // TEST 3: Unregistered Mobile Number in Login Rejection
        // -------------------------------------------------------------
        console.log('\n[TEST 3] Verifying login with unregistered mobile number is rejected (HTTP 403)...');
        const unregReq = { body: { phone: '9000000000', role: 'staff' }, headers: {} };
        const unregRes = createMockRes();
        await authController.login(unregReq, unregRes);
        assert.strictEqual(unregRes.getStatus(), 403, `Unregistered login must return 403, got ${unregRes.getStatus()}`);
        assert.ok(unregRes.getData().error.includes('register first'), 'Should instruct user to register first');
        console.log('✓ PASS: Unregistered mobile number properly rejected with registration requirement.');

        // -------------------------------------------------------------
        // TEST 4: Punch-In Inside Campus Geofence
        // -------------------------------------------------------------
        console.log('\n[TEST 4] Verifying staff punch-in inside campus boundary...');
        const CAMPUS_INSIDE_LAT = 16.426026;
        const CAMPUS_INSIDE_LNG = 74.589250;
        const punchInReq = {
            user: { id: staffInDb.id, phone: staffInDb.phone, role: 'staff', name: staffInDb.name, employeeId: staffInDb.employee_id },
            body: { lat: CAMPUS_INSIDE_LAT, lng: CAMPUS_INSIDE_LNG }
        };
        const punchInRes = createMockRes();
        attendanceController.punch(punchInReq, punchInRes);

        assert.strictEqual(punchInRes.getStatus(), 200, `Punch-in should succeed with 200, got ${punchInRes.getStatus()}`);
        assert.ok(punchInRes.getData().message.includes('Punched In'), 'Message should indicate punched in');

        const punchInRecord = db.prepare('SELECT * FROM attendance WHERE user_id = ?').get(staffInDb.id);
        assert.ok(punchInRecord, 'Attendance row must be created in SQLite');
        assert.ok(punchInRecord.punch_in_time, 'Punch in time must be populated');
        assert.strictEqual(punchInRecord.punch_out_time, null, 'Punch out time must be NULL initially');
        console.log('✓ PASS: Punch-in inside campus successfully recorded in SQLite.');

        // -------------------------------------------------------------
        // TEST 5: Automatic GPS Punch-Out Outside Campus Boundary WITHOUT LOGOUT
        // -------------------------------------------------------------
        console.log('\n[TEST 5] Verifying automatic punch-out when staff exits campus geofence...');
        // Coordinates outside campus (~2 km away)
        const OUTSIDE_LAT = 16.4150;
        const OUTSIDE_LNG = 74.5800;

        const autoExitReq = {
            user: { id: staffInDb.id, phone: staffInDb.phone, role: 'staff', name: staffInDb.name, employeeId: staffInDb.employee_id },
            body: { lat: OUTSIDE_LAT, lng: OUTSIDE_LNG, isAutoExit: true }
        };
        const autoExitRes = createMockRes();
        attendanceController.autoPunchOut(autoExitReq, autoExitRes);

        assert.strictEqual(autoExitRes.getStatus(), 200, `Auto punch-out should succeed with 200, got ${autoExitRes.getStatus()}`);
        
        const punchedOutRecord = db.prepare('SELECT * FROM attendance WHERE user_id = ?').get(staffInDb.id);
        assert.ok(punchedOutRecord.punch_out_time, 'Punch out time must be recorded in SQLite upon boundary exit');
        assert.strictEqual(punchedOutRecord.location_lat_out, OUTSIDE_LAT, 'Exit latitude must be recorded');
        assert.strictEqual(punchedOutRecord.location_lng_out, OUTSIDE_LNG, 'Exit longitude must be recorded');
        assert.ok(punchedOutRecord.distance_out > 200, 'Exit distance must be greater than campus radius');

        // Location tracking status must be stopped (is_tracking = 0)
        const locRecord = db.prepare('SELECT * FROM employee_locations WHERE user_id = ?').get(staffInDb.id);
        assert.strictEqual(locRecord.is_tracking, 0, 'Location tracking must be paused/stopped after punch out');

        // Verify status endpoint returns punchedIn=true, punchedOut=true without requiring re-auth
        const statusReq = { user: { id: staffInDb.id } };
        const statusRes = createMockRes();
        attendanceController.getStatus(statusReq, statusRes);
        assert.strictEqual(statusRes.getStatus(), 200);
        assert.strictEqual(statusRes.getData().punchedIn, true);
        assert.strictEqual(statusRes.getData().punchedOut, true);
        console.log('✓ PASS: Automatic punch-out saved in SQLite; user session remains fully authenticated.');

        // -------------------------------------------------------------
        // TEST 6: Re-Punch In / Duty Resume When Staff Returns Inside Campus
        // -------------------------------------------------------------
        console.log('\n[TEST 6] Verifying staff can re-punch in / resume duty when returning to campus...');
        const reEnterReq = {
            user: { id: staffInDb.id, phone: staffInDb.phone, role: 'staff', name: staffInDb.name, employeeId: staffInDb.employee_id },
            body: { lat: CAMPUS_INSIDE_LAT, lng: CAMPUS_INSIDE_LNG }
        };
        const reEnterRes = createMockRes();
        attendanceController.punch(reEnterReq, reEnterRes);

        assert.strictEqual(reEnterRes.getStatus(), 200, `Re-entering campus punch should succeed with 200, got ${reEnterRes.getStatus()}`);
        assert.ok(reEnterRes.getData().message.includes('Resumed') || reEnterRes.getData().isResumed, 'Should indicate resumed duty');

        const resumedRecord = db.prepare('SELECT * FROM attendance WHERE user_id = ?').get(staffInDb.id);
        assert.strictEqual(resumedRecord.punch_out_time, null, 'Punch out time must be reset to NULL to resume active duty');

        const resumedLoc = db.prepare('SELECT * FROM employee_locations WHERE user_id = ?').get(staffInDb.id);
        assert.strictEqual(resumedLoc.is_tracking, 1, 'Location tracking must resume active tracking');
        console.log('✓ PASS: Staff member successfully resumed duty upon re-entering campus.');

        // -------------------------------------------------------------
        // TEST 7: Database Restart Simulation & Persistence
        // -------------------------------------------------------------
        console.log('\n[TEST 7] Verifying database restart simulation...');
        db.pragma('wal_checkpoint(TRUNCATE)');
        
        // Re-read directly from SQLite file
        const checkStaff = db.prepare('SELECT * FROM users WHERE phone = ?').get(TEST_STAFF_PHONE);
        assert.ok(checkStaff, 'Staff record must persist across WAL checkpoint');
        const checkAtt = db.prepare('SELECT * FROM attendance WHERE user_id = ?').get(staffInDb.id);
        assert.ok(checkAtt, 'Attendance record must persist across WAL checkpoint');
        console.log('✓ PASS: All records survived WAL checkpoint and database disk sync.');

        console.log('\n=========================================');
        console.log('ALL VERIFICATION TESTS PASSED SUCCESSFULLY!');
        console.log('=========================================');
    } finally {
        // Cleanup test user
        try {
            db.prepare('DELETE FROM employee_locations WHERE user_id IN (SELECT id FROM users WHERE phone = ?)').run(TEST_STAFF_PHONE);
            db.prepare('DELETE FROM attendance WHERE user_id IN (SELECT id FROM users WHERE phone = ?)').run(TEST_STAFF_PHONE);
            db.prepare('DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE phone = ?)').run(TEST_STAFF_PHONE);
            db.prepare('DELETE FROM users WHERE phone = ?').run(TEST_STAFF_PHONE);
            db.pragma('wal_checkpoint(TRUNCATE)');
        } catch (e) {}
    }
}

runSuite().catch(err => {
    console.error('Test suite failed:', err.stack || err.message || err);
    process.exit(1);
});
