const KNOWN_DOMAINS: Record<string, string> = {
  spotify: "spotify.com",
  netflix: "netflix.com",
  adobe: "adobe.com",
  icloud: "icloud.com",
  apple: "apple.com",
  youtube: "youtube.com",
  disney: "disneyplus.com",
  crave: "crave.ca",
  amazon: "amazon.ca",
  prime: "amazon.ca",
  notion: "notion.so",
  github: "github.com",
  chatgpt: "openai.com",
  openai: "openai.com",
  claude: "anthropic.com",
  google: "google.com",
  microsoft: "microsoft.com",
  playstation: "playstation.com",
  xbox: "xbox.com",
  nintendo: "nintendo.com",
  telus: "telus.com",
  rogers: "rogers.com",
  bell: "bell.ca",
  freedom: "freedommobile.ca",
  fido: "fido.ca",
  koodo: "koodomobile.com",
};

/**
 * Best-effort logo for a subscription. Uses Google's favicon service
 * (Clearbit's logo API is sunset). Falls back to null → render initials.
 */
export function logoUrlFor(name: string): string | null {
  const lower = name.toLowerCase();
  const domain = Object.entries(KNOWN_DOMAINS).find(([key]) =>
    lower.includes(key)
  )?.[1];
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

export function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
