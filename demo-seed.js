// DEMO MODE — Blank Slate Seeder
// Runs on first page load. Fills localStorage with empty structure so the app is ready for input.
// Sets a flag after first seed so we don't overwrite user's clicks on reload.

(function () {
    const SEED_FLAG = 'demo_seeded_v3';
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
        fin_accounts: [],

        // === MONEY — BILLS ===
        fin_bills: [],

        // === MONEY — INCOME / DEBTS / MISC ===
        fin_income: [],
        fin_debts: [],
        fin_emergency: { goal: 0, current: 0 },
        fin_spending: [],
        fin_transactions: [],

        // === BUCKETS + SETTINGS ===
        buckets: {
            fixed: { balance: 0, needed: 0 },
            safety: { balance: 0, goal: 0 },
            life: { balance: 0, budgetPerPaycheck: 0 },
            dopamine: { balance: 0, budgetPerPaycheck: 0 },
        },
        bucket_settings: {
            nextPayday: isoDate(7),
            paycheckAmount: 0,
            safetyAmount: 0,
            lifeBudget: 0,
            dopamineBudget: 0,
            cashWithdraw: 0,
            payFrequency: 14,
        },
        manual_pending: 0,
        safe_to_spend: 0,
        sinking_funds: [],
        bank_data_source: 'demo',
        bank_last_fetch_iso: nowIso,
        bank_last_fetch_label: 'just now (demo)',

        // === BODY ===
        body_forecast: {
            temp: 68,
            tempHigh: 74,
            tempLow: 62,
            pressure: 30.12,
            pressureTrend: 'rising',
            humidity: 58,
            windSpeed: 12,
            weatherCondition: 'Partly Cloudy',
            weatherIcon: '02d',
            flareRisk: 'low',
            symptomForecast: 'Good day ahead',
            nextPressureDrop: isoDate(3),
            updateTime: nowIso
        },

        // === LIFE ===
        cycle_entries: [],
        kid_logs: [],
        checkboxes: {},
        timestamps: {},
        symptom_log: [],
        textareas: { brain_dump: '' },
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
    const astTasks = [];
    localStorage.setItem('ast_tasks', JSON.stringify(astTasks));
    localStorage.setItem('ast_energy', JSON.stringify({ level: 5, max: 10, updatedAt: nowIso, history: [] }));
    localStorage.setItem('ast_settings', JSON.stringify({ defaultView: 'active' }));
    localStorage.setItem('ast_version', '0');

    localStorage.setItem(SEED_FLAG, nowIso);
    console.log('[DEMO MODE] Initialized blank slate.');
})();

// Function to populate with sample data if the user wants to see it full
window.seedSampleData = function() {
    const today = new Date();
    const isoDate = (offsetDays = 0) => {
        const d = new Date(today);
        d.setDate(d.getDate() + offsetDays);
        return d.toISOString().slice(0, 10);
    };
    const nowIso = today.toISOString();

    const sampleTasks = [
        {
            id: 't1',
            title: 'Schedule dentist appointment',
            priority: 'medium',
            dueDate: isoDate(5),
            steps: [
                { id: 's1', text: 'Call the office to check availability', done: false },
                { id: 's2', text: 'Confirm insurance is accepted', done: false }
            ],
            createdAt: nowIso,
            updatedAt: nowIso
        },
        {
            id: 't2',
            title: 'Grocery run before Thursday',
            priority: 'high',
            dueDate: isoDate(2),
            steps: [
                { id: 's1', text: 'Make list', done: true },
                { id: 's2', text: 'Go to store', done: false }
            ],
            createdAt: nowIso,
            updatedAt: nowIso
        },
        {
            id: 't3',
            title: 'Call about car insurance renewal',
            priority: 'low',
            dueDate: isoDate(12),
            steps: [],
            createdAt: nowIso,
            updatedAt: nowIso
        }
    ];

    // Mid-month scenario: some bills paid, account has a balance, buckets partially filled
    const sampleAccounts = [
        {
            id: 'sample-checking',
            name: 'Checking Account',
            type: 'Checking',
            balance: 1247.83,
            availableBalance: 1247.83,
            postedBalance: 1389.50,
            pendingTotal: -141.67,
            pendingCount: 3,
            balance_date: nowIso
        },
        {
            id: 'sample-savings',
            name: 'Safety Savings',
            type: 'Savings',
            balance: 420.00,
            availableBalance: 420.00,
            postedBalance: 420.00,
            pendingTotal: 0,
            pendingCount: 0,
            balance_date: nowIso
        }
    ];

    const sampleBills = [
        { id: 'sb1', name: 'Housing / Rent', amount: 950, dueDate: isoDate(-12), recurring: 'monthly', status: 'paid', paid: true, paidDate: isoDate(-12), category: 'Fixed' },
        { id: 'sb2', name: 'Electric', amount: 87, dueDate: isoDate(5), recurring: 'monthly', status: 'pending', paid: false, category: 'Fixed' },
        { id: 'sb3', name: 'Phone', amount: 52, dueDate: isoDate(8), recurring: 'monthly', status: 'unpaid', paid: false, category: 'Fixed' },
        { id: 'sb4', name: 'Streaming Bundle', amount: 28, dueDate: isoDate(-3), recurring: 'monthly', status: 'paid', paid: true, paidDate: isoDate(-3), category: 'Fixed' },
        { id: 'sb5', name: 'Internet', amount: 65, dueDate: isoDate(14), recurring: 'monthly', status: 'unpaid', paid: false, category: 'Fixed' }
    ];

    const sampleData = {
        fin_accounts: sampleAccounts,
        fin_bills: sampleBills,
        fin_income: [{ id: 'si1', name: 'Main Job', amount: 1800, frequency: 'biweekly', nextDate: isoDate(6) }],
        fin_debts: [{ id: 'sd1', name: 'Credit Card', type: 'Credit Card', currentBalance: 1250, originalBalance: 1500, apr: 19.99, minPayment: 35, dueDate: isoDate(11), notes: '' }],
        fin_emergency: { goal: 2000, current: 420 },
        fin_spending: [],
        fin_transactions: [],
        buckets: {
            fixed: { balance: 450, needed: 987 },
            safety: { balance: 420, goal: 1000 },
            life: { balance: 187, budgetPerPaycheck: 350 },
            dopamine: { balance: 45, budgetPerPaycheck: 100 }
        },
        bucket_settings: {
            nextPayday: isoDate(6),
            paycheckAmount: 1800,
            safetyAmount: 50,
            lifeBudget: 350,
            dopamineBudget: 100,
            cashWithdraw: 40,
            payFrequency: 14
        },
        safe_to_spend: 232,
        manual_pending: 0,
        sinking_funds: [],
        kid_logs: [],
        body_forecast: {
            temp: 68,
            tempHigh: 74,
            tempLow: 62,
            pressure: 30.12,
            pressureTrend: 'rising',
            humidity: 58,
            windSpeed: 12,
            weatherCondition: 'Partly Cloudy',
            weatherIcon: '02d',
            flareRisk: 'low',
            symptomForecast: 'Good day ahead',
            nextPressureDrop: isoDate(3),
            updateTime: nowIso
        },
        textareas: { brain_dump: 'I need to call the dentist, finish that work report, and figure out why the car is making that noise. Also groceries before Thursday.' }
    };

    Object.entries(sampleData).forEach(([key, value]) => {
        localStorage.setItem('mc_' + key, JSON.stringify(value));
        localStorage.setItem('mc_ts_' + key, nowIso);
    });

    localStorage.setItem('ast_tasks', JSON.stringify(sampleTasks));
    localStorage.setItem('ast_energy', JSON.stringify({ level: 6, max: 10, updatedAt: nowIso, history: [] }));
    localStorage.setItem('ast_settings', JSON.stringify({ defaultView: 'active' }));
    localStorage.setItem('ast_version', '0');

    location.reload();
};
