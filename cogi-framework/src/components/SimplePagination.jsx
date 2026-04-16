import { useMemo } from 'react'
import { CPagination, CPaginationItem } from '@coreui/react'

function buildPages(currentPage, pageCount) {
  const maxButtons = 7
  const pages = []

  if (pageCount <= maxButtons) {
    for (let index = 1; index <= pageCount; index += 1) pages.push(index)
    return pages
  }

  const left = Math.max(1, currentPage - 2)
  const right = Math.min(pageCount, currentPage + 2)

  pages.push(1)
  if (left > 2) pages.push('...')

  for (let index = left; index <= right; index += 1) {
    if (index !== 1 && index !== pageCount) pages.push(index)
  }

  if (right < pageCount - 1) pages.push('...')
  pages.push(pageCount)

  return pages
}

export default function SimplePagination({ currentPage = 1, pageCount = 1, disabled = false, onPageChange }) {
  const pages = useMemo(() => buildPages(currentPage, Math.max(1, pageCount)), [currentPage, pageCount])

  if (pageCount <= 1) return null

  return (
    <CPagination align='center' className='mb-0 public-category-pagination'>
      <CPaginationItem disabled={disabled || currentPage <= 1} onClick={() => onPageChange?.(Math.max(1, currentPage - 1))}>Trước</CPaginationItem>
      {pages.map((item, index) => item === '...'
        ? <CPaginationItem key={`dots-${index}`} disabled>…</CPaginationItem>
        : <CPaginationItem key={item} active={item === currentPage} disabled={disabled} onClick={() => onPageChange?.(item)}>{item}</CPaginationItem>)}
      <CPaginationItem disabled={disabled || currentPage >= pageCount} onClick={() => onPageChange?.(Math.min(pageCount, currentPage + 1))}>Sau</CPaginationItem>
    </CPagination>
  )
}