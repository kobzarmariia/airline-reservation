# OpenFlights reference data

`airports.dat`, `airlines.dat`, and `routes.dat` are taken verbatim from the
[OpenFlights](https://openflights.org/data.html) project
([github.com/jpatokal/openflights](https://github.com/jpatokal/openflights)),
used here as realistic reference data to seed flights (`prisma/seed.ts`) and
the Elasticsearch flight search index (`src/modules/flight/infrastructure/search`).

Parsing lives in `prisma/openflights/parse-openflights.ts`; the column
layout for each file is documented there.

This data is licensed under the [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/).
