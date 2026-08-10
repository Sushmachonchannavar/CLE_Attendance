const db = require('../database');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { sendAttendanceOTP } = require('../utils/sms');

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
        const distanceOut = getDistanceFromLatLonInMeters(lat, lng, CAMPUS_LAT, CAMPUS_LNG);
        db.prepare('UPDATE attendance SET punch_out_time = ?, location_lat_out = ?, location_lng_out = ?, distance_out = ? WHERE id = ?')
            .run(timeString, lat, lng, distanceOut, record.id);
        res.json({ message: 'Punched Out successfully', time: timeString });
    } else {
        // Punch In - Calculate Late Status
        const hour = now.getHours();
        const minute = now.getMinutes();
        const isLate = (hour > DUTY_START_HOUR || (hour === DUTY_START_HOUR && minute > LATE_THRESHOLD_MINUTE)) ? 1 : 0;
        const roleVal = (req.user.role === 'hoi' || req.user.role === 'principal') ? 'PRINCIPAL' : 'STAFF';
        const statusVal = isLate ? 'late' : 'present';

        db.prepare('INSERT INTO attendance (user_id, date, punch_in_time, location_lat, location_lng, is_late, role, distance, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(userId, today, timeString, lat, lng, isLate, roleVal, distance, statusVal);

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

exports.sendOTP = async (req, res) => {
    try {
        const { employeeId, phone, role } = req.body;
        
        // 1. Input Validation
        if ((!employeeId || typeof employeeId !== 'string' || employeeId.trim() === '') &&
            (!phone || typeof phone !== 'string' || phone.trim() === '')) {
            return res.status(400).json({ error: 'Mobile number or Employee ID is required.' });
        }
        
        let user;
        if (phone && phone.trim() !== '') {
            const cleanPhone = phone.trim();
            user = db.prepare("SELECT * FROM users WHERE phone = ? AND status = 'active'").get(cleanPhone);
        } else {
            const cleanEmpId = employeeId.trim();
            user = db.prepare("SELECT * FROM users WHERE employee_id = ? AND status = 'active'").get(cleanEmpId);
        }

        if (!user) {
            console.warn(`[OTP FAILED] User not found or inactive. Phone: ${phone}, EmpId: ${employeeId}`);
            return res.status(404).json({ error: 'User not found or inactive.' });
        }

        // Validate user role matches the selected role
        if (role) {
            const dbRole = user.role?.toLowerCase();
            const targetRole = role.toLowerCase();
            const rolesMatch = dbRole === targetRole || 
                               ((dbRole === 'hoi' || dbRole === 'principal') && 
                                (targetRole === 'hoi' || targetRole === 'principal'));
            if (!rolesMatch) {
                const displayRole = targetRole === 'hoi' || targetRole === 'principal' ? 'Principal' : targetRole.charAt(0).toUpperCase() + targetRole.slice(1);
                console.warn(`[OTP FAILED] Role mismatch. Phone: ${phone}, DB Role: ${dbRole}, Target Role: ${targetRole}`);
                return res.status(403).json({ error: `User is not registered as ${displayRole}.` });
            }
        }

        const activePhone = user.phone;
        const activeEmpId = user.employee_id || `EMP-${activePhone}`;

        if (!activePhone) {
            console.error(`[OTP FAILED] User ${activeEmpId} does not have a registered mobile number.`);
            return res.status(400).json({ error: 'User does not have a registered mobile number.' });
        }

        // 3. Security check: Rate Limiting (Max 3 OTP requests in 10 minutes)
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const otpCountRow = db.prepare(`
            SELECT COUNT(*) AS count 
            FROM attendance_otps 
            WHERE employee_id = ? AND created_at > datetime(?)
        `).get(activeEmpId, tenMinutesAgo);

        if (otpCountRow && otpCountRow.count >= 3) {
            console.warn(`[OTP FAILED] Rate limit reached for employee ${activeEmpId}: ${otpCountRow.count} requests in last 10 mins.`);
            return res.status(429).json({ error: 'Too many OTP requests. Please try again after 10 minutes.' });
        }

        // 4. Security check: One active OTP per employee
        db.prepare('UPDATE attendance_otps SET is_used = 1 WHERE employee_id = ? AND is_used = 0').run(activeEmpId);

        // 5. Generate random 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // 6. Hash OTP before storing (using SHA-256)
        const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
        
        // 7. Calculate expiration time (5 minutes)
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

        // 8. Save OTP to database
        db.prepare(`
            INSERT INTO attendance_otps (employee_id, otp, expires_at, is_used) 
            VALUES (?, ?, ?, 0)
        `).run(activeEmpId, hashedOtp, expiresAt);

        console.log(`[OTP GENERATED] User: ${user.name} (${activeEmpId}) -> OTP: ${otp} (Expires: ${expiresAt})`);

        // 9. Send OTP to registered mobile number
        let smsResult;
        try {
            smsResult = await sendAttendanceOTP(activePhone, otp);
            if (!smsResult.success) {
                console.error(`[SMS Delivery Error] Full details:`, smsResult.error);
                return res.status(502).json({ success: false, message: "Failed to deliver SMS" });
            }
        } catch (smsError) {
            console.error(`[SMS Gateway Exception] Full details:`, smsError);
            return res.status(502).json({ success: false, message: "Failed to deliver SMS" });
        }

        res.json({ 
            success: true, 
            message: 'Verification code has been sent successfully to your registered mobile number.',
            debug: smsResult.mock ? "Running in MOCK mode. Use the OTP printed in the backend console." : undefined
        });

    } catch (err) {
        console.error('Error in sendOTP:', err);
        res.status(500).json({ error: 'Internal server error during OTP generation.' });
    }
};

exports.verifyOTP = async (req, res) => {
    try {
        const { employeeId, phone, otp, lat, lng, role } = req.body;

        // 1. Input Validation
        if ((!employeeId || typeof employeeId !== 'string' || employeeId.trim() === '') &&
            (!phone || typeof phone !== 'string' || phone.trim() === '')) {
            return res.status(400).json({ error: 'Mobile number or Employee ID is required.' });
        }
        if (!otp || typeof otp !== 'string' || otp.trim() === '') {
            return res.status(400).json({ error: 'OTP is required.' });
        }

        const cleanOtp = otp.trim();

        let user;
        if (phone && phone.trim() !== '') {
            const cleanPhone = phone.trim();
            user = db.prepare("SELECT * FROM users WHERE phone = ? AND status = 'active'").get(cleanPhone);
        } else {
            const cleanEmpId = employeeId.trim();
            user = db.prepare("SELECT * FROM users WHERE employee_id = ? AND status = 'active'").get(cleanEmpId);
        }

        if (!user) {
            console.warn(`[OTP VERIFY FAILED] User not found or inactive. Phone: ${phone}, EmpId: ${employeeId}`);
            return res.status(404).json({ error: 'User not found or inactive.' });
        }

        // Validate user role matches the selected role
        if (role) {
            const dbRole = user.role?.toLowerCase();
            const targetRole = role.toLowerCase();
            const rolesMatch = dbRole === targetRole || 
                               ((dbRole === 'hoi' || dbRole === 'principal') && 
                                (targetRole === 'hoi' || targetRole === 'principal'));
            if (!rolesMatch) {
                const displayRole = targetRole === 'hoi' || targetRole === 'principal' ? 'Principal' : targetRole.charAt(0).toUpperCase() + targetRole.slice(1);
                console.warn(`[OTP VERIFY FAILED] Role mismatch. Phone: ${phone}, DB Role: ${dbRole}, Target Role: ${targetRole}`);
                return res.status(403).json({ error: `User is not registered as ${displayRole}.` });
            }
        }

        const activeEmpId = user.employee_id || `EMP-${user.phone}`;
        console.log(`[OTP VERIFY] Verifying OTP for user ${user.name} (${activeEmpId})`);

        // 3. Find the latest unused OTP for the employee
        const latestOtpRow = db.prepare(`
            SELECT * FROM attendance_otps 
            WHERE employee_id = ? 
            ORDER BY id DESC 
            LIMIT 1
        `).get(activeEmpId);

        if (!latestOtpRow) {
            console.warn(`[OTP VERIFY FAILED] No OTP record found for employee ${activeEmpId}`);
            return res.status(400).json({ error: 'OTP not found. Please request a new one.' });
        }

        // 4. Check if it has already been used
        if (latestOtpRow.is_used === 1) {
            console.warn(`[OTP VERIFY FAILED] OTP already used for employee ${activeEmpId}`);
            return res.status(400).json({ error: 'OTP has already been used. Please request a new one.' });
        }

        // 5. Check whether it has expired
        const now = new Date();
        const expiresAt = new Date(latestOtpRow.expires_at);
        if (now > expiresAt) {
            console.warn(`[OTP VERIFY FAILED] OTP expired for employee ${activeEmpId}. Expired at: ${latestOtpRow.expires_at}`);
            db.prepare('UPDATE attendance_otps SET is_used = 1 WHERE id = ?').run(latestOtpRow.id);
            return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
        }

        // 6. Verify correct OTP (hash and compare)
        const hashedInput = crypto.createHash('sha256').update(cleanOtp).digest('hex');
        if (latestOtpRow.otp !== hashedInput) {
            console.warn(`[OTP VERIFY FAILED] Invalid OTP mismatch for employee ${activeEmpId}`);
            return res.status(400).json({ error: 'Invalid OTP code. Please try again.' });
        }

        // 7. Successful validation: Mark OTP as used
        db.prepare('UPDATE attendance_otps SET is_used = 1 WHERE id = ?').run(latestOtpRow.id);
        console.log(`[OTP VERIFY SUCCESS] OTP verified for employee ${activeEmpId}`);

        // 8. Generate JWT token
        const token = jwt.sign(
            { id: user.id, role: user.role, employeeId: user.employee_id }, 
            process.env.JWT_SECRET, 
            { expiresIn: '7d' }
        );

        // 9. Punch in action (if coordinates are provided)
        if (lat !== undefined && lng !== undefined) {
            const latitude = parseFloat(lat);
            const longitude = parseFloat(lng);

            if (isNaN(latitude) || isNaN(longitude)) {
                return res.status(400).json({ error: 'Invalid coordinates provided for punch-in.' });
            }

            console.log(`[OTP PUNCH-IN] Processing punch-in for user ${user.id} at coordinates: ${latitude}, ${longitude}`);

            const today = new Date().toISOString().split('T')[0];
            const timeString = now.toLocaleTimeString();

            // Check if already exist for today
            let record = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(user.id, today);
            
            // Check Geofence
            const distance = getDistanceFromLatLonInMeters(latitude, longitude, CAMPUS_LAT, CAMPUS_LNG);
            const isInside = distance <= GEOFENCE_RADIUS_METERS;

            if (!record && !isInside) {
                console.log(`[OTP PUNCH-IN REJECTED] Outside geofence for user ${user.id}: ${Math.round(distance)}m away`);
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
                const distanceOut = getDistanceFromLatLonInMeters(latitude, longitude, CAMPUS_LAT, CAMPUS_LNG);
                db.prepare('UPDATE attendance SET punch_out_time = ?, location_lat_out = ?, location_lng_out = ?, distance_out = ? WHERE id = ?')
                    .run(timeString, latitude, longitude, distanceOut, record.id);
                
                const updatedRecord = db.prepare('SELECT * FROM attendance WHERE id = ?').get(record.id);
                console.log(`[OTP PUNCH-OUT SUCCESS] Punched Out successfully for user ${user.id}`);
                return res.json({
                    success: true,
                    otpVerified: true,
                    token,
                    user,
                    message: 'Punched Out successfully',
                    punchRecord: updatedRecord
                });
            } else {
                // Punch In - Calculate Late Status
                const hour = now.getHours();
                const minute = now.getMinutes();
                const isLate = (hour > DUTY_START_HOUR || (hour === DUTY_START_HOUR && minute > LATE_THRESHOLD_MINUTE)) ? 1 : 0;
                const roleVal = (user.role === 'hoi' || user.role === 'principal') ? 'PRINCIPAL' : 'STAFF';
                const statusVal = isLate ? 'late' : 'present';

                const runResult = db.prepare(`
                    INSERT INTO attendance (user_id, date, punch_in_time, location_lat, location_lng, is_late, role, distance, status) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(user.id, today, timeString, latitude, longitude, isLate, roleVal, distance, statusVal);

                const newRecord = db.prepare('SELECT * FROM attendance WHERE id = ?').get(runResult.lastInsertRowid);
                console.log(`[OTP PUNCH-IN SUCCESS] Punched In successfully for user ${user.id} ${isLate ? '(Late)' : '(On Time)'}`);
                
                return res.json({
                    success: true,
                    otpVerified: true,
                    token,
                    user,
                    message: `Punched In successfully ${isLate ? '(Late)' : '(On Time)'}`,
                    isLate: !!isLate,
                    punchRecord: newRecord
                });
            }
        }

        // Default response: OTP verified, return user session token
        res.json({
            success: true,
            otpVerified: true,
            token,
            user,
            message: 'OTP verified successfully.'
        });

    } catch (err) {
        console.error('Error in verifyOTP:', err);
        res.status(500).json({ error: 'Internal server error during OTP verification.' });
    }
};

