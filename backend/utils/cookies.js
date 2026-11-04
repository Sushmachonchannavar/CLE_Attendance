/**
 * Secure Cookie configuration utility for CLE Society Attendance System.
 * Ensures consistent, secure, HTTP-only, and SameSite cookie options across endpoints.
 */

function getAuthCookieOptions() {
    const isProd = process.env.NODE_ENV === 'production';
    return {
        httpOnly: true,
        secure: isProd, // Must be true in production over HTTPS
        sameSite: isProd ? 'none' : 'lax', // 'none' enables cross-origin (e.g. Vercel frontend -> Render backend)
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/'
    };
}

function getClearCookieOptions() {
    const isProd = process.env.NODE_ENV === 'production';
    return {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        path: '/'
    };
}

module.exports = {
    getAuthCookieOptions,
    getClearCookieOptions
};

