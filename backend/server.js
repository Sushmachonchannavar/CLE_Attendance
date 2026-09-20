require('dotenv').config();
const express = require('express');
const cors = require('cors');
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

// CORS configuration
const isAllowedOrigin = (origin) => {
    // Non-browser clients (curl, mobile apps, Postman) do not send an Origin header
    if (!origin) return true;

    // Explicit configured frontend URL
    if (process.env.FRONTEND_URL) {
        const configuredUrl = process.env.FRONTEND_URL.replace(/\/$/, '');
        if (origin === configuredUrl || origin === process.env.FRONTEND_URL) {
            return true;
        }
    }

    // In production, strictly enforce FRONTEND_URL
    if (process.env.NODE_ENV === 'production') {
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

app.get('/', (req, res) => {
    res.send('Staff Attendance System API is running');
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    if (err && err.message === 'Not allowed by CORS') {
        return res.status(403).json({ error: 'Access denied: Origin not allowed by CORS policy' });
    }
    console.error('Server error:', err.message || err);
    res.status(500).json({ error: err.message || 'Internal server error' });
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;
