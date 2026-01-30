// components/AppLayout.tsx
// Haupt-Layout mit ModernSidebar und Content Area

'use client'

import ModernSidebar from './ModernSidebar'
import Breadcrumb from './Breadcrumb'
import { bg } from '@/lib/styles'

interface AppLayoutProps {
  children: React.ReactNode
  userName?: string
  userEmail?: string
}

export default function AppLayout({ children, userName, userEmail }: AppLayoutProps) {
  return (
    <div className={`flex h-screen ${bg.page}`}>
      {/* Modern Sidebar */}
      <ModernSidebar userName={userName} userEmail={userEmail} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        {/* Content Area */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Breadcrumb */}
            <Breadcrumb />

            {/* Page Content */}
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
