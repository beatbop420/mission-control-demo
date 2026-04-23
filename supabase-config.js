// DEMO MODE — Supabase stub
// This replaces the real Supabase client with a fake one that silently no-ops everything.
// The app runs like normal but nothing actually touches the cloud.

// These globals MUST be defined — other parts of the app reference them directly
// (e.g. SecurityPod.install({ supabaseUrl: SUPABASE_URL, ... })). If they're
// undefined, the app throws ReferenceError during init and nothing else runs
// (including weather).
window.SUPABASE_URL = 'https://demo.invalid';
window.SUPABASE_ANON_KEY = 'demo-key-not-real';
var SUPABASE_URL = window.SUPABASE_URL;
var SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

(function () {
    const DEMO_USER = {
        id: '00000000-0000-0000-0000-000000000000',
        email: 'demo@example.com',
        user_metadata: { full_name: 'Demo User' },
    };

    function fakeResponse(data = null) {
        return Promise.resolve({ data, error: null });
    }

    function makeQueryBuilder() {
        const builder = {
            select: () => builder,
            insert: () => fakeResponse([]),
            upsert: () => fakeResponse([]),
            update: () => fakeResponse([]),
            delete: () => fakeResponse([]),
            eq: () => builder,
            neq: () => builder,
            gt: () => builder,
            gte: () => builder,
            lt: () => builder,
            lte: () => builder,
            like: () => builder,
            ilike: () => builder,
            in: () => builder,
            is: () => builder,
            order: () => builder,
            limit: () => builder,
            range: () => builder,
            single: () => fakeResponse(null),
            maybeSingle: () => fakeResponse(null),
            then: (resolve) => resolve({ data: [], error: null }),
        };
        return builder;
    }

    window.supabaseClient = {
        auth: {
            getUser: () => fakeResponse({ user: DEMO_USER }),
            getSession: () => fakeResponse({ session: { user: DEMO_USER, access_token: 'demo' } }),
            signOut: () => fakeResponse(null),
            signInWithOAuth: () => fakeResponse(null),
            signInWithOtp: () => fakeResponse(null),
            onAuthStateChange: (cb) => {
                setTimeout(() => cb('SIGNED_IN', { user: DEMO_USER }), 0);
                return { data: { subscription: { unsubscribe: () => {} } } };
            },
        },
        from: () => makeQueryBuilder(),
        channel: () => ({
            on: function () { return this; },
            subscribe: () => ({ unsubscribe: () => {} }),
        }),
        removeChannel: () => {},
    };

    console.log('[DEMO MODE] Supabase stub loaded. All cloud operations are no-ops.');
})();
