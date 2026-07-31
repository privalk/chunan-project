export type AppStep = 'welcome' | 'source' | 'compose' | 'preview' | 'result' | 'operator'
export type OutputFormat = 'png' | 'jpeg' | 'pdf'
export type PrintStatus = 'queued' | 'processing' | 'succeeded' | 'failed' | 'paused' | 'cancelled'
export type AssetKind = 'photo' | 'signature'

export interface SignatureChoice {
  id: string
  displayName: string
  identityType: string
  identityLabel: string
  className?: string | null
  createdAt: string
  imageUrl: string
}

export interface PostcardTemplate {
  id: string
  group: '校史年代' | '校园印象' | '节庆纪念'
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
}

export interface Transform {
  x: number
  y: number
  scale: number
}

export interface PostcardDraft {
  id: string
  traceId: string
  createdAt: string
  templateId: string
  message: string
  sender: string
  graduationYear: string
  photoDataUrl: string
  signature: SignatureChoice | null
  photo: Transform
  signatureTransform: Transform
}

export interface PostcardArtifacts {
  draft: PostcardDraft
  pngDataUrl: string
  jpegDataUrl: string
  thumbnailDataUrl: string
}

export interface PrintJob {
  id: string
  draftId: string
  templateName: string
  createdAt: string
  updatedAt: string
  status: PrintStatus
  copies: number
  attempts: number
  printerDeviceName?: string
  printerName?: string
  remoteRegistered?: boolean
  error?: string
  previewDataUrl: string
}

export interface PrinterStatus {
  name: string
  deviceName: string
  isDefault: boolean
}

export interface RemotePrintJob {
  id: string
  postcardId: string
  templateId?: string | null
  copies: number
  createdAt: string
  imageUrl: string
}

export interface LocalSettings {
  sessionTimeoutSeconds: number
  maxPrintCopies: number
  minPrintIntervalSeconds: number
  originalRetentionHours: number
  resultRetentionDays: number
  preferredPrinterDeviceName: string
}

export interface ElectronPostcardApi {
  savePostcard(payload: PostcardArtifacts): Promise<{ ok: boolean; path?: string; pickupUrl?: string }>
  exportPostcard(payload: { id: string; format: OutputFormat; dataUrl?: string }): Promise<{ ok: boolean; path?: string; cancelled?: boolean }>
  printPostcard(payload: { jobId: string; draftId: string; copies: number; printerName: string }): Promise<{ ok: boolean; error?: string }>
  cachePostcardImage(payload: { draftId: string; dataUrl: string; createdAt: string }): Promise<{ ok: boolean; path?: string }>
  createPhotoUpload(): Promise<{ token: string; url: string; expiresAt: string }>
  pollPhotoUpload(token: string): Promise<{ status: 'pending' | 'ready' | 'expired'; dataUrl?: string }>
  cancelPhotoUpload(token: string): Promise<boolean>
  getPrinters(): Promise<PrinterStatus[]>
  enterFullscreen(): Promise<boolean>
  openOperatorWindow(): Promise<boolean>
  closeOperatorWindow(): Promise<boolean>
}

declare global {
  interface Window {
    postcardTerminal?: ElectronPostcardApi
  }
}
