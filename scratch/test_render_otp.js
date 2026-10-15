const https = require('https');

const postData = JSON.stringify({ phone: '9876543210' });

const options = {
    hostname: 'cle-attendance.onrender.com',
    port: 443,
    path: '/api/attendance/send-otp',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
};

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        console.log('Render Response Status:', res.statusCode);
        console.log('Render Response Body:', body);
    });
});

req.on('error', (e) => {
    console.error('Request Error:', e.message);
});

req.write(postData);
req.end();
