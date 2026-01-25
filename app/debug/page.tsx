// app/debug/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

export default function DebugPage() {
  const [authUser, setAuthUser] = useState<any>(null)
  const [mitglied, setMitglied] = useState<any>(null)
  const [testResult, setTestResult] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient()

      // 1. Check auth user
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      console.log('Auth User:', user, 'Error:', authError)
      setAuthUser(user)

      if (!user) {
        setLoading(false)
        return
      }

      // 2. Check mitglied
      const { data: mitgliedData, error: mitgliedError } = await supabase
        .from('mitglieder')
        .select('*')
        .eq('email', user.email)
        .eq('aktiv', true)
        .single()

      console.log('Mitglied:', mitgliedData, 'Error:', mitgliedError)
      setMitglied(mitgliedData)

      // 3. Test insert permissions
      if (mitgliedData) {
        const testData = {
          mitglied_id: mitgliedData.id,
          anlagenname: 'TEST - Bitte löschen',
          anlagentyp: 'Solar',
          leistung_kwp: 1.0,
          installationsdatum: '2024-01-01',
          aktiv: true,
        }

        console.log('Testing insert with data:', testData)

        const { data: insertedAnlage, error: insertError } = await supabase
          .from('anlagen')
          .insert(testData)
          .select()
          .single()

        console.log('Insert result:', insertedAnlage, 'Error:', insertError)
        setTestResult({ data: insertedAnlage, error: insertError })

        // Clean up test data if successful
        if (insertedAnlage) {
          await supabase
            .from('anlagen')
            .delete()
            .eq('id', insertedAnlage.id)
          console.log('Cleaned up test anlage')
        }
      }

      setLoading(false)
    }

    checkAuth()
  }, [])

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Debug Information</h1>

      <div className="space-y-6">
        {/* Auth User */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">1. Auth User</h2>
          {authUser ? (
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(authUser, null, 2)}
            </pre>
          ) : (
            <p className="text-red-600">Nicht authentifiziert</p>
          )}
        </div>

        {/* Mitglied */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">2. Mitglied Record</h2>
          {mitglied ? (
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(mitglied, null, 2)}
            </pre>
          ) : (
            <p className="text-red-600">Kein Mitglied-Record gefunden</p>
          )}
        </div>

        {/* Insert Test */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">3. Insert Test (Client-Side)</h2>
          {testResult ? (
            <div>
              {testResult.error ? (
                <div>
                  <p className="text-red-600 font-semibold mb-2">❌ Fehler beim Insert:</p>
                  <pre className="bg-red-50 p-4 rounded text-sm overflow-auto">
                    {JSON.stringify(testResult.error, null, 2)}
                  </pre>
                </div>
              ) : (
                <div>
                  <p className="text-green-600 font-semibold mb-2">✅ Insert erfolgreich (wurde wieder gelöscht):</p>
                  <pre className="bg-green-50 p-4 rounded text-sm overflow-auto">
                    {JSON.stringify(testResult.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500">Kein Test durchgeführt (Mitglied fehlt)</p>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
          <h2 className="text-xl font-semibold mb-4 text-blue-900">Nächste Schritte</h2>
          <ol className="list-decimal list-inside space-y-2 text-blue-900">
            <li>Prüfen Sie die Auth User Daten oben</li>
            <li>Prüfen Sie ob ein Mitglied-Record existiert</li>
            <li>Prüfen Sie das Ergebnis des Insert-Tests</li>
            <li>Öffnen Sie die Browser-Konsole (F12) für detaillierte Logs</li>
            <li>Falls der Client-Side Insert funktioniert, liegt das Problem beim Server Action</li>
            <li>Falls der Client-Side Insert fehlschlägt, sind es die RLS Policies in Supabase</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
