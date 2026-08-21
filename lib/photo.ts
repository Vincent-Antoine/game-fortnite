import { ApiError } from './errors'

export function sanitizePhoto(value: unknown): string | null {
  if (!value) {
    return null
  }
  if (typeof value !== 'string' || !value.startsWith('data:image/') || value.length > 180000) {
    throw new ApiError(400, 'Photo trop lourde (max ~100 Ko)')
  }
  return value
}
