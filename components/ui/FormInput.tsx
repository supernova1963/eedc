// components/ui/FormInput.tsx
// Wiederverwendbare Input-Komponente für Formulare

import { input } from '@/lib/styles'

interface FormInputProps {
  label: string
  name: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  type?: 'text' | 'number' | 'date' | 'email' | 'password'
  required?: boolean
  placeholder?: string
  hint?: string
  step?: string
  id?: string
  className?: string
  disabled?: boolean
}

export default function FormInput({
  label,
  name,
  value,
  onChange,
  type = 'text',
  required = false,
  placeholder,
  hint,
  step,
  id,
  className = '',
  disabled = false
}: FormInputProps) {
  const inputId = id || name

  return (
    <div className={className}>
      <label htmlFor={inputId} className={input.label}>
        {label}{required && ' *'}
      </label>
      <input
        id={inputId}
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        step={step}
        disabled={disabled}
        className={`${input.base} ${disabled ? input.disabled : ''}`}
      />
      {hint && (
        <p className={input.hint}>{hint}</p>
      )}
    </div>
  )
}
