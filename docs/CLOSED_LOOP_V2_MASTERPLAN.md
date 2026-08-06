# Closed Loop V2 - Master Plan

**Version:** 2.0
**Status:** Design Approved
**Project:** Closed Loop
**Author:** Dean Johnson & ChatGPT
**Date:** August 2026

---

# Purpose

This document is the single source of truth for the architecture, philosophy and long-term direction of Closed Loop Version 2.

It replaces previous frontend architecture discussions.

Whenever a design decision is required, this document takes precedence unless explicitly updated.

---

# Vision

Closed Loop is **not** a traditional game.

It is an interactive engineering platform that teaches people how waste, energy, water, pollution and industrial processes connect together.

The objective is to design systems where every practical output becomes the input to another process.

The simulator should encourage systems thinking rather than memorisation.

---

# Mission

Transform environmental problems into valuable resources.

Rather than asking

> "How do we dispose of this?"

Closed Loop asks

> "Who can use this next?"

The simulator teaches circular engineering by allowing users to experiment with technologies and immediately see the environmental and engineering consequences.

---

# Core Philosophy

Everything is a resource.

Nothing exists in isolation.

Every technology should answer three questions:

• What does it consume?

• What does it produce?

• Who can use those outputs?

Pollution is simply an unresolved output.

Waste is a resource waiting for another customer.

---

# What Closed Loop Is

Closed Loop is:

• Resource relationship simulator

• Circular economy simulator

• Engineering education platform

• Technology visualisation system

• Environmental optimisation tool

It is NOT:

• SimCity

• Factorio

• Production Line

• CAD software

• A financial simulator

Money is secondary.

Engineering is primary.

---

# Primary Objective

The player starts with environmental problems.

The goal is to eliminate them through engineering.

Success is measured by:

• Environmental Impact

• Circularity

• Waste Utilisation

• Pollution Reduction

• Resource Recovery

NOT by:

• Time

• Population

• Money

---

# Scenario One

## Melbourne Legacy Landfill

The first scenario begins on an old Melbourne landfill.

The site already contains millions of tonnes of recoverable material.

Examples:

- Organic Waste
- Mixed Waste
- Construction Waste
- Scrap Metal
- Glass
- Plastic
- Landfill Gas
- Leachate
- Contaminated Water

These exist as stockpiles from day one.

No timer exists.

The player simply asks

"How can I use everything here?"

---

# No Time System

Closed Loop has no years.

No countdown.

No production timer.

The player can stop.

Think.

Delete.

Redesign.

Experiment.

The simulator encourages engineering rather than speed.

---

# Resource Stockpiles

Every resource begins as a stockpile.

Example

Organic Waste

420,000 tonnes

Landfill Gas

180 million cubic metres

Glass

120,000 tonnes

As technologies consume materials, stockpiles reduce.

Eventually they reach zero.

That represents successful recovery.

---

# Environmental Impact

Every stockpile contributes environmental impact.

Example

Landfill Gas

★★★★★

Methane emissions

Organic Waste

★★★★☆

Odour

Methane

Leachate

Every machine also has environmental impacts.

Some reduce pollution.

Some create new outputs.

The engineering challenge is consuming every output.

Ultimate goal:

Zero practical waste.

Minimum practical pollution.

---

# Gameplay Loop

Select a problem.

↓

Read information.

↓

See compatible technologies.

↓

Place one.

↓

New outputs appear.

↓

Solve those outputs.

↓

Increase circularity.

↓

Repeat.

---

# Intelligent Toolbox

There is no giant toolbox.

The toolbox changes depending on selection.

Example

Selected

Farm Waste

Toolbox

Anaerobic Digester

Composting

Pyrolysis

Show All Technologies

The simulator guides the player.

The player does not search hundreds of machines.

---

# Hint System

The Hint button becomes an engineering consultant.

Examples

"Gas Generator is recommended because..."

"Unused CO₂ could feed an Algae Farm."

"Remaining Digestate could produce Fertiliser."

The hint system explains WHY.

Not simply WHAT.

---

# Technology Relationships

Every machine contains

Inputs

Outputs

By-products

Environmental impacts

Compatible technologies are calculated from these relationships.

No hard coded chains.

Everything comes from the database.

---

# Pollution Philosophy

Pollution is another resource.

Examples

CO₂

Waste Heat

Leachate

Ash

Dust

Unused Water

The objective is finding another technology capable of consuming them.

---

# Supabase

Supabase is the ONLY source of truth.

No duplicated machine definitions.

No duplicated resource definitions.

No JSON copies.

No manual arrays.

Everything originates from Supabase.

---

# Database Rules

One machine definition.

One resource definition.

One relationship.

Everything references stable keys.

The frontend never invents engineering data.

---

# Frontend Architecture

The frontend becomes modular.

There is no simulator.js god object.

Major systems

Game Engine

UI

Data Loader

Event Manager

Placement Manager

Toolbox

API Coordinator

Simulation Engine

Technology Engine

Hint Engine

Each has a single responsibility.

---

# Game Engine

Responsible only for

Rendering

Camera

Grid

Selection

Dragging

Connections

Nothing else.

---

# UI

Responsible only for presentation.

Context Panel

Machine Info

Operations Centre

Resource Stockpiles

Environmental Dashboard

Hint Panel

No business logic.

---

# API Coordinator

Single location for all API communication.

No random fetch() calls.

Everything goes through one client.

---

# Data Loader

Loads

Machines

Resources

Relationships

Scenarios

Normalises data.

Caches data.

Nothing else.

---

# Technology Engine

Answers questions like

"What consumes this?"

"What produces this?"

"What technologies are compatible?"

"What pollution remains?"

This becomes the heart of Closed Loop.

---

# Simulation Engine

Calculates

Material flow

Power

Water

Heat

Gas

Pollution

Circularity

Environmental impact

The simulation engine performs calculations.

The UI simply displays results.

---

# Event Manager

Everything communicates through events.

No globals.

No window hacks.

No direct coupling.

---

# Machine Placement

Selection remains after placement.

The newly placed machine becomes active.

The toolbox updates automatically.

---

# Resource Philosophy

Resources are not rubbish.

Resources are opportunities.

Every resource should eventually answer

Who consumes me?

---

# Future Scenarios

Future scenarios may include

Regional Hub

Residential Estate

Agricultural Region

Mining Operation

Industrial Estate

Wastewater Plant

Data Centre Precinct

Hydrogen Hub

Ports

Airports

But Version 2 focuses ONLY on the Melbourne landfill.

---

# Residential Future

Long term

Residential estates become resource nodes.

Inputs

Electricity

Water

Products

Outputs

Food Waste

Garden Waste

Greywater

Wastewater

Recyclables

Rather than individual houses, neighbourhoods become engineering objects.

---

# Data Centres

Data centres are industrial nodes.

Inputs

Electricity

Cooling

Outputs

Waste Heat

The simulator should encourage using waste heat elsewhere.

---

# Circular Economy

The simulator always asks

Can this output become another input?

The closer the answer approaches YES,

the higher the circularity.

---

# Success Metrics

Environmental Impact

Circularity

Waste Recovery

Pollution Eliminated

Unused Outputs

Resource Utilisation

Not money.

Not speed.

---

# Code Principles

Small files.

Single responsibility.

No duplicated logic.

No duplicated data.

Readable code.

Documented architecture.

Everything modular.

---

# Development Strategy

The existing simulator remains untouched.

Version 2 is developed beside it.

Suggested structure

resources/js/

simulator/

(legacy)

simulator-v2/

engine/

ui/

simulation/

toolbox/

events/

services/

api/

renderer/

The legacy simulator remains operational until Version 2 replaces it.

---

# Development Roadmap

Stage 1

Engine boots

Stage 2

Scenario loads

Stage 3

Stockpiles displayed

Stage 4

Selection system

Stage 5

Context panel

Stage 6

Placement

Stage 7

Connections

Stage 8

Simulation

Stage 9

Environmental dashboard

Stage 10

Hint engine

Only move forward once each stage is complete.

---

# Long Term Vision

Closed Loop evolves into an engineering knowledge platform.

Students.

Researchers.

Industry.

Government.

Engineers.

Community.

Everyone should be able to explore resource relationships without needing specialist engineering knowledge.

---

# Project Motto

> Every output is either a product or an opportunity.

If it is currently pollution,

Closed Loop challenges us to discover whether another technology can transform it into something valuable.

---

END OF DOCUMENT