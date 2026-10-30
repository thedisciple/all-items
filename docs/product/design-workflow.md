# Evidence-led design workflow

Use this workflow for substantial user-visible changes. Small bug fixes can go straight to implementation when the intended behavior is already clear. This workflow extends the [design manifesto](design-manifesto.md), [UX principles](ux-principles.md), and [interaction patterns](interaction-patterns.md); it does not replace them.

## 1. Name the task

Write one sentence for the person, task, and desired result. Include realistic content volume and one awkward case. Inspect the existing screen, route, data boundaries, design tokens, relevant project instructions, and current interaction rules. Describe the actual friction; do not leave the problem at “make it nicer.”

## 2. Research only the open decision

Use Mobbin MCP when a concrete visual or interaction question remains. Search for a specific task, platform, and state (for example, “mobile inventory photo crop handles and confirm controls”), not merely “beautiful inventory apps.” Review a small set of relevant screens or complete flows. For each useful reference, record:

- product, screen/flow, platform, and capture date when available;
- the one arrangement or interaction idea worth considering;
- why it may help this task;
- what cannot be inferred from a screenshot.

Treat a shipped screen as an existence example, not proof of task success, accessibility, current behavior, or suitability for All Items. Do not copy branding, illustration, or protected interface assets into the product. Keep Mobbin prompts generic: its current privacy documentation says MCP tool names, parameters including query text, timestamps, and account/workspace identifiers enter product analytics; its search services also process queries through listed AI providers. Never include real inventory names, exact locations, serials, private notes, personal photos, credentials, or local paths in search prompts.

## 3. Explore alternatives before coding

Write the hierarchy, controls, important states, and expected outcomes first. Generate a small number of visual concepts only when a picture will resolve a real layout or hierarchy question. Use synthetic names, quantities, locations, and media. Never upload screenshots containing actual inventory or private media to an external image-generation service. Label generated numbers and content as illustrative; check every label and detail because an image is not executable UI and may invent text or behavior.

Keep the chosen concept, prompt, synthetic input list, selected reference links, and the user's design decisions together under a task-specific design note when the exploration materially informs the implementation. Avoid keeping generated files or screenshots with private user data in the repository.

## 4. Turn the chosen direction into a testable interaction

Before editing code, define actions and observable outcomes, including loading, success, empty, validation, error, retry/cancel, and return navigation as relevant. Separate verified facts, design inferences, and planned behavior. Carry only the decisions that improve the task into the existing All Items system; the reference's visual style is not a new design system.

For gesture-driven controls, the `apple-design` skill is a useful focused checklist for immediate feedback, direct pointer tracking, interruptibility, velocity handoff, spatial continuity, and reduced motion. Apply its advice selectively: native browser behavior, keyboard support, current product rules, device differences, and measured performance take precedence over Apple-specific values or a particular animation library. Do not add motion, translucency, or a new dependency solely to make a screen look more polished.

## 5. Implement and inspect the real flow

Build in the existing product and design system. Walk the complete task in the running app with realistic synthetic data. Check the supported desktop width and 360px layout, keyboard and visible focus, Russian labels and feedback, reduced motion, and accessible pending/error states. Inspect at least one awkward case and verify the actual stored/result state when the change affects data. Fix issues in the implemented UI; do not treat a static generated mockup as validation.

Record what was verified and any remaining uncertainty in `design-references.md` or the relevant task note. Claim usability improvement only when supported by observed task results; do not infer it from a reference screen or polished mockup.

## Suggested brief

```text
We are improving [task] for [person]. The person needs to [goal] with about [realistic content volume].
The current friction is [observed problem]. An awkward case is [case].
Read the existing product instructions, relevant screens, design manifesto, UX principles, and interaction patterns.
If a concrete design question remains, search Mobbin for [specific platform/task/state]. Return a few relevant references, the idea from each, its source, and what a static screen cannot prove.
Use only synthetic content and media in any external prompt. Propose up to three alternatives using the existing All Items visual system. Mark generated values as illustrative.
For the selected direction, define user actions and expected results, including relevant loading, empty, validation, failure, retry/cancel, keyboard, reduced-motion, and return states.
Implement the selected change in the existing product. Walk through the task with synthetic data at desktop and 360px widths. Report what was verified, what remains uncertain, and any design decision that should be retained.
```

## Source basis and limits

This workflow is informed by the transparent single-product case study [How we design UI and UX with AI agents](https://getsweat.ai/blog/from-mobbin-to-a-working-dashboard/), Mobbin's [MCP feature list](https://docs.mobbin.com/mcp/features) and [privacy documentation](https://docs.mobbin.com/mcp/privacy-and-data), Apple's [Designing Fluid Interfaces (WWDC 2018)](https://developer.apple.com/videos/play/wwdc2018/803/), and Emil Kowalski's MIT-licensed [apple-design skill](https://github.com/emilkowalski/skills/tree/main/skills/apple-design). The case study is a practical example, not a controlled usability study: it reports synthetic mockup content, an unrecorded image-generation model/version, and an implementation still under review and unreleased at publication. It reports no comparative usability measurements. The reusable value is the explicit chain from task, to sourced references, to human-reviewed alternatives, to implemented and inspected behavior.

## M3.4 implementation lessons

For a concrete layout defect, inspect competing CSS rules and the actual image box before attributing a screenshot to object-fit alone. Use bounded zero-minimum grid tracks and measure both outer and rendered image geometry. Intrinsic native-control sizing needs allowance for borders and arrow rendering; test complete selected labels, not only container bounds. Treat visual and accessibility feedback as observable states across component remounts.

Keep display conventions separate from storage contracts. M3.4 found a real ISO/Intl HUF precision mismatch; pinned units and an additive historical exponent preserve data. See the [task-specific decisions and sources](m3-4-design.md). No generated concept was needed to resolve these specific constraints; synthetic implemented screenshots and task checks supplied the evidence.
