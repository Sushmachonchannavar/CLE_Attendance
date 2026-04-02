module.exports = (roles) => {
    return (req, res, next) => {
        console.log('Role Check:', { userRole: req.user?.role, requiredRoles: roles, hasAccess: req.user && roles.includes(req.user.role) });
        
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: `Access denied. Required roles: ${roles.join(', ')}, but you have: ${req.user?.role || 'none'}` });
        }
        next();
    };
};
