export type UserRole = 'admin' | 'operator' | 'auditor'

export interface User {
  id: string
  username: string
  displayName: string
  role: UserRole
  status?: 'active' | 'disabled'
  createdAt?: string
  updatedAt?: string
  lastLoginAt?: string | null
}

export interface SignatureItem {
  id: string
  createdAt: string
  receivedAt: string
  terminalId: string
  traceId?: string | null
  displayName?: string | null
  userNo?: string | null
  identityType?: string | null
  className?: string | null
  templateId?: string | null
  durationMs: number
  strokeCount: number
  pointCount: number
  pathLength: number
  status: 'active' | 'archived' | 'deleted'
  syncState: string
  archivedAt?: string | null
  deletedAt?: string | null
  reviewStatus: 'pending' | 'approved' | 'rejected'
  reviewedAt?: string | null
  reviewedBy?: string | null
  reviewNote?: string | null
  wallVisible: boolean
  wallPublishedAt?: string | null
  thumbnailUrl: string
  previewUrl: string
  hasJpg: boolean
}

export interface SignatureDetail extends SignatureItem {
  metadata: Record<string, unknown>
  files: Record<string, string>
}

export interface Pagination {
  page: number
  pageSize: number
  total: number
  pages: number
}

export interface DashboardData {
  counts: { total: number; today: number; week: number; archived: number; pendingReview: number; onWall: number }
  series: Array<{ hour: string; count: number }>
  terminals: { total: number; online: number }
  postcards: { total: number; today: number }
  printJobs: { waiting: number; succeeded: number; failed: number }
  recent: SignatureItem[]
}

export interface Terminal {
  id: string
  name: string
  location: string
  status: 'online' | 'offline'
  lastSeenAt?: string | null
  appVersion?: string | null
  queueCount: number
  ipAddress?: string | null
  createdAt: string
}

export interface AuditLog {
  id: number
  username: string
  action: string
  entityType: string
  entityId?: string | null
  detail: Record<string, unknown>
  ipAddress?: string | null
  createdAt: string
}

export interface SystemSettings {
  retention_days: number
  auto_archive_days: number
  online_threshold_seconds: number
  school_name: string
  wall_layout: 'brick' | 'float'
  wall_title: string
  wall_refresh_seconds: number
  wall_rotation_seconds: number
  postcard_session_timeout_seconds: number
  postcard_result_retention_days: number
  postcard_original_retention_hours: number
  postcard_max_print_copies: number
  postcard_min_print_interval_seconds: number
}

export interface PostcardItem {
  id: string
  createdAt: string
  receivedAt: string
  terminalId: string
  traceId?: string | null
  signatureId?: string | null
  templateId: string
  templateName?: string | null
  sender?: string | null
  graduationYear?: string | null
  message?: string | null
  status: 'active' | 'archived' | 'deleted'
  archivedAt?: string | null
  deletedAt?: string | null
    previewUrl: string
    imageUrl: string
    pickupUrl: string
  }

export interface PrintJobItem {
  id: string
  postcardId: string
  terminalId: string
  printerName?: string | null
  status: 'created' | 'queued' | 'processing' | 'succeeded' | 'failed' | 'paused' | 'cancelled' | 'archived'
  copies: number
  retryCount: number
  errorCode?: string | null
  errorMessage?: string | null
  createdAt: string
  updatedAt: string
  previewUrl: string
}

export interface PostcardTemplateItem {
  id: string
  group: string
  name: string
  year: string
  title: string
  subtitle: string
  background: string
  ink: string
  accent: string
  muted: string
  motif: 'rings' | 'grid' | 'mountain' | 'window' | 'stamp'
  enabled: boolean
  order: number
  custom: Record<string, unknown>
  updatedAt: string
}
