export const FOUNDATION_ORGANISATION = {
  name: "Le Feast",
  timezone: "Europe/London",
} as const;

export const FOUNDATION_LOCATIONS = [
  { name: "Blackpool North", shortName: "blackpool" },
  { name: "Bolton", shortName: "bolton" },
  { name: "Poulton-le-Fylde", shortName: "poulton" },
  { name: "Rochdale", shortName: "rochdale" },
] as const;

export const OPERATIONAL_DEFAULTS = {
  security: ["Premises secure?", "Required security checks completed?", "Required security procedures understood and followed?"],
  opening: ["Food fridges operating correctly?", "Drinks fridges operating correctly?", "Food-preparation surfaces clean?", "Handwash soap available?", "Hot water available?", "Disposable hand-drying available?", "Food probe available and sanitised?", "Approved chemicals available?", "Allergen information available?", "Food correctly stored and labelled?", "No evidence of pest activity?", "Staff fit for work?"],
  closing: ["PM temperature checks completed?", "Expired or damaged food removed?", "Open food covered and labelled?", "Chilled food stored safely?", "Food-preparation areas cleaned?", "Equipment and utensils cleaned?", "Waste removed and bins controlled?", "Floors cleaned?", "Chemicals stored correctly?", "Outstanding issues handed over?"],
  wastage: ["Sausages", "Chicken Brioche", "Milk", "Bread"],
  cleaning: ["Food preparation surfaces", "Counters and service area", "Handles and touch points", "Floors", "Bins and waste area"],
  training: ["HOT & WHAT", "Allergen Guide", "Merrychef Training", "Panic Alarm"],
} as const;
