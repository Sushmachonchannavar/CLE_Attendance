const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

async function run() {
    const publicUrl = 'https://cle-attendance.pages.dev/download';
    const localUrl = 'http://192.168.1.36:5173/download';

    const b64Public = await QRCode.toDataURL(publicUrl, { width: 350, margin: 2 });
    const b64Local = await QRCode.toDataURL(localUrl, { width: 350, margin: 2 });

    console.log('PUBLIC_B64_START');
    console.log(b64Public);
    console.log('PUBLIC_B64_END');

    console.log('LOCAL_B64_START');
    console.log(b64Local);
    console.log('LOCAL_B64_END');
}

run().catch(console.error);
