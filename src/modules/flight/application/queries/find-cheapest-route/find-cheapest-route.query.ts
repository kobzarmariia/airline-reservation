export interface FindCheapestRouteQueryProps {
  readonly origin: string;
  readonly destination: string;
  readonly maxStops: number;
}

export class FindCheapestRouteQuery {
  readonly origin: string;
  readonly destination: string;
  readonly maxStops: number;

  constructor(props: FindCheapestRouteQueryProps) {
    this.origin = props.origin;
    this.destination = props.destination;
    this.maxStops = props.maxStops;
    Object.freeze(this);
  }
}
