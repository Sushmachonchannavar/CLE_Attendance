const jwt = require('jsonwebtoken');

const FALLBACK_JWT_SECRET = 'cle_secret_key_minimum_32_characters_prod_fallback';
const getJwtSecret = () => process.env.JWT_SECRET || FALLBACK_JWT_SECRET;

function extractToken(req) {
    // 1. Authorization Bearer header (used by mobile apps, Capacitor, CLI, API clients)
    const authHeader = req.header ? req.header('Authorization') : req.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const bearer = authHeader.substring(7).trim();
        if (bearer) return bearer;
    }

    // 2. Cookie parser (req.cookies.token)
    if (req.cookies && req.cookies.token) {
        return req.cookies.token;
    }

    // 3. Fallback header cookie parsing
    if (req.headers && req.headers.cookie) {
        const match = req.headers.cookie.match(/(?:^|;\s*)token=([^;]+)/);
        if (match && match[1]) {
            return decodeURIComponent(match[1]);
        }
    }

    return null;
}

module.exports = (req, res, next) => {
    const jwtSecret = getJwtSecret();
    const token = extractToken(req);
    if (!token) {
        return res.status(401).json({ error: 'Access denied. No valid authentication session or token provided.' });
    }

    try {
        const decoded = jwt.verify(token, jwtSecret);
        if (!decoded || !decoded.id || !decoded.role) {
            return res.status(401).json({ error: 'Invalid token payload.' });
        }

        // Verify if session has been explicitly revoked in SQLite
        if (decoded.sessionId) {
            try {
                const db = require('../database');
                const sess = db.prepare('SELECT is_revoked, expires_at FROM user_sessions WHERE id = ?').get(decoded.sessionId);
                if (sess && (sess.is_revoked === 1 || new Date(sess.expires_at) <= new Date())) {
                    return res.status(401).json({ error: 'Session has been revoked or expired.' });
                }
            } catch (dbErr) {
                // Table might not exist yet during initial boot
            }
        }

        req.user = {
            id: decoded.id,
            role: decoded.role.toLowerCase(),
            employeeId: decoded.employeeId,
            phone: decoded.phone,
            sessionId: decoded.sessionId || null,
            deviceId: decoded.deviceId || (req.headers && (req.headers['x-device-id'] || req.headers['X-Device-Id'])) || (req.header ? req.header('x-device-id') : null) || null
        };
        next();
    } catch (ex) {
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }
};
