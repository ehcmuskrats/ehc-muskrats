// Annotate the neuro.io arena site plan: red underlines under the hall names, larger entrance labels with
// red underline, red entrance arrows, and a credit line. Source: neuroarena.at; markings by EHC Muskrats.
// Usage: node scripts/annotate-hall-plan.cjs scripts/assets/neuroarena-hallenplan-original.png public/venues/neuroarena-hallenplan.webp
const sharp = require(require.resolve('sharp', { paths: [process.cwd()] }));
const [src, out] = process.argv.slice(2);
const RED = '#d62828';
const font = "font-family='Arial, Helvetica, sans-serif' font-weight='700'";

const underline = (x1, x2, y) => `<line x1='${x1}' y1='${y}' x2='${x2}' y2='${y}' stroke='${RED}' stroke-width='5' stroke-linecap='round'/>`;
// Arrow from (x1,y1) to (x2,y2) with a head at the end.
const arrow = (x1, y1, x2, y2) => {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const h = 13;
  const p1 = [x2 - h * Math.cos(a - 0.5), y2 - h * Math.sin(a - 0.5)];
  const p2 = [x2 - h * Math.cos(a + 0.5), y2 - h * Math.sin(a + 0.5)];
  return `<line x1='${x1}' y1='${y1}' x2='${x2}' y2='${y2}' stroke='${RED}' stroke-width='6' stroke-linecap='round'/>
    <polygon points='${x2},${y2} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}' fill='${RED}'/>`;
};
const label = (x, y, w, h, lines, size) => `
  <rect x='${x}' y='${y}' width='${w}' height='${h}' rx='6' fill='white' stroke='${RED}' stroke-width='2'/>
  ${lines.map((t, i) => `<text x='${x + w / 2}' y='${y + 4 + size * (i + 1) + i * 3}' text-anchor='middle' font-size='${size}' ${font} fill='#111'>${t}</text>`).join('')}`;

const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='630' height='832'>
  ${underline(128, 204, 151)}
  ${underline(123, 199, 436)}
  ${underline(353, 430, 506)}

  <!-- Entrance Halle 2 & 3 (west side, by the Overtime bar) -->
  <rect x='0' y='280' width='102' height='22' fill='white'/>
  ${arrow(96, 292, 121, 264)}
  ${label(2, 292, 100, 46, ['Eingang', 'Halle 2 &amp; 3'], 16)}
  ${underline(10, 94, 344)}

  <!-- Entrance Halle 1 (front) -->
  ${label(330, 566, 160, 30, ['Eingang Halle 1'], 17)}
  ${underline(340, 480, 601)}
  ${arrow(405, 566, 405, 538)}

  <!-- Credit -->
  <rect x='0' y='808' width='360' height='24' fill='white' opacity='0.92'/>
  <text x='6' y='825' font-size='12' ${font} fill='#333'>Plan: neuro.io arena · Markierungen: EHC Muskrats</text>
</svg>`;

sharp(src)
  .composite([{ input: Buffer.from(svg) }])
  .webp({ quality: 85 })
  .toFile(out)
  .then((i) => console.log('ok', i.width, i.height, i.size));
