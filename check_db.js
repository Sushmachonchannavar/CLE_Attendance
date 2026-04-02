const db = require('./backend/database');

const users = db.prepare('SELECT * FROM users').all();
console.log('--- USERS ---');
console.table(users);

const attendance = db.prepare('SELECT * FROM attendance').all();
console.log('--- ATTENDANCE ---');
console.table(attendance);
