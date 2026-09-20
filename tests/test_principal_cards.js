const { chromium } = require('@playwright/test');
const db = require('../backend/database');

async function runPrincipalCardTests() {
  console.log('=== STARTING TEST: FIVE PRINCIPAL DASHBOARD CARDS ===');

  const today = '2026-09-18';

  // Ensure pending staff leaves exist for testing card 4
  let pendingLeave1 = db.prepare(`
    SELECT * FROM leaves WHERE user_id = 101 AND status = 'pending' AND end_date >= ?
  `).get(today);
  if (!pendingLeave1) {
    const res = db.prepare(`
      INSERT INTO leaves (user_id, type, start_date, end_date, reason, status, role)
      VALUES (101, 'casual', '2026-09-24', '2026-09-26', 'Faculty Conference Belagavi CardTest', 'pending', 'STAFF')
    `).run();
    pendingLeave1 = db.prepare('SELECT * FROM leaves WHERE id = ?').get(res.lastInsertRowid);
  }
  console.log(`Prepared Pending Leave 1 (to approve): ID ${pendingLeave1.id}`);

  let pendingLeave2 = db.prepare(`
    SELECT * FROM leaves WHERE user_id = 101 AND status = 'pending' AND end_date >= ? AND id != ?
  `).get(today, pendingLeave1.id);
  if (!pendingLeave2) {
    const res = db.prepare(`
      INSERT INTO leaves (user_id, type, start_date, end_date, reason, status, role)
      VALUES (101, 'sick', '2026-09-28', '2026-09-29', 'Medical leave CardTest', 'pending', 'STAFF')
    `).run();
    pendingLeave2 = db.prepare('SELECT * FROM leaves WHERE id = ?').get(res.lastInsertRowid);
  }
  console.log(`Prepared Pending Leave 2 (to reject): ID ${pendingLeave2.id}`);

  // Ensure pending staff ODs exist for testing card 5
  let pendingOD1 = db.prepare(`
    SELECT * FROM od_requests WHERE user_id = 101 AND status = 'pending'
  `).get();
  if (!pendingOD1) {
    const res = db.prepare(`
      INSERT INTO od_requests (user_id, date, place, purpose, status, role)
      VALUES (101, '2026-09-25', 'VTU Senate Belagavi', 'Academic Review CardTest', 'pending', 'STAFF')
    `).run();
    pendingOD1 = db.prepare('SELECT * FROM od_requests WHERE id = ?').get(res.lastInsertRowid);
  }
  console.log(`Prepared Pending OD 1 (to approve): ID ${pendingOD1.id}`);

  let pendingOD2 = db.prepare(`
    SELECT * FROM od_requests WHERE user_id = 101 AND status = 'pending' AND id != ?
  `).get(pendingOD1.id);
  if (!pendingOD2) {
    const res = db.prepare(`
      INSERT INTO od_requests (user_id, date, place, purpose, status, role)
      VALUES (101, '2026-09-30', 'KLE Tech Hub Hubli', 'Symposium Workshop CardTest', 'pending', 'STAFF')
    `).run();
    pendingOD2 = db.prepare('SELECT * FROM od_requests WHERE id = ?').get(res.lastInsertRowid);
  }
  console.log(`Prepared Pending OD 2 (to reject): ID ${pendingOD2.id}`);

  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();

  page.on('dialog', async dialog => {
    console.log(`Dialog triggered: ${dialog.message()}`);
    await dialog.accept();
  });

  // Login as Principal
  console.log('\n--- Step 1: Principal Login ---');
  await page.goto('http://localhost:5173/login');
  await page.waitForTimeout(500);

  await page.locator('button:has-text("8888888888")').click();
  await page.waitForTimeout(200);
  await page.locator('button:has-text("SEND OTP")').click();
  await page.waitForTimeout(600);
  const autoFillBtn = page.locator('button:has-text("Click to Auto-fill Demo OTP")');
  if (await autoFillBtn.isVisible()) {
    await autoFillBtn.click();
  } else {
    await page.locator('input[placeholder="------"]').fill('123456');
  }
  await page.locator('button:has-text("Verify & Continue")').click();
  await page.waitForURL('**/dashboard', { timeout: 6000 });
  await page.waitForTimeout(800);

  const principalBanner = await page.locator('text=Principal Portal').isVisible();
  console.log(`Principal Portal visible: ${principalBanner}`);
  if (!principalBanner) throw new Error('Principal portal banner not visible.');

  // TEST CARD 1: TOTAL STAFF
  console.log('\n--- Step 2: Testing Card 1 - TOTAL STAFF ---');
  const totalStaffCard = page.locator('[data-testid="card-total-staff"]');
  await totalStaffCard.click();
  await page.waitForTimeout(600);

  const totalStaffModalVisible = await page.locator('[data-testid="principal-details-modal"]').isVisible();
  const totalStaffTableVisible = await page.locator('[data-testid="modal-total-staff-table"]').isVisible();
  const totalStaffTitle = await page.locator('[data-testid="modal-title"]').innerText();
  console.log(`Total Staff Modal visible: ${totalStaffModalVisible}, Table visible: ${totalStaffTableVisible}, Title: "${totalStaffTitle}"`);
  if (!totalStaffModalVisible || !totalStaffTableVisible) throw new Error('Total Staff card did not open staff details table.');

  // Close modal
  await page.locator('[data-testid="modal-close-btn"]').click();
  await page.waitForTimeout(400);
  console.log(`Total Staff Modal closed successfully.`);

  // TEST CARD 2: PRESENT TODAY
  console.log('\n--- Step 3: Testing Card 2 - PRESENT TODAY ---');
  const presentCard = page.locator('[data-testid="card-present-today"]');
  await presentCard.click();
  await page.waitForTimeout(600);

  const presentModalVisible = await page.locator('[data-testid="principal-details-modal"]').isVisible();
  const presentTableVisible = await page.locator('[data-testid="modal-present-staff-table"]').isVisible();
  const presentTitle = await page.locator('[data-testid="modal-title"]').innerText();
  console.log(`Present Today Modal visible: ${presentModalVisible}, Table visible: ${presentTableVisible}, Title: "${presentTitle}"`);
  if (!presentModalVisible || !presentTableVisible) throw new Error('Present Today card did not open present staff table.');

  // Close modal
  await page.locator('[data-testid="modal-close-btn"]').click();
  await page.waitForTimeout(400);
  console.log(`Present Today Modal closed successfully.`);

  // TEST CARD 3: ABSENT TODAY
  console.log('\n--- Step 4: Testing Card 3 - ABSENT TODAY ---');
  const absentCard = page.locator('[data-testid="card-absent-today"]');
  await absentCard.click();
  await page.waitForTimeout(600);

  const absentModalVisible = await page.locator('[data-testid="principal-details-modal"]').isVisible();
  const absentTableVisible = await page.locator('[data-testid="modal-absent-staff-table"]').isVisible();
  const absentTitle = await page.locator('[data-testid="modal-title"]').innerText();
  console.log(`Absent Today Modal visible: ${absentModalVisible}, Table visible: ${absentTableVisible}, Title: "${absentTitle}"`);
  if (!absentModalVisible || !absentTableVisible) throw new Error('Absent Today card did not open absent staff table.');

  // Close modal
  await page.locator('[data-testid="modal-close-btn"]').click();
  await page.waitForTimeout(400);
  console.log(`Absent Today Modal closed successfully.`);

  // TEST CARD 4: PENDING LEAVES (VIEW + APPROVE + REJECT)
  console.log('\n--- Step 5: Testing Card 4 - PENDING LEAVES (View, Approve, Reject) ---');
  const pendingLeavesCard = page.locator('[data-testid="card-pending-leaves"]');
  await pendingLeavesCard.click();
  await page.waitForTimeout(600);

  const pendingLeavesModalVisible = await page.locator('[data-testid="principal-details-modal"]').isVisible();
  const pendingLeavesTableVisible = await page.locator('[data-testid="modal-pending-leaves-table"]').isVisible();
  const pendingLeavesTitle = await page.locator('[data-testid="modal-title"]').innerText();
  console.log(`Pending Leaves Modal visible: ${pendingLeavesModalVisible}, Table visible: ${pendingLeavesTableVisible}, Title: "${pendingLeavesTitle}"`);
  if (!pendingLeavesModalVisible || !pendingLeavesTableVisible) throw new Error('Pending Leaves card did not open pending leave applications table.');

  // Approve Leave in Modal
  const modalApproveLeaveBtn = page.locator(`[data-testid="modal-approve-leave-${pendingLeave1.id}"]`);
  await modalApproveLeaveBtn.click();
  await page.waitForTimeout(1000);

  const dbLeave1 = db.prepare('SELECT status, reviewed_by FROM leaves WHERE id = ?').get(pendingLeave1.id);
  console.log(`Leave ID ${pendingLeave1.id} DB status after modal Approve: ${dbLeave1.status} (Reviewed by: ${dbLeave1.reviewed_by})`);
  if (dbLeave1.status !== 'approved') throw new Error('Leave approval from modal was not saved to database.');

  // Reject Leave in Modal
  const modalRejectLeaveBtn = page.locator(`[data-testid="modal-reject-leave-${pendingLeave2.id}"]`);
  await modalRejectLeaveBtn.click();
  await page.waitForTimeout(1000);

  const dbLeave2 = db.prepare('SELECT status, reviewed_by FROM leaves WHERE id = ?').get(pendingLeave2.id);
  console.log(`Leave ID ${pendingLeave2.id} DB status after modal Reject: ${dbLeave2.status} (Reviewed by: ${dbLeave2.reviewed_by})`);
  if (dbLeave2.status !== 'rejected') throw new Error('Leave rejection from modal was not saved to database.');

  // Close modal
  await page.locator('[data-testid="modal-close-btn"]').click();
  await page.waitForTimeout(400);

  // TEST CARD 5: PENDING ODS (VIEW + APPROVE + REJECT)
  console.log('\n--- Step 6: Testing Card 5 - PENDING ODS (View, Approve, Reject) ---');
  const pendingODsCard = page.locator('[data-testid="card-pending-ods"]');
  await pendingODsCard.click();
  await page.waitForTimeout(600);

  const pendingODsModalVisible = await page.locator('[data-testid="principal-details-modal"]').isVisible();
  const pendingODsTableVisible = await page.locator('[data-testid="modal-pending-ods-table"]').isVisible();
  const pendingODsTitle = await page.locator('[data-testid="modal-title"]').innerText();
  console.log(`Pending ODs Modal visible: ${pendingODsModalVisible}, Table visible: ${pendingODsTableVisible}, Title: "${pendingODsTitle}"`);
  if (!pendingODsModalVisible || !pendingODsTableVisible) throw new Error('Pending ODs card did not open pending OD requests table.');

  // Approve OD in Modal
  const modalApproveODBtn = page.locator(`[data-testid="modal-approve-od-${pendingOD1.id}"]`);
  await modalApproveODBtn.click();
  await page.waitForTimeout(1000);

  const dbOD1 = db.prepare('SELECT status, reviewed_by FROM od_requests WHERE id = ?').get(pendingOD1.id);
  console.log(`OD ID ${pendingOD1.id} DB status after modal Approve: ${dbOD1.status} (Reviewed by: ${dbOD1.reviewed_by})`);
  if (dbOD1.status !== 'approved') throw new Error('OD approval from modal was not saved to database.');

  // Reject OD in Modal
  const modalRejectODBtn = page.locator(`[data-testid="modal-reject-od-${pendingOD2.id}"]`);
  await modalRejectODBtn.click();
  await page.waitForTimeout(1000);

  const dbOD2 = db.prepare('SELECT status, reviewed_by FROM od_requests WHERE id = ?').get(pendingOD2.id);
  console.log(`OD ID ${pendingOD2.id} DB status after modal Reject: ${dbOD2.status} (Reviewed by: ${dbOD2.reviewed_by})`);
  if (dbOD2.status !== 'rejected') throw new Error('OD rejection from modal was not saved to database.');

  // Capture screenshot of the modal
  await page.screenshot({ path: 'C:/Users/Sumit/.gemini/antigravity-ide/brain/01823176-37f0-4081-b49f-5a9da27b3cbb/screenshot_principal_cards_modal.png' });
  console.log('Saved screenshot to screenshot_principal_cards_modal.png');

  // Close modal
  await page.locator('[data-testid="modal-close-btn"]').click();
  await page.waitForTimeout(400);

  // Verify Staff Dashboard isolation
  console.log('\n--- Step 7: Verify Staff Dashboard Isolation ---');
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

  const staffCardCount = await page.locator('[data-testid="card-total-staff"]').count();
  const staffApproveCount = await page.locator('button:has-text("Approve")').count();
  console.log(`Staff Dashboard Principal cards count: ${staffCardCount} (Expected: 0)`);
  console.log(`Staff Dashboard Approve buttons count: ${staffApproveCount} (Expected: 0)`);
  if (staffCardCount !== 0 || staffApproveCount !== 0) throw new Error('Security violation: Staff user has access to Principal cards or Approve controls!');

  await browser.close();
  console.log('\n>>> ALL 5 PRINCIPAL DASHBOARD CARDS VERIFICATION TESTS PASSED SUCCESSFULLY! <<<');
}

runPrincipalCardTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
