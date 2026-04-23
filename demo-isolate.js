// DEMO MODE — localStorage isolation
// The demo lives on the same origin as the real app (beatbop420.github.io),
// which means they SHARE localStorage by default. That would let the demo
// stomp on the real app's data.
//
// Fix: monkey-patch localStorage so every read/write automatically gets
// namespaced under a 'demo_' prefix. The app doesn't need to know — it calls
// localStorage.setItem('mc_fin_accounts', ...) as normal, and the data
// actually lands at 'demo_mc_fin_accounts'. Complete isolation.

(function () {
    const NS = 'demo_';
    const proto = Storage.prototype;
    const origGet = proto.getItem;
    const origSet = proto.setItem;
    const origRemove = proto.removeItem;
    const origKey = proto.key;

    proto.getItem = function (key) {
        return origGet.call(this, NS + key);
    };
    proto.setItem = function (key, value) {
        return origSet.call(this, NS + key, value);
    };
    proto.removeItem = function (key) {
        return origRemove.call(this, NS + key);
    };

    // .key(i) — return only demo keys, with the prefix stripped
    proto.key = function (i) {
        const demoKeys = [];
        let j = 0;
        while (true) {
            const raw = origKey.call(this, j);
            if (raw === null) break;
            if (raw.startsWith(NS)) demoKeys.push(raw.slice(NS.length));
            j++;
        }
        return demoKeys[i] !== undefined ? demoKeys[i] : null;
    };

    // .clear() — only wipe demo keys, never touch real-app data
    proto.clear = function () {
        const toRemove = [];
        let j = 0;
        while (true) {
            const raw = origKey.call(this, j);
            if (raw === null) break;
            if (raw.startsWith(NS)) toRemove.push(raw);
            j++;
        }
        toRemove.forEach(k => origRemove.call(this, k));
    };

    console.log('[DEMO MODE] localStorage isolated under "' + NS + '" namespace.');
})();
