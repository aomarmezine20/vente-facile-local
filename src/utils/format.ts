export const MAD = new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD", maximumFractionDigits: 2 });

export function fmtMAD(value: number) {
  return MAD.format(value);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
