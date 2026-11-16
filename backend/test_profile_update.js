const jwt = require('jsonwebtoken');
const db = require('./database');
const authController = require('./controllers/authController');

function createMockRes() {
    return {
        statusCode: 200,
        headers: {},
        cookies: {},
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.body = data;
            return this;
        },
        cookie(name, val, options) {
            this.cookies[name] = { val, options };
            return this;
        }
    };
}

async function runTests() {
    console.log('\n--- STARTING PROFILE UPDATE & SESSION VERIFICATION TESTS ---');
    let passed = 0;
    let failed = 0;

    // 1. Ensure test user exists in database for this test
    const testPhone = '9876599999';
    db.prepare(`
        INSERT OR REPLACE INTO users (name, phone, role, college, department, designation, employee_id, status)
        VALUES ('Test User', ?, 'staff', 'CLE Society Degree Chikodi', 'Bsc', 'Faculty Member', 'EMP-9876599999', 'active')
    `).run(testPhone);
    const user = db.prepare("SELECT * FROM users WHERE phone = ?").get(testPhone);
    if (!user) {
        console.error('FAIL: Test user not found in DB');
        process.exit(1);
    }
    console.log(`[PASS] Found test user: ${user.name} (ID: ${user.id}, phone: ${user.phone})`);
    passed++;

    // 2. Test updateProfile with valid data
    const req1 = {
        user: { id: user.id, role: user.role, employeeId: user.employee_id, phone: user.phone },
        body: {
            name: 'Sushma Chonchannavar',
            college: 'CLE Society Degree Chikodi',
            department: 'Bsc Computer Science',
            designation: 'Assistant Professor'
        }
    };
    const res1 = createMockRes();

    authController.updateProfile(req1, res1);

    if (res1.statusCode === 200 && res1.body?.user && res1.body.user.department === 'Bsc Computer Science') {
        console.log('[PASS] updateProfile succeeded:', {
            name: res1.body.user.name,
            college: res1.body.user.college,
            department: res1.body.user.department,
            designation: res1.body.user.designation,
            hasRefreshedToken: Boolean(res1.body.token),
            cookieSet: Boolean(res1.cookies.token)
        });
        passed++;
    } else {
        console.error('FAIL: updateProfile failed:', res1.statusCode, res1.body);
        failed++;
    }

    // 3. Verify SQLite persistence
    const dbUserAfter = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    if (dbUserAfter.department === 'Bsc Computer Science' && dbUserAfter.designation === 'Assistant Professor') {
        console.log('[PASS] SQLite database persistence verified.');
        passed++;
    } else {
        console.error('FAIL: SQLite database not updated:', dbUserAfter);
        failed++;
    }

    // 4. Test validation: Empty full name returns 400
    const req2 = {
        user: { id: user.id, role: user.role, employeeId: user.employee_id, phone: user.phone },
        body: {
            name: '   ',
            college: 'CLE Society Degree Chikodi',
            department: 'Bsc'
        }
    };
    const res2 = createMockRes();

    authController.updateProfile(req2, res2);

    if (res2.statusCode === 400 && res2.body?.error) {
        console.log('[PASS] Empty name rejected with HTTP 400:', res2.body.error);
        passed++;
    } else {
        console.error('FAIL: Empty name validation failed:', res2.statusCode, res2.body);
        failed++;
    }

    // 5. Test fallback resolution: ID mismatch, recovered via employeeId
    const req3 = {
        user: { id: 999999, role: user.role, employeeId: user.employee_id, phone: user.phone },
        body: {
            name: 'Sushma Chonchannavar',
            college: 'CLE Society Degree Chikodi',
            department: 'Bsc',
            designation: 'Faculty Member'
        }
    };
    const res3 = createMockRes();

    authController.updateProfile(req3, res3);

    if (res3.statusCode === 200 && res3.body?.user && res3.body.user.id === user.id) {
        console.log('[PASS] Fallback by employeeId recovered user ID and updated successfully.');
        passed++;
    } else {
        console.error('FAIL: Fallback by employeeId failed:', res3.statusCode, res3.body);
        failed++;
    }

    // 6. Test fallback resolution: ID & employeeId missing/mismatched, recovered via phone
    const req4 = {
        user: { id: 888888, role: user.role, employeeId: 'NONEXISTENT', phone: user.phone },
        body: {
            name: 'Sushma Chonchannavar',
            college: 'CLE Society Degree Chikodi',
            department: 'Bsc',
            designation: 'Faculty Member'
        }
    };
    const res4 = createMockRes();

    authController.updateProfile(req4, res4);

    if (res4.statusCode === 200 && res4.body?.user && res4.body.user.id === user.id) {
        console.log('[PASS] Fallback by phone recovered user ID and updated successfully.');
        passed++;
    } else {
        console.error('FAIL: Fallback by phone failed:', res4.statusCode, res4.body);
        failed++;
    }

    // 7. Test verifyToken returns updated user and token
    const req5 = {
        user: { id: user.id, role: user.role, employeeId: user.employee_id, phone: user.phone }
    };
    const res5 = createMockRes();

    authController.verifyToken(req5, res5);

    if (res5.statusCode === 200 && res5.body?.user && res5.body?.token) {
        console.log('[PASS] verifyToken returned user and refreshed token.');
        passed++;
    } else {
        console.error('FAIL: verifyToken failed:', res5.statusCode, res5.body);
        failed++;
    }

    // Clean up test user
    db.prepare("DELETE FROM users WHERE phone = ?").run(testPhone);
    try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) {}

    console.log(`\n--- ALL TESTS COMPLETE: ${passed} passed, ${failed} failed ---`);
    if (failed > 0) process.exit(1);
}

runTests().catch(err => {
    console.error('Unexpected test error:', err);
    process.exit(1);
});
