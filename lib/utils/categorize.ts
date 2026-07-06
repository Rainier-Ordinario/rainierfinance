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

export function categorizeMerchant(description: string): string {
  const upper = description.toUpperCase();
  for (const merchant of ORDERED_MERCHANTS) {
    if (upper.includes(merchant)) return MERCHANT_CATEGORIES[merchant];
  }
  return "Other";
}
