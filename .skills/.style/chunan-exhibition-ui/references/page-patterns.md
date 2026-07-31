# Page and interaction patterns

## Welcome screen

- Place school identity in the upper-left with a verified logo or restrained seal.
- Center one poetic Chinese headline and a short supporting sentence.
- Use one large red pill CTA, 420 px wide and about 88 px high at 1920×1080.
- Put operational hints directly below the CTA in quiet gray.
- Place location/year or a lightweight local statistic in the footer.
- Use a faint grid and oversized red rings as background structure.

Suggested copy pattern:

- eyebrow: `LEAVE YOUR MARK`
- headline: an emotional promise in 8–16 Chinese characters
- support: one sentence explaining the visitor's contribution
- CTA: a verb phrase such as `开始签名`, `开始留言`, or `开启时光之旅`

## Guided task screen

- Header height: about 86 px.
- Left: return action with text.
- Center: school/product identity.
- Right: timer, connection state, or contextual status.
- Main area: step eyebrow, task heading, one-line instruction, progress indicator, primary workspace.
- Bottom toolbar: reversible actions left, settings center, continuation action right.
- Status line: centered under the toolbar; use a tiny green dot for healthy capture and a labeled red mark for errors.

Show progress with small circles connected by fine rules:

- completed: green fill plus check;
- current: red fill plus number;
- upcoming: paper fill plus warm-gray border.

## Canvas or media workspace

- Use paper white with a faint dot/grid texture.
- Mark the active boundary with four corner brackets instead of a heavy dashed box.
- Center the empty-state instruction and keep it behind the interactive layer.
- Use a quiet red baseline or alignment guide where helpful.
- Keep real input above all decorative layers and remove browser gestures only within the workspace.

## Confirmation dialog

- Dim the page with a neutral-black overlay around 64% and an 8 px blur.
- Center a warm-white card, about 760 px wide, with 24 px radius.
- Lead with a green circular check, red English eyebrow, Chinese title, and one-line consequence statement.
- Present the artifact on a paper-like preview card before showing metadata.
- Use two actions: neutral `返回修改` and wider red `确认并提交`.
- Disable both actions while saving and replace the check with a spinner.
- Pause the underlying countdown or protect the current state while the dialog is open.

## Success screen

- Center a large green check and a short outcome headline.
- State what was preserved or completed, not merely “success.”
- Show the generated identifier in a bordered paper panel when useful.
- Offer one clear return action and disclose automatic return timing.
- Use faint expanding rings to mark completion; stop after one entrance animation.

## States and feedback

| State | Treatment |
|---|---|
| Default | Ivory surface, charcoal label, warm border |
| Pressed | 0.98 scale or slightly deeper red; immediate response |
| Focused | 3 px translucent red outline with offset |
| Disabled | Reduced opacity around 0.36–0.55; keep label readable |
| Ready | Primary action changes from quiet gray to school red |
| Warning | Red timer or labeled warning near the relevant action |
| Error | Red label plus circular exclamation mark; explain recovery |
| Loading | Disable duplicate actions and show concise progressive copy |
| Success | Heritage green circle/check and reassuring completion copy |

## Content voice

- Be respectful and direct: `请在框内签写您的姓名`.
- Reassure persistence: `原始轨迹将安全保存`.
- Make errors actionable: `笔迹内容过少，请完整签写姓名后再继续`.
- Name consequences before confirmation: `确认后将用于互动墙展示与纪念卡打印`.
- Prefer completion language with warmth: `签名已珍藏` instead of `提交成功`.
- Keep bilingual English decorative and short; operational meaning must remain clear in Chinese.

## Implementation reminders

- Use semantic buttons and accessible names.
- Keep action order stable across steps.
- Preserve undoable work until the user explicitly clears, confirms, or times out.
- Do not place management tables, export tools, or administrator controls in visitor-facing terminal flows.
- For Pointer Events, support touch, pen, and mouse; test rapid short strokes and `pointercancel`.
