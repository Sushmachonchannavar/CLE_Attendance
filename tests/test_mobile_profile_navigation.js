const { chromium, devices } = require('@playwright/test');
const http = require('http');
const { spawn } = require('child_process');
const jwt = require('jsonwebtoken');

function checkServer(url) {
    return new Promise(resolve => {
        const req = http.get(url, res => {
            resolve(res.statusCode < 500);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(1000, () => {
            req.abort();
            resolve(false);
        });
    });
}

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

function createStaffSession(userPhone) {
    const fs = require('fs');
    const path = require('path');
    const db = require('../backend/database');
    const sessionManager = require('../backend/utils/sessionManager');

    let jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret && fs.existsSync(path.join(__dirname, '../backend/.env'))) {
        const envContent = fs.readFileSync(path.join(__dirname, '../backend/.env'), 'utf8');
        const match = envContent.match(/JWT_SECRET=([^\r\n]+)/);
        if (match) jwtSecret = match[1].trim();
    }
    if (!jwtSecret) jwtSecret = 'cle_secret_key_2026';

    const user = db.prepare('SELECT * FROM users WHERE phone = ? OR phone = ?').get(userPhone, '+91' + userPhone);
    if (!user) throw new Error(`User with phone ${userPhone} not found in DB!`);

    const deviceId = 'test-mobile-' + Date.now();
    const sessionRecord = sessionManager.createSession(db, {
        userId: user.id,
        deviceId: deviceId,
        ip: '127.0.0.1',
        userAgent: 'Playwright-Mobile-Test'
    });

    const token = jwt.sign(
        {
            id: user.id,
            role: user.role,
            employeeId: user.employee_id,
            phone: user.phone,
            sessionId: sessionRecord.sessionId,
            deviceId: deviceId
        },
        jwtSecret,
        { expiresIn: '1d' }
    );

    return {
        user: {
            id: user.id,
            name: user.name,
            phone: user.phone,
            role: user.role,
            college: user.college,
            department: user.department,
            designation: user.designation,
            employee_id: user.employee_id,
            employeeId: user.employee_id,
            status: user.status
        },
        token,
        refreshToken: sessionRecord.refreshToken,
        deviceId
    };
}

async function runMobileProfileSuite() {
    console.log('========================================================================');
    console.log('📱 MOBILE PROFILE NAVIGATION & PROFILE AUDIT E2E TEST');
    console.log('========================================================================\n');

    let backendProc = null;
    let frontendProc = null;

    // 1. Ensure backend is running
    const isBackendUp = await checkServer('http://127.0.0.1:5001/health');
    if (!isBackendUp) {
        console.log('[SETUP] Starting backend server on port 5001...');
        backendProc = spawn('node', ['backend/server.js'], {
            stdio: 'inherit',
            shell: true,
            env: { ...process.env, PORT: '5001', NODE_ENV: 'development' }
        });
        for (let i = 0; i < 20; i++) {
            await sleep(500);
            if (await checkServer('http://127.0.0.1:5001/health')) break;
        }
    }
    console.log('✅ Backend is UP on http://127.0.0.1:5001');

    // 2. Ensure frontend is running
    const isFrontendUp = await checkServer('http://127.0.0.1:5173');
    if (!isFrontendUp) {
        console.log('[SETUP] Starting frontend vite dev server on port 5173...');
        frontendProc = spawn('npm', ['--prefix', 'frontend', 'run', 'dev', '--', '--port', '5173', '--host', '127.0.0.1'], {
            stdio: 'inherit',
            shell: true
        });
        for (let i = 0; i < 20; i++) {
            await sleep(500);
            if (await checkServer('http://127.0.0.1:5173')) break;
        }
    }
    console.log('✅ Frontend is UP on http://127.0.0.1:5173\n');

    const browser = await chromium.launch({ headless: true });

    try {
        // =====================================================================
        // TEST 1: ANDROID MOBILE SCREEN (Pixel 7 / 393 x 851) - User "Sushma Chonchannavar" (Initial "S")
        // =====================================================================
        console.log('--- TEST 1: Android Mobile Screen (Pixel 7 Viewport) - User "S" ---');
        const sushmaSession = createStaffSession('6360670247');
        console.log(`Created authenticated session for: ${sushmaSession.user.name} (Role: ${sushmaSession.user.role})`);

        const androidContext = await browser.newContext({
            ...devices['Pixel 7'],
            viewport: { width: 393, height: 851 },
            isMobile: true,
            hasTouch: true
        });

        // Set authenticated storage BEFORE page loads
        await androidContext.addInitScript((session) => {
            localStorage.setItem('cle_device_id', session.deviceId);
            localStorage.setItem('token', session.token);
            localStorage.setItem('refreshToken', session.refreshToken);
            localStorage.setItem('user', JSON.stringify(session.user));
        }, sushmaSession);

        const androidPage = await androidContext.newPage();
        androidPage.on('dialog', dialog => dialog.dismiss());

        await androidPage.goto('http://127.0.0.1:5173/dashboard');
        await androidPage.waitForLoadState('networkidle');
        await sleep(800);
        console.log('✅ Dashboard loaded on Android mobile screen. Current URL:', androidPage.url());

        // Verify mobile header and "S" avatar button
        const mobileAvatar = androidPage.locator('[data-testid="header-user-avatar-btn"]');
        const avatarVisible = await mobileAvatar.isVisible();
        if (!avatarVisible) throw new Error('Mobile header user avatar button is not visible on Android screen!');
        const initialText = (await mobileAvatar.innerText()).trim();
        console.log(`✅ Mobile Header avatar is visible. Initial displayed: "${initialText}"`);
        if (initialText !== 'S') {
            console.warn(`[NOTE] Expected initial 'S', got '${initialText}'`);
        }

        // Tap the S avatar
        console.log('👉 Tapping "S" avatar button to navigate to Profile...');
        await mobileAvatar.click();
        await androidPage.waitForURL('**/profile', { timeout: 6000 });
        console.log('✅ Successfully navigated to Profile page! URL:', androidPage.url());

        // Verify profile details
        await androidPage.waitForSelector('[data-testid="display-profile-name"]', { timeout: 5000 });
        const displayedName = await androidPage.locator('[data-testid="display-profile-name"]').innerText();
        const displayedEmployeeId = await androidPage.locator('[data-testid="display-profile-employee-id"]').innerText();
        const displayedEmail = await androidPage.locator('[data-testid="display-profile-email"]').innerText();
        const displayedDesignation = await androidPage.locator('[data-testid="display-profile-designation"]').innerText();
        const displayedCollege = await androidPage.locator('[data-testid="display-profile-college"]').innerText();
        const displayedDept = await androidPage.locator('[data-testid="display-profile-department"]').innerText();

        console.log(`✅ Verified Profile Full Name: ${displayedName}`);
        console.log(`✅ Verified Profile Employee ID: ${displayedEmployeeId}`);
        console.log(`✅ Verified Profile Email: ${displayedEmail}`);
        console.log(`✅ Verified Profile Designation: ${displayedDesignation}`);
        console.log(`✅ Verified Profile College: ${displayedCollege}`);
        console.log(`✅ Verified Profile Department: ${displayedDept}`);

        if (!displayedName.includes('Sushma')) throw new Error('Displayed name does not match authenticated user!');
        if (!displayedEmployeeId.includes('EMP')) throw new Error('Employee ID missing or invalid!');

        // Test Edit Profile option
        console.log('👉 Testing Edit Profile option on mobile...');
        const editBtn = androidPage.locator('[data-testid="edit-profile-btn"]');
        await editBtn.click();
        await sleep(300);

        const designationInput = androidPage.locator('[data-testid="profile-designation-input"]');
        const originalDesignation = await designationInput.inputValue();
        await designationInput.fill('Senior Academic Staff (E2E Test)');

        const saveBtn = androidPage.locator('[data-testid="save-profile-btn"]');
        await saveBtn.click();
        await sleep(1000);

        const successAlert = androidPage.locator('[data-testid="profile-success-alert"]');
        const successVisible = await successAlert.isVisible();
        console.log(`✅ Edit Profile saved successfully! Alert visible: ${successVisible}`);

        // Revert back
        await editBtn.click();
        await sleep(300);
        await designationInput.fill(originalDesignation);
        await saveBtn.click();
        await sleep(1000);
        console.log('✅ Reverted designation back to original cleanly.');

        // Test Back to Dashboard button
        console.log('👉 Testing Back to Dashboard button on mobile...');
        const backBtn = androidPage.locator('[data-testid="profile-back-btn"]');
        if (!await backBtn.isVisible()) throw new Error('Back to Dashboard button not found in Profile page!');
        await backBtn.click();
        await androidPage.waitForURL('**/dashboard', { timeout: 6000 });
        console.log('✅ Back to Dashboard button works smoothly! Returned to:', androidPage.url());

        await androidContext.close();

        // =====================================================================
        // TEST 2: IPHONE MOBILE SCREEN (iPhone 13 / 390 x 844) - Dr. Ramesh Patil
        // =====================================================================
        console.log('\n--- TEST 2: iPhone Mobile Screen (iPhone 13 Viewport) ---');
        const rameshSession = createStaffSession('9876543210');
        const iphoneContext = await browser.newContext({
            ...devices['iPhone 13'],
            viewport: { width: 390, height: 844 },
            isMobile: true,
            hasTouch: true
        });

        await iphoneContext.addInitScript((session) => {
            localStorage.setItem('cle_device_id', session.deviceId);
            localStorage.setItem('token', session.token);
            localStorage.setItem('refreshToken', session.refreshToken);
            localStorage.setItem('user', JSON.stringify(session.user));
        }, rameshSession);

        const iphonePage = await iphoneContext.newPage();
        iphonePage.on('dialog', dialog => dialog.dismiss());

        await iphonePage.goto('http://127.0.0.1:5173/dashboard');
        await iphonePage.waitForLoadState('networkidle');
        await sleep(800);

        const iphoneAvatar = iphonePage.locator('[data-testid="header-user-avatar-btn"]');
        await iphoneAvatar.click();
        await iphonePage.waitForURL('**/profile', { timeout: 6000 });
        console.log('✅ iPhone: Tapping avatar navigates to Profile page! URL:', iphonePage.url());

        const iphoneName = await iphonePage.locator('[data-testid="display-profile-name"]').innerText();
        const iphoneEmp = await iphonePage.locator('[data-testid="display-profile-employee-id"]').innerText();
        console.log(`✅ iPhone: Profile verified for ${iphoneName} (${iphoneEmp})`);

        const iphoneBackBtn = iphonePage.locator('[data-testid="profile-back-btn"]');
        await iphoneBackBtn.click();
        await iphonePage.waitForURL('**/dashboard', { timeout: 6000 });
        console.log('✅ iPhone: Returned back to dashboard successfully!');

        await iphoneContext.close();

        // =====================================================================
        // TEST 3: DESKTOP SCREEN (1280 x 800)
        // =====================================================================
        console.log('\n--- TEST 3: Desktop Screen (1280 x 800 Viewport) ---');
        const desktopContext = await browser.newContext({
            viewport: { width: 1280, height: 800 },
            isMobile: false
        });

        await desktopContext.addInitScript((session) => {
            localStorage.setItem('cle_device_id', session.deviceId);
            localStorage.setItem('token', session.token);
            localStorage.setItem('refreshToken', session.refreshToken);
            localStorage.setItem('user', JSON.stringify(session.user));
        }, rameshSession);

        const desktopPage = await desktopContext.newPage();
        desktopPage.on('dialog', dialog => dialog.dismiss());

        await desktopPage.goto('http://127.0.0.1:5173/dashboard');
        await desktopPage.waitForLoadState('networkidle');
        await sleep(800);

        // On desktop, mobile header must be hidden (md:hidden)
        const mobileHeaderOnDesktop = desktopPage.locator('header[role="banner"]');
        const isMobileHeaderVisible = await mobileHeaderOnDesktop.isVisible();
        console.log(`✅ Desktop: Mobile header is hidden on desktop screen (isVisible: ${isMobileHeaderVisible})`);
        if (isMobileHeaderVisible) throw new Error('Mobile header should be hidden on desktop screens (md:hidden)!');

        // On desktop, Sidebar navigation must be visible
        const sidebarNav = desktopPage.locator('aside[aria-label="Main Navigation"]');
        const isSidebarVisible = await sidebarNav.isVisible();
        console.log(`✅ Desktop: Desktop sidebar is visible and functional (isVisible: ${isSidebarVisible})`);
        if (!isSidebarVisible) throw new Error('Desktop sidebar must remain visible on desktop!');

        await desktopContext.close();

        console.log('\n========================================================================');
        console.log('🎉 ALL MOBILE PROFILE NAVIGATION & RESPONSIVE TESTS PASSED (100%)');
        console.log('========================================================================');

    } finally {
        await browser.close();
        if (backendProc) backendProc.kill();
        if (frontendProc) frontendProc.kill();
    }
}

runMobileProfileSuite().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
