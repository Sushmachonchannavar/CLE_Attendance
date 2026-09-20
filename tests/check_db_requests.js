const db = require('../backend/database');
const today = new Date().toISOString().split('T')[0];
console.log('Today:', today);
console.log('Leaves:', db.prepare("SELECT id, user_id, start_date, end_date, status, role FROM leaves WHERE role = 'STAFF'").all());
console.log('ODs:', db.prepare("SELECT id, user_id, date, place, status, role FROM od_requests WHERE role = 'STAFF'").all());
