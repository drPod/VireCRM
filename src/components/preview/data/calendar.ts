export type EventType = "demo" | "discovery" | "internal" | "personal" | "follow-up";

export interface CalEvent {
  id: string;
  title: string;
  type: EventType;
  day: number;
  month: number;
  year: number;
  startHour: number;
  endHour: number;
  attendee?: string;
}

export const CAL_YEAR = 2026;
export const CAL_MONTH = 4;

export const CAL_EVENTS: CalEvent[] = [
  { id: "ev-1", title: "Demo · Marcus Webb", type: "demo", day: 4, month: CAL_MONTH, year: CAL_YEAR, startHour: 10, endHour: 11, attendee: "Northwind Energy" },
  { id: "ev-2", title: "Discovery · Luis Romero", type: "discovery", day: 5, month: CAL_MONTH, year: CAL_YEAR, startHour: 14, endHour: 14.5, attendee: "Solar Arizona Co." },
  { id: "ev-3", title: "Internal · Pipeline review", type: "internal", day: 5, month: CAL_MONTH, year: CAL_YEAR, startHour: 16, endHour: 17 },
  { id: "ev-4", title: "Demo · Anna Müller", type: "demo", day: 6, month: CAL_MONTH, year: CAL_YEAR, startHour: 9, endHour: 10, attendee: "Hessen Realty" },
  { id: "ev-5", title: "Follow-up · Yuki Tanaka", type: "follow-up", day: 7, month: CAL_MONTH, year: CAL_YEAR, startHour: 11, endHour: 11.5, attendee: "Kobe Energy" },
  { id: "ev-6", title: "Demo · Felix Andersson", type: "demo", day: 7, month: CAL_MONTH, year: CAL_YEAR, startHour: 15, endHour: 16, attendee: "Malmö Energy" },
  { id: "ev-7", title: "Discovery · Daniel Singh", type: "discovery", day: 8, month: CAL_MONTH, year: CAL_YEAR, startHour: 10, endHour: 10.5, attendee: "Singh Insure UK" },
  { id: "ev-8", title: "Personal · Lunch w/ Sarah", type: "personal", day: 11, month: CAL_MONTH, year: CAL_YEAR, startHour: 12, endHour: 13 },
  { id: "ev-9", title: "Demo · Mateo Rossi", type: "demo", day: 12, month: CAL_MONTH, year: CAL_YEAR, startHour: 9, endHour: 10, attendee: "Rossi Insurance Group" },
  { id: "ev-10", title: "Follow-up · Henrik Berg", type: "follow-up", day: 13, month: CAL_MONTH, year: CAL_YEAR, startHour: 14, endHour: 14.5, attendee: "Berg Solar" },
  { id: "ev-11", title: "Discovery · Adam Kowalski", type: "discovery", day: 14, month: CAL_MONTH, year: CAL_YEAR, startHour: 11, endHour: 11.5, attendee: "Kowalski Tech" },
  { id: "ev-12", title: "Internal · QBR prep", type: "internal", day: 14, month: CAL_MONTH, year: CAL_YEAR, startHour: 15, endHour: 16 },
  { id: "ev-13", title: "Demo · Noah Becker", type: "demo", day: 18, month: CAL_MONTH, year: CAL_YEAR, startHour: 10, endHour: 11, attendee: "Becker Properties" },
  { id: "ev-14", title: "Discovery · Sofia Hernandez", type: "discovery", day: 19, month: CAL_MONTH, year: CAL_YEAR, startHour: 13, endHour: 13.5, attendee: "Solar Valencia" },
];
