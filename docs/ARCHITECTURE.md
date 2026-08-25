# Architecture Overview

This document describes the system architecture of the Airline Reservation
backend: a **modular monolith** built with NestJS, organized around two
strategic **Bounded Contexts** (Flight, Reservation) that communicate
in-process via `@nestjs/cqrs` and `@nestjs/event-emitter`.

- [1. System Architecture & Bounded Contexts](#1-system-architecture--bounded-contexts)
- [2. End-to-End Booking Sequence](#2-end-to-end-booking-sequence)
- [3. State Machines](#3-state-machines)
- [4. Architecture Narrative & Key Decisions](#4-architecture-narrative--key-decisions)

---

## 1. System Architecture & Bounded Contexts

The **Flight Context** owns flight schedules, seat inventory, pricing, and
temporary seat holds. The **Reservation Context** owns commercial bookings,
price snapshots, payment orchestration, and hold-expiration cleanup. Each
context follows a Hexagonal (Ports & Adapters) layout: HTTP controllers and
Prisma repositories are *inbound/outbound adapters* around a persistence-
ignorant application and domain core. The only integration surface between
the two contexts is the in-process `CommandBus` / `QueryBus` — there are no
direct repository or aggregate references across the boundary.

```mermaid
flowchart TB
    Client(["Client / Swagger UI"])

    subgraph FlightCtx["Flight Context"]
        direction TB
        FlightController["FlightController\n(HTTP)"]

        subgraph FlightApp["Application Layer"]
            HoldSeatsH["HoldSeatsHandler"]
            ConfirmSeatsH["ConfirmSeatsHandler"]
            ReleaseSeatsH["ReleaseSeatsHandler"]
            SeatMapQ["GetFlightSeatMapHandler"]
            SearchQ["SearchFlightsHandler"]
        end

        FlightAgg["Flight (Aggregate Root)\nSeat (Entity)\nSeatStatus: AVAILABLE→HELD→OCCUPIED"]
        SeatHoldPolicy["SeatHoldPolicy\n(15 min hold TTL)"]
        FlightRepoPort[["FlightRepositoryPort"]]
        PrismaFlightRepo["PrismaFlightRepository"]
        ExpireHoldsWorker["ExpireSeatHoldsWorker\n(@Cron EVERY_MINUTE)"]
    end

    subgraph ReservationCtx["Reservation Context"]
        direction TB
        ReservationController["ReservationController\n(HTTP)"]

        subgraph ResApp["Application Layer"]
            CreateResH["CreateReservationHandler"]
            ConfirmResH["ConfirmReservationHandler"]
            CancelResH["CancelReservationHandler"]
            ExpireResH["ExpirePendingReservationsHandler"]
        end

        ResAgg["Reservation (Aggregate Root)\nMoney (VO) · SeatAssignment (VO)\nStatus: PENDING→CONFIRMED/CANCELLED/EXPIRED"]
        HoldPolicy["ReservationHoldPolicy\n(15 min hold TTL)"]
        ResRepoPort[["ReservationRepositoryPort"]]
        PrismaResRepo["PrismaReservationRepository"]
        PaymentPort[["PaymentGatewayPort"]]
        MockPayment["MockPaymentAdapter"]
        ExpireResWorker["ExpirePendingReservationsWorker\n(@Cron EVERY_MINUTE)"]
    end

    Mongo[("MongoDB\n(Prisma)")]

    Client -->|"POST /flights/:id/holds\nDELETE .../holds/:holdId\nPOST .../holds/:holdId/confirm\nGET /flights, /flights/:id/seats"| FlightController
    Client -->|"POST /reservations\nPOST /reservations/:id/confirm\nPOST /reservations/:id/cancel"| ReservationController

    FlightController --> HoldSeatsH & ConfirmSeatsH & ReleaseSeatsH & SeatMapQ & SearchQ
    HoldSeatsH & ConfirmSeatsH & ReleaseSeatsH -.-> FlightAgg
    HoldSeatsH -.-> SeatHoldPolicy
    FlightAgg --> FlightRepoPort
    FlightRepoPort -.->|implements| PrismaFlightRepo
    PrismaFlightRepo --> Mongo
    ExpireHoldsWorker -->|"ReleaseSeatsCommand"| ReleaseSeatsH
    ExpireHoldsWorker --> FlightRepoPort

    ReservationController --> CreateResH & ConfirmResH & CancelResH
    CreateResH & ConfirmResH & CancelResH & ExpireResH -.-> ResAgg
    CreateResH -.-> HoldPolicy
    ResAgg --> ResRepoPort
    ResRepoPort -.->|implements| PrismaResRepo
    PrismaResRepo --> Mongo
    ConfirmResH --> PaymentPort
    PaymentPort -.->|implements| MockPayment
    ExpireResWorker -->|"ExpirePendingReservationsCommand"| ExpireResH

    CreateResH ==>|"QueryBus:\nGetFlightSeatMapQuery"| SeatMapQ
    ConfirmResH ==>|"CommandBus:\nConfirmSeatsCommand"| ConfirmSeatsH
    ExpireResH ==>|"CommandBus:\nReleaseSeatsCommand"| ReleaseSeatsH
    CancelResH ==>|"CommandBus:\nReleaseSeatsCommand"| ReleaseSeatsH

    HoldSeatsH -.->|"EventEmitter2:\nSeatsHeld"| EventBus(["Domain Event Bus\n(EventEmitter2)"])
    ConfirmSeatsH -.->|"SeatsConfirmed"| EventBus
    ReleaseSeatsH -.->|"SeatsReleased"| EventBus
    CreateResH -.->|"ReservationCreated"| EventBus
    ConfirmResH -.->|"ReservationConfirmed"| EventBus
    CancelResH -.->|"ReservationCancelled"| EventBus
    ExpireResH -.->|"ReservationExpired"| EventBus

    classDef ctx fill:#eef2ff,stroke:#4338ca,color:#1e1b4b;
    classDef agg fill:#fef3c7,stroke:#b45309,color:#451a03;
    classDef port fill:#dcfce7,stroke:#15803d,color:#052e16;
    classDef infra fill:#f1f5f9,stroke:#475569,color:#0f172a;
    class FlightCtx,ReservationCtx ctx;
    class FlightAgg,ResAgg agg;
    class FlightRepoPort,ResRepoPort,PaymentPort port;
    class Mongo,PrismaFlightRepo,PrismaResRepo,MockPayment infra;
```

**Legend**: solid arrows (`-->`) are direct dependencies within a layer;
double arrows (`==>`) are **cross-context CQRS calls**; dotted arrows
(`-.->`) are domain-event emissions or "implements port" relationships.

---

## 2. End-to-End Booking Sequence

The booking flow is a **2-step checkout**: hold seats, then create and
confirm a reservation against that hold. `CreateReservationHandler`
re-prices every seat via `GetFlightSeatMapQuery` rather than trusting
client-supplied prices, and `ConfirmReservationHandler` charges payment
before dispatching `ConfirmSeatsCommand` to flip the held seats to
`OCCUPIED`.

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant FlightCtrl as FlightController
    participant HoldH as HoldSeatsHandler
    participant FlightAgg as Flight Aggregate
    participant ResCtrl as ReservationController
    participant CreateH as CreateReservationHandler
    participant QueryBus
    participant SeatMapH as GetFlightSeatMapHandler
    participant ResAgg as Reservation Aggregate
    participant ConfirmH as ConfirmReservationHandler
    participant Payment as PaymentGatewayPort
    participant CmdBus as CommandBus
    participant ConfirmSeatsH as ConfirmSeatsHandler

    rect rgb(240, 248, 255)
    Note over Client, FlightAgg: Step 1 — Hold Seats
    Client->>FlightCtrl: POST /flights/:id/holds
    FlightCtrl->>HoldH: HoldSeatsCommand
    HoldH->>FlightAgg: holdSeats(seatNumbers, holdId, now)
    FlightAgg-->>HoldH: expiresAt (seats → HELD)
    HoldH-->>FlightCtrl: HoldSeatsResult { expiresAt }
    FlightCtrl-->>Client: 201 { holdId, expiresAt }
    end

    rect rgb(255, 250, 240)
    Note over Client, ResAgg: Step 2 — Create Reservation (PENDING)
    Client->>ResCtrl: POST /reservations { flightId, holdId, seatAssignments }
    ResCtrl->>CreateH: CreateReservationCommand
    CreateH->>QueryBus: GetFlightSeatMapQuery(flightId)
    QueryBus->>SeatMapH: execute()
    SeatMapH-->>CreateH: FlightSeatMapDto (authoritative prices)
    CreateH->>ResAgg: Reservation.create(seatAssignments, prices, holdExpiresAt)
    ResAgg-->>CreateH: Reservation { status: PENDING }
    CreateH-->>ResCtrl: CreateReservationResult
    ResCtrl-->>Client: 201 { reservationId, status: PENDING, totalPrice }
    end

    rect rgb(240, 255, 244)
    Note over Client, ConfirmSeatsH: Step 3 — Confirm & Pay
    Client->>ResCtrl: POST /reservations/:id/confirm { paymentMethodToken }
    ResCtrl->>ConfirmH: ConfirmReservationCommand
    ConfirmH->>Payment: charge({ amount, currency, paymentMethodToken })
    alt payment declined
        Payment-->>ConfirmH: { success: false, failureReason }
        ConfirmH-->>ResCtrl: throws PaymentFailedException
        ResCtrl-->>Client: 4xx (reservation stays PENDING, no seats touched)
    else payment succeeds
        Payment-->>ConfirmH: { success: true, paymentId }
        ConfirmH->>ResAgg: reservation.confirm(paymentId, now)
        Note right of ResAgg: In-memory only — not yet persisted
        ConfirmH->>CmdBus: ConfirmSeatsCommand { flightId, holdId }
        CmdBus->>ConfirmSeatsH: execute()
        ConfirmSeatsH->>FlightAgg: confirmSeats(holdId, now)
        alt hold expired / not found
            FlightAgg-->>ConfirmSeatsH: throws HoldNotFoundException / SeatHoldExpiredException
            ConfirmSeatsH-->>ConfirmH: propagates error
            ConfirmH->>Payment: refund({ paymentId, amount, currency, reason })
            alt refund succeeds
                Payment-->>ConfirmH: { success: true, refundId }
                Note over ConfirmH,Payment: Compensating refund issued.<br/>reservation.save() never runs — reservation<br/>remains PENDING in the DB.
            else refund fails
                Payment-->>ConfirmH: { success: false, failureReason }
                Note over ConfirmH,Payment: ⚠️ Refund also failed — payment stays captured<br/>and reservation stays PENDING. Manual<br/>reconciliation required.
            end
            ConfirmH-->>ResCtrl: throws SeatConfirmationFailedException { refunded }
            ResCtrl-->>Client: 409 (reservation stays PENDING; refund attempted)
        else seats confirmed
            FlightAgg-->>ConfirmSeatsH: seats → OCCUPIED, SeatsConfirmed event
            ConfirmSeatsH-->>ConfirmH: ConfirmSeatsResult
            ConfirmH->>ResAgg: reservationRepository.save(reservation)
            Note right of ResAgg: Optimistic Concurrency Control:\nupdateMany({domainId, version}) must match 1 row
            ResAgg-->>ConfirmH: persisted, version incremented
            ConfirmH-->>ResCtrl: ConfirmReservationResult { status: CONFIRMED }
            ResCtrl-->>Client: 200 { reservationId, status: CONFIRMED, paymentId }
        end
    end
    end
```

### Compensating flows

| Trigger | Command dispatched | Effect |
|---|---|---|
| Client cancels a `PENDING`/unconfirmed reservation | `CancelReservationCommand` → `ReleaseSeatsCommand` | `Reservation` → `CANCELLED`; held seats → `AVAILABLE` |
| `ExpirePendingReservationsWorker` (cron, every minute) finds `PENDING` reservations past `holdExpiresAt` | `ExpirePendingReservationsCommand` → `ReleaseSeatsCommand` per reservation | `Reservation` → `EXPIRED`; held seats → `AVAILABLE` |
| `ExpireSeatHoldsWorker` (cron, every minute) finds `Flight` documents with `HELD` seats past `holdExpiresAt` | `ReleaseSeatsCommand` per expired hold | Seats → `AVAILABLE`, independent of reservation state (covers holds that never became a reservation) |
| `ConfirmSeatsCommand` fails after payment capture (e.g. hold expired) | `ConfirmReservationHandler` calls `PaymentGatewayPort.refund()` directly (no command/event) | Reservation stays `PENDING` (never persisted as `CONFIRMED`); payment refunded if the refund succeeds. `SeatConfirmationFailedException` (409) is thrown either way, carrying a `refunded: boolean` flag — if the refund itself fails, manual reconciliation is still required |

---

## 3. State Machines

### 3.1 Flight Seat Status

Enforced inside the `Flight` aggregate (`flight.aggregate.ts`); seats are
entities embedded in the `Flight` document, keyed by seat number.

```mermaid
stateDiagram-v2
    [*] --> AVAILABLE: Flight.create()

    AVAILABLE --> HELD: HoldSeatsCommand\n(Flight.holdSeats)
    HELD --> OCCUPIED: ConfirmSeatsCommand\n(Flight.confirmSeats)
    HELD --> AVAILABLE: ReleaseSeatsCommand\n(Flight.releaseSeats)\ntriggered by Cancel / Expire / TTL sweep

    OCCUPIED --> [*]

    note right of HELD
        Held seats carry holdId + holdExpiresAt
        (default TTL: 15 min, SeatHoldPolicy).
        confirmSeats() throws SeatHoldExpiredException
        if now > holdExpiresAt.
    end note

    note right of AVAILABLE
        releaseSeats() is idempotent: releasing
        a holdId that owns no seats is a no-op,
        safe to retry (e.g. DELETE .../holds/:holdId).
    end note
```

### 3.2 Reservation Status

Enforced inside the `Reservation` aggregate (`reservation.aggregate.ts`).

```mermaid
stateDiagram-v2
    [*] --> PENDING: CreateReservationCommand\n(Reservation.create)

    PENDING --> CONFIRMED: ConfirmReservationCommand\n(Reservation.confirm)\nrequires successful PaymentGatewayPort.charge()
    PENDING --> EXPIRED: ExpirePendingReservationsCommand\n(Reservation.expire)\ncron sweep, now >= holdExpiresAt
    PENDING --> CANCELLED: CancelReservationCommand\n(Reservation.cancel)

    CONFIRMED --> [*]
    EXPIRED --> [*]
    CANCELLED --> [*]

    note right of CONFIRMED
        confirm() throws ReservationExpiredException
        if now > holdExpiresAt, and
        InvalidReservationStatusTransitionException
        if status is not PENDING.
    end note

    note right of CANCELLED
        cancel() throws ReservationAlreadyConfirmedException
        whenever status === CONFIRMED, so only PENDING
        reservations can be cancelled today — a paid,
        CONFIRMED reservation has no cancel/refund path yet.
    end note
```

---

## 4. Architecture Narrative & Key Highlights

- **Strict Bounded Context boundaries.** `Flight` and `Reservation` are
  separate NestJS modules, each with its own controllers, aggregates,
  repositories, and Prisma models. They never import each other's
  repositories or aggregates directly — the only sanctioned integration
  points are `CommandBus.execute()` / `QueryBus.execute()` calls (e.g.
  `CreateReservationHandler` calling `GetFlightSeatMapQuery`) and
  `EventEmitter2` domain events. This keeps each context independently
  testable and free to evolve its persistence model without rippling into
  the other.

- **Reservation duplicates the hold-duration policy on purpose.**
  `ReservationHoldPolicy` mirrors `SeatHoldPolicy`'s 15-minute TTL rather
  than reading it from the Flight module, because `FlightSeatMapDto`
  deliberately does not expose raw hold-expiry internals across the
  context boundary. A small amount of duplicated business knowledge is
  accepted here in exchange for not leaking one context's internals into
  another's public contract.

- **Snapshotting immutable financial values (`Money` VO).**
  `CreateReservationHandler` resolves *authoritative* seat prices from
  `GetFlightSeatMapQuery` — never trusting client-supplied amounts — and
  freezes them into `Money` value objects (integer minor units, e.g. cents)
  at reservation-creation time. Once captured in `SeatAssignment.price`,
  that snapshot is immutable and independent of any later change to the
  flight's catalog pricing, so a customer's confirmed price never drifts.

- **Optimistic Concurrency Control (OCC) on both aggregates.**
  Both `FlightModel` and `ReservationModel` carry a `version` field.
  `PrismaFlightRepository.save()` / `PrismaReservationRepository.save()`
  issue a conditional `updateMany({ where: { domainId, version } })`; if a
  concurrent writer already bumped the version, zero documents match and a
  `ConcurrencyConflictException` is thrown instead of silently clobbering
  the other writer's changes — critical for guarding against double-booking
  the same seat under concurrent hold/confirm requests.

- **Hexagonal Ports & Adapters decoupling.** Domain and application logic
  depend only on interfaces — `FlightRepositoryPort`,
  `ReservationRepositoryPort`, `PaymentGatewayPort` — injected via NestJS
  DI tokens (`FLIGHT_REPOSITORY_PORT`, `RESERVATION_REPOSITORY_PORT`,
  `PAYMENT_GATEWAY_PORT`). Concrete adapters (`PrismaFlightRepository`,
  `PrismaReservationRepository`, `MockPaymentAdapter`) are wired only in
  each module's `providers`, so persistence (MongoDB/Prisma) and third-party
  payment integrations can be swapped without touching a single aggregate
  or handler.

- **CQRS as the in-process integration bus.** Every write goes through a
  `Command` + `CommandHandler` pair and every cross-context read goes
  through a `Query` + `QueryHandler` pair via `@nestjs/cqrs`'s
  `CommandBus`/`QueryBus`. This gives the modular monolith the same
  command/query vocabulary it would need if `Flight` and `Reservation`
  were ever split into separate services communicating over the network —
  the extraction boundary is already drawn in code, not just in diagrams.

- **Domain events are fire-and-forget side channels, not the write path.**
  Aggregates queue events (`SeatsHeld`, `SeatsConfirmed`, `SeatsReleased`,
  `ReservationCreated`, `ReservationConfirmed`, `ReservationCancelled`,
  `ReservationExpired`) via `pullDomainEvents()`, and handlers emit them
  through `EventEmitter2` only *after* the aggregate has been persisted.
  State transitions themselves always happen synchronously inside the
  command handler that owns them (e.g. `ConfirmReservationHandler`
  synchronously dispatches `ConfirmSeatsCommand` rather than reacting to a
  `ReservationConfirmed` event) — this keeps the booking flow's critical
  path free of eventual-consistency races, while still giving downstream
  concerns (notifications, analytics, loyalty) a place to listen in.

- **Idempotent compensation for cleanup workers.** `Flight.releaseSeats()`
  is a no-op when the given `holdId` owns no seats, so both
  `ExpireSeatHoldsWorker` and the `ReleaseSeatsCommand` dispatched from
  `CancelReservationHandler` / `ExpirePendingReservationsHandler` can be
  retried safely after a crash or a duplicate cron tick without raising
  spurious errors. Both scheduled workers additionally guard against
  overlapping runs with an in-memory `isRunning` flag and continue past
  individual per-aggregate failures so one bad record can't stall an
  entire sweep.

- **Compensating refund when seat confirmation fails post-payment.**
  In `ConfirmReservationHandler`, `PaymentGatewayPort.charge()` is called
  *before* `ConfirmSeatsCommand` is dispatched. If the payment succeeds but
  `ConfirmSeatsCommand` subsequently fails (e.g. the hold expired between
  the two calls), the handler immediately calls `PaymentGatewayPort.refund()`
  to reverse the captured charge, then throws a `SeatConfirmationFailedException`
  (mapped to HTTP 409 in `ReservationExceptionFilter`) carrying a
  `refunded: boolean` flag so callers can distinguish a successfully
  compensated failure from one that still needs manual reconciliation. The
  reservation is never persisted on this path — it remains `PENDING` in the
  DB regardless of whether the refund itself succeeded, since only the
  seat-confirmation success path reaches `reservationRepository.save()`.
  This is a best-effort, synchronous compensation (not a Saga/outbox) — a
  process crash between `charge()` and `refund()` is still unrecovered.
