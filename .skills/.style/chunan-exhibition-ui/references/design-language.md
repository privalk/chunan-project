# Design language

## Contents

- Design intent
- Color system
- Typography
- Geometry and surfaces
- Composition
- Decorative vocabulary
- Iconography and motion
- Responsive and accessibility rules
- Quality bar

## Design intent

Express “school history held with care.” The interface should feel warm, calm, literate, and ceremonial without becoming antique or theatrical. It is a contemporary exhibition terminal, not a web dashboard and not a decorative heritage poster.

Use three qualities together:

1. **Archival warmth** — ivory paper, quiet grids, warm gray text, fine borders.
2. **School ceremony** — centered compositions, seals, numbered steps, deliberate whitespace.
3. **Operational clarity** — large touch targets, obvious progress, strong states, concise copy.

## Color system

Use this hierarchy rather than picking unrelated colors.

| Role | Token | Value | Use |
|---|---|---:|---|
| Page paper | `--ca-paper` | `#f6f3ec` | Default full-screen background |
| Soft paper | `--ca-paper-soft` | `#f5f2ea` | Welcome and success pages |
| Raised surface | `--ca-surface` | `#fbfaf6` | Toolbars, cards, dialogs |
| White paper | `--ca-canvas` | `#fffefb` | Signature/drawing surfaces |
| Primary ink | `--ca-ink` | `#30312d` | Headings and important copy |
| Body ink | `--ca-ink-soft` | `#57534b` | Controls and body text |
| Muted copy | `--ca-muted` | `#756f64` | Instructions and descriptions |
| Quiet copy | `--ca-quiet` | `#9b9387` | Metadata and helper text |
| School red | `--ca-red` | `#9f2925` | Primary action/current state |
| Deep red | `--ca-red-deep` | `#701b18` | Shadows or pressed states only |
| Heritage green | `--ca-green` | `#6a8873` | Completed steps and success |
| Border | `--ca-border` | `#ddd6ca` | Cards and controls |
| Light border | `--ca-border-light` | `#e4ded2` | Dividers and headers |

Keep approximately 80% warm neutrals, 10–15% ink, and under 10% accent color. Use red as a signal, not decoration. Use green only for completion, readiness, or success.

## Typography

- Expressive Chinese headings: `"Noto Serif SC", "Songti SC", "STSong", "SimSun", serif`.
- UI controls and metadata: `Inter, "PingFang SC", "Microsoft YaHei", sans-serif`.
- Large hero heading: 44–78 px, weight 500, line-height 1.2–1.35, letter-spacing 0.08–0.12 em.
- Task heading: 30–43 px, weight 500, letter-spacing around 0.1 em.
- Body/instruction copy: 14–17 px with generous line height.
- Control label: 13–17 px. Never use tiny type for an action.
- English eyebrow: uppercase, 8–11 px, weight 600, letter-spacing 0.2–0.42 em.
- Timers and IDs: sans-serif with `font-variant-numeric: tabular-nums`.

Use serif type selectively. Long operational text, metrics, IDs, and status copy stay sans-serif for clarity.

## Geometry and surfaces

- Buttons and compact controls: 8–10 px radius.
- Drawing/canvas panels: 18 px radius.
- Dialogs: 24 px radius.
- Circular steps, seals, status marks, and icon containers: 50% radius.
- Reserve pill geometry for a singular welcome CTA; do not make every button a pill.
- Use 1 px warm-gray borders. Avoid thick container outlines.
- Keep shadows soft and low-chroma:
  - control: `0 8px 18px rgba(42, 36, 28, 0.10)`
  - primary action: `0 9px 22px rgba(112, 27, 24, 0.19)`
  - dialog: `0 30px 90px rgba(0, 0, 0, 0.24)`

## Composition

- Prefer a single centered focal block on welcome, confirmation, and success screens.
- On task screens, use a stable three-part header: return action / centered identity / right-side status or timer.
- Place the task title and progress indicator on one horizontal band.
- Give the main interaction surface most of the viewport; tools form one quiet band below it.
- Use wide outer margins, generally 4–6 vw, and cap reading widths.
- Align repeated controls precisely. Do not scatter badges or floating cards.
- Keep the terminal viewport fixed and avoid body scrolling. Adapt vertical spacing at reduced heights.

## Decorative vocabulary

Use decoration with low contrast and large scale:

- faint 80 px grid on welcome backgrounds;
- 22–24 px paper grid/dot texture on writing and preview surfaces;
- oversized concentric rings at 2–10% red opacity;
- fine horizontal rules around eyebrow labels;
- seal-like circles using school red and serif characters;
- corner brackets to define interactive boundaries;
- a single oversized watermark character at very low opacity.

Decoration must never compete with text or touch controls.

## Iconography and motion

- Use simple outline icons with `fill: none`, 1.8–2 px stroke, round caps, and round joins.
- Prefer familiar symbols: arrow, check, clock, pen, undo, redo, clear, close.
- Pair icons with text except for an unmistakable close action with an accessible label.
- Use motion only to acknowledge state:
  - press: 0.98 scale over about 180 ms;
  - dialog: 200–250 ms fade plus 12 px rise;
  - success rings: one restrained 800 ms bloom;
  - loading: simple spinner.
- Avoid continuous ambient animation behind the main task.

## Responsive and accessibility rules

- Design first for 1920×1080 landscape exhibition screens.
- Maintain a functional minimum around 1024×650 unless the target device requires more.
- Use `clamp()` for hero type, page padding, and major spacing.
- At widths below roughly 1180 px, allow tool groups to wrap into a second row.
- At heights below roughly 830 px, reduce title spacing before shrinking touch targets.
- Set all touch targets to at least 48×48 px; primary actions should be 58–88 px high.
- Provide visible keyboard focus, e.g. a 3 px translucent red outline.
- Use labels for icon-only controls and meaningful text for status changes.
- Do not rely on color alone: combine red/green with icons, labels, or shape changes.
- Respect `touch-action` intentionally: manipulation for buttons, none only on drawing surfaces.

## Quality bar

A correct page should still feel like the same product after changing the feature name. It should look calm at rest, become explicit during action, and return to calm after completion. If removing the school name makes the screen resemble a generic admin template, the design language has not been applied strongly enough.
