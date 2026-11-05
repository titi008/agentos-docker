/**
 * Audio helpers for agent responses. Sources are data URLs, so nothing has
 * to be revoked when a message unmounts.
 */

const PCM16_MIME_TYPES = new Set(['audio/pcm16', 'audio/pcm', 'audio/l16'])
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/

function base64ToBytes(base64: string): Uint8Array | null {
  try {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }
    return bytes
  } catch {
    return null
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary)
}

/** 44-byte RIFF/WAVE header for 16-bit PCM. */
function createWavHeader(
  dataLength: number,
  sampleRate: number,
  numChannels: number
): Uint8Array {
  const header = new ArrayBuffer(44)
  const view = new DataView(header)
  const blockAlign = numChannels * 2
  const byteRate = sampleRate * blockAlign

  view.setUint32(0, 0x52494646, false) // "RIFF"
  view.setUint32(4, 36 + dataLength, true)
  view.setUint32(8, 0x57415645, false) // "WAVE"
  view.setUint32(12, 0x666d7420, false) // "fmt "
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  view.setUint32(36, 0x64617461, false) // "data"
  view.setUint32(40, dataLength, true)

  return new Uint8Array(header)
}

/**
 * Playable source for base64 audio. Raw PCM16 (the default for model audio
 * responses without a mime type) is wrapped in a WAV container. Returns null
 * when the data is not valid base64.
 */
export function audioSourceFromBase64(
  base64: string,
  mimeType?: string | null,
  sampleRate = 24000,
  numChannels = 1
): string | null {
  const type = mimeType?.toLowerCase() ?? 'audio/pcm16'
  if (!PCM16_MIME_TYPES.has(type)) {
    return BASE64_PATTERN.test(base64) ? `data:${type};base64,${base64}` : null
  }
  const pcm = base64ToBytes(base64)
  if (!pcm) return null
  const header = createWavHeader(pcm.length, sampleRate, numChannels)
  const wav = new Uint8Array(header.length + pcm.length)
  wav.set(header, 0)
  wav.set(pcm, header.length)
  return `data:audio/wav;base64,${bytesToBase64(wav)}`
}
