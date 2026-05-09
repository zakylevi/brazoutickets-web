## Seating Event System — Implementation Plan

### Phase 1: Database Schema
- Add a `seating_sections` table — stores sections (e.g., "Floor", "Balcony A") with rows and seats per row, linked to an event
- Add a `seats` table — individual seats with section, row, seat number, status (available/reserved/sold), and optional link to an order
- Add an `event_type` field to the `events` table ("general_admission" or "seated") to distinguish event types

### Phase 2: Organizer — Event Creation
- Add a toggle in event creation: **General Admission** vs **Seated Event**
- When "Seated" is selected, show a **Seating Map Builder**:
  - Organizer adds sections (name, number of rows, seats per row, price per section)
  - Preview of the layout as they build
  - Each section can have its own price tier
- Mixed support: some sections can be marked as "General Admission" (no seat selection needed)

### Phase 3: Event Dashboard — Tickets Tab (Organizer View)
- For seated events, the Tickets tab shows:
  - Visual section overview with sold/available counts per section
  - Ability to view individual seat status (available, sold, reserved)
  - Ability to block/release seats manually

### Phase 4: Event Detail Page — Ticket Selection (Public)
- For seated events, replace the standard ticket picker with:
  - Section selector (pick a section first)
  - Row & seat picker within the selected section
  - Real-time seat availability (colored: available, taken, selected)
  - Cart summary showing selected seats with prices
  - Checkout flow remains the same

### Phase 5: Order Integration
- When a seated ticket is purchased, mark specific seats as "sold" and link to the order
- Ticket/order displays show section + row + seat number

---

**We'll build this in phases, starting with Phase 1 (database) and Phase 2 (organizer creation flow).**
