# Liquid Effects Design

> **Historical/superseded record:** This dated design note uses the former
> “Marine Observation” working title. It is retained for audit; it is not a
> current product specification.

## Goal

Add a more visible layered liquid visual treatment that reinforces the marine theme without changing the observation workflow or adding a runtime dependency.

## Design

- Use CSS-only animated blobs, wave ribbons, droplets and soft workspace glows with teal and sand tones.
- Place the main layered treatment inside the left project rail, with a quiet glow layer behind the workspace and a smaller accent in the results context section.
- Mark all decorative elements `aria-hidden="true"` and disable pointer events.
- Keep content above the decorative layers with explicit stacking order.
- Respect `prefers-reduced-motion` by disabling the liquid animation.
- Keep the effect visible on narrow screens without introducing horizontal overflow.
- Do not use `shaders.com`, WebGL, external JavaScript, or new packages for this small enhancement.

## Acceptance checks

- Existing Report → Confirm → Context behavior is unchanged.
- The frontend test suite includes a regression check for the liquid hooks and animation rule.
- `node --check` passes for frontend modules and `git diff --check` is clean.
