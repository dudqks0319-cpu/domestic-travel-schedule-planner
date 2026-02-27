# TripMate v3.0 UI/UX Improvement Notes for Claude Design Code Integration

## 1) Integration Objective

Use externally provided Claude design code as a fast visual prototype source, then convert it into production-grade UI aligned with TripMate standards for accessibility, performance, and maintainability.

## 2) Non-Negotiable Integration Rules

1. Claude-generated code is reference input, not production-ready output.
2. No direct copy-merge into app screens without token and accessibility refactor.
3. All UI values (colors, spacing, radius, typography, motion durations) must map to TripMate design tokens.
4. Visual changes must preserve API/data-state reality (loading, error, empty, offline states).

## 3) Intake Workflow for External Claude Design Code

1. Intake and snapshot
   - Save provided code in an isolated review branch/folder.
   - Capture baseline screenshots for visual regression reference.
2. Structural review
   - Identify component boundaries and reusable primitives.
   - Remove presentation-only duplication before implementation.
3. Tokenization pass
   - Replace hardcoded style values with semantic tokens.
   - Normalize spacing, typography scales, and shadow/elevation levels.
4. Behavior pass
   - Wire real loading/error/empty/offline states.
   - Add keyboard/focus/gesture interactions.
5. Accessibility and responsive pass
   - Contrast, focus visibility, semantics, touch target sizing, screen reader labels.
6. Performance pass
   - Defer heavy assets, reduce layout shift, and trim animation overhead.

## 4) Practical UI/UX Improvement Priorities

1. Design system alignment
   - Create token groups: `color`, `spacing`, `radius`, `typography`, `motion`.
   - Ban one-off magic values unless justified in component docs.
2. Information hierarchy
   - Prioritize "next action" (continue plan, edit day, confirm booking intent).
   - Reduce visual noise in day itinerary cards and map details.
3. Interaction quality
   - Standardize button states: `default`, `hover/pressed`, `loading`, `disabled`, `error`.
   - Keep transitions within 150-300ms and respect `prefers-reduced-motion`.
4. Mobile usability
   - Minimum 44x44 touch targets.
   - Keep primary actions reachable in thumb zone on common phone sizes.
5. Accessibility
   - Text contrast minimum 4.5:1 for normal body text.
   - Every icon-only action includes accessible label text.

## 5) Code Review Checklist (Claude Design Integration)

- [ ] No hardcoded brand colors outside token definitions.
- [ ] No inaccessible contrast pairs in text/button components.
- [ ] All interactive elements have visible focus states.
- [ ] No component ships without loading/empty/error state handling.
- [ ] No layout break at 375px, 768px, and 1024px widths.
- [ ] Animations support reduced-motion users.
- [ ] Snapshot/regression checks added for key screens.

## 6) Acceptance Criteria for UI/UX Integration

1. At least one full vertical slice screen (trip detail + day itinerary editing) is migrated from Claude code to TripMate tokens/components.
2. Accessibility audit for migrated screens reports zero critical issues.
3. Responsive QA passes target breakpoints with no blocking visual defects.
4. Performance on migrated screen shows no major regressions versus pre-integration baseline.
5. UI states are fully wired to live API responses (loading/success/error/offline).

## 7) Handoff Requirements

Before merging any Claude-derived UI:

1. Include before/after screenshots.
2. Include token mapping summary.
3. Include accessibility checklist result.
4. Include known visual compromises and planned follow-ups.
