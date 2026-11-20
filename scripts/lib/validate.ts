// Cross-checks: recompute standings from game results and player totals from boxscores,
// compare with what the league publishes. Mismatches are printed, never silently fixed.
import { TEAM, isOurTeam } from '../../src/config/team.ts';
import { loadGames, loadSeasons } from './data-access.ts';

export function validateAll(log: (m: string) => void = console.log): string[] {
  const issues: string[] = [];
  const seasons = loadSeasons();
  const games = loadGames();

  log('\n== Validation: standings recomputed from game results ==');
  for (const s of seasons) {
    for (const st of s.standings) {
      const divGames = s.games.filter((g) => g.divisionId === st.divisionId && g.status === 'final' && g.homeScore != null);
      const calc = new Map<number, { gp: number; wins: number; losses: number; gf: number; ga: number }>();
      const row = (id: number) => {
        if (!calc.has(id)) calc.set(id, { gp: 0, wins: 0, losses: 0, gf: 0, ga: 0 });
        return calc.get(id)!;
      };
      for (const g of divGames) {
        const h = row(g.home.id);
        const a = row(g.away.id);
        h.gp++;
        a.gp++;
        h.gf += g.homeScore!;
        h.ga += g.awayScore!;
        a.gf += g.awayScore!;
        a.ga += g.homeScore!;
        if (g.homeScore! > g.awayScore!) {
          h.wins++;
          a.losses++;
        } else if (g.homeScore! < g.awayScore!) {
          a.wins++;
          h.losses++;
        }
      }
      let bad = 0;
      for (const r of st.rows) {
        const c = calc.get(r.team.id) ?? { gp: 0, wins: 0, losses: 0, gf: 0, ga: 0 };
        const diffs: string[] = [];
        if (c.gp !== r.gp) diffs.push(`GP ${r.gp} vs ${c.gp}`);
        if (c.gf !== r.gf) diffs.push(`GF ${r.gf} vs ${c.gf}`);
        if (c.ga !== r.ga) diffs.push(`GA ${r.ga} vs ${c.ga}`);
        if (c.wins !== r.w + r.otw) diffs.push(`wins ${r.w + r.otw} vs ${c.wins}`);
        if (c.losses !== r.l + r.otl) diffs.push(`losses ${r.l + r.otl} vs ${c.losses}`);
        if (diffs.length) {
          bad++;
          issues.push(`Standings ${s.info.id} ${st.divisionName}: ${r.team.name} league vs computed: ${diffs.join(', ')}`);
        }
      }
      log(`  ${s.info.id} ${st.divisionName}: ${bad ? `${bad} mismatching row(s)` : 'OK'} (${divGames.length} final games)`);
    }
  }

  log('\n== Validation: our player totals from boxscores vs league top-scorer list ==');
  for (const s of seasons) {
    if (!s.info.muskratsPlays) continue;
    for (const st of s.stats) {
      const ourLeaders = st.skaters.filter((r) => r.teamId === TEAM.leagueTeamId);
      if (!ourLeaders.length) continue;
      const divGames = s.games.filter((g) => g.divisionId === st.divisionId && g.status === 'final' && (isOurTeam(g.home) || isOurTeam(g.away)));
      const withReport = divGames.filter((g) => games.has(g.id));
      if (withReport.length < divGames.length) {
        const msg = `Players ${s.info.id} div ${st.divisionId}: only ${withReport.length}/${divGames.length} game reports available, skipping comparison`;
        issues.push(msg);
        log('  ' + msg);
        continue;
      }
      const box = new Map<number, { gp: number; g: number; a: number; pim: number }>();
      for (const sum of withReport) {
        const g = games.get(sum.id)!;
        const side = isOurTeam(g.home) ? 'home' : 'away';
        for (const sk of g.skaters[side]) {
          const b = box.get(sk.player.id) ?? { gp: 0, g: 0, a: 0, pim: 0 };
          b.gp++;
          b.g += sk.g;
          b.a += sk.a;
          b.pim += sk.pim;
          box.set(sk.player.id, b);
        }
      }
      let bad = 0;
      for (const r of ourLeaders) {
        const b = box.get(r.player.id) ?? { gp: 0, g: 0, a: 0, pim: 0 };
        const diffs: string[] = [];
        if (b.g !== r.g) diffs.push(`G ${r.g} vs ${b.g}`);
        if (b.a !== r.a) diffs.push(`A ${r.a} vs ${b.a}`);
        if (b.pim !== r.pim) diffs.push(`PIM ${r.pim} vs ${b.pim}`);
        if (b.gp !== r.gp) diffs.push(`GP ${r.gp} vs ${b.gp}`);
        if (diffs.length) {
          bad++;
          issues.push(`Player ${s.info.id} div ${st.divisionId} #${r.player.number} ${r.player.last} ${r.player.first} (league vs boxscores): ${diffs.join(', ')}`);
        }
      }
      for (const [id, b] of box) {
        if (!ourLeaders.some((r) => r.player.id === id) && (b.g || b.a)) {
          bad++;
          issues.push(`Player ${s.info.id} div ${st.divisionId} id ${id}: has ${b.g}G ${b.a}A in boxscores but is missing from league list`);
        }
      }
      log(`  ${s.info.id} div ${st.divisionId}: ${bad ? `${bad} mismatch(es)` : 'OK'} (${ourLeaders.length} players, ${withReport.length} games)`);
    }
  }
  if (issues.length) {
    log('\nMismatches:');
    for (const i of issues) log('  - ' + i);
  }
  return issues;
}
