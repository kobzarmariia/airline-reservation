import { readFileSync } from 'fs';

// Minimal reader for OpenFlights' CSV-ish .dat files: fields are
// comma-separated, text fields are double-quoted, and quotes never contain
// escaped quotes in this dataset, so a simple quote-aware split is enough —
// no need for a full CSV parsing dependency.
function parseLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  fields.push(current);
  return fields;
}

function readLines(filePath: string): string[] {
  return readFileSync(filePath, 'utf-8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

const NULL_FIELD = '\\N';

export interface OpenFlightsAirport {
  readonly iata: string;
  readonly name: string;
  readonly city: string;
  readonly country: string;
}

// Source: https://github.com/jpatokal/openflights/blob/master/data/airports.dat
// Columns: Airport ID, Name, City, Country, IATA, ICAO, Lat, Lon, Alt,
// Timezone, DST, Tz database timezone, Type, Source.
export function parseAirports(
  filePath: string,
): Map<string, OpenFlightsAirport> {
  const airports = new Map<string, OpenFlightsAirport>();

  for (const line of readLines(filePath)) {
    const fields = parseLine(line);
    const [, name, city, country, iata] = fields;

    if (!iata || iata === NULL_FIELD || iata.length !== 3) {
      continue;
    }

    airports.set(iata, { iata, name, city, country });
  }

  return airports;
}

export interface OpenFlightsAirline {
  readonly iata: string;
  readonly name: string;
}

// Source: https://github.com/jpatokal/openflights/blob/master/data/airlines.dat
// Columns: Airline ID, Name, Alias, IATA, ICAO, Callsign, Country, Active.
export function parseAirlines(
  filePath: string,
): Map<string, OpenFlightsAirline> {
  const airlines = new Map<string, OpenFlightsAirline>();

  for (const line of readLines(filePath)) {
    const fields = parseLine(line);
    const [, name, , iata] = fields;

    if (!iata || iata === NULL_FIELD || iata.length !== 2) {
      continue;
    }
    // Several defunct/placeholder entries share an IATA code; keep the
    // first (OurAirports/OpenFlights lists active carriers first).
    if (!airlines.has(iata)) {
      airlines.set(iata, { iata, name });
    }
  }

  return airlines;
}

export interface OpenFlightsRoute {
  readonly airlineIata: string;
  readonly originIata: string;
  readonly destinationIata: string;
}

// Source: https://github.com/jpatokal/openflights/blob/master/data/routes.dat
// Columns: Airline, Airline ID, Source airport, Source airport ID,
// Destination airport, Destination airport ID, Codeshare, Stops, Equipment.
export function parseRoutes(filePath: string): OpenFlightsRoute[] {
  const routes: OpenFlightsRoute[] = [];

  for (const line of readLines(filePath)) {
    const fields = parseLine(line);
    const [airlineIata, , originIata, , destinationIata, , , stops] = fields;

    if (
      !airlineIata ||
      airlineIata === NULL_FIELD ||
      !originIata ||
      originIata === NULL_FIELD ||
      !destinationIata ||
      destinationIata === NULL_FIELD ||
      originIata === destinationIata ||
      stops !== '0' // non-direct routes have no single departure/arrival pair
    ) {
      continue;
    }

    routes.push({ airlineIata, originIata, destinationIata });
  }

  return routes;
}
