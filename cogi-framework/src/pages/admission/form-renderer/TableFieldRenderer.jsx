import {
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'

function padDatePart(value) {
  return String(value).padStart(2, '0')
}

function formatDisplayDate(value) {
  const text = String(value ?? '').trim()
  if (!text) return ''

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`
  }

  const localMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
  if (localMatch) {
    return `${padDatePart(localMatch[1])}/${padDatePart(localMatch[2])}/${localMatch[3]}`
  }

  return text
}

function normalizeDateInput(value) {
  const digitsOnly = String(value ?? '').replace(/\D+/g, '').slice(0, 8)
  if (digitsOnly.length <= 2) return digitsOnly
  if (digitsOnly.length <= 4) return `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2)}`
  return `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2, 4)}/${digitsOnly.slice(4)}`
}

function getTableRows(field, value) {
  if (Array.isArray(value) && value.length > 0) return value
  if (Array.isArray(field?.rows)) return field.rows
  return []
}

function getRowLabel(row, index) {
  if (!row || typeof row !== 'object') return `Hàng ${index + 1}`

  const label = row.label || row.title || row.name || row.grade || row.id
  return String(label || `Hàng ${index + 1}`)
}

function hasStaticRowValue(rowValue, columnKey) {
  const value = rowValue?.[columnKey]
  if (value === null || value === undefined) return false
  return String(value).trim() !== ''
}

function isDisplayOnlyColumn(column, rowValue) {
  return column?.hasExplicitType !== true && hasStaticRowValue(rowValue, column?.key)
}

function renderCellInput({ field, column, rowIndex, rowValue, onChangeCell, disabled, error }) {
  if (isDisplayOnlyColumn(column, rowValue)) {
    return <span className='fw-semibold'>{String(rowValue?.[column.key] ?? '')}</span>
  }

  const value = rowValue?.[column.key]
  const inputName = `${field.key}.${rowIndex}.${column.key}`
  const cellError = error?.cells?.[`${rowIndex}.${column.key}`]

  if (column.type === 'textarea') {
    return (
      <>
        <CFormTextarea
          rows={2}
          name={inputName}
          value={String(value ?? '')}
          placeholder={column.placeholder || undefined}
          onChange={(event) => onChangeCell(rowIndex, column.key, event.target.value)}
          invalid={Boolean(cellError)}
          disabled={disabled}
          readOnly={disabled}
        />
        {cellError ? <div className='text-danger small mt-1'>{cellError}</div> : null}
      </>
    )
  }

  if (column.type === 'select') {
    return (
      <>
        <CFormSelect
          name={inputName}
          value={String(value ?? '')}
          onChange={(event) => onChangeCell(rowIndex, column.key, event.target.value)}
          invalid={Boolean(cellError)}
          disabled={disabled}
        >
          <option value=''>Chọn {column.label.toLowerCase()}</option>
          {column.options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </CFormSelect>
        {cellError ? <div className='text-danger small mt-1'>{cellError}</div> : null}
      </>
    )
  }

  return (
    <>
      <CFormInput
        type={column.type === 'number' ? 'number' : 'text'}
        name={inputName}
        inputMode={column.type === 'date' ? 'numeric' : undefined}
        value={column.type === 'date' ? formatDisplayDate(value) : String(value ?? '')}
        placeholder={column.type === 'date' ? (column.placeholder || 'dd/MM/yyyy') : column.placeholder || undefined}
        min={column.type === 'number' && column.min !== null ? column.min : undefined}
        max={column.type === 'number' && column.max !== null ? column.max : undefined}
        step={column.type === 'number' && column.step !== null ? column.step : undefined}
        onChange={(event) => onChangeCell(
          rowIndex,
          column.key,
          column.type === 'date' ? normalizeDateInput(event.target.value) : event.target.value,
        )}
        invalid={Boolean(cellError)}
        disabled={disabled}
        readOnly={disabled}
      />
      {cellError ? <div className='text-danger small mt-1'>{cellError}</div> : null}
    </>
  )
}

export default function TableFieldRenderer({ field, value, error, onChangeCell, disabled }) {
  const rows = getTableRows(field, value)
  const columns = Array.isArray(field?.columns) ? field.columns : []
  const sampleRow = rows[0] || null
  const hasStaticLabelColumn = columns.some((column) => isDisplayOnlyColumn(column, sampleRow))
  const tableLabel = field.label || field.title || ''
  const totalColumnCount = columns.length + (hasStaticLabelColumn ? 0 : 1)

  return (
    <div className='border rounded-3 p-3 bg-light'>
      <div className='d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2'>
        <CFormLabel className='mb-0'>{tableLabel}</CFormLabel>
      </div>

      <CTable bordered responsive small className='mb-0 bg-white'>
        <CTableHead>
          <CTableRow>
            {!hasStaticLabelColumn ? <CTableHeaderCell style={{ minWidth: 140 }}>Dòng</CTableHeaderCell> : null}
            {columns.map((column) => (
              <CTableHeaderCell key={column.key} style={{ minWidth: 180 }}>
                {column.label}
              </CTableHeaderCell>
            ))}
          </CTableRow>
        </CTableHead>
        <CTableBody>
          {rows.length === 0 || columns.length === 0 ? (
            <CTableRow>
              <CTableDataCell colSpan={Math.max(totalColumnCount, 1)} className='text-center text-body-secondary'>
                Chưa có dữ liệu bảng
              </CTableDataCell>
            </CTableRow>
          ) : rows.map((row, rowIndex) => (
            <CTableRow key={row.id || row.key || row.label || rowIndex}>
              {!hasStaticLabelColumn ? (
                <CTableDataCell>
                  <strong>{getRowLabel(row, rowIndex)}</strong>
                </CTableDataCell>
              ) : null}
              {columns.map((column) => (
                <CTableDataCell key={column.key}>
                  {renderCellInput({
                    field,
                    column,
                    rowIndex,
                    rowValue: row,
                    error,
                    onChangeCell,
                    disabled,
                  })}
                </CTableDataCell>
              ))}
            </CTableRow>
          ))}
        </CTableBody>
      </CTable>
    </div>
  )
}