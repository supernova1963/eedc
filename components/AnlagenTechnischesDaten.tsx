// components/AnlagenTechnischesDaten.tsx
// Technische Daten (für Bestandsdaten & Migration)

'use client'

import SimpleIcon from './SimpleIcon'

export default function AnlagenTechnischesDaten({ anlage }: { anlage: any }) {
  const fmt = (num?: number) => {
    if (!num && num !== 0) return '-'
    return num.toLocaleString('de-DE', { maximumFractionDigits:2 })
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <SimpleIcon type="settings" className="w-5 h-5 text-gray-600" />
        Technische Daten
      </h2>

      <p className="text-sm text-gray-600 mb-6">
        Detaillierte technische Informationen. Diese Felder werden zukünftig über Investitionen verwaltet.
      </p>

      <div className="space-y-6">
        {/* Basis */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3">Basis</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-600">Anlagentyp</div>
              <div className="font-medium text-gray-900">{anlage.anlagentyp || '-'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Installationsdatum</div>
              <div className="font-medium text-gray-900">
                {anlage.installationsdatum 
                  ? new Date(anlage.installationsdatum).toLocaleDateString('de-DE')
                  : '-'}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Leistung</div>
              <div className="font-medium text-gray-900">{fmt(anlage.leistung_kwp)} kWp</div>
            </div>
          </div>
        </div>

        {/* Module */}
        {(anlage.hersteller || anlage.modell || anlage.anzahl_module) && (
          <div className="pt-4 border-t">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Module</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {anlage.hersteller && (
                <div>
                  <div className="text-sm text-gray-600">Hersteller</div>
                  <div className="font-medium text-gray-900">{anlage.hersteller}</div>
                </div>
              )}
              {anlage.modell && (
                <div>
                  <div className="text-sm text-gray-600">Modell</div>
                  <div className="font-medium text-gray-900">{anlage.modell}</div>
                </div>
              )}
              {anlage.anzahl_module && (
                <div>
                  <div className="text-sm text-gray-600">Anzahl</div>
                  <div className="font-medium text-gray-900">{anlage.anzahl_module} Module</div>
                </div>
              )}
              {anlage.ausrichtung && (
                <div>
                  <div className="text-sm text-gray-600">Ausrichtung</div>
                  <div className="font-medium text-gray-900">{anlage.ausrichtung}</div>
                </div>
              )}
              {anlage.neigungswinkel_grad && (
                <div>
                  <div className="text-sm text-gray-600">Neigung</div>
                  <div className="font-medium text-gray-900">{anlage.neigungswinkel_grad}°</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Batterie */}
        {anlage.batteriekapazitaet_kwh > 0 && (
          <div className="pt-4 border-t">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Batterie</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-gray-600">Kapazität</div>
                <div className="font-medium text-gray-900">{fmt(anlage.batteriekapazitaet_kwh)} kWh</div>
              </div>
              {anlage.batterie_hersteller && (
                <div>
                  <div className="text-sm text-gray-600">Hersteller</div>
                  <div className="font-medium text-gray-900">{anlage.batterie_hersteller}</div>
                </div>
              )}
              {anlage.batterie_modell && (
                <div>
                  <div className="text-sm text-gray-600">Modell</div>
                  <div className="font-medium text-gray-900">{anlage.batterie_modell}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Wechselrichter */}
        {anlage.wechselrichter_modell && (
          <div className="pt-4 border-t">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Wechselrichter</h3>
            <div>
              <div className="text-sm text-gray-600">Modell</div>
              <div className="font-medium text-gray-900">{anlage.wechselrichter_modell}</div>
            </div>
          </div>
        )}

        {/* Kosten */}
        {anlage.anschaffungskosten_gesamt > 0 && (
          <div className="pt-4 border-t">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Kosten</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600">Anschaffungskosten Gesamt</div>
                <div className="font-medium text-gray-900">{fmt(anlage.anschaffungskosten_gesamt)} €</div>
              </div>
              {anlage.anschaffungskosten_speicher > 0 && (
                <div>
                  <div className="text-sm text-gray-600">davon Speicher</div>
                  <div className="font-medium text-gray-900">{fmt(anlage.anschaffungskosten_speicher)} €</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Standort Details */}
        {(anlage.standort_strasse || anlage.standort_latitude) && (
          <div className="pt-4 border-t">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Standort Details</h3>
            <div className="grid grid-cols-2 gap-4">
              {anlage.standort_strasse && (
                <div>
                  <div className="text-sm text-gray-600">Straße</div>
                  <div className="font-medium text-gray-900">{anlage.standort_strasse}</div>
                </div>
              )}
              {anlage.standort_latitude && anlage.standort_longitude && (
                <div>
                  <div className="text-sm text-gray-600">Koordinaten</div>
                  <div className="font-medium text-gray-900">
                    {fmt(anlage.standort_latitude)}, {fmt(anlage.standort_longitude)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notizen */}
        {anlage.notizen && (
          <div className="pt-4 border-t">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Notizen</h3>
            <div className="text-gray-900 whitespace-pre-wrap">{anlage.notizen}</div>
          </div>
        )}
      </div>

      {/* Hinweis */}
      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex gap-2">
          <SimpleIcon type="info" className="w-5 h-5 text-yellow-600" />
          <div className="text-sm text-yellow-900">
            <strong>Hinweis:</strong> Diese Daten stammen aus der ursprünglichen Anlagen-Struktur. 
            Zukünftig werden detaillierte Komponenten als separate Investitionen erfasst.
          </div>
        </div>
      </div>
    </div>
  )
}
