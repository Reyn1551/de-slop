export type { Ecosystem, Verdict, PackageReport, GateOptions } from './types';
export { decideVerdict } from './verdict';
export type { PackageInfo, VerdictResult } from './verdict';
export { fetchNpmInfo, fetchNpmDownloads, fetchPypiInfo } from './registry';
export { checkPackage, checkPackages, checkPackageManifest } from './gate';
export type { ScriptFindings } from './gate';
export { parseInstallCommand, checkInstallScript } from './intercept';
export type { InstallCommand } from './intercept';
