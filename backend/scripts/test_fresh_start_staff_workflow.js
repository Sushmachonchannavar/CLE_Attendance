const path = require('path');
const Database = require('better-sqlite3');
const authController = require('../controllers/authController');
const reportController = require('../controllers/reportController');
const { runMigrations } = require('../migrations/runner');

async function runTests() {
    console.log('=== TEST SUITE: FRESH START STAFF REGISTRATION & PERSISTENCE ===\n');

    let db = require('../database');

    // 1. Initially after reset, Total Staff must show 0
    console.log('[TEST 1] Verifying initial Total Staff count after reset...');
    const initialStaff = db.prepare("SELECT COUNT(*) AS count FROM users WHERE LOWER(role) = 'staff' AND status IN ('active', 'approved')").get().count;
    console.log(`Initial Total Staff count: ${initialStaff}`);
    if (initialStaff !== 0) {
        throw new Error(`Expected initial staff count 0, got ${initialStaff}`);
    }
    console.log('✅ TEST 1 PASSED: Initial Total Staff is 0.\n');

    // Verify Admin and Principal accounts
    console.log('[TEST 2] Verifying Admin and Principal accounts are preserved...');
    const admin = db.prepare("SELECT id, name, phone, role, status FROM users WHERE phone LIKE '%9448378417%'").get();
    const principal = db.prepare("SELECT id, name, phone, role, status FROM users WHERE phone LIKE '%8888888888%'").get();
    
    if (!admin || admin.role !== 'admin' || admin.status !== 'active') {
        throw new Error(`Admin account invalid: ${JSON.stringify(admin)}`);
    }
    if (!principal || principal.role !== 'hoi' || principal.status !== 'active') {
        throw new Error(`Principal account invalid: ${JSON.stringify(principal)}`);
    }
    console.log(`Admin account verified: ${admin.name} (${admin.phone}, role: ${admin.role})`);
    console.log(`Principal account verified: ${principal.name} (${principal.phone}, role: ${principal.role})`);
    console.log('✅ TEST 2 PASSED: Admin and Principal accounts intact.\n');

    // Helper for mock req/res
    function mockReqRes(body) {
        let resData = null;
        let resStatus = 200;
        const req = { body };
        const res = {
            status: (code) => {
                resStatus = code;
                return res;
            },
            json: (data) => {
                resData = data;
                return res;
            }
        };
        return { req, res, getResult: () => ({ status: resStatus, data: resData }) };
    }

    // 3. Register 1st new staff member
    console.log('[TEST 3] Registering 1st new staff member (Ramesh Kumar - 9876500001)...');
    const staff1Helper = mockReqRes({
        firstName: 'Ramesh',
        lastName: 'Kumar',
        mobile: '9876500001',
        collegeName: 'CLE Society Degree Chikodi',
        departmentName: 'Physics',
        designation: 'Assistant Professor',
        employeeId: 'EMP-9876500001'
    });
    authController.register(staff1Helper.req, staff1Helper.res);
    const staff1Result = staff1Helper.getResult();
    console.log('Staff 1 registration result:', staff1Result);
    if (staff1Result.status !== 201 || !staff1Result.data.success) {
        throw new Error(`Staff 1 registration failed: ${JSON.stringify(staff1Result)}`);
    }

    const countAfter1 = db.prepare("SELECT COUNT(*) AS count FROM users WHERE LOWER(role) = 'staff' AND status IN ('active', 'approved')").get().count;
    console.log(`Total Staff after 1st registration: ${countAfter1}`);
    if (countAfter1 !== 1) {
        throw new Error(`Expected Total Staff 1, got ${countAfter1}`);
    }
    console.log('✅ TEST 3 PASSED: Total Staff dynamically incremented to 1.\n');

    // 4. Register 2nd new staff member
    console.log('[TEST 4] Registering 2nd new staff member (Pooja Sharma - 9876500002)...');
    const staff2Helper = mockReqRes({
        firstName: 'Pooja',
        lastName: 'Sharma',
        mobile: '9876500002',
        collegeName: 'CLE Society Degree Chikodi',
        departmentName: 'Chemistry',
        designation: 'Lecturer',
        employeeId: 'EMP-9876500002'
    });
    authController.register(staff2Helper.req, staff2Helper.res);
    const staff2Result = staff2Helper.getResult();
    console.log('Staff 2 registration result:', staff2Result);
    if (staff2Result.status !== 201 || !staff2Result.data.success) {
        throw new Error(`Staff 2 registration failed: ${JSON.stringify(staff2Result)}`);
    }

    const countAfter2 = db.prepare("SELECT COUNT(*) AS count FROM users WHERE LOWER(role) = 'staff' AND status IN ('active', 'approved')").get().count;
    console.log(`Total Staff after 2nd registration: ${countAfter2}`);
    if (countAfter2 !== 2) {
        throw new Error(`Expected Total Staff 2, got ${countAfter2}`);
    }
    console.log('✅ TEST 4 PASSED: Total Staff dynamically incremented to 2.\n');

    // 5. Test getStaffCount and getStaffList controller endpoints
    console.log('[TEST 5] Testing /api/reports/staff-count and /api/reports/staff APIs...');
    const countApiHelper = mockReqRes({});
    reportController.getStaffCount(countApiHelper.req, countApiHelper.res);
    const countApiRes = countApiHelper.getResult();
    console.log('getStaffCount API response:', countApiRes.data);
    if (countApiRes.data.totalStaff !== 2) {
        throw new Error(`Expected totalStaff 2 in API, got ${countApiRes.data.totalStaff}`);
    }

    const listApiHelper = mockReqRes({});
    reportController.getStaffList(listApiHelper.req, listApiHelper.res);
    const listApiRes = listApiHelper.getResult();
    console.log(`getStaffList API returned ${listApiRes.data.staff.length} staff records.`);
    console.table(listApiRes.data.staff.map(s => ({
        id: s.id,
        name: s.name,
        phone: s.phone,
        department: s.department,
        designation: s.designation,
        employee_id: s.employee_id,
        created_at: s.created_at
    })));
    if (listApiRes.data.staff.length !== 2) {
        throw new Error(`Expected 2 staff in list API, got ${listApiRes.data.staff.length}`);
    }
    console.log('✅ TEST 5 PASSED: Both APIs return 2 registered staff members with registration history.\n');

    // 6. Test logout simulation
    console.log('[TEST 6] Testing logout simulation...');
    let clearCookieName = null;
    const logoutRes = {
        clearCookie: (name) => { clearCookieName = name; },
        json: (d) => d,
        status: () => logoutRes
    };
    authController.logout({}, logoutRes);
    console.log(`Logout cleared cookie: ${clearCookieName}`);

    // Verify staff records remain untouched after logout
    const countAfterLogout = db.prepare("SELECT COUNT(*) AS count FROM users WHERE LOWER(role) = 'staff' AND status IN ('active', 'approved')").get().count;
    console.log(`Total Staff after logout: ${countAfterLogout}`);
    if (countAfterLogout !== 2) {
        throw new Error(`Expected Total Staff 2 after logout, got ${countAfterLogout}`);
    }
    console.log('✅ TEST 6 PASSED: Logging out does NOT delete staff records.\n');

    // 7. Test Backend Restart Simulation
    console.log('[TEST 7] Testing backend restart simulation...');
    // Checkpoint WAL and close connection
    db.pragma('wal_checkpoint(TRUNCATE)');
    const dbPath = path.resolve(__dirname, '../database.sqlite');
    db.close();
    console.log('SQLite database connection closed cleanly.');

    // Reopen fresh connection from disk
    const reopenedDb = new Database(dbPath);
    reopenedDb.pragma('foreign_keys = ON');
    
    // Run migrations runner as server does on startup
    runMigrations(reopenedDb);

    const countAfterRestart = reopenedDb.prepare("SELECT COUNT(*) AS count FROM users WHERE LOWER(role) = 'staff' AND status IN ('active', 'approved')").get().count;
    console.log(`Total Staff after backend restart simulation: ${countAfterRestart}`);
    if (countAfterRestart !== 2) {
        throw new Error(`Expected Total Staff 2 after backend restart, got ${countAfterRestart}`);
    }

    const adminAfterRestart = reopenedDb.prepare("SELECT phone, role FROM users WHERE phone LIKE '%9448378417%'").get();
    const principalAfterRestart = reopenedDb.prepare("SELECT phone, role FROM users WHERE phone LIKE '%8888888888%'").get();
    console.log(`Admin after restart: ${JSON.stringify(adminAfterRestart)}`);
    console.log(`Principal after restart: ${JSON.stringify(principalAfterRestart)}`);
    if (!adminAfterRestart || !principalAfterRestart) {
        throw new Error('Admin or Principal missing after restart!');
    }
    console.log('✅ TEST 7 PASSED: Total Staff count (2) and Admin/Principal persist across backend restarts.\n');

    // 8. Clean up test users to restore fresh start state (0 staff)
    console.log('[TEST 8] Restoring pristine fresh-start state (0 staff) for production usage...');
    reopenedDb.prepare("DELETE FROM users WHERE phone IN ('9876500001', '9876500002')").run();
    reopenedDb.pragma('wal_checkpoint(TRUNCATE)');
    const finalCleanCount = reopenedDb.prepare("SELECT COUNT(*) AS count FROM users WHERE LOWER(role) = 'staff' AND status IN ('active', 'approved')").get().count;
    console.log(`Final Total Staff count for fresh start: ${finalCleanCount}`);
    if (finalCleanCount !== 0) {
        throw new Error(`Expected 0 staff after test cleanup, got ${finalCleanCount}`);
    }
    reopenedDb.close();
    console.log('✅ TEST 8 PASSED: Database restored to pristine clean state (0 registered staff).\n');

    console.log('====================================================');
    console.log('🎉 ALL 8 TESTS PASSED SUCCESSFULLY! FULL SPEC MET.');
    console.log('====================================================');
}

runTests().catch(err => {
    console.error('❌ TEST FAILED:', err.message || err);
    process.exit(1);
});
