## 2024-05-22 - Chat Accessibility
**Learning:** Chat interfaces built with React often miss aria-live regions for incoming messages, making them silent to screen readers.
**Action:** Always check aria-live='polite' on message containers and role='status' on typing indicators.

## 2026-01-26 - Chat Focus Management
**Learning:** Chat widgets often trap keyboard users if they don't restore focus to the trigger button upon closing.
**Action:** Always capture `document.activeElement` before opening and restore it after closing.
