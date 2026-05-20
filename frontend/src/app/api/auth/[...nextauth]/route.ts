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
          // Gọi sang API Express Backend để kiểm tra
          const res = await fetch("http://localhost:5000/api/auth/login", {
            method: 'POST',
            body: JSON.stringify(credentials),
            headers: { "Content-Type": "application/json" }
          });

          const user = await res.json();

          // Nếu Backend trả về 200 OK và có user, cho phép đăng nhập
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
    // Hàm này chạy ngay khi user đăng nhập thành công bằng bất kỳ hình thức nào
    async signIn({ user, account, profile }) {
      // Nếu đăng nhập bằng Google hoặc Facebook
      if (account?.provider === "google") {
        try {
          // Bắn data sang Express Backend để kiểm tra/lưu vào DB
          const res = await fetch("http://localhost:5000/api/auth/oauth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              // Sử dụng fallback: Nếu không có email thì lấy ID ghép thành email ảo
              email: user.email || `fb_${user.id}@smartanime.local`,
              name: user.name,
              avatar: user.image,
              provider: account.provider,
            }),
          });

          const dbUser = await res.json();

          if (res.ok && dbUser) {
            // Gán id và role từ DB vào object user của NextAuth để JWT dùng ở bước sau
            user.id = dbUser.id;
            user.role = dbUser.role; // Đã bỏ 'as any'
            return true; // Cho phép đăng nhập
          }
          return false; // Chặn nếu Backend lỗi
        } catch (error) {
          console.error("Lỗi đồng bộ OAuth với Backend", error);
          return false;
        }
      }
      return true; // Vẫn cho phép đi tiếp nếu dùng Credentials (đăng nhập thường)
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role; // Đã bỏ 'as any'
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
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