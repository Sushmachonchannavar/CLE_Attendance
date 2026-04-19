const db = require('../database');
const ExcelJS = require('exceljs');

exports.getDailyReport = (req, res) => {
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

        return {
            ...user,
            status,
            punch_in: attendance?.punch_in_time || '-',

            punch_out: attendance?.punch_out_time || '-',
            location: attendance
                ? `In: ${attendance.location_lat.toFixed(4)}, ${attendance.location_lng.toFixed(4)}${attendance.location_lat_out ? ` | Out: ${attendance.location_lat_out.toFixed(4)}, ${attendance.location_lng_out.toFixed(4)}` : ''}`
                : '-',

            leave_reason: leave?.reason || '-',
            od_purpose: od?.purpose || '-'
        };
    });

    res.json({ date: queryDate, report });
};

exports.getMonthlyReport = (req, res) => {
    const { month, year } = req.query; // month (1-12), year (YYYY)
    if (!month || !year) return res.status(400).json({ error: 'Month and Year required' });

    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const endDate = `${year}-${month.toString().padStart(2, '0')}-31`; // Simple approximation

    const attendance = db.prepare(`
        SELECT a.*, u.name 
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        WHERE date BETWEEN ? AND ?
        ORDER BY date ASC
    `).all(startDate, endDate);

    res.json(attendance);
};

exports.downloadMonthlyReport = async (req, res) => {
    const { month, year } = req.query; // month (1-12), year (YYYY)
    if (!month || !year) return res.status(400).json({ error: 'Month and Year required' });

    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const endDate = `${year}-${month.toString().padStart(2, '0')}-31`; // Simple approximation

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
    res.setHeader('Content-Disposition', `attachment; filename=Monthly_Report_${month}_${year}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
};
