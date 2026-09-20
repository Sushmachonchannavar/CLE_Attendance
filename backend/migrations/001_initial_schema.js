module.exports = {
    up: (db) => {
        // 1. Users table
        db.prepare(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                phone TEXT UNIQUE NOT NULL,
                role TEXT DEFAULT 'staff',
                college TEXT,
                department TEXT,
                employee_id TEXT UNIQUE,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `).run();

        // 2. Attendance table
        db.prepare(`
            CREATE TABLE IF NOT EXISTS attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                punch_in_time TEXT,
                punch_out_time TEXT,
                punch_in_utc TEXT,
                punch_out_utc TEXT,
                location_lat REAL,
                location_lng REAL,
                location_lat_out REAL,
                location_lng_out REAL,
                type TEXT DEFAULT 'regular',
                is_late INTEGER DEFAULT 0,
                role TEXT DEFAULT 'STAFF',
                distance REAL,
                distance_out REAL,
                status TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `).run();

        // 3. Leaves table
        db.prepare(`
            CREATE TABLE IF NOT EXISTS leaves (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                type TEXT,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                reason TEXT,
                status TEXT DEFAULT 'pending',
                role TEXT DEFAULT 'STAFF',
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `).run();

        // 4. OD Requests table
        db.prepare(`
            CREATE TABLE IF NOT EXISTS od_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                purpose TEXT,
                place TEXT,
                date TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                role TEXT DEFAULT 'STAFF',
                document_name TEXT,
                document_path TEXT,
                uploaded_at TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `).run();

        // 5. OTPs table
        db.prepare(`
            CREATE TABLE IF NOT EXISTS otps (
                phone TEXT PRIMARY KEY,
                otp TEXT NOT NULL,
                expires_at DATETIME NOT NULL
            )
        `).run();

        // 6. Attendance OTPs table
        db.prepare(`
            CREATE TABLE IF NOT EXISTS attendance_otps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id TEXT NOT NULL,
                otp TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL,
                is_used INTEGER DEFAULT 0
            )
        `).run();

        // 7. Employee Locations table
        db.prepare(`
            CREATE TABLE IF NOT EXISTS employee_locations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE NOT NULL,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                accuracy REAL,
                timestamp TEXT NOT NULL,
                is_inside_campus INTEGER NOT NULL,
                is_tracking INTEGER DEFAULT 1,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `).run();

        // Seed default users if they do not already exist
        const seedUsers = [
            [1, 'Admin User', '9999999999', 'admin', 'Administration', 'EMP000', 'active'],
            [2, 'Principal User', '8888888888', 'hoi', 'Principal Office', 'EMP001', 'active'],
            [100, 'Demo Staff 1', '1234567890', 'staff', 'Engineering', 'EMP100', 'active'],
            [101, 'Demo Staff 2', '9876543210', 'staff', 'HR', 'EMP101', 'active']
        ];

        const insertUser = db.prepare(`
            INSERT OR IGNORE INTO users (id, name, phone, role, department, employee_id, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const u of seedUsers) {
            insertUser.run(...u);
        }
    }
};
