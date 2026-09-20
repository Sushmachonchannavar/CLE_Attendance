// Comprehensive Integration Test for Priority 1 Reliability & Integrity Remediation
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'a_very_secure_and_long_jwt_secret_for_testing_purposes_only_1234567890';
process.env.CAMPUS_LAT = '16.426026';
process.env.CAMPUS_LNG = '74.589353';

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const jwt = require('jsonwebtoken');

// Ensure clean test database
const testDbPath = path.resolve(__dirname, 'database.test.sqlite');
if (fs.existsSync(testDbPath)) {
    try { fs.unlinkSync(testDbPath); } catch (e) {}
}

const db = require('./database');
const app = require('./server');
const { performBackup } = require('./utils/backup');

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  [PASS] ${message}`);
        passed++;
    } else {
        console.error(`  [FAIL] ${message}`);
        failed++;
    }
}

async function runTests() {
    console.log('\n======================================================');
    console.log('--- PRIORITY 1: INTEGRITY & RELIABILITY TEST SUITE ---');
    console.log('======================================================\n');

    try {
        // Setup Test Users
        console.log('1. Database Schema & Migration Verification');
        const migrations = db.prepare('SELECT version, name FROM schema_migrations ORDER BY version').all();
        assert(migrations.length >= 4, `Schema migrations recorded (${migrations.length} applied)`);
        assert(migrations.some(m => m.version === '001'), 'Migration 001 applied');
        assert(migrations.some(m => m.version === '002'), 'Migration 002 (unique attendance & indexes) applied');
        assert(migrations.some(m => m.version === '003'), 'Migration 003 (approval audit trail) applied');
        assert(migrations.some(m => m.version === '004'), 'Migration 004 (auth lockout & UTC timestamps) applied');

        const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map(i => i.name);
        assert(indexes.includes('idx_attendance_user_date'), 'Unique index idx_attendance_user_date exists');
        assert(indexes.includes('idx_leaves_dates'), 'Index idx_leaves_dates exists');
        assert(indexes.includes('idx_auth_lockouts_identifier'), 'Index idx_auth_lockouts_identifier exists');

        // Create Seed Users
        const staffRes = db.prepare(`
            INSERT INTO users (phone, name, role, employee_id, status)
            VALUES ('+919876543210', 'Test Staff Member', 'staff', 'EMP-TEST-001', 'active')
        `).run();
        const staffId = staffRes.lastInsertRowid;

        const principalRes = db.prepare(`
            INSERT INTO users (phone, name, role, employee_id, status)
            VALUES ('+919876543211', 'Test Principal', 'principal', 'EMP-TEST-002', 'active')
        `).run();
        const principalId = principalRes.lastInsertRowid;

        const adminRes = db.prepare(`
            INSERT INTO users (phone, name, role, employee_id, status)
            VALUES ('+919876543212', 'Test Administrator', 'admin', 'EMP-TEST-003', 'active')
        `).run();
        const adminId = adminRes.lastInsertRowid;

        const staffToken = jwt.sign({ id: staffId, role: 'staff', employeeId: 'EMP-TEST-001' }, process.env.JWT_SECRET);
        const principalToken = jwt.sign({ id: principalId, role: 'principal', employeeId: 'EMP-TEST-002' }, process.env.JWT_SECRET);
        const adminToken = jwt.sign({ id: adminId, role: 'admin', employeeId: 'EMP-TEST-003' }, process.env.JWT_SECRET);

        console.log('\n2. Unique Attendance Constraint Test');
        // First punch
        const punch1 = await request(app)
            .post('/api/attendance/punch')
            .set('Authorization', `Bearer ${staffToken}`)
            .send({ lat: 16.426026, lng: 74.589353 });
        assert(punch1.status === 200, `First punch-in succeeded: ${punch1.body.message}`);

        // Try direct SQL duplicate insertion to verify unique constraint at DB level
        let duplicateCaught = false;
        try {
            const today = new Date().toISOString().split('T')[0];
            db.prepare(`
                INSERT INTO attendance (user_id, date, punch_in_time, location_lat, location_lng, status)
                VALUES (?, ?, '10:00:00 AM', 16.426, 74.589, 'present')
            `).run(staffId, today);
        } catch (err) {
            if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.message.includes('UNIQUE constraint failed')) {
                duplicateCaught = true;
            }
        }
        assert(duplicateCaught, 'DB rejected duplicate (user_id, date) record with SQLITE_CONSTRAINT_UNIQUE');

        // Check UTC timestamp storage
        const attRecord = db.prepare('SELECT punch_in_utc, punch_in_time FROM attendance WHERE user_id = ?').get(staffId);
        assert(!!attRecord.punch_in_utc && attRecord.punch_in_utc.endsWith('Z'), `Stored ISO UTC punch timestamp: ${attRecord.punch_in_utc}`);

        // Punch out and verify punch_out_utc
        const punchOut = await request(app)
            .post('/api/attendance/punch')
            .set('Authorization', `Bearer ${staffToken}`)
            .send({ lat: 16.426026, lng: 74.589353 });
        assert(punchOut.status === 200, 'Punched out successfully');
        const attRecordOut = db.prepare('SELECT punch_out_utc FROM attendance WHERE user_id = ?').get(staffId);
        assert(!!attRecordOut.punch_out_utc && attRecordOut.punch_out_utc.endsWith('Z'), `Stored ISO UTC punch-out timestamp: ${attRecordOut.punch_out_utc}`);

        console.log('\n3. Leave Date Validation & Overlapping Rejection');
        // Invalid calendar date
        const invalidDateLeave = await request(app)
            .post('/api/requests/leaves')
            .set('Authorization', `Bearer ${staffToken}`)
            .send({ type: 'Casual', start_date: '2026-02-31', end_date: '2026-03-05', reason: 'Vacation' });
        assert(invalidDateLeave.status === 400, 'Rejected non-existent calendar date (2026-02-31)');

        // Start date after end date
        const invertedDateLeave = await request(app)
            .post('/api/requests/leaves')
            .set('Authorization', `Bearer ${staffToken}`)
            .send({ type: 'Casual', start_date: '2026-04-10', end_date: '2026-04-05', reason: 'Vacation' });
        assert(invertedDateLeave.status === 400, 'Rejected inverted date range (start_date > end_date)');

        // Valid leave (future dates)
        const dNow = new Date();
        const dStart = new Date(dNow.getTime() + 5 * 86400000).toISOString().split('T')[0];
        const dEnd = new Date(dNow.getTime() + 10 * 86400000).toISOString().split('T')[0];
        const dOverlapStart = new Date(dNow.getTime() + 7 * 86400000).toISOString().split('T')[0];
        const dOverlapEnd = new Date(dNow.getTime() + 9 * 86400000).toISOString().split('T')[0];

        const validLeave = await request(app)
            .post('/api/requests/leaves')
            .set('Authorization', `Bearer ${staffToken}`)
            .send({ type: 'Casual', start_date: dStart, end_date: dEnd, reason: 'Family function' });
        assert(validLeave.status === 200, `Valid leave created with ID: ${validLeave.body.id}`);
        const leaveId = validLeave.body.id;

        // Overlapping leave (subset)
        const overlapLeave = await request(app)
            .post('/api/requests/leaves')
            .set('Authorization', `Bearer ${staffToken}`)
            .send({ type: 'Sick', start_date: dOverlapStart, end_date: dOverlapEnd, reason: 'Medical' });
        assert(overlapLeave.status === 400, `Rejected overlapping leave: "${overlapLeave.body.error}"`);

        console.log('\n4. Approval Audit Trail & History');
        // Principal approves staff leave with reason
        const approveLeave = await request(app)
            .put(`/api/requests/leaves/${leaveId}`)
            .set('Authorization', `Bearer ${principalToken}`)
            .send({ status: 'approved', reason: 'Approved on compassionate grounds' });
        assert(approveLeave.status === 200, 'Leave approved by Principal with reason');

        // Verify audit columns updated in database
        const updatedLeave = db.prepare('SELECT reviewed_by, decision_time, decision_reason, status FROM leaves WHERE id = ?').get(leaveId);
        assert(updatedLeave.reviewed_by === principalId, `Reviewer ID set correctly: ${updatedLeave.reviewed_by}`);
        assert(updatedLeave.status === 'approved', 'Status set to approved');
        assert(updatedLeave.decision_reason === 'Approved on compassionate grounds', `Decision reason stored: ${updatedLeave.decision_reason}`);
        assert(!!updatedLeave.decision_time, `Decision timestamp stored: ${updatedLeave.decision_time}`);

        // Verify approval_audit_logs table entry
        const auditLogs = db.prepare('SELECT * FROM approval_audit_logs WHERE request_type = ? AND request_id = ?').all('leave', leaveId);
        assert(auditLogs.length === 1, `Audit log entry created (count: ${auditLogs.length})`);
        assert(auditLogs[0].reviewer_id === principalId, 'Audit log reviewer_id matches');
        assert(auditLogs[0].previous_status === 'pending', 'Audit log previous_status recorded');
        assert(auditLogs[0].new_status === 'approved', 'Audit log new_status recorded');

        // Query audit history endpoint
        const auditHistoryRes = await request(app)
            .get(`/api/requests/audit-history/leave/${leaveId}`)
            .set('Authorization', `Bearer ${staffToken}`);
        assert(auditHistoryRes.status === 200, 'Staff successfully fetched audit history');
        assert(auditHistoryRes.body[0].reviewer_name === 'Test Principal', `Audit history contains reviewer name: ${auditHistoryRes.body[0].reviewer_name}`);

        console.log('\n5. Rate Limiting & 5-Attempt Lockout Protection');
        // Request OTP for new test user
        const lockoutUserPhone = '+919999988888';
        const lockoutEmpId = 'EMP-LOCKOUT-01';
        db.prepare(`
            INSERT INTO users (phone, name, role, employee_id, status)
            VALUES (?, 'Lockout User', 'staff', ?, 'active')
        `).run(lockoutUserPhone, lockoutEmpId);

        const otpGen = await request(app)
            .post('/api/attendance/send-otp')
            .send({ employeeId: lockoutEmpId });
        assert(otpGen.status === 200, 'OTP generated successfully');

        // Submit 4 wrong attempts
        for (let i = 1; i <= 4; i++) {
            const wrongRes = await request(app)
                .post('/api/attendance/verify-otp')
                .send({ employeeId: lockoutEmpId, otp: '000000' });
            assert(wrongRes.status === 400, `Attempt ${i} rejected with 400 (${wrongRes.body.error})`);
        }

        // 5th wrong attempt triggers lockout
        const fifthAttempt = await request(app)
            .post('/api/attendance/verify-otp')
            .send({ employeeId: lockoutEmpId, otp: '000000' });
        assert(fifthAttempt.status === 423, `5th attempt locked account with 423 (${fifthAttempt.body.error})`);

        // Subsequent OTP request should be blocked immediately due to lockout
        const blockedOtpReq = await request(app)
            .post('/api/attendance/send-otp')
            .send({ employeeId: lockoutEmpId });
        assert(blockedOtpReq.status === 423, `Subsequent OTP request blocked with 423: "${blockedOtpReq.body.error}"`);

        console.log('\n6. Automated Online SQLite Backup');
        const backupPath = path.resolve(__dirname, 'backups/test_backup_suite.sqlite');
        if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);

        const createdBackup = await performBackup(backupPath);
        assert(fs.existsSync(createdBackup), `Backup file created at: ${createdBackup}`);
        const stats = fs.statSync(createdBackup);
        assert(stats.size > 0, `Backup file has valid non-zero size (${stats.size} bytes)`);

        console.log('\n======================================================');
        console.log(`TOTAL PASSED: ${passed}`);
        console.log(`TOTAL FAILED: ${failed}`);
        console.log('======================================================\n');

        if (failed > 0) {
            process.exit(1);
        } else {
            process.exit(0);
        }

    } catch (err) {
        console.error('Fatal error during test run:', err);
        process.exit(1);
    }
}

runTests();
