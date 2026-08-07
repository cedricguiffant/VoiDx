import type { Metadata } from "next";
import "./globals.css";
import { SolanaProvider } from "@/components/providers/SolanaProvider";
import { AuthGate } from "@/components/providers/AuthGate";
import { RealtimeNotifications } from "@/components/providers/RealtimeNotifications";
import { Navbar } from "@/components/layout/Navbar";

export const metadata: Metadata = {
  title: "VoiDx — Meet & earn",
  description:
    "Connect lonely people through matching and chat, and earn tokens by talking.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        <SolanaProvider>
          <AuthGate>
            <Navbar />
            <main className="container py-6">{children}</main>
            <RealtimeNotifications />
          </AuthGate>
        </SolanaProvider>
      </body>
    </html>
  );
}
