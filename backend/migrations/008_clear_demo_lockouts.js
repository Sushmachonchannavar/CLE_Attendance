module.exports = {
    up: (db) => {
        // Clear prior failed attempts and lockouts for demo testing accounts
        const phones = ['9999999999', '8888888888'];
        for (const p of phones) {
            try {
                db.prepare("DELETE FROM auth_lockouts WHERE identifier LIKE ?").run(`%${p}%`);
                db.prepare("DELETE FROM otps WHERE phone LIKE ?").run(`%${p}%`);
            } catch (e) {
                // Non-fatal
            }
        }
    }
};

