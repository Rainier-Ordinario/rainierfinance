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
  // Finance
  COINBASE: "Crypto",
  WEALTHSIMPLE: "Investments",
};

// Longest keys first so "UBER EATS" wins over "UBER".
const ORDERED_MERCHANTS = Object.keys(MERCHANT_CATEGORIES).sort(
  (a, b) => b.length - a.length
);

export function categorizeMerchant(description: string): string {
  const upper = description.toUpperCase();
  for (const merchant of ORDERED_MERCHANTS) {
    if (upper.includes(merchant)) return MERCHANT_CATEGORIES[merchant];
  }
  return "Other";
}
