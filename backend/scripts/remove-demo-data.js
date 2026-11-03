const readline = require('readline');
const db = require('../database');

const DEMO_USER_IDS = [1, 2, 100, 101];
const DEMO_PHONES = ['9999999999', '8888888888', '1234567890', '9876543210'];
const DEMO_EMP_IDS = ['EMP000', 'EMP001', 'EMP100', 'EMP101'];

function findDemoData() {
    const placeholders = DEMO_USER_IDS.map(() => '?').join(',');
    
    const users = db.prepare(`SELECT id, name, phone, role, employee_id, status FROM users WHERE id IN (${placeholders})`).all(...DEMO_USER_IDS);
    const attendanceCount = db.prepare(`SELECT COUNT(*) AS c FROM attendance WHERE user_id IN (${placeholders})`).get(...DEMO_USER_IDS).c;
    const leavesCount = db.prepare(`SELECT COUNT(*) AS c FROM leaves WHERE user_id IN (${placeholders})`).get(...DEMO_USER_IDS).c;
    const odCount = db.prepare(`SELECT COUNT(*) AS c FROM od_requests WHERE user_id IN (${placeholders})`).get(...DEMO_USER_IDS).c;
    const locationCount = db.prepare(`SELECT COUNT(*) AS c FROM employee_locations WHERE user_id IN (${placeholders})`).get(...DEMO_USER_IDS).c;

    return {
        users,
        attendanceCount,
        leavesCount,
        odCount,
        locationCount
    };
}

function deleteDemoData() {
    const placeholders = DEMO_USER_IDS.map(() => '?').join(',');
    const phonePlaceholders = DEMO_PHONES.concat(DEMO_PHONES.map(p => '+91' + p)).map(() => '?').join(',');
    const empPlaceholders = DEMO_EMP_IDS.map(() => '?').join(',');

    const tx = db.transaction(() => {
        const att = db.prepare(`DELETE FROM attendance WHERE user_id IN (${placeholders})`).run(...DEMO_USER_IDS);
        const lvs = db.prepare(`DELETE FROM leaves WHERE user_id IN (${placeholders})`).run(...DEMO_USER_IDS);
        const ods = db.prepare(`DELETE FROM od_requests WHERE user_id IN (${placeholders})`).run(...DEMO_USER_IDS);
        const locs = db.prepare(`DELETE FROM employee_locations WHERE user_id IN (${placeholders})`).run(...DEMO_USER_IDS);
        
        try {
            db.prepare(`DELETE FROM approval_audit_logs WHERE actor_id IN (${placeholders}) OR target_user_id IN (${placeholders})`).run(...DEMO_USER_IDS, ...DEMO_USER_IDS);
        } catch {
            // Table might not exist or be empty
        }

        db.prepare(`DELETE FROM otps WHERE phone IN (${phonePlaceholders})`).run(...DEMO_PHONES, ...DEMO_PHONES.map(p => '+91' + p));
        db.prepare(`DELETE FROM attendance_otps WHERE employee_id IN (${empPlaceholders})`).run(...DEMO_EMP_IDS);
        
        const usr = db.prepare(`DELETE FROM users WHERE id IN (${placeholders})`).run(...DEMO_USER_IDS);

        return {
            usersDeleted: usr.changes,
            attendanceDeleted: att.changes,
            leavesDeleted: lvs.changes,
            odDeleted: ods.changes,
            locationsDeleted: locs.changes
        };
    });

    return tx();
}

async function main() {
    console.log('='.repeat(65));
    console.log('  CLE Society Demo Data Removal Utility');
    console.log('='.repeat(65));

    const data = findDemoData();

    if (data.users.length === 0) {
        console.log('\n[INFO] No demo users (IDs: 1, 2, 100, 101) found in database.');
        console.log('Database is already clean of default demo users.\n');
        process.exit(0);
    }

    console.log(`\nFound ${data.users.length} demo user(s) to remove:`);
    console.table(data.users);

    console.log('Associated records to be cleaned:');
    console.log(`  - Attendance records: ${data.attendanceCount}`);
    console.log(`  - Leave requests:     ${data.leavesCount}`);
    console.log(`  - OD requests:        ${data.odCount}`);
    console.log(`  - Employee locations: ${data.locationCount}`);

    const hasConfirmFlag = process.argv.includes('--confirm') || process.argv.includes('-y');

    if (hasConfirmFlag) {
        console.log('\n[--confirm flag detected] Deleting demo records...');
        const result = deleteDemoData();
        console.log(`\nSuccessfully deleted:`);
        console.log(`  - Users:              ${result.usersDeleted}`);
        console.log(`  - Attendance records: ${result.attendanceDeleted}`);
        console.log(`  - Leave requests:     ${result.leavesDeleted}`);
        console.log(`  - OD requests:        ${result.odDeleted}`);
        console.log(`  - Locations:          ${result.locationsDeleted}`);
        console.log('\n[SUCCESS] Demo data removed permanently.\n');
        process.exit(0);
    }

    // Interactive prompt
    if (process.stdin.isTTY) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question('\nAre you sure you want to delete these demo users and their records? Type "yes" to confirm: ', (answer) => {
            rl.close();
            if (answer.trim().toLowerCase() === 'yes') {
                const result = deleteDemoData();
                console.log(`\nSuccessfully deleted:`);
                console.log(`  - Users:              ${result.usersDeleted}`);
                console.log(`  - Attendance records: ${result.attendanceDeleted}`);
                console.log(`  - Leave requests:     ${result.leavesDeleted}`);
                console.log(`  - OD requests:        ${result.odDeleted}`);
                console.log(`  - Locations:          ${result.locationsDeleted}`);
                console.log('\n[SUCCESS] Demo data removed permanently.\n');
                process.exit(0);
            } else {
                console.log('\n[CANCELLED] Operation cancelled by user. No data was deleted.\n');
                process.exit(0);
            }
        });
    } else {
        console.log('\n[DRY RUN] Confirmation required.');
        console.log('To confirm deletion non-interactively, run:');
        console.log('  node backend/scripts/remove-demo-data.js --confirm\n');
        process.exit(0);
    }
}

main().catch(err => {
    console.error('[ERROR] Demo removal failed:', err);
    process.exit(1);
});

