import { auth } from "./auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(req: NextRequest) {
  const session = await auth();
  const isLoggedIn = !!session;
  const isLoginPage = req.nextUrl.pathname === "/login";
  const isRootPage = req.nextUrl.pathname === "/";
  const isDashboardPage = req.nextUrl.pathname === "/dashboard" || req.nextUrl.pathname.startsWith("/dashboard/");
  const isAuthRoute = req.nextUrl.pathname.startsWith("/api/auth");
  const isProtectedRoute = isRootPage || isDashboardPage;

  if (isAuthRoute) return NextResponse.next();

  if (isLoggedIn && isLoginPage) {
    // Usuário autenticado tentando acessar a página de login, redirecionar para dashboard
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (isLoggedIn && isRootPage) {
    // Usuário autenticado acessando a página inicial, redirecionar para dashboard
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (!isLoggedIn && isProtectedRoute) {
    // Usuário não autenticado tentando acessar páginas protegidas
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};