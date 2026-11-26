/**
 * Authoring script for the Geografie (grade IV) content. Run: node scripts/geo/build-geo-content.mjs
 * (after scripts/geo/build-romania-map.mjs). Writes:
 *   content/skills/geo/grade4.json
 *   content/items/geo/{map-hotspots,orientation,relief,waters,climate-nature,society,texts}.json
 *   content/explanations/geo/grade4.json
 * The hotspot regions are read from content/data/geo/romania-map.json so they always match the drawing.
 * Everything here is original work (ai-draft, OWN, beta): facts + our own wording, no textbook text.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MAP = JSON.parse(readFileSync(join(ROOT, 'content/data/geo/romania-map.json'), 'utf8'));
const TARGET = Object.fromEntries(MAP.targets.map((t) => [t.id, t]));
const [VW, VH] = MAP.image.viewBox;

/* ---------- helpers ---------- */
const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rngFor = (s) => { let a = hash(s); return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const shuffle = (arr, seed) => { const r = rngFor(seed), o = [...arr]; for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; };
const L = (s) => { const [ro, en] = s.split(' || '); return en ? { ro, en } : { ro }; };
const prov = (id, kind, notes) => ({ id: `prov.${id}`, kind, title: `${kind === 'item' ? 'Item' : kind === 'explanation' ? 'Explanation' : 'Skill'} ${id}`, author: 'Ludiko', source: kind === 'data' ? 'own' : 'ai-draft', licence: 'OWN', notes });
const SKILL = {}; // short -> skill id
const counters = {};
const nextId = (skillId) => { counters[skillId] = (counters[skillId] ?? 0) + 1; return `item.${skillId}.${String(counters[skillId]).padStart(2, '0')}`; };
const base = (type, skill, prompt, diff) => {
  const id = nextId(skill);
  return { id, type, skillId: skill, difficulty: diff, prompt: L(prompt), reviewStatus: 'beta', explanationId: `exp.${skill}`, provenance: prov(id, 'item', 'original geography item drafted from the programa topic; facts to be checked by a geography teacher') };
};
const letters = 'abcdefgh';
/** Multiple choice: options[0] is the correct one; the position shown is shuffled deterministically. */
const C = (skill, prompt, options, diff = 2, visual) => {
  const it = base('choice', skill, prompt, diff);
  const order = shuffle(options.map((o, i) => i), it.id);
  it.options = order.map((i, k) => ({ id: letters[k], text: { ro: options[i] } }));
  it.correctId = letters[order.indexOf(0)];
  if (visual) it.visual = visual;
  return it;
};
const TF = (skill, prompt, correct, diff = 2) => ({ ...base('true-false', skill, prompt, diff), correct });
const N = (skill, prompt, correct, diff = 2) => ({ ...base('number-input', skill, prompt, diff), correct });
/** Match: pairs [[left, right], ...] */
const M = (skill, prompt, pairs, diff = 2) => {
  const it = base('match', skill, prompt, diff);
  it.pairs = pairs.map(([l, r], i) => ({ left: { id: `l${i + 1}`, text: { ro: l } }, right: { id: `r${i + 1}`, text: { ro: r } } }));
  return it;
};
/** Sort: categories [label...], cards [[text, categoryIndex]...] */
const S = (skill, prompt, cats, cards, diff = 2) => {
  const it = base('sort', skill, prompt, diff);
  it.categories = cats.map((c, i) => ({ id: `k${i + 1}`, label: { ro: c } }));
  it.cards = shuffle(cards.map(([t, c], i) => ({ id: `c${i + 1}`, text: { ro: t }, categoryId: `k${c + 1}` })), it.id);
  return it;
};
/** Order: cards given in the correct order */
const O = (skill, prompt, cards, diff = 2) => {
  const it = base('order', skill, prompt, diff);
  const all = cards.map((t, i) => ({ id: `c${i + 1}`, text: { ro: t } }));
  let shown = shuffle(all, it.id);
  if (shown.every((c, i) => c.id === all[i].id)) shown = [...shown.slice(1), shown[0]];
  it.cards = shown;
  it.correctOrder = all.map((c) => c.id);
  return it;
};
/** Read and answer: questions [prompt, true|false] or [prompt, [correct, wrong1, wrong2]] */
const R = (skill, prompt, passage, questions, diff = 3) => {
  const it = base('read-and-answer', skill, prompt, diff);
  it.passage = L(passage);
  it.questions = questions.map(([q, a], i) => {
    const qid = `${it.id}.q${i + 1}`;
    const b = { id: qid, skillId: skill, difficulty: diff, prompt: L(q), reviewStatus: 'beta', provenance: prov(qid, 'item', 'question about an original text drafted for the competence') };
    if (typeof a === 'boolean') return { ...b, type: 'true-false', correct: a };
    const order = shuffle(a.map((_, j) => j), qid);
    return { ...b, type: 'choice', options: order.map((j, k) => ({ id: letters[k], text: { ro: a[j] } })), correctId: letters[order.indexOf(0)] };
  });
  return it;
};

/* ---------- hotspots on the blank map ---------- */
const BLANK = { kind: 'image', src: MAP.image.blank, alt: { ro: 'Harta României, fără nume: relief, râuri și Marea Neagră', en: 'Map of Romania without names: relief, rivers and the Black Sea' }, provenanceId: 'data-natural-earth' };
const gap = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * (VH / VW));
const PROMPTS = {
  relief: (t) => `Atinge ${t.ro} pe hartă. || Tap ${t.en} on the map.`,
  sea: (t) => `Atinge ${t.ro} pe hartă. || Tap the ${t.en} on the map.`,
  city: (t) => `Arată orașul ${t.ro} pe hartă. || Show the city of ${t.en} on the map.`,
  river: (t) => (t.id === 'dunarea' ? 'Atinge Dunărea pe hartă. || Tap the Danube on the map.' : `Atinge râul ${t.ro} pe hartă. || Tap the river ${t.ro} on the map.`),
};
const H = (skill, targetId, diff, pool) => {
  const t = TARGET[targetId];
  const it = base('hotspot', skill, PROMPTS[t.kind](t), diff);
  const n = diff >= 3 ? 4 : 3;
  const chosen = [t];
  for (const c of shuffle(pool.filter((x) => x !== targetId).map((x) => TARGET[x]), it.id)) {
    if (chosen.length >= n) break;
    if (chosen.every((o) => gap(o, c) >= o.r + c.r + 1.5)) chosen.push(c);
  }
  it.image = BLANK;
  it.regions = shuffle(chosen, it.id + 'r').map((c) => ({ id: c.id, x: c.x, y: c.y, r: c.r }));
  it.correctId = targetId;
  return it;
};
const RELIEF = ['carpati-orientali', 'carpati-meridionali', 'carpati-occidentali', 'podisul-transilvaniei', 'podisul-moldovei', 'podisul-dobrogei', 'campia-de-vest', 'campia-romana'];
const CITIES = ['bucuresti', 'cluj-napoca', 'iasi', 'timisoara', 'constanta', 'brasov'];
const RIVERS = ['dunarea', 'muresul', 'oltul', 'siretul', 'prutul'];
const WATERS = [...RIVERS, 'delta-dunarii', 'marea-neagra'];

const sk = (short, id) => { SKILL[short] = id; return id; };
const ID = {
  cardinal: sk('cardinal', 'geo.orient.cardinal.4'),
  map: sk('map', 'geo.orient.map.4'),
  position: sk('position', 'geo.romania.position.4'),
  units: sk('units', 'geo.relief.units.4'),
  carp: sk('carp', 'geo.relief.carpathians.4'),
  low: sk('low', 'geo.relief.lowlands.4'),
  rivers: sk('rivers', 'geo.rivers.4'),
  danube: sk('danube', 'geo.danube.delta.4'),
  sea: sk('sea', 'geo.blacksea.4'),
  climate: sk('climate', 'geo.climate.4'),
  zones: sk('zones', 'geo.nature.zones.4'),
  people: sk('people', 'geo.people.settlements.4'),
  counties: sk('counties', 'geo.counties.capital.4'),
  env: sk('env', 'geo.environment.protected.4'),
};

/* ================= ITEMS ================= */
const hotspots = [
  H(ID.carp, 'carpati-meridionali', 2, RELIEF),
  H(ID.carp, 'carpati-orientali', 3, RELIEF),
  H(ID.carp, 'carpati-occidentali', 3, RELIEF),
  H(ID.units, 'campia-romana', 2, RELIEF),
  H(ID.low, 'podisul-transilvaniei', 3, RELIEF),
  H(ID.low, 'podisul-moldovei', 3, RELIEF),
  H(ID.low, 'podisul-dobrogei', 3, RELIEF),
  H(ID.low, 'campia-de-vest', 2, RELIEF),
  H(ID.low, 'campia-romana', 2, RELIEF),
  H(ID.rivers, 'muresul', 3, WATERS),
  H(ID.rivers, 'oltul', 3, WATERS),
  H(ID.rivers, 'siretul', 3, WATERS),
  H(ID.rivers, 'prutul', 3, WATERS),
  H(ID.danube, 'dunarea', 2, WATERS),
  H(ID.danube, 'delta-dunarii', 2, WATERS),
  H(ID.danube, 'delta-dunarii', 3, [...WATERS, ...RELIEF]),
  H(ID.sea, 'marea-neagra', 1, WATERS),
  H(ID.sea, 'constanta', 2, CITIES),
  ...CITIES.map((c, i) => H(ID.counties, c, i < 2 ? 1 : 2, CITIES)),
  H(ID.position, 'bucuresti', 1, CITIES),
];

const orientation = [
  TF(ID.cardinal, 'Steaua Polară ne arată direcția nord. || The Pole Star shows us the direction north.', true, 2),
  TF(ID.cardinal, 'Soarele apune în partea de est. || The sun sets in the east.', false, 1),
  TF(ID.cardinal, 'Sudul este direcția opusă nordului. || South is the opposite of north.', true, 1),
  C(ID.cardinal, 'Cu ce instrument aflăm punctele cardinale? || Which instrument shows the cardinal points?', ['Cu busola', 'Cu termometrul', 'Cu rigla', 'Cu cântarul'], 1),
  C(ID.cardinal, 'Cum se numește desenul cu punctele cardinale și cele intermediare? || What is the drawing with the cardinal and intermediate points called?', ['Roza vânturilor', 'Legenda', 'Scara hărții', 'Planul'], 2),
  M(ID.cardinal, 'Potrivește punctul cardinal cu prescurtarea lui. || Match each cardinal point with its short form.', [['nord', 'N'], ['sud', 'S'], ['est', 'E'], ['vest', 'V']], 1),
  O(ID.cardinal, 'Pune punctele cardinale în ordine, în sensul acelor de ceasornic, începând cu nordul. || Put the cardinal points in clockwise order, starting at north.', ['nord', 'est', 'sud', 'vest'], 2),
  C(ID.cardinal, 'Între sud și vest se află direcția... || Between south and west lies...', ['sud-vest', 'nord-est', 'sud-est', 'nord-vest'], 3),
];

const mapSkills = [
  C(ID.map, 'Ce ne arată legenda unei hărți? || What does the legend of a map show us?', ['Ce înseamnă semnele de pe hartă', 'Cât de mare este țara', 'În ce an a fost desenată harta', 'Câți locuitori are țara'], 2),
  C(ID.map, 'Ce arată scara unei hărți? || What does the scale of a map show?', ['De câte ori sunt micșorate distanțele din realitate', 'Cât de înalt este un munte', 'Care este capitala țării', 'Unde este nordul'], 3),
  C(ID.map, 'Ce desen arată o suprafață foarte mică, de exemplu sala de clasă? || Which drawing shows a very small area, like a classroom?', ['Planul', 'Harta lumii', 'Harta Europei', 'Globul pământesc'], 1),
  C(ID.map, 'Pe harta fizică, apele (râurile, lacurile, marea) sunt desenate de obicei cu culoarea... || On a physical map, waters are usually drawn in...', ['albastră', 'roșie', 'neagră', 'violet'], 1),
  TF(ID.map, 'Semnele convenționale de pe hartă sunt explicate în legendă. || The signs on a map are explained in the legend.', true, 1),
  TF(ID.map, 'Globul pământesc este un model al Pământului. || The globe is a model of the Earth.', true, 1),
  N(ID.map, 'Pe o hartă, 1 cm înseamnă 10 km în realitate. Două orașe sunt la 4 cm pe hartă. Câți kilometri sunt între ele? || On a map 1 cm means 10 km. Two towns are 4 cm apart on the map. How many kilometres apart are they?', 40, 3),
  N(ID.map, 'Pe o hartă, 1 cm înseamnă 5 km în realitate. Distanța dintre două localități pe hartă este de 6 cm. Câți kilometri sunt în realitate? || On a map 1 cm means 5 km. Two villages are 6 cm apart on the map. How many kilometres is that in reality?', 30, 3),
  N(ID.map, 'Pe o hartă, 1 cm înseamnă 20 km. Două orașe sunt la 100 km unul de altul. Câți centimetri sunt între ele pe hartă? || On a map 1 cm means 20 km. Two cities are 100 km apart. How many centimetres apart are they on the map?', 5, 4),
  S(ID.map, 'Plan sau hartă? Pune fiecare desen în grupa potrivită. || Plan or map? Sort each drawing.', ['Plan', 'Hartă'], [['camera mea', 0], ['curtea școlii', 0], ['sala de clasă', 0], ['România', 1], ['Europa', 1], ['Marea Neagră', 1]], 2),
];

const position = [
  C(ID.position, 'Pe ce continent se află România? || On which continent is Romania?', ['Europa', 'Asia', 'Africa', 'America de Nord'], 1),
  C(ID.position, 'Cu ce țară se învecinează România la nord? || Which country is north of Romania?', ['Ucraina', 'Bulgaria', 'Serbia', 'Ungaria'], 2),
  C(ID.position, 'Cu ce țară se învecinează România la sud? || Which country is south of Romania?', ['Bulgaria', 'Ungaria', 'Ucraina', 'Serbia'], 2),
  C(ID.position, 'Cu ce țară se învecinează România la vest? || Which country is west of Romania?', ['Ungaria', 'Bulgaria', 'Ucraina', 'Republica Moldova'], 2),
  C(ID.position, 'Care dintre aceste țări NU se învecinează cu România? || Which of these countries does NOT border Romania?', ['Polonia', 'Ungaria', 'Serbia', 'Bulgaria'], 3),
  M(ID.position, 'Potrivește țara vecină cu direcția în care se află față de România. || Match each neighbour with its direction.', [['Ucraina', 'nord'], ['Bulgaria', 'sud'], ['Ungaria', 'vest'], ['Republica Moldova', 'est']], 3),
  N(ID.position, 'Câți vecini la uscat are România? || How many land neighbours does Romania have?', 5, 3),
  C(ID.position, 'Ce râu formează o mare parte din granița de sud a României? || Which river forms much of Romania\'s southern border?', ['Dunărea', 'Mureșul', 'Oltul', 'Siretul'], 3),
  TF(ID.position, 'Granița României cu Republica Moldova urmează în mare parte râul Prut. || The border with Moldova mostly follows the Prut.', true, 3),
  TF(ID.position, 'Marea Neagră se află la vestul României. || The Black Sea is west of Romania.', false, 1),
  TF(ID.position, 'România este o țară din Europa. || Romania is a country in Europe.', true, 1),
];

const relief = [
  C(ID.units, 'Care formă de relief este cea mai înaltă? || Which landform is the highest?', ['Munții', 'Dealurile', 'Câmpiile', 'Văile'], 1),
  C(ID.units, 'Care formă de relief este joasă și aproape plană? || Which landform is low and almost flat?', ['Câmpia', 'Muntele', 'Dealul', 'Vârful'], 1),
  C(ID.units, 'Cum se numește partea cea mai înaltă a unui munte? || What is the highest part of a mountain called?', ['Vârf', 'Vale', 'Poală', 'Câmpie'], 1),
  C(ID.units, 'Ce formă de relief are partea de sus aproape plană și este mai înaltă decât câmpia? || Which landform is almost flat on top and higher than a plain?', ['Podișul', 'Valea', 'Delta', 'Câmpia'], 3),
  TF(ID.units, 'În România există munți, dealuri, podișuri și câmpii. || Romania has mountains, hills, plateaus and plains.', true, 1),
  TF(ID.units, 'Relieful României este împărțit aproape în părți egale între munți, dealuri și podișuri, și câmpii. || Romania\'s relief is split almost equally between mountains, hills and plateaus, and plains.', true, 3),
  O(ID.units, 'Pune formele de relief de la cea mai joasă la cea mai înaltă. || Order the landforms from the lowest to the highest.', ['câmpia', 'dealul', 'muntele'], 2),
  M(ID.units, 'Potrivește unitatea de relief cu tipul ei. || Match each relief unit with its type.', [['Carpații Meridionali', 'munți'], ['Podișul Moldovei', 'podiș'], ['Câmpia Română', 'câmpie'], ['Subcarpații', 'dealuri']], 3),
  S(ID.units, 'Pune fiecare unitate de relief în grupa potrivită. || Sort each relief unit into its group.', ['Munți', 'Podișuri', 'Câmpii'], [['Carpații Orientali', 0], ['Carpații Occidentali', 0], ['Podișul Transilvaniei', 1], ['Podișul Dobrogei', 1], ['Câmpia Română', 2], ['Câmpia de Vest', 2]], 3),
  S(ID.units, 'Munte, podiș sau câmpie? Sortează. || Mountain, plateau or plain? Sort.', ['Munți', 'Podișuri', 'Câmpii'], [['Carpații Meridionali', 0], ['Podișul Moldovei', 1], ['Podișul Transilvaniei', 1], ['Câmpia de Vest', 2], ['Câmpia Română', 2], ['Carpații Orientali', 0]], 2),
  // Carpathians
  C(ID.carp, 'În ce parte a Carpaților se află vârful Moldoveanu, cel mai înalt din România? || In which part of the Carpathians is Moldoveanu, Romania\'s highest peak?', ['Carpații Meridionali', 'Carpații Orientali', 'Carpații Occidentali', 'Subcarpați'], 3),
  C(ID.carp, 'Care este înălțimea vârfului Moldoveanu, cel mai înalt din România? || How high is Moldoveanu, Romania\'s highest peak?', ['2544 m', '1907 m', '3200 m', '800 m'], 3),
  C(ID.carp, 'Munții Apuseni fac parte din... || The Apuseni Mountains belong to...', ['Carpații Occidentali', 'Carpații Orientali', 'Carpații Meridionali', 'Munții Măcin'], 3),
  M(ID.carp, 'Potrivește muntele cu lanțul Carpaților din care face parte. || Match each mountain range with its part of the Carpathians.', [['Ceahlău', 'Carpații Orientali'], ['Făgăraș', 'Carpații Meridionali'], ['Apuseni', 'Carpații Occidentali']], 3),
  M(ID.carp, 'Potrivește muntele cu lanțul Carpaților din care face parte. || Match each mountain range with its part of the Carpathians.', [['Rodna', 'Carpații Orientali'], ['Retezat', 'Carpații Meridionali'], ['Semenic', 'Carpații Occidentali']], 4),
  TF(ID.carp, 'Carpații formează în România un arc mare. || The Carpathians form a big arc in Romania.', true, 1),
  TF(ID.carp, 'Cei mai înalți munți din România sunt Carpații Meridionali. || Romania\'s highest mountains are the Southern Carpathians.', true, 3),
  TF(ID.carp, 'Munții Apuseni fac parte din Carpații Orientali. || The Apuseni Mountains are part of the Eastern Carpathians.', false, 3),
  TF(ID.carp, 'Vârful Omu se află în munții Bucegi. || The Omu peak is in the Bucegi Mountains.', true, 4),
  // lowlands
  C(ID.low, 'Unde se află Podișul Transilvaniei? || Where is the Transylvanian Plateau?', ['În interiorul arcului Carpaților', 'Între Dunăre și Marea Neagră', 'La granița cu Ungaria', 'În sudul țării, lângă Dunăre'], 3),
  C(ID.low, 'Care este cea mai întinsă câmpie din România? || Which is the largest plain in Romania?', ['Câmpia Română', 'Câmpia de Vest', 'Câmpia Moldovei', 'Câmpia Siretului'], 3),
  C(ID.low, 'Câmpia Română se întinde între Subcarpați și... || The Romanian Plain stretches between the Subcarpathians and...', ['Dunăre', 'Prut', 'Mureș', 'Someș'], 3),
  C(ID.low, 'Subcarpații sunt dealuri așezate... || The Subcarpathians are hills lying...', ['la poalele Carpaților', 'pe malul mării', 'în Delta Dunării', 'lângă granița cu Serbia'], 3),
  C(ID.low, 'Ce se cultivă mult în câmpii? || What is grown a lot in plains?', ['Grâu și porumb', 'Banane', 'Cafea', 'Cacao'], 1),
  TF(ID.low, 'Podișul Dobrogei se află între Dunăre și Marea Neagră. || The Dobruja Plateau lies between the Danube and the Black Sea.', true, 3),
  TF(ID.low, 'Podișul Moldovei se află în estul țării. || The Moldavian Plateau is in the east of the country.', true, 2),
  TF(ID.low, 'Câmpia de Vest se află lângă granița cu Ungaria și Serbia. || The Western Plain is near the border with Hungary and Serbia.', true, 3),
  TF(ID.low, 'Munții Măcin se află în Dobrogea. || The Măcin Mountains are in Dobruja.', true, 4),
  M(ID.low, 'Potrivește unitatea de relief cu locul ei în țară. || Match each relief unit with its place in the country.', [['Podișul Moldovei', 'est'], ['Câmpia de Vest', 'vest'], ['Podișul Dobrogei', 'sud-est'], ['Podișul Transilvaniei', 'centru']], 3),
];

const waters = [
  C(ID.rivers, 'Pe malurile cărui râu se află orașul Arad? || Which river flows through Arad?', ['Mureș', 'Olt', 'Prut', 'Siret'], 3),
  C(ID.rivers, 'Care râu trece prin orașul Pitești? || Which river flows through Pitești?', ['Argeș', 'Jiu', 'Someș', 'Prut'], 3),
  C(ID.rivers, 'Care râu formează granița dintre România și Republica Moldova? || Which river forms the border between Romania and Moldova?', ['Prut', 'Siret', 'Olt', 'Jiu'], 2),
  C(ID.rivers, 'Care dintre aceste râuri curge numai pe teritoriul României? || Which of these rivers flows only inside Romania?', ['Oltul', 'Mureșul', 'Prutul', 'Dunărea'], 4),
  C(ID.rivers, 'Din ce munți izvorăște Oltul? || In which mountains does the Olt rise?', ['Carpații Orientali', 'Munții Apuseni', 'Munții Măcin', 'Munții Semenic'], 4),
  C(ID.rivers, 'Locul unde începe un râu se numește... || The place where a river begins is called...', ['izvor', 'vărsare', 'afluent', 'mal'], 1),
  C(ID.rivers, 'Un râu mai mic care se varsă într-un râu mai mare se numește... || A smaller river that flows into a bigger one is called...', ['afluent', 'izvor', 'vărsare', 'deltă'], 2),
  M(ID.rivers, 'Potrivește râul cu un oraș de pe malul lui. || Match each river with a city on its bank.', [['Mureș', 'Arad'], ['Olt', 'Slatina'], ['Argeș', 'Pitești'], ['Jiu', 'Târgu Jiu']], 4),
  TF(ID.rivers, 'Aproape toate râurile din România ajung în Dunăre. || Almost all rivers of Romania end up in the Danube.', true, 3),
  TF(ID.rivers, 'Siretul și Prutul se varsă în Dunăre, lângă Galați. || The Siret and the Prut flow into the Danube near Galați.', true, 4),
  TF(ID.rivers, 'Cluj-Napoca este traversat de Someșul Mic. || The Someșul Mic flows through Cluj-Napoca.', true, 4),
  TF(ID.rivers, 'Râul Jiu izvorăște din Carpații Meridionali. || The Jiu rises in the Southern Carpathians.', true, 4),
  // Danube & Delta
  C(ID.danube, 'În ce se varsă Dunărea? || Where does the Danube flow into?', ['Marea Neagră', 'Marea Baltică', 'Marea Adriatică', 'Oceanul Atlantic'], 1),
  C(ID.danube, 'Cum se numesc cele trei brațe ale Dunării în Deltă? || What are the three arms of the Danube in the Delta called?', ['Chilia, Sulina și Sfântu Gheorghe', 'Olt, Mureș și Siret', 'Prut, Jiu și Argeș', 'Bega, Timiș și Someș'], 3),
  C(ID.danube, 'Care braț al Dunării este cel mai scurt și este folosit de nave? || Which arm is the shortest and used by ships?', ['Sulina', 'Chilia', 'Sfântu Gheorghe', 'Borcea'], 4),
  C(ID.danube, 'În ce județ se află cea mai mare parte a Deltei Dunării? || In which county is most of the Danube Delta?', ['Tulcea', 'Cluj', 'Brașov', 'Dolj'], 3),
  C(ID.danube, 'Ce pasăre este un simbol al Deltei Dunării? || Which bird is a symbol of the Danube Delta?', ['Pelicanul', 'Pinguinul', 'Papagalul', 'Struțul'], 1),
  C(ID.danube, 'Prin ce defileu trece Dunărea la granița cu Serbia? || Through which gorge does the Danube pass on the border with Serbia?', ['Porțile de Fier', 'Cheile Bicazului', 'Defileul Oltului', 'Cheile Turzii'], 4),
  N(ID.danube, 'Prin câte țări curge Dunărea, de la izvor până la vărsare? || Through how many countries does the Danube flow?', 10, 4),
  TF(ID.danube, 'Delta Dunării este o rezervație a biosferei. || The Danube Delta is a biosphere reserve.', true, 2),
  TF(ID.danube, 'Delta s-a format din nisipul și mâlul aduse de Dunăre. || The Delta was formed from the sand and mud brought by the Danube.', true, 3),
  TF(ID.danube, 'Dunărea izvorăște din Germania. || The Danube rises in Germany.', true, 3),
  // Black Sea
  C(ID.sea, 'Care este cel mai mare port al României? || Which is Romania\'s biggest port?', ['Constanța', 'Galați', 'Tulcea', 'Mangalia'], 2),
  C(ID.sea, 'Cum se numește malul mării, cu plajele lui? || What is the sea coast with its beaches called?', ['Litoral', 'Defileu', 'Deltă', 'Podiș'], 2),
  C(ID.sea, 'Care dintre aceste locuri este stațiune la Marea Neagră? || Which of these is a resort on the Black Sea?', ['Mamaia', 'Sinaia', 'Predeal', 'Vatra Dornei'], 2),
  C(ID.sea, 'Marea Neagră se află în ... față de România. || The Black Sea lies ... of Romania.', ['est', 'vest', 'nord', 'sud-vest'], 2),
  C(ID.sea, 'Ce lac sărat de lângă litoral este folosit pentru nămolul curativ? || Which salty lake near the coast is used for healing mud?', ['Techirghiol', 'Lacul Roșu', 'Snagov', 'Bâlea'], 4),
  C(ID.sea, 'În ce regiune istorică se află litoralul românesc? || In which historical region is the Romanian coast?', ['Dobrogea', 'Banat', 'Oltenia', 'Maramureș'], 3),
  TF(ID.sea, 'Apa Mării Negre este sărată. || The water of the Black Sea is salty.', true, 1),
  TF(ID.sea, 'România are ieșire la Oceanul Atlantic. || Romania has a coast on the Atlantic Ocean.', false, 2),
  TF(ID.sea, 'Litoralul românesc al Mării Negre are aproximativ 245 km lungime. || The Romanian coast of the Black Sea is about 245 km long.', true, 4),
];

const climateNature = [
  C(ID.climate, 'Ce fel de climă are România? || What kind of climate does Romania have?', ['Temperat-continentală', 'Ecuatorială', 'Polară', 'Tropicală'], 2),
  N(ID.climate, 'Câte anotimpuri are un an? || How many seasons are in a year?', 4, 1),
  O(ID.climate, 'Pune anotimpurile în ordine, începând cu primăvara. || Order the seasons, starting with spring.', ['primăvara', 'vara', 'toamna', 'iarna'], 1),
  M(ID.climate, 'Potrivește anotimpul cu o lună din el. || Match each season with one of its months.', [['iarna', 'ianuarie'], ['primăvara', 'aprilie'], ['vara', 'iulie'], ['toamna', 'octombrie']], 2),
  S(ID.climate, 'Iarnă sau vară? Sortează. || Winter or summer? Sort.', ['Iarna', 'Vara'], [['ger și zăpadă', 0], ['derdeluș', 0], ['caniculă', 1], ['înot la mare', 1], ['fulgi de nea', 0], ['vacanța mare', 1]], 1),
  C(ID.climate, 'Care regiune primește cele mai puține ploi din țară? || Which region gets the least rain?', ['Dobrogea', 'Munții Făgăraș', 'Munții Apuseni', 'Carpații Orientali'], 4),
  C(ID.climate, 'Cum se numește vântul rece și uscat care bate iarna în estul țării? || What is the cold, dry winter wind of eastern Romania called?', ['Crivățul', 'Austrul', 'Briza', 'Alizeul'], 4),
  C(ID.climate, 'Ce instrument măsoară temperatura aerului? || Which instrument measures air temperature?', ['Termometrul', 'Busola', 'Rigla', 'Cronometrul'], 1),
  C(ID.climate, 'Starea aerului într-o anumită zi (soare, ploaie, vânt) se numește... || The state of the air on a given day (sun, rain, wind) is called...', ['vreme', 'climă', 'relief', 'anotimp'], 3),
  TF(ID.climate, 'Pe vârfurile munților este mai frig decât în câmpie. || It is colder on mountain peaks than in the plains.', true, 2),
  TF(ID.climate, 'Munții primesc mai multe precipitații decât Dobrogea. || Mountains get more precipitation than Dobruja.', true, 4),
  TF(ID.climate, 'În România iarna are loc în lunile decembrie, ianuarie și februarie. || In Romania winter is in December, January and February.', true, 2),
  // nature zones
  S(ID.zones, 'Unde trăiește sau crește? Sortează pe zone. || Where does it live or grow? Sort by zone.', ['Munte', 'Câmpie', 'Deltă'], [['capra neagră', 0], ['floarea-de-colț', 0], ['iepurele de câmp', 1], ['popândăul', 1], ['pelicanul', 2], ['stuful', 2], ['ursul brun', 0]], 3),
  S(ID.zones, 'Copaci cu ace sau cu frunze late? Sortează. || Trees with needles or with broad leaves? Sort.', ['Conifere (molid, brad)', 'Foioase (fag, stejar)'], [['molidul', 0], ['bradul', 0], ['fagul', 1], ['stejarul', 1]], 2),
  C(ID.zones, 'Ce copac crește în păduri de munte și are ace și conuri? || Which mountain tree has needles and cones?', ['Molidul', 'Salcia', 'Teiul', 'Nucul'], 2),
  C(ID.zones, 'Care plantă rară crește pe stâncile munților înalți? || Which rare plant grows on high mountain rocks?', ['Floarea-de-colț', 'Nufărul', 'Grâul', 'Floarea-soarelui'], 3),
  C(ID.zones, 'Care dintre aceste păsări trăiește în Delta Dunării? || Which of these birds lives in the Danube Delta?', ['Pelicanul', 'Cocoșul-de-munte', 'Pinguinul', 'Papagalul'], 2),
  C(ID.zones, 'Ce animal trăiește în pădurile Carpaților? || Which animal lives in the Carpathian forests?', ['Ursul brun', 'Cămila', 'Girafa', 'Elefantul'], 1),
  M(ID.zones, 'Potrivește animalul cu locul unde trăiește. || Match each animal with its home.', [['capra neagră', 'munții înalți'], ['pelicanul', 'Delta Dunării'], ['popândăul', 'stepa din câmpie'], ['ursul brun', 'pădurile Carpaților']], 3),
  TF(ID.zones, 'Pe munte, mai sus de păduri, sunt pajiști alpine. || On mountains, above the forests, there are alpine meadows.', true, 3),
  TF(ID.zones, 'Fagul și stejarul sunt copaci foioși. || Beech and oak are broad-leaved trees.', true, 2),
  TF(ID.zones, 'Stuful crește în Delta Dunării. || Reed grows in the Danube Delta.', true, 2),
  // environment
  C(ID.env, 'Care este primul parc național din România, înființat în 1935? || Which is Romania\'s first national park, set up in 1935?', ['Retezat', 'Ceahlău', 'Piatra Craiului', 'Cozia'], 4),
  C(ID.env, 'Ce este o arie protejată? || What is a protected area?', ['Un loc unde natura este ocrotită prin lege', 'Un loc unde se construiesc blocuri', 'Un loc unde se taie pădurea', 'Un loc fără plante'], 2),
  C(ID.env, 'Ce este un pericol pentru păduri? || What is a danger to forests?', ['Tăierea abuzivă a copacilor', 'Plantarea de puieți', 'Ploaia', 'Zăpada'], 2),
  C(ID.env, 'Cum ne purtăm într-un parc național? || How do we behave in a national park?', ['Rămânem pe poteci și luăm gunoiul cu noi', 'Culegem florile rare', 'Aprindem focuri oriunde', 'Hrănim ursul'], 1),
  C(ID.env, 'Care este o sursă de energie care nu se termină? || Which energy source never runs out?', ['Vântul', 'Cărbunele', 'Petrolul', 'Gazul'], 3),
  S(ID.env, 'Bine sau rău pentru mediu? Sortează. || Good or bad for the environment? Sort.', ['Bine pentru mediu', 'Rău pentru mediu'], [['plantăm copaci', 0], ['colectăm selectiv deșeurile', 0], ['aruncăm gunoiul la munte', 1], ['ardem plasticul', 1], ['reciclăm hârtia', 0], ['lăsăm apa să curgă degeaba', 1]], 1),
  M(ID.env, 'Potrivește animalul ocrotit cu locul lui. || Match each protected animal with its home.', [['capra neagră', 'stâncile munților'], ['pelicanul', 'Delta Dunării'], ['râsul', 'pădurile Carpaților']], 3),
  TF(ID.env, 'Delta Dunării este o zonă protejată. || The Danube Delta is a protected area.', true, 1),
  TF(ID.env, 'Floarea-de-colț este ocrotită: nu o culegem. || The edelweiss is protected: we do not pick it.', true, 2),
  TF(ID.env, 'La colectarea selectivă, hârtia se pune de obicei în containerul albastru. || In separate collection paper usually goes into the blue container.', true, 3),
];

const society = [
  C(ID.people, 'Cum se numesc localitățile mici de la țară? || What are small places in the countryside called?', ['Sate', 'Orașe', 'Capitale', 'Județe'], 1),
  C(ID.people, 'Cum se numește localitatea mare, cu blocuri, fabrici, magazine și multe școli? || What is a large place with blocks, factories, shops and many schools called?', ['Oraș', 'Sat', 'Cătun', 'Stână'], 1),
  C(ID.people, 'Aproximativ câți locuitori are România? || About how many people live in Romania?', ['19 milioane', '2 milioane', '190 milioane', '190 mii'], 3),
  C(ID.people, 'Care este ocupația de bază a multor oameni din sate? || What is the main occupation of many village people?', ['Agricultura', 'Construcția de nave spațiale', 'Pescuitul în ocean', 'Minerit de diamante'], 2),
  C(ID.people, 'Ce ocupație tradițională au mulți oameni din munți? || Which traditional occupation do many mountain people have?', ['Creșterea oilor', 'Cultivarea orezului', 'Pescuitul pe mare', 'Cultivarea bananelor'], 3),
  C(ID.people, 'Ce ocupație au mulți locuitori din Delta Dunării? || Which occupation do many people in the Danube Delta have?', ['Pescuitul', 'Mineritul', 'Creșterea oilor în munți', 'Cultivarea ananasului'], 3),
  S(ID.people, 'Sat sau oraș? Sortează. || Village or city? Sort.', ['Sat', 'Oraș'], [['gospodării cu grădină și animale', 0], ['blocuri înalte', 1], ['tramvai', 1], ['puțini locuitori', 0], ['fabrici', 1], ['fânețe și livezi', 0]], 2),
  TF(ID.people, 'O comună este formată din unul sau mai multe sate. || A commune consists of one or more villages.', true, 3),
  TF(ID.people, 'Municipiile sunt orașe mari. || A municipality is a large city.', true, 3),
  // counties & capital
  C(ID.counties, 'Care este capitala României? || What is the capital of Romania?', ['București', 'Cluj-Napoca', 'Iași', 'Constanța'], 1),
  N(ID.counties, 'Câte județe are România (fără municipiul București)? || How many counties does Romania have (not counting Bucharest)?', 41, 3),
  C(ID.counties, 'Care râu străbate București? || Which river flows through Bucharest?', ['Dâmbovița', 'Mureș', 'Someș', 'Prut'], 4),
  C(ID.counties, 'Care este reședința județului Dolj? || What is the seat of Dolj county?', ['Craiova', 'Oradea', 'Pitești', 'Deva'], 3),
  C(ID.counties, 'În ce regiune istorică se află Timișoara? || In which historical region is Timișoara?', ['Banat', 'Dobrogea', 'Moldova', 'Oltenia'], 3),
  TF(ID.counties, 'București se află în sudul țării, în Câmpia Română. || Bucharest is in the south of the country, in the Romanian Plain.', true, 2),
  TF(ID.counties, 'București se află pe malul Dunării. || Bucharest lies on the bank of the Danube.', false, 3),
  M(ID.counties, 'Potrivește județul cu reședința lui. || Match each county with its seat.', [['Dolj', 'Craiova'], ['Bihor', 'Oradea'], ['Suceava', 'Suceava'], ['Prahova', 'Ploiești']], 3),
  M(ID.counties, 'Potrivește județul cu reședința lui. || Match each county with its seat.', [['Argeș', 'Pitești'], ['Mureș', 'Târgu Mureș'], ['Neamț', 'Piatra Neamț'], ['Maramureș', 'Baia Mare']], 4),
  M(ID.counties, 'Potrivește orașul cu regiunea istorică. || Match each city with its historical region.', [['Constanța', 'Dobrogea'], ['Cluj-Napoca', 'Transilvania'], ['Iași', 'Moldova'], ['Craiova', 'Oltenia']], 3),
];

/* ---------- reading texts (original, short) ---------- */
const texts = [
  R(ID.danube, 'Citește și răspunde. || Read and answer.',
    'Dunărea este un fluviu lung, care străbate zece țări. Ea izvorăște din Germania și curge spre est. Pe malul ei sunt orașe mari. La granița cu Serbia, fluviul se strecoară printr-un defileu îngust, numit Porțile de Fier. Apoi curge printre România și Bulgaria. Aproape de mare, Dunărea se desparte în trei brațe: Chilia, Sulina și Sfântu Gheorghe. Între ele se întinde Delta Dunării, un tărâm cu stuf, nuferi și mii de păsări. Dunărea se varsă în Marea Neagră.',
    [['Din ce țară izvorăște Dunărea?', ['Din Germania', 'Din Serbia', 'Din Bulgaria']], ['În ce se varsă Dunărea?', ['În Marea Neagră', 'În Marea Baltică', 'În Mureș']], ['Fluviul se desparte în trei brațe aproape de mare.', true]], 3),
  R(ID.carp, 'Citește și răspunde. || Read and answer.',
    'Maria și bunicul ei au urcat pe un munte din Carpații Meridionali. Poteca trecea mai întâi printr-o pădure de brazi și molizi. Mai sus, copacii s-au rărit și au apărut pajiști cu flori mici. Vântul era rece, iar vârfurile aveau încă zăpadă. Bunicul i-a spus că vârful Moldoveanu este cel mai înalt din România și are 2544 de metri. De sus, Maria a văzut norii sub ea. Seara, în cabană, a băut un ceai fierbinte.',
    [['Ce pădure a întâlnit Maria la început?', ['De brazi și molizi', 'De stejari', 'De nuferi']], ['Vârful Moldoveanu este cel mai înalt din România.', true], ['Maria a urcat pe un munte din Carpații Occidentali.', false]], 3),
  R(ID.low, 'Citește și răspunde. || Read and answer.',
    'Vara, Câmpia Română este un ocean de aur. Lanurile de grâu se leagănă în vânt, iar mai târziu porumbul crește mai înalt decât un copil. Pământul este plat și foarte bun pentru agricultură. Satele sunt departe unele de altele, iar drumurile par fără sfârșit. Iarna, aici bate Crivățul, un vânt rece. La sud, câmpia se oprește la Dunăre.',
    [['Ce se cultivă în Câmpia Română, după text?', ['Grâu și porumb', 'Ananas', 'Cafea']], ['La sud, câmpia se oprește la Dunăre.', true], ['Pământul din câmpie este foarte muntos.', false]], 3),
  R(ID.sea, 'Citește și răspunde. || Read and answer.',
    'Familia lui Andrei a plecat în vacanță la Marea Neagră. Au ajuns la Constanța, cel mai mare port al țării. Acolo au văzut nave mari cu containere. Apoi au mers la Mamaia, o stațiune cu plajă lungă și nisip fin. Andrei a observat că apa mării este sărată. Seara, farurile au aprins luminile, iar valurile se auzeau la țărm.',
    [['Care este cel mai mare port al țării, după text?', ['Constanța', 'Mamaia', 'Tulcea']], ['Apa Mării Negre este sărată.', true], ['Familia lui Andrei a mers în vacanță la munte.', false]], 2),
  R(ID.people, 'Citește și răspunde. || Read and answer.',
    'Ioana locuiește într-un sat de la poalele unui deal. Bunicii ei au o grădină cu legume, doi cai și mulți pui. Dimineața, Ioana aude cocoșul. Vara, ea merge la oraș, la mătușa ei. Acolo sunt blocuri înalte, magazine și tramvaie. Mătușa Ioanei lucrează într-o fabrică. Ioanei îi plac amândouă locurile, dar spune că în sat este mai liniște.',
    [['Unde locuiește Ioana?', ['Într-un sat', 'Într-un oraș mare', 'Pe un vapor']], ['Mătușa Ioanei locuiește în oraș.', true], ['În sat sunt blocuri înalte și tramvaie.', false]], 2),
  R(ID.env, 'Citește și răspunde. || Read and answer.',
    'Clasa lui Radu a făcut o excursie într-un parc național din munți. Ghidul i-a rugat pe copii să rămână pe poteci. El a explicat că florile rare nu se culeg și că gunoiul se ia acasă. Într-un luminiș, copiii au văzut urme de urs. Radu a înțeles că parcul este casa multor animale. La plecare, clasa a numărat toate pachetele goale și le-a pus în coșul potrivit.',
    [['Ce i-a rugat ghidul pe copii?', ['Să rămână pe poteci', 'Să culeagă flori rare', 'Să facă focuri']], ['Parcul este casa multor animale.', true], ['Copiii au lăsat gunoiul în pădure.', false]], 3),
];

/* ================= SKILLS ================= */
const GEO = 'GEO-IV-2014';
const skill = (id, sem, comps, titleRo, titleEn, prereq, sources, mc = [4, 3]) => ({
  id, subject: 'geo', grade: 4, semester: sem,
  competences: comps.map((code) => ({ programa: GEO, code })),
  title: { ro: titleRo, en: titleEn },
  prerequisites: prereq,
  itemSources: sources.map((b) => (typeof b === 'string' ? { bank: `geo/${b}.json` } : b)),
  explanations: [`exp.${id}`],
  masteryCheck: { items: mc[0], minCorrect: mc[1] },
  provenance: prov(`skill.${id}`, 'data', 'competence codes to verify against the official programa (Geografie, clasa a IV-a); content in our own words'),
});
const skills = [
  skill(ID.cardinal, 1, ['1.1'], 'Punctele cardinale și orientarea', 'Cardinal points and finding your way', [], [{ generator: 'geo-directions' }, 'orientation']),
  skill(ID.map, 1, ['1.2'], 'Planul, harta, legenda și scara', 'Plan, map, legend and scale', [ID.cardinal], ['orientation']),
  skill(ID.position, 1, ['2.1'], 'România pe hartă: poziție, vecini, granițe', 'Romania on the map: position, neighbours, borders', [ID.map], ['society', 'map-hotspots']),
  skill(ID.units, 1, ['2.2'], 'Formele de relief: munți, dealuri, podișuri, câmpii', 'Landforms: mountains, hills, plateaus, plains', [ID.position], ['relief', 'map-hotspots']),
  skill(ID.carp, 1, ['2.2'], 'Carpații: Orientali, Meridionali, Occidentali', 'The Carpathians: Eastern, Southern, Western', [ID.units], ['relief', 'map-hotspots', 'texts']),
  skill(ID.low, 1, ['2.2'], 'Dealuri, podișuri și câmpii ale României', 'Hills, plateaus and plains of Romania', [ID.units], ['relief', 'map-hotspots', 'texts']),
  skill(ID.rivers, 2, ['2.3'], 'Râurile României: Mureș, Olt, Siret, Prut, Jiu, Argeș, Someș', 'Rivers of Romania', [ID.position], ['waters', 'map-hotspots']),
  skill(ID.danube, 2, ['2.3'], 'Dunărea și Delta Dunării', 'The Danube and the Danube Delta', [ID.rivers], ['waters', 'map-hotspots', 'texts']),
  skill(ID.sea, 2, ['2.3'], 'Marea Neagră și litoralul', 'The Black Sea and the coast', [ID.position], ['waters', 'map-hotspots', 'texts']),
  skill(ID.climate, 2, ['2.4'], 'Clima și anotimpurile', 'Climate and seasons', [ID.position], ['climate-nature']),
  skill(ID.zones, 2, ['2.5'], 'Vegetația și fauna pe zone de relief', 'Plants and animals by relief zone', [ID.low, ID.carp, ID.climate], ['climate-nature']),
  skill(ID.people, 2, ['3.1'], 'Populația și localitățile: sat și oraș', 'People and settlements: village and city', [ID.position], ['society', 'texts']),
  skill(ID.counties, 2, ['3.2'], 'Județele și capitala', 'Counties and the capital', [ID.position, ID.people], ['society', 'map-hotspots']),
  skill(ID.env, 2, ['3.3'], 'Mediul și ariile protejate', 'Environment and protected areas', [ID.zones], ['climate-nature', 'texts']),
];

/* ================= EXPLANATIONS ================= */
const MAPV = { kind: 'image', media: { kind: 'image', src: MAP.image.labelled, alt: { ro: 'Harta României cu relief, râuri, mare și vecini', en: 'Map of Romania with relief, rivers, sea and neighbours' }, provenanceId: 'data-natural-earth' } };
const F = (ro, en, visual) => ({ text: { ro, en }, ...(visual ? { visual } : {}) });
const obj = (icon, count) => ({ kind: 'objects', icon, count });
const EXPL = {
  [ID.cardinal]: ['Punctele cardinale', 'Cardinal points', [
    F('Soarele răsare la est și apune la vest. Dacă stai cu brațul drept spre răsărit, în față ai nordul.', 'The sun rises in the east and sets in the west. Stretch your right arm to the sunrise: north is in front of you.', obj('🌅', 1)),
    F('Cele patru puncte cardinale sunt nord, sud, est și vest. Nordul și sudul sunt opuse, la fel estul și vestul.', 'The four cardinal points are north, south, east and west. North and south are opposite, and so are east and west.', obj('🧭', 1)),
    F('Între ele sunt direcții intermediare: nord-est, sud-est, sud-vest și nord-vest. Busola ne arată nordul.', 'Between them lie nord-est, sud-est, sud-vest and nord-vest. A compass shows us north.', obj('🧭', 1)),
  ]],
  [ID.map]: ['Plan, hartă, legendă, scară', 'Plan, map, legend, scale', [
    F('Planul arată o suprafață mică, cum este sala de clasă. Harta arată o suprafață mare, cum este țara.', 'A plan shows a small area, like a classroom. A map shows a large area, like a country.', obj('🗺️', 1)),
    F('Legenda explică semnele de pe hartă. Albastrul este pentru ape, iar maroul pentru munți.', 'The legend explains the signs on the map. Blue is for water and brown for mountains.', MAPV),
    F('Scara arată de câte ori e micșorată realitatea. Dacă 1 cm înseamnă 10 km, atunci 4 cm înseamnă 40 km.', 'The scale tells how much smaller the map is than reality. If 1 cm means 10 km, then 4 cm means 40 km.', { kind: 'ruler', to: 4, unit: 'cm', objectEnd: 4, objectLabel: { ro: '4 cm = 40 km', en: '4 cm = 40 km' } }),
  ]],
  [ID.position]: ['România pe hartă', 'Romania on the map', [
    F('România este o țară din Europa. Capitala ei este București.', 'Romania is a country in Europe. Its capital is Bucharest.', MAPV),
    F('Are cinci vecini: Ucraina la nord, Republica Moldova la est, Bulgaria la sud, Serbia la sud-vest și Ungaria la vest.', 'It has five neighbours: Ukraine in the north, Moldova in the east, Bulgaria in the south, Serbia in the south-west and Hungary in the west.', MAPV),
    F('Granița cu Republica Moldova urmează râul Prut, iar mare parte din granița cu Bulgaria este Dunărea. La est este Marea Neagră.', 'The border with Moldova follows the Prut, and much of the border with Bulgaria is the Danube. The Black Sea is to the east.', MAPV),
  ]],
  [ID.units]: ['Formele de relief', 'Landforms', [
    F('Relieful înseamnă toate formele de la suprafața pământului: munți, dealuri, podișuri și câmpii.', 'Relief means all the shapes of the land: mountains, hills, plateaus and plains.', obj('⛰️', 1)),
    F('Munții sunt cei mai înalți și au vârfuri. Câmpiile sunt joase și aproape plane. Dealurile și podișurile sunt la mijloc.', 'Mountains are the highest and have peaks. Plains are low and almost flat. Hills and plateaus are in between.', MAPV),
    F('În România, munții, dealurile și podișurile, și câmpiile ocupă aproape părți egale din țară.', 'In Romania, mountains, hills and plateaus, and plains cover almost equal parts of the country.', MAPV),
  ]],
  [ID.carp]: ['Carpații', 'The Carpathians', [
    F('Carpații formează un mare arc în mijlocul țării. Ei au trei părți: Orientali, Meridionali și Occidentali.', 'The Carpathians form a big arc in the middle of the country. They have three parts: Eastern, Southern and Western.', MAPV),
    F('Carpații Meridionali sunt cei mai înalți. Acolo este vârful Moldoveanu, cu 2544 m, cel mai înalt din România.', 'The Southern Carpathians are the highest. There stands Moldoveanu, 2544 m, the highest peak in Romania.', MAPV),
    F('Carpații Orientali sunt la est, iar Carpații Occidentali, cu Munții Apuseni, sunt la vest.', 'The Eastern Carpathians are in the east, and the Western Carpathians, with the Apuseni, are in the west.', MAPV),
  ]],
  [ID.low]: ['Dealuri, podișuri, câmpii', 'Hills, plateaus, plains', [
    F('Subcarpații sunt dealuri la poalele Carpaților. Podișul Transilvaniei este în interiorul arcului Carpaților.', 'The Subcarpathians are hills at the foot of the Carpathians. The Transylvanian Plateau lies inside the Carpathian arc.', MAPV),
    F('Podișul Moldovei este în est, iar Podișul Dobrogei este între Dunăre și Marea Neagră.', 'The Moldavian Plateau is in the east and the Dobruja Plateau is between the Danube and the Black Sea.', MAPV),
    F('Câmpia Română este în sud, între Carpați și Dunăre. Câmpia de Vest este lângă granița cu Ungaria. Câmpiile dau grâu și porumb.', 'The Romanian Plain is in the south, between the Carpathians and the Danube. The Western Plain is near Hungary. Plains give wheat and corn.', MAPV),
  ]],
  [ID.rivers]: ['Râurile României', 'Rivers of Romania', [
    F('Un râu începe la izvor, primește afluenți și se varsă într-un alt râu, într-un lac sau în mare.', 'A river starts at its source, receives tributaries and flows into another river, a lake or the sea.', obj('💧', 3)),
    F('Mureșul curge spre vest, iar Oltul și Argeșul curg spre sud. Siretul și Prutul curg spre sud-est.', 'The Mureș flows west, the Olt and the Argeș flow south. The Siret and the Prut flow south-east.', MAPV),
    F('Aproape toate râurile ajung în Dunăre. Oltul curge numai pe teritoriul României.', 'Almost all rivers reach the Danube. The Olt flows only inside Romania.', MAPV),
  ]],
  [ID.danube]: ['Dunărea și Delta', 'The Danube and the Delta', [
    F('Dunărea izvorăște din Germania și curge prin zece țări. În România ea formează granița cu Serbia și Bulgaria.', 'The Danube rises in Germany and flows through ten countries. In Romania it forms the border with Serbia and Bulgaria.', MAPV),
    F('La Marea Neagră, Dunărea se desparte în trei brațe: Chilia, Sulina și Sfântu Gheorghe.', 'At the Black Sea the Danube splits into three arms: Chilia, Sulina and Sfântu Gheorghe.', MAPV),
    F('Între brațe se află Delta Dunării, o rezervație cu stuf, nuferi, pelicani și mulți pești.', 'Between the arms lies the Danube Delta, a reserve with reeds, water lilies, pelicans and many fish.', obj('🦩', 1)),
  ]],
  [ID.sea]: ['Marea Neagră', 'The Black Sea', [
    F('Marea Neagră se află la est de România. Malul ei se numește litoral și are plaje cu nisip.', 'The Black Sea lies east of Romania. Its shore is called the coast and has sandy beaches.', MAPV),
    F('Cel mai mare port este Constanța. Aproape de el este stațiunea Mamaia.', 'The biggest port is Constanța. Close to it is the resort Mamaia.', obj('⚓', 1)),
    F('Litoralul este în Dobrogea. Apa mării este sărată, iar vara vin mulți turiști.', 'The coast is in Dobruja. The sea water is salty, and many tourists come in summer.', obj('🏖️', 1)),
  ]],
  [ID.climate]: ['Clima și anotimpurile', 'Climate and seasons', [
    F('Vremea este starea aerului într-o zi. Clima este vremea obișnuită într-un loc, în mulți ani.', 'Weather is the state of the air on a day. Climate is the usual weather of a place over many years.', obj('☀️', 1)),
    F('România are climă temperat-continentală și patru anotimpuri: primăvara, vara, toamna și iarna.', 'Romania has a temperate-continental climate and four seasons: spring, summer, autumn and winter.', obj('🍂', 4)),
    F('Cu cât urcăm mai sus pe munte, cu atât este mai frig și plouă sau ninge mai mult. Dobrogea este cea mai secetoasă.', 'The higher we climb, the colder it is and the more it rains or snows. Dobruja is the driest.', MAPV),
  ]],
  [ID.zones]: ['Plante și animale pe zone', 'Plants and animals by zone', [
    F('La munte, jos cresc păduri de fag, apoi de brad și molid. Sus sunt pajiști alpine cu floarea-de-colț.', 'In the mountains, beech forests grow low, then fir and spruce. Higher up are alpine meadows with edelweiss.', obj('🌲', 3)),
    F('În pădurile Carpaților trăiesc ursul, lupul și cerbul. Pe stânci trăiește capra neagră.', 'Bears, wolves and deer live in Carpathian forests. The chamois lives on the rocks.', obj('🐻', 1)),
    F('În câmpie sunt lanuri și stepă, cu iepuri și popândăi. În Deltă trăiesc pelicanii, printre stuf și nuferi.', 'In the plains there are fields and steppe, with hares and ground squirrels. In the Delta pelicans live among reeds and water lilies.', obj('🦩', 1)),
  ]],
  [ID.people]: ['Sat și oraș', 'Village and city', [
    F('În România trăiesc aproximativ 19 milioane de oameni, în sate și în orașe.', 'About 19 million people live in Romania, in villages and cities.', obj('🏘️', 1)),
    F('Satul are puține case cu grădini. Oamenii lucrează mai ales în agricultură, la păstorit sau pescuit.', 'A village has few houses with gardens. People mostly work in farming, herding or fishing.', obj('🐄', 1)),
    F('Orașul are blocuri, fabrici, magazine și școli. Orașele mari se numesc municipii.', 'A city has blocks, factories, shops and schools. Large cities are called municipalities.', obj('🏙️', 1)),
  ]],
  [ID.counties]: ['Județe și capitala', 'Counties and the capital', [
    F('România are 41 de județe. Fiecare județ are o reședință, orașul unde se află conducerea județului.', 'Romania has 41 counties. Each county has a seat, the city where the county is run.', MAPV),
    F('București este capitala țării și cel mai mare oraș. El se află în sud, în Câmpia Română, pe râul Dâmbovița.', 'Bucharest is the capital and the biggest city. It lies in the south, in the Romanian Plain, on the Dâmbovița river.', MAPV),
    F('Cluj-Napoca, Iași, Timișoara, Constanța și Brașov sunt orașe mari, reședințe de județ.', 'Cluj-Napoca, Iași, Timișoara, Constanța and Brașov are big cities and county seats.', MAPV),
  ]],
  [ID.env]: ['Mediul și ariile protejate', 'Environment and protected areas', [
    F('Mediul este natura din jurul nostru: aer, apă, pământ, plante și animale. Trebuie să îl ocrotim.', 'The environment is the nature around us: air, water, soil, plants and animals. We must protect it.', obj('🌍', 1)),
    F('Ariile protejate sunt locuri ocrotite prin lege, ca parcurile naționale și Delta Dunării. Retezatul a fost primul parc național.', 'Protected areas are places protected by law, like national parks and the Danube Delta. Retezat was the first national park.', MAPV),
    F('Noi ajutăm natura dacă nu aruncăm gunoi, colectăm selectiv, plantăm copaci și nu culegem florile rare.', 'We help nature by not littering, sorting waste, planting trees and not picking rare flowers.', obj('♻️', 1)),
  ]],
};
const explanations = Object.entries(EXPL).map(([skillId, [ro, en, frames]]) => ({
  id: `exp.${skillId}`, skillId, title: { ro, en }, frames, reviewStatus: 'beta',
  provenance: prov(`exp.${skillId}`, 'explanation', 'original explanation drafted for the competence; awaiting human review'),
}));

/* ================= WRITE ================= */
const out = (rel, data) => { const p = join(ROOT, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(data, null, 2) + '\n'); };
out('content/skills/geo/grade4.json', skills);
out('content/items/geo/map-hotspots.json', hotspots);
out('content/items/geo/orientation.json', [...orientation, ...mapSkills]);
out('content/items/geo/relief.json', relief);
out('content/items/geo/waters.json', waters);
out('content/items/geo/climate-nature.json', climateNature);
out('content/items/geo/society.json', [...society, ...position]);
out('content/items/geo/texts.json', texts);
out('content/explanations/geo/grade4.json', explanations);
const all = [...hotspots, ...orientation, ...mapSkills, ...relief, ...waters, ...climateNature, ...society, ...position, ...texts];
console.log('skills', skills.length, 'items', all.length, 'explanations', explanations.length);
const bySkill = {};
for (const i of all) bySkill[i.skillId] = (bySkill[i.skillId] ?? 0) + 1;
console.log(bySkill);
