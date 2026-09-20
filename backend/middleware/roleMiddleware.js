module.exports = (roles) => {
    const normalizedRoles = roles.map(r => r.toLowerCase());
    return (req, res, next) => {
        const userRole = req.user?.role?.toLowerCase();
        if (!userRole || !normalizedRoles.includes(userRole)) {
            return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
        }
        next();
    };
};
