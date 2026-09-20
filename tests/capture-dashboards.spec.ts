import { test } from '@playwright/test';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/Sumit/.gemini/antigravity-ide/brain/01823176-37f0-4081-b49f-5a9da27b3cbb';

const staffUser = { id: 101, name: 'Prof. Ramesh Kulkarni', phone: '9876543210', role: 'staff' };
const adminUser = { id: 1, name: 'Dr. Ashok Patil', phone: '9999999999', role: 'admin' };
const principalUser = { id: 2, name: 'Principal Suresh Desai', phone: '8888888888', role: 'hoi' };

const mockDailyReport = [
  { name: 'Prof. Ramesh Kulkarni', department: 'Computer Science', status: 'present', punch_in: '09:05 AM', punch_out: null, role: 'staff' },
  { name: 'Dr. Ananya Sharma', department: 'Electronics', status: 'late', punch_in: '09:25 AM', punch_out: null, role: 'staff' },
  { name: 'Prof. Vikram Joshi', department: 'Mechanical', status: 'absent', punch_in: null, punch_out: null, role: 'staff' },
  { name: 'Prof. Meera Rao', department: 'Civil', status: 'leave', punch_in: null, punch_out: null, role: 'staff' },
  { name: 'Prof. Sanjay Hegde', department: 'Electrical', status: 'od', punch_in: null, punch_out: null, role: 'staff' }
];

const mockLeaves = [
  { id: 1, name: 'Prof. Meera Rao', role: 'STAFF', department: 'Civil', type: 'casual', start_date: '2026-09-18', end_date: '2026-09-19', reason: 'Personal work', status: 'pending' },
  { id: 2, name: 'Prof. Ramesh Kulkarni', role: 'STAFF', department: 'Computer Science', type: 'sick', start_date: '2026-09-10', end_date: '2026-09-11', reason: 'Fever', status: 'approved' }
];

const mockODs = [
  { id: 1, name: 'Prof. Sanjay Hegde', role: 'STAFF', department: 'Electrical', place: 'VTU Belagavi', date: '2026-09-18', purpose: 'Conference', status: 'pending' },
  { id: 2, name: 'Dr. Ananya Sharma', role: 'STAFF', department: 'Electronics', place: 'NITK Surathkal', date: '2026-09-05', purpose: 'Workshop', status: 'approved' }
];

async function setupMockApi(page: any, user: any) {
  await page.route('**/api/**', async (route: any) => {
    const pathName = new URL(route.request().url()).pathname;
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (pathName.endsWith('/auth/verify-token')) return json({ user });
    if (pathName.endsWith('/attendance/status')) {
      return json({ punchedIn: false, punchedOut: false, record: null });
    }
    if (pathName.endsWith('/attendance/history')) return json([]);
    if (pathName.includes('/reports/daily')) return json({ report: mockDailyReport });
    if (pathName.includes('/requests/leaves')) return json(mockLeaves);
    if (pathName.includes('/requests/od')) return json(mockODs);
    return json([]);
  });
}

test('Capture Screenshots of all dashboards', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });

  // 1. Login Page
  await setupMockApi(page, staffUser);
  await page.goto('/login');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_login.png'), fullPage: true });

  // 2. Staff Dashboard
  await page.evaluate((u) => {
    localStorage.setItem('token', 'valid-test-token');
    localStorage.setItem('user', JSON.stringify(u));
  }, staffUser);
  await page.goto('/dashboard');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_staff_dashboard.png'), fullPage: true });

  // 3. Principal (HOI) Dashboard
  await setupMockApi(page, principalUser);
  await page.evaluate((u) => {
    localStorage.setItem('token', 'valid-test-token');
    localStorage.setItem('user', JSON.stringify(u));
  }, principalUser);
  await page.goto('/dashboard');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_principal_dashboard.png'), fullPage: true });

  // 4. Administrator Dashboard
  await setupMockApi(page, adminUser);
  await page.evaluate((u) => {
    localStorage.setItem('token', 'valid-test-token');
    localStorage.setItem('user', JSON.stringify(u));
  }, adminUser);
  await page.goto('/dashboard');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_admin_dashboard.png'), fullPage: true });
});
