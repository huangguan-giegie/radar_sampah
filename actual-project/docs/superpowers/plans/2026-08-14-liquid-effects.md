# Liquid Effects Implementation Plan

> **Historical/superseded record:** This dated visual plan uses “Marine
> Observation” as the former working title. It is retained for audit; the
> current product name is Radar Sampah.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a visible, accessible CSS-only liquid visual treatment to the Marine Observation frontend without changing business behavior or introducing a runtime dependency.

**Architecture:** Add decorative, `aria-hidden` layers to the existing project rail, workspace and results context area. CSS elements and keyframes provide teal/sand blobs, wave ribbons, droplets and soft glows. The effect is disabled or reduced under `prefers-reduced-motion` and remains decorative only.

**Tech Stack:** Existing HTML, CSS, and Node test runner; no new package or CDN.

## Global Constraints

- Do not change API routes, payloads, database code, form fields, or workflow state.
- Keep the existing Inter/teal marine visual language and accessible text contrast.
- Do not use external shader/WebGL libraries for this small enhancement.
- Decorative elements must be `aria-hidden="true"` and must not block pointer events.

### Task 1: Add a regression test

**Files:**
- Modify: `actual-project/frontend/tests/workflow.test.mjs`

- [ ] Add a test that reads `index.html` and `styles.css` and asserts that the named liquid layer hooks and animation rule exist.
- [ ] Run the focused test and confirm it fails before production markup/CSS is added.

### Task 2: Add the minimal liquid treatment

**Files:**
- Modify: `actual-project/frontend/index.html`
- Modify: `actual-project/frontend/styles.css`

- [ ] Add `liquid-layer` and `liquid-orb` decorative elements to the rail and results context section.
- [ ] Add scoped pseudo-elements, slow keyframes, pointer-events protection, and reduced-motion behavior.
- [ ] Keep the effect visually quiet behind content and responsive on narrow screens.

### Task 3: Verify the integrated frontend

**Files:**
- No additional files.

- [ ] Run the complete frontend test suite: `node --test frontend/tests/workflow.test.mjs`.
- [ ] Run syntax checks for `workflow.js` and `app.js`.
- [ ] Run `git diff --check` and inspect the diff for unrelated changes.
