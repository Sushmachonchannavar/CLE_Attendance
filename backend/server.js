 require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 5001;

// CORS configuration
app.use(cors({
    origin: '*',
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Role', 'X-User-Id']
}));

app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`, {
        headers: req.headers,
        body: req.body
    });
    next();
});

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/requests', require('./routes/requestRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/sms', require('./routes/smsRoutes'));

app.get('/', (req, res) => {
    res.send('Staff Attendance System API is running');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Start Server
// app.listen(PORT, () => {
//     console.log(`✅ Backend listening at http://localhost:${PORT}`);
// });