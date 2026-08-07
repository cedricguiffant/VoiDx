"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getSupabaseBrowser, setAccessToken } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

type Status = "idle" | "authenticating" | "authenticated";

interface AuthState {
  token: string | null;
  profile: Profile | null;
  status: Status;

  setStatus: (s: Status) => void;
  /** Applique une session (JWT + profil) et l'injecte dans le client Supabase. */
  setSession: (token: string, profile: Profile) => Promise<void>;
  /** Recharge le profil depuis Supabase (ex: après édition ou reward). */
  refreshProfile: () => Promise<void>;
  updateProfileLocal: (patch: Partial<Profile>) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      profile: null,
      status: "idle",

      setStatus: (status) => set({ status }),

      setSession: async (token, profile) => {
        setAccessToken(token); // injecte le Bearer sur PostgREST + Realtime
        set({ token, profile, status: "authenticated" });
      },

      refreshProfile: async () => {
        const { profile } = get();
        if (!profile) return;
        const supabase = getSupabaseBrowser();
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", profile.id)
          .single();
        if (data) set({ profile: data as Profile });
      },

      updateProfileLocal: (patch) =>
        set((s) => ({ profile: s.profile ? { ...s.profile, ...patch } : s.profile })),

      logout: async () => {
        setAccessToken(null);
        set({ token: null, profile: null, status: "idle" });
      },
    }),
    {
      name: "voidx-session",
      partialize: (s) => ({ token: s.token, profile: s.profile }),
      // Réinjecte le JWT au rechargement de page.
      onRehydrateStorage: () => (state) => {
        if (state?.token && state.profile) {
          setAccessToken(state.token);
          useAuthStore.setState({ status: "authenticated" });
        }
      },
    }
  )
);
