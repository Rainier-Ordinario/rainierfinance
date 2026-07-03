"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  sendChatMessage,
  useChatHistory,
  useInvalidateChatHistory,
} from "@/lib/hooks/useChat";
import { cn } from "@/lib/utils";
import type { ChatRole } from "@/types";

interface LocalMessage {
  id: string;
  role: ChatRole;
  content: string;
}

const SUGGESTIONS = [
  "How much did I spend on dining last month?",
  "Which subscriptions should I consider cancelling?",
  "How is my credit card utilization?",
  "Summarize my net worth trend.",
];

export default function ChatPage() {
  const history = useChatHistory();
  const invalidateHistory = useInvalidateChatHistory();

  const [pending, setPending] = useState<LocalMessage[]>([]);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const messages: LocalMessage[] = [
    ...(history.data ?? []).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
    })),
    ...pending,
  ];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, streaming]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setInput("");
    setSending(true);
    setPending((p) => [
      ...p,
      { id: `local-${Date.now()}`, role: "user", content: trimmed },
    ]);
    setStreaming("");
    try {
      await sendChatMessage(trimmed, setStreaming);
      await invalidateHistory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending([]);
      setStreaming(null);
      setSending(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  return (
    <div className="flex h-[calc(100svh-8rem)] flex-col">
      <PageHeader
        title="AI Advisor"
        description="Ask questions about your spending, budgets, and portfolio"
      />

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto rounded-xl border bg-card/50 p-4"
      >
        {history.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-2/3" />
            <Skeleton className="ml-auto h-10 w-1/2" />
            <Skeleton className="h-16 w-2/3" />
          </div>
        ) : messages.length === 0 && streaming === null ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
              <MessageCircle className="size-6 text-primary" aria-hidden />
            </div>
            <div>
              <p className="font-medium">Ask your financial advisor</p>
              <p className="mt-1 text-sm text-muted-foreground">
                The advisor can see your transactions, budgets, cards, and
                investments.
              </p>
            </div>
            <div className="flex max-w-lg flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m) => (
              <Bubble key={m.id} role={m.role} content={m.content} />
            ))}
            {streaming !== null && (
              <Bubble
                role="assistant"
                content={streaming || "…"}
                streaming
              />
            )}
          </>
        )}
      </div>

      <form onSubmit={onSubmit} className="mt-3 flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Ask about your finances…"
          rows={1}
          className="min-h-10 flex-1 resize-none"
          aria-label="Message"
        />
        <Button type="submit" disabled={sending || !input.trim()} size="icon">
          <Send className="size-4" aria-hidden />
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </div>
  );
}

function Bubble({
  role,
  content,
  streaming = false,
}: {
  role: ChatRole;
  content: string;
  streaming?: boolean;
}) {
  const isUser = role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm",
          isUser
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-muted text-foreground",
          streaming && content === "…" && "animate-pulse"
        )}
      >
        {content}
      </div>
    </div>
  );
}
