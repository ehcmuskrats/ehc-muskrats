// Venue details for match previews and the Matchday info page. Facts from neuroarena.at ("Anfahrt + Parken",
// checked 21.11.2026). Edit `notes` with anything only the team knows (which entrance, where the hall is).

export interface Venue {
  key: string;
  name: string;
  address: string;
  /** Matches WEHV venue strings like "Wien - neuro.io arena Halle 2". */
  match: RegExp;
  website?: string;
  transit?: { de: string[]; en: string[] };
  parking?: { de: string[]; en: string[] };
  /** Your own tips (entrance, hall, changing rooms). One line per entry. Empty = not shown. */
  notes?: { de: string[]; en: string[] };
}

export const VENUES: Venue[] = [
  {
    key: 'neuro-io-arena',
    name: 'neuro.io arena',
    address: 'Attemsgasse 1, 1220 Wien',
    match: /neuro\.?io arena|albert schultz|eishalle kagran/i,
    website: 'https://neuroarena.at/anfahrt-parken.html',
    transit: {
      de: ['U1 bis Kagran', 'Straßenbahn 25, 26', 'Bus 22A, 26A, 27A, 93A, 94A'],
      en: ['U1 to Kagran', 'Tram 25, 26', 'Bus 22A, 26A, 27A, 93A, 94A'],
    },
    parking: {
      de: [
        'Tiefgarage Mo–Fr 07:30–22:30 (Sommer bis 20:00), € 2,50 pro Stunde',
        'An Heimspieltagen der Vienna Capitals ist die Tiefgarage gesperrt',
        'Auto: A23 bis Ausfahrt Kagran/Donauzentrum, dann Richtung Donauzentrum',
      ],
      en: [
        'Underground garage Mon–Fri 07:30–22:30 (summer until 20:00), € 2.50 per hour',
        'Closed on Vienna Capitals home game days',
        'By car: A23 to exit Kagran/Donauzentrum, then follow signs to Donauzentrum',
      ],
    },
    notes: { de: [], en: [] },
  },
  {
    key: 'wiener-stadthalle',
    name: 'Wiener Stadthalle',
    address: 'Roland-Rainer-Platz 1, 1150 Wien',
    match: /stadthalle/i,
    website: 'https://www.stadthalle.com/',
    transit: {
      de: ['U6 bis Burggasse-Stadthalle', 'U3 bis Schweglerstraße'],
      en: ['U6 to Burggasse-Stadthalle', 'U3 to Schweglerstraße'],
    },
    notes: { de: [], en: [] },
  },
];

export function venueFor(raw: string | null | undefined): Venue | undefined {
  if (!raw) return undefined;
  return VENUES.find((v) => v.match.test(raw));
}

/** "Halle 2" / "Haupthalle" part of a WEHV venue string, if any. */
export function hallOf(raw: string | null | undefined): string | null {
  const m = raw?.match(/(Haupthalle|Halle\s*\d+|Halle\s+[A-Z])\b/i);
  return m ? m[1] : null;
}

/** Google Maps directions link (opens the app on phones). */
export function directionsUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = venueFor(raw);
  const dest = v ? `${v.name}, ${v.address}` : raw.replace(/^Wien - /, '') + ', Wien';
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
}
