const crypto = require('crypto');

/**
 * Parses user agent string to determine human-readable device name, type, and platform.
 */
function parseUserAgent(uaString = '', platformHint = '') {
    const ua = (uaString || '').toLowerCase();
    
    let deviceType = 'desktop';
    let platform = 'web';
    let browser = 'Browser';
    let os = 'Unknown OS';

    // Detect platform / OS
    if (ua.includes('android')) {
        deviceType = 'mobile';
        platform = 'android';
        os = 'Android';
    } else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
        deviceType = ua.includes('ipad') ? 'tablet' : 'mobile';
        platform = 'ios';
        os = 'iOS';
    } else if (ua.includes('windows')) {
        deviceType = 'desktop';
        platform = 'windows';
        os = 'Windows PC';
    } else if (ua.includes('macintosh') || ua.includes('mac os')) {
        deviceType = 'desktop';
        platform = 'macos';
        os = 'macOS';
    } else if (ua.includes('linux')) {
        deviceType = 'desktop';
        platform = 'linux';
        os = 'Linux';
    }

    // Detect browser or app shell
    if (ua.includes('capacitor') || platformHint === 'capacitor' || platformHint === 'android_app' || platformHint === 'ios_app') {
        browser = 'CLE Mobile App';
        platform = platformHint.includes('ios') ? 'ios' : 'android';
        deviceType = 'mobile';
    } else if (ua.includes('edg/')) {
        browser = 'Microsoft Edge';
    } else if (ua.includes('chrome') && !ua.includes('edg/')) {
        browser = 'Google Chrome';
    } else if (ua.includes('safari') && !ua.includes('chrome')) {
        browser = 'Apple Safari';
    } else if (ua.includes('firefox')) {
        browser = 'Mozilla Firefox';
    }

    const deviceName = `${os} • ${browser}`;
    return {
        deviceName,
        deviceType,
        platform,
        browser
    };
}

/**
 * Computes SHA-256 hash of a raw token string for secure persistent storage.
 */
function hashToken(token) {
    if (!token || typeof token !== 'string') return '';
    return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Creates a new active session and trusted device record in SQLite.
 * Issues a cryptographically secure random refresh token (stored hashed).
 */
function createSession(db, { userId, deviceId, deviceInfo = {}, ip = '', userAgent = '' }) {
    if (!userId) throw new Error('userId is required to create a session');
    
    // Ensure clean device ID
    const cleanDeviceId = (deviceId && typeof deviceId === 'string' && deviceId.trim()) 
        ? deviceId.trim() 
        : `dev_${crypto.randomBytes(16).toString('hex')}`;

    // Detect device metadata if not provided
    const parsed = parseUserAgent(userAgent, deviceInfo.platform);
    const deviceName = deviceInfo.deviceName || parsed.deviceName;
    const deviceType = deviceInfo.deviceType || parsed.deviceType;
    const platform = deviceInfo.platform || parsed.platform;
    const browser = deviceInfo.browser || parsed.browser;

    // Generate cryptographically strong random refresh token (48 bytes hex = 96 characters)
    const rawRefreshToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = hashToken(rawRefreshToken);

    // Refresh token expiry: 30 days
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Revoke any previous active session for this specific (userId, deviceId) pair to prevent ghost sessions
    try {
        db.prepare(`
            UPDATE user_sessions 
            SET is_revoked = 1 
            WHERE user_id = ? AND device_id = ? AND is_revoked = 0
        `).run(userId, cleanDeviceId);
    } catch (e) {}

    // Insert new session
    const insertStmt = db.prepare(`
        INSERT INTO user_sessions (
            user_id, device_id, device_name, device_type, platform, browser, 
            refresh_token_hash, ip_address, user_agent, expires_at, is_revoked
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);

    const result = insertStmt.run(
        userId, cleanDeviceId, deviceName, deviceType, platform, browser,
        tokenHash, ip || '', userAgent || '', expiresAt
    );

    try {
        db.pragma('wal_checkpoint(TRUNCATE)');
    } catch (e) {}

    return {
        sessionId: result.lastInsertRowid,
        deviceId: cleanDeviceId,
        refreshToken: rawRefreshToken,
        expiresAt,
        deviceName,
        deviceType,
        platform,
        browser
    };
}

/**
 * Verifies a refresh token against SQLite and performs refresh-token rotation.
 */
function verifyAndRotateSession(db, { rawRefreshToken, deviceId, ip = '', userAgent = '' }) {
    if (!rawRefreshToken || typeof rawRefreshToken !== 'string' || !rawRefreshToken.trim()) {
        return { valid: false, error: 'Refresh token is required.', code: 'NO_REFRESH_TOKEN' };
    }

    const tokenHash = hashToken(rawRefreshToken);
    
    // 1. Find active, unexpired, non-revoked session by current refresh token hash
    let session = db.prepare(`
        SELECT s.*, u.name AS user_name, u.phone AS user_phone, u.role AS user_role, 
               u.employee_id AS user_employee_id, u.status AS user_status, u.college AS user_college,
               u.department AS user_department, u.designation AS user_designation
        FROM user_sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.refresh_token_hash = ? 
          AND s.is_revoked = 0
          AND s.expires_at > datetime('now')
    `).get(tokenHash);

    let isGracePeriodReuse = false;

    // 2. If not found by current hash, check if it matches the previous hash within the 30-second grace window
    // (Protects against concurrent API race conditions and rapid retries without false logouts)
    if (!session) {
        try {
            session = db.prepare(`
                SELECT s.*, u.name AS user_name, u.phone AS user_phone, u.role AS user_role, 
                       u.employee_id AS user_employee_id, u.status AS user_status, u.college AS user_college,
                       u.department AS user_department, u.designation AS user_designation
                FROM user_sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.prev_refresh_token_hash = ? 
                  AND s.is_revoked = 0
                  AND s.rotated_at > datetime('now', '-30 seconds')
            `).get(tokenHash);

            if (session) {
                isGracePeriodReuse = true;
                console.log(`[AUTH SESSION] Grace window hit for session ${session.id}: safely fulfilling concurrent request`);
            }
        } catch (colErr) {
            // In case columns not yet present in initial test run
        }
    }

    if (!session) {
        return { valid: false, error: 'Session is invalid, expired, or has been revoked.', code: 'SESSION_INVALID' };
    }

    if (session.user_status !== 'active' && session.user_status !== 'approved') {
        return { valid: false, error: 'User account is no longer active.', code: 'USER_INACTIVE' };
    }

    // Verify deviceId match if provided by client
    if (deviceId && session.device_id && session.device_id !== deviceId) {
        console.warn(`[AUTH SESSION] Device ID mismatch for session ${session.id}: expected ${session.device_id}, got ${deviceId}`);
    }

    const updatedUser = {
        id: session.user_id,
        name: session.user_name,
        phone: session.user_phone,
        role: session.user_role,
        employee_id: session.user_employee_id,
        college: session.user_college,
        department: session.user_department,
        designation: session.user_designation,
        status: session.user_status
    };

    // If request arrived within the 30-second grace window of a previous rotation,
    // fulfill without re-rotating so client doesn't desync with the newly generated token.
    if (isGracePeriodReuse) {
        return {
            valid: true,
            sessionId: session.id,
            deviceId: session.device_id,
            newRefreshToken: rawRefreshToken,
            user: updatedUser
        };
    }

    // ROTATE REFRESH TOKEN: Generate brand new token for this session
    const newRawRefreshToken = crypto.randomBytes(48).toString('hex');
    const newTokenHash = hashToken(newRawRefreshToken);

    // Refresh expiration window: 30 days from now
    const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    try {
        db.prepare(`
            UPDATE user_sessions 
            SET prev_refresh_token_hash = refresh_token_hash,
                rotated_at = datetime('now'),
                refresh_token_hash = ?, 
                last_active_at = datetime('now'),
                expires_at = ?,
                ip_address = CASE WHEN ? != '' THEN ? ELSE ip_address END,
                user_agent = CASE WHEN ? != '' THEN ? ELSE user_agent END
            WHERE id = ?
        `).run(newTokenHash, newExpiresAt, ip, ip, userAgent, userAgent, session.id);
    } catch (updateErr) {
        // Fallback if prev_refresh_token_hash column is not present
        db.prepare(`
            UPDATE user_sessions 
            SET refresh_token_hash = ?, 
                last_active_at = datetime('now'),
                expires_at = ?,
                ip_address = CASE WHEN ? != '' THEN ? ELSE ip_address END,
                user_agent = CASE WHEN ? != '' THEN ? ELSE user_agent END
            WHERE id = ?
        `).run(newTokenHash, newExpiresAt, ip, ip, userAgent, userAgent, session.id);
    }

    try {
        db.pragma('wal_checkpoint(TRUNCATE)');
    } catch (e) {}

    return {
        valid: true,
        sessionId: session.id,
        deviceId: session.device_id,
        newRefreshToken: newRawRefreshToken,
        user: updatedUser
    };
}

/**
 * Checks if a specific device is already trusted and has an active unexpired session.
 */
function isDeviceTrusted(db, userId, deviceId) {
    if (!userId || !deviceId) return false;
    try {
        const row = db.prepare(`
            SELECT id FROM user_sessions 
            WHERE user_id = ? AND device_id = ? AND is_revoked = 0 AND expires_at > datetime('now')
            LIMIT 1
        `).get(userId, deviceId);
        return Boolean(row);
    } catch (e) {
        return false;
    }
}

/**
 * Retrieves all active non-revoked sessions for a user, marking the current session.
 */
function getUserSessions(db, userId, currentDeviceId = '', currentSessionId = null) {
    if (!userId) return [];
    try {
        const rows = db.prepare(`
            SELECT id, device_id, device_name, device_type, platform, browser, 
                   ip_address, created_at, last_active_at, expires_at
            FROM user_sessions
            WHERE user_id = ? AND is_revoked = 0 AND expires_at > datetime('now')
            ORDER BY last_active_at DESC
        `).all(userId);

        return rows.map(r => ({
            id: r.id,
            deviceId: r.device_id,
            deviceName: r.device_name || 'Authorized Device',
            deviceType: r.device_type || 'desktop',
            platform: r.platform || 'web',
            browser: r.browser || 'Browser',
            ipAddress: r.ip_address || '—',
            createdAt: r.created_at,
            lastActiveAt: r.last_active_at,
            expiresAt: r.expires_at,
            isCurrent: Boolean(
                (currentSessionId && r.id === Number(currentSessionId)) ||
                (currentDeviceId && r.device_id === currentDeviceId)
            )
        }));
    } catch (e) {
        console.error('Failed to get user sessions:', e.message);
        return [];
    }
}

/**
 * Revokes a specific session by its primary ID.
 */
function revokeSession(db, userId, sessionId) {
    if (!userId || !sessionId) return false;
    try {
        const res = db.prepare(`
            UPDATE user_sessions 
            SET is_revoked = 1 
            WHERE user_id = ? AND id = ?
        `).run(userId, sessionId);

        try {
            db.pragma('wal_checkpoint(TRUNCATE)');
        } catch (e) {}

        return res.changes > 0;
    } catch (e) {
        console.error('Failed to revoke session:', e.message);
        return false;
    }
}

/**
 * Revokes the session for a specific deviceId (used on regular logout from that device).
 */
function revokeDeviceSession(db, userId, deviceId) {
    if (!userId || !deviceId) return false;
    try {
        const res = db.prepare(`
            UPDATE user_sessions 
            SET is_revoked = 1 
            WHERE user_id = ? AND device_id = ? AND is_revoked = 0
        `).run(userId, deviceId);

        try {
            db.pragma('wal_checkpoint(TRUNCATE)');
        } catch (e) {}

        return res.changes > 0;
    } catch (e) {
        console.error('Failed to revoke device session:', e.message);
        return false;
    }
}

/**
 * Revokes all sessions for a user EXCEPT the current device (Log out all other devices).
 */
function revokeOtherSessions(db, userId, currentDeviceId) {
    if (!userId) return false;
    try {
        let query = 'UPDATE user_sessions SET is_revoked = 1 WHERE user_id = ? AND is_revoked = 0';
        const params = [userId];
        if (currentDeviceId) {
            query += ' AND device_id != ?';
            params.push(currentDeviceId);
        }
        const res = db.prepare(query).run(...params);

        try {
            db.pragma('wal_checkpoint(TRUNCATE)');
        } catch (e) {}

        return res.changes;
    } catch (e) {
        console.error('Failed to revoke other sessions:', e.message);
        return 0;
    }
}

/**
 * Revokes ALL sessions for a user across all devices.
 */
function revokeAllSessions(db, userId) {
    if (!userId) return false;
    try {
        const res = db.prepare(`
            UPDATE user_sessions 
            SET is_revoked = 1 
            WHERE user_id = ? AND is_revoked = 0
        `).run(userId);

        try {
            db.pragma('wal_checkpoint(TRUNCATE)');
        } catch (e) {}

        return res.changes;
    } catch (e) {
        console.error('Failed to revoke all sessions:', e.message);
        return 0;
    }
}

module.exports = {
    parseUserAgent,
    hashToken,
    createSession,
    verifyAndRotateSession,
    isDeviceTrusted,
    getUserSessions,
    revokeSession,
    revokeDeviceSession,
    revokeOtherSessions,
    revokeAllSessions
};

