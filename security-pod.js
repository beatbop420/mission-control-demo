// ============================================================
// Security Pod — Mission Control's detachable security module
// ============================================================
// Think of this as a security guard that sits at the door of the app.
// It checks IDs, validates packages, watches for problems, and
// reports back if anything goes wrong.
//
// Namespace: window.SecurityPod
// Storage prefix: sec_
// Pattern: same IIFE as assistant.js — self-contained, detachable
// ============================================================

(function() {
    'use strict';

    // --- Pod state ---
    var config = null;       // host app config (set during install)
    var health = {           // current health snapshot
        auth: null,          // 'ok' | 'failed' | 'unknown'
        syncUp: null,        // ISO timestamp of last successful cloud write
        syncDown: null,      // ISO timestamp of last successful cloud read
        pendingWrites: 0,    // how many saves are waiting to sync
        rlsVerified: null,   // ISO timestamp of last successful RLS check
        rlsStatus: 'unknown', // 'ok' | 'failed' | 'unknown'
        lastError: null,     // most recent error message
        errorCount: 0        // errors since last flush
    };

    // --- Local log buffer (flushes to Supabase when online) ---
    var LOG_BUFFER_KEY = 'sec_log_buffer';
    var LOG_MAX_BUFFER = 50; // keep last 50 entries locally

    // --- Sync Journal (Step 4) ---
    var JOURNAL_KEY = 'sec_journal';
    // We store pending writes as { id, key, data, timestamp }

    // --- Validation Schemas (Step 3) ---
    var SCHEMAS = {
        'user_data': {
            'type': 'object',
            'required': ['key', 'value'],
            'properties': {
                'key': 'string',
                'value': 'any'
            }
        }
    };

    // ================================================================
    // VALIDATION (Step 3)
    // ================================================================

    function validateData(key, data) {
        if (!data) return { ok: false, error: 'Empty data' };

        // Simple type checking for now
        if (key === 'user_data') {
            if (typeof data.key !== 'string') return { ok: false, error: 'Invalid key type' };
            if (data.value === undefined) return { ok: false, error: 'Value is required' };
        }

        return { ok: true };
    }

    // ================================================================
    // SYNC JOURNAL (Step 4)
    // ================================================================

    function journalAdd(key, data) {
        var journal = getJournal();
        var entry = {
            id: 'j_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
            key: key,
            data: data,
            timestamp: new Date().toISOString()
        };
        journal.push(entry);
        saveJournal(journal);
        updateHealth({ pendingWrites: journal.length });
        return entry.id;
    }

    function journalRemove(id) {
        var journal = getJournal().filter(function(entry) { return entry.id !== id; });
        saveJournal(journal);
        updateHealth({ pendingWrites: journal.length });
    }

    function getJournal() {
        try {
            var raw = localStorage.getItem(JOURNAL_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) { return []; }
    }

    function saveJournal(journal) {
        try {
            localStorage.setItem(JOURNAL_KEY, JSON.stringify(journal));
        } catch (e) {
            console.warn('[SecurityPod] Journal save failed:', e.message);
        }
    }

    // ================================================================
    // INSTALL — called once by the host app on startup
    // ================================================================
    // config expects:
    // {
    //   supabaseClient: the Supabase client instance,
    //   supabaseUrl: the Supabase URL string,
    //   supabaseAnonKey: the anon key string,
    //   setStatus: function(type, msg) — host's status bar function,
    //   onHealthChange: function(health) — called when health updates (optional)
    // }
    function install(hostConfig) {
        config = hostConfig;

        // Set up global error handlers
        window.addEventListener('error', function(event) {
            captureError('uncaught', event.message, {
                filename: event.filename,
                line: event.lineno,
                col: event.colno
            });
        });

        window.addEventListener('unhandledrejection', function(event) {
            var msg = event.reason ? (event.reason.message || String(event.reason)) : 'Unknown rejection';
            captureError('unhandled_promise', msg, {
                stack: event.reason && event.reason.stack ? hashStack(event.reason.stack) : null
            });
        });

        // Load saved health state
        try {
            var saved = localStorage.getItem('sec_health');
            if (saved) {
                var parsed = JSON.parse(saved);
                // Merge saved state (keep timestamps from last session)
                if (parsed.syncUp) health.syncUp = parsed.syncUp;
                if (parsed.syncDown) health.syncDown = parsed.syncDown;
                if (parsed.rlsVerified) health.rlsVerified = parsed.rlsVerified;
                if (parsed.rlsStatus) health.rlsStatus = parsed.rlsStatus;
            }
        } catch (e) { /* ignore corrupt state */ }

        console.log('[SecurityPod] Installed');
    }

    // ================================================================
    // RLS PROBES — test that database policies actually work
    // ================================================================

    // Runs a series of tests against Supabase to verify RLS is enforced.
    // Returns { passed: true/false, results: [...] }
    async function probeRLS() {
        if (!config || !config.supabaseClient) {
            return { passed: false, results: [{ test: 'init', passed: false, reason: 'No Supabase client' }] };
        }

        var results = [];
        var client = config.supabaseClient;

        // --- Test 1: Can we read our own user_data? ---
        try {
            var { data: { user } } = await client.auth.getUser();
            if (!user) {
                results.push({ test: 'auth', passed: false, reason: 'Not logged in' });
                updateHealth({ auth: 'failed', rlsStatus: 'unknown' });
                return { passed: false, results: results };
            }
            results.push({ test: 'auth', passed: true, reason: 'Logged in as ' + user.id.slice(0, 8) + '...' });
            updateHealth({ auth: 'ok' });
        } catch (e) {
            results.push({ test: 'auth', passed: false, reason: e.message });
            updateHealth({ auth: 'failed' });
            return { passed: false, results: results };
        }

        // --- Test 2: Can we read user_data with our auth? (should work) ---
        try {
            var { data, error } = await client
                .from('user_data')
                .select('key')
                .limit(1);

            if (error) {
                results.push({ test: 'user_data_read_own', passed: false, reason: error.message });
            } else {
                results.push({ test: 'user_data_read_own', passed: true, reason: 'Read OK (' + (data ? data.length : 0) + ' rows)' });
            }
        } catch (e) {
            results.push({ test: 'user_data_read_own', passed: false, reason: e.message });
        }

        // --- Test 3: Try to read user_data with a SECOND anon client (no auth) ---
        // This simulates what an attacker with just the public anon key could do.
        // IMPORTANT: use a separate storage key so this client does NOT share
        // the logged-in user's auth session from localStorage.
        try {
            var anonClient = window.supabase.createClient(
                config.supabaseUrl,
                config.supabaseAnonKey,
                { auth: { storageKey: 'sec_rls_probe_anon', persistSession: false } }
            );
            // Sign out explicitly to make sure we're truly anonymous
            await anonClient.auth.signOut();

            var { data: anonData, error: anonError } = await anonClient
                .from('user_data')
                .select('key, value')
                .limit(5);

            if (anonError) {
                // Error = good, RLS is blocking
                results.push({ test: 'user_data_anon_blocked', passed: true, reason: 'Anon read blocked: ' + anonError.message });
            } else if (!anonData || anonData.length === 0) {
                // Empty result might be RLS filtering, but could also be an empty table.
                // To be sure, try to INSERT something. This should always fail.
                var { error: insError } = await anonClient.from('user_data').insert({ key: 'rls_probe', value: 'leak' });
                if (insError) {
                    results.push({ test: 'user_data_anon_blocked', passed: true, reason: 'Anon read returned 0 rows AND insert was blocked (Confirmed)' });
                } else {
                    results.push({ test: 'user_data_anon_blocked', passed: false, reason: 'CRITICAL: Anon client successfully inserted into user_data!' });
                }
            } else {
                // Got data back = BAD, RLS is not working
                results.push({ test: 'user_data_anon_blocked', passed: false, reason: 'CRITICAL: Anon client read ' + anonData.length + ' rows from user_data!' });
            }
        } catch (e) {
            // Network error or other failure — can't verify
            results.push({ test: 'user_data_anon_blocked', passed: false, reason: 'Could not test: ' + e.message });
        }

        // --- Test 4: Try to read bank_cache with anon (should fail) ---
        try {
            var anonClient2 = window.supabase.createClient(
                config.supabaseUrl,
                config.supabaseAnonKey,
                { auth: { storageKey: 'sec_rls_probe_anon2', persistSession: false } }
            );
            await anonClient2.auth.signOut();

            var { data: bankData, error: bankError } = await anonClient2
                .from('bank_cache')
                .select('*')
                .limit(1);

            if (bankError) {
                results.push({ test: 'bank_cache_anon_blocked', passed: true, reason: 'Anon bank read blocked: ' + bankError.message });
            } else if (!bankData || bankData.length === 0) {
                results.push({ test: 'bank_cache_anon_blocked', passed: true, reason: 'Anon bank read returned 0 rows' });
            } else {
                results.push({ test: 'bank_cache_anon_blocked', passed: false, reason: 'CRITICAL: Anon client read bank_cache!' });
            }
        } catch (e) {
            results.push({ test: 'bank_cache_anon_blocked', passed: false, reason: 'Could not test: ' + e.message });
        }

        // --- Summarize ---
        var allPassed = results.every(function(r) { return r.passed; });
        var rlsTime = new Date().toISOString();

        updateHealth({
            rlsVerified: rlsTime,
            rlsStatus: allPassed ? 'ok' : 'failed'
        });

        // Log the result
        logEvent(allPassed ? 'info' : 'error', 'rls_probe', allPassed ? 'All RLS probes passed' : 'RLS probe FAILED', {
            results: results.map(function(r) { return { test: r.test, passed: r.passed }; })
        });

        console.log('[SecurityPod] RLS probe:', allPassed ? 'PASSED' : 'FAILED', results);
        return { passed: allPassed, results: results };
    }

    // ================================================================
    // ERROR CAPTURE
    // ================================================================

    function captureError(type, message, context) {
        health.lastError = message;
        health.errorCount++;
        saveHealth();

        logEvent('error', type, message, context);

        console.error('[SecurityPod] Captured:', type, message);
    }

    // Simple hash of a stack trace (for logging without leaking code details)
    function hashStack(stack) {
        if (!stack) return null;
        var hash = 0;
        // Just use first 200 chars to keep it short
        var s = stack.substring(0, 200);
        for (var i = 0; i < s.length; i++) {
            hash = ((hash << 5) - hash) + s.charCodeAt(i);
            hash = hash & hash; // Convert to 32-bit integer
        }
        return 'sh_' + Math.abs(hash).toString(36);
    }

    // ================================================================
    // EVENT LOGGING — unified pipeline for errors, audit, health
    // ================================================================

    function logEvent(level, eventType, message, context) {
        var entry = {
            timestamp: new Date().toISOString(),
            level: level,       // 'info', 'warn', 'error'
            event_type: eventType, // 'error', 'rls_probe', 'sync', 'audit', etc.
            message: message,
            context: context || null
        };

        // Buffer locally
        var buffer = getLogBuffer();
        buffer.push(entry);
        // Keep buffer from growing forever
        if (buffer.length > LOG_MAX_BUFFER) {
            buffer = buffer.slice(-LOG_MAX_BUFFER);
        }
        try {
            localStorage.setItem(LOG_BUFFER_KEY, JSON.stringify(buffer));
        } catch (e) { /* storage full — drop oldest */ }
    }

    function getLogBuffer() {
        try {
            var raw = localStorage.getItem(LOG_BUFFER_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    // Push buffered logs to Supabase security_log table
    async function flushLogs() {
        if (!config || !config.supabaseClient) return;

        var buffer = getLogBuffer();
        if (buffer.length === 0) return;

        try {
            var { data: { user } } = await config.supabaseClient.auth.getUser();
            if (!user) return; // can't flush without auth

            // Build rows for Supabase
            var rows = buffer.map(function(entry) {
                return {
                    user_id: user.id,
                    event_type: entry.event_type,
                    level: entry.level,
                    message: entry.message,
                    context: entry.context,
                    created_at: entry.timestamp
                };
            });

            var { error } = await config.supabaseClient
                .from('security_log')
                .insert(rows);

            if (error) {
                console.warn('[SecurityPod] Log flush failed:', error.message);
                return;
            }

            // Clear buffer on success
            localStorage.removeItem(LOG_BUFFER_KEY);
            console.log('[SecurityPod] Flushed', rows.length, 'log entries to cloud');
        } catch (e) {
            console.warn('[SecurityPod] Log flush error:', e.message);
        }
    }

    // ================================================================
    // HEALTH STATE
    // ================================================================

    function updateHealth(changes) {
        for (var key in changes) {
            if (changes.hasOwnProperty(key)) {
                health[key] = changes[key];
            }
        }
        saveHealth();

        // Notify host if callback provided
        if (config && typeof config.onHealthChange === 'function') {
            config.onHealthChange(getHealth());
        }
    }

    function saveHealth() {
        try {
            localStorage.setItem('sec_health', JSON.stringify(health));
        } catch (e) { /* ignore */ }
    }

    function getHealth() {
        // Calculate overall status
        var status = 'ok';
        var now = Date.now();

        // Check sync freshness
        if (health.syncUp) {
            var upAge = now - new Date(health.syncUp).getTime();
            if (upAge > 24 * 60 * 60 * 1000) status = 'error';      // >24h = red
            else if (upAge > 60 * 60 * 1000) status = 'stale';       // >1h = yellow
        } else {
            status = 'unknown';
        }

        // RLS failure overrides everything
        if (health.rlsStatus === 'failed') status = 'error';

        // Auth failure overrides
        if (health.auth === 'failed') status = 'error';

        return {
            overall: status,
            auth: health.auth,
            syncUp: health.syncUp,
            syncDown: health.syncDown,
            pendingWrites: health.pendingWrites,
            rlsVerified: health.rlsVerified,
            rlsStatus: health.rlsStatus,
            lastError: health.lastError,
            errorCount: health.errorCount
        };
    }

    // ================================================================
    // SYNC TRACKING — host app calls these to report sync activity
    // ================================================================

    function reportSyncUp() {
        updateHealth({ syncUp: new Date().toISOString() });
    }

    function reportSyncDown() {
        updateHealth({ syncDown: new Date().toISOString() });
    }

    function reportSyncError(direction, error) {
        captureError('sync_' + direction, error, null);
    }

    function reportPendingWrites(count) {
        updateHealth({ pendingWrites: count });
    }

    // ================================================================
    // PUBLIC API
    // ================================================================

    window.SecurityPod = {
        // Setup
        install: install,

        // Step 3: Validation
        validateData: validateData,

        // Step 4: Sync Journal (Step 4)
        journalAdd: journalAdd,
        journalRemove: journalRemove,
        getJournal: getJournal,

        // RLS verification
        probeRLS: probeRLS,

        // Health
        getHealth: getHealth,

        // Logging (unified pipeline)
        logEvent: logEvent,
        logError: function(message, context) { captureError('app_error', message, context); },
        flushLogs: flushLogs,
        getLogBuffer: getLogBuffer,

        // Sync tracking (host calls these)
        reportSyncUp: reportSyncUp,
        reportSyncDown: reportSyncDown,
        reportSyncError: reportSyncError,
        reportPendingWrites: reportPendingWrites
    };

    console.log('[SecurityPod] Module loaded');
})();
