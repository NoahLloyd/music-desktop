import { useState, useEffect } from 'react'

interface ArtworkImageProps {
  src: string
  alt?: string
  className?: string
}

interface CropBounds {
  top: number    // fraction 0-1
  bottom: number // fraction 0-1
}

const cropCache = new Map<string, CropBounds>()

/**
 * Detect black letterbox bars by scanning pixel rows from top and bottom.
 * Returns the fraction of the image that is black bars on each side.
 */
function detectLetterbox(img: HTMLImageElement): CropBounds {
  const cached = cropCache.get(img.src)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  const size = Math.min(img.naturalWidth, 200)
  const scale = size / img.naturalWidth
  canvas.width = size
  canvas.height = Math.round(img.naturalHeight * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return { top: 0, bottom: 0 }

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const { data, width, height } = imageData

  const isRowBlack = (y: number): boolean => {
    let totalBrightness = 0
    let samples = 0
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4
      totalBrightness += data[i] + data[i + 1] + data[i + 2]
      samples++
    }
    return (totalBrightness / samples) < 30
  }

  let topRows = 0
  for (let y = 0; y < height / 2; y++) {
    if (isRowBlack(y)) topRows++
    else break
  }

  let bottomRows = 0
  for (let y = height - 1; y > height / 2; y--) {
    if (isRowBlack(y)) bottomRows++
    else break
  }

  const minBar = height * 0.05
  const bounds: CropBounds = {
    top: topRows > minBar ? topRows / height : 0,
    bottom: bottomRows > minBar ? bottomRows / height : 0,
  }

  cropCache.set(img.src, bounds)
  return bounds
}

/**
 * Image component that auto-detects and crops black letterbox bars.
 * Never stretches — uses object-fit:cover with object-position to
 * center on the content region between the bars.
 */
export default function ArtworkImage({ src, alt = '', className = '' }: ArtworkImageProps) {
  const [crop, setCrop] = useState<CropBounds | null>(cropCache.get(src) ?? null)

  useEffect(() => {
    if (cropCache.has(src)) {
      setCrop(cropCache.get(src)!)
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setCrop(detectLetterbox(img))
    img.onerror = () => setCrop({ top: 0, bottom: 0 })
    img.src = src
  }, [src])

  const hasLetterbox = crop && (crop.top > 0 || crop.bottom > 0)

  if (hasLetterbox) {
    // Center of the content region as a percentage
    const contentCenter = (crop.top + (1 - crop.bottom)) / 2 * 100

    return (
      <div className={`overflow-hidden ${className}`}>
        <img
          src={src}
          alt={alt}
          className="w-full h-full"
          style={{
            objectFit: 'cover',
            objectPosition: `center ${contentCenter}%`,
          }}
        />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`object-cover ${className}`}
    />
  )
}
