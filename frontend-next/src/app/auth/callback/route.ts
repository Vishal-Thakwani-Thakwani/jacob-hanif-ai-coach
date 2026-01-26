import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  // Use NEXT_PUBLIC_APP_URL for production, fallback to origin
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || origin

  if (code) {
    const cookieStore = await cookies()
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )
    
    const { error, data } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('Auth error:', error.message)
      return NextResponse.redirect(`${baseUrl}/auth/auth-code-error?error=${encodeURIComponent(error.message)}`)
    }
    
    if (data.user) {
      // Check if user has completed onboarding (has name)
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', data.user.id)
        .single()
      
      // Redirect to onboarding if no name set
      const hasName = profile?.name && profile.name.trim().length > 0
      const redirectPath = hasName ? next : '/onboarding'
      
      return NextResponse.redirect(`${baseUrl}${redirectPath}`)
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${baseUrl}/auth/auth-code-error`)
}
