const db = require('../database');
const ExcelJS = require('exceljs');

exports.getDailyReport = (req, res) => {
    try {
        const { date } = req.query; // YYYY-MM-DD
        const queryDate = date || new Date().toISOString().split('T')[0];

        // Get all users
        const users = db.prepare('SELECT id, name, phone, department, role FROM users').all();

        const report = users.map(user => {
            // Check attendance
            const attendance = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(user.id, queryDate);

            // Check leave
            const leave = db.prepare('SELECT * FROM leaves WHERE user_id = ? AND ? BETWEEN start_date AND end_date AND status = ?')
                .get(user.id, queryDate, 'approved');

            // Check OD
            const od = db.prepare('SELECT * FROM od_requests WHERE user_id = ? AND date = ? AND status = ?')
                .get(user.id, queryDate, 'approved');

            let status = 'absent';
            if (attendance) status = attendance.is_late ? 'late' : 'present';
            else if (leave) status = 'leave';
            else if (od) status = 'od';

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

        res.json({ date: queryDate, report });
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
