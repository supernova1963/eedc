// components/ui/FormSelect.tsx
// Wiederverwendbare Select-Komponente für Formulare

import { input } from '@/lib/styles'

interface FormSelectOption {
  value: string
  label: string
}

interface FormSelectProps {
  label: string
  name: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  options: FormSelectOption[]
  required?: boolean
  disabled?: boolean
  id?: string
  className?: string
}

export default function FormSelect({
  label,
  name,
  value,
  onChange,
  options,
  required = false,
  disabled = false,
  id,
  className = ''
}: FormSelectProps) {
  const selectId = id || name

  return (
    <div className={className}>
      <label htmlFor={selectId} className={input.label}>
        {label}{required && ' *'}
      </label>
      <select
        id={selectId}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        className={`${input.select} ${disabled ? input.disabled : ''}`}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
