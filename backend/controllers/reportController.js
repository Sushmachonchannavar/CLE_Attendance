const db = require('../database');
const ExcelJS = require('exceljs');
const { getKolkataDate, isValidDateString } = require('../utils/time');

exports.getStaffCount = (req, res) => {
    try {
        const countRow = db.prepare(`
            SELECT COUNT(*) AS count 
            FROM users 
            WHERE LOWER(role) = 'staff' AND status IN ('active', 'approved')
        `).get();
        const totalStaff = countRow ? countRow.count : 0;

        return res.json({
            success: true,
            totalStaff,
            count: totalStaff
        });
    } catch (err) {
        console.error('Error fetching staff count:', err.message || err);
        return res.status(500).json({ error: 'Failed to fetch staff count.' });
    }
};

exports.getStaffList = (req, res) => {
    try {
        const staffList = db.prepare(`
            SELECT id, name, phone, college, department, designation, employee_id, role, status, created_at 
            FROM users 
            WHERE LOWER(role) = 'staff' AND status IN ('active', 'approved')
            ORDER BY id ASC
        `).all();

        return res.json({
            success: true,
            totalStaff: staffList.length,
            count: staffList.length,
            staff: staffList
        });
    } catch (err) {
        console.error('Error fetching staff list:', err.message || err);
        return res.status(500).json({ error: 'Failed to fetch staff list.' });
    }
};

exports.getDailyReport = (req, res) => {
    try {
        const { date } = req.query; // YYYY-MM-DD
        const queryDate = isValidDateString(date) ? date : getKolkataDate(new Date());

        // Calculate counts directly from permanent SQLite database
        const totalStaffRow = db.prepare(`
            SELECT COUNT(*) AS count 
            FROM users 
            WHERE LOWER(role) = 'staff' AND status IN ('active', 'approved')
        `).get();
        const totalStaff = totalStaffRow ? totalStaffRow.count : 0;

        const presentRow = db.prepare(`
            SELECT COUNT(DISTINCT a.user_id) AS count 
            FROM attendance a
            JOIN users u ON a.user_id = u.id
            WHERE a.date = ? AND LOWER(u.role) = 'staff' AND u.status IN ('active', 'approved')
        `).get(queryDate);
        const presentCount = presentRow ? presentRow.count : 0;

        const lateRow = db.prepare(`
            SELECT COUNT(DISTINCT a.user_id) AS count 
            FROM attendance a
            JOIN users u ON a.user_id = u.id
            WHERE a.date = ? AND LOWER(u.role) = 'staff' AND u.status IN ('active', 'approved')
              AND (a.is_late = 1 OR LOWER(a.status) = 'late')
        `).get(queryDate);
        const lateCount = lateRow ? lateRow.count : 0;
        const onTimeCount = Math.max(0, presentCount - lateCount);

        const leaveRow = db.prepare(`
            SELECT COUNT(DISTINCT l.user_id) AS count 
            FROM leaves l
            JOIN users u ON l.user_id = u.id
            WHERE ? BETWEEN l.start_date AND l.end_date 
              AND l.status = 'approved' 
              AND LOWER(u.role) = 'staff' AND u.status IN ('active', 'approved')
              AND l.user_id NOT IN (SELECT user_id FROM attendance WHERE date = ?)
        `).get(queryDate, queryDate);
        const leaveCount = leaveRow ? leaveRow.count : 0;

        const odRow = db.prepare(`
            SELECT COUNT(DISTINCT o.user_id) AS count 
            FROM od_requests o
            JOIN users u ON o.user_id = u.id
            WHERE o.date = ? 
              AND o.status = 'approved' 
              AND LOWER(u.role) = 'staff' AND u.status IN ('active', 'approved')
              AND o.user_id NOT IN (SELECT user_id FROM attendance WHERE date = ?)
        `).get(queryDate, queryDate);
        const odCount = odRow ? odRow.count : 0;

        const absentCount = Math.max(0, totalStaff - presentCount - leaveCount - odCount);

        // Get all active/approved users
        const users = db.prepare(`
            SELECT id, name, phone, college, department, designation, employee_id, role, status, created_at 
            FROM users 
            WHERE status IN ('active', 'approved')
            ORDER BY id ASC
        `).all();

        const report = users.map(user => {
            // Check attendance for this specific date
            const attendance = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(user.id, queryDate);

            // Check approved leave covering this date
            const leave = db.prepare('SELECT * FROM leaves WHERE user_id = ? AND ? BETWEEN start_date AND end_date AND status = ?')
                .get(user.id, queryDate, 'approved');

            // Check approved OD for this date
            const od = db.prepare('SELECT * FROM od_requests WHERE user_id = ? AND date = ? AND status = ?')
                .get(user.id, queryDate, 'approved');

            let status = 'absent';
            if (attendance) {
                const s = attendance.status ? attendance.status.toLowerCase() : null;
                status = (s && s !== 'absent') ? s : (attendance.is_late ? 'late' : 'present');
            } else if (leave) {
                status = 'leave';
            } else if (od) {
                status = 'od';
            }

            let locationStr = '-';
            if (attendance && attendance.location_lat != null && attendance.location_lng != null) {
                locationStr = `In: ${Number(attendance.location_lat).toFixed(4)}, ${Number(attendance.location_lng).toFixed(4)}`;
                if (attendance.location_lat_out != null && attendance.location_lng_out != null) {
                    locationStr += ` | Out: ${Number(attendance.location_lat_out).toFixed(4)}, ${Number(attendance.location_lng_out).toFixed(4)}`;
                }
            }

            return {
                ...user,
                status,
                punch_in: attendance?.punch_in_time || '-',
                punch_out: attendance?.punch_out_time || '-',
                location: locationStr,
                leave_reason: leave?.reason || '-',
                od_purpose: od?.purpose || '-'
            };
        });

        res.json({
            date: queryDate,
            summary: {
                totalStaff,
                present: presentCount,
                absent: absentCount,
                late: lateCount,
                onTime: onTimeCount,
                onLeave: leaveCount,
                onOD: odCount
            },
            report
        });
    } catch (err) {
        console.error('Error generating daily report:', err.message || err);
        res.status(500).json({ error: 'Failed to generate daily report.' });
    }
};

exports.getMonthlyReport = (req, res) => {
    try {
        const { month, year } = req.query;
        const m = parseInt(month, 10);
        const y = parseInt(year, 10);

        if (isNaN(m) || isNaN(y) || m < 1 || m > 12 || y < 2000 || y > 2100) {
            return res.status(400).json({ error: 'Valid Month (1-12) and Year (YYYY) required' });
        }

        const lastDay = new Date(y, m, 0).getDate();
        const startDate = `${y}-${m.toString().padStart(2, '0')}-01`;
        const endDate = `${y}-${m.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

        const attendance = db.prepare(`
            SELECT a.*, u.name 
            FROM attendance a
            JOIN users u ON a.user_id = u.id
            WHERE date BETWEEN ? AND ?
            ORDER BY date ASC
        `).all(startDate, endDate);

        res.json(attendance);
    } catch (err) {
        console.error('Error generating monthly report:', err.message || err);
        res.status(500).json({ error: 'Failed to generate monthly report.' });
    }
};

exports.downloadMonthlyReport = async (req, res) => {
    try {
        const { month, year } = req.query;
        const m = parseInt(month, 10);
        const y = parseInt(year, 10);

        if (isNaN(m) || isNaN(y) || m < 1 || m > 12 || y < 2000 || y > 2100) {
            return res.status(400).json({ error: 'Valid Month (1-12) and Year (YYYY) required' });
        }

        const lastDay = new Date(y, m, 0).getDate();
        const startDate = `${y}-${m.toString().padStart(2, '0')}-01`;
        const endDate = `${y}-${m.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

        const attendance = db.prepare(`
            SELECT a.*, u.name 
            FROM attendance a
            JOIN users u ON a.user_id = u.id
            WHERE date BETWEEN ? AND ?
            ORDER BY date ASC
        `).all(startDate, endDate);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Monthly Report');

        worksheet.columns = [
            { header: 'Name', key: 'name', width: 20 },
            { header: 'Date', key: 'date', width: 15 },
            { header: 'In Time', key: 'punch_in_time', width: 15 },
            { header: 'Out Time', key: 'punch_out_time', width: 15 },
            { header: 'Late', key: 'is_late', width: 10 },
        ];

        attendance.forEach(record => {
            worksheet.addRow({
                name: record.name,
                date: record.date,
                punch_in_time: record.punch_in_time || '-',
                punch_out_time: record.punch_out_time || '-',
                is_late: record.is_late ? 'Yes' : 'No'
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Monthly_Report_${m}_${y}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Error downloading monthly report:', err.message || err);
        res.status(500).json({ error: 'Failed to download monthly report.' });
    }
};
