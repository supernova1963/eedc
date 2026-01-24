// components/ExportButton.tsx
// CSV Export functionality for evaluation data

'use client'

import { useState } from 'react'
import SimpleIcon from './SimpleIcon'

interface ExportButtonProps {
  data: any[]
  filename: string
  headers: string[]
  mapDataToRow: (item: any) => any[]
  className?: string
}

export default function ExportButton({
  data,
  filename,
  headers,
  mapDataToRow,
  className = ''
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const exportToCSV = () => {
    setIsExporting(true)

    try {
      // Create CSV content
      const csvRows: string[] = []

      // Add headers
      csvRows.push(headers.join(';'))

      // Add data rows
      data.forEach(item => {
        const row = mapDataToRow(item)
        csvRows.push(row.join(';'))
      })

      const csvContent = csvRows.join('\n')

      // Add BOM for proper Excel UTF-8 handling
      const BOM = '\uFEFF'
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })

      // Create download link
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `${filename}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setTimeout(() => setIsExporting(false), 1000)
    } catch (error) {
      console.error('Export failed:', error)
      setIsExporting(false)
      alert('Export fehlgeschlagen. Bitte versuche es erneut.')
    }
  }

  return (
    <button
      onClick={exportToCSV}
      disabled={isExporting || data.length === 0}
      className={`
        inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors
        ${isExporting || data.length === 0
          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
          : 'bg-green-600 hover:bg-green-700 text-white'
        }
        ${className}
      `}
      title={data.length === 0 ? 'Keine Daten zum Exportieren' : 'Als CSV exportieren'}
    >
      {isExporting ? (
        <>
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
          Exportiere...
        </>
      ) : (
        <>
          <SimpleIcon type="file" className="w-4 h-4" />
          CSV Export
        </>
      )}
    </button>
  )
}
