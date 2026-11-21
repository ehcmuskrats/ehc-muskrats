// Things you will want to edit by hand. See README.md.

export const SITE = {
  /** "Join us" page: season and fee. Update each year. */
  membership: {
    season: '2026/27',
    feeEur: 700,
  },
  /**
   * Impressum / Offenlegung (§ 25 MedienG): the person responsible for the site.
   * REQUIRED before going live: name and town/city (no street address needed for a private site).
   */
  impressum: {
    name: 'Christopher Bright',
    city: 'Wien',
  },
  /**
   * "Über uns / About us" page: the club's story in your own words. One paragraph per array entry.
   * Empty = the page shows a short intro built from league data only.
   */
  about: {
    de: [] as string[],
    en: [] as string[],
  },
  /** Leave empty to hide every email reference. When set, it is shown next to the Facebook button. */
  contactEmail: '',
  homeRink: 'neuro.io arena',
  homeRinkAddress: 'Attemsgasse 1, 1220 Wien',
  /** Credits shown on pages with league data / videos. */
  dataCredit: { label: 'Daten: WEHV', url: 'https://www.wehv.at/' },
  /** The season the site treats as "current". Auto-detected from data if null. */
  currentSeasonOverride: null as string | null,
  timeZone: 'Europe/Vienna',
} as const;
