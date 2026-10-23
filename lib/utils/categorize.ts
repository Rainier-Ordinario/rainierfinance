const MERCHANT_CATEGORIES: Record<string, string> = {
  // Groceries
  WHOLEFDS: "Groceries",
  SAFEWAY: "Groceries",
  SOBEYS: "Groceries",
  LOBLAWS: "Groceries",
  METRO: "Groceries",
  SUPERSTORE: "Groceries",
  "SAVE-ON-FOODS": "Groceries",
  "T&T": "Groceries",
  // Dining
  MCDONALD: "Dining",
  "TIM HORTON": "Dining",
  STARBUCKS: "Dining",
  "A&W": "Dining",
  SUBWAY: "Dining",
  DOORDASH: "Food Delivery",
  "UBER EATS": "Food Delivery",
  SKIP: "Food Delivery",
  // Transport — note UBER EATS must match before UBER
  TRANSLINK: "Transit",
  COMPASS: "Transit",
  UBER: "Rideshare",
  LYFT: "Rideshare",
  ESSO: "Gas",
  "PETRO-CANADA": "Gas",
  SHELL: "Gas",
  CHEVRON: "Gas",
  // Streaming
  SPOTIFY: "Streaming",
  NETFLIX: "Streaming",
  DISNEY: "Streaming",
  CRAVE: "Streaming",
  "APPLE.COM/BILL": "Subscriptions",
  GOOGLE: "Subscriptions",
  // Shopping
  AMAZON: "Shopping",
  AMZN: "Shopping",
  COSTCO: "Shopping",
  WALMART: "Shopping",
  "WAL-MART": "Shopping",
  "SPORT CHEK": "Shopping",
  DOLLARAMA: "Shopping",
  "DOLLAR TREE": "Shopping",
  ALIEXPRESS: "Shopping",
  "VALUE VILLAGE": "Shopping",
  STAPLES: "Shopping",
  SEPHORA: "Shopping",
  ARITZIA: "Shopping",
  "APPLE STORE": "Shopping",
  "HOME DEPOT": "Shopping",
  WINNERS: "Shopping",
  LULULEMON: "Shopping",
  IKEA: "Shopping",
  "BEST BUY": "Shopping",
  "LONDON DRUGS": "Shopping",
  "CANADIAN TIRE": "Shopping",
  TEMU: "Shopping",
  SHEIN: "Shopping",
  ETSY: "Shopping",
  // MARKETPLACE must outrank MARKET so Amazon Marketplace stays Shopping
  MARKETPLACE: "Shopping",
  // Groceries (generic)
  MARKET: "Groceries",
  "FRESH ST": "Groceries",
  "NO FRILLS": "Groceries",
  "G&J FOOD": "Groceries",
  // Dining (generic keywords cover most independent restaurants)
  RESTAUR: "Dining",
  CAFE: "Dining",
  COFFEE: "Dining",
  BAKERY: "Dining",
  PIZZA: "Dining",
  SUSHI: "Dining",
  BURGER: "Dining",
  GRILL: "Dining",
  "HOT POT": "Dining",
  RAMEN: "Dining",
  CHICKEN: "Dining",
  BISTRO: "Dining",
  TACO: "Dining",
  DONUT: "Dining",
  "FRESH TEA": "Dining",
  BOBA: "Dining",
  WENDY: "Dining",
  "TRIPLE O": "Dining",
  "A AND W": "Dining",
  KEG: "Dining",
  "FOOD VENDOR": "Dining",
  NAYAX: "Dining", // vending machines
  // Parking & transit
  PARKING: "Transit",
  IMPARK: "Transit",
  PAYBYPHONE: "Transit",
  SUICA: "Transit",
  // Gas
  "CHV ": "Gas", // RBC's abbreviation for Chevron stations
  // Entertainment
  CINEPLEX: "Entertainment",
  "FAMOUS PLAYER": "Entertainment",
  TICKETMASTER: "Entertainment",
  CYPRESS: "Entertainment",
  "MT SEYMOUR": "Entertainment",
  GROUSE: "Entertainment",
  WHISTLER: "Entertainment",
  PNE: "Entertainment",
  STEAM: "Entertainment",
  PLAYSTATION: "Entertainment",
  NINTENDO: "Entertainment",
  // Health & fitness
  "SHOPPERS DRUG": "Health",
  PHARMASAVE: "Health",
  REXALL: "Health",
  GOODLIFE: "Health",
  "PLANET FITNESS": "Health",
  MARATHON: "Health",
  "CITY BBY": "Health", // Burnaby rec centres
  // Bills & subscriptions
  "ANNUAL FEE": "Bills",
  "BELL CANADA": "Bills",
  ROGERS: "Bills",
  TELUS: "Bills",
  FIDO: "Bills",
  KOODO: "Bills",
  "BC HYDRO": "Bills",
  FORTISBC: "Bills",
  ICBC: "Bills",
  "CLAUDE.AI": "Subscriptions",
  ANTHROPIC: "Subscriptions",
  OPENAI: "Subscriptions",
  CHATGPT: "Subscriptions",
  ICLOUD: "Subscriptions",
  // Finance
  COINBASE: "Crypto",
  WEALTHSIMPLE: "Investments",
};

// Longest keys first so "UBER EATS" wins over "UBER".
const ORDERED_MERCHANTS = Object.keys(MERCHANT_CATEGORIES).sort(
  (a, b) => b.length - a.length
);

/** Learned merchant → category overrides, keyed by merchantKey(). */
export type MerchantRules = Record<string, string>;

/**
 * Stable merchant identity for a bank description: lowercase, store numbers
 * and punctuation stripped, so "STARBUCKS #1234" and "Starbucks 0567" match.
 */
export function merchantKey(description: string): string {
  return description
    .toLowerCase()
    .replace(/[#*]?\d+/g, "")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** A rule the user taught by recategorizing beats the built-in keywords. */
export function categorizeMerchant(
  description: string,
  rules: MerchantRules = {}
): string {
  const key = merchantKey(description);
  if (key && rules[key]) return rules[key];
  const upper = description.toUpperCase();
  for (const merchant of ORDERED_MERCHANTS) {
    if (upper.includes(merchant)) return MERCHANT_CATEGORIES[merchant];
  }
  return "Other";
}

/** Re-categorize parsed expense rows with the user's learned rules. */
export function applyMerchantRules<
  T extends { description: string; category: string; type: string },
>(rows: T[], rules: MerchantRules): T[] {
  return rows.map((r) => {
    if (r.type !== "expense") return r;
    const learned = rules[merchantKey(r.description)];
    return learned ? { ...r, category: learned } : r;
  });
}

/** merchantKey → the category the user's purchases there are in. */
export type KnownMerchants = Map<string, string>;

/** Map each merchant the user has paid to the category of their latest purchase. */
export function knownMerchantsFrom(
  rows: { description: string; category: string; type: string; date?: string }[]
): KnownMerchants {
  const known: KnownMerchants = new Map();
  const sorted = [...rows].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  for (const r of sorted) {
    const key = merchantKey(r.description);
    if (r.type === "expense" && key) known.set(key, r.category);
  }
  return known;
}

/** Where a refund belongs: a learned rule, else the merchant's usual category. */
export function refundCategory(
  description: string,
  knownMerchants: KnownMerchants,
  rules: MerchantRules = {}
): string {
  const key = merchantKey(description);
  return rules[key] ?? knownMerchants.get(key) ?? categorizeMerchant(description);
}

/** Credits that are clearly money back on a purchase. */
const REFUND_RE = /refund|return|reversal|rebate|credit voucher|^offer\b|cash ?back/i;
/** Credits that are clearly income or money moving, never a refund. */
const INCOME_RE =
  /payroll|salary|direct dep|interest|dividend|e-?transfer|transfer|deposit|bonus|tax refund|\bcra\b|gst|hst|ccb|pension/i;

/**
 * Whether a credit (positive amount) is a refund rather than income: it
 * says so ("REFUND", "RETURN", a card "OFFER" credit), or it comes from a
 * merchant the user pays or one the categorizer recognizes as a store.
 * Paycheques, interest, and e-transfers are always income.
 */
export function looksLikeRefund(
  description: string,
  knownMerchants: KnownMerchants,
  rules: MerchantRules = {}
): boolean {
  if (/tax refund|\bcra\b/i.test(description)) return false;
  if (REFUND_RE.test(description)) return true;
  if (INCOME_RE.test(description)) return false;
  const key = merchantKey(description);
  if (key && knownMerchants.has(key)) return true;
  const category = categorizeMerchant(description, rules);
  return category !== "Other" && category !== "Income";
}

/**
 * Turn parsed credits that look like refunds into refunds: positive-amount
 * expenses in the merchant's category, which lower spending there.
 */
export function classifyRefunds<
  T extends { description: string; amount: number; category: string; type: string },
>(rows: T[], knownMerchants: KnownMerchants, rules: MerchantRules = {}): T[] {
  // Merchants paid within the same file count as known, too.
  const known: KnownMerchants = new Map([
    ...knownMerchants,
    ...knownMerchantsFrom(rows),
  ]);
  return rows.map((r) =>
    r.type === "income" && looksLikeRefund(r.description, known, rules)
      ? {
          ...r,
          type: "expense",
          amount: Math.abs(r.amount),
          category: refundCategory(r.description, known, rules),
        }
      : r
  );
}
