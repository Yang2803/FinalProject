import "next-auth";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
  // Add the default ID and role to the User object when retrieving it from the database.
  interface User {
    id: string;
    role: string;
  }

  // Add formatting to the Session object so that Client Components (such as Sidebar, Profile) receive the correct type.
  interface Session {
    user: User & {
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string; // Help validate token.role and token?.role in middleware.
  }
}