import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CNav,
  CNavItem,
  CNavLink,
  CRow,
  CSpinner,
  CTabContent,
  CTabPane,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import {
  confirmCurriculumSourceImport,
  createPlatformCurriculum,
  createPlatformCurriculumDocument,
  createPlatformCurriculumEducationLevel,
  createPlatformCurriculumGrade,
  createPlatformCurriculumLocation,
  createPlatformCurriculumScope,
  createPlatformCurriculumSection,
  createPlatformCurriculumSubject,
  createPlatformCurriculumVersion,
  deletePlatformCurriculum,
  deletePlatformCurriculumDocument,
  deletePlatformCurriculumEducationLevel,
  deletePlatformCurriculumGrade,
  deletePlatformCurriculumLocation,
  deletePlatformCurriculumScope,
  deletePlatformCurriculumSection,
  deletePlatformCurriculumSubject,
  deletePlatformCurriculumVersion,
  getApiMessage,
  getPlatformCurriculumCatalog,
  previewCurriculumSourceImport,
  updatePlatformCurriculum,
  updatePlatformCurriculumDocument,
  updatePlatformCurriculumEducationLevel,
  updatePlatformCurriculumGrade,
  updatePlatformCurriculumLocation,
  updatePlatformCurriculumScope,
  updatePlatformCurriculumSection,
  updatePlatformCurriculumSubject,
  updatePlatformCurriculumVersion,
} from '../services/platformApi'

const emptyCurriculumForm = {
  code: '',
  title: '',
  description: '',
  status: 'draft',
}

const emptyVersionForm = {
  curriculum: '',
  subject: '',
  versionCode: '',
  versionLabel: '',
  status: 'draft',
  description: '',
}

const emptyScopeForm = {
  code: '',
  subjectCurriculumVersion: '',
  curriculumGrade: '',
  sortOrder: '0',
  status: 'draft',
}

const emptySubjectForm = {
  code: '',
  name: '',
  description: '',
  status: 'active',
}

const emptyEducationLevelForm = {
  code: '',
  name: '',
  sortOrder: '0',
}

const emptyGradeForm = {
  code: '',
  name: '',
  gradeNumber: '6',
  educationLevel: '',
  sortOrder: '0',
}

const emptyDocumentForm = {
  code: '',
  title: '',
  documentNumber: '',
  issuedDate: '',
  description: '',
  fileRef: '',
  checksum: '',
  status: 'draft',
}

const emptySectionForm = {
  sourceDocument: '',
  parent: '',
  sectionType: '',
  title: '',
  body: '',
  sortOrder: '0',
}

const emptyLocationForm = {
  sourceDocument: '',
  section: '',
  startPage: '',
  endPage: '',
  locator: '',
  excerpt: '',
}

function normalizeNumericId(value) {
  if (value === '' || value === null || value === undefined) return ''

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    return ''
  }

  return String(parsed)
}

function normalizeCatalogRows(rows = [], keyBuilder) {
  const deduped = new Map()

  rows.forEach((row) => {
    if (!row || typeof row !== 'object') return

    const key = keyBuilder(row)
    if (!key) return

    const existing = deduped.get(key)
    if (!existing) {
      deduped.set(key, row)
      return
    }

    const existingTime = existing.updatedAt || existing.publishedAt || existing.createdAt || ''
    const nextTime = row.updatedAt || row.publishedAt || row.createdAt || ''
    if (!existingTime || (nextTime && String(nextTime) > String(existingTime))) {
      deduped.set(key, row)
    }
  })

  return Array.from(deduped.values()).sort((a, b) => Number(a.id ?? 0) - Number(b.id ?? 0))
}

function getStableRecordKey(row, extraParts = []) {
  const sourceDocumentKey = getRelationId(row?.sourceDocument)
  const recordKey = String(row?.documentId || row?.document_id || row?.id || '')
  const parts = [sourceDocumentKey, recordKey, ...extraParts].filter((part) => part !== null && part !== undefined && part !== '')
  return parts.join('::')
}

function getRelationCandidates(value) {
  if (value === null || value === undefined || value === '') return []
  if (Array.isArray(value)) {
    return value.flatMap((entry) => getRelationCandidates(entry))
  }
  if (typeof value === 'object') {
    const candidates = [value.id, value.documentId, value.document_id, value._id]
    return candidates.filter((candidate) => candidate !== undefined && candidate !== null && candidate !== '').map((candidate) => String(candidate))
  }
  return [String(value)]
}

function buildRelationLookup(rows = []) {
  const lookup = new Map()

  rows.forEach((row) => {
    if (!row || typeof row !== 'object') return

    const directCandidates = getRelationCandidates(row)
    const canonicalId = directCandidates[0]
    if (!canonicalId) return

    const recordId = String(row.id ?? row.documentId ?? row.document_id ?? row._id ?? canonicalId)
    lookup.set(recordId, recordId)
    directCandidates.forEach((candidate) => {
      lookup.set(String(candidate), recordId)
    })
  })

  return lookup
}

function getRelationId(value, lookup = null) {
  const candidates = getRelationCandidates(value)
  if (candidates.length === 0) return ''

  if (lookup) {
    for (const candidate of candidates) {
      const mapped = lookup.get(String(candidate))
      if (mapped !== undefined) return String(mapped)
    }
  }

  return String(candidates[0])
}

function normalizeCatalogData(data = {}) {
  const sections = normalizeCatalogRows(data.sections || [], (section) => getStableRecordKey(section, [getRelationId(section?.parent)]))

  const locations = normalizeCatalogRows(data.locations || [], (location) => getStableRecordKey(location, [
    getRelationId(location?.section),
    String(location?.startPage ?? ''),
    String(location?.endPage ?? ''),
  ]))

  return {
    ...data,
    sections,
    locations,
  }
}

function formatStatusBadge(status) {
  const value = String(status || 'draft').toLowerCase()

  if (value === 'published') return <CBadge color='success'>Published</CBadge>
  if (value === 'draft') return <CBadge color='secondary'>Draft</CBadge>
  if (value === 'superseded') return <CBadge color='warning'>Superseded</CBadge>
  if (value === 'review') return <CBadge color='info'>Review</CBadge>
  if (value === 'active') return <CBadge color='primary'>Active</CBadge>
  if (value === 'archived') return <CBadge color='dark'>Archived</CBadge>

  return <CBadge color='secondary'>{status || 'Draft'}</CBadge>
}

export default function PlatformCurriculumManager() {
  const [catalog, setCatalog] = useState({
    curricula: [],
    subjects: [],
    educationLevels: [],
    grades: [],
    versions: [],
    scopes: [],
    documents: [],
    sections: [],
    locations: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [curriculumForm, setCurriculumForm] = useState(emptyCurriculumForm)
  const [editingCurriculumId, setEditingCurriculumId] = useState(null)
  const [versionForm, setVersionForm] = useState(emptyVersionForm)
  const [editingVersionId, setEditingVersionId] = useState(null)
  const [scopeForm, setScopeForm] = useState(emptyScopeForm)
  const [editingScopeId, setEditingScopeId] = useState(null)
  const [subjectForm, setSubjectForm] = useState(emptySubjectForm)
  const [editingSubjectId, setEditingSubjectId] = useState(null)
  const [educationLevelForm, setEducationLevelForm] = useState(emptyEducationLevelForm)
  const [editingEducationLevelId, setEditingEducationLevelId] = useState(null)
  const [gradeForm, setGradeForm] = useState(emptyGradeForm)
  const [editingGradeId, setEditingGradeId] = useState(null)
  const [documentForm, setDocumentForm] = useState(emptyDocumentForm)
  const [editingDocumentId, setEditingDocumentId] = useState(null)
  const [sectionForm, setSectionForm] = useState(emptySectionForm)
  const [editingSectionId, setEditingSectionId] = useState(null)
  const [locationForm, setLocationForm] = useState(emptyLocationForm)
  const [editingLocationId, setEditingLocationId] = useState(null)
  const [selectedDocumentId, setSelectedDocumentId] = useState('')
  const [selectedSectionId, setSelectedSectionId] = useState('')
  const [documentModalVisible, setDocumentModalVisible] = useState(false)
  const [sectionModalVisible, setSectionModalVisible] = useState(false)
  const [locationModalVisible, setLocationModalVisible] = useState(false)
  const [importModalVisible, setImportModalVisible] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [importPreview, setImportPreview] = useState(null)
  const [importBusy, setImportBusy] = useState(false)

  async function loadCatalog() {
    setLoading(true)
    setError('')

    try {
      const nextData = normalizeCatalogData(await getPlatformCurriculumCatalog())
      setCatalog(nextData)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong tai duoc curriculum catalog'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCatalog()
  }, [])

  useEffect(() => {
    if (!catalog.documents.length) {
      setSelectedDocumentId('')
      setSelectedSectionId('')
      return
    }

    setSelectedDocumentId((previous) => {
      if (previous && catalog.documents.some((item) => String(item.id) === String(previous))) {
        return previous
      }

      return String(catalog.documents[0].id)
    })
  }, [catalog.documents])

  useEffect(() => {
    if (!selectedDocumentId) {
      setSelectedSectionId('')
      return
    }

    const documentLookup = buildRelationLookup(catalog.documents)
    const documentSections = catalog.sections.filter((section) => String(getRelationId(section.sourceDocument, documentLookup)) === String(selectedDocumentId))
    if (!documentSections.length) {
      setSelectedSectionId('')
      return
    }

    if (selectedSectionId && documentSections.some((section) => String(section.id) === String(selectedSectionId))) {
      return
    }

    setSelectedSectionId(String(documentSections[0].id))
  }, [catalog.sections, catalog.documents, selectedDocumentId, selectedSectionId])

  function handleCurriculumField(field, value) {
    setCurriculumForm((previous) => ({ ...previous, [field]: value }))
  }

  function handleVersionField(field, value) {
    const nextValue = field === 'curriculum' || field === 'subject' ? normalizeNumericId(value) : value
    setVersionForm((previous) => ({ ...previous, [field]: nextValue }))
  }

  function handleScopeField(field, value) {
    const nextValue = field === 'subjectCurriculumVersion' || field === 'curriculumGrade' ? normalizeNumericId(value) : value
    setScopeForm((previous) => ({ ...previous, [field]: nextValue }))
  }

  function handleSubjectField(field, value) {
    setSubjectForm((previous) => ({ ...previous, [field]: value }))
  }

  function handleEducationLevelField(field, value) {
    setEducationLevelForm((previous) => ({ ...previous, [field]: value }))
  }

  function handleGradeField(field, value) {
    const nextValue = field === 'educationLevel' ? normalizeNumericId(value) : value
    setGradeForm((previous) => ({ ...previous, [field]: nextValue }))
  }

  function handleDocumentField(field, value) {
    const nextValue = field === 'status' ? value : value
    setDocumentForm((previous) => ({ ...previous, [field]: nextValue }))
  }

  function handleSectionField(field, value) {
    const nextValue = field === 'sourceDocument' || field === 'parent' ? normalizeNumericId(value) : value
    setSectionForm((previous) => ({ ...previous, [field]: nextValue }))
  }

  function handleLocationField(field, value) {
    const nextValue = field === 'sourceDocument' || field === 'section' ? normalizeNumericId(value) : value
    setLocationForm((previous) => ({ ...previous, [field]: nextValue }))
  }

  function buildCurriculumImportTemplate(sourceDocumentCode = 'DOC-001', fileType = 'xlsx') {
    const manifest = [{
      schemaVersion: '1.0',
      packageCode: 'CURRICULUM_IMPORT',
      sourceDocumentCode,
      subjectVersionCode: 'SUBJ-001',
      description: 'Sample import package for curriculum source sections and locations. sectionImportKey is optional for document-scoped page preview rows.',
    }]

    const sections = [
      {
        importKey: 'SEC-ROOT',
        parentImportKey: '',
        sectionType: 'chapter',
        title: 'Unit 1: Foundations',
        body: 'Sample section body.',
        sortOrder: 1,
      },
      {
        importKey: 'SEC-LS-001',
        parentImportKey: 'SEC-ROOT',
        sectionType: 'lesson',
        title: 'Lesson 1',
        body: 'Sample lesson text.',
        sortOrder: 1,
      },
    ]

    const sourceLocations = [
      {
        importKey: 'LOC-001',
        sectionImportKey: 'SEC-LS-001',
        startPage: 1,
        endPage: 2,
        locator: 'Trang 1-2',
        excerpt: 'This is an example section-scoped source location extracted from the document.',
      },
      {
        importKey: 'LOC-PAGE-001',
        sectionImportKey: null,
        startPage: 1,
        endPage: 1,
        locator: 'PDF_PAGE:1',
        excerpt: 'Document-scoped page preview of the cover page; no section binding is required.',
        locationType: 'page_preview',
      },
    ]

    if (fileType === 'json') {
      return {
        manifest,
        sections,
        sourceLocations,
      }
    }

    return { manifest, sections, sourceLocations }
  }

  async function handleDownloadImportTemplate(fileType = 'xlsx') {
    const sourceDocument = catalog.documents.find((item) => String(item.id) === String(selectedDocumentId)) || null
    const sourceDocumentCode = sourceDocument?.code || 'DOC-001'
    const template = buildCurriculumImportTemplate(sourceDocumentCode, fileType)

    if (fileType === 'json') {
      const fileBlob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(fileBlob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'curriculum-source-import-template.json'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      return
    }

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(template.manifest), 'Manifest')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(template.sections), 'Sections')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(template.sourceLocations), 'SourceLocations')
    XLSX.writeFile(workbook, 'curriculum-source-import-template.xlsx')
  }

  async function handleImportPreview() {
    if (!selectedDocumentId) {
      setError('Vui lòng chọn Curriculum Source Document trước khi import.')
      return
    }

    if (!importFile) {
      setError('Vui lòng chọn file .xlsx hoặc .json để xem trước.')
      return
    }

    setImportBusy(true)
    setError('')
    setSuccess('')

    try {
      const formData = new FormData()
      formData.append('file', importFile)
      formData.append('sourceDocumentId', String(selectedDocumentId))
      const preview = await previewCurriculumSourceImport(formData)
      setImportPreview(preview)
      if (!preview?.valid) {
        setError('Preview import có lỗi. Vui lòng sửa file trước khi xác nhận.')
      } else {
        setSuccess(`Preview OK: ${preview.summary?.totalRecords || 0} bản ghi sẵn sàng để import.`)
      }
    } catch (requestError) {
      setImportPreview(null)
      setError(getApiMessage(requestError, 'Không xem trước được file import'))
    } finally {
      setImportBusy(false)
    }
  }

  async function handleImportConfirm() {
    if (!importPreview?.previewToken) {
      setError('Vui lòng preview file trước khi xác nhận import.')
      return
    }

    setImportBusy(true)
    setError('')
    setSuccess('')

    try {
      const result = await confirmCurriculumSourceImport(importPreview.previewToken)
      setSuccess(`Import thành công: ${result?.summary?.created || 0} tạo mới, ${result?.summary?.updated || 0} cập nhật.`)
      setImportPreview(null)
      setImportFile(null)
      await loadCatalog()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không xác nhận được import'))
    } finally {
      setImportBusy(false)
    }
  }

  async function handleSaveCurriculum(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setSuccess('')

    try {
      const payload = {
        code: String(curriculumForm.code || '').trim(),
        title: String(curriculumForm.title || '').trim(),
        description: String(curriculumForm.description || '').trim() || null,
        status: String(curriculumForm.status || 'draft').trim() || 'draft',
      }

      if (!payload.code || !payload.title) {
        throw new Error('Code va ten curriculum khong duoc de trong')
      }

      if (editingCurriculumId) {
        await updatePlatformCurriculum(editingCurriculumId, payload)
        setSuccess('Da cap nhat curriculum')
      } else {
        await createPlatformCurriculum(payload)
        setSuccess('Da tao curriculum moi')
      }

      setCurriculumForm(emptyCurriculumForm)
      setEditingCurriculumId(null)
      await loadCatalog()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong luu duoc curriculum'))
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveVersion(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setSuccess('')

    try {
      const curriculumId = normalizeNumericId(versionForm.curriculum)
      const subjectId = normalizeNumericId(versionForm.subject)
      const payload = {
        curriculum: curriculumId,
        subject: subjectId,
        versionCode: String(versionForm.versionCode || '').trim(),
        versionLabel: String(versionForm.versionLabel || '').trim() || null,
        description: String(versionForm.description || '').trim() || null,
        status: 'draft',
      }

      if (!curriculumId || !subjectId || !payload.versionCode) {
        throw new Error('Curriculum, subject va version code la bat buoc')
      }

      if (editingVersionId) {
        await updatePlatformCurriculumVersion(editingVersionId, payload)
        setSuccess('Da cap nhat draft version')
      } else {
        await createPlatformCurriculumVersion(payload)
        setSuccess('Da tao draft version moi')
      }

      setVersionForm(emptyVersionForm)
      setEditingVersionId(null)
      await loadCatalog()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong luu duoc curriculum version'))
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveScope(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setSuccess('')

    try {
      const versionId = normalizeNumericId(scopeForm.subjectCurriculumVersion)
      const gradeId = normalizeNumericId(scopeForm.curriculumGrade)
      const payload = {
        code: String(scopeForm.code || '').trim(),
        subjectCurriculumVersion: versionId,
        curriculumGrade: gradeId,
        sortOrder: Number(scopeForm.sortOrder || 0),
        status: String(scopeForm.status || 'draft').trim() || 'draft',
      }

      if (!payload.code || !versionId || !gradeId) {
        throw new Error('Code, version va grade la bat buoc')
      }

      if (editingScopeId) {
        await updatePlatformCurriculumScope(editingScopeId, payload)
        setSuccess('Da cap nhat curriculum scope')
      } else {
        await createPlatformCurriculumScope(payload)
        setSuccess('Da tao curriculum scope moi')
      }

      setScopeForm(emptyScopeForm)
      setEditingScopeId(null)
      await loadCatalog()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong luu duoc curriculum scope'))
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteCurriculum(id) {
    if (!window.confirm('Xoa curriculum nay?')) return
    setBusy(true)
    setError('')
    setSuccess('')

    try {
      await deletePlatformCurriculum(id)
      setSuccess('Da xoa curriculum')
      if (editingCurriculumId === id) {
        setEditingCurriculumId(null)
        setCurriculumForm(emptyCurriculumForm)
      }
      await loadCatalog()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong xoa duoc curriculum'))
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteVersion(id) {
    if (!window.confirm('Xoa draft version nay?')) return
    setBusy(true)
    setError('')
    setSuccess('')

    try {
      await deletePlatformCurriculumVersion(id)
      setSuccess('Da xoa version')
      if (editingVersionId === id) {
        setEditingVersionId(null)
        setVersionForm(emptyVersionForm)
      }
      await loadCatalog()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong xoa duoc curriculum version'))
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteScope(id) {
    if (!window.confirm('Xoa scope nay?')) return
    setBusy(true)
    setError('')
    setSuccess('')

    try {
      await deletePlatformCurriculumScope(id)
      setSuccess('Da xoa scope')
      if (editingScopeId === id) {
        setEditingScopeId(null)
        setScopeForm(emptyScopeForm)
      }
      await loadCatalog()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong xoa duoc scope'))
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveSubject(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setSuccess('')

    try {
      const payload = {
        code: String(subjectForm.code || '').trim(),
        name: String(subjectForm.name || '').trim(),
        description: String(subjectForm.description || '').trim() || null,
        status: String(subjectForm.status || 'active').trim() || 'active',
      }

      if (!payload.code || !payload.name) {
        throw new Error('Code va ten mon hoc khong duoc de trong')
      }

      if (editingSubjectId) {
        await updatePlatformCurriculumSubject(editingSubjectId, payload)
        setSuccess('Da cap nhat mon hoc')
      } else {
        await createPlatformCurriculumSubject(payload)
        setSuccess('Da tao mon hoc moi')
      }

      setSubjectForm(emptySubjectForm)
      setEditingSubjectId(null)
      await loadCatalog()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong luu duoc mon hoc'))
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteSubject(id) {
    if (!window.confirm('Xoa mon hoc nay?')) return
    setBusy(true)
    setError('')
    setSuccess('')

    try {
      await deletePlatformCurriculumSubject(id)
      setSuccess('Da xoa mon hoc')
      if (editingSubjectId === id) {
        setEditingSubjectId(null)
        setSubjectForm(emptySubjectForm)
      }
      await loadCatalog()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong xoa duoc mon hoc'))
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveEducationLevel(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setSuccess('')

    try {
      const payload = {
        code: String(educationLevelForm.code || '').trim(),
        name: String(educationLevelForm.name || '').trim(),
        sortOrder: Number(educationLevelForm.sortOrder || 0),
      }

      if (!payload.code || !payload.name) {
        throw new Error('Code va ten cap hoc khong duoc de trong')
      }

      if (editingEducationLevelId) {
        await updatePlatformCurriculumEducationLevel(editingEducationLevelId, payload)
        setSuccess('Da cap nhat cap hoc')
      } else {
        await createPlatformCurriculumEducationLevel(payload)
        setSuccess('Da tao cap hoc moi')
      }

      setEducationLevelForm(emptyEducationLevelForm)
      setEditingEducationLevelId(null)
      await loadCatalog()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong luu duoc cap hoc'))
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteEducationLevel(id) {
    if (!window.confirm('Xoa cap hoc nay?')) return
    setBusy(true)
    setError('')
    setSuccess('')

    try {
      await deletePlatformCurriculumEducationLevel(id)
      setSuccess('Da xoa cap hoc')
      if (editingEducationLevelId === id) {
        setEditingEducationLevelId(null)
        setEducationLevelForm(emptyEducationLevelForm)
      }
      await loadCatalog()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong xoa duoc cap hoc'))
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveGrade(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setSuccess('')

    try {
      const educationLevelId = normalizeNumericId(gradeForm.educationLevel)
      const payload = {
        code: String(gradeForm.code || '').trim(),
        name: String(gradeForm.name || '').trim(),
        gradeNumber: Number(gradeForm.gradeNumber || 0),
        educationLevel: educationLevelId,
        sortOrder: Number(gradeForm.sortOrder || 0),
      }

      if (!payload.code || !payload.name || !educationLevelId) {
        throw new Error('Code, ten va cap hoc la bat buoc')
      }

      if (editingGradeId) {
        await updatePlatformCurriculumGrade(editingGradeId, payload)
        setSuccess('Da cap nhat lop hoc')
      } else {
        await createPlatformCurriculumGrade(payload)
        setSuccess('Da tao lop hoc moi')
      }

      setGradeForm(emptyGradeForm)
      setEditingGradeId(null)
      await loadCatalog()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong luu duoc lop hoc'))
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteGrade(id) {
    if (!window.confirm('Xoa lop hoc nay?')) return
    setBusy(true)
    setError('')
    setSuccess('')

    try {
      await deletePlatformCurriculumGrade(id)
      setSuccess('Da xoa lop hoc')
      if (editingGradeId === id) {
        setEditingGradeId(null)
        setGradeForm(emptyGradeForm)
      }
      await loadCatalog()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong xoa duoc lop hoc'))
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveDocument(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setSuccess('')

    try {
      const payload = {
        code: String(documentForm.code || '').trim(),
        title: String(documentForm.title || '').trim(),
        documentNumber: String(documentForm.documentNumber || '').trim() || null,
        issuedDate: String(documentForm.issuedDate || '').trim() || null,
        description: String(documentForm.description || '').trim() || null,
        fileRef: String(documentForm.fileRef || '').trim() || null,
        status: String(documentForm.status || 'draft').trim() || 'draft',
      }

      if (!payload.code || !payload.title) {
        throw new Error('Code va title tai lieu la bat buoc')
      }

      if (editingDocumentId) {
        await updatePlatformCurriculumDocument(editingDocumentId, payload)
        setSuccess('Da cap nhat tai lieu nguon')
      } else {
        await createPlatformCurriculumDocument(payload)
        setSuccess('Da tao tai lieu nguon moi')
      }

      setDocumentForm(emptyDocumentForm)
      setEditingDocumentId(null)
      await loadCatalog()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong luu duoc tai lieu nguon'))
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteDocument(id) {
    if (!window.confirm('Xoa tai lieu nguon nay?')) return
    setBusy(true)
    setError('')
    setSuccess('')

    try {
      await deletePlatformCurriculumDocument(id)
      setSuccess('Da xoa tai lieu nguon')
      if (editingDocumentId === id) {
        setEditingDocumentId(null)
        setDocumentForm(emptyDocumentForm)
      }
      await loadCatalog()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong xoa duoc tai lieu nguon'))
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveSection(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setSuccess('')

    try {
      const sourceDocumentId = normalizeNumericId(sectionForm.sourceDocument)
      const parentId = normalizeNumericId(sectionForm.parent)
      const payload = {
        sourceDocument: sourceDocumentId,
        parent: parentId || null,
        sectionType: String(sectionForm.sectionType || '').trim() || null,
        title: String(sectionForm.title || '').trim(),
        body: String(sectionForm.body || '').trim() || null,
        sortOrder: Number(sectionForm.sortOrder || 0),
      }

      if (!sourceDocumentId || !payload.title) {
        throw new Error('Tai lieu va tieu de section la bat buoc')
      }

      if (editingSectionId) {
        await updatePlatformCurriculumSection(editingSectionId, payload)
        setSuccess('Da cap nhat section')
      } else {
        await createPlatformCurriculumSection(payload)
        setSuccess('Da tao section moi')
      }

      setSectionForm(emptySectionForm)
      setEditingSectionId(null)
      await loadCatalog()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong luu duoc section'))
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteSection(id) {
    if (!window.confirm('Xoa section nay?')) return
    setBusy(true)
    setError('')
    setSuccess('')

    try {
      await deletePlatformCurriculumSection(id)
      setSuccess('Da xoa section')
      if (editingSectionId === id) {
        setEditingSectionId(null)
        setSectionForm(emptySectionForm)
      }
      await loadCatalog()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong xoa duoc section'))
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveLocation(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setSuccess('')

    try {
      const sourceDocumentId = normalizeNumericId(locationForm.sourceDocument)
      const sectionId = normalizeNumericId(locationForm.section)
      const startPage = String(locationForm.startPage || '').trim()
      const endPage = String(locationForm.endPage || '').trim()
      const payload = {
        sourceDocument: sourceDocumentId,
        section: sectionId || null,
        startPage: startPage ? Number(startPage) : null,
        endPage: endPage ? Number(endPage) : null,
        locator: String(locationForm.locator || '').trim() || null,
        excerpt: String(locationForm.excerpt || '').trim() || null,
      }

      if (!sourceDocumentId) {
        throw new Error('Tai lieu la bat buoc')
      }

      if (payload.startPage !== null && payload.endPage !== null && payload.endPage < payload.startPage) {
        throw new Error('End Page phai lon hon hoac bang Start Page')
      }

      if (editingLocationId) {
        await updatePlatformCurriculumLocation(editingLocationId, payload)
        setSuccess('Da cap nhat vi tri tham chieu')
      } else {
        await createPlatformCurriculumLocation(payload)
        setSuccess('Da tao vi tri tham chieu moi')
      }

      setLocationForm(emptyLocationForm)
      setEditingLocationId(null)
      await loadCatalog()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong luu duoc vi tri tham chieu'))
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteLocation(id) {
    if (!window.confirm('Xoa vi tri tham chieu nay?')) return
    setBusy(true)
    setError('')
    setSuccess('')

    try {
      await deletePlatformCurriculumLocation(id)
      setSuccess('Da xoa vi tri tham chieu')
      if (editingLocationId === id) {
        setEditingLocationId(null)
        setLocationForm(emptyLocationForm)
      }
      await loadCatalog()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong xoa duoc vi tri tham chieu'))
    } finally {
      setBusy(false)
    }
  }

  const tabItems = [
    { key: 'overview', label: 'Tổng quan' },
    { key: 'versions', label: 'Phiên bản' },
    { key: 'standards', label: 'Danh mục chuẩn' },
    { key: 'source', label: 'Nguồn tài liệu' },
    { key: 'content', label: 'Nội dung & năng lực' },
  ]

  const renderOverview = () => (
    <>
      <CRow className='g-3 mb-4'>
        <CCol md={3}>
          <CCard>
            <CCardBody>
              <div className='text-body-secondary'>Curricula</div>
              <div className='fs-3 fw-semibold'>{catalog.curricula.length}</div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol md={3}>
          <CCard>
            <CCardBody>
              <div className='text-body-secondary'>Subjects</div>
              <div className='fs-3 fw-semibold'>{catalog.subjects.length}</div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol md={3}>
          <CCard>
            <CCardBody>
              <div className='text-body-secondary'>Draft versions</div>
              <div className='fs-3 fw-semibold'>{catalog.versions.filter((item) => String(item.status || '').toLowerCase() === 'draft').length}</div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol md={3}>
          <CCard>
            <CCardBody>
              <div className='text-body-secondary'>Scopes</div>
              <div className='fs-3 fw-semibold'>{catalog.scopes.length}</div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      <CRow className='g-3'>
        <CCol lg={8}>
          <CCard className='h-100'>
            <CCardHeader><strong>Danh sách chương trình</strong></CCardHeader>
            <CCardBody>
              {loading ? (
                <div className='d-flex align-items-center gap-2'><CSpinner size='sm' /> Dang tai...</div>
              ) : (
                <CTable responsive hover size='sm'>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Code</CTableHeaderCell>
                      <CTableHeaderCell>Ten</CTableHeaderCell>
                      <CTableHeaderCell>Status</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {catalog.curricula.length === 0 ? (
                      <CTableRow>
                        <CTableDataCell colSpan={3} className='text-body-secondary'>Chua co curriculum nao</CTableDataCell>
                      </CTableRow>
                    ) : (
                      catalog.curricula.map((item) => (
                        <CTableRow key={item.id}>
                          <CTableDataCell>{item.code || '-'}</CTableDataCell>
                          <CTableDataCell>{item.title || '-'}</CTableDataCell>
                          <CTableDataCell>{formatStatusBadge(item.status)}</CTableDataCell>
                        </CTableRow>
                      ))
                    )}
                  </CTableBody>
                </CTable>
              )}
            </CCardBody>
          </CCard>
        </CCol>

        <CCol lg={4}>
          <CCard className='h-100'>
            <CCardHeader><strong>Phiên bản gần đây</strong></CCardHeader>
            <CCardBody>
              {catalog.versions.length === 0 ? (
                <div className='text-body-secondary'>Chua co version nao</div>
              ) : (
                <div className='d-flex flex-column gap-2'>
                  {catalog.versions.slice(0, 6).map((item) => (
                    <div key={item.id} className='border rounded p-2'>
                      <div className='fw-semibold'>{item.versionCode || '-'}</div>
                      <div className='small text-body-secondary'>{item.curriculum?.code || 'Curriculum'} / {item.subject?.code || 'Subject'}</div>
                      <div className='mt-1'>{formatStatusBadge(item.status)}</div>
                    </div>
                  ))}
                </div>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </>
  )

  const renderVersions = () => (
    <>
      <CRow className='g-3 mb-4'>
        <CCol lg={6}>
          <CCard>
            <CCardHeader><strong>Phiên bản draft</strong></CCardHeader>
            <CCardBody>
              <form onSubmit={handleSaveVersion}>
                <div className='mb-3'>
                  <CFormLabel htmlFor='version-curriculum'>Curriculum</CFormLabel>
                  <CFormSelect id='version-curriculum' value={versionForm.curriculum} onChange={(event) => handleVersionField('curriculum', event.target.value)}>
                    <option value=''>-- Chon curriculum --</option>
                    {catalog.curricula.map((item) => (
                      <option key={item.id} value={item.id}>{item.code} - {item.title}</option>
                    ))}
                  </CFormSelect>
                </div>
                <div className='mb-3'>
                  <CFormLabel htmlFor='version-subject'>Mon hoc</CFormLabel>
                  <CFormSelect id='version-subject' value={versionForm.subject} onChange={(event) => handleVersionField('subject', event.target.value)}>
                    <option value=''>-- Chon mon hoc --</option>
                    {catalog.subjects.map((item) => (
                      <option key={item.id} value={item.id}>{item.code} - {item.name}</option>
                    ))}
                  </CFormSelect>
                </div>
                <div className='mb-3'>
                  <CFormLabel htmlFor='version-code'>Version code</CFormLabel>
                  <CFormInput id='version-code' value={versionForm.versionCode} onChange={(event) => handleVersionField('versionCode', event.target.value)} />
                </div>
                <div className='mb-3'>
                  <CFormLabel htmlFor='version-label'>Version label</CFormLabel>
                  <CFormInput id='version-label' value={versionForm.versionLabel} onChange={(event) => handleVersionField('versionLabel', event.target.value)} />
                </div>
                <div className='mb-3'>
                  <CFormLabel htmlFor='version-description'>Mo ta</CFormLabel>
                  <CFormTextarea id='version-description' rows={3} value={versionForm.description} onChange={(event) => handleVersionField('description', event.target.value)} />
                </div>
                <div className='d-flex gap-2'>
                  <CButton type='submit' color='primary' disabled={busy}>{editingVersionId ? 'Cap nhat' : 'Tao moi'}</CButton>
                  {editingVersionId ? (
                    <CButton type='button' color='secondary' variant='outline' onClick={() => { setEditingVersionId(null); setVersionForm(emptyVersionForm) }}>
                      Huy
                    </CButton>
                  ) : null}
                </div>
              </form>
            </CCardBody>
          </CCard>
        </CCol>

        <CCol lg={6}>
          <CCard>
            <CCardHeader><strong>Danh sach draft version</strong></CCardHeader>
            <CCardBody>
              <CTable responsive hover size='sm'>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Code</CTableHeaderCell>
                    <CTableHeaderCell>Status</CTableHeaderCell>
                    <CTableHeaderCell className='text-end'>Action</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {catalog.versions.length === 0 ? (
                    <CTableRow>
                      <CTableDataCell colSpan={3} className='text-body-secondary'>Chua co version nao</CTableDataCell>
                    </CTableRow>
                  ) : (
                    catalog.versions.map((item) => (
                      <CTableRow key={item.id}>
                        <CTableDataCell>{item.versionCode || '-'}</CTableDataCell>
                        <CTableDataCell>{formatStatusBadge(item.status)}</CTableDataCell>
                        <CTableDataCell className='text-end'>
                          <div className='d-flex gap-2 justify-content-end'>
                            <CButton size='sm' color='secondary' variant='outline' onClick={() => {
                              setEditingVersionId(item.id)
                              setVersionForm({
                                curriculum: item.curriculum?.id || '',
                                subject: item.subject?.id || '',
                                versionCode: item.versionCode || '',
                                versionLabel: item.versionLabel || '',
                                description: item.description || '',
                                status: item.status || 'draft',
                              })
                            }}>
                              Sua
                            </CButton>
                            <CButton size='sm' color='danger' variant='outline' onClick={() => handleDeleteVersion(item.id)}>
                              Xoa
                            </CButton>
                          </div>
                        </CTableDataCell>
                      </CTableRow>
                    ))
                  )}
                </CTableBody>
              </CTable>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      <CRow className='g-3'>
        <CCol lg={6}>
          <CCard>
            <CCardHeader><strong>Curriculum Scope theo lop</strong></CCardHeader>
            <CCardBody>
              <form onSubmit={handleSaveScope}>
                <div className='mb-3'>
                  <CFormLabel htmlFor='scope-version'>Version</CFormLabel>
                  <CFormSelect id='scope-version' value={scopeForm.subjectCurriculumVersion} onChange={(event) => handleScopeField('subjectCurriculumVersion', event.target.value)}>
                    <option value=''>-- Chon version --</option>
                    {catalog.versions.map((item) => (
                      <option key={item.id} value={item.id}>{item.versionCode}</option>
                    ))}
                  </CFormSelect>
                </div>
                <div className='mb-3'>
                  <CFormLabel htmlFor='scope-grade'>Grade</CFormLabel>
                  <CFormSelect id='scope-grade' value={scopeForm.curriculumGrade} onChange={(event) => handleScopeField('curriculumGrade', event.target.value)}>
                    <option value=''>-- Chon lop --</option>
                    {catalog.grades.map((item) => (
                      <option key={item.id} value={item.id}>{item.code} - {item.name}</option>
                    ))}
                  </CFormSelect>
                </div>
                <div className='mb-3'>
                  <CFormLabel htmlFor='scope-code'>Scope code</CFormLabel>
                  <CFormInput id='scope-code' value={scopeForm.code} onChange={(event) => handleScopeField('code', event.target.value)} />
                </div>
                <div className='mb-3'>
                  <CFormLabel htmlFor='scope-sort-order'>Sort order</CFormLabel>
                  <CFormInput id='scope-sort-order' type='number' value={scopeForm.sortOrder} onChange={(event) => handleScopeField('sortOrder', event.target.value)} />
                </div>
                <div className='d-flex gap-2'>
                  <CButton type='submit' color='primary' disabled={busy}>{editingScopeId ? 'Cap nhat' : 'Tao moi'}</CButton>
                  {editingScopeId ? (
                    <CButton type='button' color='secondary' variant='outline' onClick={() => { setEditingScopeId(null); setScopeForm(emptyScopeForm) }}>
                      Huy
                    </CButton>
                  ) : null}
                </div>
              </form>
            </CCardBody>
          </CCard>
        </CCol>

        <CCol lg={6}>
          <CCard>
            <CCardHeader><strong>Danh sach scope</strong></CCardHeader>
            <CCardBody>
              <CTable responsive hover size='sm'>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Code</CTableHeaderCell>
                    <CTableHeaderCell>Version</CTableHeaderCell>
                    <CTableHeaderCell className='text-end'>Action</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {catalog.scopes.length === 0 ? (
                    <CTableRow>
                      <CTableDataCell colSpan={3} className='text-body-secondary'>Chua co scope nao</CTableDataCell>
                    </CTableRow>
                  ) : (
                    catalog.scopes.map((item) => (
                      <CTableRow key={item.id}>
                        <CTableDataCell>{item.code || '-'}</CTableDataCell>
                        <CTableDataCell>{item.subjectCurriculumVersion?.versionCode || '-'}</CTableDataCell>
                        <CTableDataCell className='text-end'>
                          <div className='d-flex gap-2 justify-content-end'>
                            <CButton size='sm' color='secondary' variant='outline' onClick={() => {
                              setEditingScopeId(item.id)
                              setScopeForm({
                                code: item.code || '',
                                subjectCurriculumVersion: item.subjectCurriculumVersion?.id || '',
                                curriculumGrade: item.curriculumGrade?.id || '',
                                sortOrder: String(item.sortOrder ?? 0),
                                status: item.status || 'draft',
                              })
                            }}>
                              Sua
                            </CButton>
                            <CButton size='sm' color='danger' variant='outline' onClick={() => handleDeleteScope(item.id)}>
                              Xoa
                            </CButton>
                          </div>
                        </CTableDataCell>
                      </CTableRow>
                    ))
                  )}
                </CTableBody>
              </CTable>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </>
  )

  const renderStandards = () => (
    <CRow className='g-3'>
      <CCol lg={4}>
        <CCard className='h-100'>
          <CCardHeader className='d-flex justify-content-between align-items-center'>
            <strong>Curriculum</strong>
            <CButton size='sm' color='primary' variant='outline' onClick={() => setActiveTab('overview')}>Xem nhanh</CButton>
          </CCardHeader>
          <CCardBody>
            <form onSubmit={handleSaveCurriculum}>
              <div className='mb-3'>
                <CFormLabel htmlFor='curriculum-code'>Code</CFormLabel>
                <CFormInput id='curriculum-code' value={curriculumForm.code} onChange={(event) => handleCurriculumField('code', event.target.value)} />
              </div>
              <div className='mb-3'>
                <CFormLabel htmlFor='curriculum-title'>Ten</CFormLabel>
                <CFormInput id='curriculum-title' value={curriculumForm.title} onChange={(event) => handleCurriculumField('title', event.target.value)} />
              </div>
              <div className='mb-3'>
                <CFormLabel htmlFor='curriculum-status'>Status</CFormLabel>
                <CFormSelect id='curriculum-status' value={curriculumForm.status} onChange={(event) => handleCurriculumField('status', event.target.value)}>
                  <option value='draft'>Draft</option>
                  <option value='active'>Active</option>
                  <option value='archived'>Archived</option>
                </CFormSelect>
              </div>
              <div className='mb-3'>
                <CFormLabel htmlFor='curriculum-description'>Mo ta</CFormLabel>
                <CFormTextarea id='curriculum-description' rows={3} value={curriculumForm.description} onChange={(event) => handleCurriculumField('description', event.target.value)} />
              </div>
              <div className='d-flex gap-2'>
                <CButton type='submit' color='primary' disabled={busy}>{editingCurriculumId ? 'Cap nhat' : 'Tao moi'}</CButton>
                {editingCurriculumId ? (
                  <CButton type='button' color='secondary' variant='outline' onClick={() => { setEditingCurriculumId(null); setCurriculumForm(emptyCurriculumForm) }}>
                    Huy
                  </CButton>
                ) : null}
              </div>
            </form>

            <CTable responsive hover size='sm' className='mt-4'>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Code</CTableHeaderCell>
                  <CTableHeaderCell>Ten</CTableHeaderCell>
                  <CTableHeaderCell className='text-end'>Action</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {catalog.curricula.length === 0 ? (
                  <CTableRow>
                    <CTableDataCell colSpan={3} className='text-body-secondary'>Chua co curriculum nao</CTableDataCell>
                  </CTableRow>
                ) : (
                  catalog.curricula.map((item) => (
                    <CTableRow key={item.id}>
                      <CTableDataCell>{item.code || '-'}</CTableDataCell>
                      <CTableDataCell>{item.title || '-'}</CTableDataCell>
                      <CTableDataCell className='text-end'>
                        <div className='d-flex gap-2 justify-content-end'>
                          <CButton size='sm' color='secondary' variant='outline' onClick={() => {
                            setEditingCurriculumId(item.id)
                            setCurriculumForm({
                              code: item.code || '',
                              title: item.title || '',
                              description: item.description || '',
                              status: item.status || 'draft',
                            })
                          }}>
                            Sua
                          </CButton>
                          <CButton size='sm' color='danger' variant='outline' onClick={() => handleDeleteCurriculum(item.id)}>
                            Xoa
                          </CButton>
                        </div>
                      </CTableDataCell>
                    </CTableRow>
                  ))
                )}
              </CTableBody>
            </CTable>
          </CCardBody>
        </CCard>
      </CCol>

      <CCol lg={4}>
        <CCard className='h-100'>
          <CCardHeader><strong>Mon hoc</strong></CCardHeader>
          <CCardBody>
            <form onSubmit={handleSaveSubject} className='mb-3'>
              <div className='mb-3'>
                <CFormLabel htmlFor='subject-code'>Code</CFormLabel>
                <CFormInput id='subject-code' value={subjectForm.code} onChange={(event) => handleSubjectField('code', event.target.value)} />
              </div>
              <div className='mb-3'>
                <CFormLabel htmlFor='subject-name'>Ten</CFormLabel>
                <CFormInput id='subject-name' value={subjectForm.name} onChange={(event) => handleSubjectField('name', event.target.value)} />
              </div>
              <div className='mb-3'>
                <CFormLabel htmlFor='subject-status'>Trang thai</CFormLabel>
                <CFormSelect id='subject-status' value={subjectForm.status} onChange={(event) => handleSubjectField('status', event.target.value)}>
                  <option value='active'>Active</option>
                  <option value='archived'>Archived</option>
                </CFormSelect>
              </div>
              <div className='mb-3'>
                <CFormLabel htmlFor='subject-description'>Mo ta</CFormLabel>
                <CFormTextarea id='subject-description' rows={2} value={subjectForm.description} onChange={(event) => handleSubjectField('description', event.target.value)} />
              </div>
              <div className='d-flex gap-2'>
                <CButton type='submit' color='primary' disabled={busy}>{editingSubjectId ? 'Cap nhat' : 'Them moi'}</CButton>
                {editingSubjectId ? (
                  <CButton type='button' color='secondary' variant='outline' onClick={() => { setEditingSubjectId(null); setSubjectForm(emptySubjectForm) }}>
                    Huy
                  </CButton>
                ) : null}
              </div>
            </form>

            <CTable responsive hover size='sm'>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Code</CTableHeaderCell>
                  <CTableHeaderCell>Ten</CTableHeaderCell>
                  <CTableHeaderCell className='text-end'>Action</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {catalog.subjects.length === 0 ? (
                  <CTableRow>
                    <CTableDataCell colSpan={3} className='text-body-secondary'>Chua co du lieu</CTableDataCell>
                  </CTableRow>
                ) : (
                  [...catalog.subjects].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))).map((item) => (
                    <CTableRow key={item.id}>
                      <CTableDataCell>{item.code || '-'}</CTableDataCell>
                      <CTableDataCell>{item.name || '-'}</CTableDataCell>
                      <CTableDataCell className='text-end'>
                        <div className='d-flex gap-2 justify-content-end'>
                          <CButton size='sm' color='secondary' variant='outline' onClick={() => {
                            setEditingSubjectId(item.id)
                            setSubjectForm({
                              code: item.code || '',
                              name: item.name || '',
                              description: item.description || '',
                              status: item.status || 'active',
                            })
                          }}>
                            Sua
                          </CButton>
                          <CButton size='sm' color='danger' variant='outline' onClick={() => handleDeleteSubject(item.id)}>
                            Xoa
                          </CButton>
                        </div>
                      </CTableDataCell>
                    </CTableRow>
                  ))
                )}
              </CTableBody>
            </CTable>
          </CCardBody>
        </CCard>
      </CCol>

      <CCol lg={4}>
        <CCard className='h-100'>
          <CCardHeader><strong>Cap hoc</strong></CCardHeader>
          <CCardBody>
            <form onSubmit={handleSaveEducationLevel} className='mb-3'>
              <div className='mb-3'>
                <CFormLabel htmlFor='education-code'>Code</CFormLabel>
                <CFormInput id='education-code' value={educationLevelForm.code} onChange={(event) => handleEducationLevelField('code', event.target.value)} />
              </div>
              <div className='mb-3'>
                <CFormLabel htmlFor='education-name'>Ten</CFormLabel>
                <CFormInput id='education-name' value={educationLevelForm.name} onChange={(event) => handleEducationLevelField('name', event.target.value)} />
              </div>
              <div className='mb-3'>
                <CFormLabel htmlFor='education-sort-order'>Thu tu</CFormLabel>
                <CFormInput id='education-sort-order' type='number' value={educationLevelForm.sortOrder} onChange={(event) => handleEducationLevelField('sortOrder', event.target.value)} />
              </div>
              <div className='d-flex gap-2'>
                <CButton type='submit' color='primary' disabled={busy}>{editingEducationLevelId ? 'Cap nhat' : 'Them moi'}</CButton>
                {editingEducationLevelId ? (
                  <CButton type='button' color='secondary' variant='outline' onClick={() => { setEditingEducationLevelId(null); setEducationLevelForm(emptyEducationLevelForm) }}>
                    Huy
                  </CButton>
                ) : null}
              </div>
            </form>

            <CTable responsive hover size='sm'>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Code</CTableHeaderCell>
                  <CTableHeaderCell>Ten</CTableHeaderCell>
                  <CTableHeaderCell className='text-end'>Action</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {catalog.educationLevels.length === 0 ? (
                  <CTableRow>
                    <CTableDataCell colSpan={3} className='text-body-secondary'>Chua co du lieu</CTableDataCell>
                  </CTableRow>
                ) : (
                  [...catalog.educationLevels].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || String(a.name || '').localeCompare(String(b.name || ''))).map((item) => (
                    <CTableRow key={item.id}>
                      <CTableDataCell>{item.code || '-'}</CTableDataCell>
                      <CTableDataCell>{item.name || '-'}</CTableDataCell>
                      <CTableDataCell className='text-end'>
                        <div className='d-flex gap-2 justify-content-end'>
                          <CButton size='sm' color='secondary' variant='outline' onClick={() => {
                            setEditingEducationLevelId(item.id)
                            setEducationLevelForm({
                              code: item.code || '',
                              name: item.name || '',
                              sortOrder: String(item.sortOrder ?? 0),
                            })
                          }}>
                            Sua
                          </CButton>
                          <CButton size='sm' color='danger' variant='outline' onClick={() => handleDeleteEducationLevel(item.id)}>
                            Xoa
                          </CButton>
                        </div>
                      </CTableDataCell>
                    </CTableRow>
                  ))
                )}
              </CTableBody>
            </CTable>
          </CCardBody>
        </CCard>
      </CCol>

      <CCol lg={4}>
        <CCard className='h-100'>
          <CCardHeader><strong>Lop hoc</strong></CCardHeader>
          <CCardBody>
            <form onSubmit={handleSaveGrade} className='mb-3'>
              <div className='mb-3'>
                <CFormLabel htmlFor='grade-code'>Code</CFormLabel>
                <CFormInput id='grade-code' value={gradeForm.code} onChange={(event) => handleGradeField('code', event.target.value)} />
              </div>
              <div className='mb-3'>
                <CFormLabel htmlFor='grade-name'>Ten</CFormLabel>
                <CFormInput id='grade-name' value={gradeForm.name} onChange={(event) => handleGradeField('name', event.target.value)} />
              </div>
              <div className='mb-3'>
                <CFormLabel htmlFor='grade-number'>So lop</CFormLabel>
                <CFormInput id='grade-number' type='number' value={gradeForm.gradeNumber} onChange={(event) => handleGradeField('gradeNumber', event.target.value)} />
              </div>
              <div className='mb-3'>
                <CFormLabel htmlFor='grade-education-level'>Cap hoc</CFormLabel>
                <CFormSelect id='grade-education-level' value={gradeForm.educationLevel} onChange={(event) => handleGradeField('educationLevel', event.target.value)}>
                  <option value=''>-- Chon cap hoc --</option>
                  {catalog.educationLevels.map((item) => (
                    <option key={item.id} value={item.id}>{item.code} - {item.name}</option>
                  ))}
                </CFormSelect>
              </div>
              <div className='mb-3'>
                <CFormLabel htmlFor='grade-sort-order'>Thu tu</CFormLabel>
                <CFormInput id='grade-sort-order' type='number' value={gradeForm.sortOrder} onChange={(event) => handleGradeField('sortOrder', event.target.value)} />
              </div>
              <div className='d-flex gap-2'>
                <CButton type='submit' color='primary' disabled={busy}>{editingGradeId ? 'Cap nhat' : 'Them moi'}</CButton>
                {editingGradeId ? (
                  <CButton type='button' color='secondary' variant='outline' onClick={() => { setEditingGradeId(null); setGradeForm(emptyGradeForm) }}>
                    Huy
                  </CButton>
                ) : null}
              </div>
            </form>

            <CTable responsive hover size='sm'>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Code</CTableHeaderCell>
                  <CTableHeaderCell>Ten</CTableHeaderCell>
                  <CTableHeaderCell className='text-end'>Action</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {catalog.grades.length === 0 ? (
                  <CTableRow>
                    <CTableDataCell colSpan={3} className='text-body-secondary'>Chua co du lieu</CTableDataCell>
                  </CTableRow>
                ) : (
                  [...catalog.grades].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || Number(a.gradeNumber || 0) - Number(b.gradeNumber || 0)).map((item) => (
                    <CTableRow key={item.id}>
                      <CTableDataCell>{item.code || '-'}</CTableDataCell>
                      <CTableDataCell>{item.name || '-'}</CTableDataCell>
                      <CTableDataCell className='text-end'>
                        <div className='d-flex gap-2 justify-content-end'>
                          <CButton size='sm' color='secondary' variant='outline' onClick={() => {
                            setEditingGradeId(item.id)
                            setGradeForm({
                              code: item.code || '',
                              name: item.name || '',
                              gradeNumber: String(item.gradeNumber ?? 6),
                              educationLevel: item.educationLevel?.id || item.educationLevel || '',
                              sortOrder: String(item.sortOrder ?? 0),
                            })
                          }}>
                            Sua
                          </CButton>
                          <CButton size='sm' color='danger' variant='outline' onClick={() => handleDeleteGrade(item.id)}>
                            Xoa
                          </CButton>
                        </div>
                      </CTableDataCell>
                    </CTableRow>
                  ))
                )}
              </CTableBody>
            </CTable>
          </CCardBody>
        </CCard>
      </CCol>

      <CCol lg={4}>
        <CCard className='h-100'>
          <CCardHeader className='d-flex justify-content-between align-items-center'>
            <strong>Source Document</strong>
            <CButton size='sm' color='primary' onClick={() => openDocumentModal()}>
              + Moi
            </CButton>
          </CCardHeader>
          <CCardBody>
            {catalog.documents.length === 0 ? (
              <div className='text-body-secondary'>Chua co tai lieu nguon</div>
            ) : (
              <CTable responsive hover size='sm'>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Title</CTableHeaderCell>
                    <CTableHeaderCell className='text-end'>Action</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {catalog.documents.map((item) => (
                    <CTableRow key={item.id}>
                      <CTableDataCell>
                        <div className='fw-semibold'>{item.title || item.code || 'Document'}</div>
                        <div className='small text-body-secondary'>{item.code || '-'}</div>
                      </CTableDataCell>
                      <CTableDataCell className='text-end'>
                        <div className='d-flex gap-2 justify-content-end'>
                          <CButton size='sm' color='secondary' variant='outline' onClick={() => openDocumentModal(item)}>
                            Sua
                          </CButton>
                          <CButton size='sm' color='danger' variant='outline' onClick={() => handleDeleteDocument(item.id)}>
                            Xoa
                          </CButton>
                        </div>
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>
            )}
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )

  const sourceDocumentDetail = catalog.documents.find((item) => String(item.id) === String(selectedDocumentId)) || null
  const sourceDocumentLookup = buildRelationLookup(catalog.documents)
  const sourceSectionLookup = buildRelationLookup(catalog.sections)
  const sourceDocumentSections = catalog.sections.filter((section) => String(getRelationId(section.sourceDocument, sourceDocumentLookup)) === String(selectedDocumentId))
  const sourceParentSectionMap = new Map()
  sourceDocumentSections.forEach((section) => {
    const canonicalSectionId = getRelationId(section, sourceSectionLookup) || String(section.documentId || section.id || '')
    if (!canonicalSectionId) return
    if (!sourceParentSectionMap.has(canonicalSectionId)) sourceParentSectionMap.set(canonicalSectionId, section)
  })
  const selectableParentSections = Array.from(sourceParentSectionMap.values()).filter((section) => String(getRelationId(section, sourceSectionLookup)) !== String(editingSectionId || ''))
  const sourceDocumentLocations = catalog.locations.filter((location) => String(getRelationId(location.sourceDocument, sourceDocumentLookup)) === String(selectedDocumentId))
  const visibleSourceLocations = selectedSectionId
    ? sourceDocumentLocations.filter((location) => String(getRelationId(location.section, sourceSectionLookup)) === String(selectedSectionId))
    : sourceDocumentLocations

  const openDocumentModal = (document = null) => {
    if (document) {
      setEditingDocumentId(document.id)
      setDocumentForm({
        code: document.code || '',
        title: document.title || '',
        documentNumber: document.documentNumber || '',
        issuedDate: document.issuedDate ? String(document.issuedDate).slice(0, 10) : '',
        description: document.description || '',
        fileRef: document.fileRef || '',
        checksum: document.checksum || '',
        status: document.status || 'draft',
      })
    } else {
      setEditingDocumentId(null)
      setDocumentForm({ ...emptyDocumentForm, status: 'draft' })
    }
    setDocumentModalVisible(true)
  }

  const closeDocumentModal = () => {
    setDocumentModalVisible(false)
    setEditingDocumentId(null)
    setDocumentForm(emptyDocumentForm)
  }

  const openSectionModal = (section = null) => {
    if (section) {
      const sectionId = getRelationId(section, sourceSectionLookup) || String(section.id || '')
      const parentId = getRelationId(section.parent, sourceSectionLookup)
      setEditingSectionId(sectionId)
      setSectionForm({
        sourceDocument: getRelationId(section.sourceDocument || selectedDocumentId, sourceDocumentLookup),
        parent: parentId,
        sectionType: section.sectionType || '',
        title: section.title || '',
        body: section.body || '',
        sortOrder: String(section.sortOrder ?? 0),
      })
    } else {
      setEditingSectionId(null)
      setSectionForm({
        ...emptySectionForm,
        sourceDocument: selectedDocumentId || '',
        parent: selectedSectionId || '',
      })
    }
    setSectionModalVisible(true)
  }

  const closeSectionModal = () => {
    setSectionModalVisible(false)
    setEditingSectionId(null)
    setSectionForm({ ...emptySectionForm, sourceDocument: selectedDocumentId || '' })
  }

  const openLocationModal = (location = null) => {
    if (location) {
      setEditingLocationId(location.id)
      setLocationForm({
        sourceDocument: getRelationId(location.sourceDocument, sourceDocumentLookup) || selectedDocumentId || '',
        section: getRelationId(location.section, sourceSectionLookup) || '',
        startPage: location.startPage !== null && location.startPage !== undefined ? String(location.startPage) : '',
        endPage: location.endPage !== null && location.endPage !== undefined ? String(location.endPage) : '',
        locator: location.locator || '',
        excerpt: location.excerpt || '',
      })
    } else {
      setEditingLocationId(null)
      setLocationForm({
        ...emptyLocationForm,
        sourceDocument: selectedDocumentId || '',
        section: selectedSectionId || '',
      })
    }
    setLocationModalVisible(true)
  }

  const closeLocationModal = () => {
    setLocationModalVisible(false)
    setEditingLocationId(null)
    setLocationForm({ ...emptyLocationForm, sourceDocument: selectedDocumentId || '', section: selectedSectionId || '' })
  }

  const renderDocumentSectionTree = (parentId = null) => {
    const documentLookup = buildRelationLookup(catalog.documents)
    const sectionLookup = buildRelationLookup(catalog.sections)
    const rows = catalog.sections.filter((section) => {
      const sectionDocumentId = getRelationId(section.sourceDocument, documentLookup)
      const sectionParentId = getRelationId(section.parent, sectionLookup)
      const matchesDocument = selectedDocumentId ? String(sectionDocumentId) === String(selectedDocumentId) : true
      if (!matchesDocument) return false
      if (parentId === null) return !sectionParentId
      return String(sectionParentId) === String(parentId)
    }).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || String(a.title || '').localeCompare(String(b.title || '')))

    if (rows.length === 0) return null

    return rows.map((section) => {
      const children = renderDocumentSectionTree(section.id)
      const isSelected = String(selectedSectionId) === String(section.id)

      return (
        <li key={section.id} className='mb-2'>
          <div className='d-flex justify-content-between gap-2 align-items-center'>
            <button
              type='button'
              className={`btn btn-link p-0 text-start ${isSelected ? 'fw-semibold text-primary' : 'text-body'}`}
              onClick={() => setSelectedSectionId(String(section.id))}
            >
              {section.title || 'Section'}
            </button>
            <div className='d-flex gap-1'>
              <CButton size='sm' color='secondary' variant='outline' onClick={() => {
                setEditingSectionId(null)
                setSectionForm({
                  ...emptySectionForm,
                  sourceDocument: getRelationId(section.sourceDocument || selectedDocumentId, documentLookup),
                  parent: String(section.id),
                })
                setSectionModalVisible(true)
              }}>
                + Mục con
              </CButton>
              <CButton size='sm' color='secondary' variant='outline' onClick={() => openSectionModal(section)}>
                Sua
              </CButton>
              <CButton size='sm' color='danger' variant='outline' onClick={() => handleDeleteSection(section.id)}>
                Xoa
              </CButton>
            </div>
          </div>
          {children ? <ul className='mt-2 ps-3 mb-0'>{children}</ul> : null}
        </li>
      )
    })
  }

  const renderSource = () => {
    const selectedDocument = sourceDocumentDetail
    const visibleLocations = visibleSourceLocations || []

    return (
      <CRow className='g-3'>
        <CCol md={12}>
          <CCard>
            <CCardHeader className='d-flex justify-content-between align-items-center'>
              <strong>Import nguồn tài liệu</strong>
              <div className='d-flex gap-2'>
                <CButton size='sm' color='secondary' variant='outline' onClick={() => handleDownloadImportTemplate('xlsx')}>
                  Template .xlsx
                </CButton>
                <CButton size='sm' color='secondary' variant='outline' onClick={() => handleDownloadImportTemplate('json')}>
                  Template .json
                </CButton>
              </div>
            </CCardHeader>
            <CCardBody>
              <div className='mb-3'>
                <CFormLabel htmlFor='import-document'>Chọn tài liệu</CFormLabel>
                <CFormSelect id='import-document' value={selectedDocumentId} onChange={(event) => setSelectedDocumentId(event.target.value)}>
                  <option value=''>-- Chọn source document --</option>
                  {catalog.documents.map((item) => (
                    <option key={item.id} value={item.id}>{item.code || item.title}</option>
                  ))}
                </CFormSelect>
              </div>
              <div className='mb-3'>
                <CFormLabel htmlFor='import-file'>Tệp import (.xlsx / .json)</CFormLabel>
                <CFormInput id='import-file' type='file' accept='.xlsx,.json' onChange={(event) => setImportFile(event.target.files?.[0] || null)} />
              </div>
              <div className='d-flex gap-2 mb-3'>
                <CButton color='primary' disabled={importBusy || !selectedDocumentId || !importFile} onClick={handleImportPreview}>
                  {importBusy ? 'Đang xử lý...' : 'Preview'}
                </CButton>
                <CButton color='success' variant='outline' disabled={importBusy || !importPreview?.previewToken} onClick={handleImportConfirm}>
                  Xác nhận import
                </CButton>
              </div>

              {importPreview ? (
                <div className='border rounded p-3 bg-light'>
                  <div className='d-flex flex-wrap gap-3 mb-3'>
                    <CBadge color={importPreview.valid ? 'success' : 'danger'}>
                      {importPreview.valid ? 'Valid' : 'Invalid'}
                    </CBadge>
                    <CBadge color='primary'>Total: {importPreview.summary?.totalRecords || 0}</CBadge>
                    <CBadge color='success'>Create: {importPreview.summary?.created || 0}</CBadge>
                    <CBadge color='warning'>Update: {importPreview.summary?.updated || 0}</CBadge>
                    <CBadge color='secondary'>Skip: {importPreview.summary?.skipped || 0}</CBadge>
                  </div>

                  {Array.isArray(importPreview.errors) && importPreview.errors.length > 0 ? (
                    <div>
                      <strong className='d-block mb-2'>Errors</strong>
                      <ul className='mb-0'>
                        {importPreview.errors.slice(0, 10).map((item, index) => (
                          <li key={`${item.path || 'error'}-${index}`}>{item.path ? `${item.path}: ` : ''}{item.message || 'Invalid row'}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className='text-success'>Không có lỗi validation trong preview.</div>
                  )}
                </div>
              ) : null}
            </CCardBody>
          </CCard>
        </CCol>

        <CCol md={4}>
          <CCard className='h-100'>
            <CCardHeader className='d-flex justify-content-between align-items-center'>
              <strong>Curriculum Section</strong>
              <CButton size='sm' color='primary' disabled={!selectedDocumentId} onClick={() => openSectionModal()}>
                + Moi
              </CButton>
            </CCardHeader>
            <CCardBody>
              {!selectedDocumentId ? (
                <div className='text-body-secondary'>Vui lòng chọn một tài liệu để quản lý Section.</div>
              ) : sourceDocumentSections.length === 0 ? (
                <div className='text-body-secondary'>Chưa có Section nào cho tài liệu này.</div>
              ) : (
                <ul className='mb-0 ps-3'>
                  {renderDocumentSectionTree()}
                </ul>
              )}
            </CCardBody>
          </CCard>
        </CCol>

        <CCol md={4}>
          <CCard className='h-100'>
            <CCardHeader className='d-flex justify-content-between align-items-center'>
              <strong>Curriculum Source Location</strong>
              <CButton size='sm' color='primary' disabled={!selectedDocumentId} onClick={() => openLocationModal()}>
                + Moi
              </CButton>
            </CCardHeader>
            <CCardBody>
              {!selectedDocumentId ? (
                <div className='text-body-secondary'>Vui lòng chọn một tài liệu để quản lý Location.</div>
              ) : visibleLocations.length === 0 ? (
                <div className='text-body-secondary'>Chưa có Location nào cho phần này.</div>
              ) : (
                <ul className='mb-0 ps-3'>
                  {visibleLocations.map((location) => (
                    <li key={location.id} className='mb-2'>
                      <div className='fw-semibold'>Page {location.startPage || '-'} - {location.endPage || '-'}</div>
                      <div className='small text-body-secondary'>{location.locator || 'Locator'}</div>
                      <div className='small text-truncate'>{location.excerpt || '-'}</div>
                      <div className='d-flex gap-2 mt-2'>
                        <CButton size='sm' color='secondary' variant='outline' onClick={() => openLocationModal(location)}>
                          Sua
                        </CButton>
                        <CButton size='sm' color='danger' variant='outline' onClick={() => handleDeleteLocation(location.id)}>
                          Xoa
                        </CButton>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    )
  }

    const renderComingSoon = () => (
      <CCard>
        <CCardBody>
          <div className='d-flex flex-column align-items-center justify-content-center py-5 text-center'>
            <h4 className='mb-2'>Nội dung & năng lực</h4>
            <p className='text-body-secondary mb-0'>Mốc 2 đang được phát triển. Tab này sẽ được bổ sung sau khi workflow năng lực và nội dung được xác định rõ.</p>
          </div>
        </CCardBody>
      </CCard>
    )

    return (
      <>
        <CModal visible={documentModalVisible} onClose={closeDocumentModal} size='lg'>
        <CModalHeader closeButton={!busy}>
          <CModalTitle>{editingDocumentId ? 'Sửa Source Document' : 'Thêm Source Document'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <div className='mb-3'>
            <CFormLabel htmlFor='document-modal-code'>Code</CFormLabel>
            <CFormInput id='document-modal-code' value={documentForm.code} onChange={(event) => handleDocumentField('code', event.target.value)} />
          </div>
          <div className='mb-3'>
            <CFormLabel htmlFor='document-modal-title'>Title</CFormLabel>
            <CFormInput id='document-modal-title' value={documentForm.title} onChange={(event) => handleDocumentField('title', event.target.value)} />
          </div>
          <div className='mb-3'>
            <CFormLabel htmlFor='document-modal-number'>Document Number</CFormLabel>
            <CFormInput id='document-modal-number' value={documentForm.documentNumber} onChange={(event) => handleDocumentField('documentNumber', event.target.value)} />
          </div>
          <div className='mb-3'>
            <CFormLabel htmlFor='document-modal-date'>Issued Date</CFormLabel>
            <CFormInput id='document-modal-date' type='date' value={documentForm.issuedDate} onChange={(event) => handleDocumentField('issuedDate', event.target.value)} />
          </div>
          <div className='mb-3'>
            <CFormLabel htmlFor='document-modal-file-ref'>File Reference</CFormLabel>
            <CFormInput id='document-modal-file-ref' value={documentForm.fileRef} onChange={(event) => handleDocumentField('fileRef', event.target.value)} placeholder='path/to/file.pdf' />
          </div>
          <div className='mb-3'>
            <CFormLabel htmlFor='document-modal-checksum'>Checksum</CFormLabel>
            <CFormInput id='document-modal-checksum' value={documentForm.checksum || 'Tự động từ backend khi có file'} disabled />
          </div>
          <div className='mb-3'>
            <CFormLabel htmlFor='document-modal-status'>Status</CFormLabel>
            <CFormSelect id='document-modal-status' value={documentForm.status} onChange={(event) => handleDocumentField('status', event.target.value)}>
              <option value='draft'>Draft</option>
              <option value='active'>Active</option>
              <option value='archived'>Archived</option>
            </CFormSelect>
          </div>
          <div className='mb-3'>
            <CFormLabel htmlFor='document-modal-description'>Description</CFormLabel>
            <CFormTextarea id='document-modal-description' rows={3} value={documentForm.description} onChange={(event) => handleDocumentField('description', event.target.value)} />
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={closeDocumentModal} disabled={busy}>Hủy</CButton>
          <CButton color='primary' onClick={handleSaveDocument} disabled={busy}>{editingDocumentId ? 'Lưu' : 'Tạo mới'}</CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={sectionModalVisible} onClose={closeSectionModal} size='lg'>
        <CModalHeader closeButton={!busy}>
          <CModalTitle>{editingSectionId ? 'Sửa Section' : 'Thêm Section'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <div className='mb-3'>
            <CFormLabel htmlFor='section-modal-document'>Source Document</CFormLabel>
            <CFormSelect id='section-modal-document' value={sectionForm.sourceDocument || selectedDocumentId} onChange={(event) => handleSectionField('sourceDocument', event.target.value)}>
              <option value=''>-- Chọn tài liệu --</option>
              {catalog.documents.map((item) => (
                <option key={item.id} value={item.id}>{item.code || item.title}</option>
              ))}
            </CFormSelect>
          </div>
          <div className='mb-3'>
            <CFormLabel htmlFor='section-modal-parent'>Parent Section</CFormLabel>
            <CFormSelect id='section-modal-parent' value={sectionForm.parent} onChange={(event) => handleSectionField('parent', event.target.value)}>
              <option value=''>-- Root --</option>
              {selectableParentSections.map((item) => (
                <option key={item.id} value={item.id}>{item.title}</option>
              ))}
            </CFormSelect>
          </div>
          <div className='mb-3'>
            <CFormLabel htmlFor='section-modal-type'>Section Type</CFormLabel>
            <CFormInput id='section-modal-type' value={sectionForm.sectionType} onChange={(event) => handleSectionField('sectionType', event.target.value)} placeholder='I, II, heading...' />
          </div>
          <div className='mb-3'>
            <CFormLabel htmlFor='section-modal-title'>Title</CFormLabel>
            <CFormInput id='section-modal-title' value={sectionForm.title} onChange={(event) => handleSectionField('title', event.target.value)} />
          </div>
          <div className='mb-3'>
            <CFormLabel htmlFor='section-modal-body'>Body</CFormLabel>
            <CFormTextarea id='section-modal-body' rows={4} value={sectionForm.body} onChange={(event) => handleSectionField('body', event.target.value)} />
          </div>
          <div className='mb-3'>
            <CFormLabel htmlFor='section-modal-sort'>Sort Order</CFormLabel>
            <CFormInput id='section-modal-sort' type='number' value={sectionForm.sortOrder} onChange={(event) => handleSectionField('sortOrder', event.target.value)} />
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={closeSectionModal} disabled={busy}>Hủy</CButton>
          <CButton color='primary' onClick={handleSaveSection} disabled={busy}>{editingSectionId ? 'Lưu' : 'Tạo mới'}</CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={locationModalVisible} onClose={closeLocationModal} size='lg'>
        <CModalHeader closeButton={!busy}>
          <CModalTitle>{editingLocationId ? 'Sửa Source Location' : 'Thêm Source Location'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <div className='mb-3'>
            <CFormLabel htmlFor='location-modal-document'>Source Document</CFormLabel>
            <CFormSelect id='location-modal-document' value={locationForm.sourceDocument || selectedDocumentId} onChange={(event) => handleLocationField('sourceDocument', event.target.value)}>
              <option value=''>-- Chọn tài liệu --</option>
              {catalog.documents.map((item) => (
                <option key={item.id} value={item.id}>{item.code || item.title}</option>
              ))}
            </CFormSelect>
          </div>
          <div className='mb-3'>
            <CFormLabel htmlFor='location-modal-section'>Section</CFormLabel>
            <CFormSelect id='location-modal-section' value={locationForm.section || ''} onChange={(event) => handleLocationField('section', event.target.value)}>
              <option value=''>-- Không thuộc Section --</option>
              {sourceDocumentSections.map((item) => (
                <option key={item.id} value={item.id}>{item.title}</option>
              ))}
            </CFormSelect>
          </div>
          <div className='row g-3'>
            <div className='col-md-6'>
              <CFormLabel htmlFor='location-modal-start-page'>Start Page</CFormLabel>
              <CFormInput id='location-modal-start-page' type='number' value={locationForm.startPage} onChange={(event) => handleLocationField('startPage', event.target.value)} />
            </div>
            <div className='col-md-6'>
              <CFormLabel htmlFor='location-modal-end-page'>End Page</CFormLabel>
              <CFormInput id='location-modal-end-page' type='number' value={locationForm.endPage} onChange={(event) => handleLocationField('endPage', event.target.value)} />
            </div>
          </div>
          <div className='mb-3 mt-3'>
            <CFormLabel htmlFor='location-modal-locator'>Locator</CFormLabel>
            <CFormInput id='location-modal-locator' value={locationForm.locator} onChange={(event) => handleLocationField('locator', event.target.value)} />
          </div>
          <div className='mb-3'>
            <CFormLabel htmlFor='location-modal-excerpt'>Excerpt</CFormLabel>
            <CFormTextarea id='location-modal-excerpt' rows={4} value={locationForm.excerpt} onChange={(event) => handleLocationField('excerpt', event.target.value)} />
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={closeLocationModal} disabled={busy}>Hủy</CButton>
          <CButton color='primary' onClick={handleSaveLocation} disabled={busy}>{editingLocationId ? 'Lưu' : 'Tạo mới'}</CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={importModalVisible} onClose={() => setImportModalVisible(false)} size='lg'>
        <CModalHeader closeButton={!importBusy}>
          <CModalTitle>Import nguồn tài liệu</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <div className='mb-3'>
            <CFormLabel htmlFor='import-modal-document'>Chọn tài liệu</CFormLabel>
            <CFormSelect id='import-modal-document' value={selectedDocumentId} onChange={(event) => setSelectedDocumentId(event.target.value)}>
              <option value=''>-- Chọn source document --</option>
              {catalog.documents.map((item) => (
                <option key={item.id} value={item.id}>{item.code || item.title}</option>
              ))}
            </CFormSelect>
          </div>
          <div className='mb-3'>
            <CFormLabel htmlFor='import-modal-file'>Tệp import (.xlsx / .json)</CFormLabel>
            <CFormInput id='import-modal-file' type='file' accept='.xlsx,.json' onChange={(event) => setImportFile(event.target.files?.[0] || null)} />
          </div>
          <div className='d-flex gap-2 mb-3'>
            <CButton color='primary' disabled={importBusy || !selectedDocumentId || !importFile} onClick={handleImportPreview}>
              {importBusy ? 'Đang xử lý...' : 'Preview'}
            </CButton>
            <CButton color='success' variant='outline' disabled={importBusy || !importPreview?.previewToken} onClick={handleImportConfirm}>
              Xác nhận import
            </CButton>
          </div>
          {importPreview ? (
            <div className='border rounded p-3 bg-light'>
              <div className='d-flex flex-wrap gap-3 mb-3'>
                <CBadge color={importPreview.valid ? 'success' : 'danger'}>{importPreview.valid ? 'Valid' : 'Invalid'}</CBadge>
                <CBadge color='primary'>Total: {importPreview.summary?.totalRecords || 0}</CBadge>
                <CBadge color='success'>Create: {importPreview.summary?.created || 0}</CBadge>
                <CBadge color='warning'>Update: {importPreview.summary?.updated || 0}</CBadge>
                <CBadge color='secondary'>Skip: {importPreview.summary?.skipped || 0}</CBadge>
              </div>
              {Array.isArray(importPreview.errors) && importPreview.errors.length > 0 ? (
                <div>
                  <strong className='d-block mb-2'>Errors</strong>
                  <ul className='mb-0'>
                    {importPreview.errors.slice(0, 10).map((item, index) => (
                      <li key={`${item.path || 'error'}-${index}`}>{item.path ? `${item.path}: ` : ''}{item.message || 'Invalid row'}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className='text-success'>Không có lỗi validation trong preview.</div>
              )}
            </div>
          ) : null}
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => setImportModalVisible(false)} disabled={importBusy}>Đóng</CButton>
          <CButton color='secondary' variant='outline' onClick={() => handleDownloadImportTemplate('xlsx')} disabled={importBusy}>Template .xlsx</CButton>
          <CButton color='secondary' variant='outline' onClick={() => handleDownloadImportTemplate('json')} disabled={importBusy}>Template .json</CButton>
        </CModalFooter>
      </CModal>

      <div className='container-fluid py-4'>
      <div className='d-flex justify-content-between align-items-center gap-3 mb-4'>
        <div>
          <h2 className='mb-1'>Platform Curriculum Manager</h2>
          <p className='text-body-secondary mb-0'>Quan ly du lieu nen va draft version cho curriculum global.</p>
        </div>
        <CButton color='secondary' variant='outline' onClick={loadCatalog} disabled={loading || busy}>
          {loading ? <><CSpinner size='sm' className='me-2' /> Dang tai...</> : 'Refresh'}
        </CButton>
      </div>

      {error ? <CAlert color='danger'>{error}</CAlert> : null}
      {success ? <CAlert color='success'>{success}</CAlert> : null}

      <CNav variant='tabs' className='mb-4'>
        {tabItems.map((item) => (
          <CNavItem key={item.key}>
            <CNavLink active={activeTab === item.key} onClick={() => setActiveTab(item.key)}>
              {item.label}
            </CNavLink>
          </CNavItem>
        ))}
      </CNav>

      <CTabContent>
        <CTabPane visible={activeTab === 'overview'}>{renderOverview()}</CTabPane>
        <CTabPane visible={activeTab === 'versions'}>{renderVersions()}</CTabPane>
        <CTabPane visible={activeTab === 'standards'}>{renderStandards()}</CTabPane>
        <CTabPane visible={activeTab === 'source'}>{renderSource()}</CTabPane>
        <CTabPane visible={activeTab === 'content'}>{renderComingSoon()}</CTabPane>
      </CTabContent>
      </div>
    </>
  )
}
