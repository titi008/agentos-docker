/** File types the runs endpoints accept as `files` (documents, images, audio). */
export const ACCEPTED_EXTENSIONS = [
  '.pdf',
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.json',
  '.py',
  '.js',
  '.ts',
  '.html',
  '.css',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.mp3',
  '.wav',
  '.m4a'
]

export const ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.join(',')

export const ACCEPTED_SUMMARY =
  'PDF, text, Markdown, CSV, JSON, code, images (PNG, JPG, WebP, GIF) and audio (MP3, WAV, M4A)'

function isAccepted(file: File): boolean {
  const name = file.name.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((extension) => name.endsWith(extension))
}

function sameFile(a: File, b: File): boolean {
  return (
    a.name === b.name && a.size === b.size && a.lastModified === b.lastModified
  )
}

/** Adds the supported files that aren't attached yet; reports the rest. */
export function mergeAttachments(
  current: File[],
  incoming: File[]
): { files: File[]; rejected: string[] } {
  const rejected: string[] = []
  const files = [...current]
  for (const file of incoming) {
    if (!isAccepted(file)) rejected.push(file.name || 'Unnamed file')
    else if (!files.some((existing) => sameFile(existing, file))) {
      files.push(file)
    }
  }
  return { files, rejected }
}

export function hasDraggedFiles(dataTransfer: DataTransfer | null): boolean {
  return Boolean(
    dataTransfer && Array.from(dataTransfer.types).includes('Files')
  )
}
