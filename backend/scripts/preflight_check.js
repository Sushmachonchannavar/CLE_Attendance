#!/usr/bin/env node
/**
 * Preflight Deployment Verification Script
 * Validates production environment variables, database directories,
 * write permissions, and security settings before server startup.
 */

const fs = require('fs');
const path = require('path');

const backendEnvPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(backendEnvPath)) {
    require('dotenv').config({ path: backendEnvPath });
} else {
    require('dotenv').config();
}

console.log('='.repeat(60));
console.log('🚀 RUNNING BACKEND PREFLIGHT DEPLOYMENT CHECK');
console.log('='.repeat(60));

let hasErrors = false;
let hasWarnings = false;

function error(msg) {
    console.error(`❌ [ERROR] ${msg}`);
    hasErrors = true;
}

function warn(msg) {
    console.warn(`⚠️  [WARN]  ${msg}`);
    hasWarnings = true;
}

function success(msg) {
    console.log(`✅ [OK]    ${msg}`);
}

// 1. Node Version Check
const nodeVersion = process.versions.node;
const majorVersion = parseInt(nodeVersion.split('.')[0], 10);
if (majorVersion < 18) {
    error(`Node.js version is ${nodeVersion}. Minimum required is 18.0.0 (Recommended: 20+).`);
} else {
    success(`Node.js version: v${nodeVersion}`);
}

// 2. JWT_SECRET Verification
const jwtSecret = process.env.JWT_SECRET;
const INSECURE_SECRETS = ['your_super_secret_key_change_this_in_prod', 'secret', 'jwt_secret', 'changeme', '123456'];

if (!jwtSecret) {
    error('JWT_SECRET environment variable is missing.');
} else if (jwtSecret.trim().length < 32) {
    error(`JWT_SECRET is too short (${jwtSecret.trim().length} chars). Minimum length is 32 characters.`);
} else if (INSECURE_SECRETS.includes(jwtSecret.trim().toLowerCase())) {
    error('JWT_SECRET is set to an insecure default placeholder value. Replace it with a strong random secret.');
} else {
    success(`JWT_SECRET is configured (${jwtSecret.trim().length} characters)`);
}

// 3. Database Directory and Write Permissions
const dbPathEnv = process.env.DATABASE_PATH || process.env.DB_FILE || 'database.sqlite';
const resolvedDbPath = path.isAbsolute(dbPathEnv) ? dbPathEnv : path.resolve(__dirname, '..', dbPathEnv);
const dbDir = path.dirname(resolvedDbPath);

try {
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        success(`Created database directory: ${dbDir}`);
    }
    // Test write permission
    const testFile = path.join(dbDir, `.preflight_test_${Date.now()}`);
    fs.writeFileSync(testFile, 'write_test');
    fs.unlinkSync(testFile);
    success(`Database storage path is writable: ${resolvedDbPath}`);
} catch (err) {
    error(`Cannot write to database directory (${dbDir}): ${err.message}`);
}

// 4. Uploads Directory
const uploadDirEnv = process.env.UPLOAD_DIR || 'uploads/od-documents';
const resolvedUploadDir = path.isAbsolute(uploadDirEnv) ? uploadDirEnv : path.resolve(__dirname, '..', uploadDirEnv);

try {
    if (!fs.existsSync(resolvedUploadDir)) {
        fs.mkdirSync(resolvedUploadDir, { recursive: true });
        success(`Created upload directory: ${resolvedUploadDir}`);
    }
    const testUploadFile = path.join(resolvedUploadDir, `.preflight_test_${Date.now()}`);
    fs.writeFileSync(testUploadFile, 'write_test');
    fs.unlinkSync(testUploadFile);
    success(`Uploads path is writable: ${resolvedUploadDir}`);
} catch (err) {
    error(`Cannot write to uploads directory (${resolvedUploadDir}): ${err.message}`);
}

// 5. Environment & CORS
const nodeEnv = process.env.NODE_ENV || 'development';
success(`NODE_ENV is set to: "${nodeEnv}"`);

const frontendUrl = process.env.FRONTEND_URL;
if (!frontendUrl) {
    warn('FRONTEND_URL is not explicitly configured. In production, requests will rely on Cloudflare Pages pattern matching or fail strict CORS.');
} else {
    const urls = frontendUrl.split(',').map(u => u.trim());
    const hasTrailingSlash = urls.some(u => u.endsWith('/'));
    if (hasTrailingSlash) {
        warn('One or more FRONTEND_URL entries end with a trailing slash "/". It is recommended to remove trailing slashes for CORS matching.');
    } else {
        success(`Configured FRONTEND_URL origins: ${urls.join(', ')}`);
    }
}

// 6. Geofence coordinates
const campusLat = process.env.CAMPUS_LAT;
const campusLng = process.env.CAMPUS_LNG;
if (campusLat && campusLng) {
    success(`Campus geofence coordinates: (${campusLat}, ${campusLng})`);
} else {
    warn('CAMPUS_LAT / CAMPUS_LNG not set. Geofence verification will use default campus coordinates.');
}

// 7. SMS Gateway
if (process.env.SMS_API_KEY && process.env.SMS_API_KEY !== 'your_sms_api_key') {
    success('Production external SMS gateway credentials configured.');
} else if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID !== 'your_twilio_account_sid') {
    success('Production Twilio SMS credentials configured.');
} else {
    warn('No production SMS gateway configured. Authentication will operate in Demo OTP mode (123456).');
}

console.log('='.repeat(60));
if (hasErrors) {
    console.error('❌ PREFLIGHT CHECK FAILED. Please resolve errors before deploying.');
    process.exit(1);
} else if (hasWarnings) {
    console.log('⚠️  PREFLIGHT CHECK PASSED WITH WARNINGS. Ready for deployment.');
    process.exit(0);
} else {
    console.log('✅ PREFLIGHT CHECK PASSED PERFECTLY! System ready for deployment.');
    process.exit(0);
}
