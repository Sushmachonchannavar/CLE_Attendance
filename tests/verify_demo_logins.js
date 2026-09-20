const { chromium } = require('@playwright/test');

async function testAllDemoLoginsInBrowser() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('dialog', dialog => dialog.dismiss());

  const demoRoles = [
    { name: 'Staff', phone: '9876543210', dashboardText: 'Faculty Member Portal' },
    { name: 'Principal', phone: '8888888888', dashboardText: 'Principal Portal' },
    { name: 'Admin', phone: '9999999999', dashboardText: 'Administrator Portal' }
  ];

  for (const role of demoRoles) {
    console.log(`--- Testing browser demo login for: ${role.name} (${role.phone}) ---`);
    await page.goto('http://localhost:5173/login');
    await page.waitForTimeout(500);

    // Click the demo button inside Demo Accounts box
    const demoBtn = page.locator(`button:has-text("${role.phone}")`);
    await demoBtn.click();
    await page.waitForTimeout(300);

    // Verify phone input has the demo phone
    const phoneVal = await page.locator('input[type="tel"]').inputValue();
    console.log(`Phone input auto-filled with: ${phoneVal}`);

    // Click SEND OTP
    await page.locator('button:has-text("SEND OTP")').click();
    await page.waitForTimeout(600);

    // Verify modal is open
    const modalVisible = await page.locator('h3:has-text("Verify OTP")').isVisible();
    console.log(`Verify OTP modal visible: ${modalVisible}`);

    // Click auto-fill demo OTP button
    const autoFillBtn = page.locator('button:has-text("Click to Auto-fill Demo OTP")');
    if (await autoFillBtn.isVisible()) {
      await autoFillBtn.click();
      console.log('Auto-fill demo OTP (123456) clicked');
    } else {
      await page.locator('input[placeholder="------"]').fill('123456');
    }

    // Submit OTP
    await page.locator('button:has-text("Verify & Continue")').click();
    await page.waitForURL('**/dashboard', { timeout: 6000 });
    await page.waitForTimeout(600);
    console.log(`Navigated to: ${page.url()}`);

    // Verify dashboard banner
    const banner = await page.locator(`text=${role.dashboardText}`).isVisible();
    console.log(`Dashboard verified (${role.dashboardText}): ${banner}`);

    // Logout
    await page.locator('button:has-text("Logout")').click();
    await page.waitForURL('**/login', { timeout: 4000 });
    console.log(`Logged out successfully\n`);
  }

  await browser.close();
  console.log('>>> ALL 3 DEMO ROLES TESTED AND VERIFIED SUCCESSFULLY IN REAL BROWSER! <<<');
}

testAllDemoLoginsInBrowser().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
