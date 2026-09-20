const db = require('../database');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { sendAttendanceOTP, maskPhone } = require('../utils/sms');

// Mock Campus Geofence (Centroid of the new polygon boundary)
const DEFAULT_LAT = 16.426026;
const DEFAULT_LNG = 74.589353;
const CAMPUS_LAT = process.env.CAMPUS_LAT ? parseFloat(process.env.CAMPUS_LAT) : DEFAULT_LAT;
const CAMPUS_LNG = process.env.CAMPUS_LNG ? parseFloat(process.env.CAMPUS_LNG) : DEFAULT_LNG;

const latOffset = CAMPUS_LAT - DEFAULT_LAT;
const lngOffset = CAMPUS_LNG - DEFAULT_LNG;

const CAMPUS_GEOFENCE = [
    { lat: 16.426380 + latOffset, lng: 74.588000 + lngOffset }, // Northwest Corner
    { lat: 16.426380 + latOffset, lng: 74.590506 + lngOffset }, // Northeast Corner
    { lat: 16.425672 + latOffset, lng: 74.590506 + lngOffset }, // Southeast Corner
    { lat: 16.425672 + latOffset, lng: 74.588000 + lngOffset }  // Southwest Corner
];
const GEOFENCE_RADIUS_METERS = 300;

const DEMO_PHONE_MAP = {
    '9999999999': { role: 'admin', otp: '123456', name: 'Admin Demo' },
    '8888888888': { role: 'hoi', otp: '123456', name: 'Principal Demo' },
    '9876543210': { role: 'staff', otp: '123456', name: 'Faculty Staff Demo' },
    '1234567890': { role: 'staff', otp: '123456', name: 'Staff Demo' }
};

function isPointInPolygon(lat, lng, polygon) {
    let x = lat, y = lng;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        let xi = polygon[i].lat, yi = polygon[i].lng;
        let xj = polygon[j].lat, yj = polygon[j].lng;
        
        let intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1);
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c * 1000; // Distance in meters
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

/**
 * Checks if an identifier (phone, employee ID) is currently locked out
 */
function checkLockout(identifier) {
    if (!identifier) return null;
    try {
        return db.prepare(`
            SELECT locked_until, reason 
            FROM auth_lockouts 
            WHERE identifier = ? AND locked_until > datetime('now')
            ORDER BY locked_until DESC 
            LIMIT 1
        `).get(identifier) || null;
    } catch (e) {
        return null;
    }
}

const DUTY_START_HOUR = 9;   // 9:00 AM
const LATE_THRESHOLD_MINUTE = 20; // 9:20 AM

exports.punch = (req, res) => {
    const { lat, lng } = req.body;
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    const utcString = now.toISOString();

    if (lat === undefined || lng === undefined || lat === null || lng === null || lat === '' || lng === '') {
        return res.status(400).json({ error: 'Location required for attendance tracking' });
    }

    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return res.status(400).json({ error: 'Invalid coordinates provided for attendance tracking' });
    }

    // Check if already exist for today
    let record = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(userId, today);

    // Check Geofence
    const distance = getDistanceFromLatLonInMeters(latitude, longitude, CAMPUS_LAT, CAMPUS_LNG);
    const isInside = isPointInPolygon(latitude, longitude, CAMPUS_GEOFENCE) || distance <= GEOFENCE_RADIUS_METERS;

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
        const distanceOut = getDistanceFromLatLonInMeters(latitude, longitude, CAMPUS_LAT, CAMPUS_LNG);
        db.prepare(`
            UPDATE attendance 
            SET punch_out_time = ?, punch_out_utc = ?, location_lat_out = ?, location_lng_out = ?, distance_out = ? 
            WHERE id = ?
        `).run(timeString, utcString, latitude, longitude, distanceOut, record.id);
        
        // Stop location tracking
        db.prepare('UPDATE employee_locations SET is_tracking = 0 WHERE user_id = ?').run(userId);

        res.json({ message: 'Punched Out successfully', time: timeString, utcTime: utcString });
    } else {
        // Punch In - Calculate Late Status
        const hour = now.getHours();
        const minute = now.getMinutes();
        const isLate = (hour > DUTY_START_HOUR || (hour === DUTY_START_HOUR && minute > LATE_THRESHOLD_MINUTE)) ? 1 : 0;
        const roleVal = (req.user.role === 'hoi' || req.user.role === 'principal') ? 'PRINCIPAL' : 'STAFF';
        const statusVal = isLate ? 'late' : 'present';

        try {
            db.prepare(`
                INSERT INTO attendance (user_id, date, punch_in_time, punch_in_utc, location_lat, location_lng, is_late, role, distance, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(userId, today, timeString, utcString, latitude, longitude, isLate, roleVal, distance, statusVal);
        } catch (err) {
            if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || (err.message && err.message.includes('UNIQUE constraint failed'))) {
                return res.status(400).json({ error: 'Already punched in for today.' });
            }
            throw err;
        }

        // Seed location tracking as active
        db.prepare(`
            INSERT INTO employee_locations (user_id, latitude, longitude, accuracy, timestamp, is_inside_campus, is_tracking)
            VALUES (?, ?, ?, ?, ?, ?, 1)
            ON CONFLICT(user_id) DO UPDATE SET
                latitude = excluded.latitude,
                longitude = excluded.longitude,
                accuracy = excluded.accuracy,
                timestamp = excluded.timestamp,
                is_inside_campus = excluded.is_inside_campus,
                is_tracking = 1
        `).run(userId, latitude, longitude, null, utcString, isInside ? 1 : 0);

        res.json({
            message: `Punched In successfully ${isLate ? '(Late)' : '(On Time)'}`,
            time: timeString,
            utcTime: utcString,
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
            const rawPhone = phone.trim();
            const digits = rawPhone.replace(/\D/g, '');
            const tenDigits = digits.length > 10 ? digits.slice(-10) : digits;
            const withPlus91 = '+91' + tenDigits;
            user = db.prepare("SELECT * FROM users WHERE (phone = ? OR phone = ? OR phone = ?) AND status = 'active'").get(rawPhone, tenDigits, withPlus91);
        } else {
            const cleanEmpId = employeeId.trim();
            user = db.prepare("SELECT * FROM users WHERE employee_id = ? AND status = 'active'").get(cleanEmpId);
        }

        if (!user) {
            console.warn('[OTP FAILED] User not found or inactive:', { phone: maskPhone(phone), empId: employeeId });
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
                console.warn('[OTP FAILED] Role mismatch for user:', { phone: maskPhone(phone), dbRole, targetRole });
                return res.status(403).json({ error: `User is not registered as ${displayRole}.` });
            }
        }

        const activePhone = user.phone;
        const activeEmpId = user.employee_id || `EMP-${activePhone}`;

        if (!activePhone) {
            console.error(`[OTP FAILED] User ${activeEmpId} does not have a registered mobile number.`);
            return res.status(400).json({ error: 'User does not have a registered mobile number.' });
        }

        // 2. Lockout check
        const lockout = checkLockout(activeEmpId) || checkLockout(activePhone);
        if (lockout) {
            const lockTime = new Date(lockout.locked_until).toLocaleTimeString();
            console.warn(`[OTP FAILED] Account locked: ${activeEmpId} until ${lockout.locked_until}`);
            return res.status(423).json({
                error: `Account is temporarily locked due to multiple failed verification attempts. Locked until: ${lockTime}`
            });
        }

        // Check for Demo / Temporary login numbers (Admin: 9999999999, Principal: 8888888888, Staff: 9876543210)
        const cleanDigits = (activePhone || phone || '').replace(/\D/g, '').slice(-10);
        if (DEMO_PHONE_MAP[cleanDigits]) {
            const demoOtp = DEMO_PHONE_MAP[cleanDigits].otp;
            const hashedOtp = crypto.createHash('sha256').update(demoOtp).digest('hex');
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

            db.prepare('UPDATE attendance_otps SET is_used = 1 WHERE employee_id = ? AND is_used = 0').run(activeEmpId);
            db.prepare(`
                INSERT INTO attendance_otps (employee_id, otp, expires_at, is_used, attempts) 
                VALUES (?, ?, ?, 0, 0)
            `).run(activeEmpId, hashedOtp, expiresAt);

            console.log(`[DEMO OTP] Generated demo OTP for ${cleanDigits}: ${demoOtp}`);
            return res.json({
                success: true,
                message: `Demo verification code ready. Enter OTP: ${demoOtp}`,
                isDemo: true,
                demoOtp
            });
        }

        // 3. Security check: Rate Limiting (Max 5 OTP requests in 10 minutes)
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const otpCountRow = db.prepare(`
            SELECT COUNT(*) AS count 
            FROM attendance_otps 
            WHERE employee_id = ? AND created_at > datetime(?)
        `).get(activeEmpId, tenMinutesAgo);

        if (otpCountRow && otpCountRow.count >= 5) {
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

        // 8. Save OTP to database (initial attempts = 0)
        db.prepare(`
            INSERT INTO attendance_otps (employee_id, otp, expires_at, is_used, attempts) 
            VALUES (?, ?, ?, 0, 0)
        `).run(activeEmpId, hashedOtp, expiresAt);

        console.log(`[OTP GENERATED] OTP created for employee ID: ${activeEmpId} (Expires: ${expiresAt})`);
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[DEV OTP] Generated OTP for ${maskPhone(activePhone)}: ${otp}`);
        }

        // 9. Send OTP to registered mobile number
        let smsResult;
        try {
            smsResult = await sendAttendanceOTP(activePhone, otp);
            if (!smsResult.success) {
                console.error(`[SMS Delivery Error] Failed to deliver OTP`);
                return res.status(502).json({ success: false, message: "Failed to deliver SMS" });
            }
        } catch (smsError) {
            console.error(`[SMS Gateway Exception] Failed to deliver SMS`);
            return res.status(502).json({ success: false, message: "Failed to deliver SMS" });
        }

        res.json({ 
            success: true, 
            message: 'Verification code has been sent successfully to your registered mobile number.',
            devOtp: process.env.NODE_ENV === 'test' ? otp : undefined
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
            const rawPhone = phone.trim();
            const digits = rawPhone.replace(/\D/g, '');
            const tenDigits = digits.length > 10 ? digits.slice(-10) : digits;
            const withPlus91 = '+91' + tenDigits;
            user = db.prepare("SELECT * FROM users WHERE (phone = ? OR phone = ? OR phone = ?) AND status = 'active'").get(rawPhone, tenDigits, withPlus91);
        } else {
            const cleanEmpId = employeeId.trim();
            user = db.prepare("SELECT * FROM users WHERE employee_id = ? AND status = 'active'").get(cleanEmpId);
        }

        if (!user) {
            console.warn('[OTP VERIFY FAILED] User not found or inactive:', { phone: maskPhone(phone), empId: employeeId });
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
                console.warn('[OTP VERIFY FAILED] Role mismatch:', { phone: maskPhone(phone), dbRole, targetRole });
                return res.status(403).json({ error: `User is not registered as ${displayRole}.` });
            }
        }

        const activeEmpId = user.employee_id || `EMP-${user.phone}`;
        const activePhone = user.phone;

        // 2. Lockout check
        const lockout = checkLockout(activeEmpId) || checkLockout(activePhone);
        if (lockout) {
            const lockTime = new Date(lockout.locked_until).toLocaleTimeString();
            console.warn(`[OTP VERIFY FAILED] Account locked: ${activeEmpId} until ${lockout.locked_until}`);
            return res.status(423).json({
                error: `Account is temporarily locked due to multiple failed verification attempts. Locked until: ${lockTime}`
            });
        }

        console.log(`[OTP VERIFY] Verifying OTP for employee ID: ${activeEmpId}`);

        // Check if demo OTP matches for demo accounts (Admin: 9999999999, Principal: 8888888888, Staff: 9876543210)
        const cleanDigits = (activePhone || phone || '').replace(/\D/g, '').slice(-10);
        const isDemoMatch = DEMO_PHONE_MAP[cleanDigits] && cleanOtp === DEMO_PHONE_MAP[cleanDigits].otp;

        if (!isDemoMatch) {
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
                console.warn(`[OTP VERIFY FAILED] OTP expired for employee ${activeEmpId}`);
                db.prepare('UPDATE attendance_otps SET is_used = 1 WHERE id = ?').run(latestOtpRow.id);
                return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
            }

            // 6. Verify correct OTP (hash and compare)
            const hashedInput = crypto.createHash('sha256').update(cleanOtp).digest('hex');
            if (latestOtpRow.otp !== hashedInput) {
                const attempts = (latestOtpRow.attempts || 0) + 1;
                db.prepare('UPDATE attendance_otps SET attempts = ? WHERE id = ?').run(attempts, latestOtpRow.id);

                if (attempts >= 5) {
                    const lockUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
                    db.prepare(`
                        INSERT INTO auth_lockouts (identifier, locked_until, reason) 
                        VALUES (?, ?, ?)
                    `).run(activeEmpId, lockUntil, 'Exceeded 5 failed OTP verification attempts');

                    db.prepare('UPDATE attendance_otps SET is_used = 1 WHERE id = ?').run(latestOtpRow.id);

                    console.warn(`[AUTH LOCKOUT] Account locked for 15 mins: ${activeEmpId}`);
                    return res.status(423).json({
                        error: 'Account locked for 15 minutes due to 5 consecutive failed OTP verification attempts.'
                    });
                }

                const remaining = 5 - attempts;
                console.warn(`[OTP VERIFY FAILED] Invalid OTP code submitted for employee ${activeEmpId} (${attempts}/5)`);
                return res.status(400).json({ 
                    error: `Invalid OTP code. Please try again. (${remaining} attempt${remaining === 1 ? '' : 's'} remaining)` 
                });
            }

            // 7. Successful validation: Mark OTP as used
            db.prepare('UPDATE attendance_otps SET is_used = 1 WHERE id = ?').run(latestOtpRow.id);
            console.log(`[OTP VERIFY SUCCESS] OTP verified for employee ID: ${activeEmpId}`);
        } else {
            console.log(`[DEMO OTP VERIFY SUCCESS] Verified demo account ${cleanDigits} with demo OTP`);
            db.prepare('UPDATE attendance_otps SET is_used = 1 WHERE employee_id = ?').run(activeEmpId);
        }

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

            console.log(`[OTP PUNCH-IN] Processing punch-in for user ID: ${user.id}`);

            const today = new Date().toISOString().split('T')[0];
            const timeString = now.toLocaleTimeString();
            const utcString = now.toISOString();

            // Check if already exist for today
            let record = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(user.id, today);
            
            // Check Geofence
            const distance = getDistanceFromLatLonInMeters(latitude, longitude, CAMPUS_LAT, CAMPUS_LNG);
            const isInside = isPointInPolygon(latitude, longitude, CAMPUS_GEOFENCE) || distance <= GEOFENCE_RADIUS_METERS;

            if (!record && !isInside) {
                console.log(`[OTP PUNCH-IN REJECTED] Outside geofence for user ID ${user.id} (${Math.round(distance)}m away)`);
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
                db.prepare(`
                    UPDATE attendance 
                    SET punch_out_time = ?, punch_out_utc = ?, location_lat_out = ?, location_lng_out = ?, distance_out = ? 
                    WHERE id = ?
                `).run(timeString, utcString, latitude, longitude, distanceOut, record.id);
                
                // Stop location tracking
                db.prepare('UPDATE employee_locations SET is_tracking = 0 WHERE user_id = ?').run(user.id);

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

                let runResult;
                try {
                    runResult = db.prepare(`
                        INSERT INTO attendance (user_id, date, punch_in_time, punch_in_utc, location_lat, location_lng, is_late, role, distance, status) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(user.id, today, timeString, utcString, latitude, longitude, isLate, roleVal, distance, statusVal);
                } catch (err) {
                    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || (err.message && err.message.includes('UNIQUE constraint failed'))) {
                        return res.status(400).json({ error: 'Already punched in for today.' });
                    }
                    throw err;
                }

                // Seed location tracking as active
                db.prepare(`
                    INSERT INTO employee_locations (user_id, latitude, longitude, accuracy, timestamp, is_inside_campus, is_tracking)
                    VALUES (?, ?, ?, ?, ?, ?, 1)
                    ON CONFLICT(user_id) DO UPDATE SET
                        latitude = excluded.latitude,
                        longitude = excluded.longitude,
                        accuracy = excluded.accuracy,
                        timestamp = excluded.timestamp,
                        is_inside_campus = excluded.is_inside_campus,
                        is_tracking = 1
                `).run(user.id, latitude, longitude, null, utcString, isInside ? 1 : 0);

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

exports.updateLocation = (req, res) => {
    const { lat, lng, accuracy } = req.body;
    const userId = req.user.id;

    if (lat === undefined || lng === undefined) {
        return res.status(400).json({ error: 'Latitude and Longitude are required.' });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({ error: 'Invalid coordinates.' });
    }

    // Verify user is currently punched in (date = today, punch_out_time IS NULL)
    const today = new Date().toISOString().split('T')[0];
    const record = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(userId, today);

    if (!record || record.punch_out_time) {
        // If not punched in, we shouldn't keep tracking
        db.prepare('UPDATE employee_locations SET is_tracking = 0 WHERE user_id = ?').run(userId);
        return res.status(400).json({ error: 'User is not currently punched in.' });
    }

    const distance = getDistanceFromLatLonInMeters(latitude, longitude, CAMPUS_LAT, CAMPUS_LNG);
    const isInside = isPointInPolygon(latitude, longitude, CAMPUS_GEOFENCE) || distance <= GEOFENCE_RADIUS_METERS;
    const timestamp = new Date().toISOString();

    db.prepare(`
        INSERT INTO employee_locations (user_id, latitude, longitude, accuracy, timestamp, is_inside_campus, is_tracking)
        VALUES (?, ?, ?, ?, ?, ?, 1)
        ON CONFLICT(user_id) DO UPDATE SET
            latitude = excluded.latitude,
            longitude = excluded.longitude,
            accuracy = excluded.accuracy,
            timestamp = excluded.timestamp,
            is_inside_campus = excluded.is_inside_campus,
            is_tracking = 1
    `).run(userId, latitude, longitude, accuracy !== undefined ? parseFloat(accuracy) : null, timestamp, isInside ? 1 : 0);

    res.json({ success: true, isInsideCampus: isInside });
};

exports.getEmployeeLocations = (req, res) => {
    const today = new Date().toISOString().split('T')[0];

    try {
        const employees = db.prepare(`
            SELECT 
                el.user_id as userId,
                u.name,
                u.employee_id as employeeId,
                el.latitude,
                el.longitude,
                el.accuracy,
                el.timestamp,
                el.is_inside_campus as isInsideCampus,
                a.punch_in_time as punchInTime
            FROM employee_locations el
            JOIN users u ON el.user_id = u.id
            JOIN attendance a ON el.user_id = a.user_id AND a.date = ? AND a.punch_out_time IS NULL
            WHERE el.is_tracking = 1
        `).all(today);

        // Convert is_inside_campus column from integer (0/1) to boolean
        const formattedEmployees = employees.map(emp => ({
            ...emp,
            isInsideCampus: !!emp.isInsideCampus
        }));

        res.json({ success: true, employees: formattedEmployees });
    } catch (err) {
        console.error('Error fetching employee locations:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
