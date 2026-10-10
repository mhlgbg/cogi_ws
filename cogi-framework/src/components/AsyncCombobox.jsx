import React from 'react'
import AsyncSelect from 'react-select/async'

export default function AsyncCombobox({
  loadOptions,
  value,
  onChange,
  placeholder = 'Select...',
  isClearable = true,
  defaultOptions = true,
  cacheOptions = true,
  isLoading = false,
  noOptionsMessage = () => 'No options found',
  ...rest
}) {
  return (
    <AsyncSelect
      {...rest}
      cacheOptions={cacheOptions}
      defaultOptions={defaultOptions}
      loadOptions={loadOptions}
      getOptionLabel={(opt) => opt?.label || ''}
      getOptionValue={(opt) => String(opt?.value)}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      isClearable={isClearable}
      isLoading={isLoading}
      noOptionsMessage={noOptionsMessage}
      menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
      menuPosition='fixed'
      styles={{
        menu: (provided) => ({ ...provided, zIndex: 9999 }),
        menuPortal: (provided) => ({ ...provided, zIndex: 9999 }),
      }}
    />
  )
}

export function formatOptionLabel(option) {
  if (!option) return ''
  return option.label
}
