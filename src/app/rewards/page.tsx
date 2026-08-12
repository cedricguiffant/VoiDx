"use client";

import { useEffect, useState } from "react";
import { Coins, Sparkles, Repeat, Lock, Loader2, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/useAuthStore";
import { isClaimEnabled, claimTokens, explorerTxUrl } from "@/lib/solana";
import type { RewardLog } from "@/types/database";

const REASON_META: Record<string, { label: string; icon: typeof Sparkles }> = {
  new_connection: { label: "New person", icon: Sparkles },
  regular_conversation: { label: "Regular conversation", icon: Repeat },
};

export default function RewardsPage() {
  const me = useAuthStore((s) => s.profile);
  const token = useAuthStore((s) => s.token);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const [logs, setLogs] = useState<RewardLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [txSig, setTxSig] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    (async () => {
      setLoading(true);
      await refreshProfile();
      const supabase = getSupabaseBrowser();
      const { data } = await supabase
        .from("reward_logs")
        .select("*")
        .eq("user_id", me.id)
        .order("created_at", { ascending: false })
        .limit(100);
      setLogs((data as RewardLog[]) ?? []);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  const claimReady = isClaimEnabled();
  const balance = me?.token_balance ?? 0;

  async function handleClaim() {
    if (!token || balance <= 0 || claiming) return;
    setClaiming(true);
    setClaimError(null);
    setTxSig(null);
    try {
      const { signature } = await claimTokens(token);
      setTxSig(signature);
      await refreshProfile(); // le solde retombe à 0
    } catch (e) {
      setClaimError(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Solde */}
      <Card className="overflow-hidden">
        <CardContent className="flex items-center justify-between gap-4 p-6">
          <div>
            <p className="text-sm text-muted-foreground">VOID balance (virtual)</p>
            <p className="flex items-center gap-2 text-4xl font-bold">
              <Coins className="h-8 w-8 text-primary" />
              {me?.token_balance ?? 0}
            </p>
          </div>
          <div className="flex flex-col items-end text-right">
            <Button
              onClick={handleClaim}
              disabled={!claimReady || balance <= 0 || claiming}
              title={
                !claimReady
                  ? "Coming soon"
                  : balance <= 0
                    ? "Nothing to claim"
                    : ""
              }
            >
              {claiming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Claiming…
                </>
              ) : (
                <>
                  {!claimReady && <Lock className="h-4 w-4" />}
                  {claimReady ? "Claim on-chain" : "Claim soon"}
                </>
              )}
            </Button>
            {txSig ? (
              <a
                href={explorerTxUrl(txSig)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-500 hover:underline"
              >
                Claim sent — view transaction <ExternalLink className="h-3 w-3" />
              </a>
            ) : claimError ? (
              <p className="mt-1.5 max-w-[12rem] text-[11px] text-destructive">{claimError}</p>
            ) : (
              <p className="mt-1.5 max-w-[12rem] text-[11px] text-muted-foreground">
                Convert your VOID into a real SPL token on Solana.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Historique */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No rewards yet. Chat to earn VOID!
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {logs.map((log) => {
                const meta = REASON_META[log.reason] ?? {
                  label: log.reason,
                  icon: Coins,
                };
                const Icon = meta.icon;
                return (
                  <li key={log.id} className="flex items-center gap-3 py-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent">
                      <Icon className="h-4 w-4 text-accent-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{meta.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="success">+{log.amount}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
