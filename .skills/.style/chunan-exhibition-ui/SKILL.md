---
name: chunan-exhibition-ui
description: Apply the visual language and interaction conventions extracted from the Chun'an No. 3 Middle School signature terminal. Use when creating, extending, or reviewing exhibition-hall touchscreen frontends, kiosk pages, welcome screens, guided task flows, confirmation dialogs, success states, or related Vue/React/HTML interfaces that should feel consistent with the existing signature-system.
---

# Chun'an Exhibition UI

Create exhibition interfaces with a warm archival-paper mood, restrained Chinese ceremonial character, and clear large-screen touch interaction.

## Workflow

1. Read [references/design-language.md](references/design-language.md) before making visual decisions.
2. Read [references/page-patterns.md](references/page-patterns.md) when building a welcome page, task flow, modal, success page, or touch control.
3. Inspect the target application's framework, viewport, brand assets, and existing components. Preserve working product behavior.
4. Reuse [assets/style-tokens.css](assets/style-tokens.css) as the token baseline. Copy or translate the tokens into the target framework rather than importing from this skill at runtime.
5. Build the page around one clear task and one dominant action. Keep supporting information quiet and secondary.
6. Verify the result at 1920×1080 and at the project's minimum supported viewport. Ensure the main interaction fits without page scrolling.

## Non-negotiable character

- Use warm ivory and paper-white surfaces, charcoal text, school red accents, and muted heritage green for success.
- Use Song-style serif typography for expressive Chinese headings and sans-serif typography for controls, metadata, timers, and numbers.
- Create ceremony through whitespace, alignment, fine rules, seals, grids, and faint rings—not ornate traditional motifs.
- Keep red scarce and meaningful: primary actions, current steps, short English eyebrows, and critical warnings.
- Make touch targets at least 48×48 px; use 58–88 px for primary terminal actions.
- Write concise, respectful Chinese UI copy. Prefer “请…”, “已…”, and reassuring outcome language.
- Use thin outline icons with round caps and joins. Keep icons subordinate to labels.

## Avoid

- Blue/purple SaaS palettes, neon glow, dark glassmorphism, colorful gradients, or generic dashboard styling.
- Dense card grids, excessive borders, heavy shadows, and red applied to large background areas.
- Decorative dragons, clouds, faux calligraphy, or historical motifs unrelated to the school.
- Small desktop controls, hover-only behavior, hidden primary actions, or long paragraphs on interaction screens.
- Inventing an official school logo. Use verified assets when available; otherwise use a clearly decorative typographic seal.

## Delivery checks

- Confirm visual hierarchy remains legible from roughly 1–2 meters away.
- Confirm default, pressed, focused, disabled, warning, error, loading, and success states where applicable.
- Confirm touch, pen, and mouse behavior for interactive canvases or controls.
- Confirm timers use tabular numerals and become red only near timeout.
- Confirm overlays pause or protect the underlying task state.
- Confirm reduced-height layouts remain usable without vertical scrolling.
