const DEFAULTS = {
    systemKeyUsed: false,
    userApiKey: null,
    analysisCount: 0,
    cache: {},
};
export async function getState() {
    const result = await chrome.storage.local.get(Object.keys(DEFAULTS));
    return { ...DEFAULTS, ...result };
}
export async function setState(partial) {
    await chrome.storage.local.set(partial);
}
export async function getCachedAnalysis(key) {
    const state = await getState();
    return state.cache[key] ?? null;
}
export async function setCachedAnalysis(key, result) {
    const state = await getState();
    const cache = { ...state.cache, [key]: result };
    // Limita cache a 50 entradas para não estourar storage
    const keys = Object.keys(cache);
    if (keys.length > 50) {
        delete cache[keys[0]];
    }
    await setState({ cache });
}
