import { CNav, CNavItem, CNavLink } from '@coreui/react'
import { EXAM_CONFIGURATION_TABS } from '../utils/examConfigurationUi'

export default function ExamConfigurationTabs({ activeTab, onChange }) {
  return (
    <CNav variant='tabs' className='mb-3 flex-nowrap overflow-auto'>
      {EXAM_CONFIGURATION_TABS.map((tab) => (
        <CNavItem key={tab.key}>
          <CNavLink href='#' active={activeTab === tab.key} onClick={(event) => { event.preventDefault(); onChange?.(tab.key) }}>
            {tab.label}
          </CNavLink>
        </CNavItem>
      ))}
    </CNav>
  )
}