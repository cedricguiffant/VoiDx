"use client";

import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function MessageInput({
  onSend,
}: {
  onSend: (content: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const content = value.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      await onSend(content);
      setValue("");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 border-t border-border p-3">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Write a message…"
        maxLength={2000}
        autoComplete="off"
      />
      <Button type="submit" size="icon" disabled={sending || !value.trim()}>
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </form>
  );
}
