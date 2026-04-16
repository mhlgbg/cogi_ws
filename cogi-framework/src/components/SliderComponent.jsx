import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSliderByCode } from '../modules/content-management/services/sliderService'
import './slider-component.css'

function normalizeAutoSlideMs(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 4000
  return Math.min(5000, Math.max(3000, Math.floor(parsed)))
}

function isExternalUrl(url) {
  return /^https?:\/\//i.test(String(url || '').trim())
}

export default function SliderComponent({
  code = '',
  items: providedItems = null,
  autoSlideMs = 4000,
  className = '',
  emptyState = null,
}) {
  const navigate = useNavigate()
  const [items, setItems] = useState(Array.isArray(providedItems) ? providedItems : [])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (Array.isArray(providedItems)) {
      setItems(providedItems)
      setActiveIndex(0)
      return
    }

    const sliderCode = String(code || '').trim()
    if (!sliderCode) {
      setItems([])
      setActiveIndex(0)
      return
    }

    let cancelled = false

    async function loadSliderItems() {
      setLoading(true)

      try {
        const nextItems = await getSliderByCode(sliderCode)
        if (cancelled) return
        setItems(Array.isArray(nextItems) ? nextItems : [])
        setActiveIndex(0)
      } catch {
        if (cancelled) return
        setItems([])
        setActiveIndex(0)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadSliderItems()

    return () => {
      cancelled = true
    }
  }, [code, providedItems])

  useEffect(() => {
    if (items.length <= 1) return undefined

    const intervalId = window.setInterval(() => {
      setActiveIndex((previous) => (previous + 1) % items.length)
    }, normalizeAutoSlideMs(autoSlideMs))

    return () => {
      window.clearInterval(intervalId)
    }
  }, [items.length, autoSlideMs])

  const activeItem = useMemo(() => {
    if (items.length === 0) return null
    return items[activeIndex] || items[0] || null
  }, [items, activeIndex])

  function handleSlideClick(item) {
    const link = String(item?.link || '').trim()
    if (!link) return

    const shouldOpenNewTab = Boolean(item?.openInNewTab)
    if (shouldOpenNewTab) {
      window.open(link, '_blank', 'noopener,noreferrer')
      return
    }

    if (isExternalUrl(link)) {
      window.location.assign(link)
      return
    }

    navigate(link)
  }

  function goToSlide(index) {
    if (index < 0 || index >= items.length) return
    setActiveIndex(index)
  }

  if (loading && !activeItem) {
    return <div className={`slider-component slider-component-loading ${className}`.trim()}>Đang tải slider...</div>
  }

  if (!activeItem) {
    return emptyState
  }

  const backgroundImage = String(activeItem?.image?.url || '').trim()
  const clickable = Boolean(String(activeItem?.link || '').trim())

  return (
    <section className={`slider-component ${className}`.trim()} aria-label='Slider'>
      <button
        type='button'
        className={`slider-component-stage${clickable ? ' is-clickable' : ''}`}
        style={backgroundImage ? { backgroundImage: `url(${backgroundImage})` } : undefined}
        onClick={() => handleSlideClick(activeItem)}
        disabled={!clickable}
      >
        <div className='slider-component-overlay'>
          <div className='slider-component-copy'>
            {activeItem?.showTitle !== false && activeItem?.title ? (
              <h2 className='slider-component-title'>{activeItem.title}</h2>
            ) : null}

            {activeItem?.showDescription !== false && activeItem?.description ? (
              <p className='slider-component-description'>{activeItem.description}</p>
            ) : null}
          </div>
        </div>
      </button>

      {items.length > 1 ? (
        <div className='slider-component-dots' role='tablist' aria-label='Slide navigation'>
          {items.map((item, index) => (
            <button
              key={`${item.id || item.title || 'slide'}:${index}`}
              type='button'
              role='tab'
              aria-selected={index === activeIndex}
              aria-label={`Chuyển đến slide ${index + 1}`}
              className={`slider-component-dot${index === activeIndex ? ' active' : ''}`}
              onClick={() => goToSlide(index)}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}