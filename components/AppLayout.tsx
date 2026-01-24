// components/AppLayout.tsx
// Haupt-Layout mit Sidebar und Content Area

'use client'

import { useState } from 'react'
import Sidebar from './Sidebar'
import MobileHeader from './MobileHeader'
import Breadcrumb from './Breadcrumb'

interface AppLayoutProps {
  children: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <MobileHeader onMenuClick={() => setSidebarOpen(true)} />

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto pt-16 lg:pt-0">
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
