const { chromium } = require('@playwright/test');
const db = require('../backend/database');

async function runPrincipalApprovalTests() {
  console.log('=== STARTING PRINCIPAL DASHBOARD APPROVAL TEST ===');

  // 1. Prepare clean test staff requests in DB
  const today = '2026-09-18';
  
  // Ensure staff leave 1: Pending (to be approved)
  let leaveToApprove = db.prepare(`
    SELECT * FROM leaves 
    WHERE user_id = 101 AND status = 'pending' AND end_date >= ?
  `).get(today);

  if (!leaveToApprove) {
    const res = db.prepare(`
      INSERT INTO leaves (user_id, type, start_date, end_date, reason, status, role)
      VALUES (101, 'casual', '2026-09-24', '2026-09-26', 'Faculty Conference Belagavi', 'pending', 'STAFF')
    `).run();
    leaveToApprove = db.prepare('SELECT * FROM leaves WHERE id = ?').get(res.lastInsertRowid);
  }
  console.log(`Prepared staff leave to approve: ID ${leaveToApprove.id}`);

  // Ensure staff leave 2: Approved or Pending (to be rejected)
  let leaveToReject = db.prepare(`
    SELECT * FROM leaves 
    WHERE user_id = 101 AND status != 'rejected' AND end_date >= ? AND id != ?
  `).get(today, leaveToApprove.id);

  if (!leaveToReject) {
    const res = db.prepare(`
      INSERT INTO leaves (user_id, type, start_date, end_date, reason, status, role)
      VALUES (101, 'sick', '2026-09-28', '2026-09-29', 'Medical leave application', 'pending', 'STAFF')
    `).run();
    leaveToReject = db.prepare('SELECT * FROM leaves WHERE id = ?').get(res.lastInsertRowid);
  }
  console.log(`Prepared staff leave to reject: ID ${leaveToReject.id}`);

  // Ensure staff OD 1: Pending (to be approved)
  let odToApprove = db.prepare(`
    SELECT * FROM od_requests 
    WHERE user_id = 101 AND status = 'pending'
  `).get();

  if (!odToApprove) {
    const res = db.prepare(`
      INSERT INTO od_requests (user_id, date, place, purpose, status, role)
      VALUES (101, '2026-09-25', 'VTU Senate Belagavi', 'Academic Council Review', 'pending', 'STAFF')
    `).run();
    odToApprove = db.prepare('SELECT * FROM od_requests WHERE id = ?').get(res.lastInsertRowid);
  }
  console.log(`Prepared staff OD to approve: ID ${odToApprove.id}`);

  // Ensure staff OD 2: Approved or Pending (to be rejected)
  let odToReject = db.prepare(`
    SELECT * FROM od_requests 
    WHERE user_id = 101 AND status != 'rejected' AND id != ?
  `).get(odToApprove.id);

  if (!odToReject) {
    const res = db.prepare(`
      INSERT INTO od_requests (user_id, date, place, purpose, status, role)
      VALUES (101, '2026-09-30', 'KLE Tech Hub Hubli', 'Symposium Workshop Attendance', 'approved', 'STAFF')
    `).run();
    odToReject = db.prepare('SELECT * FROM od_requests WHERE id = ?').get(res.lastInsertRowid);
  }
  console.log(`Prepared staff OD to reject: ID ${odToReject.id}`);

  // 2. Launch browser and perform tests
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();

  page.on('dialog', async dialog => {
    console.log(`Dialog triggered: ${dialog.message()}`);
    await dialog.accept();
  });

  // TEST STEP 1: Principal Login
  console.log('\n--- Step 1: Principal Login ---');
  await page.goto('http://localhost:5173/login');
  await page.waitForTimeout(500);

  // Click demo button for Principal (8888888888)
  const demoPrincipalBtn = page.locator('button:has-text("8888888888")');
  await demoPrincipalBtn.click();
  await page.waitForTimeout(200);

  await page.locator('button:has-text("SEND OTP")').click();
  await page.waitForTimeout(600);

  // Click auto-fill demo OTP (123456)
  const autoFillBtn = page.locator('button:has-text("Click to Auto-fill Demo OTP")');
  if (await autoFillBtn.isVisible()) {
    await autoFillBtn.click();
  } else {
    await page.locator('input[placeholder="------"]').fill('123456');
  }

  await page.locator('button:has-text("Verify & Continue")').click();
  await page.waitForURL('**/dashboard', { timeout: 6000 });
  await page.waitForTimeout(600);

  const principalBanner = await page.locator('text=Principal Portal').isVisible();
  console.log(`Principal Portal Banner visible: ${principalBanner}`);
  if (!principalBanner) throw new Error('Principal portal did not load correctly.');

  // TEST STEP 2: View Staff Leave Applications on Dashboard
  console.log('\n--- Step 2: View Staff Leave Applications ---');
  const leaveDeskHeading = await page.locator('h4:has-text("Staff Leave Applications")').isVisible();
  console.log(`Staff Leave Applications Desk visible: ${leaveDeskHeading}`);
  if (!leaveDeskHeading) throw new Error('Staff Leave Applications desk not visible on Principal Dashboard.');

  // Locate leave row to approve
  const leaveApproveRow = page.locator(`[data-testid="staff-leave-row-${leaveToApprove.id}"]`);
  const leaveApproveRowVisible = await leaveApproveRow.isVisible();
  console.log(`Staff Leave row for approval (ID ${leaveToApprove.id}) visible: ${leaveApproveRowVisible}`);
  if (!leaveApproveRowVisible) throw new Error(`Leave row with ID "${leaveToApprove.id}" not visible.`);

  // TEST STEP 3: Approve Staff Leave
  console.log('\n--- Step 3: Approve Staff Leave ---');
  const approveLeaveBtn = page.locator(`[data-testid="approve-leave-${leaveToApprove.id}"]`);
  await approveLeaveBtn.click();
  await page.waitForTimeout(1000);

  // Verify updated status in UI
  const updatedLeaveStatusInUI = await leaveApproveRow.locator('td span:has-text("Approved")').isVisible();
  console.log(`Leave status updated to APPROVED in UI: ${updatedLeaveStatusInUI}`);

  // Verify in Database
  const dbLeaveApproved = db.prepare('SELECT status, reviewed_by FROM leaves WHERE id = ?').get(leaveToApprove.id);
  console.log(`Leave ID ${leaveToApprove.id} status in DB: ${dbLeaveApproved.status} (Reviewed by user ID: ${dbLeaveApproved.reviewed_by})`);
  if (dbLeaveApproved.status !== 'approved') throw new Error('Leave status was not updated to "approved" in database.');

  // TEST STEP 4: Reject Staff Leave
  console.log('\n--- Step 4: Reject Staff Leave ---');
  const leaveRejectRow = page.locator(`[data-testid="staff-leave-row-${leaveToReject.id}"]`);
  const rejectLeaveBtn = page.locator(`[data-testid="reject-leave-${leaveToReject.id}"]`);
  await rejectLeaveBtn.click();
  await page.waitForTimeout(1000);

  // Verify updated status in UI
  const updatedLeaveRejectStatusInUI = await leaveRejectRow.locator('td span:has-text("Rejected")').isVisible();
  console.log(`Leave status updated to REJECTED in UI: ${updatedLeaveRejectStatusInUI}`);

  // Verify in Database
  const dbLeaveRejected = db.prepare('SELECT status, reviewed_by FROM leaves WHERE id = ?').get(leaveToReject.id);
  console.log(`Leave ID ${leaveToReject.id} status in DB: ${dbLeaveRejected.status} (Reviewed by user ID: ${dbLeaveRejected.reviewed_by})`);
  if (dbLeaveRejected.status !== 'rejected') throw new Error('Leave status was not updated to "rejected" in database.');

  // TEST STEP 5: View Staff OD Requests on Dashboard
  console.log('\n--- Step 5: View Staff OD Requests ---');
  const odDeskHeading = await page.locator('h4:has-text("Staff OD Requests")').isVisible();
  console.log(`Staff OD Requests Desk visible: ${odDeskHeading}`);
  if (!odDeskHeading) throw new Error('Staff OD Requests desk not visible on Principal Dashboard.');

  // Locate OD row to approve
  const odApproveRow = page.locator(`[data-testid="staff-od-row-${odToApprove.id}"]`);
  const odApproveRowVisible = await odApproveRow.isVisible();
  console.log(`Staff OD row for approval (ID ${odToApprove.id}) visible: ${odApproveRowVisible}`);
  if (!odApproveRowVisible) throw new Error(`OD row with ID "${odToApprove.id}" not visible.`);

  // TEST STEP 6: Approve Staff OD
  console.log('\n--- Step 6: Approve Staff OD Request ---');
  const approveOdBtn = page.locator(`[data-testid="approve-od-${odToApprove.id}"]`);
  await approveOdBtn.click();
  await page.waitForTimeout(1000);

  // Verify updated status in UI
  const updatedOdStatusInUI = await odApproveRow.locator('td span:has-text("Approved")').isVisible();
  console.log(`OD status updated to APPROVED in UI: ${updatedOdStatusInUI}`);

  // Verify in Database
  const dbOdApproved = db.prepare('SELECT status, reviewed_by FROM od_requests WHERE id = ?').get(odToApprove.id);
  console.log(`OD ID ${odToApprove.id} status in DB: ${dbOdApproved.status} (Reviewed by user ID: ${dbOdApproved.reviewed_by})`);
  if (dbOdApproved.status !== 'approved') throw new Error('OD status was not updated to "approved" in database.');

  // TEST STEP 7: Reject Staff OD
  console.log('\n--- Step 7: Reject Staff OD Request ---');
  const odRejectRow = page.locator(`[data-testid="staff-od-row-${odToReject.id}"]`);
  const rejectOdBtn = page.locator(`[data-testid="reject-od-${odToReject.id}"]`);
  await rejectOdBtn.click();
  await page.waitForTimeout(1000);

  // Verify updated status in UI
  const updatedOdRejectStatusInUI = await odRejectRow.locator('td span:has-text("Rejected")').isVisible();
  console.log(`OD status updated to REJECTED in UI: ${updatedOdRejectStatusInUI}`);

  // Verify in Database
  const dbOdRejected = db.prepare('SELECT status, reviewed_by FROM od_requests WHERE id = ?').get(odToReject.id);
  console.log(`OD ID ${odToReject.id} status in DB: ${dbOdRejected.status} (Reviewed by user ID: ${dbOdRejected.reviewed_by})`);
  if (dbOdRejected.status !== 'rejected') throw new Error('OD status was not updated to "rejected" in database.');

  // Capture screenshot of updated Principal Dashboard
  await page.screenshot({ path: 'C:/Users/Sumit/.gemini/antigravity-ide/brain/01823176-37f0-4081-b49f-5a9da27b3cbb/screenshot_principal_approvals.png' });
  console.log('Saved screenshot to screenshot_principal_approvals.png');

  // TEST STEP 8: Verify Staff Dashboard does NOT have approval controls
  console.log('\n--- Step 8: Verify Staff Dashboard Security Isolation ---');
  await page.locator('button:has-text("Logout")').click();
  await page.waitForURL('**/login', { timeout: 4000 });

  // Login as Staff (9876543210)
  await page.locator('button:has-text("9876543210")').click();
  await page.waitForTimeout(200);
  await page.locator('button:has-text("SEND OTP")').click();
  await page.waitForTimeout(600);
  await page.locator('button:has-text("Click to Auto-fill Demo OTP")').click();
  await page.locator('button:has-text("Verify & Continue")').click();
  await page.waitForURL('**/dashboard', { timeout: 6000 });
  await page.waitForTimeout(600);

  const staffHasApproveControls = await page.locator('button:has-text("Approve")').count();
  console.log(`Staff Dashboard Approve button count: ${staffHasApproveControls} (Expected: 0)`);
  if (staffHasApproveControls !== 0) throw new Error('Security violation: Staff user has access to Approve buttons!');

  await browser.close();
  console.log('\n>>> ALL PRINCIPAL APPROVAL VERIFICATION TESTS PASSED SUCCESSFULLY! <<<');
}

runPrincipalApprovalTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
