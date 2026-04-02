const db = require('../database');

// Leaves
exports.applyLeave = (req, res) => {
    try {
        const { type, start_date, end_date, reason } = req.body;
        if (!req.user) {
            console.error('applyLeave called without authenticated user, headers:', req.headers);
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const userId = req.user.id;

        console.log('Applying leave:', { userId, type, start_date, end_date, reason });

        if (!type || !start_date || !end_date) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const result = db.prepare('INSERT INTO leaves (user_id, type, start_date, end_date, reason) VALUES (?, ?, ?, ?, ?)')
            .run(userId, type, start_date, end_date, reason);

        console.log('Leave created with ID:', result.lastInsertRowid);
        res.json({ message: 'Leave applied successfully', id: result.lastInsertRowid });
    } catch (err) {
        console.error('Error applying leave:', err.stack || err);
        res.status(500).json({ error: err.message || 'Failed to apply leave' });
    }
};

exports.getLeaves = (req, res) => {
    try {
        if (!req.user) {
            console.error('getLeaves called without authenticated user, headers:', req.headers);
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const userId = req.user.id;
        const leaves = db.prepare('SELECT * FROM leaves WHERE user_id = ? ORDER BY start_date DESC').all(userId);
        res.json(leaves);
    } catch (err) {
        console.error('Error fetching leaves:', err.stack || err);
        res.status(500).json({ error: 'Failed to fetch leaves' });
    }
};

exports.updateLeaveStatus = (req, res) => {
    try {
        if (!req.user) {
            console.error('updateLeaveStatus called without authenticated user, headers:', req.headers);
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { id } = req.params;
        const { status } = req.body;

        console.log('Update Leave Status:', { id, status, user: req.user });

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        // Check if leave exists
        const leave = db.prepare('SELECT * FROM leaves WHERE id = ?').get(id);
        if (!leave) {
            return res.status(404).json({ error: 'Leave request not found' });
        }

        db.prepare('UPDATE leaves SET status = ? WHERE id = ?').run(status, id);
        res.json({ message: 'Leave status updated' });
    } catch (err) {
        console.error('Error updating leave status:', err.stack || err);
        res.status(500).json({ error: err.message || 'Failed to update leave status' });
    }
};

// OD Requests
exports.applyOD = (req, res) => {
    try {
        const { purpose, place, date } = req.body;
        if (!req.user) {
            console.error('applyOD called without authenticated user, headers:', req.headers);
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const userId = req.user.id;

        console.log('Applying OD:', { userId, purpose, place, date });

        if (!purpose || !place || !date) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const result = db.prepare('INSERT INTO od_requests (user_id, purpose, place, date) VALUES (?, ?, ?, ?)')
            .run(userId, purpose, place, date);

        console.log('OD created with ID:', result.lastInsertRowid);
        res.json({ message: 'OD requested successfully', id: result.lastInsertRowid });
    } catch (err) {
        console.error('Error applying OD:', err.stack || err);
        res.status(500).json({ error: err.message || 'Failed to apply OD' });
    }
};

exports.getODs = (req, res) => {
    try {
        if (!req.user) {
            console.error('getODs called without authenticated user, headers:', req.headers);
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const userId = req.user.id;
        const ods = db.prepare('SELECT * FROM od_requests WHERE user_id = ? ORDER BY date DESC').all(userId);
        res.json(ods);
    } catch (err) {
        console.error('Error fetching ODs:', err.stack || err);
        res.status(500).json({ error: 'Failed to fetch ODs' });
    }
};

exports.updateODStatus = (req, res) => {
    try {
        if (!req.user) {
            console.error('updateODStatus called without authenticated user, headers:', req.headers);
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { id } = req.params;
        const { status } = req.body;

        console.log('Update OD Status:', { id, status, user: req.user });

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        // Check if OD exists
        const od = db.prepare('SELECT * FROM od_requests WHERE id = ?').get(id);
        if (!od) {
            return res.status(404).json({ error: 'OD request not found' });
        }

        db.prepare('UPDATE od_requests SET status = ? WHERE id = ?').run(status, id);
        res.json({ message: 'OD status updated' });
    } catch (err) {
        console.error('Error updating OD status:', err.stack || err);
        res.status(500).json({ error: err.message || 'Failed to update OD status' });
    }
};

exports.getAllLeaves = (req, res) => {
    try {
        // For Admin/HOI to see all leaves
        console.log('Fetching all leaves for admin...');
        const leaves = db.prepare(`
            SELECT l.id, l.user_id, l.type, l.start_date, l.end_date, l.reason, l.status,
                   u.name, u.phone, u.department 
            FROM leaves l 
            LEFT JOIN users u ON l.user_id = u.id 
            ORDER BY l.start_date DESC
        `).all();
        console.log('Fetched leaves:', leaves);
        res.json(leaves);
    } catch (err) {
        console.error('Error fetching all leaves:', err);
        res.status(500).json({ error: err.message || 'Failed to fetch leaves' });
    }
};

exports.getAllODs = (req, res) => {
    try {
        // For Admin/HOI to see all ODs
        console.log('Fetching all ODs for admin...');
        const ods = db.prepare(`
            SELECT o.id, o.user_id, o.purpose, o.place, o.date, o.status,
                   u.name, u.phone, u.department 
            FROM od_requests o 
            LEFT JOIN users u ON o.user_id = u.id 
            ORDER BY o.date DESC
        `).all();
        console.log('Fetched ODs:', ods);
        res.json(ods);
    } catch (err) {
        console.error('Error fetching all ODs:', err);
        res.status(500).json({ error: err.message || 'Failed to fetch ODs' });
    }
};

exports.deleteLeave = (req, res) => {
    try {
        const { id } = req.params;
        const leave = db.prepare('SELECT * FROM leaves WHERE id = ?').get(id);
        if (!leave) return res.status(404).json({ error: 'Leave not found' });

        const isOwner = leave.user_id === req.user.id;
        const isAdmin = ['admin', 'hoi', 'principal'].includes(req.user.role);

        if (isAdmin) {
            // Rule: Only after 1 month
            const applyDate = new Date(leave.start_date);
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            if (applyDate > oneMonthAgo) {
                return res.status(403).json({ error: 'Admin/Principal can only clear applications older than 1 month' });
            }
        } else if (!isOwner) {
            return res.status(403).json({ error: 'You can only clear your own applications' });
        }

        db.prepare('DELETE FROM leaves WHERE id = ?').run(id);
        res.json({ message: 'Leave application cleared' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.deleteOD = (req, res) => {
    try {
        const { id } = req.params;
        const od = db.prepare('SELECT * FROM od_requests WHERE id = ?').get(id);
        if (!od) return res.status(404).json({ error: 'OD not found' });

        const isOwner = od.user_id === req.user.id;
        const isAdmin = ['admin', 'hoi', 'principal'].includes(req.user.role);

        if (isAdmin) {
            // Rule: Only after 1 month
            const applyDate = new Date(od.date);
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            if (applyDate > oneMonthAgo) {
                return res.status(403).json({ error: 'Admin/Principal can only clear applications older than 1 month' });
            }
        } else if (!isOwner) {
            return res.status(403).json({ error: 'You can only clear your own applications' });
        }

        db.prepare('DELETE FROM od_requests WHERE id = ?').run(id);
        res.json({ message: 'OD application cleared' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
