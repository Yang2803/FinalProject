import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
    
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const res = await fetch("http://localhost:5000/api/auth/login", {
            method: 'POST',
            body: JSON.stringify(credentials),
            headers: { "Content-Type": "application/json" }
          });

          const user = await res.json();

          if (res.ok && user) {
            return user;
          }
          return null;
        } catch (error) {
          console.error("Lỗi kết nối đến Backend:", error);
          return null;
        }
      }
    })
  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        try {
          const res = await fetch("http://localhost:5000/api/auth/oauth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: user.email || `google_${user.id}@smartanime.local`,
              name: user.name,
              image: user.image, // 🌟 ĐỔI 'avatar' THÀNH 'image' ĐỂ KHỚP VỚI PRISMA
              provider: account.provider,
            }),
          });

          const dbUser = await res.json();

          if (res.ok && dbUser) {
            user.id = dbUser.id;
            user.role = dbUser.role;
            if (dbUser.image) user.image = dbUser.image; // Đồng bộ ảnh từ DB lên lại session
            return true;
          }
          return false;
        } catch (error) {
          console.error("Lỗi đồng bộ OAuth với Backend", error);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        if (user.image) token.picture = user.image; // Nhét ảnh vào token
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        if (token.picture) session.user.image = token.picture as string; // Xuất ảnh ra session
      }
      return session;
    }
  },
  pages: {
    signIn: '/login',
  },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };