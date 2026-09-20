const request = require('supertest');
const db = require('./database');
const app = require('./server');
const jwt = require('jsonwebtoken');

// Generate test JWT token for Admin
const adminToken = jwt.sign({ id: 1, role: 'admin' }, process.env.JWT_SECRET);

async function runTests() {
    console.log("--- Starting Leave End-Date Approval Tests ---");

    // Clean up any stale test leaves
    db.prepare('DELETE FROM leaves WHERE reason LIKE ?').run('TEST_LEAVE_%');

    // Calculate dates
    const today = new Date();
    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const todayStr = formatDate(today);

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = formatDate(yesterday);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = formatDate(tomorrow);

    console.log('Today:', todayStr);
    console.log('Yesterday:', yesterdayStr);
    console.log('Tomorrow:', tomorrowStr);

    // Insert leaves
    // 1. Expired Leave (Yesterday)
    const res1 = db.prepare(`
        INSERT INTO leaves (user_id, type, start_date, end_date, reason, status, role)
        VALUES (100, 'casual', ?, ?, 'TEST_LEAVE_EXPIRED', 'pending', 'STAFF')
    `).run(yesterdayStr, yesterdayStr);
    const expiredId = res1.lastInsertRowid;

    // 2. Active Leave Today
    const res2 = db.prepare(`
        INSERT INTO leaves (user_id, type, start_date, end_date, reason, status, role)
        VALUES (100, 'casual', ?, ?, 'TEST_LEAVE_TODAY', 'pending', 'STAFF')
    `).run(todayStr, todayStr);
    const todayId = res2.lastInsertRowid;

    // 3. Active Leave Tomorrow
    const res3 = db.prepare(`
        INSERT INTO leaves (user_id, type, start_date, end_date, reason, status, role)
        VALUES (100, 'casual', ?, ?, 'TEST_LEAVE_TOMORROW', 'pending', 'STAFF')
    `).run(todayStr, tomorrowStr);
    const tomorrowId = res3.lastInsertRowid;

    const PORT = 5004;
    const server = app.listen(PORT, async () => {
        try {
            console.log(`Test Server listening on port ${PORT}`);

            // TEST 1: Approve Expired Leave (Should Fail)
            console.log("\nTEST 1: Approve Expired Leave (End Date = Yesterday)");
            let res = await request(app)
                .put(`/api/requests/leaves/${expiredId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'approved' });
            
            console.log(`Status: ${res.status}`);
            console.log(`Response: ${JSON.stringify(res.body)}`);
            if (res.status === 400 && res.body.error.includes("expired")) {
                console.log("✅ Passed (Successfully blocked expired leave approval)");
            } else {
                console.log("❌ Failed (Did not block expired leave approval)");
            }

            // Verify status in DB was NOT changed
            let status = db.prepare('SELECT status FROM leaves WHERE id = ?').get(expiredId).status;
            if (status === 'pending') console.log("✅ Status remains pending in DB"); else console.log("❌ Status was updated in DB!");

            // TEST 2: Approve Active Leave (End Date = Today) - Should Pass
            console.log("\nTEST 2: Approve Active Leave (End Date = Today)");
            res = await request(app)
                .put(`/api/requests/leaves/${todayId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'approved' });
            
            console.log(`Status: ${res.status}`);
            console.log(`Response: ${JSON.stringify(res.body)}`);
            if (res.status === 200 && res.body.message.includes("updated")) {
                console.log("✅ Passed (Successfully approved active today leave)");
            } else {
                console.log("❌ Failed (Failed to approve active today leave)");
            }

            // Verify status in DB was changed to approved
            status = db.prepare('SELECT status FROM leaves WHERE id = ?').get(todayId).status;
            if (status === 'approved') console.log("✅ Status updated to approved in DB"); else console.log("❌ Status remains pending in DB!");

            // TEST 3: Reject Active Leave (End Date = Tomorrow) - Should Pass
            console.log("\nTEST 3: Reject Active Leave (End Date = Tomorrow)");
            res = await request(app)
                .put(`/api/requests/leaves/${tomorrowId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'rejected' });
            
            console.log(`Status: ${res.status}`);
            console.log(`Response: ${JSON.stringify(res.body)}`);
            if (res.status === 200 && res.body.message.includes("updated")) {
                console.log("✅ Passed (Successfully rejected future tomorrow leave)");
            } else {
                console.log("❌ Failed (Failed to reject future tomorrow leave)");
            }

            // Verify status in DB was changed to rejected
            status = db.prepare('SELECT status FROM leaves WHERE id = ?').get(tomorrowId).status;
            if (status === 'rejected') console.log("✅ Status updated to rejected in DB"); else console.log("❌ Status remains pending in DB!");

        } catch (err) {
            console.error("Test error:", err);
        } finally {
            server.close();
            // Cleanup
            db.prepare('DELETE FROM leaves WHERE reason LIKE ?').run('TEST_LEAVE_%');
            console.log("Cleanup complete");
            process.exit(0);
        }
    });
}

runTests();
