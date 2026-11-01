export * as slopScanner from './slop-scanner';
export * as testLock from './test-lock';
export * as packageGate from './package-gate';
export * as circuitBreaker from './circuit-breaker';
export * as runtimeGuard from './runtime-guard';
export * as specContractor from './spec-contractor';
export * as astPruner from './ast-pruner';
export * as agentGuard from './agent-guard';

export { scanSource } from './slop-scanner';
export type { Diagnostic } from './slop-scanner';
export { fingerprintTests, verifyTests, verifyAssertionQuality, lockTestFile, verifyTestFile } from './test-lock';
export type { TestViolation, TestFileFingerprint } from './test-lock';
export { checkPackage, checkPackages, checkPackageManifest, parseInstallCommand, checkInstallScript } from './package-gate';
export type { PackageReport, Verdict, ScriptFindings } from './package-gate';
export { CircuitBreaker, countChangedLines, saveState, loadState } from './circuit-breaker';
export type { BreakerOptions, BreakerState } from './circuit-breaker';
export { CircuitBreakerTrippedError } from './circuit-breaker';
export { guardSource } from './runtime-guard';
export { parseSpecFile, verifySpec, runSpecCheck } from './spec-contractor';
export type { SpecViolation } from './spec-contractor';
export { pruneSource, pruneFiles } from './ast-pruner';
export { agentGuardScan } from './agent-guard';
export * as designSlop from './design-slop';
export { scanDesignSlop, designSlopScan } from './design-slop';
export type { Diagnostic as DesignSlopDiagnostic } from './design-slop';
export * as proseSlop from './prose-slop';
export { scanProse, analyzeProse, isProseFile } from './prose-slop';
export type { ProseScanResult, ProseMetrics } from './prose-slop';
export * as uxGuard from './ux-guard';
export { scanUx, UX_RULES, UX_RULE_IDS } from './ux-guard';
export * as degradation from './degradation';
export {
  analyzeFile,
  analyzeProject,
  compareBaseline,
  saveBaseline,
  loadBaseline,
  HUMAN_EROSION_BASELINE,
  HUMAN_VERBOSITY_BASELINE,
  AGENT_EROSION_BASELINE,
  AGENT_VERBOSITY_BASELINE,
} from './degradation';
export type { FileMetrics, FunctionMetric, ProjectMetrics, BaselineDelta } from './degradation';
