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
  /** Official site/hall plan (linked, not copied). */
  hallPlan?: { page: string; image: string };
  /** How to find each hall. Matched against the hall part of the WEHV venue ("Haupthalle", "Halle 2"). */
  halls?: { key: string; match: RegExp; label: string; de: string; en: string }[];
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
    // From the official hall plan on neuroarena.at ("Anfahrt + Parken").
    hallPlan: {
      page: 'https://neuroarena.at/anfahrt-parken.html',
      image: 'https://neuroarena.at/tl_files/Material/Fotos/Halle/HallenPlanGeneral.jpg',
    },
    halls: [
      {
        key: 'haupthalle',
        match: /haupt|halle\s*1\b/i,
        label: 'Haupthalle',
        de: 'Die große Halle (Halle 1). Eingang „Halle 1“ an der Vorderseite, Richtung Parkplatz und U1.',
        en: 'The big arena (Halle 1). Entrance "Halle 1" at the front, facing the car park and the U1.',
      },
      {
        key: 'halle-2',
        match: /halle\s*2\b/i,
        label: 'Halle 2',
        de: 'Nicht der Haupteingang: links am Gebäude vorbei zum Seiteneingang „Halle 2 & 3“ beim Overtime. Halle 2 liegt rechts.',
        en: 'Not the main entrance: walk round the left side of the building to the side entrance "Halle 2 & 3" by the Overtime bar. Halle 2 is on the right.',
      },
      {
        key: 'halle-3',
        match: /halle\s*3\b/i,
        label: 'Halle 3',
        de: 'Nicht der Haupteingang: links am Gebäude vorbei zum Seiteneingang „Halle 2 & 3“ beim Overtime. Halle 3 liegt links.',
        en: 'Not the main entrance: walk round the left side of the building to the side entrance "Halle 2 & 3" by the Overtime bar. Halle 3 is on the left.',
      },
    ],
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

/** Hall details (label, how to find it, plan) for a WEHV venue string, if we know the hall. */
export function hallInfo(raw: string | null | undefined) {
  const v = venueFor(raw);
  const h = hallOf(raw);
  if (!v?.halls || !h) return null;
  const hall = v.halls.find((x) => x.match.test(h));
  return hall ? { venue: v, hall } : null;
}
