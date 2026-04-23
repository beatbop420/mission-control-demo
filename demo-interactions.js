(function () {
    'use strict';

    var highlightEl = null;
    var tourIndex = -1;
    var demoScenarioIndex = 0;

    var DEMO_AST_SCENARIOS = [
        "okay so i still haven't called the dentist and it has been literally three months. my tooth hurts on the left side and i keep thinking i'll call tomorrow. i also think i have a doctor appointment i need to reschedule but i can't find the voicemail. everything health-related i just keep ignoring and i feel bad about it",
        "the laundry pile has become its own ecosystem at this point. there are dishes in the sink i've been looking at for four days. the kitchen counter has like six different piles on it and i genuinely do not know what is in them. i walk past it all and feel like a failure every single time but i still don't do anything",
        "i need to pay the phone bill and i'm pretty sure the internet is overdue too. i've been getting emails from my bank and i am too scared to open them. i know i need to check my account but what if it's worse than i think. the credit card probably has late fees by now and i just can't make myself look",
        "i have at least seven emails i've been avoiding for almost two weeks. one of them is from my boss and i feel sick every time i see it in my inbox. i also have to write a report by friday and i keep opening the document and staring at it and closing it. i feel like everyone is just waiting on me and i'm frozen",
        "everything feels behind and urgent and impossible at the same time. i sat down to do things an hour ago and now it's an hour later and i've done nothing. i can't even make a list because i don't know where to start and the list itself feels like too much. my brain is just static and i feel paralyzed"
    ];

    var tourSteps = [
        {
            tab: 'rightnow',
            target: '#tab-rightnow .rightnow-money',
            title: 'Automated Budgeting',
            text: 'Calculates "Safe to Spend" by subtracting all upcoming bills from your bank balance.',
            extra: 'Logic: Most banks show "Pending" but not "Expected." We subtract every scheduled bill for the next 30 days so the user knows exactly what is actually theirs.'
        },
        {
            tab: 'rightnow',
            target: '#rn-body-card',
            title: 'Energy-Based Triage',
            text: 'The dashboard changes its suggestions based on your current physical capacity.',
            extra: 'Logic: High-effort tasks are hidden when energy is low (1-3). This prevents "Wall of Awful" paralysis and keeps the user focused on tiny, doable wins.'
        },
        {
            tab: 'money',
            finance: 'brain',
            target: '#mc-greeting',
            title: 'The Morning Briefing',
            text: 'Instead of a wall of numbers, you get a plain-language summary of where you stand — written like a supportive note, not a bank statement.',
            extra: 'Logic: Raw numbers trigger shame and avoidance. Miss Claudette reframes the same data as a calm, actionable briefing so the user can actually open the app on a hard day.'
        },
        {
            tab: 'money',
            finance: 'stove',
            target: '#fin-panel-stove',
            title: 'The Anxiety Reset',
            text: 'A "Check the Stove" view for when financial anxiety spikes.',
            extra: 'Logic: When in a spiral, the user only needs 5 numbers to prove they are safe. This screen is designed to be read in under 10 seconds to stop a panic attack.'
        },
        {
            tab: 'money',
            finance: 'timeline',
            target: '#fin-panel-timeline',
            title: '4-Week Visibility',
            text: 'A rolling calendar view of every dollar leaving the house.',
            extra: 'Logic: ADHD often includes "Time Blindness." This grid makes the next month of financial obligations a physical object you can see and touch.'
        },
        {
            tab: 'money',
            finance: 'buckets',
            target: '#fin-panel-buckets',
            title: 'Paycheck Splitting',
            text: 'Income is automatically divided into 4 buckets the moment it lands: Fixed bills, Safety net, Life spending, and Dopamine.',
            extra: 'Logic: The "Dopamine" bucket is intentional — ADHD brains run on dopamine-driven reward. Budgeting for fun isn\'t a luxury, it\'s maintenance. The priority sequence means decisions are already made before payday hits.'
        },
        {
            tab: 'body',
            target: '.pressure-bar',
            title: 'Atmospheric Flare Detection',
            text: 'Pulls live weather data and warns you when a barometric pressure drop is coming — a documented trigger for chronic pain, migraines, and dysautonomia flares.',
            extra: 'Logic: When your body crashes for "no reason," it\'s demoralizing. Seeing the pressure data gives the user an external explanation — not a character flaw, just physics — which cuts the emotional spiral significantly.'
        },
        {
            tab: 'life',
            target: '.brain-dump-box',
            title: 'Cognitive Offloading',
            text: 'A dedicated space for "Externalizing" thoughts before they become overwhelming.',
            extra: 'Logic: Working memory is limited. Getting it out of the head and onto the screen is the first step in regaining executive control.'
        },
        {
            tab: 'assistant',
            target: '#tab-assistant',
            title: 'AI Planning Layer',
            text: 'In the real app, you type a messy brain dump and a live AI model sorts it into a priority-ranked action plan. Tap the ✨ button to see a realistic example of what the output looks like.',
            extra: 'Demo vs. Real: The live version calls an actual AI model. This demo uses pre-written responses matched to common scenarios — the format and structure are identical to what the real app produces.'
        },
        {
            tab: 'rightnow',
            target: '.header h1',
            title: 'Mission Complete',
            text: 'Mission Control is about reclaiming agency through data.',
            extra: 'Logic: The goal isn\'t productivity—it\'s peace. When the system handles the tracking, the human can handle the living.'
        }
    ];

    function onReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () {
                window.setTimeout(fn, 700);
            });
            return;
        }
        window.setTimeout(fn, 700);
    }

    function q(selector, root) {
        return (root || document).querySelector(selector);
    }

    function qa(selector, root) {
        return Array.from((root || document).querySelectorAll(selector));
    }

    function todayStr(offsetDays) {
        var date = new Date();
        date.setDate(date.getDate() + (offsetDays || 0));
        return date.toISOString().slice(0, 10);
    }

    function demoId(prefix) {
        return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    function money(value) {
        var amount = Number(value) || 0;
        return '$' + amount.toFixed(2);
    }

    function saveKey(key, value) {
        if (typeof saveData === 'function') {
            saveData(key, value);
        } else {
            localStorage.setItem('mc_' + key, JSON.stringify(value));
            localStorage.setItem('mc_ts_' + key, new Date().toISOString());
        }
    }

    function notify(message) {
        if (typeof showToast === 'function') {
            showToast(message);
            return;
        }
        window.alert(message);
    }

    function sparkleFrom(el, count) {
        if (!el || typeof spawnSparkles !== 'function') return;
        var rect = el.getBoundingClientRect();
        spawnSparkles(rect.left + rect.width / 2, rect.top + rect.height / 2, count || 18);
    }

    function pulse(selectorOrEl) {
        var el = typeof selectorOrEl === 'string' ? q(selectorOrEl) : selectorOrEl;
        if (!el) return;
        el.classList.remove('demo-pulse');
        void el.offsetWidth;
        el.classList.add('demo-pulse');
        window.setTimeout(function () {
            el.classList.remove('demo-pulse');
        }, 1000);
    }

    function clearHighlight() {
        if (highlightEl) {
            highlightEl.classList.remove('demo-highlight');
            highlightEl = null;
        }
    }

    function highlight(selector) {
        clearHighlight();
        var el = q(selector);
        if (!el) return null;
        highlightEl = el;
        el.classList.add('demo-highlight');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return el;
    }

    function mainTabButton(tab) {
        return qa('.main-tab').find(function (btn) {
            return (btn.getAttribute('onclick') || '').indexOf("'" + tab + "'") !== -1;
        });
    }

    function financeTabButton(tab) {
        return qa('.finance-tab').find(function (btn) {
            return (btn.getAttribute('onclick') || '').indexOf("'" + tab + "'") !== -1;
        });
    }

    function switchMainTab(tab) {
        var btn = mainTabButton(tab);
        if (typeof showMainTab === 'function' && btn) {
            showMainTab(tab, btn);
        } else if (btn) {
            btn.click();
        }
    }

    function switchFinanceTab(tab) {
        var btn = financeTabButton(tab);
        if (typeof showFinanceTab === 'function' && btn) {
            showFinanceTab(tab, btn);
        } else if (btn) {
            btn.click();
        }
    }

    function openAssistantTasksView() {
        switchMainTab('assistant');
        window.setTimeout(function () {
            var viewAll = q('[data-ast-action="switch-to-tasks"]');
            if (viewAll) viewAll.click();
        }, 80);
    }

    function avoidOverlap(card, target) {
        // Don't reposition if user has manually dragged the card
        if (card.style.left && card.style.left !== 'auto') return;
        var tRect = target.getBoundingClientRect();
        var cRect = card.getBoundingClientRect();
        var overlaps = tRect.right > cRect.left && tRect.left < cRect.right &&
                       tRect.bottom > cRect.top && tRect.top < cRect.bottom;
        var inBottomHalf = (tRect.top + tRect.height / 2) > (window.innerHeight / 2);
        if (overlaps || inBottomHalf) {
            card.style.top = '80px';
            card.style.bottom = 'auto';
        } else {
            card.style.top = 'auto';
            card.style.bottom = '24px';
        }
    }

    function showTourStep(index) {
        var card = q('[data-demo-tour-card]');
        var backdrop = q('.demo-tour-backdrop');
        if (!card) return;

        // Move card to body if it's currently inside a container (like the console)
        if (card.parentNode !== document.body) {
            document.body.appendChild(card);
            attachDrag(card); // make it draggable once it's on body
        }

        if (index < 0 || index >= tourSteps.length) {
            tourIndex = -1;
            card.classList.remove('active');
            if (backdrop) backdrop.classList.remove('active');
            clearHighlight();
            return;
        }

        // Collapse the demo console so it doesn't block the screen
        var consoleWrap = q('[data-demo-console]');
        if (consoleWrap) {
            consoleWrap.classList.add('collapsed');
            var toggleBtn = q('[data-demo-action="toggle-console"]', consoleWrap);
            if (toggleBtn) toggleBtn.textContent = '+';
        }

        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.className = 'demo-tour-backdrop';
            document.body.appendChild(backdrop);
        }
        backdrop.classList.add('active');

        tourIndex = index;
        var step = tourSteps[index];
        card.classList.add('active');
        q('[data-demo-tour-step]', card).textContent = 'Step ' + (index + 1) + ' of ' + tourSteps.length;
        q('[data-demo-tour-title]', card).textContent = step.title;
        q('[data-demo-tour-text]', card).textContent = step.text;
        
        // Reset extra info state for each step
        var extraEl = q('[data-demo-tour-extra]', card);
        if (extraEl) {
            extraEl.textContent = step.extra || '';
            extraEl.style.display = 'none';
        }
        var extraBtn = q('[data-demo-tour-extra-btn]', card);
        if (extraBtn) {
            extraBtn.textContent = 'Explain Logic';
        }

        q('[data-demo-tour-next]', card).textContent = index === tourSteps.length - 1 ? 'Finish' : 'Next';

        if (step.assistantTasks) {
            openAssistantTasksView();
        } else {
            switchMainTab(step.tab);
            if (step.finance) {
                window.setTimeout(function () {
                    switchFinanceTab(step.finance);
                }, 60);
            }
        }

        window.setTimeout(function () {
            var target = highlight(step.target);
            if (target) {
                avoidOverlap(card, target);
                // Re-check after smooth scroll finishes
                window.setTimeout(function () { avoidOverlap(card, target); }, 500);
            }
        }, 150);
    }

    function ensureFinanceState() {
        if (typeof finAccounts === 'undefined') return false;
        finAccounts = Array.isArray(finAccounts) ? finAccounts : [];
        finBills = Array.isArray(finBills) ? finBills : [];
        finIncome = Array.isArray(finIncome) ? finIncome : [];
        paycheckLog = Array.isArray(paycheckLog) ? paycheckLog : [];

        buckets = buckets && typeof buckets === 'object' ? buckets : {};
        buckets.fixed = buckets.fixed || {};
        buckets.safety = buckets.safety || {};
        buckets.life = buckets.life || {};
        buckets.dopamine = buckets.dopamine || {};
        buckets.fixed.balance = Number(buckets.fixed.balance) || 0;
        buckets.fixed.needed = Number(buckets.fixed.needed) || 0;
        buckets.safety.balance = Number(buckets.safety.balance) || 0;
        buckets.safety.goal = Number(buckets.safety.goal) || 1000;
        buckets.life.balance = Number(buckets.life.balance) || 0;
        buckets.life.budgetPerPaycheck = Number(buckets.life.budgetPerPaycheck) || 400;
        buckets.dopamine.balance = Number(buckets.dopamine.balance) || 0;
        buckets.dopamine.budgetPerPaycheck = Number(buckets.dopamine.budgetPerPaycheck) || 150;

        bucketSettings = bucketSettings && typeof bucketSettings === 'object' ? bucketSettings : {};
        bucketSettings.paycheckAmount = Number(bucketSettings.paycheckAmount) || 1800;
        bucketSettings.safetyAmount = Number(bucketSettings.safetyAmount) || 50;
        bucketSettings.lifeBudget = Number(bucketSettings.lifeBudget) || 400;
        bucketSettings.dopamineBudget = Number(bucketSettings.dopamineBudget) || 150;
        bucketSettings.cashWithdraw = Number(bucketSettings.cashWithdraw) || 40;
        bucketSettings.payFrequency = Number(bucketSettings.payFrequency) || 14;
        bucketSettings.nextPayday = bucketSettings.nextPayday || todayStr(7);

        if (!getAccount('Checking')) {
            finAccounts.push({
                id: demoId('acct'),
                name: 'Demo Checking',
                type: 'Checking',
                balance: 0,
                availableBalance: 0,
                postedBalance: 0,
                pendingTotal: 0,
                pendingCount: 0,
                balance_date: new Date().toISOString()
            });
        }

        if (!getAccount('Savings')) {
            finAccounts.push({
                id: demoId('acct'),
                name: 'Demo Safety Savings',
                type: 'Savings',
                balance: buckets.safety.balance,
                availableBalance: buckets.safety.balance,
                postedBalance: buckets.safety.balance,
                pendingTotal: 0,
                pendingCount: 0,
                balance_date: new Date().toISOString()
            });
        }

        return true;
    }

    function getAccount(type) {
        return finAccounts.find(function (account) {
            return account.type === type ||
                (account.name && account.name.toLowerCase().indexOf(type.toLowerCase()) !== -1);
        });
    }

    function setAccountAmount(account, amount) {
        if (!account) return;
        account.balance = amount;
        account.availableBalance = amount;
        account.postedBalance = amount;
        account.balance_date = new Date().toISOString();
    }

    function syncAccountsToBuckets() {
        var checking = getAccount('Checking');
        var savings = getAccount('Savings');
        var checkingTotal = buckets.fixed.balance + buckets.life.balance + buckets.dopamine.balance;
        setAccountAmount(checking, checkingTotal);
        setAccountAmount(savings, buckets.safety.balance);
        saveKey('fin_accounts', finAccounts);
        saveKey('buckets', buckets);
        saveKey('bucket_settings', bucketSettings);
        saveKey('paycheck_log', paycheckLog);
        saveKey('safe_to_spend', buckets.life.balance + buckets.dopamine.balance);
    }

    function rerenderFinance() {
        if (typeof renderFinance === 'function') renderFinance();
        if (typeof renderRightNow === 'function') renderRightNow();
    }

    function simulatePayday() {
        if (!ensureFinanceState()) return;

        var amount = bucketSettings.paycheckAmount || 1800;
        var split = typeof calculatePaycheckSplit === 'function'
            ? calculatePaycheckSplit(amount)
            : {
                fixed: 0,
                safety: Math.min(amount, bucketSettings.safetyAmount),
                life: Math.min(Math.max(0, amount - bucketSettings.safetyAmount), bucketSettings.lifeBudget),
                dopamine: Math.max(0, amount - bucketSettings.safetyAmount - bucketSettings.lifeBudget - bucketSettings.cashWithdraw),
                cash: bucketSettings.cashWithdraw,
                shortfall: 0
            };

        buckets.fixed.balance += split.fixed;
        buckets.safety.balance += split.safety;
        buckets.life.balance += split.life;
        buckets.dopamine.balance += split.dopamine;
        paycheckLog.push({
            id: demoId('paycheck'),
            date: todayStr(0),
            amount: amount,
            split: split,
            note: 'Demo scenario'
        });

        var nextPay = new Date(bucketSettings.nextPayday + 'T00:00:00');
        if (!Number.isNaN(nextPay.getTime())) {
            nextPay.setDate(nextPay.getDate() + bucketSettings.payFrequency);
            bucketSettings.nextPayday = nextPay.toISOString().slice(0, 10);
        }

        syncAccountsToBuckets();
        rerenderFinance();
        switchMainTab('money');
        window.setTimeout(function () {
            switchFinanceTab('buckets');
            pulse('#fin-panel-buckets');
            sparkleFrom(q('#fin-panel-buckets'), 28);
        }, 100);
        notify('Demo payday added: ' + money(amount));
    }

    function simulateChaos() {
        if (!ensureFinanceState()) return;

        var existing = finBills.some(function (bill) {
            return bill.id === 'demo-chaos-car-repair';
        });
        if (!existing) {
            finBills.push({
                id: 'demo-chaos-car-repair',
                name: 'Surprise car repair',
                amount: 400,
                dueDate: todayStr(0),
                recurring: 'one-time',
                status: 'unpaid',
                paid: false,
                category: 'Emergency'
            });
        }

        saveKey('fin_bills', finBills);
        applyBodyMode('low');
        rerenderFinance();
        switchMainTab('money');
        window.setTimeout(function () {
            switchFinanceTab('bills');
            window.setTimeout(function () {
                pulse('#fin-panel-bills');
            }, 80);
        }, 100);
        notify('Chaos mode: surprise bill added — see your Bills tab');
    }

    function applyBodyMode(mode) {
        var rough = mode === 'low';
        var updates = [
            ['#bf-overall .alert-text', rough ? 'RED day. Bare minimum mode is the plan.' : 'GREEN day. Normal pacing should work.'],
            ['#bf-pressure .alert-text', rough ? 'Pressure shift may make symptoms louder.' : 'Pressure looks stable.'],
            ['#bf-pots .alert-text', rough ? 'POTS risk elevated. Hydrate before errands.' : 'POTS risk is low.']
        ];

        updates.forEach(function (pair) {
            var el = q(pair[0]);
            if (el) el.textContent = pair[1];
        });

        if (typeof renderRightNow === 'function') renderRightNow();
    }

    function demoAssistantAi() {
        openAssistantTasksView();
        window.setTimeout(function () {
            var textarea = q('.ast-capture-input');
            if (!textarea) return;
            textarea.value = 'I need to pay a bill, book a dentist appointment, and clean the kitchen, but I cannot tell what to do first.';
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            pulse(textarea);

            var analyze = q('[data-ast-action="analyze-capture"]');
            if (analyze) {
                window.setTimeout(function () {
                    analyze.click();
                    notify('Assistant demo brain is sorting the dump locally');
                }, 350);
            }
        }, 260);
    }

    function winTheDay() {
        var greeting = q('#mc-greeting-text');
        if (greeting) {
            greeting.textContent = 'Win logged. Mission Control sees the effort, not just the output.';
        }
        sparkleFrom(q('.header h1') || document.body, 42);
        notify('Dopamine hit triggered');
    }

    function seedSamples() {
        if (typeof seedSampleData === 'function') {
            seedSampleData();
        }
    }

    function attachDrag(el, handle) {
        handle = handle || el;
        var dragging = false;
        var startX, startY, startLeft, startTop;

        function toAbsolute() {
            var rect = el.getBoundingClientRect();
            el.style.right = 'auto';
            el.style.bottom = 'auto';
            el.style.transform = 'none';
            el.style.left = rect.left + 'px';
            el.style.top = rect.top + 'px';
        }

        function onStart(clientX, clientY) {
            if (!el.style.left || el.style.left === 'auto') toAbsolute();
            dragging = true;
            startX = clientX;
            startY = clientY;
            startLeft = parseFloat(el.style.left) || 0;
            startTop = parseFloat(el.style.top) || 0;
            document.body.style.userSelect = 'none';
            handle.style.cursor = 'grabbing';
        }

        function onMove(clientX, clientY) {
            if (!dragging) return;
            var newLeft = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, startLeft + (clientX - startX)));
            var newTop = Math.max(0, Math.min(window.innerHeight - 50, startTop + (clientY - startY)));
            el.style.left = newLeft + 'px';
            el.style.top = newTop + 'px';
        }

        function onEnd() {
            dragging = false;
            document.body.style.userSelect = '';
            handle.style.cursor = 'grab';
        }

        handle.style.cursor = 'grab';

        handle.addEventListener('mousedown', function (e) {
            if (e.target.closest('button, input, textarea, a, select')) return;
            e.preventDefault();
            onStart(e.clientX, e.clientY);
        });
        document.addEventListener('mousemove', function (e) { onMove(e.clientX, e.clientY); });
        document.addEventListener('mouseup', onEnd);
        handle.addEventListener('touchstart', function (e) {
            if (e.target.closest('button, input, textarea, a, select')) return;
            var t = e.touches[0];
            onStart(t.clientX, t.clientY);
        }, { passive: true });
        document.addEventListener('touchmove', function (e) {
            if (!dragging) return;
            var t = e.touches[0];
            onMove(t.clientX, t.clientY);
        }, { passive: false });
        document.addEventListener('touchend', onEnd);
    }

    function makeDraggable(wrap) {
        var header = q('.demo-console-header', wrap);
        if (header) attachDrag(wrap, header);
    }

    function mountConsole() {
        if (q('[data-demo-console]')) return;

        var wrap = document.createElement('aside');
        wrap.className = 'demo-console collapsed';
        wrap.dataset.demoConsole = 'true';
        wrap.innerHTML =
            '<div class="demo-console-card">' +
                '<div class="demo-console-header">' +
                    '<div>' +
                        '<span class="demo-console-kicker">Interactive demo</span>' +
                        '<span class="demo-console-title">Make Mission Control move</span>' +
                    '</div>' +
                    '<button class="demo-console-toggle" type="button" data-demo-action="toggle-console" aria-label="Expand demo controls">+</button>' +
                '</div>' +
                '<div class="demo-console-body">' +
                    '<p class="demo-console-copy">Starts empty by default. Load sample data or run a scenario to see everything in action.</p>' +
                    '<div class="demo-action-grid">' +
                        actionButton('start-tour', 'Guided tour', 'Walk the viewer through the app') +
                        actionButton('seed-samples', 'Sample data', 'Fill with generic examples') +
                        actionButton('payday', 'I just got paid', 'Fill buckets and update money') +
                        actionButton('chaos', 'Chaos mode', 'Urgent bill plus low energy') +
                        actionButton('assistant-ai', 'Demo AI sort', 'Run the local Assistant brain') +
                        actionButton('win-day', 'Win the day', 'Trigger a reward moment') +
                    '</div>' +
                    '<div class="demo-tour-card" data-demo-tour-card>' +
                        '<div class="demo-tour-step" data-demo-tour-step></div>' +
                        '<h3 class="demo-tour-title" data-demo-tour-title></h3>' +
                        '<p class="demo-tour-text" data-demo-tour-text></p>' +
                        '<p class="demo-tour-extra" data-demo-tour-extra style="display:none; font-size:11px; margin-top:8px; padding-top:8px; border-top:1px dashed rgba(232,184,75,0.3); color:#e8b84b;"></p>' +
                        '<div class="demo-tour-actions">' +
                            '<button class="demo-tour-btn" type="button" data-demo-tour-close>Exit</button>' +
                            '<button class="demo-tour-btn" type="button" data-demo-tour-extra-btn>Explain Logic</button>' +
                            '<button class="demo-tour-btn primary" type="button" data-demo-tour-next>Next</button>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>';
        document.body.appendChild(wrap);

        wrap.addEventListener('click', function (event) {
            var action = event.target.closest('[data-demo-action]');
            if (!action) return;
            handleConsoleAction(action.dataset.demoAction, wrap);
        });

        q('[data-demo-tour-close]', wrap).addEventListener('click', function () {
            showTourStep(-1);
        });

        // Toggle extra info
        q('[data-demo-tour-extra-btn]', wrap).addEventListener('click', function () {
            var card = q('[data-demo-tour-card]');
            var extra = q('[data-demo-tour-extra]', card);
            var isHidden = extra.style.display === 'none';
            extra.style.display = isHidden ? 'block' : 'none';
            this.textContent = isHidden ? 'Hide Logic' : 'Explain Logic';
        });

        q('[data-demo-tour-next]', wrap).addEventListener('click', function () {
            if (tourIndex >= tourSteps.length - 1) {
                showTourStep(-1);
            } else {
                showTourStep(tourIndex + 1);
            }
        });

        makeDraggable(wrap);
    }

    function actionButton(action, label, detail) {
        return '<button class="demo-action" type="button" data-demo-action="' + action + '">' +
            '<strong>' + label + '</strong>' +
            '<span>' + detail + '</span>' +
        '</button>';
    }

    function handleConsoleAction(action, wrap) {
        switch (action) {
            case 'toggle-console':
                wrap.classList.toggle('collapsed');
                q('[data-demo-action="toggle-console"]', wrap).textContent = wrap.classList.contains('collapsed') ? '+' : '-';
                break;
            case 'start-tour':
                showTourStep(0);
                break;
            case 'seed-samples':
                seedSamples();
                break;
            case 'payday':
                simulatePayday();
                break;
            case 'chaos':
                simulateChaos();
                break;
            case 'assistant-ai':
                demoAssistantAi();
                break;
            case 'win-day':
                winTheDay();
                break;
        }
    }

    function enhanceBodyCheck() {
        qa('.body-check span').forEach(function (item) {
            if (!item.textContent.trim() || item.textContent.trim().length < 5) return;
            item.setAttribute('role', 'button');
            item.setAttribute('tabindex', '0');
            item.classList.add('demo-body-check-item');
            item.addEventListener('click', function () {
                toggleBodyCheck(item);
            });
            item.addEventListener('keydown', function (event) {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggleBodyCheck(item);
                }
            });
        });
    }

    function toggleBodyCheck(item) {
        item.classList.toggle('demo-body-checked');
        pulse(item);
        if (qa('.demo-body-check-item').every(function (el) {
            return el.classList.contains('demo-body-checked');
        })) {
            notify('Body check complete');
        }
    }

    var DOG_EXPLAINS = {
        rightnow: {
            title: 'Triage Mode',
            text: 'Filters your tasks based on current energy. If your energy is low, it only shows low-friction wins to prevent executive function burnout.'
        },
        body: {
            title: 'Flare Forecast',
            text: 'Connects barometric pressure shifts to physical symptoms. It warns you when a pressure drop might trigger a pain flare or POTS symptoms.'
        },
        money: {
            title: 'Spendability Math',
            text: 'Subtracts every upcoming bill from your bank balance automatically. The number you see is what is actually safe to spend right now.'
        },
        life: {
            title: 'Daily Life Hub',
            text: 'Brain dumps, habit tracking, family notes, contacts, and documents — all the external memory your brain is too full to hold on its own.'
        },
        assistant: {
            title: 'The AI Planner',
            text: 'Acts as an external pre-frontal cortex. It takes messy notes and sorts them into a priority-ranked action plan with tiny, doable steps.'
        }
    };

    function currentTab() {
        var activeBtn = qa('.main-tab').find(function (btn) {
            return btn.classList.contains('active');
        });
        if (!activeBtn) return 'rightnow';
        var onclick = activeBtn.getAttribute('onclick') || '';
        var match = onclick.match(/'([^']+)'/);
        return match ? match[1] : 'rightnow';
    }

    function enhanceDog() {
        var dog = q('.corner-dog');
        if (!dog) return;
        dog.classList.add('demo-dog-glow');
        dog.setAttribute('role', 'button');
        dog.setAttribute('tabindex', '0');
        dog.title = 'Supervisor Dog: Get help or a tour';
        dog.addEventListener('click', showDogExplain);
        
        // Also enhance Wand and Crown
        var wand = q('.magic-wand');
        if (wand) {
            wand.classList.add('demo-dog-glow');
            wand.title = 'Make it rain! ✨';
            wand.onclick = function () {
                if (typeof bippityBoppityBoo === 'function') bippityBoppityBoo();
            };
        }
        
        var crown = q('.header-crown');
        if (crown) {
            crown.style.cursor = 'pointer';
            crown.classList.add('demo-dog-glow');
            crown.title = 'Mission Control Blueprint: Security & Architecture';
            crown.onclick = showCrownSecurity;
        }
    }

    function showWandMenu() {
        var existing = q('.demo-wand-menu');
        if (existing) { existing.remove(); return; }

        var menu = document.createElement('div');
        menu.className = 'demo-dog-explain demo-wand-menu'; // Reusing base card style
        menu.style.right = '60px'; // Offset from dog
        menu.innerHTML =
            '<button class="demo-dog-explain-close" type="button" aria-label="Close">×</button>' +
            '<strong class="demo-dog-explain-title">Magic Scenarios</strong>' +
            '<p class="demo-dog-explain-text">Cast a spell to see how Mission Control reacts to life changes.</p>' +
            '<div class="demo-action-grid" style="margin-top:12px;">' +
                actionButton('payday', 'Cast: Payday', 'Fill your buckets') +
                actionButton('chaos', 'Cast: Chaos', 'Surprise bill & Low energy') +
                actionButton('win-day', 'Cast: Dopamine', 'Trigger a win') +
                actionButton('seed-samples', 'Cast: Samples', 'Populate with data') +
            '</div>';
        document.body.appendChild(menu);
        q('.demo-dog-explain-close', menu).addEventListener('click', function () { menu.remove(); });
        attachDrag(menu);
        if (typeof bippityBoppityBoo === 'function') bippityBoppityBoo();
    }

    function showCrownSecurity() {
        var existing = q('.demo-crown-modal');
        if (existing) { existing.remove(); q('.demo-crown-backdrop') && q('.demo-crown-backdrop').remove(); return; }

        var modal = document.createElement('div');
        modal.className = 'demo-tour-card active demo-crown-modal';
        modal.style.top = '80px';
        modal.style.bottom = 'auto';
        modal.style.maxHeight = 'calc(100vh - 120px)';
        modal.style.display = 'flex';
        modal.style.flexDirection = 'column';
        modal.innerHTML =
            '<div class="demo-tour-step">System Blueprint</div>' +
            '<h3 class="demo-tour-title" style="margin-bottom:10px;">Privacy & Architecture</h3>' +
            '<div style="overflow-y:auto; flex:1; font-size:11px; line-height:1.5; display:grid; gap:10px; color:#d7cbc8; padding-right:4px;">' +
                '<p><strong style="color:#fff;">1. PWA — installs like an app:</strong> No App Store. Works offline. Add to your home screen from the browser and it runs like a native app.</p>' +
                '<p><strong style="color:#fff;">2. Your data stays yours:</strong> This demo uses your browser\'s local storage only — nothing leaves your device. The personal version connects to a private database owned by you, not a third party.</p>' +
                '<p><strong style="color:#fff;">3. Neurodivergent-first design:</strong> Lexend font (built for reading proficiency), low-friction flows, and logic that reduces the executive function cost of just opening the app.</p>' +
            '</div>' +
            '<div class="demo-tour-actions" style="margin-top:12px; flex-shrink:0;">' +
                '<button class="demo-tour-btn primary" style="width:100%;">Got it</button>' +
            '</div>';
        document.body.appendChild(modal);

        var backdrop = document.createElement('div');
        backdrop.className = 'demo-tour-backdrop demo-crown-backdrop active';
        document.body.appendChild(backdrop);

        function close() { modal.remove(); backdrop.remove(); }
        q('.demo-tour-btn', modal).addEventListener('click', close);
        backdrop.addEventListener('click', close);

        attachDrag(modal);
    }

    function showDogExplain() {
        // Toggle off if already open
        var existing = q('.demo-dog-explain');
        if (existing) { existing.remove(); return; }

        var tab = currentTab();
        var info = DOG_EXPLAINS[tab] || DOG_EXPLAINS.rightnow;

        var card = document.createElement('div');
        card.className = 'demo-dog-explain';
        card.innerHTML =
            '<button class="demo-dog-explain-close" type="button" aria-label="Close">×</button>' +
            '<strong class="demo-dog-explain-title">Supervisor Dog</strong>' +
            '<p class="demo-dog-explain-text">"Woof! I\'m the Mission Control supervisor. Need a full tour or just the logic for this tab?"</p>' +
            '<div style="display:grid; gap:6px; margin-top:12px;">' +
                '<button class="demo-tour-btn primary" style="width:100%;" onclick="this.closest(\'.demo-dog-explain\').remove(); showTourStep(0)">Start Guided Tour</button>' +
                '<button class="demo-tour-btn" style="width:100%;" onclick="showDogTabTip()">Explain This Tab</button>' +
            '</div>';
        document.body.appendChild(card);
        attachDrag(card);

        q('.demo-dog-explain-close', card).addEventListener('click', function () {
            card.remove();
        });

        window.setTimeout(function () {
            document.addEventListener('click', function dismissCard(e) {
                if (!card.contains(e.target) && !q('.corner-dog').contains(e.target)) {
                    card.remove();
                    document.removeEventListener('click', dismissCard);
                }
            });
        }, 50);

        // Flip the dog
        var dog = q('.corner-dog');
        if (dog) {
            dog.classList.remove('demo-dog-flip');
            void dog.offsetWidth;
            dog.classList.add('demo-dog-flip');
            window.setTimeout(function () { dog.classList.remove('demo-dog-flip'); }, 800);
        }
    }

    window.showTourStep = showTourStep;

    window.showDogTabTip = function() {
        var tab = currentTab();
        var info = DOG_EXPLAINS[tab] || DOG_EXPLAINS.rightnow;
        var textEl = q('.demo-dog-explain-text');
        if (textEl) {
            textEl.innerHTML = '<strong>' + info.title + ':</strong> ' + info.text;
        }
    };

    function injectAstStar() {
        if (q('.demo-ast-star')) return;
        var textarea = q('.ast-capture-input');
        if (!textarea) return;

        // Replace the misleading "sent to planner service" note
        var note = q('.ast-capture-note');
        if (note) note.textContent = 'Demo mode: tap ✨ to load a sample brain dump. In the real app, your text goes to a live AI model.';

        // Wrap textarea so we can position the star inside it
        var wrapper = document.createElement('div');
        wrapper.style.cssText = 'position:relative; display:block;';
        textarea.parentNode.insertBefore(wrapper, textarea);
        wrapper.appendChild(textarea);

        var btn = document.createElement('button');
        btn.className = 'demo-ast-star';
        btn.type = 'button';
        btn.title = 'Load a sample brain dump — tap again for a different one';
        btn.textContent = '✨';
        btn.setAttribute('aria-label', 'Load sample brain dump');

        btn.addEventListener('click', function () {
            textarea.value = '';
            textarea.value = DEMO_AST_SCENARIOS[demoScenarioIndex % DEMO_AST_SCENARIOS.length];
            demoScenarioIndex++;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            textarea.focus();
            pulse(btn);
            window.setTimeout(function () {
                var submitBtn = q('[data-ast-action="analyze-capture"]');
                if (submitBtn && !submitBtn.disabled) submitBtn.click();
            }, 700);
        });

        wrapper.appendChild(btn);
    }

    function addInfoButtons() {
        addInfoButton('#rn-spendable', 'Bank balance is not the same as spendable. Mission Control subtracts money that is already spoken for so the user sees the safer number.');
        addInfoButton('#fin-spendable-detail', 'This combines the Life and Dopamine buckets after bills and protected money are accounted for.');
        addInfoButton('.ast-energy-card', 'Tap the bar to set your energy level (1–10). The app uses this to suggest tasks that match how you feel right now — a rough day gets easier steps than a good one.');
    }

    function addInfoButton(selector, message) {
        var anchor = q(selector);
        if (!anchor || anchor.parentNode.querySelector('.demo-info-btn')) return;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'demo-info-btn';
        btn.textContent = '?';
        btn.setAttribute('aria-label', 'Explain this number');
        btn.addEventListener('click', function () {
            showInfoBubble(btn, message);
        });
        anchor.insertAdjacentElement('afterend', btn);
    }

    function showInfoBubble(anchor, message) {
        var old = q('.demo-info-bubble');
        if (old) old.remove();
        var bubble = document.createElement('div');
        bubble.className = 'demo-info-bubble';
        bubble.textContent = message;
        document.body.appendChild(bubble);
        var rect = anchor.getBoundingClientRect();
        bubble.style.left = Math.min(window.innerWidth - 292, Math.max(12, rect.left - 230)) + 'px';
        bubble.style.top = Math.max(54, rect.bottom + 8) + 'px';
        window.setTimeout(function () {
            bubble.remove();
        }, 5200);
    }

    function maybeShowInstallHint() {
        var isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        var isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
        if (!isMobile || isStandalone || localStorage.getItem('demo_install_hint_seen')) return;

        var hint = document.createElement('div');
        hint.className = 'demo-install-hint';
        hint.innerHTML =
            '<button type="button" aria-label="Dismiss install hint">×</button>' +
            '<strong>Phone demo tip</strong>' +
            '<span>Use Share, then Add to Home Screen, to preview it like a real app.</span>';
        document.body.appendChild(hint);
        q('button', hint).addEventListener('click', function () {
            localStorage.setItem('demo_install_hint_seen', '1');
            hint.remove();
        });
    }

    function enhanceSecurityBadge() {
        var badge = document.getElementById('security-health-badge');
        if (!badge) return;
        // Force a neutral demo state — remove live-app error styling
        badge.className = '';
        badge.style.background = '#6b5660';
        badge.style.animation = 'none';
        badge.style.cursor = 'pointer';
        badge.title = 'What is this dot?';
        badge.addEventListener('click', function (e) {
            e.stopPropagation();
            var existing = q('.demo-badge-bubble');
            if (existing) { existing.remove(); return; }
            var bubble = document.createElement('div');
            bubble.className = 'demo-info-bubble demo-badge-bubble';
            bubble.style.cssText = 'max-width:260px; line-height:1.55; font-size:12px;';
            bubble.innerHTML =
                '<strong style="display:block; color:#fff; margin-bottom:6px;">Security Health Indicator</strong>' +
                'In the live version, this dot tells you the health of your data sync in real time:<br><br>' +
                '<span style="color:#6bbf7b;">&#9679; Green</span> — data is syncing cleanly with your private database<br>' +
                '<span style="color:#e8b84b;">&#9679; Yellow</span> — data is getting stale, sync is slow<br>' +
                '<span style="color:#d4849a;">&#9679; Red</span> — connection lost or auth error<br><br>' +
                'In this demo there\'s no live sync, so it sits quiet.';
            document.body.appendChild(bubble);
            var rect = badge.getBoundingClientRect();
            bubble.style.left = Math.min(window.innerWidth - 280, Math.max(8, rect.left - 200)) + 'px';
            bubble.style.top = (rect.bottom + 8) + 'px';
            setTimeout(function () {
                document.addEventListener('click', function dismiss() {
                    bubble.remove();
                    document.removeEventListener('click', dismiss);
                });
            }, 50);
        });
    }

    onReady(function () {
        mountConsole();
        enhanceBodyCheck();
        enhanceDog();
        addInfoButtons();
        enhanceSecurityBadge();
        maybeShowInstallHint();

        // Inject star whenever the assistant textarea appears (rendered on first tab visit)
        var astTabBtn = q('#ast-tab-btn');
        if (astTabBtn) {
            astTabBtn.addEventListener('click', function () {
                window.setTimeout(injectAstStar, 350);
            });
        }
        // Polling fallback — catches it if already rendered or observer misses it
        var starPoll = setInterval(function () {
            if (q('.ast-capture-input')) {
                injectAstStar();
                if (q('.demo-ast-star')) clearInterval(starPoll);
            }
        }, 500);
    });
})();
