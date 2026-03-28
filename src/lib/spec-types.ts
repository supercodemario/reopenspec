import type { BaselineNodeKind } from './baseline.js'

/** Root `api-contracts.json` for a feature (Stage 2). */
export type ApiContractsFile = {
  version: '0.2.0'
  contracts: ApiContract[]
}

export type ApiContract = {
  /** Stable id referenced by tooling and drift reports. */
  id: string
  mapsTo: {
    /** Project-relative POSIX path (e.g. `src/foo.ts`). */
    file: string
    /** Exported symbol name (`Scan` for `export default class Scan`). */
    symbol: string
    kind: BaselineNodeKind
  }
  /**
   * If set, any import in `mapsTo.file` whose module specifier starts with one of these strings is drift.
   * Example: `["lodash"]` to forbid importing lodash from that file.
   */
  forbidsImports?: string[]
}

export type LoadedFeatureSpec = {
  featureSlug: string
  specDir: string
  apiContractsPath: string
  api: ApiContractsFile
}
