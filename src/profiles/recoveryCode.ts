/** Unambiguous alphabet: no 0/O/1/I/L (31 symbols). */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const BASE = ALPHABET.length

function checksum(body: string): string {
  let sum = 0
  for (let i = 0; i < body.length; i++) {
    sum += (ALPHABET.indexOf(body[i]) + 1) * (i + 3)
  }
  return ALPHABET[sum % BASE]
}

/** Format: XXXX-XXXX-XXXX — 11 random chars + 1 checksum char. */
export function generateRecoveryCode(): string {
  const bytes = new Uint8Array(11)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  let body = ''
  for (const b of bytes) body += ALPHABET[b % BASE]
  const full = body + checksum(body)
  return `${full.slice(0, 4)}-${full.slice(4, 8)}-${full.slice(8, 12)}`
}

export function normalizeRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function isValidRecoveryCode(input: string): boolean {
  const raw = normalizeRecoveryCode(input)
  if (raw.length !== 12) return false
  for (const c of raw) if (!ALPHABET.includes(c)) return false
  return checksum(raw.slice(0, 11)) === raw[11]
}
