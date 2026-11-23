/**
 * Central registry of active and inactive salespeople.
 * Excludes inactive, test, system, and former sales accounts from all filters and dropdowns.
 */

export const INACTIVE_SALESPERSON_NAMES = new Set([
  "myke",
  "raman",
  "test1",
  "online order",
  "online",
  "mukesh",
  "aryan",
  "abhijay",
  "aditya",
  "charan",
  "danish",
  "jackson",
  "nimit",
  "vibhuti",
  "admin",
  "none",
  "unknown",
  "unassigned",
]);

/**
 * Returns true if the given salesperson name is active.
 */
export function isSalespersonActive(name?: string | null): boolean {
  if (!name) return false;
  const clean = name.trim().toLowerCase();
  return !INACTIVE_SALESPERSON_NAMES.has(clean);
}

/**
 * Filter an array of salesperson objects or strings to only active salespeople.
 */
export function filterActiveSalespersons<T extends string | { name: string }>(
  salespersons: T[]
): T[] {
  return salespersons.filter((sp) => {
    const name = typeof sp === "string" ? sp : sp?.name;
    return isSalespersonActive(name);
  });
}
