const PREFIX = 'rag_';

export const cacheGet = (key) => {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const { data, ts, ttl } = JSON.parse(raw);
    if (ttl && Date.now() - ts > ttl) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

export const cacheSet = (key, data, ttl = null) => {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ data, ts: Date.now(), ttl }));
  } catch {
    // localStorage full — silently skip
  }
};

export const cacheDel = (key) => {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {}
};

export const cacheDelPrefix = (prefix) => {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX + prefix))
      .forEach(k => localStorage.removeItem(k));
  } catch {}
};
