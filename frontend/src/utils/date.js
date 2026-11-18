/**
 * Canonical Date Utility for CLE Society Attendance & Location System
 * Timezone: Asia/Kolkata (IST = UTC + 5:30)
 * Format: ISO 8601 YYYY-MM-DD
 */

/**
 * Returns today's date in YYYY-MM-DD format based on Indian Standard Time (Asia/Kolkata).
 * Guarantees standard hyphenated format compatible with HTML5 input min/max across all browsers and OS locales.
 */
export const getTodayDate = () => {
    const now = new Date();
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istDate = new Date(utcMs + (5.5 * 60 * 60 * 1000));
    const year = istDate.getFullYear();
    const month = String(istDate.getMonth() + 1).padStart(2, '0');
    const day = String(istDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Checks if a given date string (YYYY-MM-DD) is in the past compared to today in IST.
 */
export const isPastDate = (dateStr) => {
    if (!dateStr) return false;
    const today = getTodayDate();
    return dateStr < today;
};
