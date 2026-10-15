const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

async function generateQRCodes() {
    const localUrl = 'http://192.168.1.36:5173/download';
    const prodUrl = 'https://attendance.clesociety.edu.in/download';

    const artifactDir = 'C:\\Users\\Sumit\\.gemini\\antigravity-ide\\brain\\72b8f696-3cd2-455e-ac9c-9f0daedf8e88';
    const frontendPublic = path.resolve(__dirname, '../../frontend/public');

    // 1. Generate Terminal QR (printed directly in terminal)
    console.log('\n======================================================');
    console.log('   SCAN THIS QR CODE ON YOUR PHONE (LOCAL WI-FI)     ');
    console.log('   URL: ' + localUrl);
    console.log('======================================================\n');
    
    const terminalQR = await QRCode.toString(localUrl, { type: 'terminal', small: true });
    console.log(terminalQR);

    // 2. Generate PNG files
    const localPngArtifact = path.join(artifactDir, 'qr_download_local.png');
    const prodPngArtifact = path.join(artifactDir, 'qr_download_production.png');
    const localPngPublic = path.join(frontendPublic, 'qr_download_local.png');

    await QRCode.toFile(localPngArtifact, localUrl, {
        width: 400,
        margin: 2,
        color: {
            dark: '#0f172a',
            light: '#ffffff'
        }
    });

    await QRCode.toFile(prodPngArtifact, prodUrl, {
        width: 400,
        margin: 2,
        color: {
            dark: '#0f172a',
            light: '#ffffff'
        }
    });

    await QRCode.toFile(localPngPublic, localUrl, {
        width: 400,
        margin: 2,
        color: {
            dark: '#0f172a',
            light: '#ffffff'
        }
    });

    // 3. Generate SVG file for high-quality printing
    const svgArtifact = path.join(artifactDir, 'qr_download_local.svg');
    await QRCode.toFile(svgArtifact, localUrl, { type: 'svg', width: 400, margin: 2 });

    console.log('✅ Generated QR Code PNGs:');
    console.log('  - Artifact Local: ' + localPngArtifact);
    console.log('  - Artifact Prod:  ' + prodPngArtifact);
    console.log('  - Public Asset:   ' + localPngPublic);
}

generateQRCodes().catch(console.error);
