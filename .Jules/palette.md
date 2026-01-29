## 2024-05-22 - Chat Accessibility
**Learning:** Chat interfaces built with React often miss aria-live regions for incoming messages, making them silent to screen readers.
**Action:** Always check aria-live='polite' on message containers and role='status' on typing indicators.
## 2024-05-22 - Focus Management in Root Portals
**Learning:** Chat widgets injected at the document root detach from the natural focus order, trapping keyboard users or losing their place.
**Action:** Implement manual focus restoration (using a ref to store activeElement) and global Escape key listeners for all root-injected overlays.
