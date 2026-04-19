const http = require('http');
const db = require('./database');
const request = require('supertest');
const app = require('./server');

// Using supertest to mock requests to the Express app.
// Server.js should export the app, if not, we can just start it on a different port.

async function runTests() {
    console.log("--- Starting Tests ---");
    
    // 1. Database setup
    // Clean up test data
    db.prepare('DELETE FROM users WHERE phone IN (?, ?)').run('+919998887776', '+911112223334');
    
    // Create a registered user
    db.prepare('INSERT INTO users (phone, name, role) VALUES (?, ?, ?)').run('+919998887776', 'Test Registered', 'staff');
    console.log("Created test user: +919998887776");

    // Start server logic mock
    const PORT = 5002;
    const server = app.listen(PORT, async () => {
        try {
            console.log(`Server listening on port ${PORT}`);
            
            // TEST 1: Unregistered User Login
            console.log("\nTEST 1: Login with UNREGISTERED user");
            let res = await request(app).post('/auth/login').send({ phone: '+911112223334' });
            console.log(`Status: ${res.status}`);
            console.log(`Response: ${JSON.stringify(res.body)}`);
            if (res.status === 403) console.log("✅ Passed"); else console.log("❌ Failed");

            // TEST 2: Registered User Login
            console.log("\nTEST 2: Login with REGISTERED user");
            res = await request(app).post('/auth/login').send({ phone: '+919998887776' });
            console.log(`Status: ${res.status}`);
            console.log(`Response: ${JSON.stringify(res.body)}`);
            if (res.status === 200 && res.body.debug) console.log("✅ Passed"); else console.log("❌ Failed");

            // TEST 3: Verify OTP for Registered User
            console.log("\nTEST 3: Verify OTP for REGISTERED user");
            res = await request(app).post('/auth/verify').send({ phone: '+919998887776', otp: '123456' });
            console.log(`Status: ${res.status}`);
            console.log(`Response: ${JSON.stringify(res.body)}`);
            if (res.status === 200 && res.body.token) console.log("✅ Passed"); else console.log("❌ Failed");

            // TEST 4: Attendance Punch In (without GPS/geofence)
            console.log("\nTEST 4: Attendance Punch In (Outside Geofence)");
            const token = res.body.token; // from test 3
            res = await request(app)
                .post('/attendance/punch')
                .set('Authorization', `Bearer ${token}`)
                .send({ lat: 10.0, lng: 10.0 }); // Coordinates completely outside
            
            console.log(`Status: ${res.status}`);
            console.log(`Response: ${JSON.stringify(res.body)}`);
            if (res.status === 400 && res.body.error.includes("outside the campus")) console.log("✅ Passed"); else console.log("❌ Failed");

        } catch (err) {
            console.error("Test Error:", err);
        } finally {
            server.close();
            // Cleanup
            db.prepare('DELETE FROM users WHERE phone IN (?, ?)').run('+919998887776', '+911112223334');
            db.prepare('DELETE FROM attendance WHERE user_id IN (SELECT id FROM users WHERE phone = ?)').run('+919998887776');
            console.log("Cleanup complete");
            process.exit(0);
        }
    });

}

runTests();
