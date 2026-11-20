// Fallback: read the rendered hockeydata tables from the DOM when the widget's JSON response
// could not be captured. The tables mark each cell with a class "...-col-<fieldName>" and a
// `value` attribute, so we rebuild rows in (roughly) the same shape as the JSON.
import type { Page } from 'playwright';

async function readIntellitable(page: Page): Promise<Record<string, string>[]> {
  return page.$$eval('table tbody tr', (trs) =>
    trs.map((tr) => {
      const row: Record<string, string> = {};
      if (tr.id) row.__id = tr.id;
      for (const td of Array.from(tr.querySelectorAll('td'))) {
        const m = /-col-([A-Za-z0-9]+)/.exec(td.className);
        if (!m) continue;
        const img = td.querySelector('img');
        if (img) {
          const idm = /team-logos\/(?:\d+\/)?(\d+)\.png/.exec(img.getAttribute('src') ?? '');
          row[m[1]] = idm ? idm[1] : '';
        } else {
          row[m[1]] = (td.getAttribute('value') ?? td.textContent ?? '').trim();
        }
      }
      return row;
    }),
  );
}

const num = (s: string | undefined) => (s && /^-?\d+$/.test(s.replace('+', '')) ? Number(s.replace('+', '')) : null);

export async function parseScheduleDom(page: Page, divisionId: number) {
  const rows = await readIntellitable(page);
  if (!rows.length) return undefined;
  return {
    divisionId,
    __source: 'dom',
    rows: rows
      .filter((r) => r.__id && r.homeTeamLongname)
      .map((r) => {
        const date = r.scheduledDate ?? '';
        const tbdDate = !/^\d{2}\.\d{2}\.\d{4}$/.test(date);
        const tbdTime = !/^\d{1,2}:\d{2}$/.test(r.scheduledTime ?? '');
        const hs = num(r.homeTeamScore);
        const as = num(r.awayTeamScore);
        const [d, m, y] = date.split('.');
        return {
          id: r.__id,
          divisionId,
          scheduledDate: tbdDate ? null : { value: date },
          scheduledGameStart: tbdDate ? null : `${y}-${m}-${d}T${tbdTime ? '00:00' : r.scheduledTime}:00`,
          scheduledTime: tbdTime ? null : r.scheduledTime,
          dateIsToBeDetermined: tbdDate,
          timeIsToBeDetermined: tbdTime,
          location: r.locationLongname ? { longname: r.locationLongname } : null,
          homeTeamId: num(r.homeTeamLogo),
          homeTeamLongName: r.homeTeamLongname,
          homeTeamShortName: '',
          awayTeamId: num(r.awayTeamLogo),
          awayTeamLongName: r.awayTeamLongname,
          awayTeamShortName: '',
          homeTeamScore: hs,
          awayTeamScore: as,
          // DOM doesn't tell us reliably whether a game is final; a score present means played.
          labels: hs != null && as != null ? ['FINISHED'] : [],
          gameStatus: hs != null && as != null ? 4 : 0,
          periodResults1: '',
          periodResults2: '',
          periodResults3: '',
        };
      }),
  };
}

export async function parseStandingsDom(page: Page, divisionId: number) {
  const rows = await readIntellitable(page);
  if (!rows.length) return undefined;
  return {
    divisionId,
    __source: 'dom',
    isUnOfficial: false,
    rows: rows
      .filter((r) => r.teamLongname)
      .map((r) => ({
        id: num(r.teamLogo ?? r.teamLogoUrl),
        tableRank: num(r.tableRank),
        teamLongname: r.teamLongname,
        teamShortname: r.teamShortname ?? '',
        gamesPlayed: num(r.gamesPlayed) ?? 0,
        gamesWon: num(r.gamesWon) ?? 0,
        gamesWonInOt: num(r.gamesWonInOt) ?? 0,
        gamesTied: num(r.gamesTied) ?? 0,
        gamesLostInOt: num(r.gamesLostInOt) ?? 0,
        gamesLost: num(r.gamesLost) ?? 0,
        goalsFor: num(r.goalsFor) ?? 0,
        goalsAgainst: num(r.goalsAgainst) ?? 0,
        points: num(r.points) ?? 0,
      })),
  };
}
