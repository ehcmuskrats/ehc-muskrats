// Our team, and how the league data refers to it.
// The team brands itself "EHC Muskrats"; the league spells it "EHC Muscrats".
// Matching is done by team ID / short code, never by spelling.

export const TEAM = {
  displayName: 'EHC Muskrats',
  shortDisplayName: 'Muskrats',
  /** hockeydata team id */
  leagueTeamId: 35325,
  /** Short codes the league uses for us. */
  leagueShortCodes: ['MUS'],
  /** Long names the league uses for us (any spelling). */
  leagueNames: ['EHC Muscrats', 'EHC Muskrats'],
  /** Display text for "our league" in UI. */
  leagueName: 'Wiener Landesliga 4',
  leagueOrg: 'WEHV',
  leagueUrl: 'https://www.wehv.at/de/leagues/wiener-landesliga-4/',
  facebookUrl: 'https://www.facebook.com/ehcmuskrats/',
  youtube: {
    channelName: 'hockeyyy',
    /** Shown as the video credit on the site (the teammate who films the games). */
    creditName: 'Kona',
    /** First name used in the highlights intro ("filmed by Rob"). */
    creditFirstName: 'Rob',
    /** League player id of the video creator, to link the credit to his profile. */
    creditPlayerId: 127960,
    channelUrl: 'https://www.youtube.com/@hoooockeyyy',
    channelId: 'UCojaNKQ53iGc_0SJsc4aXgw',
    /** Uploads playlist = channel id with UC replaced by UU. */
    uploadsPlaylistId: 'UUojaNKQ53iGc_0SJsc4aXgw',
  },
} as const;

export function isOurTeam(t: { id?: number | null; short?: string | null; name?: string | null }): boolean {
  if (t.id != null && t.id === TEAM.leagueTeamId) return true;
  if (t.short && (TEAM.leagueShortCodes as readonly string[]).includes(t.short.toUpperCase())) return true;
  if (t.name && (TEAM.leagueNames as readonly string[]).some((n) => n.toLowerCase() === t.name!.toLowerCase())) return true;
  return false;
}

/** Name to show for any team: our team always gets the brand spelling. */
export function displayTeamName(t: { id?: number | null; short?: string | null; name: string }): string {
  return isOurTeam(t) ? TEAM.displayName : t.name;
}
