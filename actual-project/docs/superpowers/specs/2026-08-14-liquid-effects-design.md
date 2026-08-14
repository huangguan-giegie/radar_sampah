# Liquid Effects Design

## Goal

Add a restrained liquid visual treatment that reinforces the marine theme without changing the observation workflow or adding a runtime dependency.

## Design

- Use CSS-only animated blobs with teal and sand tones.
- Place the main layer inside the left project rail and a smaller accent in the results context section.
- Mark all decorative elements `aria-hidden="true"` and disable pointer events.
- Keep content above the decorative layers with explicit stacking order.
- Respect `prefers-reduced-motion` by disabling the liquid animation.
- Do not use `shaders.com`, WebGL, external JavaScript, or new packages for this small enhancement.

## Acceptance checks

- Existing Report → Confirm → Context behavior is unchanged.
- The frontend test suite includes a regression check for the liquid hooks and animation rule.
- `node --check` passes for frontend modules and `git diff --check` is clean.
