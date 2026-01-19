## 2024-05-22 - Chat Accessibility
**Learning:** Chat interfaces built with React often miss aria-live regions for incoming messages, making them silent to screen readers.
**Action:** Always check aria-live='polite' on message containers and role='status' on typing indicators.

## 2026-01-19 - Chat Empty State
**Learning:** Empty chat states leave users guessing what to ask.
**Action:** Use suggestion chips (quick replies) to guide users and provide immediate value.
