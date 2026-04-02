const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const userRole = req.header('X-User-Role');
    const userId = req.header('X-User-Id');

    console.log('Auth Check:', { token: token ? 'present' : 'missing', userRole, userId });

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    // Demo mode: allow mock token
    if (token === 'mock-jwt-token') {
        // Get role from the X-User-Role header (sent by frontend)
        const role = userRole || 'staff';
        const id = parseInt(userId) || 999;
        
        console.log('Mock token accepted for user:', { id, role });
        req.user = { id, role };
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('JWT token verified:', decoded);
        req.user = decoded;
        next();
    } catch (ex) {
        console.error('JWT verification failed:', ex.message);
        res.status(400).json({ error: 'Invalid token.' });
    }
};
