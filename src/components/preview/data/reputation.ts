export interface Review {
  id: string;
  source: "Google" | "Yelp" | "Trustpilot" | "G2";
  reviewer: string;
  rating: number;
  title: string;
  body: string;
  date: string;
  responded: boolean;
}

export const REVIEWS: Review[] = [
  { id: "R-601", source: "Google", reviewer: "Marcus W.", rating: 5, title: "Cut our response time in half", body: "The AI lead-scoring is genuinely useful. Our reps know who to chase first every morning. Worth every penny.", date: "May 11", responded: true },
  { id: "R-602", source: "G2", reviewer: "Priya P.", rating: 5, title: "White-label is real white-label", body: "Most CRMs claim white-label but Majix actually delivers. Custom domains, custom theming, the works. Our clients never see Majix.", date: "May 8", responded: true },
  { id: "R-603", source: "Trustpilot", reviewer: "Anna M.", rating: 5, title: "Best CRM I've used in 10 years", body: "From real estate background. Simple, fast, and the AI advisor is the difference. Saved me hours every week.", date: "May 4", responded: true },
  { id: "R-604", source: "Google", reviewer: "Daniel S.", rating: 4, title: "Great but onboarding took a beat", body: "Once we were set up it's been a dream. Setup itself was a bit slower than we expected. 4 stars only because of that.", date: "May 2", responded: false },
  { id: "R-605", source: "Yelp", reviewer: "Hannah G.", rating: 5, title: "Stride Gym switched and never looked back", body: "We left HubSpot for Majix. Every feature we needed plus the SMS automation actually works. Members rebook 2x.", date: "Apr 28", responded: true },
  { id: "R-606", source: "G2", reviewer: "Felix A.", rating: 5, title: "AI Advisor pays for itself", body: "I asked Majix to find me 10 leads ready to buy this week. It did. Closed 3. ROI in week one.", date: "Apr 24", responded: true },
];

export const RATING_BREAKDOWN = [
  { stars: 5, count: 142 },
  { stars: 4, count: 28 },
  { stars: 3, count: 4 },
  { stars: 2, count: 1 },
  { stars: 1, count: 0 },
];
