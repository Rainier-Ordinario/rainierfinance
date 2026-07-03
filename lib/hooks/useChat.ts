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
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ChatMessage[];
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

  const res = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ message }),
  });
  if (!res.ok || !res.body) {
    let detail = `Advisor request failed (${res.status})`;
    try {
      const json = await res.json();
      if (json.detail) detail = json.detail;
    } catch {
      // non-JSON error body
    }
    throw new Error(detail);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    accumulated += decoder.decode(value, { stream: true });
    onChunk(accumulated);
  }
  accumulated += decoder.decode();
  return accumulated;
}
