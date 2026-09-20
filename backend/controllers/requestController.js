const db = require('../database');
const fs = require('fs');
const path = require('path');

/**
 * Validates whether a string is a valid ISO calendar date (YYYY-MM-DD)
 */
function isValidISODate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && (date.getUTCMonth() + 1) === m && date.getUTCDate() === d;
}

// Leaves
exports.applyLeave = (req, res) => {
    try {
        const { type, start_date, end_date, reason } = req.body;
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const userId = req.user.id;

        if (!type || !start_date || !end_date) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Strict Date Format & Calendar Validation
        if (!isValidISODate(start_date) || !isValidISODate(end_date)) {
            return res.status(400).json({ error: 'Invalid date format. Dates must be valid calendar dates in YYYY-MM-DD format.' });
        }

        if (start_date > end_date) {
            return res.status(400).json({ error: 'Start date cannot be after end date.' });
        }

        // Check for overlapping active or pending leave applications
        const overlapping = db.prepare(`
            SELECT id, type, start_date, end_date, status 
            FROM leaves 
            WHERE user_id = ? 
              AND status != 'rejected' 
              AND NOT (end_date < ? OR start_date > ?)
            LIMIT 1
        `).get(userId, start_date, end_date);

        if (overlapping) {
            return res.status(400).json({
                error: `You already have an active or pending leave application covering this date range (${overlapping.start_date} to ${overlapping.end_date}).`
            });
        }

        const roleVal = (req.user.role === 'hoi' || req.user.role === 'principal') ? 'PRINCIPAL' : 'STAFF';

        const result = db.prepare('INSERT INTO leaves (user_id, type, start_date, end_date, reason, role) VALUES (?, ?, ?, ?, ?, ?)')
            .run(userId, type, start_date, end_date, reason, roleVal);

        res.json({ message: 'Leave applied successfully', id: result.lastInsertRowid });
    } catch (err) {
        console.error('Error applying leave:', err.message || err);
        res.status(500).json({ error: err.message || 'Failed to apply leave' });
    }
};

exports.getLeaves = (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const userId = req.user.id;
        const leaves = db.prepare(`
            SELECT l.*, rev.name as reviewer_name 
            FROM leaves l
            LEFT JOIN users rev ON l.reviewed_by = rev.id
            WHERE l.user_id = ? 
            ORDER BY l.start_date DESC
        `).all(userId);
        res.json(leaves);
    } catch (err) {
        console.error('Error fetching leaves:', err.message || err);
        res.status(500).json({ error: 'Failed to fetch leaves' });
    }
};

exports.updateLeaveStatus = (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { id } = req.params;
        const { status, reason } = req.body;
        const userRole = req.user.role?.toLowerCase();

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        // Check if leave exists
        const leave = db.prepare('SELECT * FROM leaves WHERE id = ?').get(id);
        if (!leave) {
            return res.status(404).json({ error: 'Leave request not found' });
        }

        // Role scope authorization
        if (userRole === 'admin') {
            // Admin has universal approval privilege
        } else if (userRole === 'hoi' || userRole === 'principal') {
            // Principal can only approve/reject STAFF leaves, cannot approve own or other principal leaves
            if (leave.role !== 'STAFF' || leave.user_id === req.user.id) {
                return res.status(403).json({ 
                    error: 'Forbidden. Principals are only authorized to review Staff leave requests and cannot approve their own requests.' 
                });
            }
        } else {
            return res.status(403).json({ error: 'Forbidden. Insufficient permissions to update leave status.' });
        }

        const decisionTime = new Date().toISOString();
        const decisionReason = reason && typeof reason === 'string' ? reason.trim() : null;
        const reviewerId = req.user.id;
        const reviewerRole = req.user.role?.toUpperCase() || 'UNKNOWN';
        const previousStatus = leave.status;

        const updateTx = db.transaction(() => {
            db.prepare(`
                UPDATE leaves 
                SET status = ?, reviewed_by = ?, decision_time = ?, decision_reason = ? 
                WHERE id = ?
            `).run(status, reviewerId, decisionTime, decisionReason, id);

            db.prepare(`
                INSERT INTO approval_audit_logs 
                (request_type, request_id, reviewer_id, reviewer_role, previous_status, new_status, decision_reason)
                VALUES ('leave', ?, ?, ?, ?, ?, ?)
            `).run(id, reviewerId, reviewerRole, previousStatus, status, decisionReason);
        });

        updateTx();

        res.json({ message: 'Leave status updated successfully', status, decisionTime });
    } catch (err) {
        console.error('Error updating leave status:', err.message || err);
        res.status(500).json({ error: err.message || 'Failed to update leave status' });
    }
};

// OD Requests
exports.applyOD = (req, res) => {
    try {
        const { purpose, place, date } = req.body;
        if (!req.user) {
            if (req.file) {
                try { fs.unlinkSync(req.file.path); } catch (e) {}
            }
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const userId = req.user.id;

        if (!purpose || !place || !date) {
            if (req.file) {
                try { fs.unlinkSync(req.file.path); } catch (e) {}
            }
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Strict Date Format & Calendar Validation
        if (!isValidISODate(date)) {
            if (req.file) {
                try { fs.unlinkSync(req.file.path); } catch (e) {}
            }
            return res.status(400).json({ error: 'Invalid date format. Date must be a valid calendar date in YYYY-MM-DD format.' });
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

        res.json({ message: 'OD requested successfully', id: result.lastInsertRowid });
    } catch (err) {
        console.error('Error applying OD:', err.message || err);
        if (req.file) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (e) {
                console.error('Failed to delete file on error:', e.message);
            }
        }
        res.status(500).json({ error: err.message || 'Failed to apply OD' });
    }
};

exports.getODs = (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const userId = req.user.id;
        const ods = db.prepare(`
            SELECT o.*, rev.name as reviewer_name 
            FROM od_requests o
            LEFT JOIN users rev ON o.reviewed_by = rev.id
            WHERE o.user_id = ? 
            ORDER BY o.date DESC
        `).all(userId);
        res.json(ods);
    } catch (err) {
        console.error('Error fetching ODs:', err.message || err);
        res.status(500).json({ error: 'Failed to fetch ODs' });
    }
};

exports.updateODStatus = (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { id } = req.params;
        const { status, reason } = req.body;
        const userRole = req.user.role?.toLowerCase();

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        // Check if OD exists
        const od = db.prepare('SELECT * FROM od_requests WHERE id = ?').get(id);
        if (!od) {
            return res.status(404).json({ error: 'OD request not found' });
        }

        // Role scope authorization
        if (userRole === 'admin') {
            // Admin has universal approval privilege
        } else if (userRole === 'hoi' || userRole === 'principal') {
            // Principal can only approve/reject STAFF OD requests, cannot approve own or other principal requests
            if (od.role !== 'STAFF' || od.user_id === req.user.id) {
                return res.status(403).json({ 
                    error: 'Forbidden. Principals are only authorized to review Staff OD requests and cannot approve their own requests.' 
                });
            }
        } else {
            return res.status(403).json({ error: 'Forbidden. Insufficient permissions to update OD status.' });
        }

        const decisionTime = new Date().toISOString();
        const decisionReason = reason && typeof reason === 'string' ? reason.trim() : null;
        const reviewerId = req.user.id;
        const reviewerRole = req.user.role?.toUpperCase() || 'UNKNOWN';
        const previousStatus = od.status;

        const updateTx = db.transaction(() => {
            db.prepare(`
                UPDATE od_requests 
                SET status = ?, reviewed_by = ?, decision_time = ?, decision_reason = ? 
                WHERE id = ?
            `).run(status, reviewerId, decisionTime, decisionReason, id);

            db.prepare(`
                INSERT INTO approval_audit_logs 
                (request_type, request_id, reviewer_id, reviewer_role, previous_status, new_status, decision_reason)
                VALUES ('od', ?, ?, ?, ?, ?, ?)
            `).run(id, reviewerId, reviewerRole, previousStatus, status, decisionReason);
        });

        updateTx();

        res.json({ message: 'OD status updated successfully', status, decisionTime });
    } catch (err) {
        console.error('Error updating OD status:', err.message || err);
        res.status(500).json({ error: err.message || 'Failed to update OD status' });
    }
};

exports.getAllLeaves = (req, res) => {
    try {
        const userRole = req.user?.role?.toLowerCase();
        const { role } = req.query; // 'STAFF' or 'PRINCIPAL'
        
        let query = `
            SELECT l.id, l.user_id, l.type, l.start_date, l.end_date, l.reason, l.status, l.role,
                   l.reviewed_by, l.decision_time, l.decision_reason,
                   u.name, u.phone, u.department,
                   rev.name AS reviewer_name
            FROM leaves l 
            LEFT JOIN users u ON l.user_id = u.id
            LEFT JOIN users rev ON l.reviewed_by = rev.id
        `;
        let params = [];
        let conditions = [];

        if (userRole === 'hoi' || userRole === 'principal') {
            // Principals are scoped exclusively to staff requests (and not their own)
            conditions.push("l.role = 'STAFF'");
            conditions.push("l.user_id != ?");
            params.push(req.user.id);
        } else if (userRole === 'admin') {
            if (role) {
                conditions.push("l.role = ?");
                params.push(role.toUpperCase());
            }
        } else {
            return res.status(403).json({ error: 'Forbidden. Insufficient permissions to view all leaves.' });
        }

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }
        query += ` ORDER BY l.start_date DESC`;

        const leaves = db.prepare(query).all(...params);
        res.json(leaves);
    } catch (err) {
        console.error('Error fetching all leaves:', err.message || err);
        res.status(500).json({ error: err.message || 'Failed to fetch leaves' });
    }
};

exports.getAllODs = (req, res) => {
    try {
        const userRole = req.user?.role?.toLowerCase();
        const { role } = req.query; // 'STAFF' or 'PRINCIPAL'

        let query = `
            SELECT o.id, o.user_id, o.purpose, o.place, o.date, o.status, o.role,
                   o.document_name, o.document_path, o.uploaded_at,
                   o.reviewed_by, o.decision_time, o.decision_reason,
                   u.name, u.phone, u.department,
                   rev.name AS reviewer_name
            FROM od_requests o 
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN users rev ON o.reviewed_by = rev.id
        `;
        let params = [];
        let conditions = [];

        if (userRole === 'hoi' || userRole === 'principal') {
            // Principals are scoped exclusively to staff requests (and not their own)
            conditions.push("o.role = 'STAFF'");
            conditions.push("o.user_id != ?");
            params.push(req.user.id);
        } else if (userRole === 'admin') {
            if (role) {
                conditions.push("o.role = ?");
                params.push(role.toUpperCase());
            }
        } else {
            return res.status(403).json({ error: 'Forbidden. Insufficient permissions to view all ODs.' });
        }

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }
        query += ` ORDER BY o.date DESC`;

        const ods = db.prepare(query).all(...params);
        res.json(ods);
    } catch (err) {
        console.error('Error fetching all ODs:', err.message || err);
        res.status(500).json({ error: err.message || 'Failed to fetch ODs' });
    }
};

exports.getAuditHistory = (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { type, id } = req.params;
        if (!['leave', 'od'].includes(type)) {
            return res.status(400).json({ error: 'Invalid request type. Must be leave or od.' });
        }

        let target;
        if (type === 'leave') {
            target = db.prepare('SELECT * FROM leaves WHERE id = ?').get(id);
        } else {
            target = db.prepare('SELECT * FROM od_requests WHERE id = ?').get(id);
        }

        if (!target) {
            return res.status(404).json({ error: 'Request not found.' });
        }

        const userRole = req.user.role?.toLowerCase();
        const isOwner = target.user_id === req.user.id;
        const isAdmin = userRole === 'admin';
        const isPrincipal = (userRole === 'hoi' || userRole === 'principal') && target.role === 'STAFF';

        if (!isOwner && !isAdmin && !isPrincipal) {
            return res.status(403).json({ error: 'Forbidden. You do not have permission to view this audit history.' });
        }

        const logs = db.prepare(`
            SELECT a.id, a.request_type, a.request_id, a.reviewer_id, a.reviewer_role, 
                   a.previous_status, a.new_status, a.decision_reason, a.created_at,
                   u.name as reviewer_name
            FROM approval_audit_logs a
            LEFT JOIN users u ON a.reviewer_id = u.id
            WHERE a.request_type = ? AND a.request_id = ?
            ORDER BY a.created_at ASC
        `).all(type, id);

        res.json(logs);
    } catch (err) {
        console.error('Error fetching audit history:', err.message || err);
        res.status(500).json({ error: 'Failed to fetch audit history' });
    }
};

exports.deleteLeave = (req, res) => {
    try {
        const { id } = req.params;
        const leave = db.prepare('SELECT * FROM leaves WHERE id = ?').get(id);
        if (!leave) return res.status(404).json({ error: 'Leave not found' });

        const isOwner = leave.user_id === req.user.id;
        const isAdmin = req.user.role?.toLowerCase() === 'admin';
        const isPrincipal = req.user.role?.toLowerCase() === 'hoi' || req.user.role?.toLowerCase() === 'principal';

        if (isAdmin || (isPrincipal && leave.role === 'STAFF')) {
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
        const isAdmin = req.user.role?.toLowerCase() === 'admin';
        const isPrincipal = req.user.role?.toLowerCase() === 'hoi' || req.user.role?.toLowerCase() === 'principal';

        if (isAdmin || (isPrincipal && od.role === 'STAFF')) {
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
            const uploadDir = process.env.UPLOAD_DIR
                ? path.resolve(process.env.UPLOAD_DIR)
                : path.resolve(__dirname, '../uploads/od-documents/');
            const filePath = path.resolve(uploadDir, od.document_path);
            if (filePath.startsWith(uploadDir) && fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                } catch (err) {
                    console.error('Failed to delete file from disk during deletion:', err.message);
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
        
        // Authorization check: owner, admin, or principal for staff ODs
        const userRole = req.user.role?.toLowerCase();
        const isOwner = od.user_id === req.user.id;
        const isAdmin = userRole === 'admin';
        const isPrincipalAuthorized = (userRole === 'hoi' || userRole === 'principal') && od.role === 'STAFF';

        if (!isOwner && !isAdmin && !isPrincipalAuthorized) {
            return res.status(403).json({ error: 'Access denied. You do not have permission to view this document.' });
        }

        if (!od.document_path) {
            return res.status(404).json({ error: 'No document uploaded for this request.' });
        }

        const uploadDir = process.env.UPLOAD_DIR
            ? path.resolve(process.env.UPLOAD_DIR)
            : path.resolve(__dirname, '../uploads/od-documents/');
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
        console.error('Error viewing document:', err.message || err);
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

        // Authorization check: owner, admin, or principal for staff ODs
        const userRole = req.user.role?.toLowerCase();
        const isOwner = od.user_id === req.user.id;
        const isAdmin = userRole === 'admin';
        const isPrincipalAuthorized = (userRole === 'hoi' || userRole === 'principal') && od.role === 'STAFF';

        if (!isOwner && !isAdmin && !isPrincipalAuthorized) {
            return res.status(403).json({ error: 'Access denied. You do not have permission to download this document.' });
        }

        if (!od.document_path) {
            return res.status(404).json({ error: 'No document uploaded for this request.' });
        }

        const uploadDir = process.env.UPLOAD_DIR
            ? path.resolve(process.env.UPLOAD_DIR)
            : path.resolve(__dirname, '../uploads/od-documents/');
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
        console.error('Error downloading document:', err.message || err);
        res.status(500).json({ error: 'Failed to download document.' });
    }
};
