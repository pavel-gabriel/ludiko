/** Join codes: 6 characters from an unambiguous 31-symbol alphabet (no 0/O/1/I/L), ~887 million combinations. */
export const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const JOIN_CODE_LENGTH = 6
/** Mirrored in firestore.rules */
export const JOIN_CODE_PATTERN = /^[A-HJKMNP-Z2-9]{6}$/

export function generateJoinCode(): string {
  const bytes = new Uint8Array(JOIN_CODE_LENGTH)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  let code = ''
  for (const b of bytes) code += JOIN_CODE_ALPHABET[b % JOIN_CODE_ALPHABET.length]
  return code
}

/** Tolerant input: case, spaces and dashes are ignored */
export function normalizeJoinCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function isValidJoinCode(code: string): boolean {
  return JOIN_CODE_PATTERN.test(code)
}

/** "ABC DEF" for reading aloud and printing */
export function formatJoinCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`
}
