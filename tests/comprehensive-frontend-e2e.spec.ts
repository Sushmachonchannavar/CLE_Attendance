import { test, expect } from '@playwright/test';

// Real test user personas matching system database roles
const staffUser = {
  id: 101,
  name: 'Prof. Ramesh Kulkarni',
  phone: '9876543210',
  role: 'staff',
  department: 'Computer Science',
  college: 'CLE Society Poly'
};

const adminUser = {
  id: 1,
  name: 'Dr. Ashok Patil',
  phone: '9999999999',
  role: 'admin',
  department: 'Administration',
  college: 'CLE Society'
};

const principalUser = {
  id: 2,
  name: 'Principal Suresh Desai',
  phone: '8888888888',
  role: 'hoi',
  department: 'Principal Office',
  college: 'CLE Society Poly'
};

// Campus Coordinates
const CAMPUS_INSIDE = { latitude: 16.426026, longitude: 74.589353, accuracy: 10 };
const CAMPUS_OUTSIDE = { latitude: 16.390000, longitude: 74.500000, accuracy: 10 };

// Setup API route interception to test safely without modifying database
function setupSafeMockApi(page: any, user: any = staffUser, initialShiftState: { punchedIn: boolean; punchedOut: boolean } = { punchedIn: false, punchedOut: false }) {
  let shiftStatus = { ...initialShiftState };

  page.route('**/api/**', async (route: any) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    // Authentication endpoints
    if (path.endsWith('/auth/verify-token')) {
      return json({ user, message: 'Token is valid' });
    }
    if (path.endsWith('/attendance/send-otp')) {
      const data = route.request().postDataJSON() || {};
      const cleanPhone = (data.phone || '').replace(/\D/g, '');
      if (cleanPhone === '0000000000') {
        return json({ error: 'User not found or inactive.' }, 404);
      }
      return json({ success: true, message: 'Verification code sent successfully' });
    }
    if (path.endsWith('/attendance/verify-otp')) {
      const data = route.request().postDataJSON() || {};
      if (data.otp === '123456') {
        return json({ token: 'test-valid-jwt-token', user });
      }
      return json({ error: 'Invalid OTP. Please try again.' }, 400);
    }

    // Attendance status & punch
    if (path.endsWith('/attendance/status')) {
      return json({
        punchedIn: shiftStatus.punchedIn,
        punchedOut: shiftStatus.punchedOut,
        record: shiftStatus.punchedIn ? {
          punch_in_time: '09:05:00 AM',
          punch_out_time: shiftStatus.punchedOut ? '06:15:00 PM' : null,
          location_lat: CAMPUS_INSIDE.latitude,
          location_lng: CAMPUS_INSIDE.longitude,
          status: 'present'
        } : null
      });
    }
    if (path.endsWith('/attendance/punch')) {
      if (!shiftStatus.punchedIn) {
        shiftStatus.punchedIn = true;
        return json({ success: true, message: 'Punched in successfully' });
      } else {
        shiftStatus.punchedOut = true;
        return json({ success: true, message: 'Punched out successfully' });
      }
    }
    if (path.endsWith('/attendance/history')) {
      return json([
        { id: 1, date: '2026-09-17', punch_in_time: '09:05 AM', punch_out_time: '06:15 PM', status: 'present', distance: 15, is_late: 0 },
        { id: 2, date: '2026-09-16', punch_in_time: '09:25 AM', punch_out_time: '06:30 PM', status: 'late', distance: 30, is_late: 1 }
      ]);
    }

    // Leave endpoints
    if (path.includes('/requests/leaves/all') || path.endsWith('/requests/leaves')) {
      if (method === 'POST') {
        return json({ message: 'Leave application submitted successfully', id: 99 });
      }
      return json([
        { id: 1, name: 'Prof. Ramesh Kulkarni', role: 'STAFF', department: 'Computer Science', type: 'sick', start_date: '2026-09-20', end_date: '2026-09-22', reason: 'Medical consultation', status: 'approved' },
        { id: 2, name: 'Prof. Ananya Rao', role: 'STAFF', department: 'Electronics', type: 'casual', start_date: '2026-09-25', end_date: '2026-09-26', reason: 'Family celebration', status: 'pending' }
      ]);
    }

    // OD endpoints
    if (path.includes('/requests/od/all') || path.endsWith('/requests/od')) {
      if (method === 'POST') {
        return json({ message: 'OD application submitted successfully', id: 88 });
      }
      return json([
        { id: 1, name: 'Prof. Ramesh Kulkarni', role: 'STAFF', department: 'Computer Science', place: 'VTU Belagavi', date: '2026-09-19', purpose: 'Board of Studies Meeting', status: 'pending', document_name: 'vtu_invitation.pdf', document_path: '/uploads/doc.pdf' }
      ]);
    }

    // Request Approval / Rejection
    if (path.includes('/requests/leaves/') && (method === 'PUT' || method === 'POST')) {
      return json({ message: 'Leave status updated successfully' });
    }
    if (path.includes('/requests/od/') && (method === 'PUT' || method === 'POST')) {
      return json({ message: 'OD status updated successfully' });
    }

    // Reports
    if (path.includes('/reports/daily')) {
      return json({
        report: [
          { name: 'Prof. Ramesh Kulkarni', department: 'Computer Science', status: 'present', punch_in: '09:05 AM', punch_out: null, role: 'staff' },
          { name: 'Dr. Suresh Patil', department: 'Electronics', status: 'late', punch_in: '09:22 AM', punch_out: null, role: 'staff' },
          { name: 'Prof. Priya Hegde', department: 'Mechanical', status: 'absent', punch_in: null, punch_out: null, role: 'staff' }
        ]
      });
    }
    if (path.includes('/reports/monthly')) {
      return json([
        { name: 'Prof. Ramesh Kulkarni', date: '2026-09-01', punch_in_time: '09:05 AM', punch_out_time: '06:15 PM' }
      ]);
    }

    // Location Tracking
    if (path.includes('/admin/employee-locations')) {
      return json({
        success: true,
        employees: [
          { userId: 101, name: 'Prof. Ramesh Kulkarni', employeeId: 'EMP-9876543210', latitude: 16.426026, longitude: 74.589353, isInsideCampus: true, punchInTime: '09:05 AM', timestamp: new Date().toISOString() }
        ]
      });
    }

    return json({ success: true });
  });
}

// Authenticate helper without touching DB
async function setAuth(page: any, user: any) {
  await page.goto('/login');
  await page.evaluate((u: any) => {
    localStorage.setItem('token', 'test-valid-jwt-token');
    localStorage.setItem('user', JSON.stringify(u));
  }, user);
}

// Track console errors and network failures
function attachListeners(page: any, recordedErrors: { console: string[]; network: string[] }) {
  page.on('console', (msg: any) => {
    if (msg.type() === 'error') {
      recordedErrors.console.push(`[CONSOLE ERROR] ${msg.text()}`);
    }
  });
  page.on('response', (resp: any) => {
    if (resp.status() >= 400 && !resp.url().includes('verify-otp') && !resp.url().includes('send-otp')) {
      recordedErrors.network.push(`[HTTP ${resp.status()}] ${resp.url()}`);
    }
  });
}

test.describe('Comprehensive Real-Browser Frontend Testing Suite', () => {

  test('TC-01: App initial load, asset delivery, and redirection from root to login', async ({ page }) => {
    const errors = { console: [], network: [] };
    attachListeners(page, errors);

    await setupSafeMockApi(page);
    await page.goto('/');

    // Should automatically redirect unauthenticated visitor to /login
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('CLE Society – Staff Attendance & Location System')).toBeVisible();

    // Verify institutional logo SVG and form card are present
    await expect(page.locator('svg').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'SEND OTP' })).toBeVisible();

    expect(errors.console.length).toBe(0);
  });

  test('TC-02: Login form validation (empty inputs, short mobile, unregistered number)', async ({ page }) => {
    const errors = { console: [], network: [] };
    attachListeners(page, errors);

    page.on('dialog', dialog => dialog.dismiss());

    await setupSafeMockApi(page);
    await page.goto('/login');

    // 1. Submit empty field
    await page.getByRole('button', { name: 'SEND OTP' }).click();
    const validationMsg = await page.locator('input[type="tel"]').evaluate((input: HTMLInputElement) => input.validationMessage);
    expect(validationMsg).toMatch(/fill out/i);

    // 2. Submit short mobile number (e.g. 5 digits)
    await page.locator('input[type="tel"]').fill('98765');
    await page.getByRole('button', { name: 'SEND OTP' }).click();
    await expect(page.getByText('Please enter a valid 10-digit mobile number.')).toBeVisible();

    // 3. Submit unregistered number
    await page.locator('input[type="tel"]').fill('0000000000');
    await page.getByRole('button', { name: 'SEND OTP' }).click();
    await expect(page.getByText('User not found or inactive.')).toBeVisible();
  });

  test('TC-03: OTP Verification Modal, 45s countdown timer, and invalid OTP handling', async ({ page }) => {
    page.on('dialog', dialog => dialog.dismiss());
    await setupSafeMockApi(page);
    await page.goto('/login');

    await page.locator('input[type="tel"]').fill('9876543210');
    await page.getByRole('button', { name: 'SEND OTP' }).click();

    // OTP Modal appears
    await expect(page.getByRole('heading', { name: 'Verify OTP' })).toBeVisible();
    await expect(page.getByText(/Resend code in \d+s/i)).toBeVisible();

    // Incomplete OTP (< 6 digits): button is disabled by design
    await page.locator('input[placeholder="------"]').fill('123');
    await expect(page.getByRole('button', { name: 'Verify & Continue' })).toBeDisabled();

    // Invalid 6-digit OTP
    await page.locator('input[placeholder="------"]').fill('999999');
    await expect(page.getByRole('button', { name: 'Verify & Continue' })).toBeEnabled();
    await page.getByRole('button', { name: 'Verify & Continue' }).click();
    await expect(page.getByText('Invalid OTP. Please try again.')).toBeVisible();
  });

  test('TC-04: Successful OTP verification and redirect to Staff Dashboard', async ({ page }) => {
    page.on('dialog', dialog => dialog.dismiss());
    await setupSafeMockApi(page, staffUser);
    await page.goto('/login');

    await page.locator('input[type="tel"]').fill('9876543210');
    await page.getByRole('button', { name: 'SEND OTP' }).click();

    await page.locator('input[placeholder="------"]').fill('123456');
    await page.getByRole('button', { name: 'Verify & Continue' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText('Faculty Member Portal')).toBeVisible();
    await expect(page.getByText('Welcome back, Prof. Ramesh Kulkarni')).toBeVisible();
  });

  test('TC-05: Staff Dashboard Geofence inside vs outside campus behavior', async ({ page, context }) => {
    // 1. Outside Campus
    await context.setGeolocation(CAMPUS_OUTSIDE);
    await context.grantPermissions(['geolocation']);
    await setupSafeMockApi(page, staffUser);
    await setAuth(page, staffUser);
    await page.goto('/dashboard');

    await expect(page.getByText('OUTSIDE CAMPUS')).toBeVisible();
    await expect(page.getByText(/Geofence Enforcement Active/i)).toBeVisible();

    // Punch In button should be disabled outside
    const punchInBtn = page.getByRole('button', { name: /punch in/i });
    await expect(punchInBtn).toBeDisabled();

    // 2. Inside Campus
    await context.setGeolocation(CAMPUS_INSIDE);
    await page.getByRole('button', { name: /sync gps coordinate lock/i }).click();

    // Inside geofence badge
    await expect(page.getByText('INSIDE CAMPUS')).toBeVisible();
    await expect(punchInBtn).toBeEnabled();
  });

  test('TC-06: Staff Punch-In and Punch-Out flow and shift state transitions', async ({ page, context }) => {
    await context.setGeolocation(CAMPUS_INSIDE);
    await context.grantPermissions(['geolocation']);
    
    // Controlled shift state
    let shiftState = { punchedIn: false, punchedOut: false };
    await page.route('**/api/**', async (route: any) => {
      const path = new URL(route.request().url()).pathname;
      const json = (body: unknown, status = 200) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (path.endsWith('/auth/verify-token')) return json({ user: staffUser });
      if (path.endsWith('/attendance/send-otp')) return json({ success: true, message: 'OTP sent' });
      if (path.endsWith('/attendance/verify-otp')) {
        shiftState.punchedIn = true;
        return json({ success: true, message: 'Punched In successfully!' });
      }
      if (path.endsWith('/attendance/status')) {
        return json({
          punchedIn: shiftState.punchedIn,
          punchedOut: shiftState.punchedOut,
          record: shiftState.punchedIn ? { punch_in_time: '09:05 AM', punch_out_time: shiftState.punchedOut ? '06:15 PM' : null } : null
        });
      }
      if (path.endsWith('/attendance/punch')) {
        shiftState.punchedOut = true;
        return json({ success: true, message: 'Punched Out successfully!' });
      }
      return json([]);
    });

    await setAuth(page, staffUser);
    await page.goto('/dashboard');

    // Click Punch In
    const punchInBtn = page.getByRole('button', { name: /punch in/i });
    await expect(punchInBtn).toBeEnabled();
    await punchInBtn.click();

    // OTP Modal for Punch In Verification appears
    await expect(page.getByRole('heading', { name: 'Verify Punch-In Authorization' })).toBeVisible();
    await page.locator('input[placeholder="------"]').fill('123456');
    await page.getByRole('button', { name: 'Verify & Punch In' }).click();

    // After punching in, button transitions to Punch Out
    await expect(page.getByRole('button', { name: /punch out/i })).toBeVisible();

    // Click Punch Out
    await page.getByRole('button', { name: /punch out/i }).click();
    await expect(page.getByText("Today's Attendance Finalized")).toBeVisible();
  });

  test('TC-07: Browser location permission denial handling', async ({ page, context }) => {
    // Clear permissions to simulate location blocked
    await context.clearPermissions();
    await setupSafeMockApi(page, staffUser);
    await setAuth(page, staffUser);
    await page.goto('/dashboard');

    // Sync location attempt handles missing permission gracefully
    await page.getByRole('button', { name: /sync gps coordinate lock/i }).click();
    // System should not crash and should keep button disabled safely
    await expect(page.getByRole('button', { name: /punch in/i })).toBeDisabled();
  });

  test('TC-08: Leave application form opening, validation, and submission flow', async ({ page }) => {
    page.on('dialog', dialog => dialog.dismiss());
    await setupSafeMockApi(page, staffUser);
    await setAuth(page, staffUser);
    await page.goto('/leaves');

    await expect(page.getByRole('heading', { name: 'Leave Requests' })).toBeVisible();

    // Open Apply Leave Modal
    await page.getByRole('button', { name: 'Apply Leave' }).click();
    await expect(page.getByRole('heading', { name: 'Apply for Leave' })).toBeVisible();

    // Fill form
    await page.locator('select').selectOption('casual');
    await page.locator('input[type="date"]').first().fill('2026-09-25');
    await page.locator('input[type="date"]').nth(1).fill('2026-09-26');
    await page.locator('textarea').fill('Attending family function in Belagavi');

    // Submit
    await page.getByRole('button', { name: 'Submit Leave' }).click();

    // Modal closes
    await expect(page.getByRole('heading', { name: 'Apply for Leave' })).toHaveCount(0);
  });

  test('TC-09: OD application form opening, drag-drop file attachment, and submission flow', async ({ page }) => {
    page.on('dialog', dialog => dialog.dismiss());
    await setupSafeMockApi(page, staffUser);
    await setAuth(page, staffUser);
    await page.goto('/od');

    await expect(page.getByRole('heading', { name: 'OD Requests' })).toBeVisible();

    // Open Apply OD Modal
    await page.getByRole('button', { name: 'Apply OD' }).click();
    await expect(page.getByRole('heading', { name: 'Apply for Official Duty (OD)' })).toBeVisible();

    // Fill form
    await page.locator('#od_place').fill('VTU Belagavi Campus');
    await page.locator('input[type="date"]').fill('2026-09-28');
    await page.locator('textarea').fill('Attending curriculum revision workshop');

    // Attach document
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'invitation_letter.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 test document content')
    });
    await expect(page.getByText('invitation_letter.pdf')).toBeVisible();

    // Submit application
    await page.getByRole('button', { name: 'Submit OD' }).click();
    await expect(page.getByRole('heading', { name: 'Apply for Official Duty (OD)' })).toHaveCount(0);
  });

  test('TC-10: Admin pages (Leave Requests, OD Requests, Location Tracking, Reports)', async ({ page }) => {
    await setupSafeMockApi(page, adminUser);
    await setAuth(page, adminUser);
    await page.goto('/dashboard');

    // 1. Leave Requests page
    await page.getByRole('link', { name: /Leave Requests.*Review and manage/i }).click();
    await expect(page).toHaveURL(/\/leave-requests$/);
    await expect(page.getByRole('heading', { name: 'Leave Approval Management' })).toBeVisible();
    await expect(page.getByText('Prof. Ramesh Kulkarni')).toBeVisible();

    // 2. OD Requests page
    await page.getByRole('link', { name: 'OD Requests', exact: true }).click();
    await expect(page).toHaveURL(/\/od-requests$/);
    await expect(page.getByRole('heading', { name: 'OD Requests Management' })).toBeVisible();
    await expect(page.getByText('Board of Studies Meeting')).toBeVisible();

    // 3. Location Tracking page
    await page.getByRole('link', { name: 'Location Tracking', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/tracking$/);
    await expect(page.getByRole('heading', { name: 'Employee Location Tracking' })).toBeVisible();
    await expect(page.locator('.leaflet-container')).toBeVisible();

    // 4. Reports page
    await page.getByRole('link', { name: 'Reports', exact: true }).click();
    await expect(page).toHaveURL(/\/reports$/);
    await expect(page.getByRole('heading', { name: 'Attendance Reports' })).toBeVisible();

    // Switch to Monthly Aggregates tab to reveal Excel export action
    await page.getByRole('button', { name: 'Monthly Aggregates' }).click();
    await expect(page.getByRole('button', { name: /export excel/i })).toBeVisible();
  });

  test('TC-11: Principal (HOI) Dashboard KPI computation and faculty roster', async ({ page }) => {
    await setupSafeMockApi(page, principalUser);
    await setAuth(page, principalUser);
    await page.goto('/dashboard');

    await expect(page.getByText('Principal Portal')).toBeVisible();
    await expect(page.getByText('Welcome back, Principal Suresh Desai')).toBeVisible();

    // 5 KPI cards
    await expect(page.getByText('Total Staff', { exact: true })).toBeVisible();
    await expect(page.getByText('Present Today', { exact: true })).toBeVisible();
    await expect(page.getByText('Absent Today', { exact: true })).toBeVisible();

    // Staff roster table
    await expect(page.getByRole('heading', { name: "Today's Staff Status" })).toBeVisible();
    await expect(page.getByText('Prof. Ramesh Kulkarni')).toBeVisible();
    await expect(page.getByText('Dr. Suresh Patil')).toBeVisible();
    await expect(page.getByText('Prof. Priya Hegde')).toBeVisible();
  });

  test('TC-12: Role security boundary: Staff blocked from Admin pages', async ({ page }) => {
    await setupSafeMockApi(page, staffUser);
    await setAuth(page, staffUser);

    // Direct URL access to /admin/tracking should be blocked by AdminRoute and redirected to /dashboard
    await page.goto('/admin/tracking');
    await expect(page).toHaveURL(/\/dashboard$/);

    // Admin-only links must be absent in staff sidebar
    await expect(page.getByRole('link', { name: 'Location Tracking', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Reports', exact: true })).toHaveCount(0);
  });

  test('TC-13: Logout functionality and route guarding', async ({ page }) => {
    await setupSafeMockApi(page, staffUser);
    await setAuth(page, staffUser);
    await page.goto('/dashboard');

    // Click Logout
    await page.getByRole('button', { name: 'Logout' }).click();

    // Should redirect to /login and clear token
    await expect(page).toHaveURL(/\/login$/);
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeNull();

    // Protected route redirects to login
    await page.goto('/attendance');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('TC-14: Page reload stability across all routes without session loss', async ({ page }) => {
    await setupSafeMockApi(page, staffUser);
    await setAuth(page, staffUser);

    const routes = ['/dashboard', '/attendance', '/leaves', '/od', '/profile'];
    for (const route of routes) {
      await page.goto(route);
      await page.reload();
      // Ensure user session remains intact
      await expect(page).not.toHaveURL(/\/login$/);
      await expect(page.locator('aside').getByText('Prof. Ramesh Kulkarni')).toBeVisible();
    }
  });

  test('TC-15: Multi-viewport responsiveness (Mobile 390px, Tablet 768px, Desktop 1280px)', async ({ page }) => {
    await setupSafeMockApi(page, staffUser);
    await setAuth(page, staffUser);

    // 1. Mobile (iPhone 14: 390 x 844)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard');
    // Verify no horizontal overflow
    let scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(390);

    // Hamburger menu exists on mobile
    const hamburgerBtn = page.getByRole('button', { name: 'Open navigation menu' });
    await expect(hamburgerBtn).toBeVisible();
    await hamburgerBtn.click();
    await expect(page.getByRole('link', { name: 'Attendance', exact: true })).toBeVisible();

    // 2. Tablet (iPad: 768 x 1024)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/dashboard');
    scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(768);

    // 3. Desktop (1280 x 900)
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/dashboard');
    scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(1280);
    // Sidebar should be permanently visible on desktop
    await expect(page.getByRole('link', { name: 'Dashboard', exact: true })).toBeVisible();
  });

  test('TC-16: Console error & network health monitor during complete user journey', async ({ page, context }) => {
    const errorLog: { console: string[]; network: string[] } = { console: [], network: [] };
    attachListeners(page, errorLog);

    await context.setGeolocation(CAMPUS_INSIDE);
    await context.grantPermissions(['geolocation']);
    await setupSafeMockApi(page, staffUser);
    await setAuth(page, staffUser);

    // Browse through every key page
    await page.goto('/dashboard');
    await page.goto('/attendance');
    await page.goto('/leaves');
    await page.goto('/od');
    await page.goto('/profile');

    // Switch to Admin
    await setAuth(page, adminUser);
    await setupSafeMockApi(page, adminUser);
    await page.goto('/leave-requests');
    await page.goto('/od-requests');
    await page.goto('/admin/tracking');
    await page.goto('/reports');

    // Check captured errors
    expect(errorLog.console.length, `Unexpected console errors: ${errorLog.console.join(', ')}`).toBe(0);
    expect(errorLog.network.length, `Failed network requests: ${errorLog.network.join(', ')}`).toBe(0);
  });
});
