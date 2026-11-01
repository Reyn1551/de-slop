export interface FunctionMetric {
  name: string;
  startLine: number;
  cyclomatic: number;
  sloc: number;
  mass: number;
}

export interface FileMetrics {
  filePath: string;
  loc: number;
  sloc: number;
  functions: FunctionMetric[];
  erosion: number;
  verbosity: number;
  flaggedLines: number[];
  cloneLines: number[];
  maxCyclomatic: number;
}

export interface ProjectMetrics {
  files: FileMetrics[];
  loc: number;
  sloc: number;
  functionCount: number;
  erosion: number;
  verbosity: number;
}

export interface BaselineDelta {
  erosion: number;
  verbosity: number;
  loc: number;
  degrading: boolean;
  reasons: string[];
}
