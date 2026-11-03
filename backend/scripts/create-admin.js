const db = require('../database');

function parseArgs() {
    const args = process.argv.slice(2);
    let phone = null;
    let name = null;
    let department = 'Administration';
    let college = 'CLE Society Central Administration';

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--phone' || arg === '-p') {
            phone = args[++i];
        } else if (arg.startsWith('--phone=')) {
            phone = arg.split('=')[1];
        } else if (arg === '--name' || arg === '-n') {
            name = args[++i];
        } else if (arg.startsWith('--name=')) {
            name = arg.split('=')[1];
        } else if (arg === '--department' || arg === '-d') {
            department = args[++i];
        } else if (arg === '--college' || arg === '-c') {
            college = args[++i];
        } else if (!phone && /^\+?[0-9]{10,13}$/.test(arg)) {
            phone = arg;
        } else if (!name && typeof arg === 'string' && !arg.startsWith('-')) {
            name = arg;
        }
    }

    return { phone, name, department, college };
}

function printUsage() {
    console.log('='.repeat(65));
    console.log('  CLE Society - Create Administrator Script');
    console.log('='.repeat(65));
    console.log('\nUsage:');
    console.log('  node backend/scripts/create-admin.js --phone <10-digit-number> --name "<Full Name>"');
    console.log('\nExamples:');
    console.log('  node backend/scripts/create-admin.js --phone 9876543210 --name "Principal Admin"');
    console.log('  node backend/scripts/create-admin.js 9876543210 "System Administrator"\n');
}

function main() {
    const { phone, name, department, college } = parseArgs();

    if (!phone || !name) {
        console.error('\n[ERROR] Both --phone and --name arguments are required.');
        printUsage();
        process.exit(1);
    }

    const cleanDigits = phone.replace(/\D/g, '');
    const tenDigits = cleanDigits.length > 10 ? cleanDigits.slice(-10) : cleanDigits;

    if (tenDigits.length !== 10) {
        console.error(`\n[ERROR] Invalid mobile number: "${phone}". Expected a 10-digit mobile number.`);
        process.exit(1);
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
        console.error(`\n[ERROR] Name is too short: "${name}".`);
        process.exit(1);
    }

    const formattedPhone = '+91' + tenDigits;
    const employeeId = `ADM-${tenDigits}`;

    // Check if user already exists
    const existing = db.prepare(`
        SELECT id, name, phone, role, status, employee_id 
        FROM users 
        WHERE phone = ? OR phone = ? OR phone = ? OR employee_id = ?
    `).get(formattedPhone, tenDigits, cleanDigits, employeeId);

    if (existing) {
        db.prepare(`
            UPDATE users 
            SET name = ?, role = 'admin', status = 'active', department = ?, college = ?, employee_id = ?
            WHERE id = ?
        `).run(trimmedName, department, college, employeeId, existing.id);

        console.log('\n' + '='.repeat(65));
        console.log('  ADMIN USER UPDATED SUCCESSFULLY');
        console.log('='.repeat(65));
        console.log(`  User ID:      ${existing.id}`);
        console.log(`  Name:         ${trimmedName}`);
        console.log(`  Phone:        ${tenDigits} (${formattedPhone})`);
        console.log(`  Role:         admin`);
        console.log(`  Employee ID:  ${employeeId}`);
        console.log(`  Status:       active`);
        console.log('='.repeat(65) + '\n');
        process.exit(0);
    } else {
        const result = db.prepare(`
            INSERT INTO users (name, phone, role, department, college, employee_id, status)
            VALUES (?, ?, 'admin', ?, ?, ?, 'active')
        `).run(trimmedName, tenDigits, department, college, employeeId);

        console.log('\n' + '='.repeat(65));
        console.log('  ADMIN USER CREATED SUCCESSFULLY');
        console.log('='.repeat(65));
        console.log(`  User ID:      ${result.lastInsertRowid}`);
        console.log(`  Name:         ${trimmedName}`);
        console.log(`  Phone:        ${tenDigits} (${formattedPhone})`);
        console.log(`  Role:         admin`);
        console.log(`  Employee ID:  ${employeeId}`);
        console.log(`  Status:       active`);
        console.log('='.repeat(65) + '\n');
        process.exit(0);
    }
}

main();

