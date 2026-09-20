const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Access denied. No valid bearer token provided.' });
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
        return res.status(401).json({ error: 'Access denied. Empty token provided.' });
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
