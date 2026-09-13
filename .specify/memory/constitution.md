<!--
Sync Impact Report
- Version change: (unratified template) → 1.0.0
- Modified principles: n/a (initial ratification; all five principles newly defined)
- Added sections:
  - Core Principles I–V (DDD & Bounded-Context Isolation; Hexagonal Architecture;
    CQRS via Explicit Buses; Explicit Saga Orchestration; Test Coverage)
  - Technology Stack Constraints
  - Code Quality & Review Workflow
  - Governance (amendment procedure, versioning policy, compliance review)
- Removed sections: none (all template placeholder sections retained and filled)
- Templates requiring follow-up: none — dependent templates/commands resolve this
  constitution at runtime and are out of scope for this command per the Scope Guard.
- Follow-up TODOs: none
-->

# Airline Reservation System Constitution

## Core Principles

### I. Domain-Driven Design & Strict Bounded-Context Isolation
Core domain logic MUST be modeled with rich aggregates, value objects, and
domain events using DDD tactical patterns. The Flight and Reservation bounded
contexts MUST NOT access each other's repositories, aggregates, or internal
domain objects directly. All cross-context communication MUST go through an
explicit Anti-Corruption Layer exposed as a port interface (e.g.
`FlightInventoryPort`), and only that port's adapter may dispatch across the
boundary. Rationale: this project's explicit purpose is to practice strategic
DDD; leaking domain models across contexts defeats that goal and recreates
the tight coupling bounded contexts exist to prevent.

### II. Hexagonal Architecture (Ports & Adapters)
Every module MUST separate `domain`, `application`, and `infrastructure`
layers. Domain and application code MUST remain persistence-ignorant and
framework-agnostic. HTTP controllers, Prisma repositories, and other I/O
adapters MUST depend inward on ports; the domain/application layers MUST NOT
import infrastructure types. Rationale: keeps business rules testable in
isolation from NestJS, Prisma, or transport concerns, matching the project's
declared Clean/Hexagonal architecture goal.

### III. CQRS via Explicit Command/Query Buses
State-changing operations MUST be modeled as Commands and read operations as
Queries, each dispatched through `@nestjs/cqrs`'s `CommandBus`/`QueryBus` to a
dedicated handler. Handlers MUST NOT call into another bounded context
directly; they MUST go through that context's port (Principle I). Rationale:
separates write/read responsibility and guarantees a single, auditable entry
point per context boundary.

### IV. Explicit Saga Orchestration for Multi-Step Workflows
Any workflow that spans multiple aggregates, external side effects, or
bounded contexts (e.g. seat confirmation plus payment) MUST be coordinated by
an explicit saga/orchestrator with a defined compensation (rollback) stack,
rather than by implicit side effects chained inside handlers. Rationale: the
reservation confirmation flow was refactored onto `ConfirmReservationSaga`
with explicit compensation specifically because implicit multi-step handler
logic was error-prone and hard to reason about on partial failure.

### V. Test Coverage for Domain and Integration Behavior
New or changed domain logic MUST ship with Jest unit tests. Changes that
cross module boundaries or the HTTP API MUST include end-to-end coverage.
`npm run test` and `npm run test:e2e` MUST pass before a change is merged.
Rationale: the domain carries complex business rules (pricing, seat holds,
saga compensation); untested changes here regress silently and are costly to
diagnose after the fact.

## Technology Stack Constraints

The backend MUST be built on NestJS with TypeScript. Persistence MUST use
MongoDB via Prisma, and any MongoDB instance (local or otherwise) MUST run as
a replica set, since Prisma's MongoDB connector requires it. API input MUST
be validated at the boundary using `class-validator`/`class-transformer`
DTOs. Publicly exposed HTTP endpoints MUST be documented via Swagger/OpenAPI
(`@nestjs/swagger`) annotations so the interactive docs at `/api/docs` stay
accurate. External integrations without a real implementation yet (e.g.
payments) MUST be built behind a port with a mock adapter, never wired
directly into domain or application code.

## Code Quality & Review Workflow

Code MUST pass `npm run lint` and `npm run format` before being committed.
Pull requests MUST state which bounded context(s) and which layers
(domain/application/infrastructure) they touch. Reviewers MUST verify, before
approval, that changes preserve bounded-context isolation (Principle I) and
hexagonal layering (Principle II), and that multi-step workflows added or
modified follow the explicit saga pattern (Principle IV) where applicable.

## Governance

This constitution supersedes ad-hoc conventions and prior undocumented
practice. Amendments are made by editing this file directly: the change MUST
include an updated Sync Impact Report (as an HTML comment at the top of this
file, removed before the amended file is committed) and a version bump
following semantic versioning — MAJOR for backward-incompatible principle
removals or redefinitions, MINOR for a new principle or materially expanded
guidance, PATCH for clarifications and wording fixes. `LAST_AMENDED_DATE`
MUST be updated on every amendment; `RATIFICATION_DATE` never changes once
set. All pull requests and code reviews MUST verify compliance with these
principles; any deviation MUST be called out explicitly in the PR description
along with either a plan to reconcile it or an accepted, justified exception.
Complexity that violates hexagonal or CQRS boundaries MUST be justified
against these principles or simplified before merge.

**Version**: 1.0.0 | **Ratified**: 2026-09-13 | **Last Amended**: 2026-09-13
