const request = require('supertest');
const db = require('./database');
const app = require('./server');
const jwt = require('jsonwebtoken');

// Generate test JWT tokens
const adminToken = jwt.sign({ id: 1, role: 'admin' }, process.env.JWT_SECRET);
const staffToken = jwt.sign({ id: 100, role: 'staff' }, process.env.JWT_SECRET);

async function runTests() {
    console.log("--- Starting Tracking API Tests ---");
    
    // Ensure test user is punched in for today so location tracking is accepted
    const today = new Date().toISOString().split('T')[0];
    db.prepare('DELETE FROM attendance WHERE user_id = 100 AND date = ?').run(today);
    db.prepare('INSERT INTO attendance (user_id, date, punch_in_time, location_lat, location_lng, status) VALUES (?, ?, ?, ?, ?, ?)')
        .run(100, today, '9:00:00 AM', 16.426026, 74.589353, 'present');
    
    db.prepare('DELETE FROM employee_locations WHERE user_id = 100').run();

    const PORT = 5003;
    const server = app.listen(PORT, async () => {
        try {
            console.log(`Test Server listening on port ${PORT}`);

            // TEST 1: POST /api/employee/location - Successful tracking update (Inside campus)
            console.log("\nTEST 1: POST /api/employee/location - Staff token (Inside Campus)");
            let res = await request(app)
                .post('/api/employee/location')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({ lat: 16.426026, lng: 74.589353, accuracy: 10 });
            console.log(`Status: ${res.status}`);
            console.log(`Response: ${JSON.stringify(res.body)}`);
            if (res.status === 200 && res.body.success && res.body.isInsideCampus === true) console.log("✅ Passed"); else console.log("❌ Failed");

            // TEST 2: POST /api/employee/location - Successful tracking update (Outside campus)
            console.log("\nTEST 2: POST /api/employee/location - Staff token (Outside Campus)");
            res = await request(app)
                .post('/api/employee/location')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({ lat: 10.0, lng: 10.0, accuracy: 25 });
            console.log(`Status: ${res.status}`);
            console.log(`Response: ${JSON.stringify(res.body)}`);
            if (res.status === 200 && res.body.success && res.body.isInsideCampus === false) console.log("✅ Passed"); else console.log("❌ Failed");

            // TEST 3: POST /api/employee/location - No token (Unauthorized)
            console.log("\nTEST 3: POST /api/employee/location - No token");
            res = await request(app)
                .post('/api/employee/location')
                .send({ lat: 16.426026, lng: 74.589353 });
            console.log(`Status: ${res.status}`);
            console.log(`Response: ${JSON.stringify(res.body)}`);
            if (res.status === 401) console.log("✅ Passed"); else console.log("❌ Failed");

            // TEST 4: GET /api/admin/employee-locations - Admin token (Allowed)
            console.log("\nTEST 4: GET /api/admin/employee-locations - Admin token");
            res = await request(app)
                .get('/api/admin/employee-locations')
                .set('Authorization', `Bearer ${adminToken}`);
            console.log(`Status: ${res.status}`);
            console.log(`Response: ${JSON.stringify(res.body)}`);
            if (res.status === 200 && res.body.success && Array.isArray(res.body.employees)) console.log("✅ Passed"); else console.log("❌ Failed");

            // TEST 5: GET /api/admin/employee-locations - Staff token (Forbidden)
            console.log("\nTEST 5: GET /api/admin/employee-locations - Staff token");
            res = await request(app)
                .get('/api/admin/employee-locations')
                .set('Authorization', `Bearer ${staffToken}`);
            console.log(`Status: ${res.status}`);
            console.log(`Response: ${JSON.stringify(res.body)}`);
            if (res.status === 403) console.log("✅ Passed"); else console.log("❌ Failed");

            // TEST 6: GET /api/admin/employee-locations - No token (Unauthorized)
            console.log("\nTEST 6: GET /api/admin/employee-locations - No token");
            res = await request(app)
                .get('/api/admin/employee-locations');
            console.log(`Status: ${res.status}`);
            console.log(`Response: ${JSON.stringify(res.body)}`);
            if (res.status === 401) console.log("✅ Passed"); else console.log("❌ Failed");

        } catch (err) {
            console.error("Test Error:", err);
        } finally {
            server.close();
            // Cleanup
            db.prepare('DELETE FROM attendance WHERE user_id = 100 AND date = ?').run(today);
            db.prepare('DELETE FROM employee_locations WHERE user_id = 100').run();
            console.log("Cleanup complete");
            process.exit(0);
        }
    });
}

runTests();
