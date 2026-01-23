// components/ui/FormSelect.tsx
// Wiederverwendbare Select-Komponente für Formulare

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
      <label htmlFor={selectId} className="block text-sm font-medium text-gray-700 mb-2">
        {label}{required && ' *'}
      </label>
      <select
        id={selectId}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
