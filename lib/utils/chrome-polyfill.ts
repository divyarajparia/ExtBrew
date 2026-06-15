export function getChromePolyfillJs(initialStorage: Record<string, unknown>): string {
  return `
(function() {
  const localCache = ${JSON.stringify(initialStorage)};
  let nextRequestId = 1;
  const pendingStorageRequests = new Map();

  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg || msg.source !== "extbrew-preview" || !msg.requestId) return;
    const resolver = pendingStorageRequests.get(msg.requestId);
    if (resolver) {
      pendingStorageRequests.delete(msg.requestId);
      resolver(msg.result);
    }
  });

  function brokerStorageCall(op, args) {
    return new Promise((resolve) => {
      const requestId = nextRequestId++;
      pendingStorageRequests.set(requestId, resolve);
      window.parent.postMessage({ source: "extbrew-iframe", op, args, requestId }, "*");
    });
  }

  const storage = {
    get: (keys, callback) => {
      let result = {};
      if (keys === null || keys === undefined) {
        result = { ...localCache };
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
      brokerStorageCall("storage.set", [items]);
      if (typeof callback === "function") setTimeout(() => callback(), 0);
      return Promise.resolve();
    },
    remove: (keys, callback) => {
      const arr = typeof keys === "string" ? [keys] : keys;
      for (const k of arr) delete localCache[k];
      brokerStorageCall("storage.remove", [keys]);
      if (typeof callback === "function") setTimeout(() => callback(), 0);
      return Promise.resolve();
    },
    clear: (callback) => {
      for (const k of Object.keys(localCache)) delete localCache[k];
      brokerStorageCall("storage.clear", []);
      if (typeof callback === "function") setTimeout(() => callback(), 0);
      return Promise.resolve();
    },
  };

  const messageListeners = [];

  const runtime = {
    id: "extbrew-preview-extension",
    lastError: null,

    sendMessage: (...args) => {
      const message = args[0];
      const callback = typeof args[args.length - 1] === "function" ? args[args.length - 1] : null;
      let responseReceived = false;
      let response = undefined;
      let asyncExpected = false;

      for (const listener of messageListeners) {
        try {
          const sendResponse = (resp) => {
            if (!responseReceived) {
              responseReceived = true;
              response = resp;
              if (callback) setTimeout(() => callback(response), 0);
            }
          };
          const result = listener(message, { id: runtime.id }, sendResponse);
          if (result === true) asyncExpected = true;
        } catch (err) {
          console.error("[ExtBrew preview] runtime.onMessage listener error:", err);
        }
      }

      if (callback && !responseReceived && !asyncExpected) {
        setTimeout(() => callback(undefined), 0);
      }

      return new Promise((resolve) => {
        if (responseReceived) {
          resolve(response);
        } else if (asyncExpected) {
          const start = Date.now();
          const poll = setInterval(() => {
            if (responseReceived || Date.now() - start > 5000) {
              clearInterval(poll);
              resolve(response);
            }
          }, 10);
        } else {
          resolve(undefined);
        }
      });
    },

    onMessage: {
      addListener: (fn) => { messageListeners.push(fn); },
      removeListener: (fn) => {
        const i = messageListeners.indexOf(fn);
        if (i >= 0) messageListeners.splice(i, 1);
      },
      hasListener: (fn) => messageListeners.includes(fn),
    },

    getURL: (path) => path,
  };

  const tabs = {
    query: (queryInfo, callback) => {
      const fakeTab = { id: 1, url: "https://example.com", title: "Example Page", active: true, currentWindow: true };
      const result = [fakeTab];
      if (typeof callback === "function") setTimeout(() => callback(result), 0);
      return Promise.resolve(result);
    },

    sendMessage: (tabId, message, ...rest) => {
      console.log("[ExtBrew preview] chrome.tabs.sendMessage to tab", tabId, ":", message);
      const callback = typeof rest[rest.length - 1] === "function" ? rest[rest.length - 1] : null;
      if (callback) setTimeout(() => callback(undefined), 0);
      return Promise.resolve(undefined);
    },

    onUpdated: { addListener: () => {}, removeListener: () => {} },
    onRemoved: { addListener: () => {}, removeListener: () => {} },
  };

  const alarms = {
    create: () => {},
    clear: (...args) => {
      const cb = typeof args[args.length - 1] === "function" ? args[args.length - 1] : null;
      if (cb) setTimeout(() => cb(false), 0);
    },
    clearAll: (callback) => {
      if (typeof callback === "function") setTimeout(() => callback(false), 0);
    },
    get: (name, callback) => {
      if (typeof callback === "function") setTimeout(() => callback(undefined), 0);
    },
    getAll: (callback) => {
      if (typeof callback === "function") setTimeout(() => callback([]), 0);
    },
    onAlarm: { addListener: () => {}, removeListener: () => {} },
  };

  window.chrome = { storage: { local: storage, sync: storage }, runtime, tabs, alarms };
})();
  `.trim();
}
