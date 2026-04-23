(function() {
    'use strict';

    const TASKS_KEY = 'ast_tasks';
    const ENERGY_KEY = 'ast_energy';
    const SETTINGS_KEY = 'ast_settings';
    const CAPTURE_KEY = 'ast_capture';
    const VERSION_KEY = 'ast_version';
    const CURRENT_VERSION = 1;
    const ENERGY_MAX = 10;
    const ENERGY_DEFAULT = 5;
    const FILTERS = ['all', 'active', 'done'];

    const state = {
        tasks: [],
        energy: null,
        settings: null,
        capture: null,
        filter: 'active',
        view: 'briefing',
        expandedTaskId: null,
        pickerSlot: null,
        modal: null
    };

    let host = null;
    let badgeIntervalId = null;
    let pendingFocusTarget = null;

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = text;
        return node;
    }

    function readJson(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (err) {
            return fallback;
        }
    }

    function writeJson(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function getStoredVersion() {
        const raw = parseInt(localStorage.getItem(VERSION_KEY) || '0', 10);
        return Number.isFinite(raw) ? raw : 0;
    }

    function setStoredVersion(version) {
        localStorage.setItem(VERSION_KEY, String(version));
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function nowIso() {
        return new Date().toISOString();
    }

    function todayLocalStr() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return year + '-' + month + '-' + day;
    }

    function parseDateOnly(dateStr) {
        if (!dateStr) return null;
        const parts = dateStr.split('-').map(Number);
        if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }

    function formatDate(dateStr) {
        const date = parseDateOnly(dateStr);
        if (!date) return 'No due date';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function isToday(dateStr) {
        return !!dateStr && dateStr === todayLocalStr();
    }

    function isOverdue(task) {
        if (!task || task.status === 'done' || task.isOngoing || !task.dueDate) return false;
        const due = parseDateOnly(task.dueDate);
        const today = parseDateOnly(todayLocalStr());
        return !!due && !!today && due < today;
    }

    function isDueSoon(task) {
        return !!task && task.status !== 'done' && !task.isOngoing && isToday(task.dueDate);
    }

    function getDueCount() {
        return state.tasks.filter(task => isOverdue(task) || isDueSoon(task)).length;
    }

    function getEnergyLabel(level) {
        if (level <= 3) {
            return {
                text: 'Running on fumes. Bare minimum only.',
                color: 'var(--ast-danger)'
            };
        }
        if (level <= 6) {
            return {
                text: 'Some gas in the tank. Pace yourself.',
                color: 'var(--ast-warning)'
            };
        }
        return {
            text: 'Good energy. Get after it.',
            color: 'var(--ast-success)'
        };
    }

    function defaultEnergy() {
        return {
            level: ENERGY_DEFAULT,
            max: ENERGY_MAX,
            updatedAt: nowIso(),
            history: []
        };
    }

    function defaultSettings() {
        return {
            defaultView: 'active'
        };
    }

    function defaultCapture() {
        return {
            draft: '',
            includeBodyContext: true,
            includeMoneyContext: false,
            lastAnalyzedAt: null,
            result: null
        };
    }

    function migrateStoredState(rawTasks, rawEnergy, rawSettings) {
        let version = getStoredVersion();
        let tasks = Array.isArray(rawTasks) ? rawTasks : [];
        let energy = rawEnergy;
        let settings = rawSettings;

        while (version < CURRENT_VERSION) {
            switch (version) {
                case 0:
                    tasks = tasks.map((task, index) => normalizeTask(task, index));
                    energy = normalizeEnergy(energy);
                    settings = Object.assign(defaultSettings(), settings && typeof settings === 'object' ? settings : {});
                    break;
                default:
                    version = CURRENT_VERSION - 1;
                    break;
            }
            version += 1;
        }

        return {
            version: version,
            tasks: tasks,
            energy: energy,
            settings: settings
        };
    }

    function makeTaskId() {
        return 'ast_' + Date.now() + Math.random().toString(36).slice(2, 6);
    }

    function makeStepId() {
        return 's_' + Date.now() + Math.random().toString(36).slice(2, 6);
    }

    function normalizeStep(step, index) {
        return {
            id: step && step.id ? step.id : makeStepId(),
            text: step && typeof step.text === 'string' ? step.text : '',
            done: !!(step && step.done),
            order: step && Number.isFinite(step.order) ? step.order : index + 1
        };
    }

    function renumberSteps(steps) {
        return (Array.isArray(steps) ? steps : []).map((step, index) => ({
            id: step && step.id ? step.id : makeStepId(),
            text: step && typeof step.text === 'string' ? step.text : '',
            done: !!(step && step.done),
            order: index + 1
        }));
    }

    function normalizeTask(task, index) {
        const createdAt = task && task.createdAt ? task.createdAt : nowIso();
        const updatedAt = task && task.updatedAt ? task.updatedAt : createdAt;
        const status = task && ['not_started', 'in_progress', 'done'].includes(task.status) ? task.status : 'not_started';
        const steps = Array.isArray(task && task.steps) ? task.steps.map(normalizeStep) : [];
        return {
            id: task && task.id ? task.id : makeTaskId(),
            title: task && typeof task.title === 'string' ? task.title : '',
            description: task && typeof task.description === 'string' ? task.description : '',
            type: task && task.type === 'routine' ? 'routine' : 'non-routine',
            status: status,
            createdAt: createdAt,
            updatedAt: updatedAt,
            dueDate: task && task.dueDate ? task.dueDate : null,
            isOngoing: !!(task && task.isOngoing),
            isTopThree: !!(task && task.isTopThree),
            topThreeOrder: task && Number.isFinite(task.topThreeOrder) ? task.topThreeOrder : null,
            steps: steps,
            completedAt: status === 'done' ? (task && task.completedAt ? task.completedAt : updatedAt) : null,
            sortOrder: task && Number.isFinite(task.sortOrder) ? task.sortOrder : index,
            priority: task && task.priority ? task.priority : null,
            tags: Array.isArray(task && task.tags) ? task.tags : [],
            spoonCost: task && Number.isFinite(task.spoonCost) ? task.spoonCost : null,
            parentId: task && task.parentId ? task.parentId : null
        };
    }

    function normalizeEnergy(energy) {
        const base = defaultEnergy();
        const incoming = energy && typeof energy === 'object' ? energy : {};
        const level = Math.min(ENERGY_MAX, Math.max(1, parseInt(incoming.level, 10) || ENERGY_DEFAULT));
        const history = Array.isArray(incoming.history) ? incoming.history.filter(item => item && item.date && Number.isFinite(item.level)) : [];
        return {
            level: level,
            max: ENERGY_MAX,
            updatedAt: incoming.updatedAt || base.updatedAt,
            history: history.slice(-30)
        };
    }

    function normalizeSuggestionStep(step) {
        if (typeof step === 'string') return step.trim();
        if (step && typeof step.text === 'string') return step.text.trim();
        return '';
    }

    function normalizeTaskSuggestion(task, index) {
        const source = task && typeof task === 'object' ? task : {};
        const dueDate = typeof source.dueDate === 'string' &&
            /^\d{4}-\d{2}-\d{2}$/.test(source.dueDate) &&
            parseDateOnly(source.dueDate)
            ? source.dueDate
            : null;
        const energyFit = ['low', 'medium', 'high'].includes(source.energyFit) ? source.energyFit : 'medium';
        return {
            id: source.id ? String(source.id) : 'sg_' + index + '_' + Math.random().toString(36).slice(2, 6),
            title: typeof source.title === 'string' && source.title.trim() ? source.title.trim() : 'Suggested task ' + (index + 1),
            why: typeof source.why === 'string' ? source.why.trim() : '',
            dueDate: dueDate,
            energyFit: energyFit,
            steps: (Array.isArray(source.steps) ? source.steps : [])
                .map(normalizeSuggestionStep)
                .filter(Boolean)
                .slice(0, 6),
            addedTaskId: source.addedTaskId ? String(source.addedTaskId) : null,
            expanded: normalizeExpanded(source.expanded),
            expandCollapsed: false,
            expanding: false,
            expandError: ''
        };
    }

    function normalizeExpanded(value) {
        if (!value || typeof value !== 'object') return null;
        const detail = typeof value.detail === 'string' ? value.detail.trim() : '';
        const steps = (Array.isArray(value.steps) ? value.steps : [])
            .map(item => typeof item === 'string' ? item.trim() : '')
            .filter(Boolean)
            .slice(0, 8);
        if (!detail && steps.length === 0) return null;
        return { detail: detail, steps: steps };
    }

    function normalizePlanResult(result) {
        const source = result && typeof result === 'object' ? result : {};
        return {
            summary: typeof source.summary === 'string' ? source.summary.trim() : '',
            recommendedFocus: typeof source.recommendedFocus === 'string' ? source.recommendedFocus.trim() : '',
            quickWin: typeof source.quickWin === 'string' ? source.quickWin.trim() : '',
            taskSuggestions: (Array.isArray(source.taskSuggestions) ? source.taskSuggestions : [])
                .map(normalizeTaskSuggestion)
                .slice(0, 5)
        };
    }

    function normalizeCapture(capture) {
        const base = defaultCapture();
        const incoming = capture && typeof capture === 'object' ? capture : {};
        return {
            draft: typeof incoming.draft === 'string' ? incoming.draft : base.draft,
            includeBodyContext: incoming.includeBodyContext !== false,
            includeMoneyContext: !!incoming.includeMoneyContext,
            lastAnalyzedAt: typeof incoming.lastAnalyzedAt === 'string' ? incoming.lastAnalyzedAt : null,
            result: incoming.result ? normalizePlanResult(incoming.result) : null,
            loading: false,
            error: ''
        };
    }

    function loadState() {
        const migrated = migrateStoredState(
            readJson(TASKS_KEY, []),
            readJson(ENERGY_KEY, defaultEnergy()),
            readJson(SETTINGS_KEY, defaultSettings())
        );

        state.tasks = Array.isArray(migrated.tasks) ? migrated.tasks : [];
        state.energy = migrated.energy;
        state.settings = migrated.settings;
        state.capture = normalizeCapture(readJson(CAPTURE_KEY, defaultCapture()));
        state.filter = FILTERS.includes(state.settings.defaultView) ? state.settings.defaultView : 'active';
        setStoredVersion(migrated.version);
        writeJson(TASKS_KEY, state.tasks);
        writeJson(ENERGY_KEY, state.energy);
        writeJson(SETTINGS_KEY, state.settings);
        writeJson(CAPTURE_KEY, {
            draft: state.capture.draft,
            includeBodyContext: state.capture.includeBodyContext,
            includeMoneyContext: state.capture.includeMoneyContext,
            lastAnalyzedAt: state.capture.lastAnalyzedAt,
            result: state.capture.result
        });
    }

    function countFilledSteps(steps) {
        return (Array.isArray(steps) ? steps : []).filter(step => String(step && step.text || '').trim()).length;
    }

    function shouldShowThinkingPrompts(draft) {
        return !!(
            draft &&
            draft.stepsEnabled &&
            !draft.promptsDismissed &&
            countFilledSteps(draft.steps) === 0
        );
    }

    function getThinkingPrompts(title) {
        const titleLower = String(title || '').trim().toLowerCase();

        if (/(^|\b)(call|phone|email|text|message|contact|reply|respond|reach out|follow up)(\b|$)/i.test(titleLower)) {
            return [
                'What specifically do you need from this conversation?',
                'Do you have everything they might ask for?',
                "When's the best time to reach them?"
            ];
        }

        if (/(^|\b)(schedule|book|arrange|plan|set up)(\b|$)/i.test(titleLower)) {
            return [
                'What dates or times could work?',
                'What info do you need to have ready?',
                'Who else needs to know about this?'
            ];
        }

        if (/(^|\b)(pay|purchase|buy|order)(\b|$)/i.test(titleLower)) {
            return [
                "What's the exact amount and where does it come from?",
                'Do you have the account/payment info handy?',
                'Is there a deadline or a confirmation you need to save?'
            ];
        }

        if (/(^|\b)(write|draft|fill out|complete|submit|send|file)(\b|$)/i.test(titleLower)) {
            return [
                'What documents or info do you need before you start?',
                "What's the most important thing this needs to say?",
                "Who's going to read/receive this and what do they need from it?"
            ];
        }

        if (/(^|\b)(organize|clean|tidy|sort|declutter)(\b|$)/i.test(titleLower)) {
            return [
                "What's the mess right now — too much, wrong place, or missing stuff?",
                'How do you want to find things later?',
                'Is anything in here time-sensitive or high priority?'
            ];
        }

        if (/(^|\b)(review|read|check|audit|research|look over)(\b|$)/i.test(titleLower)) {
            return [
                "What's the main question you're trying to answer?",
                "What's the most important part to look at first?",
                'What decision does this feed into?'
            ];
        }

        return [
            'What does "done" look like for this?',
            'What do you need before you can start?',
            "What's the very first physical action?"
        ];
    }

    function ensureModalHasEmptyStep() {
        if (!state.modal) return null;
        if (state.modal.steps.length > 0) {
            state.modal.steps = renumberSteps(state.modal.steps);
            return state.modal.steps.find(step => !String(step.text || '').trim()) || state.modal.steps[0];
        }

        const step = {
            id: makeStepId(),
            text: '',
            done: false,
            order: 1
        };
        state.modal.steps = [step];
        return step;
    }

    function setPromptsDismissed(dismissed) {
        if (!state.modal) return;
        captureModalDraft();
        state.modal.promptsDismissed = !!dismissed;
        const step = ensureModalHasEmptyStep();
        pendingFocusTarget = step ? { type: 'step-editor', stepId: step.id } : null;
        render();
    }

    function moveModalStep(stepId, direction) {
        if (!state.modal) return;
        captureModalDraft();
        const steps = state.modal.steps.slice();
        const fromIndex = steps.findIndex(step => step.id === stepId);
        const toIndex = fromIndex + direction;
        if (fromIndex < 0 || toIndex < 0 || toIndex >= steps.length) return;

        const moved = steps[fromIndex];
        steps[fromIndex] = steps[toIndex];
        steps[toIndex] = moved;
        state.modal.steps = renumberSteps(steps);
        pendingFocusTarget = { type: 'step-editor', stepId: stepId };
        render();
    }

    function saveTasks() {
        writeJson(TASKS_KEY, state.tasks);
        updateBadge();
    }

    function saveEnergy() {
        writeJson(ENERGY_KEY, state.energy);
    }

    function saveSettings() {
        state.settings.defaultView = state.filter;
        writeJson(SETTINGS_KEY, state.settings);
    }

    function saveCapture() {
        if (!state.capture) return;
        writeJson(CAPTURE_KEY, {
            draft: state.capture.draft,
            includeBodyContext: state.capture.includeBodyContext,
            includeMoneyContext: state.capture.includeMoneyContext,
            lastAnalyzedAt: state.capture.lastAnalyzedAt,
            result: state.capture.result
        });
    }

    function getTaskById(taskId) {
        return state.tasks.find(task => task.id === taskId) || null;
    }

    function getTopThree() {
        return state.tasks
            .filter(task => task.isTopThree && task.topThreeOrder)
            .sort((a, b) => a.topThreeOrder - b.topThreeOrder)
            .slice(0, 3);
    }

    function topThreeSlots() {
        const slots = [null, null, null];
        getTopThree().forEach(task => {
            if (task.topThreeOrder >= 1 && task.topThreeOrder <= 3) {
                slots[task.topThreeOrder - 1] = task;
            }
        });
        return slots;
    }

    function getEmptyTopThreeSlot() {
        const slots = topThreeSlots();
        for (let i = 0; i < slots.length; i += 1) {
            if (!slots[i]) return i + 1;
        }
        return null;
    }

    function availableFocusTasks() {
        return state.tasks
            .filter(task => task.type === 'non-routine' && task.status !== 'done' && !task.isTopThree)
            .sort(compareActiveTasks);
    }

    function compareActiveTasks(a, b) {
        const aOverdue = isOverdue(a) ? 1 : 0;
        const bOverdue = isOverdue(b) ? 1 : 0;
        if (aOverdue !== bOverdue) return bOverdue - aOverdue;

        if (a.dueDate && b.dueDate) {
            const aDate = parseDateOnly(a.dueDate);
            const bDate = parseDateOnly(b.dueDate);
            if (aDate && bDate && aDate.getTime() !== bDate.getTime()) {
                return aDate - bDate;
            }
        }

        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;
        return new Date(a.createdAt) - new Date(b.createdAt);
    }

    function compareDoneTasks(a, b) {
        return new Date(b.completedAt || b.updatedAt || b.createdAt) - new Date(a.completedAt || a.updatedAt || a.createdAt);
    }

    function filteredTasks() {
        const tasks = state.tasks.filter(task => task.type === 'non-routine');
        if (state.filter === 'active') {
            return tasks.filter(task => task.status !== 'done').sort(compareActiveTasks);
        }
        if (state.filter === 'done') {
            return tasks.filter(task => task.status === 'done').sort(compareDoneTasks);
        }

        const active = tasks.filter(task => task.status !== 'done').sort(compareActiveTasks);
        const done = tasks.filter(task => task.status === 'done').sort(compareDoneTasks);
        return active.concat(done);
    }

    function taskStepProgress(task) {
        const total = task.steps.length;
        const done = task.steps.filter(step => step.done).length;
        return {
            total: total,
            done: done
        };
    }

    function taskMetaLine(task) {
        const pieces = [];
        if (task.dueDate) pieces.push('Due: ' + formatDate(task.dueDate));
        if (task.steps.length > 0) {
            const progress = taskStepProgress(task);
            pieces.push(progress.done + '/' + progress.total + ' steps');
        }
        if (pieces.length === 0) pieces.push('No due date');
        return pieces.join(' · ');
    }

    function taskListMeta(task) {
        if (!task.dueDate) return '';
        return formatDate(task.dueDate);
    }

    function triggerSparkles(event) {
        if (typeof window.spawnSparkles !== 'function') return;

        let x = window.innerWidth / 2;
        let y = window.innerHeight / 2;

        if (event && typeof event.clientX === 'number' && typeof event.clientY === 'number') {
            x = event.clientX;
            y = event.clientY;
        } else if (event && event.currentTarget && typeof event.currentTarget.getBoundingClientRect === 'function') {
            const rect = event.currentTarget.getBoundingClientRect();
            x = rect.left + rect.width / 2;
            y = rect.top + rect.height / 2;
        }

        window.spawnSparkles(x, y, 12);
    }

    function notify(message) {
        if (typeof window.showToast === 'function') {
            window.showToast(message);
        } else {
            // Fallback toast notification if window.showToast doesn't exist
            const toast = el('div', 'ast-toast', message);
            toast.style.position = 'fixed';
            toast.style.bottom = '20px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.background = 'var(--ast-card)';
            toast.style.color = 'var(--ast-text)';
            toast.style.padding = '10px 16px';
            toast.style.borderRadius = '8px';
            toast.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
            toast.style.zIndex = '10000';
            toast.style.fontFamily = '"Lexend", sans-serif';
            toast.style.fontSize = '14px';
            document.body.appendChild(toast);
            
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transition = 'opacity 0.3s ease';
                setTimeout(() => {
                    document.body.removeChild(toast);
                }, 300);
            }, 3000);
        }
    }

    function formatDateTime(iso) {
        if (!iso) return '';
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    }

    function peekBodyContextValue() {
        if (!window.MissionControl || typeof window.MissionControl.getBodyStatus !== 'function') return null;
        const value = window.MissionControl.getBodyStatus();
        return typeof value === 'string' && value.trim() ? value.trim() : null;
    }

    function getBodyContextValue() {
        if (!state.capture || !state.capture.includeBodyContext) return null;
        return peekBodyContextValue();
    }

    function peekMoneyContextValue() {
        if (!window.MissionControl || typeof window.MissionControl.getSafeToSpend !== 'function') return null;
        const value = window.MissionControl.getSafeToSpend();
        return value === undefined ? null : value;
    }

    function getMoneyContextValue() {
        if (!state.capture || !state.capture.includeMoneyContext) return null;
        return peekMoneyContextValue();
    }

    function getMoneyContextLabel(value) {
        if (value === null || value === undefined || value === '') return 'No money snapshot found';
        if (typeof value === 'number' && Number.isFinite(value)) return '$' + value.toFixed(2) + ' safe to spend';
        if (typeof value === 'string') return value;
        if (typeof value === 'object') {
            if (Number.isFinite(value.safeToSpend)) return '$' + value.safeToSpend.toFixed(2) + ' safe to spend';
            if (Number.isFinite(value.amount)) return '$' + value.amount.toFixed(2) + ' safe to spend';
        }
        return 'Money snapshot attached';
    }

    async function requestAssistantPlan(payload) {
        if (window.__AST_TEST_AI_RESPONSE__) {
            return clone(window.__AST_TEST_AI_RESPONSE__);
        }

        if (typeof supabaseClient !== 'undefined' &&
            supabaseClient &&
            supabaseClient.functions &&
            typeof supabaseClient.functions.invoke === 'function') {
            const response = await supabaseClient.functions.invoke('assistant-plan', {
                body: payload
            });
            if (response.error) {
                throw new Error(response.error.message || 'Could not reach the planner.');
            }
            return response.data && response.data.result ? response.data.result : response.data;
        }

        if (typeof SUPABASE_URL !== 'undefined' && typeof SUPABASE_ANON_KEY !== 'undefined') {
            const response = await fetch(
                SUPABASE_URL.replace(/\/$/, '') + '/functions/v1/assistant-plan',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
                    },
                    body: JSON.stringify(payload)
                }
            );

            const body = await response.json().catch(function() {
                return null;
            });

            if (!response.ok) {
                throw new Error(body && body.error ? body.error : 'Could not reach the planner.');
            }

            return body && body.result ? body.result : body;
        }

        throw new Error('AI planner is not configured yet.');
    }

    function plannerErrorMessage(err) {
        const message = err && err.message ? String(err.message) : 'Could not build a plan right now.';
        if (/not configured/i.test(message)) return 'AI planner is not configured yet.';
        if (/Failed to fetch|NetworkError|Could not reach/i.test(message)) return 'Could not reach the AI planner right now.';
        return message;
    }

    async function analyzeCapture() {
        if (!state.capture) return;

        const draft = state.capture.draft.trim();
        if (!draft) {
            state.capture.error = 'Give the planner something real to sort first.';
            render();
            return;
        }

        state.capture.loading = true;
        state.capture.error = '';
        render();

        try {
            const result = await requestAssistantPlan({
                dump: draft,
                context: {
                    bodyStatus: getBodyContextValue(),
                    safeToSpend: getMoneyContextValue()
                }
            });

            state.capture.result = normalizePlanResult(result);
            state.capture.lastAnalyzedAt = nowIso();
            state.capture.error = '';
            saveCapture();
        } catch (err) {
            state.capture.error = plannerErrorMessage(err);
        } finally {
            state.capture.loading = false;
            render();
        }
    }

    function clearCapture() {
        state.capture = normalizeCapture(defaultCapture());
        saveCapture();
        render();
    }

    function getSuggestionById(suggestionId) {
        if (!state.capture || !state.capture.result) return null;
        return state.capture.result.taskSuggestions.find(item => item.id === suggestionId) || null;
    }

    async function expandSuggestion(suggestionId) {
        const suggestion = getSuggestionById(suggestionId);
        if (!suggestion || suggestion.expanding) return;

        if (suggestion.expanded) {
            suggestion.expandCollapsed = !suggestion.expandCollapsed;
            saveCapture();
            render();
            return;
        }

        suggestion.expanding = true;
        suggestion.expandError = '';
        saveCapture();
        render();

        try {
            const result = await requestAssistantPlan({
                mode: 'expand',
                task: {
                    title: suggestion.title,
                    why: suggestion.why,
                    steps: suggestion.steps.map(function(step) {
                        return typeof step === 'string' ? step : (step && step.text) || '';
                    }).filter(Boolean)
                },
                originalDump: state.capture && state.capture.draft ? state.capture.draft : ''
            });

            const normalized = normalizeExpanded(result);
            if (!normalized) {
                suggestion.expandError = 'Planner returned nothing useful.';
            } else {
                suggestion.expanded = normalized;
            }
            saveCapture();
        } catch (err) {
            suggestion.expandError = plannerErrorMessage(err);
        } finally {
            suggestion.expanding = false;
            render();
        }
    }

    function addTaskFromSuggestion(suggestionId) {
        const suggestion = getSuggestionById(suggestionId);
        if (!suggestion || suggestion.addedTaskId) return;

        const taskId = makeTaskId();
        state.tasks.push(normalizeTask({
            id: taskId,
            title: suggestion.title,
            description: suggestion.why || '',
            dueDate: suggestion.dueDate,
            steps: suggestion.steps.map(function(step, index) {
                return {
                    id: makeStepId(),
                    text: step,
                    done: false,
                    order: index + 1
                };
            }),
            sortOrder: state.tasks.length
        }, state.tasks.length));

        suggestion.addedTaskId = taskId;
        saveTasks();
        saveCapture();
        render();
    }

    function clearTopThree(task) {
        task.isTopThree = false;
        task.topThreeOrder = null;
    }

    function assignTopThree(task, slot) {
        if (!task || !slot) return;
        state.tasks.forEach(other => {
            if (other.id !== task.id && other.topThreeOrder === slot) {
                clearTopThree(other);
            }
        });
        task.isTopThree = true;
        task.topThreeOrder = slot;
    }

    function addTaskToFocus(taskId, slot) {
        const task = getTaskById(taskId);
        if (!task) return;
        const targetSlot = slot || getEmptyTopThreeSlot();
        if (!targetSlot) {
            notify('Focus is full');
            return;
        }
        assignTopThree(task, targetSlot);
        task.updatedAt = nowIso();
        saveTasks();
        render();
    }

    function removeTaskFromFocus(taskId) {
        const task = getTaskById(taskId);
        if (!task) return;
        clearTopThree(task);
        task.updatedAt = nowIso();
        saveTasks();
        render();
    }

    function setTaskStatus(taskId, status, event) {
        const task = getTaskById(taskId);
        if (!task || task.status === status) return;

        task.status = status;
        task.updatedAt = nowIso();

        if (status === 'done') {
            task.completedAt = task.updatedAt;
            clearTopThree(task);
            triggerSparkles(event);
        } else {
            task.completedAt = null;
        }

        saveTasks();
        render();
    }

    function toggleTaskStep(taskId, stepId, done) {
        const task = getTaskById(taskId);
        if (!task) return;
        const step = task.steps.find(item => item.id === stepId);
        if (!step) return;
        step.done = done;
        task.updatedAt = nowIso();
        saveTasks();
        render();
    }

    function deleteTask(taskId) {
        const before = state.tasks.length;
        state.tasks = state.tasks.filter(task => task.id !== taskId);
        if (state.tasks.length === before) return;
        if (state.expandedTaskId === taskId) state.expandedTaskId = null;
        saveTasks();
        render();
    }

    function setEnergyLevel(level) {
        const clamped = Math.min(ENERGY_MAX, Math.max(1, level));
        state.energy.level = clamped;
        state.energy.max = ENERGY_MAX;
        state.energy.updatedAt = nowIso();

        const today = todayLocalStr();
        const history = Array.isArray(state.energy.history) ? state.energy.history.slice() : [];
        const existing = history.find(entry => entry.date === today);
        if (existing) {
            existing.level = clamped;
        } else {
            history.push({ date: today, level: clamped });
        }
        state.energy.history = history.slice(-30);
        saveEnergy();
        render();
    }

    function setFilter(filter) {
        if (!FILTERS.includes(filter)) return;
        state.filter = filter;
        saveSettings();
        render();
    }

    function openPicker(slot) {
        state.pickerSlot = slot;
        render();
    }

    function closePicker() {
        state.pickerSlot = null;
        render();
    }

    function taskToDraft(task) {
        const source = task || null;
        const steps = source && source.steps ? renumberSteps(source.steps.map(step => ({
            id: step.id,
            text: step.text,
            done: !!step.done,
            order: step.order
        }))) : [];
        return {
            mode: source ? 'edit' : 'add',
            taskId: source ? source.id : null,
            title: source ? source.title : '',
            description: source ? source.description : '',
            dueDate: source && source.dueDate ? source.dueDate : '',
            noDueDate: !(source && source.dueDate),
            isOngoing: !!(source && source.isOngoing),
            stepsEnabled: steps.length > 0,
            steps: steps,
            titleError: false,
            promptsDismissed: steps.length > 0
        };
    }

    function openTaskModal(taskId) {
        const task = taskId ? getTaskById(taskId) : null;
        state.modal = taskToDraft(task);
        pendingFocusTarget = { type: 'named', name: 'ast-title' };
        render();
    }

    function closeTaskModal() {
        state.modal = null;
        render();
    }

    function captureModalDraft() {
        if (!state.modal || !host) return state.modal;
        const modal = host.querySelector('.ast-modal');
        if (!modal) return state.modal;

        const titleInput = modal.querySelector('[name="ast-title"]');
        const descriptionInput = modal.querySelector('[name="ast-description"]');
        const dueDateInput = modal.querySelector('[name="ast-due-date"]');
        const noDueDateInput = modal.querySelector('[name="ast-no-due-date"]');
        const isOngoingInput = modal.querySelector('[name="ast-is-ongoing"]');
        const stepsEnabledInput = modal.querySelector('[name="ast-steps-enabled"]');
        const stepInputs = modal.querySelectorAll('.ast-step-editor-input');
        const stepMap = new Map((state.modal.steps || []).map(step => [step.id, step]));

        state.modal.title = titleInput ? titleInput.value : state.modal.title;
        state.modal.description = descriptionInput ? descriptionInput.value : state.modal.description;
        state.modal.noDueDate = !!(noDueDateInput && noDueDateInput.checked);
        state.modal.dueDate = state.modal.noDueDate ? '' : (dueDateInput ? dueDateInput.value : state.modal.dueDate);
        state.modal.isOngoing = !!(isOngoingInput && isOngoingInput.checked);
        state.modal.stepsEnabled = !!(stepsEnabledInput && stepsEnabledInput.checked);
        state.modal.steps = Array.from(stepInputs).map((input, index) => {
            const existing = stepMap.get(input.dataset.stepId);
            return {
                id: input.dataset.stepId || makeStepId(),
                text: input.value,
                done: existing ? !!existing.done : false,
                order: index + 1
            };
        });
        state.modal.steps = renumberSteps(state.modal.steps);

        return state.modal;
    }

    function saveModalTask() {
        const draft = captureModalDraft();
        const title = draft.title.trim();
        if (!title) {
            draft.titleError = true;
            pendingFocusTarget = { type: 'named', name: 'ast-title' };
            render();
            return;
        }

        const dueDate = draft.noDueDate ? null : (draft.dueDate || null);
        const steps = draft.stepsEnabled
            ? draft.steps
                .map((step, index) => ({
                    id: step.id || makeStepId(),
                    text: (step.text || '').trim(),
                    done: !!step.done,
                    order: index + 1
                }))
                .filter(step => step.text)
            : [];

        if (draft.mode === 'edit' && draft.taskId) {
            const task = getTaskById(draft.taskId);
            if (!task) return;
            task.title = title;
            task.description = draft.description.trim();
            task.dueDate = dueDate;
            task.isOngoing = !!draft.isOngoing;
            task.steps = steps;
            task.updatedAt = nowIso();
        } else {
            state.tasks.push(normalizeTask({
                title: title,
                description: draft.description.trim(),
                dueDate: dueDate,
                isOngoing: !!draft.isOngoing,
                steps: steps,
                sortOrder: state.tasks.length
            }, state.tasks.length));
        }

        state.modal = null;
        saveTasks();
        render();
    }

    function renderPlanResult(result) {
        const wrap = el('div', 'ast-plan-output');

        if (result.summary) {
            wrap.appendChild(el('div', 'ast-plan-summary', result.summary));
        }

        if (result.recommendedFocus || result.quickWin) {
            const row = el('div', 'ast-plan-chips');

            if (result.recommendedFocus) {
                const focus = el('div', 'ast-plan-chip ast-plan-chip-focus');
                focus.appendChild(el('span', 'ast-plan-chip-label', 'Do first'));
                focus.appendChild(el('span', 'ast-plan-chip-text', result.recommendedFocus));
                row.appendChild(focus);
            }

            if (result.quickWin) {
                const quickWin = el('div', 'ast-plan-chip ast-plan-chip-win');
                quickWin.appendChild(el('span', 'ast-plan-chip-label', 'Quick win'));
                quickWin.appendChild(el('span', 'ast-plan-chip-text', result.quickWin));
                row.appendChild(quickWin);
            }

            wrap.appendChild(row);
        }

        if (result.taskSuggestions.length > 0) {
            const tasks = el('div', 'ast-plan-panel');
            tasks.appendChild(el('div', 'ast-plan-label', 'Suggested tasks'));
            const list = el('div', 'ast-plan-task-list');

            result.taskSuggestions.forEach(function(suggestion) {
                const card = el('div', 'ast-plan-task-card');
                const header = el('div', 'ast-plan-task-header');
                const titleWrap = el('div', 'ast-plan-task-title-wrap');
                const title = el('div', 'ast-plan-task-title', suggestion.title);
                const metaBits = [];
                if (suggestion.dueDate) metaBits.push('Due ' + formatDate(suggestion.dueDate));
                metaBits.push('Energy ' + suggestion.energyFit);
                const meta = el('div', 'ast-plan-task-meta', metaBits.join(' · '));

                titleWrap.appendChild(title);
                titleWrap.appendChild(meta);
                header.appendChild(titleWrap);

                const action = el(
                    'button',
                    'ast-action-btn' + (suggestion.addedTaskId ? ' ast-action-btn-done' : ' ast-primary'),
                    suggestion.addedTaskId ? 'Added' : 'Add Task'
                );
                action.type = 'button';
                action.dataset.astAction = 'add-plan-task';
                action.dataset.suggestionId = suggestion.id;
                action.disabled = !!suggestion.addedTaskId;
                header.appendChild(action);
                card.appendChild(header);

                if (suggestion.why) {
                    card.appendChild(el('div', 'ast-plan-task-why', suggestion.why));
                }

                if (suggestion.steps.length > 0) {
                    const stepList = el('div', 'ast-plan-step-list');
                    suggestion.steps.forEach(function(step) {
                        stepList.appendChild(el('div', 'ast-plan-step', '• ' + step));
                    });
                    card.appendChild(stepList);
                }

                const expandRow = el('div', 'ast-plan-expand-row');
                const expandIsOpen = suggestion.expanded && !suggestion.expandCollapsed;
                const expandBtnLabel = suggestion.expanding
                    ? 'Thinking…'
                    : (expandIsOpen ? 'Hide breakdown' : (suggestion.expanded ? 'Show breakdown' : 'Break it down more'));
                const expandBtn = el(
                    'button',
                    'ast-action-btn ast-plan-expand-btn' + (expandIsOpen ? ' ast-plan-expand-btn-open' : ''),
                    expandBtnLabel
                );
                expandBtn.type = 'button';
                expandBtn.dataset.astAction = 'expand-suggestion';
                expandBtn.dataset.suggestionId = suggestion.id;
                expandBtn.disabled = !!suggestion.expanding;
                expandRow.appendChild(expandBtn);
                card.appendChild(expandRow);

                if (suggestion.expandError) {
                    card.appendChild(el('div', 'ast-plan-error', suggestion.expandError));
                }

                if (suggestion.expanded && !suggestion.expandCollapsed) {
                    const detailBox = el('div', 'ast-plan-expanded');
                    if (suggestion.expanded.detail) {
                        detailBox.appendChild(el('div', 'ast-plan-expanded-detail', suggestion.expanded.detail));
                    }
                    if (suggestion.expanded.steps.length > 0) {
                        detailBox.appendChild(el('div', 'ast-plan-label', 'Deeper steps'));
                        const deeperList = el('div', 'ast-plan-step-list');
                        suggestion.expanded.steps.forEach(function(step) {
                            deeperList.appendChild(el('div', 'ast-plan-step', '• ' + step));
                        });
                        detailBox.appendChild(deeperList);
                    }
                    card.appendChild(detailBox);
                }

                list.appendChild(card);
            });

            tasks.appendChild(list);
            wrap.appendChild(tasks);
        }

        return wrap;
    }

    function renderCapture(shell) {
        const card = el('section', 'ast-card');
        card.appendChild(el('h2', '', 'CAPTURE + PLAN'));
        card.appendChild(el('div', 'ast-capture-blurb', 'Dump the messy version. The planner turns it into concrete next moves.'));

        const textarea = document.createElement('textarea');
        textarea.className = 'ast-textarea ast-capture-input';
        textarea.name = 'ast-capture-draft';
        textarea.placeholder = 'What is bouncing around right now? Dump the messy version here.';
        textarea.value = state.capture.draft;
        card.appendChild(textarea);

        const context = el('div', 'ast-capture-context');
        const bodyRow = el('label', 'ast-capture-toggle');
        const bodyInput = document.createElement('input');
        const bodyCopy = el('div', 'ast-capture-toggle-copy');
        bodyInput.type = 'checkbox';
        bodyInput.name = 'ast-capture-body';
        bodyInput.checked = state.capture.includeBodyContext;
        bodyCopy.appendChild(el('div', 'ast-capture-toggle-title', 'Use body context'));
        bodyCopy.appendChild(el('div', 'ast-capture-toggle-meta', peekBodyContextValue() || 'No body status found'));
        bodyRow.appendChild(bodyInput);
        bodyRow.appendChild(bodyCopy);
        context.appendChild(bodyRow);

        const moneyRow = el('label', 'ast-capture-toggle');
        const moneyInput = document.createElement('input');
        const moneyCopy = el('div', 'ast-capture-toggle-copy');
        moneyInput.type = 'checkbox';
        moneyInput.name = 'ast-capture-money';
        moneyInput.checked = state.capture.includeMoneyContext;
        moneyCopy.appendChild(el('div', 'ast-capture-toggle-title', 'Use money context'));
        moneyCopy.appendChild(el('div', 'ast-capture-toggle-meta', getMoneyContextLabel(peekMoneyContextValue())));
        moneyRow.appendChild(moneyInput);
        moneyRow.appendChild(moneyCopy);
        context.appendChild(moneyRow);
        card.appendChild(context);

        card.appendChild(el('div', 'ast-capture-note', 'What you type here and any selected context get sent to the planner service.'));

        const actions = el('div', 'ast-capture-actions');
        const clear = el('button', 'ast-cancel-btn', 'Clear');
        const analyze = el('button', 'ast-save-btn', state.capture.loading ? 'Making a Plan…' : 'Make a Plan');
        clear.type = 'button';
        clear.dataset.astAction = 'clear-capture';
        clear.disabled = state.capture.loading;
        analyze.type = 'button';
        analyze.dataset.astAction = 'analyze-capture';
        analyze.disabled = state.capture.loading;
        actions.appendChild(clear);
        actions.appendChild(analyze);
        card.appendChild(actions);

        if (state.capture.error) {
            card.appendChild(el('div', 'ast-plan-error', state.capture.error));
        } else if (state.capture.loading) {
            card.appendChild(el('div', 'ast-plan-status', 'Planner is sorting it now...'));
        } else if (state.capture.lastAnalyzedAt) {
            card.appendChild(el('div', 'ast-plan-status', 'Last plan: ' + formatDateTime(state.capture.lastAnalyzedAt)));
        }

        if (state.capture.result) {
            card.appendChild(renderPlanResult(state.capture.result));
        }

        shell.appendChild(card);
    }

    // --- Briefing helpers ---

    function getBriefingGreeting() {
        var hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    }

    function getBriefingEmoji() {
        // mood pool — seeded by today's date so it's stable within a day
        // but different tomorrow (variable reward for ADHD novelty)
        var pool = ['🐱', '🌙', '✨', '🪴', '🧸', '☕', '🦊', '🐾'];
        var today = todayLocalStr();
        var seed = 0;
        for (var i = 0; i < today.length; i++) {
            seed = seed + today.charCodeAt(i);
        }
        return pool[seed % pool.length];
    }

    function getReasonLabel(task) {
        // explains WHY this card is surfaced
        if (isOverdue(task)) {
            var due = parseDateOnly(task.dueDate);
            var today = parseDateOnly(todayLocalStr());
            if (due && today) {
                var days = Math.round((today - due) / 86400000);
                return 'Carried forward ' + days + (days === 1 ? ' day' : ' days');
            }
            return 'Carried forward';
        }
        if (isDueSoon(task)) return 'Due today';
        if (task.dueDate) return 'Due ' + formatDate(task.dueDate);
        if (task.status === 'in_progress') return 'In progress';
        return 'Next up';
    }

    function getBriefingTasks() {
        // get the top 3 most relevant active tasks using existing sort
        return state.tasks
            .filter(function(task) {
                return task.type === 'non-routine' && task.status !== 'done';
            })
            .sort(compareActiveTasks)
            .slice(0, 3);
    }

    function renderBriefingCard(task, isMain) {
        var card = el('button', 'ast-briefing-card' + (isMain ? ' ast-briefing-main' : ''));
        card.type = 'button';
        card.dataset.astAction = 'briefing-open-task';
        card.dataset.taskId = task.id;

        // reason label — WHY this card is here
        var reason = el('div', 'ast-briefing-reason', getReasonLabel(task));
        card.appendChild(reason);

        // task title
        var title = el('div', 'ast-briefing-title', task.title);
        card.appendChild(title);

        // meta line (due date, step progress)
        var meta = taskMetaLine(task);
        if (meta) {
            card.appendChild(el('div', 'ast-briefing-meta', meta));
        }

        // step progress bar for main card
        if (isMain && task.steps.length > 0) {
            var progress = taskStepProgress(task);
            var bar = el('div', 'ast-briefing-progress');
            var fill = el('div', 'ast-briefing-progress-fill');
            fill.style.width = Math.round((progress.done / progress.total) * 100) + '%';
            bar.appendChild(fill);
            card.appendChild(bar);
        }

        return card;
    }

    function renderBriefing(shell) {
        var card = el('section', 'ast-card ast-briefing-section');

        // header: greeting + date + emoji
        var header = el('div', 'ast-briefing-header');
        var greeting = el('div', 'ast-briefing-greeting', getBriefingGreeting());
        var now = new Date();
        var dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        var timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        var dateLine = el('div', 'ast-briefing-date', dateStr + ' · ' + timeStr);
        var emoji = el('div', 'ast-briefing-emoji', getBriefingEmoji());

        header.appendChild(greeting);
        header.appendChild(dateLine);
        header.appendChild(emoji);
        card.appendChild(header);

        // get the briefing tasks
        var tasks = getBriefingTasks();

        if (tasks.length === 0) {
            // nothing to show — calm state
            var empty = el('div', 'ast-briefing-empty', 'Nothing urgent right now. You\'re caught up.');
            card.appendChild(empty);
        } else {
            // 1 main card
            var cardsWrap = el('div', 'ast-briefing-cards');
            cardsWrap.appendChild(renderBriefingCard(tasks[0], true));

            // 2 smaller cards (if they exist)
            if (tasks.length > 1) {
                var smallRow = el('div', 'ast-briefing-small-row');
                smallRow.appendChild(renderBriefingCard(tasks[1], false));
                if (tasks.length > 2) {
                    smallRow.appendChild(renderBriefingCard(tasks[2], false));
                }
                cardsWrap.appendChild(smallRow);
            }
            card.appendChild(cardsWrap);
        }

        // link to full task list
        var viewAll = el('button', 'ast-briefing-view-all', 'View all tasks →');
        viewAll.type = 'button';
        viewAll.dataset.astAction = 'switch-to-tasks';
        card.appendChild(viewAll);

        shell.appendChild(card);
    }

    function renderEnergyCard(shell) {
        const card = el('section', 'ast-card ast-energy-card');
        const title = el('div', 'ast-section-title', 'Energy');
        const hitbox = el('button', 'ast-energy-hitbox');
        const bar = el('div', 'ast-energy-bar');
        const fill = el('div', 'ast-energy-fill');
        const meta = el('div', 'ast-energy-meta');
        const value = el('div', 'ast-energy-value', state.energy.level + '/' + state.energy.max);
        const labelInfo = getEnergyLabel(state.energy.level);
        const label = el('div', 'ast-energy-label', labelInfo.text);

        hitbox.type = 'button';
        hitbox.dataset.astEnergyBar = 'true';
        fill.style.width = ((state.energy.level / state.energy.max) * 100) + '%';
        label.style.color = labelInfo.color;

        bar.appendChild(fill);
        hitbox.appendChild(bar);
        meta.appendChild(value);
        meta.appendChild(label);
        card.appendChild(title);
        card.appendChild(hitbox);
        card.appendChild(meta);
        shell.appendChild(card);
    }

    function renderTopThree(shell) {
        const card = el('section', 'ast-card');
        card.appendChild(el('h2', '', 'TOP 3 FOCUS'));

        const list = el('div', 'ast-top3-list');
        topThreeSlots().forEach((task, index) => {
            const slot = index + 1;
            if (!task) {
                const empty = el('button', 'ast-empty-slot', '+ Pick a focus task');
                empty.type = 'button';
                empty.dataset.astAction = 'open-picker';
                empty.dataset.slot = String(slot);
                list.appendChild(empty);
                return;
            }

            const wrap = el('div', 'ast-card ast-focus-slot');
            const row = el('div', 'ast-focus-task');
            const doneButton = el('button', 'ast-checkbox-btn', '○');
            const main = el('div', 'ast-focus-main');
            const title = el('div', 'ast-focus-title', task.title);
            const detail = el('div', 'ast-focus-detail', taskMetaLine(task));
            const remove = el('button', 'ast-icon-btn', '×');

            doneButton.type = 'button';
            doneButton.dataset.astAction = 'complete-focus-task';
            doneButton.dataset.taskId = task.id;

            remove.type = 'button';
            remove.dataset.astAction = 'remove-focus';
            remove.dataset.taskId = task.id;

            main.appendChild(title);
            main.appendChild(detail);
            row.appendChild(doneButton);
            row.appendChild(main);
            row.appendChild(remove);
            wrap.appendChild(row);
            list.appendChild(wrap);
        });

        card.appendChild(list);
        shell.appendChild(card);
    }

    function renderTaskRow(task) {
        const expanded = state.expandedTaskId === task.id;
        const row = el('div', 'ast-task-row' + (expanded ? ' ast-expanded' : '') + (isOverdue(task) ? ' ast-overdue' : ''));
        const header = el('button', 'ast-task-header');
        const dot = el('span', 'ast-task-status ast-status-' + task.status);
        const titleWrap = el('div', 'ast-task-title-wrap');
        const title = el('div', 'ast-task-title', task.title);
        const meta = el('div', 'ast-task-meta');
        const due = el('span', '', taskListMeta(task));
        const chevron = el('span', 'ast-task-chevron', expanded ? '⌄' : '›');

        header.type = 'button';
        header.dataset.astAction = 'toggle-task';
        header.dataset.taskId = task.id;

        titleWrap.appendChild(title);
        if (expanded && task.dueDate) {
            const expandedMeta = el('div', 'ast-focus-detail', formatDate(task.dueDate));
            titleWrap.appendChild(expandedMeta);
        }

        meta.appendChild(due);
        meta.appendChild(chevron);
        header.appendChild(dot);
        header.appendChild(titleWrap);
        header.appendChild(meta);
        row.appendChild(header);

        if (!expanded) return row;

        const body = el('div', 'ast-task-body');

        if (task.description) {
            body.appendChild(el('div', 'ast-task-description', task.description));
        }

        if (task.steps.length > 0) {
            const progress = taskStepProgress(task);
            body.appendChild(el('div', 'ast-step-progress', progress.done + '/' + progress.total + ' steps done'));
            const stepList = el('div', 'ast-step-list');
            task.steps
                .slice()
                .sort((a, b) => a.order - b.order)
                .forEach(step => {
                    const item = el('label', 'ast-step-item');
                    const input = document.createElement('input');
                    const text = el('span', 'ast-step-text' + (step.done ? ' ast-step-done' : ''), step.text);

                    input.type = 'checkbox';
                    input.checked = step.done;
                    input.dataset.astAction = 'toggle-step';
                    input.dataset.taskId = task.id;
                    input.dataset.stepId = step.id;

                    item.appendChild(input);
                    item.appendChild(text);
                    stepList.appendChild(item);
                });
            body.appendChild(stepList);
        }

        const statusRow = el('div', 'ast-status-row');
        [
            ['not_started', 'Not Started'],
            ['in_progress', 'In Progress'],
            ['done', 'Done']
        ].forEach(pair => {
            const button = el('button', 'ast-status-btn' + (task.status === pair[0] ? ' ast-active' : ''), pair[1]);
            button.type = 'button';
            button.dataset.astAction = 'set-status';
            button.dataset.taskId = task.id;
            button.dataset.status = pair[0];
            statusRow.appendChild(button);
        });
        body.appendChild(statusRow);

        const actions = el('div', 'ast-action-row');
        const focusButton = el(
            'button',
            'ast-action-btn',
            task.isTopThree ? 'Remove from Focus' : '★ Add to Focus'
        );
        const editButton = el('button', 'ast-action-btn', '✏ Edit');
        const deleteButton = el('button', 'ast-action-btn', '🗑 Del');

        focusButton.type = 'button';
        focusButton.dataset.astAction = task.isTopThree ? 'remove-focus' : 'toggle-focus';
        focusButton.dataset.taskId = task.id;

        editButton.type = 'button';
        editButton.dataset.astAction = 'open-edit-task';
        editButton.dataset.taskId = task.id;

        deleteButton.type = 'button';
        deleteButton.dataset.astAction = 'delete-task';
        deleteButton.dataset.taskId = task.id;

        actions.appendChild(focusButton);
        actions.appendChild(editButton);
        actions.appendChild(deleteButton);
        body.appendChild(actions);

        row.appendChild(body);
        return row;
    }

    function renderTasks(shell) {
        const card = el('section', 'ast-card');
        card.appendChild(el('h2', '', 'NON-ROUTINE TASKS'));

        const filterRow = el('div', 'ast-filter-row');
        [
            ['all', 'All'],
            ['active', 'Active'],
            ['done', 'Done']
        ].forEach(pair => {
            const button = el('button', 'ast-filter-pill' + (state.filter === pair[0] ? ' ast-active' : ''), pair[1]);
            button.type = 'button';
            button.dataset.astAction = 'set-filter';
            button.dataset.filter = pair[0];
            filterRow.appendChild(button);
        });
        card.appendChild(filterRow);

        const list = el('div', 'ast-task-list');
        const tasks = filteredTasks();
        if (tasks.length === 0) {
            list.appendChild(el('div', 'ast-empty-state', state.filter === 'done' ? 'No completed tasks yet.' : 'No tasks here yet. Add one below.'));
        } else {
            tasks.forEach(task => list.appendChild(renderTaskRow(task)));
        }
        card.appendChild(list);

        const addCard = el('button', 'ast-add-card', '+ Add Task');
        addCard.type = 'button';
        addCard.dataset.astAction = 'open-add-task';
        card.appendChild(addCard);

        shell.appendChild(card);
    }

    function renderRoutine(shell) {
        const card = el('section', 'ast-card');
        card.appendChild(el('h2', '', 'ROUTINE TASKS'));
        card.appendChild(el('div', 'ast-placeholder-card', 'Coming soon — daily and weekly routines will live here.'));
        shell.appendChild(card);
    }

    function renderPicker() {
        if (!state.pickerSlot) return null;

        const overlay = el('div', 'ast-overlay');
        overlay.dataset.astOverlay = 'picker';

        const picker = el('div', 'ast-picker');

        picker.appendChild(el('div', 'ast-picker-title', 'Pick a focus task'));
        const list = el('div', 'ast-picker-list');
        const tasks = availableFocusTasks();

        if (tasks.length === 0) {
            list.appendChild(el('div', 'ast-empty-state', 'No active tasks available for focus right now.'));
        } else {
            tasks.forEach(task => {
                const button = el('button', 'ast-picker-option');
                const title = el('div', 'ast-picker-title-row', task.title);
                const detail = el('div', 'ast-picker-detail-row', taskMetaLine(task));

                button.type = 'button';
                button.dataset.astAction = 'pick-focus-task';
                button.dataset.taskId = task.id;
                button.dataset.slot = String(state.pickerSlot);

                button.appendChild(title);
                button.appendChild(detail);
                list.appendChild(button);
            });
        }

        const cancel = el('button', 'ast-cancel-btn', 'Cancel');
        cancel.type = 'button';
        cancel.dataset.astAction = 'close-picker';

        picker.appendChild(list);
        picker.appendChild(cancel);
        overlay.appendChild(picker);
        return overlay;
    }

    function renderModalStepBuilder(draft) {
        const wrap = el('div', 'ast-step-builder');
        const showPrompts = shouldShowThinkingPrompts(draft);
        const hasWrittenSteps = countFilledSteps(draft.steps) > 0;
        if (showPrompts) {
            const promptsBox = el('div', 'ast-thinking-prompts');
            getThinkingPrompts(draft.title).forEach(prompt => {
                promptsBox.appendChild(el('div', 'ast-thinking-prompt', '• ' + prompt));
            });

            const dismiss = el('button', 'ast-prompts-dismiss', 'Got it, hide these');
            dismiss.type = 'button';
            dismiss.dataset.astAction = 'dismiss-thinking-prompts';
            promptsBox.appendChild(dismiss);
            wrap.appendChild(promptsBox);
        }

        const actionRow = el('div', 'ast-step-builder-actions');
        const add = el('button', 'ast-action-btn', '+ Add step');
        const think = el('button', 'ast-cancel-btn', 'Help me think');

        add.type = 'button';
        add.dataset.astAction = 'add-modal-step';
        think.type = 'button';
        think.dataset.astAction = 'show-thinking-prompts';

        if (!showPrompts && !hasWrittenSteps) {
            actionRow.appendChild(think);
        }
        actionRow.appendChild(add);
        wrap.appendChild(actionRow);

        draft.steps.forEach((step, index) => {
            const row = el('div', 'ast-step-editor-row');
            const input = document.createElement('input');
            const controls = el('div', 'ast-step-editor-controls');
            const up = el('button', 'ast-icon-btn ast-step-move', 'Up');
            const down = el('button', 'ast-icon-btn ast-step-move', 'Dn');
            const del = el('button', 'ast-icon-btn ast-step-delete', '×');

            input.className = 'ast-input ast-step-editor-input';
            input.placeholder = 'Step ' + step.order;
            input.value = step.text;
            input.type = 'text';
            input.dataset.stepId = step.id;

            up.type = 'button';
            up.dataset.astAction = 'move-modal-step-up';
            up.dataset.stepId = step.id;
            up.disabled = index === 0;
            up.title = 'Move step up';

            down.type = 'button';
            down.dataset.astAction = 'move-modal-step-down';
            down.dataset.stepId = step.id;
            down.disabled = index === draft.steps.length - 1;
            down.title = 'Move step down';

            del.type = 'button';
            del.dataset.astAction = 'delete-modal-step';
            del.dataset.stepId = step.id;
            del.title = 'Delete step';

            controls.appendChild(up);
            controls.appendChild(down);
            controls.appendChild(del);
            row.appendChild(input);
            row.appendChild(controls);
            wrap.appendChild(row);
        });
        return wrap;
    }

    function renderModal() {
        if (!state.modal) return null;

        const draft = state.modal;
        const overlay = el('div', 'ast-overlay');
        overlay.dataset.astOverlay = 'modal';

        const modal = el('div', 'ast-modal');

        modal.appendChild(el('h3', 'ast-modal-title', draft.mode === 'edit' ? 'Edit Task' : 'Add Task'));

        const titleField = el('div', 'ast-field');
        const titleLabel = el('label', 'ast-label', 'Title');
        const titleInput = document.createElement('input');
        titleInput.name = 'ast-title';
        titleInput.className = 'ast-input' + (draft.titleError ? ' ast-error' : '');
        titleInput.placeholder = 'What needs to get done?';
        titleInput.value = draft.title;
        titleField.appendChild(titleLabel);
        titleField.appendChild(titleInput);
        modal.appendChild(titleField);

        const descField = el('div', 'ast-field');
        const descLabel = el('label', 'ast-label', 'Description');
        const descInput = document.createElement('textarea');
        descInput.name = 'ast-description';
        descInput.className = 'ast-textarea';
        descInput.placeholder = 'Any details or notes? (optional)';
        descInput.value = draft.description;
        descField.appendChild(descLabel);
        descField.appendChild(descInput);
        modal.appendChild(descField);

        const dueField = el('div', 'ast-field');
        dueField.appendChild(el('label', 'ast-label', 'Due date'));
        const dueRow = el('div', 'ast-inline-row');
        const dueInput = document.createElement('input');
        dueInput.type = 'date';
        dueInput.name = 'ast-due-date';
        dueInput.className = 'ast-date-input';
        dueInput.value = draft.dueDate;
        dueInput.disabled = draft.noDueDate;
        const noDueWrap = el('label', 'ast-check-row');
        const noDueInput = document.createElement('input');
        noDueInput.type = 'checkbox';
        noDueInput.name = 'ast-no-due-date';
        noDueInput.checked = draft.noDueDate;
        noDueInput.dataset.astAction = 'toggle-no-due-date';
        noDueWrap.appendChild(noDueInput);
        noDueWrap.appendChild(document.createTextNode('No due date'));
        dueRow.appendChild(dueInput);
        dueField.appendChild(dueRow);
        dueField.appendChild(noDueWrap);
        modal.appendChild(dueField);

        const ongoingWrap = el('label', 'ast-check-row');
        const ongoingInput = document.createElement('input');
        ongoingInput.type = 'checkbox';
        ongoingInput.name = 'ast-is-ongoing';
        ongoingInput.checked = draft.isOngoing;
        ongoingWrap.appendChild(ongoingInput);
        ongoingWrap.appendChild(document.createTextNode('This is an ongoing project'));
        modal.appendChild(ongoingWrap);

        const stepsWrap = el('label', 'ast-check-row');
        const stepsInput = document.createElement('input');
        stepsInput.type = 'checkbox';
        stepsInput.name = 'ast-steps-enabled';
        stepsInput.checked = draft.stepsEnabled;
        stepsInput.dataset.astAction = 'toggle-steps';
        stepsWrap.appendChild(stepsInput);
        stepsWrap.appendChild(document.createTextNode('Break this into steps?'));
        modal.appendChild(stepsWrap);

        if (draft.stepsEnabled) {
            modal.appendChild(renderModalStepBuilder(draft));
        }

        const actions = el('div', 'ast-modal-actions');
        const cancel = el('button', 'ast-cancel-btn', 'Cancel');
        const save = el('button', 'ast-save-btn', 'Save');

        cancel.type = 'button';
        cancel.dataset.astAction = 'close-modal';

        save.type = 'button';
        save.dataset.astAction = 'save-modal-task';

        actions.appendChild(cancel);
        actions.appendChild(save);
        modal.appendChild(actions);

        overlay.appendChild(modal);
        return overlay;
    }

    function describeFocusTarget(element) {
        if (!element) return null;

        let selectionStart = null;
        let selectionEnd = null;
        try {
            selectionStart = typeof element.selectionStart === 'number' ? element.selectionStart : null;
            selectionEnd = typeof element.selectionEnd === 'number' ? element.selectionEnd : null;
        } catch (err) {
            selectionStart = null;
            selectionEnd = null;
        }

        const target = {
            selectionStart: selectionStart,
            selectionEnd: selectionEnd
        };

        if (element.matches('.ast-step-editor-input')) {
            target.type = 'step-editor';
            target.stepId = element.dataset.stepId || null;
            return target;
        }

        if (element.name) {
            target.type = 'named';
            target.name = element.name;
            return target;
        }

        if (element.dataset.astAction) {
            target.type = 'action';
            target.action = element.dataset.astAction;
            target.taskId = element.dataset.taskId || null;
            target.stepId = element.dataset.stepId || null;
            target.slot = element.dataset.slot || null;
            target.status = element.dataset.status || null;
            return target;
        }

        if (element.dataset.astEnergyBar) {
            target.type = 'energy-bar';
            return target;
        }

        return null;
    }

    function captureFocusTarget() {
        if (!host) return null;
        const active = document.activeElement;
        if (!active || !host.contains(active)) return null;
        return describeFocusTarget(active);
    }

    function resolveFocusTarget(target) {
        if (!target || !host) return null;

        if (target.type === 'step-editor' && target.stepId) {
            return host.querySelector('.ast-step-editor-input[data-step-id="' + target.stepId + '"]');
        }

        if (target.type === 'named' && target.name) {
            return host.querySelector('[name="' + target.name + '"]');
        }

        if (target.type === 'action' && target.action) {
            const selectors = ['[data-ast-action="' + target.action + '"]'];
            if (target.taskId) selectors.push('[data-task-id="' + target.taskId + '"]');
            if (target.stepId) selectors.push('[data-step-id="' + target.stepId + '"]');
            if (target.slot) selectors.push('[data-slot="' + target.slot + '"]');
            if (target.status) selectors.push('[data-status="' + target.status + '"]');
            return host.querySelector(selectors.join(''));
        }

        if (target.type === 'energy-bar') {
            return host.querySelector('[data-ast-energy-bar]');
        }

        return null;
    }

    function restoreFocusTarget(target) {
        if (!target) return;

        window.requestAnimationFrame(function() {
            const element = resolveFocusTarget(target);
            if (!element || typeof element.focus !== 'function') return;

            try {
                element.focus({ preventScroll: true });
            } catch (err) {
                element.focus();
            }

            if (target.selectionStart !== null &&
                target.selectionEnd !== null &&
                typeof element.setSelectionRange === 'function') {
                try {
                    element.setSelectionRange(target.selectionStart, target.selectionEnd);
                } catch (err) {
                    // Some inputs like date fields expose setSelectionRange but throw when used.
                }
            }
        });
    }

    function updateBadge() {
        if (window.MissionControl && typeof window.MissionControl.setBadgeCount === 'function') {
            window.MissionControl.setBadgeCount('ast', getDueCount());
        }
    }

    function render() {
        if (!host) return;
        const focusTarget = pendingFocusTarget || captureFocusTarget();
        pendingFocusTarget = null;

        const shell = el('div', 'ast-shell');

        if (state.view === 'briefing') {
            // Briefing view: greeting + 1+2 cards + energy
            renderBriefing(shell);
            renderEnergyCard(shell);
        } else {
            // Tasks view: back button + full task list + everything else
            var backBtn = el('button', 'ast-briefing-back', '← Back to Briefing');
            backBtn.type = 'button';
            backBtn.dataset.astAction = 'switch-to-briefing';
            shell.appendChild(backBtn);

            renderEnergyCard(shell);
            renderCapture(shell);
            renderTopThree(shell);
            renderTasks(shell);
            renderRoutine(shell);
        }

        const children = [shell];
        const picker = renderPicker();
        const modal = renderModal();
        if (picker) children.push(picker);
        if (modal) children.push(modal);

        host.replaceChildren(...children);
        updateBadge();
        restoreFocusTarget(focusTarget);
    }

    function ensureHost() {
        if (host) return host;
        const container = document.getElementById('tab-assistant');
        if (!container) return null;
        host = el('div', 'ast-root');
        container.appendChild(host);
        return host;
    }

    function refresh() {
        ensureHost();
        render();
    }

    function handleAction(action, button, event) {
        switch (action) {
            case 'switch-to-tasks':
                state.view = 'tasks';
                render();
                return true;
            case 'switch-to-briefing':
                state.view = 'briefing';
                render();
                return true;
            case 'briefing-open-task':
                state.view = 'tasks';
                state.expandedTaskId = button.dataset.taskId || null;
                render();
                // scroll to the expanded task after render
                if (state.expandedTaskId && host) {
                    window.requestAnimationFrame(function() {
                        var row = host.querySelector('.ast-task-row.ast-expanded');
                        if (row) row.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    });
                }
                return true;
            case 'toggle-task':
                state.expandedTaskId = state.expandedTaskId === button.dataset.taskId ? null : button.dataset.taskId;
                render();
                return true;
            case 'set-filter':
                setFilter(button.dataset.filter);
                return true;
            case 'open-add-task':
                openTaskModal(null);
                return true;
            case 'analyze-capture':
                analyzeCapture();
                return true;
            case 'clear-capture':
                clearCapture();
                return true;
            case 'open-edit-task':
                openTaskModal(button.dataset.taskId);
                return true;
            case 'add-plan-task':
                addTaskFromSuggestion(button.dataset.suggestionId);
                return true;
            case 'expand-suggestion':
                expandSuggestion(button.dataset.suggestionId);
                return true;
            case 'delete-task':
                if (window.confirm('Delete this task?')) deleteTask(button.dataset.taskId);
                return true;
            case 'toggle-focus':
                addTaskToFocus(button.dataset.taskId);
                return true;
            case 'remove-focus':
                removeTaskFromFocus(button.dataset.taskId);
                return true;
            case 'complete-focus-task':
                setTaskStatus(button.dataset.taskId, 'done', event);
                return true;
            case 'set-status':
                setTaskStatus(button.dataset.taskId, button.dataset.status, event);
                return true;
            case 'open-picker':
                openPicker(parseInt(button.dataset.slot, 10));
                return true;
            case 'close-picker':
                closePicker();
                return true;
            case 'pick-focus-task':
                state.pickerSlot = null;
                addTaskToFocus(button.dataset.taskId, parseInt(button.dataset.slot, 10));
                return true;
            case 'close-modal':
                closeTaskModal();
                return true;
            case 'toggle-no-due-date':
                captureModalDraft();
                state.modal.noDueDate = !!button.checked;
                if (state.modal.noDueDate) state.modal.dueDate = '';
                pendingFocusTarget = state.modal.noDueDate
                    ? { type: 'named', name: 'ast-no-due-date' }
                    : { type: 'named', name: 'ast-due-date' };
                render();
                return true;
            case 'toggle-steps':
                captureModalDraft();
                state.modal.stepsEnabled = !!button.checked;
                if (state.modal.stepsEnabled) {
                    if (countFilledSteps(state.modal.steps) === 0) {
                        state.modal.promptsDismissed = false;
                    }
                    const step = ensureModalHasEmptyStep();
                    if (step) {
                        pendingFocusTarget = { type: 'step-editor', stepId: step.id };
                    }
                }
                render();
                return true;
            case 'dismiss-thinking-prompts':
                setPromptsDismissed(true);
                return true;
            case 'show-thinking-prompts':
                setPromptsDismissed(false);
                return true;
            case 'add-modal-step':
            {
                captureModalDraft();
                state.modal.stepsEnabled = true;
                const stepId = makeStepId();
                state.modal.steps.push({
                    id: stepId,
                    text: '',
                    done: false,
                    order: state.modal.steps.length + 1
                });
                pendingFocusTarget = { type: 'step-editor', stepId: stepId };
                render();
                return true;
            }
            case 'delete-modal-step':
                captureModalDraft();
                state.modal.steps = state.modal.steps.filter(step => step.id !== button.dataset.stepId);
                state.modal.steps = renumberSteps(state.modal.steps);
                render();
                return true;
            case 'move-modal-step-up':
                moveModalStep(button.dataset.stepId, -1);
                return true;
            case 'move-modal-step-down':
                moveModalStep(button.dataset.stepId, 1);
                return true;
            case 'save-modal-task':
                saveModalTask();
                return true;
            case 'back-to-top':
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return true;
            default:
                return false;
        }
    }

    function onClick(event) {
        const overlay = event.target.closest('[data-ast-overlay]');
        if (overlay && event.target === overlay) {
            if (overlay.dataset.astOverlay === 'modal') {
                closeTaskModal();
                return;
            }

            if (overlay.dataset.astOverlay === 'picker') {
                closePicker();
                return;
            }
        }

        const energyBar = event.target.closest('[data-ast-energy-bar]');
        if (energyBar) {
            const rect = energyBar.getBoundingClientRect();
            const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
            const level = Math.ceil(ratio * ENERGY_MAX);
            const safeLevel = Math.min(ENERGY_MAX, Math.max(1, level));
            setEnergyLevel(safeLevel);
            return;
        }

        const actionEl = event.target.closest('[data-ast-action]');
        if (!actionEl) return;
        handleAction(actionEl.dataset.astAction, actionEl, event);
    }

    function onChange(event) {
        if (event.target && event.target.name === 'ast-capture-body') {
            state.capture.includeBodyContext = !!event.target.checked;
            saveCapture();
            render();
            return;
        }

        if (event.target && event.target.name === 'ast-capture-money') {
            state.capture.includeMoneyContext = !!event.target.checked;
            saveCapture();
            render();
            return;
        }

        const actionEl = event.target.closest('[data-ast-action]');
        if (actionEl && actionEl.dataset.astAction === 'toggle-step') {
            toggleTaskStep(actionEl.dataset.taskId, actionEl.dataset.stepId, event.target.checked);
        }
    }

    function onInput(event) {
        if (event.target && event.target.name === 'ast-capture-draft') {
            state.capture.draft = event.target.value;
            state.capture.error = '';
            saveCapture();
        }
    }

    function onKeyDown(event) {
        if (event.key === 'Escape') {
            if (state.modal) {
                event.preventDefault();
                closeTaskModal();
                return;
            }

            if (state.pickerSlot) {
                event.preventDefault();
                closePicker();
            }
            return;
        }

        if (event.key === 'Enter' && state.modal && !event.defaultPrevented) {
            const target = event.target;
            if (!target || !target.closest('.ast-modal')) return;
            if (target.tagName === 'TEXTAREA') return;
            if (target.type === 'checkbox' || target.type === 'radio') return;
            
            // Don't submit when inside step inputs unless it's the last one
            if (target.classList.contains('ast-step-editor-input')) {
                const stepInputs = document.querySelectorAll('.ast-step-editor-input');
                if (stepInputs.length > 0 && target !== stepInputs[stepInputs.length - 1]) {
                    return;
                }
            }

            event.preventDefault();
            saveModalTask();
        }
    }

    function attachEvents() {
        if (!host || host.dataset.astBound === 'true') return;
        host.dataset.astBound = 'true';
        host.addEventListener('click', onClick);
        host.addEventListener('change', onChange);
        host.addEventListener('input', onInput);
        host.addEventListener('keydown', onKeyDown);
    }

    function exposeApi() {
        window.Assistant = {
            getDueCount: function() {
                return getDueCount();
            },
            getTopThree: function() {
                return clone(getTopThree());
            },
            getEnergyLevel: function() {
                const label = getEnergyLabel(state.energy.level);
                return {
                    level: state.energy.level,
                    max: state.energy.max,
                    label: label.text
                };
            },
            getPlannerState: function() {
                return clone({
                    draft: state.capture ? state.capture.draft : '',
                    includeBodyContext: state.capture ? state.capture.includeBodyContext : false,
                    includeMoneyContext: state.capture ? state.capture.includeMoneyContext : false,
                    lastAnalyzedAt: state.capture ? state.capture.lastAnalyzedAt : null,
                    result: state.capture ? state.capture.result : null
                });
            },
            refresh: function() {
                refresh();
            }
        };
    }

    function init() {
        loadState();
        exposeApi();
        ensureHost();
        attachEvents();
        render();
        updateBadge();

        if (!badgeIntervalId) {
            badgeIntervalId = window.setInterval(updateBadge, 60000);
        }
    }

    try {
        init();
    } catch (err) {
        console.error('Assistant pod failed to initialize:', err);
    }
})();
