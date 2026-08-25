# ✈️ Airline Reservation System

A pet project built to learn and apply **Domain-Driven Design (DDD)** and
**CQRS** principles on a realistic airline reservation domain — a modular
monolith with rich aggregates, value objects, domain events, and strict
bounded-context boundaries.

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Database Setup](#database-setup)
  - [Running the App](#running-the-app)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Bounded Contexts](#bounded-contexts)
- [Documentation](#documentation)

## Overview

**Goals of this project:**

- Practice Strategic and Tactical DDD
- Build a rich domain model with complex business rules
- Explore Aggregates, Value Objects, Domain Events, and Bounded Contexts
- Apply CQRS with in-process command/query buses
- Follow Clean/Hexagonal Architecture principles
- Improve backend architecture and design skills

**Core domain:** Reservation.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [NestJS](https://nestjs.com/) |
| Language | TypeScript |
| Database | MongoDB |
| ORM | [Prisma](https://www.prisma.io/) |
| CQRS / Events | `@nestjs/cqrs`, `@nestjs/event-emitter` |
| Scheduling | `@nestjs/schedule` (cron workers) |
| API Docs | Swagger / OpenAPI (`@nestjs/swagger`) |
| Validation | `class-validator`, `class-transformer` |
| Testing | Jest, Supertest |
| Linting / Formatting | ESLint, Prettier |

## Architecture

The backend is a **modular monolith** organized around two bounded
contexts — **Flight** (schedules, seat inventory, pricing, temporary seat
holds) and **Reservation** (bookings, price snapshots, payments,
expiration workers) — that communicate in-process via `CommandBus` /
`QueryBus` and domain events, never through direct repository access
across the boundary.

For a full breakdown — system diagrams, the end-to-end booking sequence,
state machines, and the architectural decisions behind them — see
**[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [MongoDB](https://www.mongodb.com/) running as a **replica set** —
  required by Prisma's MongoDB connector, even for local development
- npm (or your package manager of choice)

### Installation

```bash
git clone <repository-url>
cd airline-reservation
npm install
```

### Environment Variables

Copy the example file and fill in your own values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | MongoDB connection string. Must include `replicaSet` for a local instance, e.g. `mongodb://localhost:27017/airline_reservation?replicaSet=rs0` |
| `PORT` | Port the HTTP server listens on (optional, defaults to `3000`) |

### Database Setup

If you don't already have a local MongoDB replica set, the quickest way
to get one is via Docker:

```bash
docker run -d --name airline-mongo -p 27017:27017 mongo:7 --replSet rs0
docker exec -it airline-mongo mongosh --eval "rs.initiate()"
```

Then generate the Prisma client and seed the database with sample flights:

```bash
npx prisma generate
npm run db:seed
```

### Running the App

```bash
# development (watch mode)
npm run start:dev

# debug mode
npm run start:debug

# production build
npm run build
npm run start:prod
```

The server starts on `http://localhost:3000` by default.

## API Documentation

Interactive Swagger/OpenAPI docs are served once the app is running:

```
http://localhost:3000/api/docs
```

## Testing

```bash
# unit tests
npm run test

# unit tests, watch mode
npm run test:watch

# unit tests with coverage report
npm run test:cov

# end-to-end tests
npm run test:e2e
```

## Project Structure

```
src/
├── modules/
│   ├── flight/            # Flight bounded context
│   │   ├── application/   # Commands, queries, and their handlers
│   │   ├── domain/        # Aggregates, value objects, domain events, policies
│   │   └── infrastructure/# HTTP controllers, Prisma repository, cron workers
│   ├── reservation/        # Reservation bounded context (same layering)
│   └── shared/             # Cross-cutting infrastructure (e.g. Prisma module)
├── app.module.ts
└── main.ts
prisma/
├── schema.prisma           # MongoDB data model
└── seed.ts                 # Sample data seed script
docs/
├── ARCHITECTURE.md         # System diagrams & architectural decisions
└── ubiquitous-language.md  # Shared domain glossary
```

Each bounded context follows the same **Hexagonal (Ports & Adapters)**
layering: HTTP controllers and Prisma repositories are adapters around a
persistence-ignorant application and domain core.

## Bounded Contexts

**Implemented:**

- Flight Management
- Reservation

**Planned:**

- Payments (currently a mock adapter behind `PaymentGatewayPort`)

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system architecture, CQRS/booking sequence, state machines, and key design decisions
- [docs/ubiquitous-language.md](docs/ubiquitous-language.md) — shared domain glossary