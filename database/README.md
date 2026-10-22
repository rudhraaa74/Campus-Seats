# database/

PostgreSQL scripts for SeatSync. This is the core of the project — the schema and the business rules live here, not in application code.

## Run order

Schema files are numbered and must be applied in order:

```
schema/
├── 01_extensions.sql      # btree_gist
├── 02_tables.sql          # 15 tables with PK, FK, UNIQUE, NOT NULL, CHECK
├── 03_indexes.sql         # partial unique indexes, EXCLUDE, search indexes
├── 04_functions.sql       # expire_holds() and helpers
├── 05_triggers.sql        # business-rule triggers
└── 06_views.sql           # v_venue_capacity + reporting views
```

## Quick start

```bash
# From the project root (requires Docker running):
docker compose up -d

# Apply schema only:
./database/scripts/apply.sh

# Apply schema + seed data:
./database/scripts/apply.sh --seed

# Full reset (drop → create → apply → seed):
./database/scripts/reset.sh --seed
```

## Seed data

| File | Contents |
|---|---|
| `seed/01_reference.sql` | Venues, seats, categories, clubs, club managers |
| `seed/02_demo.sql` | Small hand-written dataset for development |
| `seed/generate_seed.js` | Generator for the 500+ record submission dataset |

## Relations

`users`, `student`, `faculty`, `guest`, `club`, `club_manager`, `venue`, `seat_category`, `seat`, `event`, `show`, `show_price`, `booking`, `ticket`, `payment`

## Requirements

- PostgreSQL 15+
- The `btree_gist` extension (created by `01_extensions.sql`)

## Tests

Each file in `tests/` runs inside a transaction, tries to violate a business rule, and expects a specific error:

```bash
./database/tests/run_all.sh
```

## Rules enforced here

| Rule | Mechanism |
|---|---|
| No double booking | Partial `UNIQUE` index on live tickets |
| No overlapping shows in a venue | `EXCLUDE` constraint |
| Ticket, show, venue and seat stay consistent | Composite foreign keys |
| Ticket limits, pricing, booking window, cancellation | Triggers |
| One successful payment per booking | Partial `UNIQUE` index |
