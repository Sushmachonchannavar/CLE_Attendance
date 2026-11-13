/**
 * Verification Test Suite: Accurate Campus Polygon Geofence Enforcement
 * CLE Society – Staff Attendance & Location System
 */
const assert = require('assert');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.CAMPUS_LAT = '16.426026';
process.env.CAMPUS_LNG = '74.589250';
process.env.GEOFENCE_RADIUS_METERS = '140';
process.env.JWT_SECRET = 'cle_attendance_test_secret_key_minimum_32_characters_123456';

const db = require('./database');
const attendanceController = require('./controllers/attendanceController');
const { CAMPUS_GEOFENCE, isPointInPolygon } = attendanceController;

function createMockRes() {
    let statusCode = 200;
    let responseData = null;
    let cookiesSet = {};

    return {
        status: (code) => {
            statusCode = code;
            return {
                json: (data) => { responseData = data; }
            };
        },
        json: (data) => { responseData = data; },
        cookie: (name, val, opts) => { cookiesSet[name] = { val, opts }; },
        clearCookie: (name, opts) => { delete cookiesSet[name]; },
        getStatus: () => statusCode,
        getData: () => responseData,
        getCookies: () => cookiesSet
    };
}

async function runGeofenceTests() {
    console.log('='.repeat(70));
    console.log(' CLE SOCIETY CAMPUS POLYGON GEOFENCE VERIFICATION TEST SUITE');
    console.log('='.repeat(70) + '\n');

    let passed = 0;
    let failed = 0;

    // Use existing staff user 103 in database.test.sqlite
    const testStaffId = 103;
    const testUser = { id: testStaffId, role: 'staff', employeeId: 'EMP_103' };
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

    // Clean up test rows
    db.prepare('DELETE FROM attendance WHERE user_id = ?').run(testStaffId);
    db.prepare('DELETE FROM employee_locations WHERE user_id = ?').run(testStaffId);

    // 1. Polygon Mathematical Containment Tests
    console.log('--- 1. Boundary Polygon Containment Calculations ---');
    const insideLocations = [
        { name: 'Campus Centroid', lat: 16.426026, lng: 74.589250 },
        { name: 'Real DB Punch Point', lat: 16.425780, lng: 74.589700 },
        { name: 'Standard Staff Test Point', lat: 16.426026, lng: 74.589353 },
        { name: 'Northwest Interior Wing', lat: 16.426300, lng: 74.588100 },
        { name: 'Southeast Interior Wing', lat: 16.425700, lng: 74.590400 }
    ];

    for (const loc of insideLocations) {
        const isInside = isPointInPolygon(loc.lat, loc.lng, CAMPUS_GEOFENCE);
        if (isInside) {
            console.log(`  [PASS] ${loc.name.padEnd(30)}: INSIDE campus polygon`);
            passed++;
        } else {
            console.error(`  [FAIL] ${loc.name.padEnd(30)}: Should be INSIDE polygon`);
            failed++;
        }
    }

    const outsideRoads = [
        { name: 'North Perimeter Road (WAY 732625876)', lat: 16.426600, lng: 74.589250 },
        { name: 'South Highway SH18 (WAY 1386641768)', lat: 16.425100, lng: 74.588000 },
        { name: 'West Highway NH160 (WAY 1386641764)', lat: 16.426000, lng: 74.587600 },
        { name: 'East Boundary Access Road', lat: 16.426000, lng: 74.590800 },
        { name: 'Neighboring Bhate Hospital', lat: 16.425551, lng: 74.588441 }
    ];

    console.log('\n--- 2. Surrounding Public Roads Strictly Blocked ---');
    for (const loc of outsideRoads) {
        const isInside = isPointInPolygon(loc.lat, loc.lng, CAMPUS_GEOFENCE);
        if (!isInside) {
            console.log(`  [PASS] ${loc.name.padEnd(40)}: OUTSIDE campus (strictly blocked)`);
            passed++;
        } else {
            console.error(`  [FAIL] ${loc.name.padEnd(40)}: Should be OUTSIDE polygon`);
            failed++;
        }
    }

    // 3. API Punch-In Testing for Outside Roads
    console.log('\n--- 3. API Punch-In Geofence Rejection for Road Coordinates ---');
    for (const loc of outsideRoads) {
        const req = {
            body: { lat: loc.lat, lng: loc.lng },
            user: testUser
        };
        const res = createMockRes();
        await attendanceController.punch(req, res);

        const data = res.getData();
        if (res.getStatus() === 400 && data && data.error && data.error.includes('outside the campus geofence')) {
            console.log(`  [PASS] Punch rejected on ${loc.name.padEnd(40)} -> HTTP 400: ${data.error}`);
            passed++;
        } else {
            console.error(`  [FAIL] Punch on ${loc.name} was not rejected with expected error. Got:`, res.getStatus(), data);
            failed++;
        }
    }

    // 4. API Punch-In Testing for Inside Campus
    console.log('\n--- 4. API Punch-In Allowed Inside Campus Polygon ---');
    {
        const req = {
            body: { lat: 16.426026, lng: 74.589250 },
            user: testUser
        };
        const res = createMockRes();
        await attendanceController.punch(req, res);

        const data = res.getData();
        if (res.getStatus() === 200 && data && data.message && data.message.includes('successfully')) {
            console.log(`  [PASS] Punch-in inside campus centroid succeeded -> HTTP 200: ${data.message}`);
            passed++;
        } else {
            console.error(`  [FAIL] Punch-in failed. Got:`, res.getStatus(), data);
            failed++;
        }
    }

    // 5. Punch-Out Testing (Outside road -> blocked; Inside polygon -> allowed)
    console.log('\n--- 5. API Punch-Out Geofence Enforcement ---');
    // Attempt punch out on road -> blocked
    {
        const req = {
            body: { lat: 16.426000, lng: 74.587600 }, // West NH160 road
            user: testUser
        };
        const res = createMockRes();
        await attendanceController.punch(req, res);

        const data = res.getData();
        if (res.getStatus() === 400 && data && data.error && data.error.includes('outside the campus geofence')) {
            console.log(`  [PASS] Punch-out on NH160 highway strictly blocked -> HTTP 400: ${data.error}`);
            passed++;
        } else {
            console.error(`  [FAIL] Punch-out on road should be blocked. Got:`, res.getStatus(), data);
            failed++;
        }
    }

    // Punch out inside campus -> succeeds
    {
        const req = {
            body: { lat: 16.425780, lng: 74.589700 }, // Inside campus
            user: testUser
        };
        const res = createMockRes();
        await attendanceController.punch(req, res);

        const data = res.getData();
        if (res.getStatus() === 200 && data && data.message && data.message.includes('Punched Out successfully')) {
            console.log(`  [PASS] Punch-out inside campus succeeded -> HTTP 200: ${data.message}`);
            passed++;
        } else {
            console.error(`  [FAIL] Punch-out inside campus should succeed. Got:`, res.getStatus(), data);
            failed++;
        }
    }

    // 6. Location Update Telemetry Tracking
    console.log('\n--- 6. Location Tracking (Inside vs Outside detection) ---');
    // Start tracking by resetting attendance and punch in
    db.prepare('DELETE FROM attendance WHERE user_id = ?').run(testStaffId);
    {
        const req = {
            body: { lat: 16.426026, lng: 74.589250 },
            user: testUser
        };
        const res = createMockRes();
        await attendanceController.punch(req, res);
    }
    // Update location inside campus
    {
        const req = {
            body: { lat: 16.426026, lng: 74.589353, accuracy: 10 },
            user: testUser
        };
        const res = createMockRes();
        await attendanceController.updateLocation(req, res);
        const data = res.getData();
        if (res.getStatus() === 200 && data.isInsideCampus === true) {
            console.log(`  [PASS] updateLocation inside campus returns isInsideCampus: true`);
            passed++;
        } else {
            console.error(`  [FAIL] updateLocation inside campus failed:`, res.getStatus(), data);
            failed++;
        }
    }
    // Update location on road
    {
        const req = {
            body: { lat: 16.426600, lng: 74.589250, accuracy: 10 }, // North road
            user: testUser
        };
        const res = createMockRes();
        await attendanceController.updateLocation(req, res);
        const data = res.getData();
        if (res.getStatus() === 200 && data.isInsideCampus === false) {
            console.log(`  [PASS] updateLocation on North road returns isInsideCampus: false`);
            passed++;
        } else {
            console.error(`  [FAIL] updateLocation on road should return isInsideCampus: false:`, res.getStatus(), data);
            failed++;
        }
    }

    // Cleanup
    db.prepare('DELETE FROM attendance WHERE user_id = ?').run(testStaffId);
    db.prepare('DELETE FROM employee_locations WHERE user_id = ?').run(testStaffId);

    console.log('\n' + '='.repeat(70));
    console.log(` TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('='.repeat(70) + '\n');

    if (failed > 0) {
        process.exit(1);
    }
}

runGeofenceTests().catch(err => {
    console.error('Test suite error:', err);
    process.exit(1);
});
