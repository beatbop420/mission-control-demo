# Demo MC: Interactive Features Map

This file summarizes the interactive layers added to the Mission Control Demo to help future developers/agents understand the "Demo Mode" logic.

## 🛠 Core Architecture
- **Isolation:** `demo-isolate.js` monkey-patches `localStorage` to use a `demo_` prefix. This prevents the demo from affecting the real Mission Control app on the same origin.
- **Seeding:** `demo-seed.js` handles the "Blank Slate" initialization and provides the `seedSampleData()` function.
- **AI Simulation:** `assistant.js` has a `requestAssistantPlan` override that simulates an AI brain using keyword recognition (e.g., 'dentist', 'bill', 'laundry').

## 🐕 Supervisor Dog (Top Right)
- **Role:** Tour Guide & Documentation.
- **Interactions:**
  - **Start Guided Tour:** Launches the 10-step walkthrough.
  - **Explain This Tab:** Gives the specific engineering/UX logic for the current screen.

## ✨ Magic Wand (Top Right)
- **Role:** Scenario Generator.
- **Scenarios:**
  - **Cast: Payday:** Simulates a paycheck split into buckets.
  - **Cast: Chaos:** Adds a surprise bill and sets energy to low.
  - **Cast: Dopamine:** Triggers a "Win" animation.
  - **Cast: Samples:** Populates the app with generic data.

## 👑 The Crown (Header)
- **Role:** Technical Blueprint.
- **Info:** Explains PWA technology, Local-First privacy, and Neurodivergent-first design principles.

## 🔦 Guided Tour
- **Logic:** Located in `demo-interactions.js`.
- **UI:** A floating card that "dodges" highlighted elements (jumps between top/bottom).
- **Highlight:** A subtle teal breathing glow (`#4fd1c5`) with a dim backdrop.
- **Steps:** 10 detailed steps including "Explain Logic" buttons for technical deep-dives.
