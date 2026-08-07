"use client";

import { ReactNode, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAuthStore } from "@/store/useAuthStore";

/** Routes publiques (pas besoin d'être authentifié). */
const PUBLIC_ROUTES = ["/"];

/**
 * Redirige selon l'état :
 *  - non authentifié sur route privée -> "/"
 *  - authentifié mais profil non complété -> "/onboarding"
 *  - déconnexion du wallet -> purge la session
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { connected } = useWallet();
  const status = useAuthStore((s) => s.status);
  const profile = useAuthStore((s) => s.profile);
  const logout = useAuthStore((s) => s.logout);

  // Le wallet s'est déconnecté : on purge la session applicative.
  useEffect(() => {
    if (!connected && status === "authenticated") {
      logout();
    }
  }, [connected, status, logout]);

  useEffect(() => {
    const isPublic = PUBLIC_ROUTES.includes(pathname);
    if (status !== "authenticated") {
      if (!isPublic) router.replace("/");
      return;
    }
    // Authentifié : forcer l'onboarding tant que le profil n'est pas complété.
    if (profile && !profile.onboarded && pathname !== "/onboarding") {
      router.replace("/onboarding");
    }
  }, [status, profile, pathname, router]);

  return <>{children}</>;
}
