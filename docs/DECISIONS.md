# Closed Loop V2 - Design Decisions

Version: 2.0

Purpose

This document records all major architectural and gameplay decisions.

Its purpose is to prevent old ideas from returning without discussion and to document WHY decisions were made.

If a future decision changes an earlier one, the previous decision is never deleted.

Instead it is marked as superseded.

---

# Decision Format

Decision Number

Status

Date

Decision

Reason

Consequences

---

=========================================================
CL-001
=========================================================

Status

🟢 Accepted

Decision

Closed Loop is NOT a traditional game.

Reason

The purpose of the project is education and engineering rather than entertainment.

The simulator teaches circular systems.

Consequences

Every future feature must support engineering understanding.

---

=========================================================
CL-002
=========================================================

Status

🟢 Accepted

Decision

The primary objective is environmental improvement.

Reason

Money is secondary.

Engineering outcomes are primary.

Success is measured through

• Circularity

• Pollution Reduction

• Resource Recovery

• Environmental Impact

---

=========================================================
CL-003
=========================================================

Status

🟢 Accepted

Decision

The first scenario is Melbourne Legacy Landfill.

Reason

It naturally introduces

Organic waste

Landfill gas

Mixed waste

Leachate

Construction waste

without overwhelming the player.

---

=========================================================
CL-004
=========================================================

Status

🟢 Accepted

Decision

The simulator has NO timer.

Reason

Players should experiment.

Think.

Redesign.

Delete.

Learn.

Engineering is not a race.

---

=========================================================
CL-005
=========================================================

Status

🟢 Accepted

Decision

Stockpiles replace production timers.

Reason

The player sees actual quantities remaining.

Watching stockpiles reduce is more satisfying than waiting for time to pass.

---

=========================================================
CL-006
=========================================================

Status

🟢 Accepted

Decision

The toolbox is context sensitive.

Reason

Showing hundreds of technologies overwhelms users.

Instead

Select Resource

↓

Suggested Technologies

↓

Place Machine

↓

Repeat

---

=========================================================
CL-007
=========================================================

Status

🟢 Accepted

Decision

A "Show All Technologies" button remains available.

Reason

Advanced users still require complete access.

Beginners should not.

---

=========================================================
CL-008
=========================================================

Status

🟢 Accepted

Decision

Hints explain WHY.

Reason

Closed Loop teaches engineering.

The simulator should recommend technologies and explain the engineering reasoning.

---

=========================================================
CL-009
=========================================================

Status

🟢 Accepted

Decision

Supabase is the ONLY source of truth.

Reason

Machine data must never exist in multiple places.

No duplicated JSON.

No duplicated arrays.

---

=========================================================
CL-010
=========================================================

Status

🟢 Accepted

Decision

Version 2 is developed beside Version 1.

Reason

Avoid breaking the existing simulator.

Development continues safely.

---

=========================================================
CL-011
=========================================================

Status

🟢 Accepted

Decision

The frontend becomes modular.

Reason

The previous simulator.js became too large.

Modules replace the monolithic architecture.

---

=========================================================
CL-012
=========================================================

Status

🟢 Accepted

Decision

The architecture is divided into independent systems.

Systems

• Game Engine

• UI

• Data Loader

• Event Manager

• Placement Manager

• Toolbox

• API Coordinator

• Technology Engine

• Simulation Engine

• Hint Engine

Reason

Single responsibility.

Easy maintenance.

---

=========================================================
CL-013
=========================================================

Status

🟢 Accepted

Decision

Pollution is treated as another resource.

Reason

Waste heat.

CO₂.

Ash.

Leachate.

Dust.

Every output should have a possible consumer.

---

=========================================================
CL-014
=========================================================

Status

🟢 Accepted

Decision

The simulator always asks

"What consumes this next?"

Reason

This becomes the central design philosophy.

---

=========================================================
CL-015
=========================================================

Status

🟢 Accepted

Decision

Residential, agriculture and industry become future scenarios.

Reason

Version 2 must remain focused.

Only Melbourne Landfill belongs in the MVP.

---

=========================================================
CL-016
=========================================================

Status

🟢 Accepted

Decision

Data Centres become industrial nodes.

Reason

They consume

Electricity

Cooling

They produce

Waste Heat

They therefore participate in the closed loop.

---

=========================================================
CL-017
=========================================================

Status

🟢 Accepted

Decision

The simulator should feel like an engineering consultant.

Reason

Hints should guide the player rather than acting as a tutorial.

---

=========================================================
CL-018
=========================================================

Status

🟢 Accepted

Decision

Every technology contains

Inputs

Outputs

Environmental impacts

Compatible technologies

Reason

Relationships are more important than machine categories.

---

=========================================================
CL-019
=========================================================

Status

🟢 Accepted

Decision

The player solves environmental problems rather than completing levels.

Reason

Problems naturally generate engineering decisions.

---

=========================================================
CL-020
=========================================================

Status

🟢 Accepted

Decision

The long-term vision is a Resource Relationship Engine.

Reason

Closed Loop is fundamentally about understanding how resources flow between technologies rather than simply building factories.


Future Decisions

New design decisions must always be added below.

Never overwrite previous decisions.

If a decision changes

Mark it

SUPERSEDED

and reference the new decision number.

This document becomes the design history of the project.

END OF DOCUMENT

=========================================================
CL-021
=========================================================

Status

🟢 Accepted

Decision

Protected Supabase scenario data is accessed by Laravel using the service-role credential server-side only.

Reason

Scenario and `scenario_resources` data are protected by Row Level Security (RLS) in Supabase. The Laravel API acts as the trusted server-side boundary that can hold the Supabase service-role key securely.

Consequences

- Browser clients do not use the Supabase service-role key.
- V2 reads protected scenario data through Laravel endpoints (e.g., `/api/scenarios/{id}`).
- Future clients (for example Unity) should also call the Laravel API rather than embedding the service-role key.
- Supabase remains the single source of truth; Laravel is the trusted proxy for protected reads.