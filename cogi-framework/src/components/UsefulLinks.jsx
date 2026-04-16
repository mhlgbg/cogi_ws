import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import './useful-links.css'

function isExternalUrl(url) {
  return /^https?:\/\//i.test(String(url || '').trim())
}

function normalizeLinkItem(item) {
  if (!item || typeof item !== 'object') return null

  const title = String(item?.title || item?.label || '').trim()
  const link = String(item?.link || item?.path || '').trim()
  const imageUrl = String(item?.image?.url || item?.imageUrl || '').trim()

  if (!title && !imageUrl) return null

  return {
    id: item?.id || null,
    title: title || 'Liên kết',
    link,
    imageUrl,
    openInNewTab: Boolean(item?.openInNewTab),
  }
}

export default function UsefulLinks({ items = [], className = '' }) {
  const navigate = useNavigate()

  const normalizedItems = useMemo(
    () => (Array.isArray(items) ? items.map(normalizeLinkItem).filter(Boolean) : []),
    [items],
  )

  function handleItemClick(item) {
    const link = String(item?.link || '').trim()
    if (!link) return

    if (item?.openInNewTab) {
      window.open(link, '_blank', 'noopener,noreferrer')
      return
    }

    if (isExternalUrl(link)) {
      window.location.assign(link)
      return
    }

    navigate(link)
  }

  if (normalizedItems.length === 0) {
    return null
  }

  return (
    <div className={`useful-links ${className}`.trim()}>
      {normalizedItems.map((item, index) => {
        const clickable = Boolean(item.link)

        return (
          <button
            key={`${item.id || item.title}:${index}`}
            type='button'
            className={`useful-links-item${clickable ? ' is-clickable' : ''}`}
            onClick={() => handleItemClick(item)}
            disabled={!clickable}
          >
            <div className='useful-links-item-icon-wrap'>
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.title} className='useful-links-item-icon' />
              ) : (
                <div className='useful-links-item-icon-fallback'>{item.title.slice(0, 1).toUpperCase()}</div>
              )}
            </div>
            <div className='useful-links-item-title'>{item.title}</div>
          </button>
        )
      })}
    </div>
  )
}