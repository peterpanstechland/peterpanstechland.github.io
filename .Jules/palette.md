## 2024-05-22 - Chat Accessibility
**Learning:** Chat interfaces built with React often miss aria-live regions for incoming messages, making them silent to screen readers.
**Action:** Always check aria-live='polite' on message containers and role='status' on typing indicators.

## 2024-05-22 - Async Button Feedback
**Learning:** Users often double-click async action buttons if there's no immediate visual feedback within 100ms.
**Action:** Replace icon with a spinner inside the same button element to maintain layout stability and focus.
