const db = require('../database');
const fs = require('fs');
const path = require('path');

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

        const roleVal = (req.user.role === 'hoi' || req.user.role === 'principal') ? 'PRINCIPAL' : 'STAFF';

        const result = db.prepare('INSERT INTO leaves (user_id, type, start_date, end_date, reason, role) VALUES (?, ?, ?, ?, ?, ?)')
            .run(userId, type, start_date, end_date, reason, roleVal);

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
            if (req.file) {
                try { fs.unlinkSync(req.file.path); } catch (e) {}
            }
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const userId = req.user.id;

        console.log('Applying OD:', { userId, purpose, place, date, file: req.file });

        if (!purpose || !place || !date) {
            if (req.file) {
                try { fs.unlinkSync(req.file.path); } catch (e) {}
            }
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'Supporting Document is mandatory.' });
        }

        const roleVal = (req.user.role === 'hoi' || req.user.role === 'principal') ? 'PRINCIPAL' : 'STAFF';

        const result = db.prepare(`
            INSERT INTO od_requests (user_id, purpose, place, date, role, document_name, document_path, uploaded_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            userId, 
            purpose, 
            place, 
            date, 
            roleVal, 
            req.file.originalname, 
            req.file.filename, 
            new Date().toISOString()
        );

        console.log('OD created with ID:', result.lastInsertRowid);
        res.json({ message: 'OD requested successfully', id: result.lastInsertRowid });
    } catch (err) {
        console.error('Error applying OD:', err.stack || err);
        if (req.file) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (e) {
                console.error('Failed to delete file on error:', e);
            }
        }
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
        const { role } = req.query; // 'STAFF' or 'PRINCIPAL'
        console.log(`Fetching all leaves for admin (filter role: ${role || 'all'})...`);
        
        let query = `
            SELECT l.id, l.user_id, l.type, l.start_date, l.end_date, l.reason, l.status, l.role,
                   u.name, u.phone, u.department 
            FROM leaves l 
            LEFT JOIN users u ON l.user_id = u.id
        `;
        let params = [];
        if (role) {
            query += ` WHERE l.role = ? `;
            params.push(role.toUpperCase());
        }
        query += ` ORDER BY l.start_date DESC`;

        const leaves = db.prepare(query).all(...params);
        console.log('Fetched leaves count:', leaves.length);
        res.json(leaves);
    } catch (err) {
        console.error('Error fetching all leaves:', err);
        res.status(500).json({ error: err.message || 'Failed to fetch leaves' });
    }
};

exports.getAllODs = (req, res) => {
    try {
        const { role } = req.query; // 'STAFF' or 'PRINCIPAL'
        console.log(`Fetching all ODs for admin (filter role: ${role || 'all'})...`);

        let query = `
            SELECT o.id, o.user_id, o.purpose, o.place, o.date, o.status, o.role,
                   o.document_name, o.document_path, o.uploaded_at,
                   u.name, u.phone, u.department 
            FROM od_requests o 
            LEFT JOIN users u ON o.user_id = u.id
        `;
        let params = [];
        if (role) {
            query += ` WHERE o.role = ? `;
            params.push(role.toUpperCase());
        }
        query += ` ORDER BY o.date DESC`;

        const ods = db.prepare(query).all(...params);
        console.log('Fetched ODs count:', ods.length);
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

        // Clean up file if present
        if (od.document_path) {
            const uploadDir = path.resolve(__dirname, '../uploads/od-documents/');
            const filePath = path.resolve(uploadDir, od.document_path);
            if (filePath.startsWith(uploadDir) && fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                } catch (err) {
                    console.error('Failed to delete file from disk during deletion:', err);
                }
            }
        }

        db.prepare('DELETE FROM od_requests WHERE id = ?').run(id);
        res.json({ message: 'OD application cleared' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.viewODDocument = (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { id } = req.params;
        const od = db.prepare('SELECT * FROM od_requests WHERE id = ?').get(id);
        if (!od) {
            return res.status(404).json({ error: 'OD request not found' });
        }
        
        // Authorization check
        const isOwner = od.user_id === req.user.id;
        const isAdminOrPrincipal = ['admin', 'hoi', 'principal'].includes(req.user.role);
        if (!isOwner && !isAdminOrPrincipal) {
            return res.status(403).json({ error: 'Access denied. You do not have permission to view this document.' });
        }

        if (!od.document_path) {
            return res.status(404).json({ error: 'No document uploaded for this request.' });
        }

        const uploadDir = path.resolve(__dirname, '../uploads/od-documents/');
        const filePath = path.resolve(uploadDir, od.document_path);

        // Path traversal protection
        if (!filePath.startsWith(uploadDir)) {
            return res.status(400).json({ error: 'Invalid document path.' });
        }

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Document file not found on server.' });
        }

        // Determine correct content-type
        const ext = path.extname(filePath).toLowerCase();
        let contentType = 'application/octet-stream';
        if (ext === '.pdf') contentType = 'application/pdf';
        else if (ext === '.png') contentType = 'image/png';
        else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', 'inline; filename="' + encodeURIComponent(od.document_name) + '"');
        res.sendFile(filePath);
    } catch (err) {
        console.error('Error viewing document:', err);
        res.status(500).json({ error: 'Failed to view document.' });
    }
};

exports.downloadODDocument = (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { id } = req.params;
        const od = db.prepare('SELECT * FROM od_requests WHERE id = ?').get(id);
        if (!od) {
            return res.status(404).json({ error: 'OD request not found' });
        }

        // Authorization check
        const isOwner = od.user_id === req.user.id;
        const isAdminOrPrincipal = ['admin', 'hoi', 'principal'].includes(req.user.role);
        if (!isOwner && !isAdminOrPrincipal) {
            return res.status(403).json({ error: 'Access denied. You do not have permission to download this document.' });
        }

        if (!od.document_path) {
            return res.status(404).json({ error: 'No document uploaded for this request.' });
        }

        const uploadDir = path.resolve(__dirname, '../uploads/od-documents/');
        const filePath = path.resolve(uploadDir, od.document_path);

        // Path traversal protection
        if (!filePath.startsWith(uploadDir)) {
            return res.status(400).json({ error: 'Invalid document path.' });
        }

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Document file not found on server.' });
        }

        res.download(filePath, od.document_name);
    } catch (err) {
        console.error('Error downloading document:', err);
        res.status(500).json({ error: 'Failed to download document.' });
    }
};
