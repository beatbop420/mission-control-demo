// DEMO MODE — Fake data seeder
// Runs on first page load. Fills localStorage with demo data so the app looks populated.
// Sets a flag after first seed so we don't overwrite user's clicks on reload.
//
// KEY PREFIX RULES:
//   - Main app (loadData/saveData) expects 'mc_<key>' — we prefix those
//   - Assistant tab uses raw 'ast_<key>' — no prefix needed

(function () {
    const SEED_FLAG = 'demo_seeded_v2';
    if (localStorage.getItem(SEED_FLAG)) return;

    const today = new Date();
    const isoDate = (offsetDays = 0) => {
        const d = new Date(today);
        d.setDate(d.getDate() + offsetDays);
        return d.toISOString().slice(0, 10);
    };
    const nowIso = today.toISOString();

    // Keys stored via saveData() — app reads them with loadData(key) → 'mc_' + key
    const mcData = {
        // === MONEY — ACCOUNTS ===
        fin_accounts: [
            {
                id: 'demo-checking',
                name: 'Demo Checking',
                type: 'Checking',
                availableBalance: 1247.83,
                postedBalance: 1389.50,
                pendingTotal: -141.67,
                pendingCount: 3,
                balance_date: nowIso,
            },
            {
                id: 'demo-savings',
                name: 'Demo Savings',
                type: 'Savings',
                availableBalance: 2450.00,
                postedBalance: 2450.00,
                pendingTotal: 0,
                pendingCount: 0,
                balance_date: nowIso,
            },
        ],

        // === MONEY — BILLS ===
        fin_bills: [
            { id: 'b1', name: 'Rent', amount: 1100, dueDay: 1, status: 'paid', category: 'Fixed' },
            { id: 'b2', name: 'Electric', amount: 95, dueDay: 15, status: 'pending', category: 'Fixed' },
            { id: 'b3', name: 'Internet', amount: 65, dueDay: 12, status: 'paid', category: 'Fixed' },
            { id: 'b4', name: 'Phone', amount: 55, dueDay: 18, status: 'unpaid', category: 'Fixed' },
            { id: 'b5', name: 'Car Insurance', amount: 120, dueDay: 22, status: 'unpaid', category: 'Fixed' },
            { id: 'b6', name: 'Spotify', amount: 12, dueDay: 8, status: 'paid', category: 'Fixed' },
        ],

        // === MONEY — INCOME / DEBTS / MISC ===
        fin_income: [
            { id: 'i1', name: 'Main Job', amount: 1800, frequency: 'biweekly', nextDate: isoDate(4) },
        ],
        fin_debts: [
            { id: 'd1', name: 'Credit Card', balance: 847, minPayment: 35, interestRate: 24.99 },
        ],
        fin_emergency: { target: 1000, current: 325 },
        fin_spending: [],
        fin_transactions: [],

        // === BUCKETS + SETTINGS ===
        buckets: {
            fixed: { target: 1447, current: 1447 },
            safety: { target: 300, current: 200 },
            life: { target: 400, current: 265 },
            dopamine: { target: 150, current: 85 },
        },
        bucket_settings: {
            nextPayday: isoDate(4),
            paycheckAmount: 1800,
        },
        manual_pending: 0,
        safe_to_spend: 350,
        sinking_funds: [
            { id: 'sf1', name: 'Car Repairs', target: 500, current: 120 },
            { id: 'sf2', name: 'Roma Birthday', target: 200, current: 50 },
        ],
        bank_data_source: 'demo',
        bank_last_fetch_iso: nowIso,
        bank_last_fetch_label: 'just now (demo)',

        // === LIFE ===
        cycle_entries: [
            { date: isoDate(-28), flow: 'medium', symptoms: ['cramps'] },
            { date: isoDate(-14), flow: null, symptoms: ['bloating'] },
            { date: isoDate(-2), flow: 'spotting', symptoms: ['headache'] },
        ],
        kid_logs: [
            { date: isoDate(-3), mood: 'good', notes: 'Great day at school — got an A on science test.' },
            { date: isoDate(-5), mood: 'rough', notes: 'Anxious about weekend schedule change.' },
            { date: isoDate(-7), mood: 'good', notes: 'Soccer practice went well.' },
        ],
        checkboxes: {
            [isoDate(0)]: { meds: true, water: true, meal: false, outside: false },
        },
        timestamps: {},
        symptom_log: [],
        textareas: { brain_dump: 'Feeling okay today. Got some work done, still need to finish the laundry. Andre is coming over this weekend.' },
        paycheck_log: [],
        last_auto_run: nowIso,
        last_bill_reset_month: today.getMonth(),
        last_checkbox_reset: isoDate(0),

        // Flags the app uses to skip "first-run" migrations
        balance_init_v1: true,
        automation_fix_v2_1: true,
        bill_cleanup_v1: true,
        bill_cleanup_v2: true,
        bill_additions_v1: true,
        finance_preloaded_v2: true,
        feb_status_fix_v1: true,
    };

    // Store each main-app key with the 'mc_' prefix and a matching timestamp
    for (const [key, value] of Object.entries(mcData)) {
        localStorage.setItem('mc_' + key, JSON.stringify(value));
        localStorage.setItem('mc_ts_' + key, nowIso);
    }

    // Assistant tab — uses raw 'ast_' keys, no prefix
    const astTasks = [
        {
            id: 't1',
            title: 'Finish bankruptcy paperwork',
            steps: [
                { id: 's1', text: 'Gather last 6 months of bank statements', done: true },
                { id: 's2', text: 'List all creditors with amounts', done: false },
                { id: 's3', text: 'Upload to court website', done: false },
            ],
            priority: 'high',
            tags: ['bankruptcy', 'legal'],
            dueDate: isoDate(3),
            pinned: true,
            createdAt: Date.now() - 86400000 * 2,
        },
        {
            id: 't2',
            title: 'Reply to lawyer about custody hearing',
            steps: [],
            priority: 'high',
            tags: ['custody', 'legal'],
            dueDate: isoDate(1),
            pinned: true,
            createdAt: Date.now() - 86400000,
        },
        {
            id: 't3',
            title: 'Take dogs to vet for annual checkup',
            steps: [
                { id: 's1', text: 'Call clinic to book', done: false },
                { id: 's2', text: 'Gather vaccination records', done: false },
            ],
            priority: 'medium',
            tags: ['pets', 'health'],
            dueDate: isoDate(14),
            pinned: false,
            createdAt: Date.now() - 86400000 * 4,
        },
        {
            id: 't4',
            title: 'Meal plan for the week',
            steps: [],
            priority: 'low',
            tags: ['home', 'weekly'],
            dueDate: null,
            pinned: false,
            createdAt: Date.now() - 86400000 * 3,
        },
    ];
    localStorage.setItem('ast_tasks', JSON.stringify(astTasks));
    localStorage.setItem('ast_energy', JSON.stringify({ value: 6, updatedAt: Date.now() }));
    localStorage.setItem('ast_settings', JSON.stringify({ theme: 'dark', version: 2 }));
    localStorage.setItem('ast_version', '2');

    localStorage.setItem(SEED_FLAG, nowIso);
    const total = Object.keys(mcData).length + 4;
    console.log('[DEMO MODE] Seeded ' + total + ' localStorage keys.');
})();
