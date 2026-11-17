/**
 * Canonical Time and Date Utilities for CLE Society Attendance System
 * Timezone: Asia/Kolkata (IST = UTC + 5:30)
 */

function getKolkataDate(date = new Date()) {
    const d = (date instanceof Date) ? date : new Date(date);
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(d);
}

function getKolkataTimeString(date = new Date()) {
    const d = (date instanceof Date) ? date : new Date(date);
    return d.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour12: true
    });
}

function getKolkataHourAndMinute(date = new Date()) {
    const d = (date instanceof Date) ? date : new Date(date);
    const hour = parseInt(new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        hourCycle: 'h23'
    }).format(d), 10);
    const minute = parseInt(new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        minute: 'numeric'
    }).format(d), 10);
    return { hour, minute };
}

function isValidDateString(str) {
    if (!str || typeof str !== 'string') return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
    const parts = str.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;
    const d = new Date(year, month - 1, day);
    return d.getFullYear() === year && (d.getMonth() + 1) === month && d.getDate() === day;
}

module.exports = {
    getKolkataDate,
    getKolkataTimeString,
    getKolkataHourAndMinute,
    isValidDateString
};
