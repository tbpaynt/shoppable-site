import NextAuth, { type NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { createClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const config = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          // Check if user exists in Supabase
          const { data: user, error } = await supabase
            .from('users')
            .select('id, email, password_hash, name')
            .eq('email', credentials.email)
            .single()

          if (error || !user) {
            return null
          }

          // Verify password
          const isValidPassword = await bcrypt.compare(
            credentials.password as string,
            user.password_hash
          )

          if (!isValidPassword) {
            return null
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
          }
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      }
    })
  ],
  callbacks: {
    async signIn({ user }) {
      const adminEmail = process.env.ADMIN_EMAIL;
      if (user.email?.toLowerCase() === adminEmail?.toLowerCase()) {
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