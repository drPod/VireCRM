// Mils = thousandths of a dollar per kWh. Agent commission unit.
// 1 mil = $0.001/kWh. xlsx label "Unit Uplift".
//
// Pure math: number-in, number-out. Callers parse numeric strings from
// postgres-js (which returns `numeric` as string) before calling.

export function milsToUsdPerKwh(mils: number): number {
  return mils / 1000;
}

export function usdPerKwhToMils(usd: number): number {
  return usd * 1000;
}

export function formatMils(mils: number): string {
  return `${mils} mil${mils === 1 ? "" : "s"}`;
}
