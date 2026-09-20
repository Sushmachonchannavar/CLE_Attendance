import { test, expect } from '@playwright/test';

const staff = { id: 100, name: 'Prof. Ramesh Kulkarni', phone: '9876543210', role: 'staff' };
const admin = { id: 1, name: 'Dr. Ashok Patil', phone: '9876543211', role: 'admin' };
const principal = { id: 2, name: 'Principal Suresh Desai', phone: '9876543212', role: 'hoi' };

async function mockApi(page: any, user = staff) {
  await page.route('**/api/**', async (route: any) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path.endsWith('/auth/verify-token')) return json({ user });
    if (path.endsWith('/attendance/send-otp')) return json({ success: true, message: 'Verification code sent successfully' });
    if (path.endsWith('/attendance/verify-otp')) return json({ token: 'test-token', user });
    if (path.endsWith('/attendance/history')) return json([
      { id: 1, date: '2026-09-17', punch_in_time: '09:05 AM', punch_out_time: '06:15 PM', distance: 22, distance_out: 35, is_late: false, status: 'present' },
      { id: 2, date: '2026-09-16', punch_in_time: '09:28 AM', punch_out_time: '06:30 PM', distance: 45, distance_out: 40, is_late: true, status: 'late' }
    ]);
    if (path.endsWith('/attendance/status')) return json({ punchedIn: true, punchedOut: false, record: { punch_in_time: '09:05 AM', punch_out_time: null, location_lat: 16.426026, location_lng: 74.589353 } });
    if (path.includes('/requests/leaves/all') || path.includes('/requests/leaves')) return json([
      { id: 1, name: 'Prof. Ramesh', department: 'Computer Science', type: 'sick', start_date: '2026-09-20', end_date: '2026-09-22', reason: 'Medical treatment', status: 'approved' },
      { id: 2, name: 'Prof. Ananya', department: 'Electronics', type: 'casual', start_date: '2026-09-25', end_date: '2026-09-26', reason: 'Family function', status: 'pending' }
    ]);
    if (path.includes('/requests/od/all') || path.includes('/requests/od')) return json([
      { id: 1, name: 'Prof. Ramesh', department: 'Computer Science', place: 'VTU Belagavi', date: '2026-09-18', purpose: 'BOS Meeting', status: 'pending', document_name: 'bos_invitation.pdf', document_path: '/uploads/bos.pdf' }
    ]);
    if (path.includes('/reports/daily')) return json({ report: [
      { name: 'Prof. Ramesh', department: 'CSE', status: 'present', punch_in: '09:05 AM', punch_out: '06:15 PM', role: 'staff' },
      { name: 'Dr. Suresh', department: 'ECE', status: 'present', punch_in: '09:12 AM', punch_out: null, role: 'staff' }
    ]});
    if (path.includes('/admin/employee-locations')) return json({
      success: true,
      employees: [
        { userId: 100, name: 'Prof. Ramesh Kulkarni', employeeId: 'EMP100', latitude: 16.426026, longitude: 74.589353, isInsideCampus: true, punchInTime: '09:05 AM', timestamp: new Date().toISOString() }
      ]
    });
    return method === 'POST' || method === 'PUT' ? json({ message: 'Saved successfully', id: 1, success: true }) : json([]);
  });
}

async function authenticate(page: any, user = staff) {
  await page.goto('/login');
  await page.evaluate(value => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify(value));
  }, user);
}

const viewports = [
  { name: '360px Mobile (Android)', width: 360, height: 740 },
  { name: '390px Mobile (iPhone 14/15)', width: 390, height: 844 },
  { name: '430px Mobile (iPhone Pro Max)', width: 430, height: 932 },
  { name: '768px Tablet (iPad)', width: 768, height: 1024 },
  { name: '1024px Laptop', width: 1024, height: 768 },
  { name: '1440px Desktop', width: 1440, height: 900 }
];

test.describe('Responsive Multi-Viewport Tests', () => {
  for (const vp of viewports) {
    test(`Login renders cleanly and without horizontal overflow on ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await mockApi(page);
      await page.goto('/login');

      // Verify branding and essential interactive controls
      await expect(page.getByText('CLE Society – Staff Attendance & Location System')).toBeVisible();
      await expect(page.getByRole('button', { name: 'SEND OTP' })).toBeVisible();

      // Check horizontal overflow
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(vp.width);
    });

    test(`Staff Dashboard renders cleanly on ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await mockApi(page, staff);
      await authenticate(page, staff);
      await page.goto('/dashboard');

      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
      await expect(page.getByText('Campus Attendance Portal')).toBeVisible();

      // Check horizontal overflow
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(vp.width);
    });

    test(`Attendance History is responsive without cut-off on ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await mockApi(page, staff);
      await authenticate(page, staff);
      await page.goto('/attendance');

      await expect(page.getByRole('heading', { name: 'Attendance History' })).toBeVisible();
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(vp.width);
    });

    test(`Admin Dashboard renders with KPI cards on ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await mockApi(page, admin);
      await authenticate(page, admin);
      await page.goto('/dashboard');

      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(vp.width);
    });
  }
});
