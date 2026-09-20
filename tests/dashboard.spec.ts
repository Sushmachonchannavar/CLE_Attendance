import { test, expect } from '@playwright/test';

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

async function mockApiForRole(page: any, user: any) {
  await page.route('**/api/**', async (route: any) => {
    const path = new URL(route.request().url()).pathname;
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path.endsWith('/auth/verify-token')) return json({ user });
    if (path.endsWith('/attendance/status')) {
      return json({
        punchedIn: false,
        punchedOut: false,
        record: null
      });
    }
    if (path.endsWith('/attendance/history')) {
      return json([]);
    }
    if (path.includes('/reports/daily')) {
      return json({ report: mockDailyReport });
    }
    if (path.includes('/requests/leaves/all') || path.includes('/requests/leaves')) {
      return json(mockLeaves);
    }
    if (path.includes('/requests/od/all') || path.includes('/requests/od')) {
      return json(mockODs);
    }
    return json([]);
  });
}

async function authenticateAs(page: any, user: any) {
  await page.goto('/login');
  await page.evaluate((u) => {
    localStorage.setItem('token', 'valid-test-token');
    localStorage.setItem('user', JSON.stringify(u));
  }, user);
}

test.describe('Particular Dashboard Functional & Visual Verification', () => {

  test('TC-DASH-001 Principal (HOI) Dashboard renders complete executive overview and staff roster', async ({ page }) => {
    await mockApiForRole(page, principalUser);
    await authenticateAs(page, principalUser);
    await page.goto('/dashboard');

    // Welcome card verification
    await expect(page.getByText('Principal Portal')).toBeVisible();
    await expect(page.getByText(`Welcome back, ${principalUser.name}`)).toBeVisible();
    await expect(page.getByText(/CLE Society Campus/i)).toBeVisible();
    await expect(page.getByText('Live GPS Connected')).toBeVisible();

    // 5 Summary Metric Cards
    await expect(page.getByText('Total Staff', { exact: true })).toBeVisible();
    await expect(page.getByText('Present Today', { exact: true })).toBeVisible();
    await expect(page.getByText('Absent Today', { exact: true })).toBeVisible();
    await expect(page.getByText('Pending Leaves', { exact: true })).toBeVisible();
    await expect(page.getByText('Pending ODs', { exact: true })).toBeVisible();

    // Verify calculated values for Principal
    // 5 staff total in mockDailyReport
    const totalStaffCard = page.getByText('Total Staff', { exact: true }).locator('xpath=..').locator('h4');
    await expect(totalStaffCard).toHaveText('5');

    // 2 present (1 present + 1 late)
    const presentCard = page.getByText('Present Today', { exact: true }).locator('xpath=..').locator('h4');
    await expect(presentCard).toHaveText('2');

    // 1 absent
    const absentCard = page.getByText('Absent Today', { exact: true }).locator('xpath=..').locator('h4');
    await expect(absentCard).toHaveText('1');

    // Attendance Distribution Section
    await expect(page.getByRole('heading', { name: 'Attendance Distribution' })).toBeVisible();
    await expect(page.getByText('Present (On Time / Late)')).toBeVisible();
    await expect(page.getByText('Approved Leave')).toBeVisible();
    await expect(page.getByText('On Duty (OD)')).toBeVisible();

    // Today's Staff Status Table
    await expect(page.getByRole('heading', { name: "Today's Staff Status" })).toBeVisible();
    await expect(page.getByText('Prof. Ramesh Kulkarni').first()).toBeVisible();
    await expect(page.getByText('Dr. Ananya Sharma').first()).toBeVisible();
    await expect(page.getByText('Prof. Vikram Joshi').first()).toBeVisible();
    await expect(page.getByText('Prof. Meera Rao').first()).toBeVisible();
    await expect(page.getByText('Prof. Sanjay Hegde').first()).toBeVisible();
  });

  test('TC-DASH-002 Administrator Dashboard renders KPI cards and Quick Management modules with navigation', async ({ page }) => {
    await mockApiForRole(page, adminUser);
    await authenticateAs(page, adminUser);
    await page.goto('/dashboard');

    // Welcome Card
    await expect(page.getByText('Administrator Portal')).toBeVisible();
    await expect(page.getByText(`Welcome back, ${adminUser.name}`)).toBeVisible();

    // Summary Cards for Admin
    await expect(page.getByText('Total Users', { exact: true })).toBeVisible();
    await expect(page.getByText('Pending Leaves', { exact: true })).toBeVisible();
    await expect(page.getByText('Pending ODs', { exact: true })).toBeVisible();
    await expect(page.getByText('Approved', { exact: true })).toBeVisible();
    await expect(page.getByText('Rejected', { exact: true })).toBeVisible();

    // Quick Management Modules Section
    await expect(page.getByRole('heading', { name: 'Quick Management Modules' })).toBeVisible();
    
    // Quick module links on the dashboard card grid
    const leaveRequestsCard = page.getByRole('link', { name: /Leave Requests.*Review and manage/i });
    await expect(leaveRequestsCard).toBeVisible();

    const odRequestsCard = page.getByRole('link', { name: /OD Requests.*Review and authorize/i });
    await expect(odRequestsCard).toBeVisible();

    const trackingCard = page.getByRole('link', { name: /Location Tracking.*Track punched-in/i });
    await expect(trackingCard).toBeVisible();

    const reportsCard = page.getByRole('link', { name: /Reports & Logs.*Access daily/i });
    await expect(reportsCard).toBeVisible();

    // Verify clicking Leave Requests card navigates properly
    await leaveRequestsCard.click();
    await expect(page).toHaveURL(/\/leave-requests$/);
  });

  test('TC-DASH-003 Staff Dashboard renders faculty portal, action buttons, and attendance utilities', async ({ page }) => {
    await mockApiForRole(page, staffUser);
    await authenticateAs(page, staffUser);
    await page.goto('/dashboard');

    // Welcome Card
    await expect(page.getByText('Faculty Member Portal')).toBeVisible();
    await expect(page.getByText(`Welcome back, ${staffUser.name}`)).toBeVisible();

    // Attendance Panel steps
    await expect(page.getByText('Location Check')).toBeVisible();
    await expect(page.getByText('Location Verified')).toBeVisible();
    await expect(page.getByText('Punch In', { exact: true })).toBeVisible();
    await expect(page.getByText('Attendance Active')).toBeVisible();
    await expect(page.getByText('Punch Out')).toBeVisible();

    // Punch In button should be present
    const punchInBtn = page.getByRole('button', { name: /punch in/i });
    await expect(punchInBtn).toBeVisible();

    // Verification and sync controls
    await expect(page.getByRole('button', { name: /sync gps coordinate lock/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /refresh shift status/i })).toBeVisible();

    // Security & Privacy guarantee section
    await expect(page.getByText('Institutional Privacy & Security Guarantee')).toBeVisible();
  });

  test('TC-DASH-004 Dashboard handles empty reports gracefully without crashing', async ({ page }) => {
    // Route with empty responses
    await page.route('**/api/**', async (route: any) => {
      const path = new URL(route.request().url()).pathname;
      const json = (body: unknown) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

      if (path.endsWith('/auth/verify-token')) return json({ user: principalUser });
      if (path.includes('/reports/daily')) return json({ report: [] });
      if (path.includes('/requests/leaves/all')) return json([]);
      if (path.includes('/requests/od/all')) return json([]);
      return json([]);
    });

    await authenticateAs(page, principalUser);
    await page.goto('/dashboard');

    await expect(page.getByText('Principal Portal')).toBeVisible();
    await expect(page.getByText('No staff users registered.')).toBeVisible();
  });
});
