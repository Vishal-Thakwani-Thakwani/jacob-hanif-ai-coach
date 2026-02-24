import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { CookieOptions } from '@supabase/ssr'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || origin

  if (code) {
    const cookieStore = await cookies()
    const cookiesToForward: { name: string; value: string; options: CookieOptions }[] = []

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
              cookiesToForward.push({ name, value, options })
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
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', data.user.id)
        .single()

      const hasName = profile?.name && profile.name.trim().length > 0
      const redirectPath = hasName ? next : '/onboarding'

      const response = NextResponse.redirect(`${baseUrl}${redirectPath}`)

      cookiesToForward.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options)
      })

      return response
    }
  }

  return NextResponse.redirect(`${baseUrl}/auth/auth-code-error`)
}
