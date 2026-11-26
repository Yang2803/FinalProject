import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // If a user attempts to access the admin page but does not have ADMIN privileges.
    if (path.startsWith("/admin") && token?.role !== "ADMIN") {
      // Navigate to the hompage
      return NextResponse.redirect(new URL("/", req.url));
    }
  },
  {
    callbacks: {
      // A token (from a logged-in account) is required to pass this checkpoint.
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/profile",          
    "/history",          
    "/favorites",        
    "/timeline/submit",
    "/admin/:path*" // Protect ALL child routes located in the /admin directory.
  ],
};