const request = require('supertest');
const jwt = require('jsonwebtoken');
const { spawnSync } = require('child_process');
const path = require('path');

// Load app and db
const app = require('./server');
const db = require('./database');

async function runSecurityTests() {
    console.log('\n======================================================');
    console.log('🔒 RUNNING SECURITY & ROLE AUTHORIZATION VERIFICATION');
    console.log('======================================================\n');

    let passed = 0;
    let failed = 0;

    function assertTest(name, condition, details) {
        if (condition) {
            console.log(`✅ PASS: ${name}`);
            passed++;
        } else {
            console.error(`❌ FAIL: ${name}`);
            if (details) console.error(`   Details:`, details);
            failed++;
        }
    }

    const JWT_SECRET = process.env.JWT_SECRET;

    // Tokens
    const adminToken = jwt.sign({ id: 1, role: 'admin', employeeId: 'EMP000' }, JWT_SECRET);
    const principalToken = jwt.sign({ id: 2, role: 'hoi', employeeId: 'EMP001' }, JWT_SECRET);
    const staffToken = jwt.sign({ id: 100, role: 'staff', employeeId: 'EMP100' }, JWT_SECRET);

    // --- TEST 1: Fail-fast JWT_SECRET Startup Validation ---
    console.log('\n--- Test Group 1: JWT_SECRET Startup Enforcement ---');
    const nodeExecutable = process.execPath;
    const serverPath = path.resolve(__dirname, 'server.js');

    // Run server with empty JWT_SECRET
    const emptySecretRun = spawnSync(nodeExecutable, [serverPath], {
        env: { ...process.env, JWT_SECRET: '' },
        timeout: 5000
    });
    assertTest(
        'Server aborts startup when JWT_SECRET is empty',
        emptySecretRun.status === 1,
        `Exit code: ${emptySecretRun.status}`
    );

    // Run server with insecure default JWT_SECRET
    const defaultSecretRun = spawnSync(nodeExecutable, [serverPath], {
        env: { ...process.env, JWT_SECRET: 'your_super_secret_key_change_this_in_prod' },
        timeout: 5000
    });
    assertTest(
        'Server aborts startup when JWT_SECRET matches insecure default placeholder',
        defaultSecretRun.status === 1,
        `Exit code: ${defaultSecretRun.status}`
    );

    // --- TEST 2: Mock Token & Header Spoofing Elimination ---
    console.log('\n--- Test Group 2: Mock Token & Header Spoofing Elimination ---');

    // Send mock-jwt-token
    const mockTokenRes = await request(app)
        .get('/api/requests/leaves/all')
        .set('Authorization', 'Bearer mock-jwt-token')
        .set('X-User-Role', 'admin')
        .set('X-User-Id', '1');
    assertTest(
        'Reject mock-jwt-token (returns 401)',
        mockTokenRes.status === 401,
        mockTokenRes.body
    );

    // Send spoofed headers without token
    const spoofHeadersNoToken = await request(app)
        .get('/api/requests/leaves/all')
        .set('X-User-Role', 'admin')
        .set('X-User-Id', '1');
    assertTest(
        'Reject spoofed X-User-Role headers without Bearer token (returns 401)',
        spoofHeadersNoToken.status === 401,
        spoofHeadersNoToken.body
    );

    // Send valid staff token but spoof X-User-Role: admin to access admin endpoint
    const spoofRoleWithStaffToken = await request(app)
        .get('/api/admin/employee-locations')
        .set('Authorization', `Bearer ${staffToken}`)
        .set('X-User-Role', 'admin')
        .set('X-User-Id', '1');
    assertTest(
        'Do not trust spoofed X-User-Role: admin header when token is staff role (returns 403)',
        spoofRoleWithStaffToken.status === 403,
        spoofRoleWithStaffToken.body
    );

    // --- TEST 3: Role Scope & Authorization Rules ---
    console.log('\n--- Test Group 3: Role Scoping & Authorization Rules ---');

    // 3.1 Staff cannot view all leaves
    const staffAllLeaves = await request(app)
        .get('/api/requests/leaves/all')
        .set('Authorization', `Bearer ${staffToken}`);
    assertTest(
        'Staff user cannot access /api/requests/leaves/all (returns 403)',
        staffAllLeaves.status === 403,
        staffAllLeaves.body
    );

    // 3.2 Staff cannot view all ODs
    const staffAllODs = await request(app)
        .get('/api/requests/od/all')
        .set('Authorization', `Bearer ${staffToken}`);
    assertTest(
        'Staff user cannot access /api/requests/od/all (returns 403)',
        staffAllODs.status === 403,
        staffAllODs.body
    );

    // Seed test leave requests: one for staff (user 100), one for principal (user 2)
    const futureDate = '2099-12-31';
    db.prepare('DELETE FROM leaves WHERE reason LIKE ?').run('SECURITY_TEST_%');
    
    const staffLeaveInsert = db.prepare(`
        INSERT INTO leaves (user_id, type, start_date, end_date, reason, status, role)
        VALUES (?, 'sick', ?, ?, 'SECURITY_TEST_STAFF_LEAVE', 'pending', 'STAFF')
    `).run(100, futureDate, futureDate);
    const staffLeaveId = staffLeaveInsert.lastInsertRowid;

    const principalLeaveInsert = db.prepare(`
        INSERT INTO leaves (user_id, type, start_date, end_date, reason, status, role)
        VALUES (?, 'casual', ?, ?, 'SECURITY_TEST_PRINCIPAL_LEAVE', 'pending', 'PRINCIPAL')
    `).run(2, futureDate, futureDate);
    const principalLeaveId = principalLeaveInsert.lastInsertRowid;

    // 3.3 Principal attempts to approve Principal leave (Should be Forbidden 403)
    const principalApprovesPrincipalLeave = await request(app)
        .put(`/api/requests/leaves/${principalLeaveId}`)
        .set('Authorization', `Bearer ${principalToken}`)
        .send({ status: 'approved' });
    assertTest(
        'Principal cannot approve a Principal leave application (returns 403)',
        principalApprovesPrincipalLeave.status === 403,
        principalApprovesPrincipalLeave.body
    );

    // 3.4 Principal attempts to approve Staff leave (Should be Allowed 200)
    const principalApprovesStaffLeave = await request(app)
        .put(`/api/requests/leaves/${staffLeaveId}`)
        .set('Authorization', `Bearer ${principalToken}`)
        .send({ status: 'approved' });
    assertTest(
        'Principal is authorized to approve a Staff leave application (returns 200)',
        principalApprovesStaffLeave.status === 200,
        principalApprovesStaffLeave.body
    );

    // 3.5 Admin approves Principal leave (Should be Allowed 200)
    const adminApprovesPrincipalLeave = await request(app)
        .put(`/api/requests/leaves/${principalLeaveId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'approved' });
    assertTest(
        'Admin is authorized to approve Principal leave applications (returns 200)',
        adminApprovesPrincipalLeave.status === 200,
        adminApprovesPrincipalLeave.body
    );

    // 3.6 Principal queries /leaves/all -> should NOT contain principal's own leaves
    const principalLeavesList = await request(app)
        .get('/api/requests/leaves/all')
        .set('Authorization', `Bearer ${principalToken}`);
    const principalSeenRoles = principalLeavesList.body.map(l => l.role);
    const hasOnlyStaffLeaves = principalLeavesList.body.every(l => l.role === 'STAFF' && l.user_id !== 2);
    assertTest(
        'Principal queries /leaves/all and receives only Staff records (none of their own)',
        principalLeavesList.status === 200 && hasOnlyStaffLeaves,
        { count: principalLeavesList.body.length, roles: principalSeenRoles }
    );

    // 3.7 Unauthenticated SMS route is blocked
    const unauthSms = await request(app)
        .post('/api/sms/send-otp')
        .send({ mobile: '9999999999', otp: '123456' });
    assertTest(
        'Unauthenticated access to /api/sms/send-otp is rejected (returns 401)',
        unauthSms.status === 401,
        unauthSms.body
    );

    // Cleanup test data
    db.prepare('DELETE FROM leaves WHERE reason LIKE ?').run('SECURITY_TEST_%');

    console.log('\n======================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');

    process.exit(failed > 0 ? 1 : 0);
}

runSecurityTests().catch(err => {
    console.error('Test Suite Exception:', err);
    process.exit(1);
});
