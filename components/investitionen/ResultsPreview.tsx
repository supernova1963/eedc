// components/investitionen/ResultsPreview.tsx
// Vorschau der berechneten Werte (Einsparung, ROI, CO2)

interface ResultsPreviewProps {
  jahresEinsparung: number
  co2Einsparung: number
  mehrkosten: number
}

export default function ResultsPreview({ jahresEinsparung, co2Einsparung, mehrkosten }: ResultsPreviewProps) {
  if (jahresEinsparung <= 0) return null

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
      <h4 className="font-medium text-green-900 mb-3">Automatisch berechnet:</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-green-700">Jahrliche Einsparung:</span>
          <div className="font-bold text-green-900 text-lg">
            {jahresEinsparung.toLocaleString('de-DE')} Euro
          </div>
        </div>
        {mehrkosten > 0 && (
          <>
            <div>
              <span className="text-green-700">ROI:</span>
              <div className="font-bold text-green-900 text-lg">
                {((jahresEinsparung / mehrkosten) * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <span className="text-green-700">Amortisation:</span>
              <div className="font-bold text-green-900 text-lg">
                {(mehrkosten / jahresEinsparung).toFixed(1)} Jahre
              </div>
            </div>
          </>
        )}
        <div>
          <span className="text-green-700">CO2-Einsparung:</span>
          <div className="font-bold text-green-900 text-lg">
            {(co2Einsparung / 1000).toFixed(2)} t/Jahr
          </div>
        </div>
      </div>
    </div>
  )
}
