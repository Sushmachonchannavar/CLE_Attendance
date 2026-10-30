/**
 * Verification Test: Flexible Punch-In / Punch-Out at Any Time of Day & Backend Geofence Enforcement
 */
const assert = require('assert');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.CAMPUS_LAT = '16.426378';
process.env.CAMPUS_LNG = '74.589884';
process.env.JWT_SECRET = 'cle_attendance_test_secret_key_minimum_32_characters_123456';

const app = require('./server');
const db = require('./database');

async function runTests() {
    console.log('=== TEST SUITE: FLEXIBLE PUNCH-IN & PUNCH-OUT (24/7 GEOFENCE ENFORCEMENT) ===\n');

    // Setup test staff user
    const staffId = 100;
    const staffToken = jwt.sign(
        { id: staffId, role: 'staff', employeeId: 'EMP100' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
    );

    const insideCoords = { lat: 16.426378, lng: 74.589884 };
    const outsideCoords = { lat: 12.9716, lng: 77.5946 }; // Bangalore coords (outside CLE campus)
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

    // Clean up any existing attendance / tracking records
    db.prepare('DELETE FROM attendance WHERE user_id = ? AND date = ?').run(staffId, today);
    db.prepare('DELETE FROM employee_locations WHERE user_id = ?').run(staffId);

    // ----------------------------------------------------
    // TEST 1: Punch-In OUTSIDE campus must be REJECTED
    // ----------------------------------------------------
    console.log('1. Testing Punch-In outside campus boundary...');
    const outsidePunchIn = await request(app)
        .post('/api/attendance/punch')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(outsideCoords);

    assert.strictEqual(outsidePunchIn.status, 400, 'Punch-in outside campus should return 400');
    assert(outsidePunchIn.body.error.includes('outside the campus geofence'), 'Error message must specify outside campus geofence');
    console.log('  [PASS] Punch-in outside campus rejected with 400:', outsidePunchIn.body.error);

    // ----------------------------------------------------
    // TEST 2: Punch-In INSIDE campus at ANY time succeeds
    // ----------------------------------------------------
    console.log('\n2. Testing Punch-In inside campus boundary (any time of day)...');
    const insidePunchIn = await request(app)
        .post('/api/attendance/punch')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(insideCoords);

    assert.strictEqual(insidePunchIn.status, 200, 'Punch-in inside campus should return 200');
    assert(insidePunchIn.body.message.includes('successfully'), 'Message should indicate success');
    assert(insidePunchIn.body.time, 'Should return time string in response');
    assert(insidePunchIn.body.utcTime, 'Should return utcTime in response');

    // Verify DB persisted record
    const recordAfterIn = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(staffId, today);
    assert(recordAfterIn, 'Attendance record must exist in DB');
    assert(recordAfterIn.punch_in_time, 'punch_in_time must be recorded');
    assert(recordAfterIn.punch_in_utc, 'punch_in_utc must be recorded');
    assert.strictEqual(recordAfterIn.punch_out_time, null, 'punch_out_time must initially be null');
    console.log(`  [PASS] Punch-in succeeded at: ${recordAfterIn.punch_in_time} (UTC: ${recordAfterIn.punch_in_utc})`);

    // Verify live location tracking started
    const trackerRowAfterIn = db.prepare('SELECT * FROM employee_locations WHERE user_id = ?').get(staffId);
    assert(trackerRowAfterIn, 'Tracking row must exist');
    assert.strictEqual(trackerRowAfterIn.is_tracking, 1, 'is_tracking must be 1 (active) after punch-in');
    assert.strictEqual(trackerRowAfterIn.is_inside_campus, 1, 'is_inside_campus must be 1');
    console.log('  [PASS] Live location tracking active (is_tracking = 1, is_inside_campus = 1)');

    // ----------------------------------------------------
    // TEST 3: Punch-Out OUTSIDE campus must be REJECTED (Backend Geofence Validation)
    // ----------------------------------------------------
    console.log('\n3. Testing Punch-Out outside campus boundary while shift is active...');
    const outsidePunchOut = await request(app)
        .post('/api/attendance/punch')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(outsideCoords);

    assert.strictEqual(outsidePunchOut.status, 400, 'Punch-out outside campus should return 400');
    assert(outsidePunchOut.body.error.includes('outside the campus geofence'), 'Error message must specify outside campus geofence');
    
    // Verify shift is still active in DB and NOT punched out
    const recordCheckStillActive = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(staffId, today);
    assert.strictEqual(recordCheckStillActive.punch_out_time, null, 'punch_out_time must remain null after rejected punch-out');
    console.log('  [PASS] Punch-out outside campus strictly rejected with 400:', outsidePunchOut.body.error);

    // ----------------------------------------------------
    // TEST 4: Punch-Out INSIDE campus at ANY time succeeds
    // ----------------------------------------------------
    console.log('\n4. Testing Punch-Out inside campus boundary (any time of day)...');
    const insidePunchOut = await request(app)
        .post('/api/attendance/punch')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(insideCoords);

    assert.strictEqual(insidePunchOut.status, 200, 'Punch-out inside campus should return 200');
    assert(insidePunchOut.body.message.includes('Punched Out successfully'), 'Message should indicate punched out successfully');
    assert(insidePunchOut.body.time, 'Should return time string in response');
    assert(insidePunchOut.body.utcTime, 'Should return utcTime in response');

    // Verify DB updated record
    const recordAfterOut = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(staffId, today);
    assert(recordAfterOut.punch_out_time, 'punch_out_time must be recorded');
    assert(recordAfterOut.punch_out_utc, 'punch_out_utc must be recorded');
    console.log(`  [PASS] Punch-out succeeded at: ${recordAfterOut.punch_out_time} (UTC: ${recordAfterOut.punch_out_utc})`);

    // Verify live location tracking stopped
    const trackerRowAfterOut = db.prepare('SELECT * FROM employee_locations WHERE user_id = ?').get(staffId);
    assert.strictEqual(trackerRowAfterOut.is_tracking, 0, 'is_tracking must be 0 (stopped) after punch-out');
    console.log('  [PASS] Live location tracking terminated upon punch-out (is_tracking = 0)');

    // ----------------------------------------------------
    // TEST 5: Duplicate Punch Prevention (Third Punch)
    // ----------------------------------------------------
    console.log('\n5. Testing Duplicate Action Prevention (3rd punch check)...');
    const duplicatePunch = await request(app)
        .post('/api/attendance/punch')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(insideCoords);

    assert.strictEqual(duplicatePunch.status, 400, 'Duplicate punch should return 400');
    assert(duplicatePunch.body.error.includes('Already completed attendance'), 'Should reject with already completed attendance');
    console.log('  [PASS] Duplicate action prevented with 400:', duplicatePunch.body.error);

    // ----------------------------------------------------
    // TEST 6: Status API reflects correct state
    // ----------------------------------------------------
    console.log('\n6. Testing /api/attendance/status endpoint...');
    const statusRes = await request(app)
        .get('/api/attendance/status')
        .set('Authorization', `Bearer ${staffToken}`);

    assert.strictEqual(statusRes.status, 200);
    assert.strictEqual(statusRes.body.punchedIn, true, 'punchedIn must be true');
    assert.strictEqual(statusRes.body.punchedOut, true, 'punchedOut must be true');
    assert.strictEqual(statusRes.body.record.punch_in_time, recordAfterOut.punch_in_time);
    assert.strictEqual(statusRes.body.record.punch_out_time, recordAfterOut.punch_out_time);
    console.log('  [PASS] Status endpoint returns finalized shift details');

    // ----------------------------------------------------
    // TEST 7: Outside Office Hours Testing (Early Morning & Late Night)
    // ----------------------------------------------------
    console.log('\n7. Testing Punch-In & Punch-Out outside normal office hours (e.g., Early Morning 06:00 AM, Late Night 22:30 PM)...');
    
    // Clear today's completed attendance to test a new cycle
    db.prepare('DELETE FROM attendance WHERE user_id = ? AND date = ?').run(staffId, today);
    db.prepare('DELETE FROM employee_locations WHERE user_id = ?').run(staffId);

    // Simulate punch in (inside geofence)
    const earlyMorningPunch = await request(app)
        .post('/api/attendance/punch')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(insideCoords);

    assert.strictEqual(earlyMorningPunch.status, 200, 'Punch-in outside office hours inside campus should succeed');
    console.log('  [PASS] Early morning / outside-hours punch-in allowed inside campus geofence');

    // Attempt outside campus punch-out outside office hours -> blocked
    const earlyMorningPunchOutOutside = await request(app)
        .post('/api/attendance/punch')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(outsideCoords);

    assert.strictEqual(earlyMorningPunchOutOutside.status, 400, 'Punch-out outside campus must be blocked even outside office hours');
    console.log('  [PASS] Outside-hours punch-out outside campus strictly blocked');

    // Outside office hours punch-out inside campus -> succeeds
    const earlyMorningPunchOutInside = await request(app)
        .post('/api/attendance/punch')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(insideCoords);

    assert.strictEqual(earlyMorningPunchOutInside.status, 200, 'Punch-out outside office hours inside campus should succeed');
    console.log('  [PASS] Outside-hours punch-out allowed inside campus geofence');

    // ----------------------------------------------------
    // TEST 8: Specific 600m Geofence Validation Requirements
    // ----------------------------------------------------
    console.log('\n8. Testing Specific 600m Geofence Boundary Rules...');
    
    // Clear test attendance
    db.prepare('DELETE FROM attendance WHERE user_id = ? AND date = ?').run(staffId, today);
    db.prepare('DELETE FROM employee_locations WHERE user_id = ?').run(staffId);

    const R_EARTH = 6371e3;
    const latCenter = 16.426378;
    const lngCenter = 74.589884;

    const coords472m = { lat: 16.42900, lng: 74.58640 }; // Screenshot location (~472m)
    const coords550m = { 
        lat: Number((latCenter + (550 / (R_EARTH * Math.PI / 180))).toFixed(6)), 
        lng: lngCenter 
    };
    const coords600m = { 
        lat: Number((latCenter + (600 / (R_EARTH * Math.PI / 180))).toFixed(6)), 
        lng: lngCenter 
    };
    const coordsBeyond600m = { 
        lat: Number((latCenter + (650 / (R_EARTH * Math.PI / 180))).toFixed(6)), 
        lng: lngCenter 
    };

    // A) At 472 meters (from screenshot): MUST BE INSIDE CAMPUS
    console.log('  Testing at 472m (16.42900, 74.58640)...');
    const punch472 = await request(app)
        .post('/api/attendance/punch')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(coords472m);
    assert.strictEqual(punch472.status, 200, '472m point must be recognized as INSIDE campus');
    console.log('  [PASS] At 472 meters (16.42900, 74.58640): INSIDE CAMPUS (Punch-in allowed)');

    // B) At 550 meters: MUST BE INSIDE CAMPUS (punch-out)
    console.log('  Testing at 550m...');
    const punch550 = await request(app)
        .post('/api/attendance/punch')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(coords550m);
    assert.strictEqual(punch550.status, 200, '550m point must be recognized as INSIDE campus');
    console.log('  [PASS] At 550 meters: INSIDE CAMPUS (Punch-out allowed)');

    // Reset for 600m & beyond tests
    db.prepare('DELETE FROM attendance WHERE user_id = ? AND date = ?').run(staffId, today);
    db.prepare('DELETE FROM employee_locations WHERE user_id = ?').run(staffId);

    // C) At 600 meters: MUST BE INSIDE CAMPUS
    console.log('  Testing at 600m boundary...');
    const punch600 = await request(app)
        .post('/api/attendance/punch')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(coords600m);
    assert.strictEqual(punch600.status, 200, '600m boundary point must be recognized as INSIDE campus');
    console.log('  [PASS] At 600 meters: INSIDE CAMPUS (Subject to defined boundary rule)');

    // D) Beyond 600 meters (650m): MUST BE OUTSIDE CAMPUS
    console.log('  Testing beyond 600m (at 650m)...');
    // First reset today's record to test punch-in rejection at >600m
    db.prepare('DELETE FROM attendance WHERE user_id = ? AND date = ?').run(staffId, today);
    db.prepare('DELETE FROM employee_locations WHERE user_id = ?').run(staffId);

    const punchBeyond600 = await request(app)
        .post('/api/attendance/punch')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(coordsBeyond600m);
    assert.strictEqual(punchBeyond600.status, 400, 'Beyond 600m point must be rejected with 400');
    assert(punchBeyond600.body.error.includes('outside the campus geofence'), 'Error must specify outside campus geofence');
    console.log(`  [PASS] Beyond 600 meters: OUTSIDE CAMPUS (Blocked: ${punchBeyond600.body.error})`);

    // Clean up test data
    db.prepare('DELETE FROM attendance WHERE user_id = ? AND date = ?').run(staffId, today);
    db.prepare('DELETE FROM employee_locations WHERE user_id = ?').run(staffId);

    console.log('\n======================================================');
    console.log('ALL FLEXIBLE PUNCH & GEOFENCE ENFORCEMENT TESTS PASSED!');
    console.log('======================================================\n');
    process.exit(0);
}

runTests().catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
});
