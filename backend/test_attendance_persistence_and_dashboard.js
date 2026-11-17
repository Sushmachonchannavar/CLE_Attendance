const assert = require('assert');
const path = require('path');
const Database = require('better-sqlite3');

// Ensure test environment JWT secret
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_must_be_minimum_32_characters_long!';
process.env.DEMO_LOGIN_ENABLED = 'true';
process.env.DEMO_PRINCIPAL_PHONE = '8888888888';
process.env.DEMO_OTP = '123456';

let db = require('./database');
const authController = require('./controllers/authController');
const reportController = require('./controllers/reportController');
const attendanceController = require('./controllers/attendanceController');
const { getKolkataDate, getKolkataTimeString } = require('./utils/time');
const { runMigrations } = require('./migrations/runner');

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

async function runAttendancePersistenceTestSuite() {
    console.log('='.repeat(78));
    console.log(' ATTENDANCE PERSISTENCE, DATE-WISE RETRIEVAL & PRINCIPAL DASHBOARD AUDIT');
    console.log('='.repeat(78));

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

    const testStaffPhone = '9876543999';
    const testStaffPhone2 = '9876543998';
    const principalPhone = '8888888888';

    // Verify Principal account is present
    const principalUser = db.prepare("SELECT * FROM users WHERE phone LIKE '%8888888888%'").get();
    assert(principalUser, 'Principal user (8888888888) must exist in database.');
    console.log(`Verified Principal: ${principalUser.name} (${principalUser.phone}, role: ${principalUser.role})`);

    // Clean up any lingering test staff from prior aborted runs
    db.prepare("DELETE FROM attendance WHERE user_id IN (SELECT id FROM users WHERE phone IN (?, ?))").run(testStaffPhone, testStaffPhone2);
    db.prepare("DELETE FROM users WHERE phone IN (?, ?)").run(testStaffPhone, testStaffPhone2);
    db.pragma('wal_checkpoint(TRUNCATE)');

    const todayDate = getKolkataDate(new Date());
    // Compute yesterday's date in YYYY-MM-DD
    const yesterdayObj = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yesterdayDate = getKolkataDate(yesterdayObj);

    console.log(`Audit Dates -> Today (Kolkata): ${todayDate}, Yesterday (Kolkata): ${yesterdayDate}`);

    let staffId1, staffId2;

    // -------------------------------------------------------------
    // TEST 1: Register 2 Staff Members & Verify SQLite Persistence
    // -------------------------------------------------------------
    console.log('\n--- Step 1: Register Staff Members ---');
    {
        const regRes1 = createMockRes();
        authController.register({
            body: {
                firstName: 'Anjali',
                lastName: 'Patil',
                mobile: testStaffPhone,
                collegeName: 'CLE Society Degree College',
                departmentName: 'Computer Science',
                designation: 'Assistant Professor',
                employeeId: 'EMP-9876543999'
            }
        }, regRes1);

        report('Staff 1 registered successfully', regRes1.getStatus() === 201 && regRes1.getData()?.success === true);

        const regRes2 = createMockRes();
        authController.register({
            body: {
                firstName: 'Vikas',
                lastName: 'Deshmukh',
                mobile: testStaffPhone2,
                collegeName: 'CLE Society Degree College',
                departmentName: 'Mathematics',
                designation: 'Senior Lecturer',
                employeeId: 'EMP-9876543998'
            }
        }, regRes2);

        report('Staff 2 registered successfully', regRes2.getStatus() === 201 && regRes2.getData()?.success === true);

        const user1 = db.prepare("SELECT * FROM users WHERE phone = ?").get(testStaffPhone);
        const user2 = db.prepare("SELECT * FROM users WHERE phone = ?").get(testStaffPhone2);
        report('Staff records permanently stored in SQLite', Boolean(user1 && user2));
        staffId1 = user1.id;
        staffId2 = user2.id;
    }

    // -------------------------------------------------------------
    // TEST 2: Staff 1 Punches In for Today (Saved in SQLite)
    // -------------------------------------------------------------
    console.log('\n--- Step 2: Staff 1 Punches In Today ---');
    {
        const punchTime = '09:12:00 AM';
        const punchUtc = new Date().toISOString();
        const punchRes = db.prepare(`
            INSERT INTO attendance (user_id, date, punch_in_time, punch_in_utc, location_lat, location_lng, is_late, role, status)
            VALUES (?, ?, ?, ?, ?, ?, 0, 'STAFF', 'present')
        `).run(staffId1, todayDate, punchTime, punchUtc, 16.426026, 74.589250);

        report('Staff 1 punch record inserted into SQLite', punchRes.changes === 1);

        const savedRow = db.prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ?").get(staffId1, todayDate);
        report('Attendance record matches staffId and today date in SQLite', Boolean(savedRow && savedRow.date === todayDate));
        report('Status recorded as present', savedRow?.status === 'present');
    }

    // -------------------------------------------------------------
    // TEST 3: Staff 2 Recorded as Yesterday\'s Present (Historical Log)
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Staff 2 Punched In Yesterday (Historical) ---');
    {
        const punchTimeYesterday = '09:05:00 AM';
        const punchUtcYesterday = yesterdayObj.toISOString();
        const punchRes2 = db.prepare(`
            INSERT INTO attendance (user_id, date, punch_in_time, punch_in_utc, location_lat, location_lng, is_late, role, status)
            VALUES (?, ?, ?, ?, ?, ?, 0, 'STAFF', 'present')
        `).run(staffId2, yesterdayDate, punchTimeYesterday, punchUtcYesterday, 16.426026, 74.589250);

        report('Yesterday attendance record saved in SQLite', punchRes2.changes === 1);

        const savedRowYesterday = db.prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ?").get(staffId2, yesterdayDate);
        report('Yesterday record preserved date-wise without overwriting today', Boolean(savedRowYesterday && savedRowYesterday.date === yesterdayDate));
    }

    // -------------------------------------------------------------
    // TEST 4: Principal Views Dashboard for Today
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Principal Views Dashboard (Today) ---');
    {
        const res = createMockRes();
        reportController.getDailyReport({ query: { date: todayDate } }, res);
        const data = res.getData();

        report('getDailyReport API succeeds', res.getStatus() === 200);
        report('Direct DB summary included in API response', Boolean(data.summary));
        report('Direct DB totalStaff count is accurate (at least 2 staff)', data.summary?.totalStaff >= 2);
        report('Today Present count calculated directly from SQLite is 1', data.summary?.present === 1);
        report('Today Absent count is calculated directly from SQLite', data.summary?.absent >= 1);

        const staff1Report = data.report.find(u => u.id === staffId1);
        const staff2Report = data.report.find(u => u.id === staffId2);
        report('Staff 1 reported as present today with punch-in time', staff1Report?.status === 'present' && staff1Report?.punch_in !== '-');
        report('Staff 2 reported as absent today', staff2Report?.status === 'absent');
    }

    // -------------------------------------------------------------
    // TEST 5: Principal Selects Previous Date (Yesterday)
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Principal Selects Previous Date (Yesterday) ---');
    {
        const res = createMockRes();
        reportController.getDailyReport({ query: { date: yesterdayDate } }, res);
        const data = res.getData();

        report('Historical date query succeeds', res.getStatus() === 200 && data.date === yesterdayDate);
        report('Yesterday attendance retrieved accurately (present = 1)', data.summary?.present === 1);

        const staff1Yesterday = data.report.find(u => u.id === staffId1);
        const staff2Yesterday = data.report.find(u => u.id === staffId2);
        report('Staff 2 is present on yesterday report', staff2Yesterday?.status === 'present');
        report('Staff 1 is absent on yesterday report', staff1Yesterday?.status === 'absent');
    }

    // -------------------------------------------------------------
    // TEST 6: Principal Logs Out (Must NOT Delete Attendance)
    // -------------------------------------------------------------
    console.log('\n--- Step 6: Principal Logs Out ---');
    {
        // First create a session for Principal to simulate active login
        const deviceId = 'test_principal_laptop_browser';
        const sessionRow = db.prepare(`
            INSERT INTO user_sessions (user_id, device_id, device_name, device_type, platform, browser, refresh_token_hash, expires_at, is_revoked)
            VALUES (?, ?, 'Principal Laptop', 'desktop', 'web', 'Chrome', 'dummy_hash', datetime('now', '+30 days'), 0)
        `).run(principalUser.id, deviceId);

        const logoutReq = {
            user: { id: principalUser.id, sessionId: sessionRow.lastInsertRowid, deviceId },
            headers: { 'x-device-id': deviceId },
            body: { deviceId }
        };
        const logoutRes = createMockRes();

        authController.logout(logoutReq, logoutRes);
        report('Principal logout succeeds', logoutRes.getStatus() === 200);

        // Verify SQLite database state after logout
        const attRowsToday = db.prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ?").all(staffId1, todayDate);
        const attRowsYesterday = db.prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ?").all(staffId2, yesterdayDate);
        const allStaffUsers = db.prepare("SELECT * FROM users WHERE phone IN (?, ?)").all(testStaffPhone, testStaffPhone2);

        report('Today staff attendance record remains 100% INTACT after Principal logout', attRowsToday.length === 1);
        report('Yesterday staff attendance record remains 100% INTACT after Principal logout', attRowsYesterday.length === 1);
        report('Staff user accounts completely preserved across Principal logout', allStaffUsers.length === 2);
    }

    // -------------------------------------------------------------
    // TEST 7: Principal Logs In Again & Checks Attendance
    // -------------------------------------------------------------
    console.log('\n--- Step 7: Principal Logs In Again & Re-checks Attendance ---');
    {
        // Query today's attendance again
        const resToday = createMockRes();
        reportController.getDailyReport({ query: { date: todayDate } }, resToday);
        const dataToday = resToday.getData();

        report('After fresh login, Today Present count is STILL 1', dataToday.summary?.present === 1);
        report('After fresh login, Staff 1 status is STILL present', dataToday.report.find(u => u.id === staffId1)?.status === 'present');

        // Query yesterday's attendance again
        const resYesterday = createMockRes();
        reportController.getDailyReport({ query: { date: yesterdayDate } }, resYesterday);
        const dataYesterday = resYesterday.getData();

        report('After fresh login, Yesterday Present count is STILL 1', dataYesterday.summary?.present === 1);
        report('After fresh login, Staff 2 status on yesterday is STILL present', dataYesterday.report.find(u => u.id === staffId2)?.status === 'present');
    }

    // -------------------------------------------------------------
    // TEST 8: Browser Refresh Simulation (Multiple Rapid Invocations)
    // -------------------------------------------------------------
    console.log('\n--- Step 8: Browser Refresh / Repeated Query Simulation ---');
    {
        for (let i = 1; i <= 3; i++) {
            const res = createMockRes();
            reportController.getDailyReport({ query: { date: todayDate } }, res);
            const data = res.getData();
            assert.strictEqual(data.summary?.present, 1, `Refresh iteration ${i} must preserve present count = 1`);
        }
        report('Counts remain perfectly consistent across repeated page refreshes', true);
    }

    // -------------------------------------------------------------
    // TEST 9: Backend Server Restart Simulation
    // -------------------------------------------------------------
    console.log('\n--- Step 9: Backend Server Restart Simulation ---');
    {
        // 1. Truncate WAL to write all changes to disk
        db.pragma('wal_checkpoint(TRUNCATE)');
        const dbPath = path.resolve(__dirname, 'database.sqlite');
        
        // 2. Close connection
        db.close();
        console.log('SQLite database connection closed cleanly to simulate server shutdown.');

        // 3. Re-open connection fresh from disk
        const reopenedDb = new Database(dbPath);
        reopenedDb.pragma('foreign_keys = ON');
        runMigrations(reopenedDb);
        console.log('SQLite database reconnected fresh from disk (simulating server start).');

        // 4. Verify directly in reopened SQLite
        const attToday = reopenedDb.prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ?").get(staffId1, todayDate);
        const attYesterday = reopenedDb.prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ?").get(staffId2, yesterdayDate);

        report('Staff 1 today attendance survived backend restart', Boolean(attToday && attToday.status === 'present'));
        report('Staff 2 yesterday attendance survived backend restart', Boolean(attYesterday && attYesterday.status === 'present'));

        // Restore global db reference
        db = reopenedDb;
    }

    // -------------------------------------------------------------
    // CLEANUP TEST DATA (Restoring Pristine DB State)
    // -------------------------------------------------------------
    console.log('\n--- Step 10: Pristine DB Cleanup ---');
    {
        db.prepare("DELETE FROM attendance WHERE user_id IN (?, ?)").run(staffId1, staffId2);
        db.prepare("DELETE FROM users WHERE id IN (?, ?)").run(staffId1, staffId2);
        db.prepare("DELETE FROM user_sessions WHERE device_id = 'test_principal_laptop_browser'").run();
        db.pragma('wal_checkpoint(TRUNCATE)');

        const checkAtt = db.prepare("SELECT COUNT(*) AS count FROM attendance WHERE user_id IN (?, ?)").get(staffId1, staffId2).count;
        const checkUsers = db.prepare("SELECT COUNT(*) AS count FROM users WHERE id IN (?, ?)").get(staffId1, staffId2).count;

        report('Test attendance records cleaned up safely', checkAtt === 0);
        report('Test staff users cleaned up safely', checkUsers === 0);
    }

    console.log('\n' + '='.repeat(78));
    console.log(` AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('='.repeat(78));

    if (failed > 0) {
        process.exit(1);
    }
}

runAttendancePersistenceTestSuite().catch(err => {
    console.error('Fatal error during test suite:', err.stack || err.message || err);
    process.exit(1);
});
