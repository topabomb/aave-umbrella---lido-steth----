// Simple localStorage wrapper

const COOKIE_EXPIRY_DAYS = 365;

export const setItem = (key: string, value: string) => {
  try {
    const item = {
      value: value,
      expiry: new Date().getTime() + COOKIE_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    };
    localStorage.setItem(key, JSON.stringify(item));
  } catch (error) {
    console.error(`Error saving to localStorage: ${key}`, error);
  }
};

export const getItem = (key: string): string | null => {
  try {
    const itemStr = localStorage.getItem(key);
    if (!itemStr) {
      return null;
    }
    const item = JSON.parse(itemStr);
    const now = new Date().getTime();
    if (now > item.expiry) {
      localStorage.removeItem(key);
      return null;
    }
    return item.value;
  } catch (error) {
    console.error(`Error reading from localStorage: ${key}`, error);
    return null;
  }
};
