const COOKIE_EXPIRY_DAYS = 365;
const COOKIE_PREFIX = 'defiYield_';

const readCookie = (key: string): string | null => {
  const name = `${COOKIE_PREFIX}${encodeURIComponent(key)}=`;
  const cookie = document.cookie.split(';').find(part => part.trim().startsWith(name));
  return cookie ? decodeURIComponent(cookie.trim().slice(name.length)) : null;
};

export const setItem = (key: string, value: string): boolean => {
  try {
    const maxAge = COOKIE_EXPIRY_DAYS * 24 * 60 * 60;
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${COOKIE_PREFIX}${encodeURIComponent(key)}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;

    if (readCookie(key) !== value) {
      throw new Error('Cookie write was rejected');
    }
    return true;
  } catch (error) {
    console.error(`Error saving cookie: ${key}`, error);
    return false;
  }
};

export const getItem = (key: string): string | null => {
  try {
    const value = readCookie(key);
    if (value !== null) {
      return value;
    }

    // Import settings from older versions, removing them only after a successful write.
    const itemStr = localStorage.getItem(key);
    if (!itemStr) {
      return null;
    }
    const item = JSON.parse(itemStr);
    if (typeof item?.value !== 'string' || !Number.isFinite(item.expiry)) {
      return null;
    }
    if (Date.now() > item.expiry) {
      localStorage.removeItem(key);
      return null;
    }
    if (setItem(key, item.value)) {
      localStorage.removeItem(key);
    }
    return item.value;
  } catch (error) {
    console.error(`Error reading stored setting: ${key}`, error);
    return null;
  }
};
