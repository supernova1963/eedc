// components/PublicFooter.tsx
// Footer für öffentliche Seiten mit Impressum und Datenschutz Links

import Link from 'next/link'

export default function PublicFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-gray-900 dark:bg-gray-950 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Logo & Beschreibung */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">⚡</span>
              <span className="text-xl font-bold text-white">EEDC</span>
            </div>
            <p className="text-sm text-gray-400">
              Electronic Energy Data Collection - Die Community-Plattform für PV-Anlagenbetreiber.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Community</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/community" className="text-sm hover:text-white transition-colors">
                  Alle Anlagen
                </Link>
              </li>
              <li>
                <Link href="/community/bestenliste" className="text-sm hover:text-white transition-colors">
                  Bestenliste
                </Link>
              </li>
              <li>
                <Link href="/register" className="text-sm hover:text-white transition-colors">
                  Jetzt mitmachen
                </Link>
              </li>
            </ul>
          </div>

          {/* Rechtliches */}
          <div>
            <h3 className="text-white font-semibold mb-4">Rechtliches</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/impressum" className="text-sm hover:text-white transition-colors">
                  Impressum
                </Link>
              </li>
              <li>
                <Link href="/datenschutz" className="text-sm hover:text-white transition-colors">
                  Datenschutz
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-8 border-t border-gray-800 text-center">
          <p className="text-sm text-gray-500">
            © {currentYear} EEDC. Alle Rechte vorbehalten.
          </p>
        </div>
      </div>
    </footer>
  )
}
