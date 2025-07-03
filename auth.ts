import NextAuth, { type NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"

export const config = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const adminEmail = process.env.ADMIN_EMAIL;
      if (user.email === adminEmail) {
        (user as any).role = "admin"
      }
      return true
    },
    jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
      }
      return token
    },
    session({ session, token }) {
      (session.user as any).role = token.role
      return session
    },
    // Required in NextAuth v5 – decide if the request is authorised.
    // Here we allow every authenticated request.
    authorized({ auth }) {
      // If you need to restrict, check auth?.user etc.
      return !!auth
    },
  },
} satisfies NextAuthConfig

export const { handlers, auth, signIn, signOut } = NextAuth(config) 