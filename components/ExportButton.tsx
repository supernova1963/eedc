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
          <span className="animate-spin">⏳</span>
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
