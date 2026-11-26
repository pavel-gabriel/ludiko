/**
 * Own curated fact tables for the science generators (subject "stiinte", grades 0-IV).
 * Facts are common scientific knowledge written in our own words; every classification is
 * unambiguous (a thing belongs to exactly one category of its set). Tested in tests/stiinteContent.test.ts.
 */

export interface Thing {
  /** indefinite singular, shown on cards ("balenă") */
  ro: string;
  /** definite form for sentences ("balena") */
  d: string;
  /** English noun phrase without article ("whale") */
  en: string;
  emoji?: string;
}

export interface Cat {
  id: string;
  /** label for sorting boxes / answer options */
  label: { ro: string; en: string };
  /** predicate used in "Care dintre acestea ...?" and "{D} ...". */
  pred: { ro: string; en: string };
  things: Thing[];
}

export interface ClassSet {
  id: string;
  qSort: { ro: string; en: string };
  /** question about one thing; options are the category labels. Omitted when "which" is the only sensible form */
  what?: (t: Thing) => { ro: string; en: string };
  cats: Cat[];
  /** Things that belong to none of the categories (always false statements / wrong options) */
  extras?: Thing[];
}

const T = (ro: string, d: string, en: string, emoji?: string): Thing => ({ ro, d, en, ...(emoji ? { emoji } : {}) });

/* ---------------- animal groups ---------------- */

const MAMIFERE: Thing[] = [
  T('câine', 'câinele', 'dog', '🐕'), T('pisică', 'pisica', 'cat', '🐈'), T('vacă', 'vaca', 'cow', '🐄'),
  T('cal', 'calul', 'horse', '🐎'), T('oaie', 'oaia', 'sheep', '🐑'), T('porc', 'porcul', 'pig', '🐖'),
  T('iepure', 'iepurele', 'rabbit', '🐇'), T('urs', 'ursul', 'bear', '🐻'), T('elefant', 'elefantul', 'elephant', '🐘'),
  T('balenă', 'balena', 'whale', '🐋'), T('delfin', 'delfinul', 'dolphin', '🐬'), T('liliac', 'liliacul', 'bat', '🦇'),
  T('maimuță', 'maimuța', 'monkey', '🐒'), T('veveriță', 'veverița', 'squirrel', '🐿️'), T('girafă', 'girafa', 'giraffe', '🦒'),
  T('leu', 'leul', 'lion', '🦁'), T('lup', 'lupul', 'wolf', '🐺'), T('cerb', 'cerbul', 'deer', '🦌'),
];
const PASARI: Thing[] = [
  T('găină', 'găina', 'hen', '🐔'), T('rață', 'rața', 'duck', '🦆'), T('acvilă', 'acvila', 'eagle', '🦅'),
  T('bufniță', 'bufnița', 'owl', '🦉'), T('pinguin', 'pinguinul', 'penguin', '🐧'), T('lebădă', 'lebăda', 'swan', '🦢'),
  T('porumbel', 'porumbelul', 'pigeon', '🕊️'), T('papagal', 'papagalul', 'parrot', '🦜'), T('curcan', 'curcanul', 'turkey', '🦃'),
  T('flamingo', 'flamingo', 'flamingo', '🦩'),
];
const PESTI: Thing[] = [
  T('crap', 'crapul', 'carp', '🐟'), T('pește-clovn', 'peștele-clovn', 'clownfish', '🐠'),
  T('rechin', 'rechinul', 'shark', '🦈'), T('pește-balon', 'peștele-balon', 'pufferfish', '🐡'),
];
const REPTILE: Thing[] = [
  T('șarpe', 'șarpele', 'snake', '🐍'), T('țestoasă', 'țestoasa', 'turtle', '🐢'),
  T('șopârlă', 'șopârla', 'lizard', '🦎'), T('crocodil', 'crocodilul', 'crocodile', '🐊'),
];
const AMFIBIENI: Thing[] = [
  T('broască', 'broasca', 'frog', '🐸'), T('triton', 'tritonul', 'newt'), T('salamandră', 'salamandra', 'salamander'),
];
const INSECTE: Thing[] = [
  T('albină', 'albina', 'bee', '🐝'), T('fluture', 'fluturele', 'butterfly', '🦋'), T('furnică', 'furnica', 'ant', '🐜'),
  T('buburuză', 'buburuza', 'ladybird', '🐞'), T('greier', 'greierele', 'cricket', '🦗'), T('muscă', 'musca', 'fly', '🪰'),
  T('țânțar', 'țânțarul', 'mosquito', '🦟'),
];
/** Invertebrates that are NOT insects (spider, snail ... are never insects) */
const OTHER_INVERTEBRATES: Thing[] = [
  T('păianjen', 'păianjenul', 'spider', '🕷️'), T('melc', 'melcul', 'snail', '🐌'), T('râmă', 'râma', 'earthworm', '🪱'),
  T('crab', 'crabul', 'crab', '🦀'), T('caracatiță', 'caracatița', 'octopus', '🐙'), T('scorpion', 'scorpionul', 'scorpion', '🦂'),
];

const cat = (id: string, ro: string, en: string, pro: string, pen: string, things: Thing[]): Cat => ({
  id, label: { ro, en }, pred: { ro: pro, en: pen }, things,
});

const ANIMAL_GROUP: ClassSet = {
  id: 'animal-group',
  qSort: { ro: 'Pune fiecare animal în grupa lui.', en: 'Put each animal in its group.' },
  what: (t) => ({ ro: `În ce grupă de animale intră ${t.d}?`, en: `Which animal group does the ${t.en} belong to?` }),
  cats: [
    cat('mamifere', 'mamifere', 'mammals', 'este un mamifer', 'is a mammal', MAMIFERE),
    cat('pasari', 'păsări', 'birds', 'este o pasăre', 'is a bird', PASARI),
    cat('pesti', 'pești', 'fish', 'este un pește', 'is a fish', PESTI),
    cat('reptile', 'reptile', 'reptiles', 'este o reptilă', 'is a reptile', REPTILE),
    cat('amfibieni', 'amfibieni', 'amphibians', 'este un amfibian', 'is an amphibian', AMFIBIENI),
    cat('insecte', 'insecte', 'insects', 'este o insectă', 'is an insect', INSECTE),
  ],
  extras: OTHER_INVERTEBRATES,
};

const VERTEBRATE: ClassSet = {
  id: 'vertebrate',
  qSort: { ro: 'Vertebrat (cu coloană vertebrală) sau nevertebrat?', en: 'Vertebrate (has a backbone) or invertebrate?' },
  what: (t) => ({ ro: `Ce fel de animal este ${t.d}?`, en: `What kind of animal is the ${t.en}?` }),
  cats: [
    cat('vertebrate', 'vertebrat', 'vertebrate', 'este vertebrat', 'is a vertebrate', [
      ...MAMIFERE, ...PASARI, ...PESTI, ...REPTILE, ...AMFIBIENI,
    ]),
    cat('nevertebrate', 'nevertebrat', 'invertebrate', 'este nevertebrat', 'is an invertebrate', [
      ...INSECTE, ...OTHER_INVERTEBRATES,
    ]),
  ],
};

/* ---------------- other classification sets ---------------- */

const LIVING: ClassSet = {
  id: 'living',
  qSort: { ro: 'Ființe vii sau lucruri care nu sunt vii?', en: 'Living things or non-living things?' },
  what: (t) => ({ ro: `Ce este ${t.d}?`, en: `What is the ${t.en}?` }),
  cats: [
    cat('viu', 'o ființă vie', 'a living thing', 'este o ființă vie', 'is a living thing', [
      T('copac', 'copacul', 'tree', '🌳'), T('floare', 'floarea', 'flower', '🌷'), T('câine', 'câinele', 'dog', '🐕'),
      T('pește', 'peștele', 'fish', '🐟'), T('iarbă', 'iarba', 'grass', '🌱'), T('albină', 'albina', 'bee', '🐝'),
      T('pasăre', 'pasărea', 'bird', '🐦'),
    ]),
    cat('neviu', 'un lucru care nu e viu', 'a non-living thing', 'nu este o ființă vie', 'is not a living thing', [
      T('piatră', 'piatra', 'stone', '🪨'), T('minge', 'mingea', 'ball', '⚽'), T('mașină', 'mașina', 'car', '🚗'),
      T('carte', 'cartea', 'book', '📖'), T('apă', 'apa', 'water', '💧'), T('nor', 'norul', 'cloud', '☁️'),
      T('scaun', 'scaunul', 'chair', '🪑'), T('creion', 'creionul', 'pencil', '✏️'),
    ]),
  ],
};

const DIET: ClassSet = {
  id: 'diet',
  qSort: { ro: 'Ce mănâncă fiecare animal?', en: 'What does each animal eat?' },
  what: (t) => ({ ro: `Ce mănâncă ${t.d}?`, en: `What does the ${t.en} eat?` }),
  cats: [
    cat('erbivor', 'doar plante', 'only plants', 'mănâncă doar plante', 'eats only plants', [
      T('vacă', 'vaca', 'cow', '🐄'), T('iepure', 'iepurele', 'rabbit', '🐇'), T('cal', 'calul', 'horse', '🐎'),
      T('oaie', 'oaia', 'sheep', '🐑'), T('elefant', 'elefantul', 'elephant', '🐘'), T('girafă', 'girafa', 'giraffe', '🦒'),
      T('cerb', 'cerbul', 'deer', '🦌'),
    ]),
    cat('carnivor', 'în special carne', 'mostly meat', 'mănâncă în special carne', 'eats mostly meat', [
      T('leu', 'leul', 'lion', '🦁'), T('lup', 'lupul', 'wolf', '🐺'), T('tigru', 'tigrul', 'tiger', '🐅'),
      T('pisică', 'pisica', 'cat', '🐈'), T('rechin', 'rechinul', 'shark', '🦈'), T('crocodil', 'crocodilul', 'crocodile', '🐊'),
      T('acvilă', 'acvila', 'eagle', '🦅'),
    ]),
    cat('omnivor', 'și plante, și carne', 'both plants and meat', 'mănâncă și plante, și carne', 'eats both plants and meat', [
      T('urs', 'ursul', 'bear', '🐻'), T('porc', 'porcul', 'pig', '🐖'), T('mistreț', 'mistrețul', 'wild boar', '🐗'),
    ]),
  ],
};

const MATTER: ClassSet = {
  id: 'matter-state',
  qSort: { ro: 'Solid, lichid sau gaz?', en: 'Solid, liquid or gas?' },
  what: (t) => ({ ro: `În ce stare se află ${t.d}?`, en: `What state is the ${t.en} in?` }),
  cats: [
    cat('solid', 'solidă', 'solid', 'se află în stare solidă', 'is a solid', [
      T('piatră', 'piatra', 'stone', '🪨'), T('gheață', 'gheața', 'ice', '🧊'), T('carte', 'cartea', 'book', '📖'),
      T('scaun', 'scaunul', 'chair', '🪑'), T('bucată de lemn', 'bucata de lemn', 'piece of wood', '🪵'),
      T('cheie', 'cheia', 'key', '🔑'), T('creion', 'creionul', 'pencil', '✏️'),
    ]),
    cat('lichid', 'lichidă', 'liquid', 'se află în stare lichidă', 'is a liquid', [
      T('apă', 'apa', 'water', '💧'), T('lapte', 'laptele', 'milk', '🥛'), T('suc', 'sucul', 'juice', '🧃'),
      T('ulei', 'uleiul', 'oil'), T('ceai', 'ceaiul', 'tea', '🍵'),
    ]),
    cat('gaz', 'gazoasă', 'gas', 'se află în stare gazoasă', 'is a gas', [
      T('aer', 'aerul', 'air', '💨'), T('oxigen', 'oxigenul', 'oxygen'), T('heliu din balon', 'heliul din balon', 'helium in a balloon', '🎈'),
      T('dioxid de carbon', 'dioxidul de carbon', 'carbon dioxide'),
    ]),
  ],
};

const HABITAT: ClassSet = {
  id: 'habitat',
  qSort: { ro: 'Unde trăiește fiecare animal?', en: 'Where does each animal live?' },
  what: (t) => ({ ro: `Unde trăiește ${t.d}?`, en: `Where does the ${t.en} live?` }),
  cats: [
    cat('padure', 'în pădure', 'in the forest', 'trăiește în pădure', 'lives in the forest', [
      T('urs', 'ursul', 'bear', '🐻'), T('cerb', 'cerbul', 'deer', '🦌'), T('veveriță', 'veverița', 'squirrel', '🐿️'),
      T('mistreț', 'mistrețul', 'wild boar', '🐗'), T('lup', 'lupul', 'wolf', '🐺'),
    ]),
    cat('apa', 'în apă', 'in water', 'trăiește în apă', 'lives in water', [
      T('crap', 'crapul', 'carp', '🐟'), T('delfin', 'delfinul', 'dolphin', '🐬'), T('rechin', 'rechinul', 'shark', '🦈'),
      T('caracatiță', 'caracatița', 'octopus', '🐙'), T('pește-clovn', 'peștele-clovn', 'clownfish', '🐠'),
      T('balenă', 'balena', 'whale', '🐋'),
    ]),
    cat('desert', 'în deșert', 'in the desert', 'trăiește în deșert', 'lives in the desert', [
      T('cămilă', 'cămila', 'camel', '🐫'), T('dromader', 'dromaderul', 'dromedary', '🐪'),
      T('vulpe fennec', 'vulpea fennec', 'fennec fox', '🦊'),
    ]),
  ],
};

const MAGNET: ClassSet = {
  id: 'magnet',
  qSort: { ro: 'Atras de magnet sau nu?', en: 'Attracted by a magnet or not?' },
  cats: [
    cat('atras', 'atras de magnet', 'attracted', 'este atras de magnet', 'is attracted by a magnet', [
      T('cui de fier', 'cuiul de fier', 'iron nail', '🔩'), T('agrafă de oțel', 'agrafa de oțel', 'steel paper clip', '📎'),
      T('lanț de fier', 'lanțul de fier', 'iron chain', '⛓️'), T('șurub de oțel', 'șurubul de oțel', 'steel screw'),
    ]),
    cat('neatras', 'nu este atras', 'not attracted', 'nu este atras de magnet', 'is not attracted by a magnet', [
      T('bucată de lemn', 'bucata de lemn', 'piece of wood', '🪵'), T('foaie de hârtie', 'foaia de hârtie', 'sheet of paper', '📄'),
      T('jucărie de plastic', 'jucăria de plastic', 'plastic toy', '🧸'), T('pahar de sticlă', 'paharul de sticlă', 'glass cup', '🥛'),
      T('folie de aluminiu', 'folia de aluminiu', 'aluminium foil'), T('fir de cupru', 'firul de cupru', 'copper wire'),
    ]),
  ],
};

const FLOAT: ClassSet = {
  id: 'float',
  qSort: { ro: 'Plutește sau se scufundă?', en: 'Does it float or sink?' },
  what: (t) => ({ ro: `Ce se întâmplă cu ${t.d} pus în apă?`, en: `What happens to the ${t.en} when it is put in water?` }),
  cats: [
    cat('pluteste', 'plutește', 'floats', 'plutește pe apă', 'floats on water', [
      T('bucată de lemn', 'bucata de lemn', 'piece of wood', '🪵'), T('frunză', 'frunza', 'leaf', '🍃'),
      T('pană', 'pana', 'feather', '🪶'), T('dop de plută', 'dopul de plută', 'cork'),
    ]),
    cat('scufunda', 'se scufundă', 'sinks', 'se scufundă în apă', 'sinks in water', [
      T('piatră', 'piatra', 'stone', '🪨'), T('monedă', 'moneda', 'coin', '🪙'), T('cui de fier', 'cuiul de fier', 'iron nail', '🔩'),
      T('cheie', 'cheia', 'key', '🔑'),
    ]),
  ],
};

const LIGHT: ClassSet = {
  id: 'light-source',
  qSort: { ro: 'Produce lumină proprie sau nu?', en: 'Does it make its own light?' },
  cats: [
    cat('sursa', 'produce lumină', 'makes light', 'produce lumină proprie', 'makes its own light', [
      T('Soare', 'Soarele', 'Sun', '☀️'), T('bec aprins', 'becul aprins', 'lit bulb', '💡'),
      T('lumânare aprinsă', 'lumânarea aprinsă', 'lit candle', '🕯️'), T('lanternă aprinsă', 'lanterna aprinsă', 'lit torch', '🔦'),
    ]),
    cat('nu', 'nu produce lumină', 'does not make light', 'nu produce lumină proprie', 'does not make its own light', [
      T('Lună', 'Luna', 'Moon', '🌙'), T('oglindă', 'oglinda', 'mirror', '🪞'), T('carte', 'cartea', 'book', '📖'),
      T('piatră', 'piatra', 'stone', '🪨'), T('pisică', 'pisica', 'cat', '🐈'),
    ]),
  ],
};

const TRANSPARENCY: ClassSet = {
  id: 'transparency',
  qSort: { ro: 'Lasă lumina să treacă sau nu?', en: 'Does light pass through it or not?' },
  cats: [
    cat('transparent', 'lasă lumina să treacă', 'light passes through', 'lasă lumina să treacă', 'lets light pass through', [
      T('geam curat', 'geamul curat', 'clean window pane', '🪟'), T('apă curată într-un pahar', 'apa curată dintr-un pahar', 'clean water in a glass', '💧'),
      T('folie transparentă', 'folia transparentă', 'clear plastic film'),
    ]),
    cat('opac', 'nu lasă lumina să treacă', 'light does not pass through', 'nu lasă lumina să treacă', 'does not let light pass through', [
      T('bucată de lemn', 'bucata de lemn', 'piece of wood', '🪵'), T('cărămidă', 'cărămida', 'brick', '🧱'),
      T('carton', 'cartonul', 'cardboard', '📦'), T('piatră', 'piatra', 'stone', '🪨'),
    ]),
  ],
};

const WASTE: ClassSet = {
  id: 'waste',
  qSort: { ro: 'În ce container aruncăm fiecare lucru?', en: 'Which bin does each item go in?' },
  what: (t) => ({ ro: `În ce container aruncăm ${t.d}?`, en: `Which bin does the ${t.en} go in?` }),
  cats: [
    cat('hartie', 'hârtie', 'paper', 'se aruncă în containerul pentru hârtie', 'goes in the paper bin', [
      T('ziar', 'ziarul', 'newspaper', '📰'), T('cutie de carton', 'cutia de carton', 'cardboard box', '📦'),
      T('caiet vechi', 'caietul vechi', 'old notebook', '📓'),
    ]),
    cat('plastic', 'plastic și metal', 'plastic and metal', 'se aruncă în containerul pentru plastic și metal', 'goes in the plastic and metal bin', [
      T('sticlă de apă din plastic', 'sticla de apă din plastic', 'plastic water bottle', '🧴'),
      T('doză de suc', 'doza de suc', 'drinks can', '🥫'), T('conservă goală', 'conserva goală', 'empty tin can', '🥫'),
    ]),
    cat('sticla', 'sticlă', 'glass', 'se aruncă în containerul pentru sticlă', 'goes in the glass bin', [
      T('borcan de sticlă', 'borcanul de sticlă', 'glass jar', '🫙'), T('sticlă de suc (din sticlă)', 'sticla de suc (din sticlă)', 'glass juice bottle', '🍾'),
    ]),
    cat('bio', 'resturi vegetale', 'plant waste', 'se aruncă în containerul pentru resturi vegetale', 'goes in the plant waste bin', [
      T('coajă de banană', 'coaja de banană', 'banana peel', '🍌'), T('frunze uscate', 'frunzele uscate', 'dry leaves', '🍂'),
      T('cotor de măr', 'cotorul de măr', 'apple core', '🍎'),
    ]),
  ],
};

/* ---------------- sets for the youngest levels (grades 0-II, MEM strand "explorarea mediului") ---------------- */
/* Singular nouns only, so that the generated true/false sentences ("{d} {pred}") stay grammatical. */

const PLANT_ANIMAL: ClassSet = {
  id: 'plant-animal',
  qSort: { ro: 'Plantă sau animal?', en: 'Plant or animal?' },
  what: (t) => ({ ro: `Ce este ${t.d}?`, en: `What is the ${t.en}?` }),
  cats: [
    cat('planta', 'o plantă', 'a plant', 'este o plantă', 'is a plant', [
      T('copac', 'copacul', 'tree', '🌳'), T('floare', 'floarea', 'flower', '🌷'), T('iarbă', 'iarba', 'grass', '🌱'),
      T('trandafir', 'trandafirul', 'rose', '🌹'), T('cactus', 'cactusul', 'cactus', '🌵'), T('brad', 'bradul', 'fir tree', '🌲'),
    ]),
    cat('animal', 'un animal', 'an animal', 'este un animal', 'is an animal', [
      T('câine', 'câinele', 'dog', '🐕'), T('pisică', 'pisica', 'cat', '🐈'), T('pasăre', 'pasărea', 'bird', '🐦'),
      T('pește', 'peștele', 'fish', '🐟'), T('fluture', 'fluturele', 'butterfly', '🦋'), T('albină', 'albina', 'bee', '🐝'),
      T('vacă', 'vaca', 'cow', '🐄'), T('broască', 'broasca', 'frog', '🐸'),
    ]),
  ],
};

const SEASON: ClassSet = {
  id: 'season',
  qSort: { ro: 'Ce se potrivește cu fiecare anotimp?', en: 'What goes with each season?' },
  what: (t) => ({ ro: `Cu ce anotimp se potrivește ${t.d}?`, en: `Which season does the ${t.en} go with?` }),
  cats: [
    cat('primavara', 'primăvara', 'spring', 'se potrivește cu primăvara', 'goes with spring', [
      T('pom înflorit', 'pomul înflorit', 'blossoming tree', '🌸'), T('lalea', 'laleaua', 'tulip', '🌷'), T('ghiocel', 'ghiocelul', 'snowdrop', '🌼'),
    ]),
    cat('vara', 'vara', 'summer', 'se potrivește cu vara', 'goes with summer', [
      T('plajă', 'plaja', 'beach', '🏖️'), T('pepene roșu', 'pepenele roșu', 'watermelon', '🍉'), T('înot în mare', 'înotul în mare', 'swimming in the sea', '🏊'),
    ]),
    cat('toamna', 'toamna', 'autumn', 'se potrivește cu toamna', 'goes with autumn', [
      T('frunză galbenă', 'frunza galbenă', 'yellow leaf', '🍂'), T('ciorchine de struguri', 'ciorchinele de struguri', 'bunch of grapes', '🍇'),
      T('dovleac', 'dovleacul', 'pumpkin', '🎃'), T('început de școală', 'începutul de școală', 'start of school', '🎒'),
    ]),
    cat('iarna', 'iarna', 'winter', 'se potrivește cu iarna', 'goes with winter', [
      T('om de zăpadă', 'omul de zăpadă', 'snowman', '⛄'), T('sanie', 'sania', 'sledge', '🛷'),
      T('fulg de zăpadă', 'fulgul de zăpadă', 'snowflake', '❄️'), T('brad de Crăciun', 'bradul de Crăciun', 'Christmas tree', '🎄'),
    ]),
  ],
};

const DAY_NIGHT: ClassSet = {
  id: 'day-night',
  qSort: { ro: 'Zi sau noapte?', en: 'Day or night?' },
  what: (t) => ({ ro: `Cu ce se potrivește ${t.d}?`, en: `Does the ${t.en} go with the day or the night?` }),
  cats: [
    cat('zi', 'ziua', 'day', 'se potrivește cu ziua', 'goes with the day', [
      T('Soare', 'Soarele', 'Sun', '☀️'), T('joacă în parc', 'joaca în parc', 'playing in the park', '🛝'),
      T('curcubeu', 'curcubeul', 'rainbow', '🌈'), T('mic dejun', 'micul dejun', 'breakfast', '🥞'),
    ]),
    cat('noapte', 'noaptea', 'night', 'se potrivește cu noaptea', 'goes with the night', [
      T('Lună', 'Luna', 'Moon', '🌙'), T('stea', 'steaua', 'star', '⭐'), T('somn', 'somnul', 'sleep', '😴'), T('bufniță', 'bufnița', 'owl', '🦉'),
    ]),
  ],
};

const WEATHER_WEAR: ClassSet = {
  id: 'weather-wear',
  qSort: { ro: 'Ce ne trebuie în fiecare fel de vreme?', en: 'What do we need in each kind of weather?' },
  what: (t) => ({ ro: `Când ne trebuie ${t.d}?`, en: `When do we need the ${t.en}?` }),
  cats: [
    cat('ploaie', 'când plouă', 'when it rains', 'ne trebuie când plouă', 'is for rainy weather', [
      T('umbrelă', 'umbrela', 'umbrella', '☂️'), T('cizme de cauciuc', 'cizmele de cauciuc', 'rubber boots', '👢'), T('pelerină de ploaie', 'pelerina de ploaie', 'raincoat'),
    ]),
    cat('soare', 'când e soare și cald', 'when it is sunny and hot', 'ne trebuie când e soare și cald', 'is for sunny, hot weather', [
      T('pălărie de soare', 'pălăria de soare', 'sun hat', '👒'), T('ochelari de soare', 'ochelarii de soare', 'sunglasses', '🕶️'),
      T('cremă de soare', 'crema de soare', 'sun cream', '🧴'), T('sandale', 'sandalele', 'sandals', '🩴'),
    ]),
    cat('frig', 'când e frig', 'when it is cold', 'ne trebuie când e frig', 'is for cold weather', [
      T('fular', 'fularul', 'scarf', '🧣'), T('mănuși groase', 'mănușile groase', 'thick gloves', '🧤'),
      T('geacă groasă', 'geaca groasă', 'warm coat', '🧥'), T('căciulă', 'căciula', 'woolly hat'),
    ]),
  ],
};

const PLANT_EATEN: ClassSet = {
  id: 'plant-eaten',
  qSort: { ro: 'Ce parte a plantei mâncăm?', en: 'Which part of the plant do we eat?' },
  what: (t) => ({ ro: `Ce parte a plantei mâncăm când mâncăm ${t.d}?`, en: `Which part of a plant do we eat when we eat the ${t.en}?` }),
  cats: [
    cat('radacina', 'rădăcina', 'the root', 'este rădăcina unei plante', 'is the root of a plant', [
      T('morcov', 'morcovul', 'carrot', '🥕'), T('ridiche', 'ridichea', 'radish'), T('sfeclă roșie', 'sfecla roșie', 'beetroot'),
    ]),
    cat('frunza', 'frunza', 'the leaf', 'este frunza unei plante', 'is the leaf of a plant', [
      T('salată verde', 'salata verde', 'lettuce', '🥬'), T('spanac', 'spanacul', 'spinach'), T('pătrunjel', 'pătrunjelul', 'parsley', '🌿'),
    ]),
    cat('fructul', 'fructul', 'the fruit', 'este fructul unei plante', 'is the fruit of a plant', [
      T('măr', 'mărul', 'apple', '🍎'), T('pară', 'para', 'pear', '🍐'), T('cireașă', 'cireașa', 'cherry', '🍒'),
      T('banană', 'banana', 'banana', '🍌'), T('portocală', 'portocala', 'orange', '🍊'),
    ]),
  ],
};

const DOMESTIC_WILD: ClassSet = {
  id: 'domestic-wild',
  qSort: { ro: 'Animal domestic sau animal sălbatic?', en: 'Farm/pet animal or wild animal?' },
  what: (t) => ({ ro: `Cum este ${t.d}?`, en: `What kind of animal is the ${t.en}?` }),
  cats: [
    cat('domestic', 'un animal domestic', 'a domestic animal', 'este un animal domestic', 'is a domestic animal', [
      T('câine', 'câinele', 'dog', '🐕'), T('pisică', 'pisica', 'cat', '🐈'), T('vacă', 'vaca', 'cow', '🐄'), T('oaie', 'oaia', 'sheep', '🐑'),
      T('găină', 'găina', 'hen', '🐔'), T('cal', 'calul', 'horse', '🐎'), T('porc', 'porcul', 'pig', '🐖'), T('rață', 'rața', 'duck', '🦆'),
    ]),
    cat('salbatic', 'un animal sălbatic', 'a wild animal', 'este un animal sălbatic', 'is a wild animal', [
      T('lup', 'lupul', 'wolf', '🐺'), T('urs', 'ursul', 'bear', '🐻'), T('leu', 'leul', 'lion', '🦁'), T('cerb', 'cerbul', 'deer', '🦌'),
      T('vulpe', 'vulpea', 'fox', '🦊'), T('elefant', 'elefantul', 'elephant', '🐘'), T('girafă', 'girafa', 'giraffe', '🦒'), T('tigru', 'tigrul', 'tiger', '🐅'),
    ]),
  ],
};

const HEALTHY_FOOD: ClassSet = {
  id: 'healthy-food',
  qSort: { ro: 'Hrană sănătoasă sau de mâncat rar?', en: 'Healthy food or an occasional treat?' },
  what: (t) => ({ ro: `Cum este ${t.d} pentru corp?`, en: `How is the ${t.en} for the body?` }),
  cats: [
    cat('sanatos', 'hrană sănătoasă', 'healthy food', 'este hrană sănătoasă', 'is healthy food', [
      T('măr', 'mărul', 'apple', '🍎'), T('morcov', 'morcovul', 'carrot', '🥕'), T('banană', 'banana', 'banana', '🍌'),
      T('ou', 'oul', 'egg', '🥚'), T('lapte', 'laptele', 'milk', '🥛'), T('broccoli', 'broccoli', 'broccoli', '🥦'),
    ]),
    cat('rar', 'de mâncat rar', 'an occasional treat', 'este de mâncat rar', 'is an occasional treat', [
      T('bomboană', 'bomboana', 'sweet', '🍬'), T('ciocolată', 'ciocolata', 'chocolate bar', '🍫'), T('prăjitură', 'prăjitura', 'cake', '🍰'),
      T('acadea', 'acadeaua', 'lollipop', '🍭'), T('înghețată', 'înghețata', 'ice cream', '🍦'), T('cartofi prăjiți', 'cartofii prăjiți', 'chips', '🍟'),
    ]),
  ],
};

const MATERIAL: ClassSet = {
  id: 'material',
  qSort: { ro: 'Din ce material este făcut fiecare lucru?', en: 'What material is each thing made of?' },
  what: (t) => ({ ro: `Din ce material este făcut ${t.d}?`, en: `What is the ${t.en} made of?` }),
  cats: [
    cat('lemn', 'lemn', 'wood', 'este făcut din lemn', 'is made of wood', [
      T('butuc de lemn', 'butucul de lemn', 'wooden log', '🪵'), T('lingură de lemn', 'lingura de lemn', 'wooden spoon'),
      T('cub de lemn', 'cubul de lemn', 'wooden block'), T('jucărie de lemn', 'jucăria de lemn', 'wooden toy'),
    ]),
    cat('metal', 'metal', 'metal', 'este făcut din metal', 'is made of metal', [
      T('cheie de metal', 'cheia de metal', 'metal key', '🔑'), T('monedă de metal', 'moneda de metal', 'metal coin', '🪙'),
      T('cui de metal', 'cuiul de metal', 'metal nail', '🔩'), T('lingură de metal', 'lingura de metal', 'metal spoon', '🥄'),
    ]),
    cat('plastic', 'plastic', 'plastic', 'este făcut din plastic', 'is made of plastic', [
      T('găleată de plastic', 'găleata de plastic', 'plastic bucket', '🪣'), T('sticlă de plastic', 'sticla de plastic', 'plastic bottle', '🧴'),
      T('pieptene de plastic', 'pieptenele de plastic', 'plastic comb'), T('jucărie de plastic', 'jucăria de plastic', 'plastic toy'),
    ]),
    cat('sticla', 'sticlă', 'glass', 'este făcut din sticlă', 'is made of glass', [
      T('pahar de sticlă', 'paharul de sticlă', 'glass cup', '🥛'), T('geam de sticlă', 'geamul de sticlă', 'glass window pane', '🪟'),
      T('borcan de sticlă', 'borcanul de sticlă', 'glass jar', '🫙'), T('vază de sticlă', 'vaza de sticlă', 'glass vase'),
    ]),
  ],
};

const WATER_FORM: ClassSet = {
  id: 'water-form',
  qSort: { ro: 'Apă lichidă sau apă înghețată?', en: 'Liquid water or frozen water?' },
  what: (t) => ({ ro: `Cum este apa din ${t.d}?`, en: `What is the water like in the ${t.en}?` }),
  cats: [
    cat('lichida', 'lichidă', 'liquid', 'este apă lichidă', 'is liquid water', [
      T('ploaie', 'ploaia', 'rain', '🌧️'), T('râu', 'râul', 'river', '🏞️'), T('mare', 'marea', 'sea', '🌊'),
      T('lac', 'lacul', 'lake'), T('picătură de apă', 'picătura de apă', 'drop of water', '💧'),
    ]),
    cat('inghetata', 'înghețată', 'frozen', 'este apă înghețată', 'is frozen water', [
      T('gheață', 'gheața', 'ice', '🧊'), T('zăpadă', 'zăpada', 'snow', '❄️'), T('țurțure', 'țurțurele', 'icicle'), T('grindină', 'grindina', 'hail'),
    ]),
  ],
};

const HABITAT_SIMPLE: ClassSet = {
  id: 'habitat-simple',
  qSort: { ro: 'Unde trăiește fiecare animal?', en: 'Where does each animal live?' },
  what: (t) => ({ ro: `Unde trăiește ${t.d}?`, en: `Where does the ${t.en} live?` }),
  cats: [
    cat('padure', 'în pădure', 'in the forest', 'trăiește în pădure', 'lives in the forest', [
      T('urs', 'ursul', 'bear', '🐻'), T('cerb', 'cerbul', 'deer', '🦌'), T('veveriță', 'veverița', 'squirrel', '🐿️'), T('lup', 'lupul', 'wolf', '🐺'),
    ]),
    cat('apa', 'în apă', 'in water', 'trăiește în apă', 'lives in water', [
      T('crap', 'crapul', 'carp', '🐟'), T('delfin', 'delfinul', 'dolphin', '🐬'), T('rechin', 'rechinul', 'shark', '🦈'), T('caracatiță', 'caracatița', 'octopus', '🐙'),
    ]),
    cat('ferma', 'la fermă', 'on the farm', 'trăiește la fermă', 'lives on the farm', [
      T('vacă', 'vaca', 'cow', '🐄'), T('oaie', 'oaia', 'sheep', '🐑'), T('găină', 'găina', 'hen', '🐔'), T('porc', 'porcul', 'pig', '🐖'), T('cal', 'calul', 'horse', '🐎'),
    ]),
  ],
};

const PUSH_PULL: ClassSet = {
  id: 'push-pull',
  qSort: { ro: 'Împingere sau tragere?', en: 'A push or a pull?' },
  what: (t) => ({ ro: `Ce fel de mișcare este ${t.d}?`, en: `What kind of movement is ${t.en}?` }),
  cats: [
    cat('impinge', 'o împingere', 'a push', 'este o împingere', 'is a push', [
      T('a lovi mingea cu piciorul', 'lovirea mingii cu piciorul', 'kicking a ball', '⚽'), T('a închide un sertar', 'închiderea unui sertar', 'closing a drawer'),
      T('a apăsa un buton', 'apăsarea unui buton', 'pressing a button', '🔘'), T('a da drumul unei mașinuțe de jucărie', 'darea drumului unei mașinuțe de jucărie', 'sending a toy car off', '🚗'),
    ]),
    cat('trage', 'o tragere', 'a pull', 'este o tragere', 'is a pull', [
      T('a duce sania după noi cu o sfoară', 'ducerea saniei după noi cu o sfoară', 'pulling a sledge with a rope', '🛷'),
      T('a deschide un sertar', 'deschiderea unui sertar', 'opening a drawer'),
      T('a scoate găleata din fântână cu o sfoară', 'scoaterea găleții din fântână cu o sfoară', 'hauling a bucket up a well with a rope', '🪣'),
      T('a trage de capătul unei sfori', 'tragerea de capătul unei sfori', 'tugging the end of a rope', '🪢'),
    ]),
  ],
};

const SHADOW: ClassSet = {
  id: 'shadow',
  qSort: { ro: 'Face umbră sau nu?', en: 'Does it make a shadow?' },
  cats: [
    cat('umbra', 'face umbră', 'makes a shadow', 'face umbră', 'makes a shadow', [
      T('copac', 'copacul', 'tree', '🌳'), T('om', 'omul', 'person', '🧍'), T('cărămidă', 'cărămida', 'brick', '🧱'),
      T('carton', 'cartonul', 'cardboard', '📦'), T('umbrelă', 'umbrela', 'umbrella', '☂️'),
    ]),
    cat('nu', 'nu face umbră', 'makes no shadow', 'nu face umbră', 'makes no shadow', [
      T('geam curat', 'geamul curat', 'clean window pane', '🪟'), T('apă curată într-un pahar', 'apa curată dintr-un pahar', 'clean water in a glass', '💧'),
      T('folie transparentă', 'folia transparentă', 'clear plastic film'),
    ]),
  ],
};

const PLANT_NEEDS: ClassSet = {
  id: 'plant-needs',
  qSort: { ro: 'De ce are nevoie o plantă ca să crească?', en: 'What does a plant need to grow?' },
  cats: [
    cat('trebuie', 'are nevoie de el', 'it needs this', 'ajută o plantă să crească', 'helps a plant grow', [
      T('apă', 'apa', 'water', '💧'), T('lumină', 'lumina Soarelui', 'sunlight', '☀️'), T('aer', 'aerul', 'air', '💨'), T('pământ bun', 'pământul bun', 'good soil', '🌱'),
    ]),
    cat('nu', 'nu are nevoie de el', 'it does not need this', 'nu ajută o plantă să crească', 'does not help a plant grow', [
      T('bomboană', 'bomboana', 'sweet', '🍬'), T('televizor', 'televizorul', 'television', '📺'),
      T('ciocolată', 'ciocolata', 'chocolate bar', '🍫'), T('mașinuță de jucărie', 'mașinuța de jucărie', 'toy car', '🚗'),
    ]),
  ],
};

const ECO_ACTIONS: ClassSet = {
  id: 'eco-actions',
  qSort: { ro: 'Ajută natura sau o strică?', en: 'Does it help nature or harm it?' },
  what: (t) => ({ ro: `Ce face pentru natură: ${t.ro}?`, en: `What does it do for nature: ${t.en}?` }),
  cats: [
    cat('bine', 'ajută natura', 'helps nature', 'ajută natura', 'helps nature', [
      T('a închide robinetul', 'închiderea robinetului', 'turning off the tap', '🚰'), T('a arunca gunoiul la coș', 'aruncarea gunoiului la coș', 'putting rubbish in the bin', '🗑️'),
      T('a planta un pom', 'plantarea unui pom', 'planting a tree', '🌳'), T('a duce hârtia la reciclat', 'ducerea hârtiei la reciclat', 'taking paper to be recycled', '♻️'),
      T('a stinge lumina când ieșim din cameră', 'stingerea luminii când ieșim din cameră', 'switching off the light when leaving a room', '💡'),
    ]),
    cat('rau', 'strică natura', 'harms nature', 'strică natura', 'harms nature', [
      T('a arunca hârtii pe jos', 'aruncarea hârtiilor pe jos', 'dropping paper on the ground'), T('a lăsa apa să curgă degeaba', 'lăsarea apei să curgă degeaba', 'letting water run for nothing'),
      T('a rupe florile din parc', 'ruperea florilor din parc', 'picking the flowers in the park'), T('a lăsa un foc aprins în pădure', 'lăsarea unui foc aprins în pădure', 'leaving a fire burning in the forest'),
      T('a lăsa lumina aprinsă degeaba', 'lăsarea luminii aprinse degeaba', 'leaving the light on for nothing'),
    ]),
  ],
};

export const CLASS_SETS: Record<string, ClassSet> = Object.fromEntries(
  [
    ANIMAL_GROUP, VERTEBRATE, LIVING, DIET, MATTER, HABITAT, MAGNET, FLOAT, LIGHT, TRANSPARENCY, WASTE,
    PLANT_ANIMAL, SEASON, DAY_NIGHT, WEATHER_WEAR, PLANT_EATEN, DOMESTIC_WILD, HEALTHY_FOOD, MATERIAL, WATER_FORM,
    HABITAT_SIMPLE, PUSH_PULL, SHADOW, PLANT_NEEDS, ECO_ACTIONS,
  ].map((s) => [s.id, s]),
);


/* ---------------- relations (pairs) ---------------- */

export interface RelPair {
  k: { ro: string; en: string; emoji?: string };
  v: { ro: string; en: string };
  /** extra text (e.g. the base noun) */
  x?: { ro: string; en: string };
}

export interface Relation {
  id: string;
  pairs: RelPair[];
  /** question whose answer is `k` */
  askK: (p: RelPair) => { ro: string; en: string };
  /** question whose answer is `v` */
  askV: (p: RelPair) => { ro: string; en: string };
}

const P = (kr: string, ke: string, vr: string, ve: string, emoji?: string, x?: [string, string]): RelPair => ({
  k: { ro: kr, en: ke, ...(emoji ? { emoji } : {}) }, v: { ro: vr, en: ve }, ...(x ? { x: { ro: x[0], en: x[1] } } : {}),
});

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
export { cap };

export const RELATIONS: Record<string, Relation> = {
  'plant-part': {
    id: 'plant-part',
    pairs: [
      P('rădăcina', 'the root', 'fixează planta în pământ și absoarbe apa', 'holds the plant in the soil and takes in water', '🥕'),
      P('tulpina', 'the stem', 'susține planta și duce apa spre frunze', 'holds the plant up and carries water to the leaves'),
      P('frunza', 'the leaf', 'folosește lumina ca să facă hrana plantei', 'uses light to make food for the plant', '🍃'),
      P('floarea', 'the flower', 'formează fructul cu semințe', 'makes the fruit with seeds', '🌷'),
      P('fructul', 'the fruit', 'ține în el semințele plantei', 'holds the seeds of the plant', '🍎'),
    ],
    askK: (p) => ({ ro: `Care parte a plantei ${p.v.ro}?`, en: `Which part of a plant ${p.v.en}?` }),
    askV: (p) => ({ ro: `Ce face ${p.k.ro}, la o plantă?`, en: `What does ${p.k.en} do in a plant?` }),
  },
  sense: {
    id: 'sense',
    pairs: [
      P('ochii', 'the eyes', 'vedem', 'we see', '👀'),
      P('urechile', 'the ears', 'auzim', 'we hear', '👂'),
      P('nasul', 'the nose', 'mirosim', 'we smell', '👃'),
      P('limba', 'the tongue', 'simțim gustul mâncării', 'we taste food', '👅'),
      P('pielea', 'the skin', 'simțim atingerea', 'we feel touch'),
    ],
    askK: (p) => ({ ro: `Cu ce organ de simț ${p.v.ro}?`, en: `With which sense organ ${p.v.en.replace(/^we /, 'do we ')}?` }),
    askV: (p) => ({ ro: `Ce facem cu ${p.k.ro}?`, en: `What do we do with ${p.k.en}?` }),
  },
  organ: {
    id: 'organ',
    pairs: [
      P('inima', 'the heart', 'pompează sângele în tot corpul', 'pumps blood around the body', '🫀'),
      P('plămânii', 'the lungs', 'ne ajută să respirăm', 'help us breathe', '🫁'),
      P('stomacul', 'the stomach', 'digeră mâncarea', 'digests food'),
      P('creierul', 'the brain', 'comandă corpul și ne ajută să gândim', 'controls the body and helps us think', '🧠'),
      P('oasele', 'the bones', 'dau corpului formă și îl susțin', 'give the body its shape and hold it up', '🦴'),
    ],
    askK: (p) => ({ ro: `Care parte a corpului ${p.v.ro}?`, en: `Which part of the body ${p.v.en}?` }),
    askV: (p) => ({
      ro: p.k.ro === 'plămânii' || p.k.ro === 'oasele' ? `Ce fac ${p.k.ro}?` : `Ce face ${p.k.ro}?`,
      en: `What ${p.k.ro === 'plămânii' || p.k.ro === 'oasele' ? 'do' : 'does'} ${p.k.en} do?`,
    }),
  },
  young: {
    id: 'young',
    pairs: [
      P('oaia', 'sheep', 'mielul', 'lamb', '🐑', ['oaie', 'sheep']),
      P('vaca', 'cow', 'vițelul', 'calf', '🐄', ['vacă', 'cow']),
      P('calul', 'horse', 'mânzul', 'foal', '🐎', ['cal', 'horse']),
      P('capra', 'goat', 'iedul', 'kid', '🐐', ['capră', 'goat']),
      P('porcul', 'pig', 'purcelul', 'piglet', '🐖', ['porc', 'pig']),
      P('pisica', 'cat', 'pisoiul', 'kitten', '🐈', ['pisică', 'cat']),
      P('câinele', 'dog', 'cățelul', 'puppy', '🐕', ['câine', 'dog']),
      P('rața', 'duck', 'bobocul', 'duckling', '🦆', ['rață', 'duck']),
    ],
    askK: (p) => ({ ro: `${cap(p.v.ro)} este puiul cărui animal?`, en: `The ${p.v.en} is the young of which animal?` }),
    askV: (p) => ({ ro: `Cum se numește puiul de ${p.x?.ro}?`, en: `What is a young ${p.x?.en} called?` }),
  },
  'body-easy': {
    id: 'body-easy',
    pairs: [
      P('ochii', 'the eyes', 'vedem', 'we see', '👀'),
      P('urechile', 'the ears', 'auzim', 'we hear', '👂'),
      P('nasul', 'the nose', 'mirosim', 'we smell', '👃'),
      P('limba', 'the tongue', 'simțim gustul', 'we taste', '👅'),
      P('mâinile', 'the hands', 'apucăm lucrurile', 'we pick things up', '🤲'),
      P('picioarele', 'the legs and feet', 'mergem', 'we walk', '🦶'),
    ],
    askK: (p) => ({ ro: `Cu ce ${p.v.ro}?`, en: `What do we use to ${p.v.en.replace(/^we /, '')}?` }),
    askV: (p) => ({ ro: `Ce facem cu ${p.k.ro}?`, en: `What do we do with ${p.k.en}?` }),
  },
  'young-easy': {
    id: 'young-easy',
    pairs: [
      P('oaia', 'sheep', 'mielul', 'lamb', '🐑', ['oaie', 'sheep']),
      P('vaca', 'cow', 'vițelul', 'calf', '🐄', ['vacă', 'cow']),
      P('pisica', 'cat', 'pisoiul', 'kitten', '🐈', ['pisică', 'cat']),
      P('câinele', 'dog', 'cățelul', 'puppy', '🐕', ['câine', 'dog']),
      P('calul', 'horse', 'mânzul', 'foal', '🐎', ['cal', 'horse']),
    ],
    askK: (p) => ({ ro: `${cap(p.v.ro)} este puiul cărui animal?`, en: `The ${p.v.en} is the young of which animal?` }),
    askV: (p) => ({ ro: `Cum se numește puiul de ${p.x?.ro}?`, en: `What is a young ${p.x?.en} called?` }),
  },
  sky: {
    id: 'sky',
    pairs: [
      P('Soarele', 'the Sun', 'dă Pământului lumină și căldură', 'gives the Earth light and warmth', '☀️', ['Soare', 'the Sun']),
      P('Luna', 'the Moon', 'se vede pe cerul nopții și nu are lumină proprie', 'is seen in the night sky and has no light of its own', '🌙', ['Lună', 'the Moon']),
      P('Pământul', 'the Earth', 'este planeta pe care trăim', 'is the planet we live on', '🌍', ['Pământ', 'the Earth']),
      P('norul', 'a cloud', 'poate aduce ploaia', 'can bring the rain', '☁️', ['nor', 'a cloud']),
    ],
    askK: (p) => ({ ro: `Care dintre acestea ${p.v.ro}?`, en: `Which of these ${p.v.en}?` }),
    askV: (p) => ({ ro: `Ce știm despre ${p.x?.ro}?`, en: `What do we know about ${p.x?.en}?` }),
  },
  instrument: {
    id: 'instrument',
    pairs: [
      P('termometrul', 'a thermometer', 'temperatura', 'temperature', '🌡️'),
      P('cântarul', 'scales', 'masa (cât de greu este un lucru)', 'mass (how heavy a thing is)', '⚖️'),
      P('rigla', 'a ruler', 'lungimea', 'length', '📏'),
      P('ceasul', 'a clock', 'timpul', 'time', '⏰'),
      P('cana gradată', 'a measuring jug', 'cantitatea de lichid', 'the amount of liquid'),
    ],
    askK: (p) => ({ ro: `Cu ce măsurăm ${p.v.ro}?`, en: `What do we measure ${p.v.en} with?` }),
    askV: (p) => ({ ro: `Ce măsurăm cu ${p.k.ro}?`, en: `What do we measure with ${p.k.en}?` }),
  },
};

/* ---------------- ordered sequences ---------------- */

export interface Step {
  ro: string;
  en: string;
  emoji?: string;
}
export interface Sequence {
  id: string;
  prompt: { ro: string; en: string };
  steps: Step[];
}

const S = (ro: string, en: string, emoji?: string): Step => ({ ro, en, ...(emoji ? { emoji } : {}) });

export const SEQUENCES: Record<string, Sequence> = {
  butterfly: {
    id: 'butterfly',
    prompt: { ro: 'Pune în ordine viața fluturelui.', en: 'Put the life of a butterfly in order.' },
    steps: [S('oul', 'egg', '🥚'), S('omida', 'caterpillar', '🐛'), S('pupa (crisalida)', 'pupa (chrysalis)'), S('fluturele', 'butterfly', '🦋')],
  },
  frog: {
    id: 'frog',
    prompt: { ro: 'Pune în ordine viața broaștei.', en: 'Put the life of a frog in order.' },
    steps: [
      S('icrele (ouăle)', 'eggs (frogspawn)'), S('mormolocul cu coadă', 'tadpole with a tail'),
      S('mormolocul cu picioare', 'tadpole with legs'), S('broasca adultă', 'adult frog', '🐸'),
    ],
  },
  hen: {
    id: 'hen',
    prompt: { ro: 'Pune în ordine viața găinii.', en: 'Put the life of a hen in order.' },
    steps: [S('oul', 'egg', '🥚'), S('puiul', 'chick', '🐥'), S('găina', 'hen', '🐔')],
  },
  plant: {
    id: 'plant',
    prompt: { ro: 'Pune în ordine creșterea unei plante.', en: 'Put the growth of a plant in order.' },
    steps: [
      S('sămânța', 'seed'), S('sămânța încolțește', 'the seed sprouts', '🌱'), S('planta tânără cu frunze', 'young plant with leaves', '🪴'),
      S('planta cu flori', 'plant with flowers', '🌷'), S('fructul cu semințe', 'fruit with seeds', '🍎'),
    ],
  },
  'water-cycle': {
    id: 'water-cycle',
    prompt: { ro: 'Pune în ordine drumul apei în natură.', en: 'Put the journey of water in nature in order.' },
    steps: [
      S('Soarele încălzește apa, care se evaporă', 'The Sun warms the water and it evaporates', '☀️'),
      S('Vaporii urcă și formează nori', 'The vapour rises and forms clouds', '☁️'),
      S('Din nori cad ploaia sau zăpada', 'Rain or snow falls from the clouds', '🌧️'),
      S('Apa se adună în râuri și mări', 'The water collects in rivers and seas', '🌊'),
    ],
  },
  'chain-hare': {
    id: 'chain-hare',
    prompt: { ro: 'Pune în ordine lanțul trofic: cine este mâncat de cine?', en: 'Put the food chain in order: who is eaten by whom?' },
    steps: [S('iarba', 'grass', '🌱'), S('iepurele', 'hare', '🐇'), S('lupul', 'wolf', '🐺')],
  },
  'chain-deer': {
    id: 'chain-deer',
    prompt: { ro: 'Pune în ordine lanțul trofic: cine este mâncat de cine?', en: 'Put the food chain in order: who is eaten by whom?' },
    steps: [S('iarba', 'grass', '🌱'), S('cerbul', 'deer', '🦌'), S('lupul', 'wolf', '🐺')],
  },
  'chain-owl': {
    id: 'chain-owl',
    prompt: { ro: 'Pune în ordine lanțul trofic: cine este mâncat de cine?', en: 'Put the food chain in order: who is eaten by whom?' },
    steps: [S('grâul', 'wheat', '🌾'), S('șoarecele', 'mouse', '🐭'), S('bufnița', 'owl', '🦉')],
  },
  'chain-snake': {
    id: 'chain-snake',
    prompt: { ro: 'Pune în ordine lanțul trofic: cine este mâncat de cine?', en: 'Put the food chain in order: who is eaten by whom?' },
    steps: [S('iarba', 'grass', '🌱'), S('greierele', 'cricket', '🦗'), S('broasca', 'frog', '🐸'), S('șarpele', 'snake', '🐍')],
  },
  seasons: {
    id: 'seasons',
    prompt: { ro: 'Pune anotimpurile în ordine, începând cu primăvara.', en: 'Put the seasons in order, starting with spring.' },
    steps: [S('primăvara', 'spring', '🌸'), S('vara', 'summer', '☀️'), S('toamna', 'autumn', '🍂'), S('iarna', 'winter', '❄️')],
  },
  day: {
    id: 'day',
    prompt: { ro: 'Pune în ordine momentele zilei.', en: 'Put the parts of the day in order.' },
    steps: [S('dimineața', 'morning', '🌅'), S('amiaza', 'midday', '☀️'), S('seara', 'evening', '🌇'), S('noaptea', 'night', '🌙')],
  },
  'human-life': {
    id: 'human-life',
    prompt: { ro: 'Pune în ordine vârstele omului, de la cel mai mic.', en: 'Put the ages of a person in order, youngest first.' },
    steps: [S('bebelușul', 'baby', '👶'), S('copilul', 'child', '🧒'), S('adultul', 'adult', '🧑'), S('bunicul', 'grandfather', '👴')],
  },
  digestion: {
    id: 'digestion',
    prompt: { ro: 'Pune în ordine drumul mâncării prin corp.', en: 'Put the journey of food through the body in order.' },
    steps: [S('gura', 'mouth', '👄'), S('esofagul', 'oesophagus'), S('stomacul', 'stomach'), S('intestinele', 'intestines')],
  },
};
