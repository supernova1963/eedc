// app/api/test-auth/route.ts
// Test Route um Session zu überprüfen

import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  return NextResponse.json({
    authenticated: !!user,
    user: user ? {
      id: user.id,
      email: user.email
    } : null,
    error: error?.message
  })
}
