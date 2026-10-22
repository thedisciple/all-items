# Design manifesto

This manifesto governs every user-facing change in All Items. The interface should explain itself through its structure and behavior. Minimalism is a product requirement: each visible element must help a real task, communicate necessary information, or make an interaction understandable.

## Product rules

- Reduce cognitive load, clicks, repeated work, duplicate actions, and persistent noise.
- Prefer direct manipulation and immediate, truthful state changes.
- Make primary and secondary actions easy to distinguish; equivalent actions share a visual treatment.
- Use a control only when its behavior matches its appearance. Icons, disclosure controls, and labels must describe the action they perform.
- Show Save or Cancel only while a user is editing. Avoid redundant explanations and obvious repeated information.
- Keep technical storage details out of ordinary workflows. Keep errors visible, brief, and actionable.
- Preserve entered work after recoverable errors. Never require a manual refresh to see a saved change.
- Destructive actions use one consistent explicit confirmation with a clear consequence, Cancel, and one final action.
- Provide keyboard access, visible focus, accessible status and error announcements, and layouts that work at 360px.
- Motion must clarify a state change, respect reduced-motion preferences, and never delay a task.
- Keep private inventory, photos, sale intent, and local-first storage private by default. Do not imply synchronization, backup, or availability that is not implemented.

## Review questions

For every visible element ask whether it supports a real action, gives necessary information, is immediately understood, can be removed without losing useful function, and behaves consistently with comparable controls. Remove elements that fail this review, while retaining necessary accessibility and recovery behavior.

## Design references

All Items applies the interaction principles researched in Kovodstvo, monobank, monobazar, Telegram, and Notion without copying their proprietary assets or implying a partnership. Notion informs lightweight emoji-based organization. Telegram informs direct media manipulation and responsive navigation. monobank and monobazar remain sources for future organization, goals, and marketplace hypotheses. These references do not override local-first privacy, honest states, or the current product scope.

AI, MCP integrations, achievements, marketplace flows, E2EE synchronization, optional providers, multi-user access, and private beta remain future proposals. They are not permissions to expose data, add network dependencies, or claim unimplemented capabilities. See the [opportunity register](opportunity-register.md) and [architecture](../architecture.md) for boundaries and staged plans.
