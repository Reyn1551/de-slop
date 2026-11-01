export type { BaselineDelta, FileMetrics, FunctionMetric, ProjectMetrics } from './types';
export { analyzeFile, analyzeProject } from './analyze';
export {
  AGENT_EROSION_BASELINE,
  AGENT_VERBOSITY_BASELINE,
  HUMAN_EROSION_BASELINE,
  HUMAN_VERBOSITY_BASELINE,
  compareBaseline,
  loadBaseline,
  saveBaseline,
} from './baseline';
