import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';

import { userRepository } from '@/features/auth/repository/user.repository';
import { upsertOAuthUserService } from '@/features/auth/service/auth.service';
import { UserRole } from '@/shared/types/roles';
import { hashPassword } from '@/shared/utils/password';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await userRepository.findByEmail(credentials.email as string);
        if (!user) return null;
        /*
          A deactivated account is refused here and again on every token refresh below. Both are
          needed: this stops a new sign-in, the refresh kills a session that was already open —
          otherwise deactivating someone would take until their JWT expired to mean anything.

          Refused the same way a wrong password is, with no distinguishing message: telling an
          unauthenticated caller that an address exists but is disabled is an account oracle.
        */
        if (user.isActive === false) return null;

        const passwordHash = hashPassword(credentials.password as string);
        if (user.passwordHash !== passwordHash) return null;

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role as UserRole,
          avatar: user.avatar,
          clinicId: user.clinicId?.toString() ?? null,
        };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ user, account }) {
      // Applies to both providers: an account switched off must not get in through either door.
      if (user.email) {
        const existing = await userRepository.findByEmail(user.email);
        if (existing?.isActive === false) return false;
      }

      if (account?.provider !== 'google' || !user.email || !user.name) {
        return true;
      }

      await upsertOAuthUserService({
        email: user.email,
        name: user.name,
        avatar: user.image ?? null,
      });

      return true;
    },

    async jwt({ token, user }) {
      const authUser = user as
        | ({ role?: UserRole; avatar?: string | null; clinicId?: string | null } & typeof user)
        | undefined;

      if (user) {
        token.id = authUser?.id ?? token.sub ?? '';
        token.email = user.email;
        token.name = user.name;
        token.avatar = authUser?.avatar ?? (token.avatar as string | null | undefined);
        token.clinicId = authUser?.clinicId ?? (token.clinicId as string | null | undefined) ?? null;
      }

      if (token.email) {
        const dbUser = await userRepository.findByEmail(token.email as string);
        if (dbUser?.isActive === false) {
          /*
            Dropped to the lowest privileges rather than left as they were. The token cannot be
            revoked from here — NextAuth has no such hook on a JWT strategy — so the next best
            thing is a token that opens nothing: `user` fails the admin guard and a null clinic
            fails the tenancy guard.
          */
          token.role = 'user';
          token.clinicId = null;
        } else if (dbUser) {
          token.id = dbUser._id.toString();
          token.name = dbUser.name;
          token.avatar = dbUser.avatar ?? (token.avatar as string | null | undefined);
          token.role = (dbUser.role as UserRole) ?? 'user';
          // Tenancy key, refreshed on every token refresh alongside role (PRD 02 §A).
          token.clinicId = dbUser.clinicId?.toString() ?? null;
        } else {
          token.role = 'user';
          token.clinicId = null;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token) {
        const user = session.user as typeof session.user & {
          id: string;
          role: UserRole;
          avatar?: string | null;
          clinicId?: string | null;
        };
        user.id = token.id as string;
        user.email = token.email as string;
        user.name = token.name as string;
        user.avatar = (token.avatar as string | null | undefined) ?? null;
        user.role = (token.role as UserRole | undefined) ?? 'user';
        user.clinicId = (token.clinicId as string | null | undefined) ?? null;
      }
      return session;
    },
  },
  pages: {
    signIn: '/sign-in',
  },
});
