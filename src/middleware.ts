import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { token } = req.nextauth;
    const { pathname } = req.nextUrl;

    // Admin routes — only ADMIN role
    if (pathname.startsWith("/admin") && token?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // Venue dashboard — only VENUE_OWNER
    if (pathname.startsWith("/venue") && token?.role !== "VENUE_OWNER" && token?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // Headhunter dashboard — only HEADHUNTER
    if (pathname.startsWith("/headhunter") && token?.role !== "HEADHUNTER" && token?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/waiter/:path*",
    "/venue/:path*",
    "/headhunter/:path*",
    "/admin/:path*",
  ],
};
