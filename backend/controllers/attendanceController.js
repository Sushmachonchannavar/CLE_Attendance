const db = require('../database');

// Mock Campus Geofence (Example: A point in India)
// Replace with actual campus coordinates or env variables
const CAMPUS_LAT = 16.42578;
const CAMPUS_LNG = 74.58970;
const GEOFENCE_RADIUS_METERS = 100;

function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1);  // deg2rad below
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c * 1000; // Distance in meters
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180)
}

const DUTY_START_HOUR = 9;   // 9:00 AM
const LATE_THRESHOLD_MINUTE = 20; // 9:20 AM

exports.punch = (req, res) => {
    const { lat, lng } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role?.toLowerCase();
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const timeString = now.toLocaleTimeString();

    if (!lat || !lng) {
        return res.status(400).json({ error: 'Location required for attendance tracking' });
    }

    // Check if already exist for today
    let record = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(userId, today);

    // Check Geofence
    const distance = getDistanceFromLatLonInMeters(lat, lng, CAMPUS_LAT, CAMPUS_LNG);
    const isInside = distance <= GEOFENCE_RADIUS_METERS;

    if (!record && !isInside) {
        // Enforce geofence strictly for punch-in for ALL users
        console.log(`Punch-in rejected for user ${userId}: Outside geofence (${Math.round(distance)}m away)`);
        return res.status(400).json({
            error: `You are outside the campus geofence. Distance: ${Math.round(distance)}m.`,
            distance: Math.round(distance)
        });
    }

    if (record) {
        if (record.punch_out_time) {
            return res.status(400).json({ error: 'Already completed attendance for today.' });
        }
        // Punch Out
        db.prepare('UPDATE attendance SET punch_out_time = ?, location_lat_out = ?, location_lng_out = ? WHERE id = ?')
            .run(timeString, lat, lng, record.id);
        res.json({ message: 'Punched Out successfully', time: timeString });
    } else {
        // Punch In - Calculate Late Status
        const hour = now.getHours();
        const minute = now.getMinutes();
        const isLate = (hour > DUTY_START_HOUR || (hour === DUTY_START_HOUR && minute > LATE_THRESHOLD_MINUTE)) ? 1 : 0;

        db.prepare('INSERT INTO attendance (user_id, date, punch_in_time, location_lat, location_lng, is_late) VALUES (?, ?, ?, ?, ?, ?)')
            .run(userId, today, timeString, lat, lng, isLate);

        res.json({
            message: `Punched In successfully ${isLate ? '(Late)' : '(On Time)'}`,
            time: timeString,
            isLate: !!isLate
        });
    }
};



exports.getHistory = (req, res) => {
    const userId = req.user.id;
    const history = db.prepare('SELECT * FROM attendance WHERE user_id = ? ORDER BY date DESC LIMIT 30').all(userId);
    res.json(history);
};

exports.getStatus = (req, res) => {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    const record = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(userId, today);
    res.json({ punchedIn: !!record, punchedOut: !!(record && record.punch_out_time), record });
};
