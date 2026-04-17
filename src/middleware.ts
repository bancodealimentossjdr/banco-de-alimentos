import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn = !!req.auth

  // Rotas públicas (não precisam de login)
  const publicRoutes = ['/login']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  // API de auth é pública
  const isAuthApi = pathname.startsWith('/api/auth')

  // Arquivos estáticos e assets
  const isStaticFile = pathname.startsWith('/_next') || 
                       pathname.startsWith('/favicon') ||
                       pathname.includes('.')

  if (isStaticFile || isAuthApi) {
    return NextResponse.next()
  }

  // Se não está logado e não é rota pública, redireciona para login
  if (!isLoggedIn && !isPublicRoute) {
    const loginUrl = new URL('/login', req.nextUrl.origin)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Se está logado e tenta acessar login, redireciona para home
  if (isLoggedIn && isPublicRoute) {
    return NextResponse.redirect(new URL('/', req.nextUrl.origin))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
