/* const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new Database(dbPath);

// Enable foreign key constraints
db.pragma('foreign_keys = ON');

// Initialize tables
const initDb = () => {
    // Users table
    db.prepare(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            phone TEXT UNIQUE NOT NULL,
            role TEXT DEFAULT 'staff', -- staff, hoi, admin
            department TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    // Attendance table
    db.prepare(`
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            date TEXT, -- YYYY-MM-DD
            punch_in_time TEXT,
            punch_out_time TEXT,
            location_lat REAL,
            location_lng REAL,
            type TEXT DEFAULT 'regular', -- regular, od
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    `).run();

    // Leaves table
    db.prepare(`
        CREATE TABLE IF NOT EXISTS leaves (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            type TEXT, -- sick, casual, etc.
            start_date TEXT,
            end_date TEXT,
            reason TEXT,
            status TEXT DEFAULT 'pending', -- pending, approved, rejected
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    `).run();

    // OD Requests table
    db.prepare(`
        CREATE TABLE IF NOT EXISTS od_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            purpose TEXT,
            place TEXT,
            date TEXT,
            status TEXT DEFAULT 'pending', -- pending, approved, rejected
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    `).run();

    // OTPs table
    db.prepare(`
        CREATE TABLE IF NOT EXISTS otps (
            phone TEXT PRIMARY KEY,
            otp TEXT,
            expires_at DATETIME
        )
    `).run();

    // Insert demo users if they don't exist
    db.prepare(`
        INSERT OR IGNORE INTO users (id, name, phone, role, department)
        VALUES (1, 'Admin User', '9999999999', 'admin', 'Administration')
    `).run();

    db.prepare(`
        INSERT OR IGNORE INTO users (id, name, phone, role, department)
        VALUES (2, 'Principal User', '8888888888', 'hoi', 'Principal Office')
    `).run();

    db.prepare(`
        INSERT OR IGNORE INTO users (id, name, phone, role, department)
        VALUES (100, 'Demo Staff 1', '1234567890', 'staff', 'Engineering')
    `).run();

    db.prepare(`
        INSERT OR IGNORE INTO users (id, name, phone, role, department)
        VALUES (101, 'Demo Staff 2', '9876543210', 'staff', 'HR')
    `).run();

   

    console.log("Database initialized.");
};

initDb();

module.exports = db;*/


const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new Database(dbPath);

// Enable foreign key constraints
db.pragma('foreign_keys = ON');

// Initialize tables
const initDb = () => {
    // 1. Users table
    db.prepare(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            phone TEXT UNIQUE NOT NULL,
            role TEXT DEFAULT 'staff', -- staff, hoi, admin
            college TEXT,
            department TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    // Adding college column if it doesn't exist
    try {
        db.prepare('ALTER TABLE users ADD COLUMN college TEXT').run();
    } catch (err) {
        // Column might already exist
    }

    // 2. Attendance table
    db.prepare(`
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            date TEXT, -- YYYY-MM-DD
            punch_in_time TEXT,
            punch_out_time TEXT,
            location_lat REAL,
            location_lng REAL,
            location_lat_out REAL,
            location_lng_out REAL,
            type TEXT DEFAULT 'regular', -- regular, od
            is_late INTEGER DEFAULT 0,  -- 0 for on-time, 1 for late
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    `).run();

    // Adding punch out location columns if they don't exist
    try { db.prepare('ALTER TABLE attendance ADD COLUMN location_lat_out REAL').run(); } catch (err) { }
    try { db.prepare('ALTER TABLE attendance ADD COLUMN location_lng_out REAL').run(); } catch (err) { }
    try { db.prepare('ALTER TABLE attendance ADD COLUMN is_late INTEGER DEFAULT 0').run(); } catch (err) { }



    // 3. Leaves table
    db.prepare(`
        CREATE TABLE IF NOT EXISTS leaves (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            type TEXT, -- sick, casual, etc.
            start_date TEXT,
            end_date TEXT,
            reason TEXT,
            status TEXT DEFAULT 'pending', -- pending, approved, rejected
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    `).run();

    // 4. OD Requests table
    db.prepare(`
        CREATE TABLE IF NOT EXISTS od_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            purpose TEXT,
            place TEXT,
            date TEXT,
            status TEXT DEFAULT 'pending', -- pending, approved, rejected
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    `).run();

    // 5. OTPs table
    db.prepare(`
        CREATE TABLE IF NOT EXISTS otps (
            phone TEXT PRIMARY KEY,
            otp TEXT,
            expires_at DATETIME
        )
    `).run();

    // --- SEED DATA (Demo Users) ---
    // We use INSERT OR IGNORE so these only get added once.

    db.prepare(`
        INSERT OR IGNORE INTO users (id, name, phone, role, department)
        VALUES (1, 'Admin User', '9999999999', 'admin', 'Administration')
    `).run();

    db.prepare(`
        INSERT OR IGNORE INTO users (id, name, phone, role, department)
        VALUES (2, 'Principal User', '8888888888', 'hoi', 'Principal Office')
    `).run();

    db.prepare(`
        INSERT OR IGNORE INTO users (id, name, phone, role, department)
        VALUES (100, 'Demo Staff 1', '1234567890', 'staff', 'Engineering')
    `).run();

    db.prepare(`
        INSERT OR IGNORE INTO users (id, name, phone, role, department)
        VALUES (101, 'Demo Staff 2', '9876543210', 'staff', 'HR')
    `).run();

    // --- SEED DATA (Demo Leaves) ---
    // This uses the correct ID (100) from the user we just created.
    db.prepare(`
        INSERT OR IGNORE INTO leaves (id, user_id, type, start_date, end_date, reason, status)
        VALUES (1, 100, 'Sick Leave', '2024-05-20', '2024-05-22', 'Fever and cold', 'pending')
    `).run();

    console.log("Database initialized and demo data seeded successfully.");
};

// Run initialization
initDb();

module.exports = db;
