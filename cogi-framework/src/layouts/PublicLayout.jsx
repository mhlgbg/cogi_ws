import {
  CContainer,
  CDropdown,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
  CFooter,
  CHeader,
  CNav,
  CNavItem,
} from '@coreui/react'
import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useParams } from 'react-router-dom'
import { useTenant } from '../contexts/TenantContext'
import { getTenantConfigByKey } from '../modules/content-management/services/tenantConfigService'
import { buildTenantUrl } from '../utils/tenantRouting'
import './public-layout.css'

const defaultMenu = [
  { label: 'Trang chủ', path: '/' },
  { label: 'Tạp chí', path: '/journal' },
]

function toInitials(input) {
  const text = String(input || '').trim()
  if (!text) return 'T'
  const parts = text.split(/\s+/).slice(0, 2)
  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || 'T'
}

function isExternalUrl(path) {
  return /^https?:\/\//i.test(String(path || '').trim())
}

function normalizeMenuEntry(item) {
  if (!item || typeof item !== 'object') return null

  const label = String(item.label || '').trim()
  const path = String(item.path || '').trim()
  const childrenSource = Array.isArray(item.children) ? item.children : []
  const children = childrenSource.map(normalizeMenuEntry).filter(Boolean)

  if (!label) return null
  if (!path && children.length === 0) return null

  return {
    label,
    path,
    children,
  }
}

function normalizeMenuJournalItems(payload) {
  const source = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.menuJournal)
      ? payload.menuJournal
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.menuJournal?.items)
          ? payload.menuJournal.items
      : []

  const items = source.map(normalizeMenuEntry).filter(Boolean)

  return items.length > 0 ? items : defaultMenu
}

function normalizeFooterHtml(config) {
  const directHtml = String(config?.html || '').trim()
  if (directHtml) return directHtml

  const jsonHtml = String(config?.jsonContent?.html || '').trim()
  if (jsonHtml) return jsonHtml

  return ''
}

function normalizePathname(path) {
  const rawPath = String(path || '').trim()
  if (!rawPath) return '/'
  if (isExternalUrl(rawPath)) {
    try {
      return new URL(rawPath).pathname || '/'
    } catch {
      return rawPath
    }
  }

  return rawPath.startsWith('/') ? rawPath : `/${rawPath}`
}

function isPathActive(currentPathname, targetPath) {
  const current = normalizePathname(currentPathname)
  const target = normalizePathname(targetPath)

  if (target === '/') return current === '/'
  return current === target || current.startsWith(`${target}/`)
}

function hasActiveDescendant(item, currentPathname) {
  if (!item || typeof item !== 'object') return false
  if (item.path && !isExternalUrl(item.path) && isPathActive(currentPathname, item.path)) return true
  return Array.isArray(item.children) && item.children.some((child) => hasActiveDescendant(child, currentPathname))
}

function flattenDropdownItems(items, depth = 0) {
  return items.flatMap((item) => {
    const entry = { ...item, depth }
    if (Array.isArray(item.children) && item.children.length > 0) {
      return [entry, ...flattenDropdownItems(item.children, depth + 1)]
    }

    return [entry]
  })
}

function resolveMenuLinks(items, tenantCode, isMainDomain) {
  return items.map((item) => {
    const rawPath = String(item.path || '').trim()
    const isExternal = isExternalUrl(rawPath)

    return {
      ...item,
      to: rawPath
        ? (isExternal ? rawPath : buildTenantUrl(rawPath, { tenantCode, isMainDomain }) || rawPath)
        : '',
      isExternal,
      children: Array.isArray(item.children)
        ? resolveMenuLinks(item.children, tenantCode, isMainDomain)
        : [],
    }
  })
}

export default function PublicLayout({ children }) {
  const tenant = useTenant()
  const location = useLocation()
  const params = useParams()
  const [journalMenuItems, setJournalMenuItems] = useState(defaultMenu)
  const [footerHtml, setFooterHtml] = useState('')

  const tenantName = tenant?.currentTenant?.tenantName
    || tenant?.currentTenant?.tenantShortName
    || tenant?.resolvedTenant?.tenantName
    || tenant?.resolvedTenant?.tenantShortName
    || tenant?.currentTenant?.tenantCode
    || tenant?.resolvedTenant?.tenantCode
    || 'Tenant'

  const tenantLogoUrl = tenant?.currentTenant?.tenantLogoUrl
    || tenant?.resolvedTenant?.tenantLogoUrl
    || ''
  const tenantCode = String(params?.tenantCode || tenant?.currentTenant?.tenantCode || tenant?.resolvedTenant?.tenantCode || '').trim()
  const isMainDomain = Boolean(tenant?.isMainDomain)
  const homePath = buildTenantUrl('/', { tenantCode, isMainDomain }) || '/'

  useEffect(() => {
    let cancelled = false

    async function loadLayoutConfigs() {
      try {
        const [menuConfig, footerConfig] = await Promise.all([
          getTenantConfigByKey('menuJournal', { tenantCode }),
          getTenantConfigByKey('footerHtml', { tenantCode }),
        ])
        const nextMenuItems = normalizeMenuJournalItems(menuConfig?.jsonContent)
        const nextFooterHtml = normalizeFooterHtml(footerConfig)

        if (cancelled) return
        setJournalMenuItems(nextMenuItems)
        setFooterHtml(nextFooterHtml)
      } catch (error) {
        if (cancelled) return
        setJournalMenuItems(defaultMenu)
        setFooterHtml('')
      }
    }

    loadLayoutConfigs()

    return () => {
      cancelled = true
    }
  }, [tenantCode])

  const journalNavLinks = useMemo(
    () => resolveMenuLinks(journalMenuItems, tenantCode, isMainDomain),
    [journalMenuItems, tenantCode, isMainDomain],
  )

  const flattenedDropdownItemsByLabel = useMemo(
    () => Object.fromEntries(
      journalNavLinks.map((item) => [item.label, flattenDropdownItems(item.children || [])]),
    ),
    [journalNavLinks],
  )

  return (
    <div className='public-layout'>
      <CHeader className='public-layout-header border-bottom'>
        <CContainer className='public-layout-shell'>
          <div className='public-layout-brand'>
            {tenantLogoUrl ? (
              <img src={tenantLogoUrl} alt={tenantName} className='public-layout-logo' />
            ) : (
              <div className='public-layout-logo public-layout-logo-fallback'>
                {toInitials(tenantName)}
              </div>
            )}

            <div className='public-layout-brand-copy'>
              <div className='public-layout-brand-label'>Tenant</div>
              <div className='public-layout-brand-name'>{tenantName}</div>
            </div>
          </div>
        </CContainer>
      </CHeader>

      <div className='public-layout-navbar-wrap border-bottom'>
        <CContainer className='public-layout-shell'>
          <CNav className='public-layout-nav'>
            {journalNavLinks.map((item) => {
              const itemKey = `${item.label}:${item.path || 'group'}`

              if (item.children?.length) {
                return (
                  <CDropdown key={itemKey} variant='nav-item'>
                    <CDropdownToggle
                      caret
                      color='ghost'
                      className={`nav-link public-layout-nav-link public-layout-nav-toggle${hasActiveDescendant(item, location.pathname) ? ' active' : ''}`}
                    >
                      {item.label}
                    </CDropdownToggle>
                    <CDropdownMenu>
                      {flattenedDropdownItemsByLabel[item.label]?.map((dropdownItem, index) => {
                        const hasChildren = Array.isArray(dropdownItem.children) && dropdownItem.children.length > 0

                        if (hasChildren && !dropdownItem.path) {
                          return (
                            <div
                              key={`${dropdownItem.label}:${index}`}
                              className='public-layout-dropdown-label'
                              style={{ paddingLeft: `${0.75 + dropdownItem.depth * 0.85}rem` }}
                            >
                              {dropdownItem.label}
                            </div>
                          )
                        }

                        if (!dropdownItem.path) return null

                        return (
                          <CDropdownItem
                            key={`${dropdownItem.label}:${dropdownItem.path}:${index}`}
                            {...(dropdownItem.isExternal
                              ? {
                                href: dropdownItem.to,
                                target: '_blank',
                                rel: 'noreferrer',
                              }
                              : {
                                component: NavLink,
                                to: dropdownItem.to,
                                className: ({ isActive }) => isActive ? 'active' : '',
                              })}
                            style={{ paddingLeft: `${0.75 + dropdownItem.depth * 0.85}rem` }}
                          >
                            {dropdownItem.label}
                          </CDropdownItem>
                        )
                      })}
                    </CDropdownMenu>
                  </CDropdown>
                )
              }

              return (
                <CNavItem key={itemKey}>
                  {item.isExternal ? (
                    <a href={item.to} className='nav-link public-layout-nav-link'>{item.label}</a>
                  ) : (
                    <NavLink
                      to={item.to}
                      end={item.to === homePath}
                      className={({ isActive }) => `nav-link public-layout-nav-link${isActive ? ' active' : ''}`}
                    >
                      {item.label}
                    </NavLink>
                  )}
                </CNavItem>
              )
            })}
          </CNav>
        </CContainer>
      </div>

      <main className='public-layout-main'>
        <CContainer className='public-layout-shell'>
          {children || <Outlet />}
        </CContainer>
      </main>

      <CFooter className='public-layout-footer border-top'>
        <CContainer className='public-layout-shell'>
          <div className='public-layout-footer-wrap'>
            {footerHtml ? (
              <div
                className='public-layout-footer-html'
                dangerouslySetInnerHTML={{ __html: footerHtml }}
              />
            ) : (
              <div className='public-layout-footer-inner'>
                <span>{tenantName}</span>
                <span>Public page layout</span>
              </div>
            )}
          </div>
        </CContainer>
      </CFooter>
    </div>
  )
}