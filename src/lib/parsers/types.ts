import type { BaselineNode, BaselineEdge } from '../baseline.js';

export interface ParserAdapter {
  language: string;
  profileName: string;
  extensions: string[];
  ignore: string[];
  scanAsync: (absPath: string, workspaceRoot: string) => Promise<{ nodes: BaselineNode[]; edges: BaselineEdge[] }>;
}
