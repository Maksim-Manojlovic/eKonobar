import type { Role, VerificationTier } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id: string;
    role: Role;
    verificationTier: VerificationTier;
    rememberMe: boolean;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: Role;
      verificationTier: VerificationTier;
    };
    sessionExpiry: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    verificationTier: VerificationTier;
    sessionExpiry: number;
  }
}
