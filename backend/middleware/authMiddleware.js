const jwt = require('jsonwebtoken');

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
    if (!process.env.JWT_SECRET) {
        console.error('FATAL: JWT_SECRET environment variable is missing.');
        return res.status(500).json({ error: 'Server authentication configuration error.' });
    }

    const token = extractToken(req);
    if (!token) {
        return res.status(401).json({ error: 'Access denied. No valid authentication session or token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded || !decoded.id || !decoded.role) {
            return res.status(401).json({ error: 'Invalid token payload.' });
        }
        req.user = {
            id: decoded.id,
            role: decoded.role.toLowerCase(),
            employeeId: decoded.employeeId
        };
        next();
    } catch (ex) {
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }
};
