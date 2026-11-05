'use client'

import { Download, ImageOff } from 'lucide-react'
import { memo, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { audioSourceFromBase64 } from '@/lib/audio'
import { cn } from '@/lib/utils'
import type { AudioData, ImageData, VideoData } from '@/types/os'

function imageSource(image: ImageData): string | null {
  if (image.url) return image.url
  if (image.content) {
    return `data:${image.mime_type || 'image/png'};base64,${image.content}`
  }
  return null
}

function videoSource(video: VideoData): string | null {
  if (video.url) return video.url
  if (video.content) {
    return `data:${video.mime_type || 'video/mp4'};base64,${video.content}`
  }
  return null
}

function ImageItem({ image }: { image: ImageData }) {
  const [failed, setFailed] = useState(false)
  const src = imageSource(image)
  const alt = image.alt_text || image.revised_prompt || 'Generated image'

  if (!src || failed) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong bg-surface p-3 text-center">
        <ImageOff aria-hidden className="size-5 text-fg-3" />
        <p className="text-[13px] text-fg-2">Image unavailable</p>
        {image.url ? (
          <a
            href={image.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full truncate text-xs text-accent underline underline-offset-2"
          >
            {image.url}
          </a>
        ) : null}
      </div>
    )
  }

  return (
    // Agents link images from arbitrary hosts, so next/image can't be configured for them.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="w-full rounded-lg border border-line bg-surface"
    />
  )
}

export const Images = memo(function Images({
  images
}: {
  images: ImageData[]
}) {
  return (
    <div
      className={cn(
        'grid max-w-xl gap-3',
        images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'
      )}
    >
      {images.map((image, index) => (
        <ImageItem key={image.id ?? image.url ?? index} image={image} />
      ))}
    </div>
  )
})

function extensionOf(url: string, mimeType?: string): string {
  const fromType = mimeType?.split('/')[1]
  if (fromType) return fromType
  const fromUrl = url.split('?')[0].split('.').pop()
  return fromUrl && fromUrl.length <= 5 ? fromUrl : 'mp4'
}

async function downloadVideo(src: string, mimeType?: string) {
  const response = await fetch(src)
  if (!response.ok) throw new Error(`The server returned ${response.status}.`)
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = `video-${Date.now()}.${extensionOf(src, mimeType)}`
    document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}

function VideoItem({ video }: { video: VideoData }) {
  const [downloading, setDownloading] = useState(false)
  const src = videoSource(video)
  if (!src) return null

  const onDownload = async () => {
    setDownloading(true)
    try {
      await downloadVideo(src, video.mime_type)
      toast.success('Video downloaded')
    } catch (error) {
      toast.error("Couldn't download the video", {
        description:
          error instanceof Error
            ? error.message
            : 'The host may not allow downloads.'
      })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-1.5">
      <video
        src={src}
        controls
        muted
        loop
        playsInline
        preload="metadata"
        className="aspect-video w-full rounded-lg border border-line bg-canvas"
      />
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={onDownload}
        loading={downloading}
      >
        {downloading ? null : <Download />}
        Download video
      </Button>
    </div>
  )
}

export const Videos = memo(function Videos({
  videos
}: {
  videos: VideoData[]
}) {
  return (
    <div className="flex flex-col gap-3">
      {videos.map((video, index) => (
        <VideoItem key={video.id ?? video.url ?? index} video={video} />
      ))}
    </div>
  )
})

function AudioItem({ audio }: { audio: AudioData }) {
  const src = useMemo(() => {
    if (audio.url) return audio.url
    if (audio.base64_audio) {
      return audioSourceFromBase64(
        audio.base64_audio,
        audio.mime_type || 'audio/wav'
      )
    }
    if (audio.content) {
      return audioSourceFromBase64(
        audio.content,
        audio.mime_type,
        audio.sample_rate,
        audio.channels
      )
    }
    return null
  }, [audio])

  if (!src) return null
  return (
    <audio src={src} controls preload="metadata" className="w-full max-w-xl" />
  )
}

export const Audios = memo(function Audios({ audio }: { audio: AudioData[] }) {
  return (
    <div className="flex flex-col gap-3">
      {audio.map((item, index) => (
        <AudioItem key={item.id ?? item.url ?? index} audio={item} />
      ))}
    </div>
  )
})
