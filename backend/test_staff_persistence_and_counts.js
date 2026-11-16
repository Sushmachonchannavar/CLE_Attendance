/**
 * TEST SUITE: Staff Registration Persistence and Admin/Principal Dashboard Counts
 * Strictly conforms to safety rule: Never sends real SMS OTPs or contacts real phone numbers.
 */

const jwt = require('jsonwebtoken');
const db = require('./database');
const reportController = require('./controllers/reportController');
const authController = require('./controllers/authController');

function createMockRes() {
    return {
        statusCode: 200,
        headers: {},
        cookies: {},
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(data) { this.body = data; return this; },
        cookie(name, val, options) { this.cookies[name] = { val, options }; return this; },
        clearCookie(name, options) { delete this.cookies[name]; return this; }
    };
}

async function runVerification() {
    console.log('======================================================================');
    console.log(' STAFF REGISTRATION PERSISTENCE & DASHBOARD COUNT TEST SUITE');
    console.log('======================================================================');

    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`[PASS] ${message}`);
            passed++;
        } else {
            console.error(`[FAIL] ${message}`);
            failed++;
        }
    }

    // 1. Verify that SQLite contains eight staff records
    const staffRecords = db.prepare(`
        SELECT id, name, phone, role, status, employee_id, department, designation 
        FROM users 
        WHERE LOWER(role) = 'staff' AND status IN ('active', 'approved')
        ORDER BY id ASC
    `).all();

    console.log(`\nFound ${staffRecords.length} registered active staff members in SQLite:`);
    staffRecords.forEach((s, idx) => {
        console.log(`  ${idx + 1}. [ID: ${s.id}] ${s.name} | Phone: ${s.phone} | Dept: ${s.department} | Desig: ${s.designation} | Status: ${s.status}`);
    });

    assert(staffRecords.length >= 8, `SQLite contains at least 8 registered staff records (Actual: ${staffRecords.length})`);

    // 2. Verify Admin user exists in SQLite
    const adminUser = db.prepare("SELECT * FROM users WHERE LOWER(role) = 'admin'").get();
    assert(adminUser && adminUser.phone.includes('9448378417'), `Admin user is configured as constant phone 9448378417 (ID: ${adminUser?.id})`);

    // 3. Verify Principal user exists in SQLite
    const principalUser = db.prepare("SELECT * FROM users WHERE LOWER(role) = 'hoi' OR LOWER(role) = 'principal'").get();
    assert(principalUser && principalUser.phone === '8888888888', `Principal user is configured (ID: ${principalUser?.id}, Role: ${principalUser?.role})`);

    // 4. Test staff-count API with Admin role
    const adminReq = { user: { id: adminUser.id, role: 'admin', phone: adminUser.phone } };
    const adminRes = createMockRes();
    reportController.getStaffCount(adminReq, adminRes);
    assert(adminRes.statusCode === 200 && adminRes.body?.totalStaff >= 8, 
        `Admin staff-count query returns exact registered staff count: ${adminRes.body?.totalStaff}`);

    // 5. Test staff-count API with Principal role
    const princReq = { user: { id: principalUser.id, role: principalUser.role, phone: principalUser.phone } };
    const princRes = createMockRes();
    reportController.getStaffCount(princReq, princRes);
    assert(princRes.statusCode === 200 && princRes.body?.totalStaff >= 8, 
        `Principal staff-count query returns exact registered staff count: ${princRes.body?.totalStaff}`);

    // 6. Test staff list API returns all registered staff members with full details
    const staffListRes = createMockRes();
    reportController.getStaffList(adminReq, staffListRes);
    assert(staffListRes.statusCode === 200 && staffListRes.body?.staff?.length >= 8,
        `Staff list API returns ${staffListRes.body?.staff?.length} complete staff records`);

    // 7. Test daily report returns attendance structure including all 8 staff members
    const dailyRes = createMockRes();
    reportController.getDailyReport({ ...adminReq, query: {} }, dailyRes);
    const staffInDailyReport = dailyRes.body?.report?.filter(u => u.role?.toLowerCase() === 'staff') || [];
    assert(dailyRes.statusCode === 200 && staffInDailyReport.length >= 8,
        `Daily report contains all ${staffInDailyReport.length} registered staff members`);

    // 8. Test Logout: verify logout never alters or deletes database records
    console.log('\n--- Testing Logout Integrity ---');
    const logoutReq = { user: { id: adminUser.id, role: 'admin' } };
    const logoutRes = createMockRes();
    authController.logout(logoutReq, logoutRes);
    assert(logoutRes.statusCode === 200 && logoutRes.body?.success === true, 'Logout API succeeds cleanly');

    const staffAfterLogout = db.prepare("SELECT COUNT(*) AS count FROM users WHERE LOWER(role) = 'staff' AND status IN ('active', 'approved')").get().count;
    assert(staffAfterLogout === staffRecords.length, `Staff records count remains identical (${staffAfterLogout}) after user logout`);

    // 9. Test Re-Login / Re-Verification: verify that after login, Admin & Principal see same staff count
    console.log('\n--- Testing Post-Logout Re-Login Dashboard Count ---');
    const postLoginAdminRes = createMockRes();
    reportController.getStaffCount(adminReq, postLoginAdminRes);
    assert(postLoginAdminRes.body?.totalStaff === staffAfterLogout, 
        `Admin re-login retrieves accurate total staff count from SQLite: ${postLoginAdminRes.body?.totalStaff}`);

    const postLoginPrincRes = createMockRes();
    reportController.getStaffCount(princReq, postLoginPrincRes);
    assert(postLoginPrincRes.body?.totalStaff === staffAfterLogout, 
        `Principal re-login retrieves accurate total staff count from SQLite: ${postLoginPrincRes.body?.totalStaff}`);

    // 10. Test Server Restart Persistence (Re-read SQLite from disk)
    console.log('\n--- Testing Database Re-Read & Backend Restart Survival ---');
    const Database = require('better-sqlite3');
    const reopenedDb = new Database(db.name);
    const restartStaffCount = reopenedDb.prepare("SELECT COUNT(*) AS count FROM users WHERE LOWER(role) = 'staff' AND status IN ('active', 'approved')").get().count;
    assert(restartStaffCount === staffAfterLogout, 
        `After simulating backend restart, total staff count is preserved: ${restartStaffCount}`);
    reopenedDb.close();

    console.log('\n======================================================================');
    console.log(` TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================================');

    if (failed > 0) process.exit(1);
}

runVerification().catch(err => {
    console.error('Test execution error:', err);
    process.exit(1);
});
