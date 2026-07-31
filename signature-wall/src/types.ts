export interface WallItem {
  id: string
  imageUrl: string
  displayName: string
  identity: string
  identityLabel: string
  createdAt: string
  publishedAt: string | null
}

export interface WallPayload {
  title: string
  schoolName: string
  layout: 'brick' | 'float'
  refreshSeconds: number
  rotationSeconds: number
  generatedAt: string
  items: WallItem[]
}
