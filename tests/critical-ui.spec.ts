import { test, expect, type Page } from '@playwright/test';

const staff = { id: 100, name: 'Test Staff', phone: '9876543210', role: 'staff' };
const admin = { id: 1, name: 'Test Admin', phone: '9876543211', role: 'admin' };

async function mockApi(page: Page, user = staff, activeShift = false) {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path.endsWith('/auth/verify-token')) return json({ user });
    if (path.endsWith('/attendance/send-otp')) return json({ success: true, message: 'Verification code sent successfully' });
    if (path.endsWith('/attendance/verify-otp')) {
      const request = route.request().postDataJSON() as { otp?: string };
      return request.otp === '123456'
        ? json({ token: 'test-token', user })
        : json({ error: 'Invalid OTP. Please try again.' }, 400);
    }
    if (path.endsWith('/attendance/history')) return json([]);
    if (path.endsWith('/attendance/status')) return json({ punchedIn: activeShift, punchedOut: false, record: null });
    if (path.includes('/requests/leaves') || path.includes('/requests/od')) return json([]);
    if (path.includes('/reports/')) return json([]);
    return method === 'POST' || method === 'PUT' ? json({ message: 'Saved successfully', id: 1 }) : json([]);
  });
}

async function authenticate(page: Page, user = staff) {
  await page.goto('/login');
  await page.evaluate(value => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify(value));
  }, user);
}

test.describe('Critical user journeys', () => {
  test('TC-UI-001 login validates required mobile number', async ({ page }) => {
    await mockApi(page);
    await page.goto('/login');
    await page.getByRole('button', { name: 'SEND OTP' }).click();
    expect(await page.locator('input[type="tel"]').evaluate(input => input.validationMessage)).toMatch(/fill out/i);
  });

  test('TC-UI-002 sends OTP and shows invalid OTP error', async ({ page }) => {
    await mockApi(page);
    await page.goto('/login');
    await page.locator('input[type="tel"]').fill('9876543210');
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', { name: 'SEND OTP' }).click();
    await expect(page.getByRole('heading', { name: 'Verify OTP' })).toBeVisible();
    await page.locator('input[placeholder="------"]').fill('000000');
    await page.getByRole('button', { name: 'Verify & Continue' }).click();
    await expect(page.getByText('Invalid OTP. Please try again.')).toBeVisible();
  });

  test('TC-UI-003 valid OTP redirects to the dashboard', async ({ page }) => {
    await mockApi(page);
    await page.goto('/login');
    await page.locator('input[type="tel"]').fill('9876543210');
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', { name: 'SEND OTP' }).click();
    await page.locator('input[placeholder="------"]').fill('123456');
    await page.getByRole('button', { name: 'Verify & Continue' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('TC-UI-004 protected routes redirect unauthenticated visitors', async ({ page }) => {
    await mockApi(page);
    await page.goto('/attendance');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('TC-UI-005 staff navigation, refresh, and logout work', async ({ page }) => {
    await mockApi(page);
    await authenticate(page);
    await page.goto('/dashboard');
    for (const [link, heading] of [['Attendance', 'Attendance History'], ['Leave Requests', 'Leave Requests'], ['OD Requests', 'OD Requests']] as const) {
      await page.getByRole('link', { name: link, exact: true }).click();
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    }
    await page.reload();
    await expect(page.getByRole('heading', { name: 'OD Requests' })).toBeVisible();
    await page.getByRole('button', { name: 'Logout' }).click();
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('TC-UI-006 admin links are visible and protected staff-only links are hidden', async ({ page }) => {
    await mockApi(page, admin);
    await authenticate(page, admin);
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: 'Leave Requests', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'OD Requests', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Location Tracking', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Attendance', exact: true })).toHaveCount(0);
  });

  test('TC-UI-007 automatically ends an active shift and logs out after repeated outside-geofence readings', async ({ page }) => {
    await mockApi(page, staff, true);
    await page.addInitScript(() => {
      let nextId = 1;
      const timers = new Map<number, number>();
      const outside = { coords: { latitude: 10, longitude: 10, accuracy: 10 } };
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
        getCurrentPosition: (success: (position: unknown) => void) => success(outside),
        watchPosition: (success: (position: unknown) => void) => {
          const id = nextId++;
          timers.set(id, window.setInterval(() => success(outside), 50));
          return id;
        },
        clearWatch: (id: number) => { const timer = timers.get(id); if (timer) clearInterval(timer); },
      }});
    });
    page.on('dialog', dialog => dialog.dismiss());
    await authenticate(page);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 });
  });
});
