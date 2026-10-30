# Agent Platform — Phase 7

Phase 7 loads 17 versioned YAML agent specifications into a registry. Each run records only an input digest, then enforces the agent's server-side tool whitelist and autonomy tier. Deterministic rules route RSVP, seating, transport, SOS and unknown facts; no model is required.

Autopilot has `off`, `observe` and `on` modes. Background A0–A2 actions execute only in `on`, never exceed 20 per hour, and A3 always remains proposed. The five-minute Operator loop detects missing RSVPs and seating gaps, while audit and run tables preserve every decision.
