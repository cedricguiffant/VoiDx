"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";
import { LogOut, Coins, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/useAuthStore";
import { useSignIn } from "@/lib/auth/useSignIn";
import { truncateAddress } from "@/lib/utils";

// La modale du wallet-adapter dépend du DOM : pas de SSR.
const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false }
);

export function WalletButton() {
  const { connected, publicKey, disconnect } = useWallet();
  const status = useAuthStore((s) => s.status);
  const profile = useAuthStore((s) => s.profile);
  const logout = useAuthStore((s) => s.logout);
  const { signIn } = useSignIn();
  const [error, setError] = useState<string | null>(null);

  // 1) Wallet non connecté -> bouton de connexion Phantom
  if (!connected) {
    return <WalletMultiButton />;
  }

  // 2) Wallet connecté mais session non établie -> signature
  if (status !== "authenticated") {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          onClick={async () => {
            setError(null);
            try {
              await signIn();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Sign-in failed");
            }
          }}
          disabled={status === "authenticating"}
        >
          {status === "authenticating" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Signing…
            </>
          ) : (
            "Connect"
          )}
        </Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    );
  }

  // 3) Authentifié -> adresse tronquée + solde + déconnexion
  return (
    <div className="flex items-center gap-3">
      <Badge variant="secondary" className="gap-1">
        <Coins className="h-3.5 w-3.5" />
        {profile?.token_balance ?? 0} VOID
      </Badge>
      <span className="hidden text-sm text-muted-foreground sm:inline">
        {truncateAddress(publicKey?.toBase58())}
      </span>
      <Button
        variant="ghost"
        size="icon"
        title="Disconnect"
        onClick={async () => {
          await logout();
          await disconnect();
        }}
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}
