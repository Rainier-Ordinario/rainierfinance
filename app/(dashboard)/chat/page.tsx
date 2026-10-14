"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertCircle, MessageCircle, RotateCcw, Send } from "lucide-react";
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
  // The failed message stays in the thread with an inline error + retry.
  const [failed, setFailed] = useState<{ text: string; error: string } | null>(
    null
  );

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
  }, [messages.length, streaming, failed]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setInput("");
    setSending(true);
    setFailed(null);
    // Only the in-flight message lives here; persisted ones come from history.
    setPending([{ id: `local-${Date.now()}`, role: "user", content: trimmed }]);
    setStreaming("");
    try {
      await sendChatMessage(trimmed, setStreaming);
      await invalidateHistory();
      setPending([]);
    } catch (err) {
      // Keep the user's bubble on screen; show what went wrong next to it.
      setFailed({
        text: trimmed,
        error:
          err instanceof Error ? err.message : "Something went wrong. Try again.",
      });
    } finally {
      setStreaming(null);
      setSending(false);
    }
  }

  function retry() {
    if (!failed) return;
    const text = failed.text;
    setFailed(null);
    void send(text);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  return (
    <div className="flex h-[calc(100svh-9rem)] flex-col">
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
            {failed && (
              <div className="flex justify-start">
                <div className="max-w-[85%] space-y-2 rounded-2xl rounded-bl-sm border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm">
                  <p className="flex items-start gap-2">
                    <AlertCircle
                      className="mt-0.5 size-4 shrink-0 text-destructive"
                      aria-hidden
                    />
                    <span>{failed.error}</span>
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={retry}
                  >
                    <RotateCcw className="size-3.5" aria-hidden />
                    Retry
                  </Button>
                </div>
              </div>
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
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
          isUser
            ? "whitespace-pre-wrap rounded-br-sm bg-primary text-primary-foreground"
            : // The advisor replies in markdown (lists/tables per its prompt);
              // render it, with styles scoped to the bubble.
              "overflow-x-auto rounded-bl-sm bg-muted text-foreground [&>*+*]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li+li]:mt-1 [&_strong]:font-semibold [&_code]:rounded [&_code]:bg-background/60 [&_code]:px-1 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_td]:border [&_td]:px-2 [&_td]:py-1",
          streaming && content === "…" && "animate-pulse"
        )}
      >
        {isUser ? (
          content
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        )}
      </div>
    </div>
  );
}
