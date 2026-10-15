const https = require('https');

https.get('https://cle-attendance.pages.dev', res => {
    let html = '';
    res.on('data', c => html += c);
    res.on('end', () => {
        const match = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
        console.log('Script match:', match ? match[1] : 'none');
        if (match) {
            https.get('https://cle-attendance.pages.dev' + match[1], r2 => {
                let js = '';
                r2.on('data', c => js += c);
                r2.on('end', () => {
                    console.log('Script size:', js.length);
                    const urls = js.match(/https:\/\/[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+\/api/g) || [];
                    console.log('API URLs:', [...new Set(urls)]);
                    const has123456 = js.includes('123456');
                    const hasDemo = js.toLowerCase().includes('demo');
                    console.log('Includes 123456:', has123456);
                    console.log('Includes demo:', hasDemo);
                    
                    // Look for OTP dialog or messages in JS
                    const otpMatches = js.match(/.{0,50}(?:demo|123456|otp).{0,50}/gi) || [];
                    console.log('Sample OTP context matches (first 5):', otpMatches.slice(0, 5));
                });
            });
        }
    });
});
