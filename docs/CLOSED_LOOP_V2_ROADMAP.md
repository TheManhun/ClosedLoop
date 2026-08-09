# Closed Loop V2 - Development Roadmap

Version: 2.0
Status: Active Development

---

# Purpose

This document defines the exact order in which Closed Loop Version 2 will be developed.

The objective is to avoid feature creep and ensure every stage is fully functional before the next begins.

Nothing should be skipped.

If a stage fails, fix it before continuing.

---

# Development Rules

✔ Small commits

✔ One feature at a time

✔ One responsibility per module

✔ Supabase is the only source of truth

✔ Legacy simulator remains untouched

✔ Every stage must compile and run

✔ No TODO code left behind

✔ No duplicate machine definitions

✔ No duplicate resource definitions

✔ Every completed stage becomes a Git milestone

---

# Overall Development Order

Stage 0
Foundation

↓

Stage 1
Game Engine

↓

Stage 2
API

↓

Stage 3
Scenario

↓

Stage 4
Selection

↓

Stage 5
Toolbox

↓

Stage 6
Placement

↓

Stage 7
Connections

↓

Stage 8
Simulation

↓

Stage 9
Environment

↓

Stage 10
Hint System

↓

Stage 11
Polish

---

=========================================================
STAGE 0
PROJECT FOUNDATION
=========================================================

Goal

Create the new architecture.

Tasks

□ Create simulator-v2 folder

□ Create module structure

□ Create main bootstrap


Tasks

- [x] API Client
- [x] Machine loading
- [x] Resource loading
- [x] Scenario loading
- [x] Error handling
- [x] Cache

Expected Result

All data loads from Supabase through the Laravel API proxy. Nothing duplicated.

Status

✔ Stage 2 complete — API Coordinator, DataLoader and Scenario pipeline implemented and verified.

Git Tag

v2-stage-2
□ Create Simulation shell

Expected Result

Application launches.

No functionality.

Only architecture.

Git Tag

v2-stage-0

---

=========================================================
STAGE 1
GAME ENGINE
=========================================================

Goal

Create the visual map.

Tasks

□ Phaser boots

□ Camera

□ Zoom

□ Pan

□ Grid

□ Mouse

□ Selection highlight

□ Resize support

Expected Result

Blank map.

Camera works.

Selection works.

Nothing else.

Git Tag

v2-stage-1

---

=========================================================
STAGE 2
API COORDINATOR
=========================================================

Goal

Single API access point.

Tasks

□ API Client

□ Machine loading

□ Resource loading

□ Scenario loading

□ Error handling

□ Cache

Expected Result

All data loads from Supabase.

Nothing duplicated.

Git Tag

v2-stage-2

---

=========================================================
STAGE 3
SCENARIO SYSTEM
=========================================================

Goal

Load Dandenong South Closed Loop Hub.

Tasks

□ Load scenario

□ Display map

□ Load stockpiles

□ Load starting objects

□ Load starting environmental liabilities / pollutant resources when defined by scenario data

Expected Result

Map displays.

Stockpiles visible.

Git Tag

v2-stage-3

---

=========================================================
STAGE 4
SELECTION SYSTEM
=========================================================

Goal

Everything selectable.

Tasks

□ Resources

□ Machines

□ Ground

□ Connections

□ Selection event

□ Clear selection

Expected Result

Selection works everywhere.

Git Tag

v2-stage-4

---

=========================================================
STAGE 5
INTELLIGENT TOOLBOX
=========================================================

Goal

Dynamic toolbox.

Tasks

□ Context Panel

□ Compatible technologies

□ Show All

□ Machine categories

□ Search

□ Favourites

Expected Result

Selecting Farm Waste immediately shows

Anaerobic Digester

Composting

Pyrolysis

Git Tag

v2-stage-5

---

=========================================================
STAGE 6
PLACEMENT
=========================================================

Goal

Place machines.

Tasks

□ Placement preview

□ Collision detection

□ Rotate

□ Confirm

□ Cancel

□ Auto-select new machine

Expected Result

Machines can be placed.

Selection changes automatically.

Git Tag

v2-stage-6

---

=========================================================
STAGE 7
CONNECTIONS
=========================================================

Goal

Machines communicate.

Tasks

□ Conveyor

□ Water

□ Power

□ Gas

□ Heat

□ Pipe validation

□ Flow direction

Expected Result

Everything connects.

Git Tag

v2-stage-7

---

=========================================================
STAGE 8
SIMULATION ENGINE
=========================================================

Goal

Calculate engineering.

Tasks

□ Material flow

□ Capacity

□ Power

□ Water

□ Heat

□ Gas

□ Resource utilisation

□ Circularity

Expected Result

Engineering calculations working.

Git Tag

v2-stage-8

---

=========================================================
STAGE 9
ENVIRONMENTAL ENGINE
=========================================================

Goal

Measure environmental impact.

Tasks

□ Pollution score

□ Resource depletion

□ Landfill reduction

□ CO₂

□ Methane

□ Leachate

□ Waste heat

□ Environmental dashboard

Expected Result

Environmental Impact updates live.

Git Tag

v2-stage-9

---

=========================================================
STAGE 10
HINT ENGINE
=========================================================

Goal

Become an engineering assistant.

Tasks

□ Suggest next technology

□ Explain WHY

□ Detect bottlenecks

□ Detect pollution

□ Detect unused outputs

□ Optimisation suggestions

Expected Result

User presses Hint.

Simulator explains next engineering decision.

Git Tag

v2-stage-10

---

=========================================================
STAGE 11
POLISH
=========================================================

Goal

Complete MVP.

Tasks

□ Icons

□ Sounds

□ Animations

□ Overlay modes

□ Machine information

□ Reports

□ Export

□ Save

□ Load

Expected Result

Closed Loop MVP complete.

Git Tag

v2-stage-11

---

# Future Stages

These are NOT part of Version 2.

Do not implement until MVP is complete.

Future ideas include

□ Residential Estates

□ Agriculture

□ Mining

□ Hydrogen

□ AI Data Centres

□ Battery Manufacturing

□ District Heating

□ Water Trading

□ National Grid

□ Regional Hubs

□ Multi-map scenarios

□ AI Design Assistant

---

# Coding Standards

No module over ~500-700 lines where practical.

Prefer composition over inheritance.

One responsibility per file.

No globals.

No duplicated engineering logic.

Everything communicates through Event Manager.

Everything loads through API Coordinator.

Everything calculates through Simulation Engine.

---

# Testing

Every stage requires

□ Unit tests

□ Manual browser test

□ Build passes

□ No console errors

□ Documentation updated

Only then move to the next stage.

---

# Git Workflow

Every completed stage

git commit

↓

git tag

↓

GitHub push

↓

Checkpoint

Never lose a working version.

---

# MVP Definition

Closed Loop Version 2 MVP is complete when a user can:

✔ Open Dandenong South Closed Loop Hub

✔ View stockpiles

✔ Select a resource

✔ Receive suggested technologies

✔ Place machines

✔ Connect machines

✔ Watch engineering calculations

✔ Reduce pollution

✔ Increase circularity

✔ Complete the scenario challenge

without reading documentation.

---

# Final Goal

Closed Loop should feel less like a factory game...

...and more like sitting beside an experienced systems engineer.

The software should continuously answer one question:

"What is the next best use for this resource?"

If that question is always easy to answer,

the simulator has succeeded.

---

END OF DOCUMENT