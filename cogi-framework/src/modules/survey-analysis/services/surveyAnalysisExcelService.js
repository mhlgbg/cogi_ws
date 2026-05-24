import * as XLSX from 'xlsx'
import { parseDhcdStudentCode } from './dhcdStudentCodeParser'

const REQUIRED_FIELDS = ['studentCode', 'requiredCount', 'notStartedCount']

const HEADER_ALIASES = {
  studentCode: ['tendangnhap', 'manguoidung', 'masinhvien', 'username', 'studentcode'],
  fullName: ['hovaten', 'hovatensinhvien', 'hoten', 'hotensinhvien', 'fullname', 'full_name', 'tennguoidung', 'tensinhvien', 'studentname', 'name'],
  requiredCount: ['sokhaosatphailam', 'requiredcount'],
  completedCount: ['sokhaosatdalam', 'completedcount'],
  doingCount: ['sokhaosatdanglamdodang', 'sokhaosatdanglam', 'doingcount'],
  notStartedCount: ['sokhaosatchualam', 'notstartedcount'],
}

export const DHCD_SURVEY_ANALYSIS_CONFIG = {
  schoolCode: 'dhcd',
  parser: parseDhcdStudentCode,
  headerAliases: HEADER_ALIASES,
}

function stripVietnamese(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
}

function normalizeHeader(value) {
  return stripVietnamese(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function toDisplayText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function toNonNegativeNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const normalized = String(value).replace(/,/g, '').trim()
  if (!normalized) return null
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}

function formatPercent(value) {
  const numeric = Number(value || 0)
  return `${(numeric * 100).toFixed(2)}%`
}

function formatDateCode(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

function sanitizeSheetName(value, fallback = 'Sheet') {
  const normalized = String(value || '')
    .replace(/[\\/?*\[\]:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return (normalized || fallback).slice(0, 31)
}

function createWarning({ rowNumber = null, studentCode = '', type, message, detail = '' }) {
  return {
    rowNumber,
    studentCode: toDisplayText(studentCode),
    type,
    message,
    detail: toDisplayText(detail),
  }
}

function resolveColumnsFromRow(sampleRow, headerAliases = HEADER_ALIASES) {
  const entries = Object.keys(sampleRow || {}).map((header) => [normalizeHeader(header), header])
  const normalizedMap = new Map(entries)

  return Object.fromEntries(
    Object.entries(headerAliases).map(([field, aliases]) => {
      const matchedAlias = aliases.find((alias) => normalizedMap.has(alias))
      return [field, matchedAlias ? normalizedMap.get(matchedAlias) : null]
    }),
  )
}

function readFirstSheetRows(fileBuffer) {
  const workbook = XLSX.read(fileBuffer, { type: 'array' })
  const firstSheetName = workbook.SheetNames?.[0]
  if (!firstSheetName) {
    return { sheetName: '', rows: [] }
  }

  const worksheet = workbook.Sheets[firstSheetName]
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    defval: '',
    raw: false,
  })

  return {
    sheetName: firstSheetName,
    rows: Array.isArray(rows) ? rows : [],
  }
}

function aggregateValidRows(validRows) {
  const grouped = new Map()

  for (const row of validRows) {
    const key = [row.cohort, row.admissionYear, row.majorCode, row.majorName].join('|')
    const current = grouped.get(key) || {
      cohort: row.cohort,
      admissionYear: row.admissionYear,
      majorCode: row.majorCode,
      majorName: row.majorName,
      studentCount: 0,
      requiredTotal: 0,
      completedTotal: 0,
      doingTotal: 0,
      notStartedTotal: 0,
      completionRate: 0,
    }

    current.studentCount += 1
    current.requiredTotal += row.requiredCount
    current.completedTotal += row.completedCount
    current.doingTotal += row.doingCount
    current.notStartedTotal += row.notStartedCount
    grouped.set(key, current)
  }

  return Array.from(grouped.values())
    .map((item) => ({
      ...item,
      completionRate: item.requiredTotal > 0 ? item.completedTotal / item.requiredTotal : 0,
    }))
    .sort((left, right) => {
      if (left.admissionYear !== right.admissionYear) return right.admissionYear - left.admissionYear
      return String(left.majorCode).localeCompare(String(right.majorCode))
    })
}

function groupValidRowsByMajor(validRows) {
  const grouped = new Map()

  for (const row of validRows) {
    const key = [row.majorCode, row.majorName].join('|')
    const current = grouped.get(key) || {
      majorCode: row.majorCode,
      majorName: row.majorName,
      rows: [],
    }

    current.rows.push(row)
    grouped.set(key, current)
  }

  return Array.from(grouped.values())
    .map((item) => ({
      ...item,
      rows: item.rows.slice().sort((left, right) => {
        if (left.admissionYear !== right.admissionYear) return right.admissionYear - left.admissionYear
        return String(left.studentCode).localeCompare(String(right.studentCode))
      }),
    }))
    .sort((left, right) => String(left.majorCode).localeCompare(String(right.majorCode)))
}

function buildMajorProgressSheetRows(rows) {
  return rows.map((item, index) => ({
    STT: index + 1,
    'Khóa': item.cohort,
    'Năm tuyển sinh': item.admissionYear,
    'Mã sinh viên': item.studentCode,
    'Họ và tên': item.fullName || '',
    'Mã ngành': item.majorCode,
    'Ngành': item.majorName,
    'Hệ đào tạo': item.educationLevelName,
    'Thời gian đào tạo': item.trainingDuration,
    'Số khảo sát phải làm': item.requiredCount,
    'Đã hoàn thành': item.completedCount,
    'Đang làm': item.doingCount,
    'Chưa làm': item.notStartedCount,
    'Tỷ lệ hoàn thành': formatPercent(item.completionRate),
  }))
}

function buildMajorStudentSheetRows(rows) {
  return rows.map((item, index) => ({
    STT: index + 1,
    'Khóa': item.cohort,
    'Năm tuyển sinh': item.admissionYear,
    'Mã sinh viên': item.studentCode,
    'Họ và tên': item.fullName || '',
    'Mã ngành': item.majorCode,
    'Ngành': item.majorName,
    'Hệ đào tạo': item.educationLevelName,
    'Thời gian đào tạo': item.trainingDuration,
  }))
}

export async function analyzeSurveyExcelFile(file, config = DHCD_SURVEY_ANALYSIS_CONFIG) {
  const bytes = await file.arrayBuffer()
  const { sheetName, rows } = readFirstSheetRows(bytes)
  const warnings = []
  const validRows = []
  const studentCodeParser = typeof config?.parser === 'function' ? config.parser : parseDhcdStudentCode

  const columns = resolveColumnsFromRow(rows[0] || {}, config?.headerAliases || HEADER_ALIASES)
  const missingColumns = REQUIRED_FIELDS.filter((field) => !columns[field])

  if (missingColumns.length > 0) {
    missingColumns.forEach((field) => {
      warnings.push(createWarning({
        type: 'missing_column',
        message: 'Thiếu cột bắt buộc',
        detail: field,
      }))
    })
  }

  if (missingColumns.length === 0) {
    rows.forEach((row, index) => {
      const rowNumber = index + 2
      const studentCodeRaw = row[columns.studentCode]
      const studentCodeText = toDisplayText(studentCodeRaw)
      const fullName = columns.fullName ? toDisplayText(row[columns.fullName]) : ''

      const parsedStudent = studentCodeParser(studentCodeText)
      if (!parsedStudent.ok) {
        warnings.push(createWarning({
          rowNumber,
          studentCode: studentCodeText,
          type: 'invalid_student_code',
          message: 'Mã sinh viên sai định dạng',
          detail: studentCodeText,
        }))
        return
      }

      const requiredCount = toNonNegativeNumber(row[columns.requiredCount])
      const completedCountFromFile = columns.completedCount
        ? toNonNegativeNumber(row[columns.completedCount])
        : null
      const doingCount = columns.doingCount
        ? toNonNegativeNumber(row[columns.doingCount])
        : null
      const notStartedCount = toNonNegativeNumber(row[columns.notStartedCount])

      if (requiredCount === null || notStartedCount === null || (doingCount === null && completedCountFromFile === null)) {
        warnings.push(createWarning({
          rowNumber,
          studentCode: parsedStudent.studentCode,
          type: 'invalid_counts',
          message: 'Số liệu khảo sát không hợp lệ',
          detail: JSON.stringify({
            requiredCount: row[columns.requiredCount],
            completedCount: columns.completedCount ? row[columns.completedCount] : undefined,
            doingCount: columns.doingCount ? row[columns.doingCount] : undefined,
            notStartedCount: row[columns.notStartedCount],
          }),
        }))
        return
      }

      const computedDoingCount = doingCount !== null
        ? doingCount
        : Math.max(0, requiredCount - (completedCountFromFile || 0) - notStartedCount)

      const completedCount = completedCountFromFile !== null
        ? completedCountFromFile
        : requiredCount - computedDoingCount - notStartedCount

      if (completedCount < 0) {
        warnings.push(createWarning({
          rowNumber,
          studentCode: parsedStudent.studentCode,
          type: 'negative_completed_count',
          message: 'completedCount âm',
          detail: JSON.stringify({ requiredCount, doingCount: computedDoingCount, notStartedCount, completedCount }),
        }))
        return
      }

      if (computedDoingCount < 0) {
        warnings.push(createWarning({
          rowNumber,
          studentCode: parsedStudent.studentCode,
          type: 'invalid_counts',
          message: 'Số liệu khảo sát không hợp lệ',
          detail: JSON.stringify({ requiredCount, doingCount: computedDoingCount, notStartedCount, completedCount }),
        }))
        return
      }

      if (parsedStudent.majorName === 'Không xác định') {
        warnings.push(createWarning({
          rowNumber,
          studentCode: parsedStudent.studentCode,
          type: 'unknown_major_code',
          message: 'Không tìm thấy mã ngành trong mapping',
          detail: parsedStudent.majorCode,
        }))
      }

      validRows.push({
        rowNumber,
        studentCode: parsedStudent.studentCode,
        fullName,
        admissionYear: parsedStudent.admissionYear,
        cohort: parsedStudent.cohort,
        trainingDuration: parsedStudent.trainingDuration,
        educationLevelCode: parsedStudent.educationLevelCode,
        educationLevelName: parsedStudent.educationLevelName,
        majorCode: parsedStudent.majorCode,
        majorName: parsedStudent.majorName,
        studentOrdinal: parsedStudent.studentOrdinal,
        requiredCount,
        doingCount: computedDoingCount,
        notStartedCount,
        completedCount,
        completionRate: requiredCount > 0 ? completedCount / requiredCount : 0,
      })
    })
  }

  const groupedRows = aggregateValidRows(validRows)
  const requiredTotal = validRows.reduce((sum, row) => sum + row.requiredCount, 0)
  const completedTotal = validRows.reduce((sum, row) => sum + row.completedCount, 0)
  const doingTotal = validRows.reduce((sum, row) => sum + row.doingCount, 0)
  const notStartedTotal = validRows.reduce((sum, row) => sum + row.notStartedCount, 0)

  return {
    schoolCode: config?.schoolCode || 'unknown',
    fileName: file?.name || '',
    sheetName,
    columnMapping: columns,
    missingColumns,
    validRows,
    groupedRows,
    warnings,
    summary: {
      totalRows: rows.length,
      validRowCount: validRows.length,
      warningCount: warnings.length,
      totalStudents: validRows.length,
      requiredTotal,
      completedTotal,
      doingTotal,
      notStartedTotal,
      completionRate: requiredTotal > 0 ? completedTotal / requiredTotal : 0,
    },
  }
}

export async function analyzeDhcdSurveyExcelFile(file) {
  return analyzeSurveyExcelFile(file, DHCD_SURVEY_ANALYSIS_CONFIG)
}

export function exportDhcdSurveyAnalysisReport(result) {
  const workbook = XLSX.utils.book_new()
  const summaryRows = (result?.groupedRows || []).map((item, index) => ({
    STT: index + 1,
    'Khóa': item.cohort,
    'Năm tuyển sinh': item.admissionYear,
    'Mã ngành': item.majorCode,
    'Ngành': item.majorName,
    'Số sinh viên': item.studentCount,
    'Tổng khảo sát phải làm': item.requiredTotal,
    'Đã hoàn thành': item.completedTotal,
    'Đang làm': item.doingTotal,
    'Chưa làm': item.notStartedTotal,
    'Tỷ lệ hoàn thành': formatPercent(item.completionRate),
  }))
  const warningRows = (result?.warnings || []).map((item, index) => ({
    STT: index + 1,
    'Dòng': item.rowNumber || '',
    'Mã sinh viên': item.studentCode || '',
    'Loại cảnh báo': item.type,
    'Thông điệp': item.message,
    'Chi tiết': item.detail || '',
  }))

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'TongHop')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(warningRows), 'CanhBao')

  XLSX.writeFile(workbook, `survey-analysis-dhcd-${formatDateCode()}.xlsx`)
}

export function exportDhcdSurveyMajorProgressReport(result) {
  const workbook = XLSX.utils.book_new()
  const majorGroups = groupValidRowsByMajor(result?.validRows || [])
  const majorSheetHeaders = [
    'STT',
    'Khóa',
    'Năm tuyển sinh',
    'Mã sinh viên',
    'Họ và tên',
    'Mã ngành',
    'Ngành',
    'Hệ đào tạo',
    'Thời gian đào tạo',
    'Số khảo sát phải làm',
    'Đã hoàn thành',
    'Đang làm',
    'Chưa làm',
    'Tỷ lệ hoàn thành',
  ]
  const warningRows = (result?.warnings || []).map((item, index) => ({
    STT: index + 1,
    'Dòng': item.rowNumber || '',
    'Mã sinh viên': item.studentCode || '',
    'Loại cảnh báo': item.type,
    'Thông điệp': item.message,
    'Chi tiết': item.detail || '',
  }))

  majorGroups.forEach((group) => {
    const sheetRows = buildMajorProgressSheetRows(group.rows)
    const sheetName = sanitizeSheetName(`${group.majorCode}-${group.majorName}`, `Nganh-${group.majorCode || 'NA'}`)
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheetRows, { header: majorSheetHeaders }), sheetName)
  })

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(warningRows), 'CanhBao')

  XLSX.writeFile(workbook, `survey-analysis-dhcd-major-progress-${formatDateCode()}.xlsx`)
}

export function exportDhcdStudentsByMajor(result) {
  const workbook = XLSX.utils.book_new()
  const majorGroups = groupValidRowsByMajor(result?.validRows || [])
  const majorSheetHeaders = [
    'STT',
    'Khóa',
    'Năm tuyển sinh',
    'Mã sinh viên',
    'Họ và tên',
    'Mã ngành',
    'Ngành',
    'Hệ đào tạo',
    'Thời gian đào tạo',
  ]
  const warningRows = (result?.warnings || []).map((item, index) => ({
    STT: index + 1,
    'Dòng': item.rowNumber || '',
    'Mã sinh viên': item.studentCode || '',
    'Loại cảnh báo': item.type,
    'Thông điệp': item.message,
    'Chi tiết': item.detail || '',
  }))

  majorGroups.forEach((group) => {
    const sheetRows = buildMajorStudentSheetRows(group.rows)
    const sheetName = sanitizeSheetName(`${group.majorCode}-${group.majorName}`, `Nganh-${group.majorCode || 'NA'}`)
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheetRows, { header: majorSheetHeaders }), sheetName)
  })

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(warningRows), 'CanhBao')

  XLSX.writeFile(workbook, `survey-analysis-dhcd-students-by-major-${formatDateCode()}.xlsx`)
}
