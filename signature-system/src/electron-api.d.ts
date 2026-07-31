import type { SaveResult, SignatureArtifacts } from './types/signature'

declare global {
  interface Window {
    signatureTerminal?: {
      saveSignature: (payload: SignatureArtifacts) => Promise<SaveResult>
      enterFullscreen: () => Promise<boolean>
    }
  }
}

export {}
