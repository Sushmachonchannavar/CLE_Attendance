const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

// Simple static server for frontend/dist
const distDir = path.resolve(__dirname, '../frontend/dist');
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  let filePath = path.join(distDir, req.url.split('?')[0]);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, 'index.html');
  }
  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end('Error');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

async function runTest() {
  await new Promise(resolve => server.listen(4173, resolve));
  console.log('Production static server running on http://localhost:4173');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Listen to console and network errors
  page.on('console', msg => console.log('[BROWSER CONSOLE]', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('[BROWSER ERROR]', err.message));
  page.on('dialog', async dialog => {
    console.log('[DIALOG]', dialog.message());
    await dialog.dismiss();
  });

  const demoRoles = [
    { name: 'Principal', phone: '8888888888', dashboardText: 'Principal Portal' },
    { name: 'Admin', phone: '9999999999', dashboardText: 'Administrator Portal' },
    { name: 'Staff', phone: '9876543210', dashboardText: 'Faculty Member Portal' }
  ];

  for (const role of demoRoles) {
    console.log(`\n================ Testing Production Flow for ${role.name} (${role.phone}) ================`);
    await page.goto('http://localhost:4173/login');
    await page.waitForLoadState('networkidle');

    // Select role button
    const roleButton = page.locator(`button:has-text("${role.name}")`).first();
    if (await roleButton.isVisible()) {
      await roleButton.click();
      await page.waitForTimeout(200);
    }

    // Auto-fill phone via demo card or direct fill
    const demoCard = page.locator(`button:has-text("${role.phone}")`);
    if (await demoCard.isVisible()) {
      await demoCard.click();
    } else {
      await page.locator('input[type="tel"]').fill(role.phone);
    }
    await page.waitForTimeout(300);

    console.log('Sending OTP via HTTPS backend...');
    await page.locator('button:has-text("SEND OTP")').click();

    // Verify OTP modal opens
    await page.waitForSelector('h3:has-text("Verify OTP")', { timeout: 8000 });
    console.log('OTP Modal appeared successfully!');

    // Fill OTP
    const autoFillBtn = page.locator('button:has-text("Click to Auto-fill Demo OTP")');
    if (await autoFillBtn.isVisible()) {
      await autoFillBtn.click();
    } else {
      await page.locator('input[placeholder="------"]').fill('123456');
    }
    await page.waitForTimeout(300);

    console.log('Submitting OTP verification to HTTPS backend...');
    await page.locator('button:has-text("Verify & Continue")').click();

    // Wait for navigation to dashboard
    await page.waitForURL('**/dashboard', { timeout: 8000 });
    console.log(`Navigated successfully to: ${page.url()}`);

    // Check dashboard loaded
    await page.waitForSelector(`text=${role.dashboardText}`, { timeout: 5000 });
    console.log(`Verified dashboard presence for ${role.name}!`);

    // Logout to prepare for next
    await page.locator('button:has-text("Logout")').click();
    await page.waitForURL('**/login', { timeout: 5000 });
    console.log(`Logged out successfully.`);
  }

  await browser.close();
  server.close();
  console.log('\n>>> ALL PRODUCTION FLOW TESTS PASSED SUCCESSFULLY! <<<');
}

runTest().catch(err => {
  console.error('Test execution failed:', err);
  server.close();
  process.exit(1);
});
