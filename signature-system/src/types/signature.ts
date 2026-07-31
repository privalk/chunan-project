export interface SignaturePoint {
  x: number
  y: number
  pressure: number
  time: number
}

export interface SignatureStroke {
  stroke_id: string
  color: string
  width: number
  points: SignaturePoint[]
}

export type SignatureIdentityType = 'anonymous' | 'student' | 'teacher' | 'alumni' | 'visitor'

export interface SignatureContext {
  display_name?: string
  user_no?: string
  identity_type: SignatureIdentityType
  class_name?: string
  template_id: string
}

export interface SignatureRecord {
  id: string
  trace_id: string
  created_at: string
  terminal_id: string
  canvas_ratio: number
  duration_ms: number
  context: SignatureContext
  strokes: SignatureStroke[]
  metrics: {
    stroke_count: number
    point_count: number
    normalized_path_length: number
  }
}

export interface SignatureArtifacts {
  record: SignatureRecord
  svg: string
  displayPng: string
  displayJpg: string
  printPng: string
  thumbnailPng: string
}

export interface SaveResult {
  ok: boolean
  path?: string
  synced?: boolean
}
