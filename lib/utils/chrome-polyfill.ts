export function getChromePolyfillJs(): string {
  return `
(function() {
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
      const p = brokerStorageCall("storage.get", [keys]);
      if (typeof callback === "function") p.then((r) => callback(r));
      return p;
    },
    set: (items, callback) => {
      const p = brokerStorageCall("storage.set", [items]);
      if (typeof callback === "function") p.then(() => callback());
      return p;
    },
    remove: (keys, callback) => {
      const p = brokerStorageCall("storage.remove", [keys]);
      if (typeof callback === "function") p.then(() => callback());
      return p;
    },
    clear: (callback) => {
      const p = brokerStorageCall("storage.clear", []);
      if (typeof callback === "function") p.then(() => callback());
      return p;
    },
  };

  const messageListeners = [];

  const runtime = {
    id: "extbrew-preview-extension",
    lastError: null,

    sendMessage: (...args) => {
      const message = args[0];
      const callback = typeof args[args.length - 1] === "function" ? args[args.length - 1] : null;
      let response = undefined;
      for (const listener of messageListeners) {
        try {
          listener(message, { id: runtime.id }, (resp) => { response = resp; });
        } catch (err) {
          console.error("[ExtBrew preview] runtime.onMessage listener error:", err);
        }
      }
      if (callback) setTimeout(() => callback(response), 0);
      return Promise.resolve(response);
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

  window.chrome = { storage: { local: storage, sync: storage }, runtime, tabs };
})();
  `.trim();
}
