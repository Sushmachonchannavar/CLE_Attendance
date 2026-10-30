require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
// eslint-disable-next-line no-unused-vars
const db = require('./database');

// Require strong JWT_SECRET at server startup
const JWT_SECRET = process.env.JWT_SECRET;
const INSECURE_SECRETS = ['your_super_secret_key_change_this_in_prod', 'secret', 'jwt_secret', 'changeme', '123456'];
if (!JWT_SECRET || JWT_SECRET.trim().length < 32 || INSECURE_SECRETS.includes(JWT_SECRET.trim())) {
    console.error('\x1b[31m%s\x1b[0m', 'FATAL ERROR: A secure, strong JWT_SECRET environment variable (minimum 32 characters) must be configured before starting the server.');
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5001;
const HOST = process.env.HOST || '0.0.0.0';

// Enable trust proxy for production reverse proxy (Nginx)
app.set('trust proxy', 1);

// CORS configuration
// Log the configured FRONTEND_URL at startup so it is visible in Render/Koyeb logs
console.log(`[CORS] Configured FRONTEND_URL: ${process.env.FRONTEND_URL || '(not set — using regex patterns only)'}`);
console.log(`[CORS] NODE_ENV: ${process.env.NODE_ENV || 'development'}`);

const isAllowedOrigin = (origin) => {
    // Non-browser clients (curl, mobile apps, Postman) do not send an Origin header
    if (!origin) return true;

    // Explicit configured frontend URL(s) - support comma-separated list
    if (process.env.FRONTEND_URL) {
        const configuredUrls = process.env.FRONTEND_URL
            .split(',')
            .map(u => u.trim().replace(/\/$/, ''))
            .filter(u => u.length > 0);
        if (configuredUrls.includes(origin)) {
            console.log(`[CORS] Allowed via FRONTEND_URL list: ${origin}`);
            return true;
        }
    }

    // Allow Cloudflare Pages (including subdomains/previews) and Cloudflare Tunnels
    if (/^https:\/\/([a-zA-Z0-9-]+\.)*pages\.dev$/.test(origin) ||
        /^https:\/\/([a-zA-Z0-9-]+\.)*trycloudflare\.com$/.test(origin)) {
        console.log(`[CORS] Allowed via Cloudflare pattern: ${origin}`);
        return true;
    }

    // Allow all Vercel domains: production (*.vercel.app) and preview deployments (git branch previews)
    if (/^https:\/\/[a-zA-Z0-9][a-zA-Z0-9-]*(\.vercel\.app)$/.test(origin)) {
        console.log(`[CORS] Allowed via Vercel pattern: ${origin}`);
        return true;
    }

    // Allow Capacitor mobile app webview origins (Android & iOS)
    if (/^(capacitor|ionic|http|https):\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?$/.test(origin)) {
        return true;
    }

    // In production, strictly enforce allowed origins (deny anything not matched above)
    if (process.env.NODE_ENV === 'production') {
        console.warn(`[CORS REJECTED] Origin '${origin}' denied in production mode.`);
        return false;
    }

    // In development / local testing:
    // Allow any localhost or 127.0.0.1 on any port (5173, 5174, 5175, 3000, etc.)
    // Also allow private LAN IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x) for phone testing on local Wi-Fi
    const devOriginRegex = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;
    return devOriginRegex.test(origin);
};

app.use(cors({
    origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
            return callback(null, true);
        } else {
            console.warn(`[CORS REJECTED] Origin '${origin}' is not permitted.`);
            return callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Safe request logging middleware (without leaking headers, tokens, OTPs, phone numbers, or GPS data)
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
});

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/requests', require('./routes/requestRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/sms', require('./routes/smsRoutes'));

// Location Tracking Routes
const auth = require('./middleware/authMiddleware');
const roleMiddleware = require('./middleware/roleMiddleware');
const attendanceController = require('./controllers/attendanceController');

app.post('/api/employee/location', auth, attendanceController.updateLocation);
app.get('/api/admin/employee-locations', auth, roleMiddleware(['admin']), attendanceController.getEmployeeLocations);

// Serve static APK download directory for institutional distribution
const downloadsDir = path.resolve(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
}

app.get('/downloads/cle-attendance.apk', (req, res) => {
    const apkPath = path.join(downloadsDir, 'cle-attendance.apk');
    if (fs.existsSync(apkPath)) {
        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
        res.setHeader('Content-Disposition', 'attachment; filename="cle-attendance.apk"');
        return res.sendFile(apkPath);
    }
    res.status(404).json({
        error: 'APK package is currently being built. Please check back shortly or scan the QR code to use the web application.',
        status: 'pending_build'
    });
});

app.get('/', (req, res) => {
    res.send('Staff Attendance System API is running');
});

// Non-production CORS diagnostics: helps identify origin mismatches in staging/dev
if (process.env.NODE_ENV !== 'production') {
    app.get('/api/debug/cors', (req, res) => {
        res.json({
            origin: req.headers['origin'] || null,
            host: req.headers['host'] || null,
            configured_frontend_url: process.env.FRONTEND_URL || null,
            node_env: process.env.NODE_ENV || 'development'
        });
    });
}

app.get('/health', (req, res) => {
    try {
        db.prepare('SELECT 1').get();
        res.status(200).json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
    } catch (dbErr) {
        console.error('[HEALTH CHECK FAILED] Database error:', dbErr.message);
        res.status(500).json({ status: 'error', error: 'Database service unreachable', timestamp: new Date().toISOString() });
    }
});

app.get('/api/health', (req, res) => {
    try {
        db.prepare('SELECT 1').get();
        res.status(200).json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
    } catch (dbErr) {
        console.error('[HEALTH CHECK FAILED] Database error:', dbErr.message);
        res.status(500).json({ status: 'error', error: 'Database service unreachable', timestamp: new Date().toISOString() });
    }
});

// Diagnostic health endpoint — reports user count, DB path, and CORS config (no secrets)
// Used to verify Render/Koyeb deployment state after a redeploy or database reset
app.get('/api/health/detailed', (req, res) => {
    try {
        db.prepare('SELECT 1').get();
        const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get();
        const activeUserCount = db.prepare("SELECT COUNT(*) AS count FROM users WHERE status = 'active'").get();
        const dbPath = process.env.DATABASE_PATH || process.env.DB_FILE || '(local default)';
        const frontendUrl = process.env.FRONTEND_URL || '(not set)';
        const { CAMPUS_LAT, CAMPUS_LNG, GEOFENCE_RADIUS_METERS } = require('./controllers/attendanceController');
        res.status(200).json({
            status: 'ok',
            version: '600m-geofence',
            database: 'connected',
            timestamp: new Date().toISOString(),
            totalUsers: userCount ? userCount.count : 0,
            activeUsers: activeUserCount ? activeUserCount.count : 0,
            dbPath,
            configuredFrontendUrl: frontendUrl,
            campusCoordinates: { lat: CAMPUS_LAT, lng: CAMPUS_LNG },
            geofenceRadiusMeters: GEOFENCE_RADIUS_METERS,
            nodeEnv: process.env.NODE_ENV || 'development'
        });
    } catch (dbErr) {
        console.error('[HEALTH DETAILED FAILED]:', dbErr.message);
        res.status(500).json({ status: 'error', error: dbErr.message, timestamp: new Date().toISOString() });
    }
});

// Diagnostic public geofence status check (allows instant verification from browser)
app.get('/api/geofence/status', (req, res) => {
    const { CAMPUS_LAT, CAMPUS_LNG, GEOFENCE_RADIUS_METERS } = require('./controllers/attendanceController');
    const lat = req.query.lat ? parseFloat(req.query.lat) : CAMPUS_LAT;
    const lng = req.query.lng ? parseFloat(req.query.lng) : CAMPUS_LNG;
    
    // Haversine calculation in meters
    const R = 6371e3;
    const phi1 = (lat * Math.PI) / 180;
    const phi2 = (CAMPUS_LAT * Math.PI) / 180;
    const deltaPhi = ((CAMPUS_LAT - lat) * Math.PI) / 180;
    const deltaLambda = ((CAMPUS_LNG - lng) * Math.PI) / 180;
    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceMeters = Math.round(R * c);
    const isInside = distanceMeters <= GEOFENCE_RADIUS_METERS;

    res.json({
        status: 'ok',
        version: '600m-geofence',
        timestamp: new Date().toISOString(),
        geofenceRadiusMeters: GEOFENCE_RADIUS_METERS,
        campusCoordinates: { lat: CAMPUS_LAT, lng: CAMPUS_LNG },
        testedCoordinates: { lat, lng },
        distanceMeters,
        isInsideCampus: isInside,
        message: isInside 
            ? `Coordinates (${lat}, ${lng}) are INSIDE campus perimeter (${distanceMeters}m <= ${GEOFENCE_RADIUS_METERS}m). Punch allowed.`
            : `Coordinates (${lat}, ${lng}) are OUTSIDE campus perimeter (${distanceMeters}m > ${GEOFENCE_RADIUS_METERS}m). Punch blocked.`
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    if (err && err.message === 'Not allowed by CORS') {
        return res.status(403).json({ error: 'Access denied: Origin not allowed by CORS policy' });
    }
    console.error('Server error:', err.message || err);
    res.status(500).json({ error: err.message || 'Internal server error' });
});

// Graceful shutdown handling for systemd and PM2
const gracefulShutdown = (signal) => {
    console.log(`[SERVER] Received ${signal}. Starting graceful shutdown...`);
    try {
        if (db && typeof db.close === 'function') {
            console.log('[DATABASE] Closing SQLite database cleanly...');
            db.close();
        }
    } catch (e) {
        console.error('[DATABASE] Error closing SQLite connection:', e.message);
    }
    process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

if (require.main === module) {
    app.listen(PORT, HOST, () => {
        console.log(`Server running on http://${HOST}:${PORT}`);
    });
}

module.exports = app;
