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
import PublicChatWidget from '../components/public/PublicChatWidget.jsx'
import { getTenantConfigByKey } from '../modules/content-management/services/tenantConfigService'
import { buildTenantUrl } from '../utils/tenantRouting'
import useTenantPageTitle from '../utils/useTenantPageTitle'
import './public-layout.css'

const defaultMenu = [
  { label: 'Trang chủ', path: '/' },
  { label: 'Tạp chí', path: '/journal' },
]

const defaultTheme = {
  headerBgColor: '#ffffff',
  headerTextColor: '#1f2937',
  menuBgColor: '#ffffff',
  menuTextColor: '#374151',
  menuHoverTextColor: '#1d4ed8',
  menuHoverBgColor: '#eef2ff',
  menuActiveTextColor: '#1d4ed8',
  menuActiveBgColor: '#eef2ff',
  footerBgColor: '#ffffff',
  footerTextColor: '#1f2937',
}

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

function normalizeColor(value, fallback) {
  const color = String(value || '').trim()
  return color || fallback
}

function normalizeMenuTheme(payload) {
  const themeSource = payload?.theme && typeof payload.theme === 'object'
    ? payload.theme
    : payload?.menuJournal?.theme && typeof payload.menuJournal.theme === 'object'
      ? payload.menuJournal.theme
      : {}

  return {
    headerBgColor: normalizeColor(themeSource.headerBgColor, defaultTheme.headerBgColor),
    headerTextColor: normalizeColor(themeSource.headerTextColor, defaultTheme.headerTextColor),
    menuBgColor: normalizeColor(themeSource.menuBgColor, defaultTheme.menuBgColor),
    menuTextColor: normalizeColor(themeSource.menuTextColor, defaultTheme.menuTextColor),
    menuHoverTextColor: normalizeColor(themeSource.menuHoverTextColor, defaultTheme.menuHoverTextColor),
    menuHoverBgColor: normalizeColor(themeSource.menuHoverBgColor, defaultTheme.menuHoverBgColor),
    menuActiveTextColor: normalizeColor(themeSource.menuActiveTextColor, defaultTheme.menuActiveTextColor),
    menuActiveBgColor: normalizeColor(themeSource.menuActiveBgColor, defaultTheme.menuActiveBgColor),
    footerBgColor: normalizeColor(themeSource.footerBgColor, defaultTheme.footerBgColor),
    footerTextColor: normalizeColor(themeSource.footerTextColor, defaultTheme.footerTextColor),
  }
}

function normalizeFooterHtml(config) {
  const directHtml = String(config?.html || '').trim()
  if (directHtml) return directHtml

  const jsonHtml = String(config?.jsonContent?.html || '').trim()
  if (jsonHtml) return jsonHtml

  return ''
}

function normalizeHeaderHtml(config) {
  const directHtml = String(config?.html || '').trim()
  if (directHtml) return directHtml

  const jsonHtml = String(config?.jsonContent?.html || '').trim()
  if (jsonHtml) return jsonHtml

  return ''
}

function normalizeHomepageLayout(payload) {
  if (!payload || typeof payload !== 'object') {
    return {
      sloganHtml: '',
      bannerImageUrl: '',
    }
  }

  const directSloganHtml = String(payload?.slogan?.html || '').trim()
  const nestedSloganHtml = String(payload?.homepageLayout?.slogan?.html || '').trim()
  const directBannerImageUrl = String(payload?.sideBanner?.imageUrl || '').trim()
  const nestedBannerImageUrl = String(payload?.homepageLayout?.sideBanner?.imageUrl || '').trim()

  return {
    sloganHtml: directSloganHtml || nestedSloganHtml || '',
    bannerImageUrl: directBannerImageUrl || nestedBannerImageUrl || '',
  }
}

function replaceAllTokens(source, tokens, replacement) {
  return tokens.reduce((nextValue, token) => nextValue.split(token).join(replacement), source)
}

function interpolatePublicLayoutHtml(template, variables) {
  let html = String(template || '')
  if (!html) return ''

  const replacements = [
    { tokens: ['{{tenant.name}}', '{{tenantName}}'], value: String(variables?.tenantName || '') },
    { tokens: ['{{tenant.logo}}', '{{tenantLogo}}'], value: String(variables?.tenantLogo || '') },
    { tokens: ['{{tenant.slogan}}', '{{tenantSlogan}}'], value: String(variables?.tenantSlogan || '') },
    { tokens: ['{{tenant.banner}}', '{{tenantBanner}}'], value: String(variables?.tenantBanner || '') },
    { tokens: ['{{tenant.code}}', '{{tenantCode}}'], value: String(variables?.tenantCode || '') },
  ]

  replacements.forEach(({ tokens, value }) => {
    html = replaceAllTokens(html, tokens, value)
  })

  return html
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

function resolvePublicPageTitle(pathname, tenantCode) {
  const normalizedPathname = normalizePathname(pathname)
  const normalizedTenantRoot = tenantCode ? normalizePathname(`/t/${tenantCode}`) : ''

  if (normalizedTenantRoot && normalizedPathname === normalizedTenantRoot) {
    return ''
  }

  if (/\/(journal|category|archive|journal-category|journal-archive|journal-issue)(\/|$)/.test(normalizedPathname)) {
    return 'Tin tức'
  }

  return ''
}

export default function PublicLayout({ children }) {
  const tenant = useTenant()
  const location = useLocation()
  const params = useParams()
  const [journalMenuItems, setJournalMenuItems] = useState(defaultMenu)
  const [journalMenuTheme, setJournalMenuTheme] = useState(defaultTheme)
  const [headerHtml, setHeaderHtml] = useState('')
  const [footerHtml, setFooterHtml] = useState('')
  const [homepageLayoutVars, setHomepageLayoutVars] = useState({ sloganHtml: '', bannerImageUrl: '' })
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

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

  const resolvedHeaderHtml = useMemo(
    () => interpolatePublicLayoutHtml(headerHtml, {
      tenantName,
      tenantLogo: tenantLogoUrl,
      tenantSlogan: homepageLayoutVars.sloganHtml,
      tenantBanner: homepageLayoutVars.bannerImageUrl,
      tenantCode,
    }),
    [headerHtml, tenantName, tenantLogoUrl, homepageLayoutVars, tenantCode],
  )

  useEffect(() => {
    let cancelled = false

    async function loadLayoutConfigs() {
      try {
        const [menuConfig, headerConfig, footerConfig, homepageLayoutConfig] = await Promise.all([
          getTenantConfigByKey('menuJournal', { tenantCode }),
          getTenantConfigByKey('headerHtml', { tenantCode }),
          getTenantConfigByKey('footerHtml', { tenantCode }),
          getTenantConfigByKey('homepageLayout', { tenantCode }),
        ])
        const nextMenuItems = normalizeMenuJournalItems(menuConfig?.jsonContent)
        const nextMenuTheme = normalizeMenuTheme(menuConfig?.jsonContent)
        const nextHeaderHtml = normalizeHeaderHtml(headerConfig)
        const nextFooterHtml = normalizeFooterHtml(footerConfig)
        const nextHomepageLayoutVars = normalizeHomepageLayout(homepageLayoutConfig?.jsonContent)

        if (cancelled) return
        setJournalMenuItems(nextMenuItems)
        setJournalMenuTheme(nextMenuTheme)
        setHeaderHtml(nextHeaderHtml)
        setFooterHtml(nextFooterHtml)
        setHomepageLayoutVars(nextHomepageLayoutVars)
      } catch (error) {
        if (cancelled) return
        setJournalMenuItems(defaultMenu)
        setJournalMenuTheme(defaultTheme)
        setHeaderHtml('')
        setFooterHtml('')
        setHomepageLayoutVars({ sloganHtml: '', bannerImageUrl: '' })
      }
    }

    loadLayoutConfigs()

    return () => {
      cancelled = true
    }
  }, [tenantCode])

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname, location.search])

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

  const publicLayoutThemeVars = useMemo(
    () => ({
      '--public-layout-header-bg': journalMenuTheme.headerBgColor,
      '--public-layout-header-text': journalMenuTheme.headerTextColor,
      '--public-layout-menu-bg': journalMenuTheme.menuBgColor,
      '--public-layout-menu-text': journalMenuTheme.menuTextColor,
      '--public-layout-menu-hover-text': journalMenuTheme.menuHoverTextColor,
      '--public-layout-menu-hover-bg': journalMenuTheme.menuHoverBgColor,
      '--public-layout-menu-active-text': journalMenuTheme.menuActiveTextColor,
      '--public-layout-menu-active-bg': journalMenuTheme.menuActiveBgColor,
      '--public-layout-footer-bg': journalMenuTheme.footerBgColor,
      '--public-layout-footer-text': journalMenuTheme.footerTextColor,
    }),
    [journalMenuTheme],
  )

  const publicPageTitle = useMemo(
    () => resolvePublicPageTitle(location.pathname, tenantCode),
    [location.pathname, tenantCode],
  )

  useTenantPageTitle(publicPageTitle)

  return (
    <div className='public-layout' style={publicLayoutThemeVars}>
      <CHeader className='public-layout-header border-bottom'>
        <CContainer className='public-layout-shell'>
          {resolvedHeaderHtml ? (
            <div
              className='public-layout-header-html'
              dangerouslySetInnerHTML={{ __html: resolvedHeaderHtml }}
            />
          ) : (
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
          )}
        </CContainer>
      </CHeader>

      <div className='public-layout-navbar-wrap border-bottom'>
        <CContainer className='public-layout-shell'>
          <div className='public-layout-mobile-bar'>
            <button
              type='button'
              className={`public-layout-mobile-toggle${isMobileMenuOpen ? ' active' : ''}`}
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              aria-label={isMobileMenuOpen ? 'Đóng menu Journal' : 'Mở menu Journal'}
              aria-expanded={isMobileMenuOpen}
            >
              <span />
              <span />
              <span />
            </button>
          </div>

          <CNav className={`public-layout-nav${isMobileMenuOpen ? ' public-layout-nav-open' : ''}`}>
            <CNavItem>
              <NavLink
                to={homePath}
                end
                aria-label='Trang chủ'
                className={({ isActive }) => `nav-link public-layout-nav-link public-layout-home-link${isActive ? ' active' : ''}`}
              >
                <svg viewBox='0 0 24 24' aria-hidden='true' className='public-layout-home-icon'>
                  <path d='M3 10.75 12 3l9 7.75v9.75a1 1 0 0 1-1 1h-5.5v-7h-5v7H4a1 1 0 0 1-1-1z' fill='currentColor' />
                </svg>
              </NavLink>
            </CNavItem>
            {journalNavLinks.map((item) => {
              const itemKey = `${item.label}:${item.path || 'group'}`

              if (item.children?.length) {
                const isActive = hasActiveDescendant(item, location.pathname)

                return (
                  <CDropdown key={itemKey} variant='nav-item' className='public-layout-nav-dropdown'>
                    {item.path ? (
                      <div className={`public-layout-nav-dropdown-trigger${isActive ? ' active' : ''}`}>
                        {item.isExternal ? (
                          <a href={item.to} className='nav-link public-layout-nav-link public-layout-nav-parent-link'>{item.label}</a>
                        ) : (
                          <NavLink
                            to={item.to}
                            end={item.to === homePath}
                            className={({ isActive: isCurrent }) => `nav-link public-layout-nav-link public-layout-nav-parent-link${isCurrent || isActive ? ' active' : ''}`}
                          >
                            {item.label}
                          </NavLink>
                        )}
                        <CDropdownToggle
                          caret
                          color='ghost'
                          className={`nav-link public-layout-nav-link public-layout-nav-toggle${isActive ? ' active' : ''}`}
                        />
                      </div>
                    ) : (
                      <CDropdownToggle
                        caret
                        color='ghost'
                        className={`nav-link public-layout-nav-link public-layout-nav-toggle${isActive ? ' active' : ''}`}
                      >
                        {item.label}
                      </CDropdownToggle>
                    )}
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

                        const dropdownPaddingLeft = `${0.75 + dropdownItem.depth * 0.85}rem`

                        return (
                          dropdownItem.isExternal ? (
                            <CDropdownItem
                              key={`${dropdownItem.label}:${dropdownItem.path}:${index}`}
                              href={dropdownItem.to}
                              target='_blank'
                              rel='noreferrer'
                              style={{ paddingLeft: dropdownPaddingLeft }}
                            >
                              {dropdownItem.label}
                            </CDropdownItem>
                          ) : (
                            <NavLink
                              key={`${dropdownItem.label}:${dropdownItem.path}:${index}`}
                              to={dropdownItem.to}
                              end={normalizePathname(dropdownItem.path) === '/'}
                              className={({ isActive }) => `dropdown-item${isActive ? ' active' : ''}`}
                              style={{ paddingLeft: dropdownPaddingLeft }}
                            >
                              {dropdownItem.label}
                            </NavLink>
                          )
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

      {(tenantCode || tenant?.resolvedTenant?.tenantCode || tenant?.currentTenant?.tenantCode) ? (
        <PublicChatWidget
          tenantCode={tenantCode || tenant?.resolvedTenant?.tenantCode || tenant?.currentTenant?.tenantCode}
          tenantSlug={tenantCode || tenant?.resolvedTenant?.tenantCode || tenant?.currentTenant?.tenantCode}
        />
      ) : null}
    </div>
  )
}