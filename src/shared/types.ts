export interface RepoInfo {
  owner: string
  repo: string
  defaultBranch: string
  sha: string  // SHA do último commit (para cache)
}

export interface FileEntry {
  path: string
  size: number  
  url: string 
}

export interface CollectedContext {
  repoInfo: RepoInfo
  files: Array<{ path: string; content: string }>
  totalTokensEstimate: number
}

export interface DimensionScores {
  tests: number
  security: number
  architecture: number
  codeQuality: number
  documentation: number
  consistency: number
  maintainability: number
}

export interface DimensionReasoning {
  tests: string
  security: string
  architecture: string
  codeQuality: string
  documentation: string
  consistency: string
  maintainability: string
}

export interface AnalysisResult {
  score: number                    // 0–100, computed from dimensionScores
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  dimensionScores: DimensionScores
  reasoning: DimensionReasoning
  summary: string
  strengths: string[]
  weaknesses: string[]
  inconsistencies: string[]
  architecture: {
    rating: 'excellent' | 'good' | 'fair' | 'poor'
    notes: string
  }
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low'
    text: string
  }>
  techStack: string[]
  securityFlags: string[]
}

export type MessageType =
  | { type: 'ANALYZE_REPO'; owner: string; repo: string }
  | { type: 'ANALYSIS_PROGRESS'; step: string; percent: number }
  | { type: 'ANALYSIS_COMPLETE'; result: AnalysisResult }
  | { type: 'ANALYSIS_ERROR'; error: string; requiresApiKey?: boolean }
  | { type: 'GET_STATUS' }
  | { type: 'STATUS'; systemKeyUsed: boolean; hasUserKey: boolean }

export interface StorageState {
  systemKeyUsed: boolean
  freeTierDisabled: boolean
  userApiKey: string | null
  geminiModel: string
  deepMode: boolean
  analysisCount: number
  cache: Record<string, AnalysisResult>      // key: "owner/repo@sha"
  lastResults: Record<string, AnalysisResult> // key: "owner/repo"
  blobCache: Record<string, string>          // key: raw CDN URL, value: file content
}