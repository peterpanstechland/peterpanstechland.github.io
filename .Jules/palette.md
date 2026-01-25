## 2024-05-22 - Chat Accessibility
**Learning:** Chat interfaces built with React often miss aria-live regions for incoming messages, making them silent to screen readers.
**Action:** Always check aria-live='polite' on message containers and role='status' on typing indicators.

## 2025-02-18 - Keyboard Focus Management
**Learning:** Custom chat widgets often neglect focus restoration and Escape key handling, forcing keyboard users to traverse the entire DOM again after closing.
**Action:** Implement `prevFocusRef` pattern and Escape key listeners for all custom overlays.
