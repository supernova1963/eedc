// components/PDFExportButton.tsx
// PDF Export functionality mit jsPDF

'use client'

import { useState } from 'react'
import SimpleIcon from './SimpleIcon'

interface PDFExportButtonProps {
  data: any[]
  filename: string
  title: string
  headers: string[]
  mapDataToRow: (item: any) => any[]
  className?: string
  summary?: { label: string; value: string }[]
}

export default function PDFExportButton({
  data,
  filename,
  title,
  headers,
  mapDataToRow,
  className = '',
  summary = []
}: PDFExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const exportToPDF = async () => {
    setIsExporting(true)

    try {
      // Dynamischer Import von jsPDF
      const jsPDF = (await import('jspdf')).default
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF()

      // Titel
      doc.setFontSize(18)
      doc.text(title, 14, 20)

      // Datum
      doc.setFontSize(10)
      doc.text(`Erstellt am: ${new Date().toLocaleDateString('de-DE')}`, 14, 28)

      let yPos = 35

      // Summary-Informationen
      if (summary.length > 0) {
        doc.setFontSize(12)
        doc.text('Zusammenfassung:', 14, yPos)
        yPos += 7

        doc.setFontSize(10)
        summary.forEach(item => {
          doc.text(`${item.label}: ${item.value}`, 14, yPos)
          yPos += 5
        })
        yPos += 5
      }

      // Tabelle erstellen
      const rows = data.map(item => mapDataToRow(item))

      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: yPos,
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [59, 130, 246], // blue-600
          textColor: 255,
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [249, 250, 251], // gray-50
        },
        margin: { top: 10, right: 14, bottom: 10, left: 14 },
      })

      // Footer
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.text(
          `Seite ${i} von ${pageCount}`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 10,
          { align: 'center' }
        )
      }

      // PDF speichern
      doc.save(`${filename}.pdf`)

      setTimeout(() => setIsExporting(false), 1000)
    } catch (error) {
      console.error('PDF Export failed:', error)
      setIsExporting(false)
      alert('PDF-Export fehlgeschlagen. Bitte versuche es erneut.')
    }
  }

  return (
    <button
      onClick={exportToPDF}
      disabled={isExporting || data.length === 0}
      className={`
        inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors
        ${isExporting || data.length === 0
          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
          : 'bg-red-600 hover:bg-red-700 text-white'
        }
        ${className}
      `}
      title={data.length === 0 ? 'Keine Daten zum Exportieren' : 'Als PDF exportieren'}
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
          PDF Export
        </>
      )}
    </button>
  )
}
