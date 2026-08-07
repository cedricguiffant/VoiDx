"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Users, MessageCircle, Coins } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { WalletButton } from "@/components/wallet/WalletButton";
import { useAuthStore } from "@/store/useAuthStore";

export default function LandingPage() {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const profile = useAuthStore((s) => s.profile);

  // Déjà connecté : on redirige vers l'app.
  useEffect(() => {
    if (status === "authenticated" && profile) {
      router.replace(profile.onboarded ? "/discover" : "/onboarding");
    }
  }, [status, profile, router]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-10 py-12 text-center">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Don&apos;t stay alone.{" "}
          <span className="text-primary">Talk, connect, earn.</span>
        </h1>
        <p className="text-lg text-muted-foreground">
          VoiDx connects lonely people. Chat with new people, keep your
          bonds alive, and earn <strong>VOID</strong> tokens with every exchange.
        </p>
      </div>

      <WalletButton />

      <div className="grid w-full gap-4 sm:grid-cols-3">
        {[
          { icon: Users, title: "Meet", text: "Simple matching by interests and language." },
          { icon: MessageCircle, title: "Chat", text: "Real-time chat, no pressure." },
          { icon: Coins, title: "Earn", text: "VOID for every new connection." },
        ].map(({ icon: Icon, title, text }) => (
          <Card key={title}>
            <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
              <Icon className="h-7 w-7 text-primary" />
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground">{text}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Secure sign-in with Phantom — no transaction, no fees.
      </p>
    </div>
  );
}
