export function getContentScriptPolyfillJs(initialStorage: Record<string, unknown> = {}): string {
  return `
(function() {
  const localCache = ${JSON.stringify(initialStorage)};
  const messageListeners = [];

  const storage = {
    local: {
      get: (keys, callback) => {
        let result = {};
        if (keys === null || keys === undefined) {
          result = Object.assign({}, localCache);
        } else if (typeof keys === "string") {
          if (keys in localCache) result[keys] = localCache[keys];
        } else if (Array.isArray(keys)) {
          for (const k of keys) { if (k in localCache) result[k] = localCache[k]; }
        } else if (typeof keys === "object") {
          for (const [k, def] of Object.entries(keys)) {
            result[k] = k in localCache ? localCache[k] : def;
          }
        }
        if (typeof callback === "function") callback(result);
        return Promise.resolve(result);
      },
      set: (items, callback) => {
        Object.assign(localCache, items);
        if (typeof callback === "function") setTimeout(() => callback(), 0);
        return Promise.resolve();
      },
    },
    sync: null,
  };
  storage.sync = storage.local;

  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg || msg.source !== "extbrew-content-forward") return;

    for (const listener of messageListeners) {
      try {
        const sendResponse = (resp) => {
          window.parent.postMessage({
            source: "extbrew-content-response",
            requestId: msg.requestId,
            response: resp,
          }, "*");
        };
        listener(msg.message, { id: "extbrew-fake-tab", tab: { id: 1 } }, sendResponse);
      } catch (err) {
        console.error("[ExtBrew content] listener error:", err);
      }
    }
  });

  window.chrome = {
    storage,
    runtime: {
      id: "extbrew-fake-extension",
      lastError: null,
      onMessage: {
        addListener: (fn) => messageListeners.push(fn),
        removeListener: (fn) => {
          const i = messageListeners.indexOf(fn);
          if (i >= 0) messageListeners.splice(i, 1);
        },
        hasListener: (fn) => messageListeners.includes(fn),
      },
      sendMessage: (message, callback) => {
        window.parent.postMessage({
          source: "extbrew-content-to-bg",
          message,
        }, "*");
        if (callback) setTimeout(() => callback(undefined), 0);
      },
      getURL: (path) => path,
    },
  };
})();
  `.trim();
}
