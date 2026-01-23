## 2024-05-22 - Chat Accessibility
**Learning:** Chat interfaces built with React often miss aria-live regions for incoming messages, making them silent to screen readers.
**Action:** Always check aria-live='polite' on message containers and role='status' on typing indicators.

## 2024-05-24 - Focus Management in React
**Learning:** React Strict Mode causes effects to run twice, which can mess up focus capture logic if the component auto-focuses an input on mount.
**Action:** Verify `document.activeElement` is not the component's own input before saving it as the "previous focus".
