import { Capacitor } from '@capacitor/core';

const DEVICE_ID_KEY = 'cle_device_id';

/**
 * Returns or generates a persistent unique Device ID for this client installation.
 */
export const getDeviceId = () => {
    try {
        let deviceId = localStorage.getItem(DEVICE_ID_KEY);
        if (!deviceId || typeof deviceId !== 'string' || deviceId.trim().length < 8) {
            // Generate cryptographically random ID
            const randomBytes = window.crypto && window.crypto.getRandomValues 
                ? Array.from(window.crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('')
                : `${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`;
            
            const prefix = Capacitor.isNativePlatform() ? 'app' : 'web';
            deviceId = `cle_${prefix}_${randomBytes}`;
            localStorage.setItem(DEVICE_ID_KEY, deviceId);
        }
        return deviceId;
    } catch {
        return `cle_temp_${Date.now()}`;
    }
};

/**
 * Gathers rich client device metadata for the trusted device register.
 */
export const getDeviceInfo = () => {
    const isNative = Capacitor.isNativePlatform();
    const platformName = Capacitor.getPlatform(); // 'android', 'ios', 'web'
    const ua = (navigator?.userAgent || '').toLowerCase();

    let deviceType = 'desktop';
    let platform = 'web';
    let browser = 'Browser';
    let os = 'Unknown OS';

    if (isNative) {
        platform = platformName === 'ios' ? 'ios' : 'android';
        deviceType = 'mobile';
        browser = 'CLE Mobile App';
        os = platformName === 'ios' ? 'iOS' : 'Android';
    } else {
        if (ua.includes('android')) {
            deviceType = 'mobile';
            platform = 'android';
            os = 'Android';
        } else if (ua.includes('iphone') || ua.includes('ipod')) {
            deviceType = 'mobile';
            platform = 'ios';
            os = 'iPhone';
        } else if (ua.includes('ipad')) {
            deviceType = 'tablet';
            platform = 'ios';
            os = 'iPad';
        } else if (ua.includes('windows')) {
            deviceType = 'desktop';
            platform = 'windows';
            os = 'Windows PC';
        } else if (ua.includes('macintosh') || ua.includes('mac os')) {
            deviceType = 'desktop';
            platform = 'macos';
            os = 'Mac';
        } else if (ua.includes('linux')) {
            deviceType = 'desktop';
            platform = 'linux';
            os = 'Linux';
        }

        if (ua.includes('edg/')) {
            browser = 'Edge';
        } else if (ua.includes('chrome') && !ua.includes('edg/')) {
            browser = 'Chrome';
        } else if (ua.includes('safari') && !ua.includes('chrome')) {
            browser = 'Safari';
        } else if (ua.includes('firefox')) {
            browser = 'Firefox';
        }
    }

    const deviceName = isNative 
        ? `CLE Society Native App (${os})` 
        : `${os} • ${browser}`;

    return {
        deviceId: getDeviceId(),
        deviceName,
        deviceType,
        platform,
        browser
    };
};

