import crypto from 'node:crypto'
import * as XLSX from 'xlsx'

const DOCUMENT_UID = 'api::curriculum-source-document.curriculum-source-document'
const SECTION_UID = 'api::curriculum-section.curriculum-section'
const LOCATION_UID = 'api::curriculum-source-location.curriculum-source-location'
const MAPPING_UID = 'api::curriculum-import-mapping.curriculum-import-mapping'
const BATCH_UID = 'api::curriculum-import-batch.curriculum-import-batch'
const PREVIEW_STORE = (globalThis as any).__cogiCurriculumImportPreviewStore || ((globalThis as any).__cogiCurriculumImportPreviewStore = new Map())
const MAX_FILE_BYTES = 10 * 1024 * 1024

function textValue(input: unknown): string {
  if (input === null || input === undefined) return ''
  return String(input).trim()
}

function normalizeKey(value: unknown): string {
  return textValue(value).replace(/\s+/g, ' ').trim()
}

function parsePositiveInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function computeHash(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex')
}

function toNumberIfPossible(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function getManifestValue(raw: Record<string, any>, keys: string[]): string {
  for (const key of keys) {
    const value = raw?.[key]
    if (value !== undefined && value !== null && value !== '') return String(value).trim()
  }
  return ''
}

function getImportRowsFromSheet(sheet: any): Record<string, any>[] {
  const rows = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: '' })
  return Array.isArray(rows) ? rows : []
}

async function findSourceDocumentById(id: unknown) {
  const normalizedId = parsePositiveInt(id)
  if (!normalizedId) return null
  return strapi.db.query(DOCUMENT_UID).findOne({
    where: { id: normalizedId },
    select: ['id', 'code', 'title'],
  })
}

async function findSourceDocumentByCode(code: string) {
  const normalizedCode = textValue(code)
  if (!normalizedCode) return null
  return strapi.db.query(DOCUMENT_UID).findOne({
    where: { code: normalizedCode },
    select: ['id', 'code', 'title'],
  })
}

async function findRecordByTargetDocumentId(uid: string, targetDocumentId: string | number | null | undefined) {
  const normalizedId = parsePositiveInt(targetDocumentId)
  if (!normalizedId) return null

  try {
    const record = await (strapi.entityService as any).findOne(uid, normalizedId, {
      fields: ['id'],
    })
    return record
  } catch (error) {
    return null
  }
}

async function listMappingsForSource(sourceDocumentId: number) {
  try {
    return await strapi.db.query(MAPPING_UID).findMany({
      where: { sourceDocument: sourceDocumentId },
      select: ['id', 'sourceDocument', 'entityType', 'importKey', 'targetDocumentId', 'sourceHash', 'lastImportedAt'],
    })
  } catch (error) {
    return []
  }
}

async function findMappingForRecord(sourceDocumentId: number, entityType: string, importKey: string) {
  const normalizedKey = normalizeKey(importKey)
  if (!normalizedKey) return null

  try {
    return await strapi.db.query(MAPPING_UID).findOne({
      where: {
        sourceDocument: sourceDocumentId,
        entityType,
        importKey: normalizedKey,
      },
      select: ['id', 'sourceDocument', 'entityType', 'importKey', 'targetDocumentId', 'sourceHash', 'lastImportedAt'],
    })
  } catch (error) {
    return null
  }
}

async function upsertImportMappingRecord({
  sourceDocumentId,
  entityType,
  importKey,
  targetDocumentId,
  lastImportBatch,
  sourceHash,
  trx = null,
}: {
  sourceDocumentId: number
  entityType: string
  importKey: string
  targetDocumentId: number | string
  lastImportBatch: number | null
  sourceHash: string
  trx?: any
}) {
  const normalizedKey = normalizeKey(importKey)
  if (!normalizedKey || !targetDocumentId) return null

  const mapping = await findMappingForRecord(sourceDocumentId, entityType, normalizedKey)
  const payload = {
    sourceDocument: sourceDocumentId,
    entityType,
    importKey: normalizedKey,
    targetDocumentId: String(targetDocumentId),
    lastImportBatch,
    sourceHash,
    lastImportedAt: new Date().toISOString(),
  }

  if (mapping) {
    return strapi.db.query(MAPPING_UID).update({
      where: { id: mapping.id },
      data: payload,
      ...(trx ? { transacting: trx } : {}),
    })
  }

  return strapi.db.query(MAPPING_UID).create({
    data: payload,
    ...(trx ? { transacting: trx } : {}),
  })
}

async function loadSectionById(id: number | string) {
  const normalizedId = parsePositiveInt(id)
  if (!normalizedId) return null

  try {
    const section = await (strapi.entityService as any).findOne(SECTION_UID, normalizedId, {
      fields: ['id', 'sourceDocument', 'parent', 'sectionType', 'title', 'body', 'sortOrder'],
      populate: {
        sourceDocument: { fields: ['id'] },
        parent: { fields: ['id'] },
      },
    })
    return section
  } catch (error) {
    return null
  }
}

async function loadLocationById(id: number | string) {
  const normalizedId = parsePositiveInt(id)
  if (!normalizedId) return null

  try {
    const location = await (strapi.entityService as any).findOne(LOCATION_UID, normalizedId, {
      fields: ['id', 'sourceDocument', 'section', 'startPage', 'endPage', 'locator', 'excerpt'],
      populate: {
        sourceDocument: { fields: ['id'] },
        section: { fields: ['id'] },
      },
    })
    return location
  } catch (error) {
    return null
  }
}

function createSectionRecordSnapshot(record: Record<string, any>) {
  return {
    sourceDocument: record.sourceDocument ?? null,
    parent: record.parent ?? null,
    sectionType: record.sectionType ?? null,
    title: record.title ?? '',
    body: record.body ?? '',
    sortOrder: record.sortOrder ?? 0,
  }
}

function createLocationRecordSnapshot(record: Record<string, any>) {
  return {
    sourceDocument: record.sourceDocument ?? null,
    section: record.section ?? null,
    startPage: record.startPage ?? null,
    endPage: record.endPage ?? null,
    locator: record.locator ?? '',
    excerpt: record.excerpt ?? '',
  }
}

function findParentSectionInPackage(sectionImportKey: string, sections: Record<string, any>[]) {
  const row = sections.find((candidate) => normalizeKey(candidate.importKey) === normalizeKey(sectionImportKey))
  return row || null
}

function validateParentGraph(sections: Record<string, any>[], errors: Record<string, any>[]) {
  const keyToSection = new Map(sections.map((row) => [normalizeKey(row.importKey), row]))

  const visit = new Map<string, 'visiting' | 'done'>()
  const detectCycle = (key: string, stack: string[] = []) => {
    if (visit.get(key) === 'visiting') {
      const cycleStart = stack.indexOf(key)
      errors.push({
        path: `sections.${key}`,
        message: `Parent cycle detected: ${[...stack.slice(cycleStart), key].join(' -> ')}`,
      })
      return true
    }

    if (visit.get(key) === 'done') return false
    const current = keyToSection.get(key)
    if (!current) return false

    visit.set(key, 'visiting')
    const parentKey = normalizeKey(current.parentImportKey)
    if (parentKey) {
      if (!keyToSection.has(parentKey)) {
        errors.push({
          path: `sections.${key}.parentImportKey`,
          message: `Parent importKey '${current.parentImportKey}' was not found in the same package or source document mapping.`,
        })
        return false
      }
      detectCycle(parentKey, [...stack, key])
    }
    visit.set(key, 'done')
    return false
  }

  for (const row of sections) {
    if (normalizeKey(row.parentImportKey)) {
      detectCycle(normalizeKey(row.importKey), [])
    }
  }
}

async function parseWorkbookFile(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetNames = workbook.SheetNames || []
  const manifestSheet = workbook.Sheets['Manifest'] || workbook.Sheets['manifest'] || null
  const sectionsSheet = workbook.Sheets['Sections'] || workbook.Sheets['sections'] || null
  const locationsSheet = workbook.Sheets['SourceLocations'] || workbook.Sheets['sourceLocations'] || workbook.Sheets['Source Locations'] || null

  const errors: Record<string, any>[] = []
  if (!manifestSheet) errors.push({ path: 'Manifest', message: 'Missing required sheet: Manifest.' })
  if (!sectionsSheet) errors.push({ path: 'Sections', message: 'Missing required sheet: Sections.' })
  if (!locationsSheet) errors.push({ path: 'SourceLocations', message: 'Missing required sheet: SourceLocations.' })

  const manifestRows = manifestSheet ? getImportRowsFromSheet(manifestSheet) : []
  const sectionRows = sectionsSheet ? getImportRowsFromSheet(sectionsSheet) : []
  const locationRows = locationsSheet ? getImportRowsFromSheet(locationsSheet) : []

  const manifest = (manifestRows[0] || {}) as Record<string, any>
  const normalizedManifest = {
    schemaVersion: getManifestValue(manifest, ['schemaVersion', 'schema_version', 'SchemaVersion']),
    packageCode: getManifestValue(manifest, ['packageCode', 'package_code', 'PackageCode']),
    sourceDocumentCode: getManifestValue(manifest, ['sourceDocumentCode', 'source_document_code', 'sourceDocument', 'source_document', 'SourceDocumentCode']),
    subjectVersionCode: getManifestValue(manifest, ['subjectVersionCode', 'subject_version_code', 'SubjectVersionCode']),
    description: getManifestValue(manifest, ['description', 'Description']),
  }

  const normalizedSections = sectionRows.map((row: Record<string, any>, index: number) => ({
    importKey: getManifestValue(row, ['importKey', 'import_key', 'ImportKey']),
    parentImportKey: getManifestValue(row, ['parentImportKey', 'parent_import_key', 'ParentImportKey']),
    sectionType: getManifestValue(row, ['sectionType', 'section_type', 'SectionType']),
    title: getManifestValue(row, ['title', 'Title']),
    body: getManifestValue(row, ['body', 'Body']),
    sortOrder: getManifestValue(row, ['sortOrder', 'sort_order', 'SortOrder']),
    rowNumber: index + 2,
    __sheet: 'Sections',
  }))

  const normalizedLocations = locationRows.map((row: Record<string, any>, index: number) => ({
    importKey: getManifestValue(row, ['importKey', 'import_key', 'ImportKey']),
    sectionImportKey: getManifestValue(row, ['sectionImportKey', 'section_import_key', 'SectionImportKey']),
    startPage: getManifestValue(row, ['startPage', 'start_page', 'StartPage']),
    endPage: getManifestValue(row, ['endPage', 'end_page', 'EndPage']),
    locator: getManifestValue(row, ['locator', 'Locator']),
    excerpt: getManifestValue(row, ['excerpt', 'Excerpt']),
    rowNumber: index + 2,
    __sheet: 'SourceLocations',
  }))

  return {
    manifest: normalizedManifest,
    sections: normalizedSections,
    sourceLocations: normalizedLocations,
    errors,
    fileType: 'xlsx',
    sheetNames,
  }
}

function normalizeJsonPackage(payload: any) {
  const manifestCandidate = payload?.manifest && typeof payload.manifest === 'object'
    ? payload.manifest
    : payload?.Manifest && typeof payload.Manifest === 'object'
      ? payload.Manifest
      : payload || {}

  const manifest = manifestCandidate && typeof manifestCandidate === 'object' ? manifestCandidate : {}
  const sections = Array.isArray(payload?.sections)
    ? payload.sections
    : Array.isArray(payload?.Sections)
      ? payload.Sections
      : Array.isArray(payload?.data?.sections)
        ? payload.data.sections
        : Array.isArray(payload?.data?.Sections)
          ? payload.data.Sections
          : []

  const locations = Array.isArray(payload?.sourceLocations)
    ? payload.sourceLocations
    : Array.isArray(payload?.SourceLocations)
      ? payload.SourceLocations
      : Array.isArray(payload?.locations)
        ? payload.locations
        : Array.isArray(payload?.source_locations)
          ? payload.source_locations
          : Array.isArray(payload?.data?.sourceLocations)
            ? payload.data.sourceLocations
            : Array.isArray(payload?.data?.SourceLocations)
              ? payload.data.SourceLocations
              : []

  const fallbackSourceDocumentCode = textValue(payload?.sourceDocument?.code ?? payload?.sourceDocumentCode ?? payload?.source_document_code ?? '')

  return {
    manifest: {
      schemaVersion: textValue(manifest.schemaVersion ?? manifest.formatVersion ?? payload?.formatVersion ?? payload?.schemaVersion ?? ''),
      packageCode: textValue(manifest.packageCode ?? payload.packageCode ?? payload.package_code ?? ''),
      sourceDocumentCode: textValue(manifest.sourceDocumentCode ?? payload.sourceDocumentCode ?? payload.source_document_code ?? fallbackSourceDocumentCode ?? ''),
      subjectVersionCode: textValue(manifest.subjectVersionCode ?? payload.subjectVersionCode ?? payload.subject_version_code ?? ''),
      description: textValue(manifest.description ?? payload.description ?? payload.notes?.join(' ') ?? ''),
    },
    sections: sections.map((row: Record<string, any>, index: number) => ({
      importKey: textValue(row.importKey ?? row.import_key ?? ''),
      parentImportKey: row.parentImportKey === null || row.parentImportKey === undefined ? '' : textValue(row.parentImportKey ?? row.parent_import_key ?? ''),
      sectionType: textValue(row.sectionType ?? row.section_type ?? ''),
      title: textValue(row.title ?? ''),
      body: textValue(row.body ?? ''),
      sortOrder: textValue(row.sortOrder ?? row.sort_order ?? row.sourcePageStart ?? 0),
      sourceDocumentCode: textValue(row.sourceDocumentCode ?? row.source_document_code ?? payload?.sourceDocument?.code ?? ''),
      rowNumber: index + 1,
      __sheet: 'JSON.sections',
    })),
    sourceLocations: locations.map((row: Record<string, any>, index: number) => ({
      importKey: textValue(row.importKey ?? row.import_key ?? ''),
      sectionImportKey: textValue(row.sectionImportKey ?? row.section_import_key ?? ''),
      startPage: textValue(row.startPage ?? row.start_page ?? row.sourcePageStart ?? ''),
      endPage: textValue(row.endPage ?? row.end_page ?? row.sourcePageEnd ?? ''),
      locator: textValue(row.locator ?? row.locationType ?? ''),
      excerpt: textValue(row.excerpt ?? ''),
      sourceDocumentCode: textValue(row.sourceDocumentCode ?? row.source_document_code ?? payload?.sourceDocument?.code ?? ''),
      rowNumber: index + 1,
      __sheet: 'JSON.sourceLocations',
    })),
    errors: [],
    fileType: 'json',
  }
}

function buildPreviewSummary(items: Record<string, any>[], statuses: Record<string, any>) {
  return {
    totalRecords: items.length,
    created: items.filter((row) => row.action === 'create').length,
    updated: items.filter((row) => row.action === 'update').length,
    skipped: items.filter((row) => row.action === 'skip').length,
    conflicts: items.filter((row) => row.action === 'conflict').length,
    failed: items.filter((row) => row.action === 'failed').length,
    ...statuses,
  }
}

async function previewPackage(input: Record<string, any>, sourceDocumentId: number, sourceDocumentCode: string, fileType: string, fileHash: string) {
  const errors: Record<string, any>[] = [...(input.errors || [])]
  const sections = input.sections || []
  const sourceLocations = input.sourceLocations || []
  const warnings: Record<string, any>[] = []

  const normalizedSourceDocumentCode = textValue(sourceDocumentCode || input?.manifest?.sourceDocumentCode || input?.sections?.[0]?.sourceDocumentCode || input?.sourceLocations?.[0]?.sourceDocumentCode || '')

  if (!normalizedSourceDocumentCode) {
    errors.push({ path: 'manifest.sourceDocumentCode', message: 'sourceDocumentCode is required.' })
  }

  if (!input.manifest || !input.manifest.schemaVersion) {
    errors.push({ path: 'manifest.schemaVersion', message: 'schemaVersion is required.' })
  } else if (String(input.manifest.schemaVersion).trim() !== '1.0' && !/^1\./.test(String(input.manifest.schemaVersion).trim())) {
    errors.push({ path: 'manifest.schemaVersion', message: 'Unsupported schemaVersion. only 1.0 or 1.x accepted.' })
  }

  const requiredSheetErrors = errors.filter((row) => row.path === 'Manifest' || row.path === 'Sections' || row.path === 'SourceLocations')
  if (requiredSheetErrors.length > 0) {
    return {
      valid: false,
      errors,
      warnings,
      sections: [],
      sourceLocations: [],
      summary: { totalRecords: 0, created: 0, updated: 0, skipped: 0, conflicts: 0, failed: 0 },
      metadata: { packageCode: input.manifest?.packageCode || '', sourceDocumentCode: normalizedSourceDocumentCode, fileType, fileHash },
      sourceDocumentId,
      packageCode: input.manifest?.packageCode || '',
      fileType,
      fileHash,
    }
  }

  const seenSectionKeys = new Map<string, number>()
  sections.forEach((row: Record<string, any>) => {
    const key = normalizeKey(row.importKey)
    if (!key) {
      errors.push({ path: `${row.__sheet || 'Sections'}.${row.rowNumber || 1}.importKey`, message: 'importKey is required.' })
      return
    }
    if (seenSectionKeys.has(key)) {
      errors.push({ path: `${row.__sheet || 'Sections'}.${row.rowNumber || 1}.importKey`, message: `Duplicate importKey '${key}' within the Sections sheet.` })
    }
    seenSectionKeys.set(key, Number(row.rowNumber || 1))
  })

  const seenLocationKeys = new Map<string, number>()
  sourceLocations.forEach((row: Record<string, any>) => {
    const key = normalizeKey(row.importKey)
    if (!key) {
      errors.push({ path: `${row.__sheet || 'SourceLocations'}.${row.rowNumber || 1}.importKey`, message: 'importKey is required.' })
      return
    }
    if (seenLocationKeys.has(key)) {
      errors.push({ path: `${row.__sheet || 'SourceLocations'}.${row.rowNumber || 1}.importKey`, message: `Duplicate importKey '${key}' within the SourceLocations sheet.` })
    }
    seenLocationKeys.set(key, Number(row.rowNumber || 1))
  })

  const sectionParentMap = new Map<string, string>()
  sections.forEach((row: Record<string, any>) => {
    const importKey = normalizeKey(row.importKey)
    if (!importKey) return
    const parentKey = normalizeKey(row.parentImportKey)
    sectionParentMap.set(importKey, parentKey)
    if (!textValue(row.title)) {
      errors.push({ path: `${row.__sheet || 'Sections'}.${row.rowNumber || 1}.title`, message: 'Section title is required.' })
    }
  })

  validateParentGraph(sections, errors)

  const mappings = await listMappingsForSource(sourceDocumentId)
  const mappingIndex = new Map<string, Record<string, any>>()
  for (const row of mappings || []) {
    if (!row?.entityType || !row?.importKey) continue
    mappingIndex.set(`${String(row.entityType)}:${String(row.importKey)}`, row)
  }
  
  console.log(`[Preview] sourceDocumentId=${sourceDocumentId}, mappings.length=${mappings?.length || 0}, mappingIndex.size=${mappingIndex.size}`)

  const sectionRecords = [] as any[]
  for (const row of sections) {
    const importKey = normalizeKey(row.importKey)
    if (!importKey) continue
    const parentKey = normalizeKey(row.parentImportKey)
    const rowErrors: Record<string, any>[] = []
    const normalizedSection = {
      importKey,
      parentImportKey: parentKey,
      sectionType: textValue(row.sectionType),
      title: textValue(row.title),
      body: textValue(row.body),
      sortOrder: toNumberIfPossible(row.sortOrder) ?? 0,
      rowNumber: row.rowNumber,
      __sheet: row.__sheet,
      sourceDocumentId,
      sourceDocumentCode,
    }

    if (parentKey) {
      const existingParent = sections.find((item: Record<string, any>) => normalizeKey(item.importKey) === parentKey)
      if (!existingParent) {
        rowErrors.push({ path: `${row.__sheet || 'Sections'}.${row.rowNumber || 1}.parentImportKey`, message: `Parent importKey '${parentKey}' is not present in the same package.` })
      }
    }

    const mapping = mappingIndex.get(`section:${importKey}`)
    const targetRecord = mapping ? await findRecordByTargetDocumentId(SECTION_UID, mapping.targetDocumentId) : null
    
    if (importKey === 'SEC-V-3-G06-1-1-A' || row.rowNumber === 1) {
      console.log(`[Preview Section] key='${importKey}', mapping=${mapping ? 'found' : 'null'}, targetRecord=${targetRecord ? targetRecord.id : 'null'}`)
    }
    
    const currentHash = computeHash(createSectionRecordSnapshot({
      sourceDocument: sourceDocumentId,
      parent: parentKey ? undefined : null,
      sectionType: normalizedSection.sectionType,
      title: normalizedSection.title,
      body: normalizedSection.body,
      sortOrder: normalizedSection.sortOrder,
    }))

    if (mapping && !targetRecord) {
      rowErrors.push({ path: `${row.__sheet || 'Sections'}.${row.rowNumber || 1}.importKey`, message: `Mapping points to a deleted Section record for importKey '${importKey}'.` })
    }

    if (mapping && targetRecord) {
      const dbSnapshot = await loadSectionById(targetRecord.id)
      const cachedParentMapping = parentKey ? mappingIndex.get(`section:${parentKey}`) : null
      const desiredParentRecord = cachedParentMapping
        ? await findRecordByTargetDocumentId(SECTION_UID, cachedParentMapping.targetDocumentId)
        : null
      const actualParentId = dbSnapshot?.parent && typeof dbSnapshot.parent === 'object'
        ? parsePositiveInt(dbSnapshot.parent.id ?? dbSnapshot.parent)
        : parsePositiveInt(dbSnapshot?.parent)
      const desiredParentId = desiredParentRecord?.id ?? null
      const relationMismatch = parentKey ? actualParentId !== desiredParentId : actualParentId !== null

      const snapshotHash = computeHash(createSectionRecordSnapshot({
        sourceDocument: dbSnapshot?.sourceDocument || '',
        parent: actualParentId,
        sectionType: dbSnapshot?.sectionType || '',
        title: dbSnapshot?.title || '',
        body: dbSnapshot?.body || '',
        sortOrder: dbSnapshot?.sortOrder ?? 0,
      }))

      const action = snapshotHash === (mapping.sourceHash || currentHash) && !relationMismatch ? 'skip' : 'update'
      sectionRecords.push({ ...normalizedSection, action, mapping, targetRecord, existingHash: snapshotHash, rowErrors })
    } else if (!mapping) {
      // Fallback: Search for existing section by sourceDocument + title (when mapping is missing)
      let fallbackRecord: any = null
      try {
        const sections = await (strapi.entityService as any).findMany(SECTION_UID, {
          filters: {
            sourceDocument: sourceDocumentId,
            title: normalizedSection.title,
          },
          fields: ['id'],
          limit: 1,
        })
        fallbackRecord = sections?.[0] || null
      } catch {
        // If query fails, treat as not found
      }

      if (fallbackRecord) {
        const dbSnapshot = await loadSectionById(fallbackRecord.id)
        const cachedParentMapping = parentKey ? mappingIndex.get(`section:${parentKey}`) : null
        const desiredParentRecord = cachedParentMapping
          ? await findRecordByTargetDocumentId(SECTION_UID, cachedParentMapping.targetDocumentId)
          : null
        const actualParentId = dbSnapshot?.parent && typeof dbSnapshot.parent === 'object'
          ? parsePositiveInt(dbSnapshot.parent.id ?? dbSnapshot.parent)
          : parsePositiveInt(dbSnapshot?.parent)
        const desiredParentId = desiredParentRecord?.id ?? null
        const relationMismatch = parentKey ? actualParentId !== desiredParentId : actualParentId !== null

        const snapshotHash = computeHash(createSectionRecordSnapshot({
          sourceDocument: dbSnapshot?.sourceDocument || '',
          parent: actualParentId,
          sectionType: dbSnapshot?.sectionType || '',
          title: dbSnapshot?.title || '',
          body: dbSnapshot?.body || '',
          sortOrder: dbSnapshot?.sortOrder ?? 0,
        }))

        const action = snapshotHash === currentHash && !relationMismatch ? 'skip' : 'update'
        // Mark as found but without mapping (orphaned record)
        sectionRecords.push({ ...normalizedSection, action, mapping: null, targetRecord: fallbackRecord, existingHash: snapshotHash, rowErrors: [...rowErrors, { path: `${row.__sheet || 'Sections'}.${row.rowNumber || 1}.importKey`, message: `No mapping found for importKey '${importKey}'. Matched by title. Consider creating a mapping record to avoid reprocessing.` }] })
      } else {
        sectionRecords.push({ ...normalizedSection, action: 'create', mapping: null, targetRecord: null, rowErrors })
      }
    } else {
      sectionRecords.push({ ...normalizedSection, action: 'create', mapping: null, targetRecord: null, rowErrors })
    }

    errors.push(...rowErrors)

  }

  const locationRecords = [] as any[]
  for (const row of sourceLocations) {
    const importKey = normalizeKey(row.importKey)
    const sectionKey = normalizeKey(row.sectionImportKey)
    const startPage = parsePositiveInt(row.startPage)
    const endPage = parsePositiveInt(row.endPage)
    if (!importKey) continue

    const recordErrors: Record<string, any>[] = []
    if (sectionKey) {
      const sectionExists = !!sections.find((item: Record<string, any>) => normalizeKey(item.importKey) === sectionKey)
      if (!sectionExists) {
        recordErrors.push({ path: `${row.__sheet || 'SourceLocations'}.${row.rowNumber || 1}.sectionImportKey`, message: `Section importKey '${sectionKey}' is not present in this package.` })
      }
    }
    if (!startPage) {
      recordErrors.push({ path: `${row.__sheet || 'SourceLocations'}.${row.rowNumber || 1}.startPage`, message: 'startPage must be a positive integer.' })
    }
    if (!endPage) {
      recordErrors.push({ path: `${row.__sheet || 'SourceLocations'}.${row.rowNumber || 1}.endPage`, message: 'endPage must be a positive integer.' })
    }
    if (startPage && endPage && endPage < startPage) {
      recordErrors.push({ path: `${row.__sheet || 'SourceLocations'}.${row.rowNumber || 1}.endPage`, message: 'endPage must be greater than or equal to startPage.' })
    }

    const mapping = mappingIndex.get(`source-location:${importKey}`)
    const targetRecord = mapping ? await findRecordByTargetDocumentId(LOCATION_UID, mapping.targetDocumentId) : null
    const snapshot = {
      sourceDocument: sourceDocumentId,
      section: sectionKey || null,
      startPage: startPage || null,
      endPage: endPage || null,
      locator: textValue(row.locator),
      excerpt: textValue(row.excerpt),
    }

    if (mapping && !targetRecord) {
      recordErrors.push({ path: `${row.__sheet || 'SourceLocations'}.${row.rowNumber || 1}.importKey`, message: `Mapping points to a deleted Source Location record for importKey '${importKey}'.` })
    }

    if (mapping && targetRecord) {
      const dbSnapshot = await loadLocationById(targetRecord.id)
      const desiredSectionMapping = sectionKey ? mappingIndex.get(`section:${sectionKey}`) : null
      const desiredSectionRecord = desiredSectionMapping
        ? await findRecordByTargetDocumentId(SECTION_UID, desiredSectionMapping.targetDocumentId)
        : null
      const actualSectionId = dbSnapshot?.section && typeof dbSnapshot.section === 'object'
        ? parsePositiveInt(dbSnapshot.section.id ?? dbSnapshot.section)
        : parsePositiveInt(dbSnapshot?.section)
      const desiredSectionId = desiredSectionRecord?.id ?? null
      const relationMismatch = sectionKey ? actualSectionId !== desiredSectionId : actualSectionId !== null

      const snapshotHash = computeHash(createLocationRecordSnapshot({
        sourceDocument: dbSnapshot?.sourceDocument || '',
        section: actualSectionId,
        startPage: dbSnapshot?.startPage || null,
        endPage: dbSnapshot?.endPage || null,
        locator: dbSnapshot?.locator || '',
        excerpt: dbSnapshot?.excerpt || '',
      }))
      const action = snapshotHash === (mapping.sourceHash || computeHash(snapshot)) && !relationMismatch ? 'skip' : 'update'
      locationRecords.push({ ...row, sectionKey, startPage, endPage, action, mapping, targetRecord, rowErrors: recordErrors })
    } else if (!mapping) {
      // Fallback: Search for existing location by sourceDocument + startPage + endPage + locator
      let fallbackRecord: any = null
      try {
        const locations = await (strapi.entityService as any).findMany(LOCATION_UID, {
          filters: {
            sourceDocument: sourceDocumentId,
            startPage: startPage || null,
            endPage: endPage || null,
            locator: textValue(row.locator),
          },
          fields: ['id'],
          limit: 1,
        })
        fallbackRecord = locations?.[0] || null
      } catch {
        // If query fails, treat as not found
      }

      if (fallbackRecord) {
        const dbSnapshot = await loadLocationById(fallbackRecord.id)
        const desiredSectionMapping = sectionKey ? mappingIndex.get(`section:${sectionKey}`) : null
        const desiredSectionRecord = desiredSectionMapping
          ? await findRecordByTargetDocumentId(SECTION_UID, desiredSectionMapping.targetDocumentId)
          : null
        const actualSectionId = dbSnapshot?.section && typeof dbSnapshot.section === 'object'
          ? parsePositiveInt(dbSnapshot.section.id ?? dbSnapshot.section)
          : parsePositiveInt(dbSnapshot?.section)
        const desiredSectionId = desiredSectionRecord?.id ?? null
        const relationMismatch = sectionKey ? actualSectionId !== desiredSectionId : actualSectionId !== null

        const snapshotHash = computeHash(createLocationRecordSnapshot({
          sourceDocument: dbSnapshot?.sourceDocument || '',
          section: actualSectionId,
          startPage: dbSnapshot?.startPage || null,
          endPage: dbSnapshot?.endPage || null,
          locator: dbSnapshot?.locator || '',
          excerpt: dbSnapshot?.excerpt || '',
        }))
        const action = snapshotHash === computeHash(snapshot) && !relationMismatch ? 'skip' : 'update'
        locationRecords.push({ ...row, sectionKey, startPage, endPage, action, mapping: null, targetRecord: fallbackRecord, rowErrors: [...recordErrors, { path: `${row.__sheet || 'SourceLocations'}.${row.rowNumber || 1}.importKey`, message: `No mapping found for importKey '${importKey}'. Matched by location data. Consider creating a mapping record to avoid reprocessing.` }] })
      } else {
        locationRecords.push({ ...row, sectionKey, startPage, endPage, action: 'create', mapping: null, targetRecord: null, rowErrors: recordErrors })
      }
    } else {
      locationRecords.push({ ...row, sectionKey, startPage, endPage, action: 'create', mapping: null, targetRecord: null, rowErrors: recordErrors })
    }

    errors.push(...recordErrors)
  }

  const sectionSummary = buildPreviewSummary(sectionRecords, { sections: sectionRecords.length })
  const locationSummary = buildPreviewSummary(locationRecords, { sourceLocations: locationRecords.length })

  const previewData = {
    valid: errors.length === 0,
    errors,
    warnings,
    sections: sectionRecords,
    sourceLocations: locationRecords,
    summary: {
      totalRecords: sectionSummary.totalRecords + locationSummary.totalRecords,
      created: sectionSummary.created + locationSummary.created,
      updated: sectionSummary.updated + locationSummary.updated,
      skipped: sectionSummary.skipped + locationSummary.skipped,
      conflicts: sectionSummary.conflicts + locationSummary.conflicts,
      failed: sectionSummary.failed + locationSummary.failed,
      sectionCount: sectionRecords.length,
      locationCount: locationRecords.length,
    },
    metadata: {
      packageCode: input.manifest?.packageCode || '',
      sourceDocumentCode,
      fileType,
      fileHash,
      schemaVersion: input.manifest?.schemaVersion || '',
    },
    sourceDocumentId,
    packageCode: input.manifest?.packageCode || '',
    fileType,
    fileHash,
  }

  return previewData
}

function readBufferFromRequest(ctx: any) {
  const file = ctx.request?.files?.file || ctx.request?.files?.document || ctx.request?.files?.upload || null
  if (file && file.size && file.size > MAX_FILE_BYTES) {
    throw new Error('Uploaded file exceeds the 10MB limit.')
  }

  if (file && file.buffer) return Buffer.from(file.buffer)
  if (file && file.filepath) {
    return require('node:fs').readFileSync(file.filepath)
  }

  if (typeof ctx.request?.body?.payload === 'string') {
    return Buffer.from(ctx.request.body.payload)
  }

  if (ctx.request?.body?.payload && typeof ctx.request.body.payload === 'object') {
    return Buffer.from(JSON.stringify(ctx.request.body.payload))
  }

  if (typeof ctx.request?.body?.json === 'string') {
    return Buffer.from(ctx.request.body.json)
  }

  if (ctx.request?.body?.json && typeof ctx.request.body.json === 'object') {
    return Buffer.from(JSON.stringify(ctx.request.body.json))
  }

  if (ctx.request?.body && typeof ctx.request.body === 'object' && !ctx.request.files) {
    const candidate = ctx.request.body.file || ctx.request.body.upload || ctx.request.body.document || ctx.request.body.payload || ctx.request.body.json
    if (candidate && typeof candidate === 'object' && candidate.buffer) {
      return Buffer.from(candidate.buffer)
    }
    if (candidate && typeof candidate === 'object' && candidate.path) {
      return require('node:fs').readFileSync(candidate.path)
    }
  }

  return null
}

export default {
  async preview(ctx: any) {
    try {
      const sourceDocumentIdInput = ctx.request?.body?.sourceDocumentId || ctx.request?.body?.source_document_id || ctx.request?.query?.sourceDocumentId || null
      const sourceDocumentCodeInput = ctx.request?.body?.sourceDocumentCode || ctx.request?.body?.source_document_code || ctx.request?.query?.sourceDocumentCode || null
      const file = ctx.request?.files?.file || ctx.request?.files?.document || null

      const sourceDocument = sourceDocumentIdInput
        ? await findSourceDocumentById(sourceDocumentIdInput)
        : sourceDocumentCodeInput
          ? await findSourceDocumentByCode(sourceDocumentCodeInput)
          : null

      if (!sourceDocument?.id) {
        return {
          data: {
            valid: false,
            errors: [{ path: 'sourceDocument', message: 'A valid Curriculum Source Document is required.' }],
            warnings: [],
            sections: [],
            sourceLocations: [],
            summary: { totalRecords: 0, created: 0, updated: 0, skipped: 0, conflicts: 0, failed: 0 },
            sourceDocumentId: null,
          },
        }
      }

      const rawBuffer = readBufferFromRequest(ctx)
      if (!rawBuffer) {
        return {
          data: {
            valid: false,
            errors: [{ path: 'file', message: 'A .xlsx or .json file is required for import preview.' }],
            warnings: [],
            sections: [],
            sourceLocations: [],
            summary: { totalRecords: 0, created: 0, updated: 0, skipped: 0, conflicts: 0, failed: 0 },
            sourceDocumentId: sourceDocument.id,
            sourceDocumentCode: sourceDocument.code,
          },
        }
      }

      const originalName = String(file?.originalFilename || file?.originalname || ctx.request?.body?.fileName || 'import.xlsx')
      const extension = originalName.split('.').pop()?.toLowerCase() || ''

      let parsed: Record<string, any>
      if (extension === 'json') {
        const jsonText = rawBuffer.toString('utf8')
        const payload = JSON.parse(jsonText)
        parsed = normalizeJsonPackage(payload)
      } else {
        parsed = await parseWorkbookFile(rawBuffer)
      }

      const fileHash = computeHash({ originalName, bytes: rawBuffer.toString('base64') })
      const preview = await previewPackage(parsed, sourceDocument.id, sourceDocument.code, parsed.fileType || extension || 'unknown', fileHash)
      const previewToken = crypto.randomUUID()
      PREVIEW_STORE.set(previewToken, {
        ...preview,
        sourceDocumentId: sourceDocument.id,
        sourceDocumentCode: sourceDocument.code,
        sourceDocumentName: sourceDocument.title,
        previewToken,
        createdAt: new Date().toISOString(),
      })

      setTimeout(() => {
        if (PREVIEW_STORE.has(previewToken)) PREVIEW_STORE.delete(previewToken)
      }, 1000 * 60 * 15)

      return {
        data: {
          ...preview,
          previewToken,
          sourceDocumentId: sourceDocument.id,
          sourceDocumentCode: sourceDocument.code,
        },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected import preview error.'
      return {
        data: {
          valid: false,
          errors: [{ path: 'import', message }],
          warnings: [],
          sections: [],
          sourceLocations: [],
          summary: { totalRecords: 0, created: 0, updated: 0, skipped: 0, conflicts: 0, failed: 0 },
          sourceDocumentId: null,
          previewToken: null,
        },
      }
    }
  },

  async confirm(ctx: any) {
    const previewToken = textValue(ctx.request?.body?.previewToken || ctx.request?.query?.previewToken)
    const previewEntry = PREVIEW_STORE.get(previewToken)
    if (!previewEntry) {
      throw new Error('Preview token is missing or expired. Run the preview again before confirming.')
    }

    const errors = previewEntry.errors || []
    if (errors.length > 0) {
      throw new Error('Preview contains validation errors. Fix them before confirming import.')
    }

    const sourceDocument = await findSourceDocumentById(previewEntry.sourceDocumentId)
    if (!sourceDocument) {
      throw new Error('The selected source document no longer exists.')
    }

    const authenticatedUser = ctx.state?.user || null
    const userId = authenticatedUser?.id || null
    const batchCode = `CURI-${Date.now()}`

    const stats = {
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      sectionCount: 0,
      locationCount: 0,
    }

    const batchPayload: Record<string, any> = {
      batchCode,
      sourceDocument: sourceDocument.id,
      packageCode: previewEntry.packageCode || previewEntry.metadata?.packageCode || 'manual',
      fileType: previewEntry.fileType || 'unknown',
      fileHash: previewEntry.fileHash || '',
      status: 'confirmed',
      summary: JSON.stringify({ ...previewEntry.summary, sourceDocumentCode: sourceDocument.code }),
      startedAt: new Date().toISOString(),
      executedBy: userId,
    }

    const batchRecord = await strapi.db.query(BATCH_UID).create({
      data: batchPayload,
    })

    const savedSectionOperations = previewEntry.sections || []
    const savedLocationOperations = previewEntry.sourceLocations || []
    const sectionLookup = new Map<string, Record<string, any>>()
    for (const item of savedSectionOperations) {
      if (item?.importKey) sectionLookup.set(normalizeKey(item.importKey), item)
    }

    try {
      await strapi.db.connection.transaction(async (trx: any) => {
        const resolvedSectionIds = new Map<string, number>()

        for (const item of savedSectionOperations) {
          const action = item.action || 'create'
          if (action === 'skip') {
            stats.skipped += 1
            continue
          }

          const basePayload: Record<string, any> = {
            sourceDocument: sourceDocument.id,
            parent: null,
            sectionType: item.sectionType || null,
            title: item.title || '',
            body: item.body || null,
            sortOrder: item.sortOrder ?? 0,
          }
          const existingTargetId = item.targetRecord?.id || null

          if (action === 'create') {
            const created = await strapi.db.query(SECTION_UID).create({
              data: basePayload,
              select: ['id', 'documentId'],
              ...(trx ? { transacting: trx } : {}),
            } as any)
            
            const targetDocId = created?.documentId
            if (!targetDocId) {
              throw new Error(`Section created but documentId is missing for importKey '${item.importKey}'`)
            }
            
            resolvedSectionIds.set(normalizeKey(item.importKey), Number(created.id))
            sectionLookup.set(normalizeKey(item.importKey), { ...item, targetRecord: { id: created.id } })
            stats.created += 1
            await upsertImportMappingRecord({
              sourceDocumentId: sourceDocument.id,
              entityType: 'section',
              importKey: item.importKey,
              targetDocumentId: targetDocId,
              lastImportBatch: batchRecord.id,
              sourceHash: computeHash({ ...basePayload, importKey: item.importKey, rowNumber: item.rowNumber }),
              trx,
            })
            continue
          }

          if (action === 'update' && existingTargetId) {
            const targetSection = await strapi.db.query(SECTION_UID).findOne({ 
              where: { id: existingTargetId }, 
              select: ['id', 'documentId'] 
            })
            if (!targetSection) throw new Error(`Target section for importKey '${item.importKey}' no longer exists.`)
            
            const targetDocId = targetSection?.documentId
            if (!targetDocId) {
              throw new Error(`Target section found but documentId is missing for importKey '${item.importKey}'`)
            }
            
            const updated = await strapi.db.query(SECTION_UID).update({
              where: { id: existingTargetId },
              data: basePayload,
              ...(trx ? { transacting: trx } : {}),
            } as any)
            resolvedSectionIds.set(normalizeKey(item.importKey), Number(updated.id || existingTargetId))
            sectionLookup.set(normalizeKey(item.importKey), { ...item, targetRecord: { id: Number(updated.id || existingTargetId) } })
            stats.updated += 1
            await upsertImportMappingRecord({
              sourceDocumentId: sourceDocument.id,
              entityType: 'section',
              importKey: item.importKey,
              targetDocumentId: targetDocId,
              lastImportBatch: batchRecord.id,
              sourceHash: computeHash({ ...basePayload, importKey: item.importKey, rowNumber: item.rowNumber }),
              trx,
            })
          }
        }

        for (const item of savedSectionOperations) {
          const action = item.action || 'create'
          if (action === 'skip') continue

          const importKey = normalizeKey(item.importKey)
          const targetId = resolvedSectionIds.get(importKey)
          if (!targetId) continue

          const parentKey = normalizeKey(item.parentImportKey)
          const parentId = parentKey ? resolvedSectionIds.get(parentKey) ?? null : null
          if (parentKey && !parentId) {
            throw new Error(`Parent section '${parentKey}' for section '${importKey}' could not be resolved.`)
          }

          await strapi.db.query(SECTION_UID).update({
            where: { id: targetId },
            data: { parent: parentId },
            ...(trx ? { transacting: trx } : {}),
          } as any)
        }

        for (const item of savedLocationOperations) {
          const action = item.action || 'create'
          if (action === 'skip') {
            stats.skipped += 1
            continue
          }

          const sectionKey = normalizeKey(item.sectionKey || item.sectionImportKey || '')
          const sectionTarget = sectionKey ? resolvedSectionIds.get(sectionKey) ?? null : null
          if (sectionKey && !sectionTarget) {
            throw new Error(`Section importKey '${sectionKey}' for location '${item.importKey}' could not be resolved.`)
          }

          const payload: Record<string, any> = {
            sourceDocument: sourceDocument.id,
            section: sectionTarget,
            startPage: item.startPage || null,
            endPage: item.endPage || null,
            locator: item.locator || null,
            excerpt: item.excerpt || null,
          }

          if (action === 'create') {
            const created = await strapi.db.query(LOCATION_UID).create({
              data: payload,
              select: ['id', 'documentId'],
              ...(trx ? { transacting: trx } : {}),
            } as any)
            
            const targetDocId = created?.documentId
            if (!targetDocId) {
              throw new Error(`SourceLocation created but documentId is missing for importKey '${item.importKey}'`)
            }
            
            stats.created += 1
            await upsertImportMappingRecord({
              sourceDocumentId: sourceDocument.id,
              entityType: 'source-location',
              importKey: item.importKey,
              targetDocumentId: targetDocId,
              lastImportBatch: batchRecord.id,
              sourceHash: computeHash({ ...payload, importKey: item.importKey, rowNumber: item.rowNumber }),
              trx,
            })
            continue
          }

          if (action === 'update' && item.targetRecord?.id) {
            const targetLocation = await strapi.db.query(LOCATION_UID).findOne({ 
              where: { id: item.targetRecord.id }, 
              select: ['id', 'documentId'] 
            })
            if (!targetLocation) throw new Error(`Target source location for importKey '${item.importKey}' no longer exists.`)
            
            const targetDocId = targetLocation?.documentId
            if (!targetDocId) {
              throw new Error(`Target SourceLocation found but documentId is missing for importKey '${item.importKey}'`)
            }
            
            await strapi.db.query(LOCATION_UID).update({
              where: { id: item.targetRecord.id },
              data: payload,
              ...(trx ? { transacting: trx } : {}),
            } as any)
            stats.updated += 1
            await upsertImportMappingRecord({
              sourceDocumentId: sourceDocument.id,
              entityType: 'source-location',
              importKey: item.importKey,
              targetDocumentId: targetDocId,
              lastImportBatch: batchRecord.id,
              sourceHash: computeHash({ ...payload, importKey: item.importKey, rowNumber: item.rowNumber }),
              trx,
            })
          }
        }
      })
    } catch (error) {
      await strapi.db.query(BATCH_UID).update({
        where: { id: batchRecord.id },
        data: {
          status: 'failed',
          completedAt: new Date().toISOString(),
          summary: JSON.stringify({ error: (error as any)?.message || 'Import failed', stats }),
        },
      })
      throw error
    }

    await strapi.db.query(BATCH_UID).update({
      where: { id: batchRecord.id },
      data: {
        status: 'completed',
        completedAt: new Date().toISOString(),
        summary: JSON.stringify({
          ...previewEntry.summary,
          created: stats.created,
          updated: stats.updated,
          skipped: stats.skipped,
          failed: stats.failed,
          sourceDocumentCode: sourceDocument.code,
          batchCode,
        }),
      },
    })

    PREVIEW_STORE.delete(previewToken)

    return {
      data: {
        batchCode,
        sourceDocumentId: sourceDocument.id,
        sourceDocumentCode: sourceDocument.code,
        status: 'completed',
        summary: {
          created: stats.created,
          updated: stats.updated,
          skipped: stats.skipped,
          failed: stats.failed,
          sectionCount: savedSectionOperations.length,
          locationCount: savedLocationOperations.length,
        },
      },
    }
  },

  async listBatches(ctx: any) {
    const batches = await strapi.db.query(BATCH_UID).findMany({
      orderBy: { createdAt: 'desc' },
      select: ['id', 'batchCode', 'sourceDocument', 'packageCode', 'fileType', 'status', 'summary', 'startedAt', 'completedAt', 'createdAt'],
    })

    return { data: batches }
  },

  async batchDetail(ctx: any) {
    const id = parsePositiveInt(ctx.params?.id)
    if (!id) throw new Error('Invalid batch id.')

    const batch = await strapi.db.query(BATCH_UID).findOne({
      where: { id },
      select: ['id', 'batchCode', 'sourceDocument', 'packageCode', 'fileType', 'status', 'summary', 'startedAt', 'completedAt', 'createdAt'],
    })

    if (!batch) throw new Error('Batch was not found.')
    return { data: batch }
  },
}
