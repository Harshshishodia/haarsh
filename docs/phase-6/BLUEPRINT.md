# RSVP, Seating, Transport and Admin — Phase 6

Phase 6 normalizes every known event and keeps unknown times/venues explicitly unconfirmed. Guests edit per-event household attendance, diet, stay and arrival details. Managers see live totals, create capacity-bound seating plans, assign guests with a step-up PIN, publish once, dispatch transport and record arrivals. Published assignments notify only affected guests.

Sensitive assignment, publication and transport changes require `X-Step-Up-Pin`, compared in constant time against the server-only `ADMIN_STEP_UP_PIN`.
