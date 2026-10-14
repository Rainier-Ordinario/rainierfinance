"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_PYTHON_API_URL ?? "http://localhost:8000";

export function useChatHistory() {
  return useQuery({
    queryKey: ["chat_messages"],
    queryFn: async (): Promise<ChatMessage[]> => {
      const supabase = createClient();
      // Newest 100, then flipped oldest-first for display — the thread stays
      // bounded no matter how long the history grows.
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return ((data ?? []) as ChatMessage[]).reverse();
    },
  });
}

export function useInvalidateChatHistory() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["chat_messages"] });
}

/**
 * Send a message to the advisor API and stream the reply.
 * Calls onChunk with the accumulated assistant text as it streams in.
 * The API persists both messages to chat_messages.
 */
export async function sendChatMessage(
  message: string,
  onChunk: (accumulated: string) => void
): Promise<string> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");

  let res: Response;
  try {
    res = await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ message }),
    });
  } catch {
    throw new Error(
      "The advisor service isn't running. Start it with: cd api && uvicorn main:app --port 8000"
    );
  }
  if (!res.ok || !res.body) {
    let detail = `Advisor request failed (${res.status})`;
    try {
      const json = await res.json();
      if (json.detail) detail = json.detail;
    } catch {
      // non-JSON error body
    }
    throw new Error(friendlyAdvisorError(detail));
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    accumulated += decoder.decode(value, { stream: true });
    onChunk(stripStreamError(accumulated));
  }
  accumulated += decoder.decode();

  // The API streams 200 and reports mid-stream failures as a trailing text
  // marker — surface those as real errors instead of leaving raw text in
  // the bubble.
  const streamError = accumulated.match(/\n*\[Advisor error: ([\s\S]*)\]\s*$/);
  if (streamError) throw new Error(friendlyAdvisorError(streamError[1]));

  return accumulated;
}

function stripStreamError(text: string): string {
  return text.replace(/\n*\[Advisor error: [\s\S]*$/, "");
}

/** Translate backend/config errors into copy a user can act on. */
function friendlyAdvisorError(detail: string): string {
  if (detail.includes("ANTHROPIC_API_KEY")) {
    return "The advisor isn't configured yet — add an ANTHROPIC_API_KEY to .env.local to enable it.";
  }
  return detail;
}
