export interface DesignContract {
  path: string;
  version: string;
  /** token name -> normalized sRGB hex `#rrggbb` */
  colors: Map<string, string>;
  /** token name -> font family list, first family first */
  typography: Map<string, string>;
  /** token name -> pixel value as a plain number string */
  rounded: Map<string, string>;
  /** sections the author declared as intentionally absent */
  omitted: string[];
  raw: string;
}

export interface DesignExemptions {
  colors: Set<string>;
  fonts: Set<string>;
  radii: Set<string>;
}

export interface ContractParseError {
  path: string;
  message: string;
}

export interface DriftOptions {
  /** How often a value must appear before an undeclared use counts as drift. */
  minimumOccurrences?: number;
}

export interface DriftFinding {
  kind: 'color' | 'font' | 'radius';
  value: string;
  occurrences: number;
  message: string;
  line: number;
  column: number;
}

export const DEFAULT_MINIMUM_OCCURRENCES = 3;
