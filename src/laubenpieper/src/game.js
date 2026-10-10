/*
 * game.js - Laubenpieper game logic: a week in an allotment garden. The
 * gardener sows, waters and harvests vegetables for points, keeps the hedge,
 * the lawn and the paths in order and fends off snails, voles and the
 * neighbour's cat. On Sunday evening the club chairman inspects the plot:
 * every broken rule is a warning, three warnings end the lease (game over).
 *
 * Independent of the browser: the logic runs in fixed ticks of 1/TICK_HZ
 * seconds; tick() takes the input of one tick and reports what happened as
 * events (sounds and effects).
 */

export const TICK_HZ = 60;
export const SKIP_TICKS = TICK_HZ;          // A continues on an info screen after this
export const COLS = 20;
export const ROWS = 13;
export const DAYS = 7;
export const DAY_TICKS = 10 * TICK_HZ;
export const WEEK_TICKS = DAYS * DAY_TICKS;

export const CAN_MAX = 10;                   // waterings per can
export const WARNINGS_MAX = 3;              // the third warning ends the lease
export const WARNINGS_PER_VISIT = 2;        // at most this many from one inspection
export const HEDGE_MAX = 4;
export const HEDGE_LIMIT = 3;               // this height is "over 60 cm"
export const HEDGE_TOLERANCE = 3;           // overgrown hedge cells the chairman overlooks
export const LAWN_MAX = 3;                  // fully grown, too high
export const LAWN_TOLERANCE = 12;
export const BEDS_REQUIRED = 8;             // the "third rule": live plants at the inspection
export const MESS_LIMIT = 6;                // weeds + dead plants: from this count a warning
export const COMBO_MAX = 5;
export const COMBO_STEP = 3;                // harvests per multiplier step

export const POINTS_WEED = 20;
export const POINTS_MOW = 2;                // per cell
export const POINTS_CUT = 5;                // per hedge cell
export const POINTS_CHECK = 250;            // x week, per passed check
export const POINTS_MODEL = 1000;           // x week, a plot without any fault

export const DIR = { RIGHT: 0, DOWN: 1, LEFT: 2, UP: 3, NONE: 4 };
export const T = { LAWN: 0, PATH: 1, BED: 2, HEDGE: 3, FENCE: 4, GATE: 5, HOUSE: 6, BARREL: 7, COMPOST: 8,
                   GNOME: 9 };
export const STAGE = { SEED: 0, SPROUT: 1, YOUNG: 2, RIPE: 3 };
export const DEAD = { NONE: 0, WILTED: 1, ROTTEN: 2, EATEN: 3 };
export const PEST = { SNAIL: 0, VOLE: 1, CAT: 2 };
export const WEATHER = { SUN: 0, RAIN: 1, HEAT: 2 };
export const PHASE = { INTRO: 0, PLAY: 1, INSPECT: 2, GAME_OVER: 3 };
export const TOOL = { CAN: 0, MOWER: 1, SHEARS: 2, HAND: 3 };
export const EV = {
    SOW: 'sow', WATER: 'water', HARVEST: 'harvest', CLEAR: 'clear', WEED: 'weed', MOW: 'mow', CUT: 'cut',
    REFILL: 'refill', DENY: 'deny', EMPTY: 'empty', CATCH: 'catch', SCARE: 'scare', LOSS: 'loss',
    THIRSTY: 'thirsty', VOLE: 'vole', CAT: 'cat', RAIN: 'rain', HEAT: 'heat', DAY: 'day', WEEK: 'week',
    INSPECT: 'inspect', STAMP: 'stamp', VERDICT: 'verdict', GAME_OVER: 'game-over',
};

/* name, ticks from seed to ripe (with water), points, first week, weight of the seed draw */
export const CROPS = [
    { name: 'RADIESCHEN', grow: 40 * TICK_HZ, points: 150, week: 1, weight: 3 },
    { name: 'SALAT', grow: 50 * TICK_HZ, points: 220, week: 1, weight: 3 },
    { name: 'MÖHREN', grow: 65 * TICK_HZ, points: 330, week: 2, weight: 3 },
    { name: 'TOMATEN', grow: 80 * TICK_HZ, points: 480, week: 3, weight: 2 },
    { name: 'KÜRBIS', grow: 100 * TICK_HZ, points: 750, week: 4, weight: 1 },
];
export const PEST_WEEK = [1, 2, 3];         // first week of snails, voles, the cat
export const PEST_POINTS = [50, 80, 100];

/* The plot: 'H' hedge, '.' path, ',' lawn, 'B' bed, 'L' summer house, 'R' rain barrel,
 * 'C' compost, 'Z' garden gnome, 'F' fence, 'G' gate. */
const LAYOUT = [
    'HHHHHHHHHHHHHHHHHHHH',
    'H.................CH',
    'H.BBB.BBB.,,,,,,,,,H',
    'H.BBB.BBB.,LLLL,,R,H',
    'H.........,LLLL,,,,H',
    'H.BBB.BBB.,LLLL,,,,H',
    'H.BBB.BBB.,,..,,,,,H',
    'H.........,,..,,Z,,H',
    'H,,,,,,,,.........,H',
    'H,,,,,,,,.,,,,,,,,,H',
    'H,,,,,,,,.,,,,,,,,,H',
    'H,,,,,,,,.,,,,,,,,,H',
    'FFFFFFFFFGFFFFFFFFFF',
];
const TILE_CHARS = { ',': T.LAWN, '.': T.PATH, B: T.BED, H: T.HEDGE, F: T.FENCE, G: T.GATE, L: T.HOUSE,
                     R: T.BARREL, C: T.COMPOST, Z: T.GNOME };
export const HOUSE = { x: 11, y: 3, w: 4, h: 3 };
export const CHAIR_ROUTE = [[9, 12], [9, 8], [11, 8]];  // the chairman's way in, from the gate

const STEP_TICKS = 8;                       // gardener: ticks per cell
const ACT_TICKS = 10;                       // bed and barrel actions hold the gardener this long
const FIRST_INTRO_TICKS = 25 * TICK_HZ;
const INTRO_TICKS = 4 * TICK_HZ;
export const INSPECT_WALK = 150;            // the chairman walks in
export const INSPECT_STAMP = 60;            // ticks per check
export const INSPECT_VERDICT = INSPECT_WALK + 4 * INSPECT_STAMP + 30;
const INSPECT_END = INSPECT_VERDICT + 4 * TICK_HZ;
const GAME_OVER_TICKS = 7 * TICK_HZ;

export const THIRST_TICKS = 20 * TICK_HZ;           // thirsty this long: the plant wilts
export const RIPE_TICKS = 30 * TICK_HZ;            // ripe this long: the plant rots
export const SNAIL_EAT = 7 * TICK_HZ;
export const VOLE_DIG = 70;
export const CAT_DIG = 240;
const CAT_STEP = 14, CAT_FLEE_STEP = 6;
const CAT_FEAR = 2;                         // the cat flees when the gardener is this close (cells)

const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];

/* Difficulty by week (1-based, the last value repeats). */
const WATER_TICKS = [50, 46, 42, 38, 35, 32, 30].map(s => s * TICK_HZ);
const HEDGE_TICKS = [40, 34, 30, 26, 23, 20, 18, 16].map(s => s * TICK_HZ);   // mean per growth step
const LAWN_TICKS = [45, 40, 36, 32, 28, 25, 22, 20].map(s => s * TICK_HZ);
const WEED_EVERY = [12, 10, 9, 8, 7, 6, 5].map(s => s * TICK_HZ);
const SNAIL_EVERY = [20, 16, 13, 11, 10, 9, 8].map(s => s * TICK_HZ);
const SNAIL_STEP = [120, 110, 100, 90, 82, 75, 70];
const SNAILS_MAX = [2, 3, 3, 4, 4, 5, 6];
const VOLE_EVERY = [0, 22, 18, 15, 13, 11, 10].map(s => s * TICK_HZ);
const VOLE_UP = [0, 210, 190, 170, 150, 140, 130];
const CAT_EVERY = [0, 0, 28, 24, 20, 17, 15].map(s => s * TICK_HZ);
const HEAT_PERCENT = [0, 15, 20, 25, 25, 30, 30];
const RAIN_PERCENT = [15, 15, 12, 12, 10, 10, 10];

const byWeek = (table, week) => table[Math.min(week, table.length) - 1];

/* A small seeded random generator (mulberry32). */
function makeRandom(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export const tileAt = (x, y) => (x < 0 || y < 0 || x >= COLS || y >= ROWS) ? T.HEDGE : TILES[y * COLS + x];
const TILES = (() => {
    const tiles = new Uint8Array(COLS * ROWS);
    LAYOUT.forEach((row, y) => {
        if (row.length !== COLS)
            throw new Error(`layout row ${y} has ${row.length} columns`);
        for (let x = 0; x < COLS; x++)
            tiles[y * COLS + x] = TILE_CHARS[row[x]];
    });
    return tiles;
})();
const cellsOf = type => [...TILES.keys()].filter(i => TILES[i] === type);
export const BEDS = cellsOf(T.BED);
export const LAWNS = cellsOf(T.LAWN);
export const PATHS = cellsOf(T.PATH);
export const HEDGES = cellsOf(T.HEDGE);
const walkable = (x, y) => { const t = tileAt(x, y); return t === T.LAWN || t === T.PATH || t === T.BED; };
/* Cells next to the hedge: where pests come over it. */
const BORDER = [...TILES.keys()].filter(i => {
    const x = i % COLS, y = Math.floor(i / COLS);
    if (!walkable(x, y))
        return false;
    for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
            if (tileAt(x + dx, y + dy) === T.HEDGE)
                return true;
    return false;
});

export class Game {
    constructor(seed) {
        this.rnd = makeRandom(seed);
        this.events = [];
        this.score = 0;
        this.week = 1;
        this.warnings = 0;
        this.weekTicks = 0;
        this.day = 0;
        this.weather = WEATHER.SUN;
        this.weatherTicks = 0;                  // since the weather changed (rain animation)
        this.can = CAN_MAX;
        this.streak = 0;
        this.done = false;
        this.ticks = 0;
        this.hedge = new Uint8Array(COLS * ROWS);
        this.lawn = new Uint8Array(COLS * ROWS);
        this.weed = new Uint8Array(COLS * ROWS);
        this.plants = new Array(COLS * ROWS).fill(null);
        this.pests = [];
        this.timers = { weed: 0, snail: 0, vole: 0, cat: 0 };
        for (const i of HEDGES)
            this.hedge[i] = 0;
        for (const i of LAWNS)
            this.lawn[i] = this.rnd() < 0.5 ? 1 : 0;
        // a few beds are already sown, as left by the previous tenant
        for (const [i, stage] of [[BEDS[1], 1], [BEDS[4], 0], [BEDS[7], 2], [BEDS[13], 1], [BEDS[18], 0]]) {
            const p = this.newPlant(this.rnd() < 0.5 ? 0 : 1);
            p.grow = Math.floor(stage * CROPS[p.crop].grow / 3);
            p.stage = stage;
            this.plants[i] = p;
        }
        this.weed[PATHS[5]] = this.weed[PATHS[17]] = 1;
        this.seed = this.drawSeed();
        this.g = { x: 9, y: 9, fx: 9, fy: 9, step: 0, dir: DIR.DOWN, act: 0, tool: TOOL.CAN, walk: 0 };
        this.phase = PHASE.INTRO;
        this.phaseTicks = 0;
        this.introTicks = FIRST_INTRO_TICKS;
        this.firstIntro = true;
        this.inspection = null;
    }

    /* Starts in a later week, for the title screen. */
    startAt(week) {
        this.week = week;
        this.firstIntro = false;
        this.phase = PHASE.PLAY;
        for (const i of BEDS)
            if (!this.plants[i] && this.rnd() < 0.6) {
                const p = this.newPlant(this.drawCropIndex());
                p.stage = Math.floor(this.rnd() * 4);
                p.grow = Math.floor(p.stage * CROPS[p.crop].grow / 3);
                this.plants[i] = p;
            }
    }

    emit(type, data = {}) {
        this.events.push({ type, ...data });
    }

    get combo() {
        return Math.min(COMBO_MAX, 1 + Math.floor(this.streak / COMBO_STEP));
    }

    /* ---- Status, as the chairman will see it ---- */

    status() {
        let hedge = 0, lawn = 0, planted = 0, mess = 0;
        for (const i of HEDGES)
            if (this.hedge[i] >= HEDGE_LIMIT)
                hedge++;
        for (const i of LAWNS)
            if (this.lawn[i] >= LAWN_MAX)
                lawn++;
        for (const i of BEDS) {
            const p = this.plants[i];
            if (p && !p.dead)
                planted++;
            else if (p)
                mess++;
        }
        for (let i = 0; i < COLS * ROWS; i++)
            mess += this.weed[i];
        return { hedge, lawn, planted, mess };
    }

    checks() {
        const s = this.status();
        return [
            { name: 'HECKE NICHT HÖHER ALS 60 CM', ok: s.hedge <= HEDGE_TOLERANCE, value: s.hedge },
            { name: 'RASEN GEMÄHT', ok: s.lawn <= LAWN_TOLERANCE, value: s.lawn },
            { name: `DRITTELREGEL: ${BEDS_REQUIRED} BEETE`, ok: s.planted >= BEDS_REQUIRED, value: s.planted },
            { name: 'ORDNUNG & KEIN UNKRAUT', ok: s.mess < MESS_LIMIT, value: s.mess },
        ];
    }

    /* ---- Plants ---- */

    drawCropIndex() {
        const open = CROPS.map((c, i) => i).filter(i => CROPS[i].week <= this.week);
        let r = this.rnd() * open.reduce((n, i) => n + CROPS[i].weight, 0);
        for (const i of open) {
            r -= CROPS[i].weight;
            if (r < 0)
                return i;
        }
        return open[open.length - 1];
    }

    drawSeed() {
        return this.drawCropIndex();
    }

    newPlant(crop) {
        return { crop, stage: STAGE.SEED, grow: 0, water: byWeek(WATER_TICKS, this.week),
                 thirst: 0, ripe: 0, dead: DEAD.NONE, eaten: 0, age: 0 };
    }

    lose(i, cause) {
        const p = this.plants[i];
        if (cause === 'dug')
            this.plants[i] = null;
        else
            p.dead = cause;
        if (this.streak >= COMBO_STEP)
            this.emit(EV.LOSS, { cell: i, cause, comboLost: true });
        else
            this.emit(EV.LOSS, { cell: i, cause });
        this.streak = 0;
    }

    updatePlants() {
        const dry = this.weather === WEATHER.HEAT ? 1.5 : 1;
        for (const i of BEDS) {
            const p = this.plants[i];
            if (!p || p.dead)
                continue;
            p.age++;
            if (p.stage === STAGE.RIPE) {
                if (++p.ripe >= RIPE_TICKS)
                    this.lose(i, DEAD.ROTTEN);
                continue;
            }
            if (p.water > 0) {
                p.water = Math.max(0, p.water - dry);
                p.grow++;
                const total = CROPS[p.crop].grow;
                const stage = p.grow >= total ? STAGE.RIPE : Math.floor(p.grow * 3 / total);
                if (stage !== p.stage)
                    p.stage = stage;
                if (p.water === 0)
                    this.emit(EV.THIRSTY, { cell: i });
            } else if (++p.thirst >= THIRST_TICKS) {
                this.lose(i, DEAD.WILTED);
            }
        }
    }

    /* ---- Hedge, lawn, weeds ---- */

    updateGrowth() {
        const hedge = 1 / byWeek(HEDGE_TICKS, this.week), lawn = 1 / byWeek(LAWN_TICKS, this.week);
        for (const i of HEDGES)
            if (this.hedge[i] < HEDGE_MAX && this.rnd() < hedge)
                this.hedge[i]++;
        const rain = this.weather === WEATHER.RAIN ? 2 : 1;     // the lawn loves rain
        for (const i of LAWNS)
            if (this.lawn[i] < LAWN_MAX && this.rnd() < lawn * rain)
                this.lawn[i]++;
        if (++this.timers.weed >= byWeek(WEED_EVERY, this.week)) {
            this.timers.weed = 0;
            const free = [...PATHS, ...BEDS].filter(i => !this.weed[i] && !this.plants[i] && !this.atGardener(i));
            if (free.length)
                this.weed[free[Math.floor(this.rnd() * free.length)]] = 1;
        }
    }

    atGardener(i) {
        const g = this.g;
        return i === g.y * COLS + g.x || i === Math.round(g.fy) * COLS + Math.round(g.fx);
    }

    /* ---- Pests ---- */

    /* First step from (x, y) towards the nearest cell for which goal(i) is true, or -1. */
    stepTowards(x, y, goal) {
        const start = y * COLS + x, from = new Int16Array(COLS * ROWS).fill(-1);
        const queue = [start];
        from[start] = start;
        for (let q = 0; q < queue.length; q++) {
            const i = queue[q];
            if (i !== start && goal(i)) {
                let c = i;
                while (from[c] !== start)
                    c = from[c];
                return c;
            }
            const cx = i % COLS, cy = Math.floor(i / COLS);
            for (let d = 0; d < 4; d++) {
                const nx = cx + DX[d], ny = cy + DY[d], n = ny * COLS + nx;
                if (walkable(nx, ny) && from[n] < 0) {
                    from[n] = i;
                    queue.push(n);
                }
            }
        }
        return goal(start) ? start : -1;
    }

    livePlant(i) {
        const p = this.plants[i];
        return p && !p.dead ? p : null;
    }

    pestAt(i) {
        return this.pests.find(p => p.y * COLS + p.x === i);
    }

    spawnPests() {
        const week = this.week, t = this.timers;
        const plants = BEDS.filter(i => this.livePlant(i));
        if (week >= PEST_WEEK[PEST.SNAIL] && ++t.snail >= byWeek(SNAIL_EVERY, week)) {
            t.snail = 0;
            const snails = this.pests.filter(p => p.kind === PEST.SNAIL).length;
            const spots = BORDER.filter(i => !this.pestAt(i) && !this.atGardener(i));
            if (snails < byWeek(SNAILS_MAX, week) && spots.length) {
                const i = spots[Math.floor(this.rnd() * spots.length)];
                this.pests.push({ kind: PEST.SNAIL, x: i % COLS, y: Math.floor(i / COLS), fx: i % COLS,
                                  fy: Math.floor(i / COLS), move: 0, eat: 0, dir: DIR.LEFT, age: 0 });
            }
        }
        if (week >= PEST_WEEK[PEST.VOLE] && ++t.vole >= byWeek(VOLE_EVERY, week)) {
            t.vole = 0;
            const spots = plants.filter(i => this.livePlant(i).stage >= STAGE.SPROUT && !this.pestAt(i) &&
                                             !this.atGardener(i));
            if (spots.length) {
                const i = spots[Math.floor(this.rnd() * spots.length)];
                this.pests.push({ kind: PEST.VOLE, x: i % COLS, y: Math.floor(i / COLS), fx: i % COLS,
                                  fy: Math.floor(i / COLS), t: 0, up: false, age: 0 });
                this.emit(EV.VOLE, { cell: i });
            }
        }
        if (week >= PEST_WEEK[PEST.CAT] && ++t.cat >= byWeek(CAT_EVERY, week) &&
            !this.pests.some(p => p.kind === PEST.CAT)) {
            t.cat = 0;
            const g = this.g;
            const spots = BORDER.filter(i => Math.max(Math.abs(i % COLS - g.x),
                                                      Math.abs(Math.floor(i / COLS) - g.y)) > 5);
            if (spots.length) {
                const i = spots[Math.floor(this.rnd() * spots.length)];
                this.pests.push({ kind: PEST.CAT, x: i % COLS, y: Math.floor(i / COLS), fx: i % COLS,
                                  fy: Math.floor(i / COLS), move: 0, dig: 0, flee: false, dir: DIR.RIGHT,
                                  age: 0 });
                this.emit(EV.CAT, { cell: i });
            }
        }
    }

    movePest(p, to, ticks) {
        const nx = to % COLS, ny = Math.floor(to / COLS);
        if (nx !== p.x)
            p.dir = nx > p.x ? DIR.RIGHT : DIR.LEFT;
        p.fx = p.x;
        p.fy = p.y;
        p.x = nx;
        p.y = ny;
        p.move = ticks;
        p.moveTicks = ticks;
    }

    updatePests() {
        const g = this.g;
        for (const p of this.pests) {
            p.age++;
            const here = p.y * COLS + p.x;
            if (p.move > 0)
                p.move--;
            if (p.kind === PEST.SNAIL) {
                const plant = this.livePlant(here);
                if (plant && p.move === 0) {
                    plant.eaten = ++p.eat;
                    if (p.eat >= SNAIL_EAT) {
                        p.eat = 0;
                        this.lose(here, DEAD.EATEN);
                    }
                    continue;
                }
                p.eat = 0;
                if (p.move === 0) {
                    const step = byWeek(SNAIL_STEP, this.week);
                    let to = this.stepTowards(p.x, p.y, i => this.livePlant(i) &&
                                              !this.pests.some(q => q !== p && q.y * COLS + q.x === i));
                    if (to < 0) {
                        const d = Math.floor(this.rnd() * 4);
                        to = walkable(p.x + DX[d], p.y + DY[d]) ? (p.y + DY[d]) * COLS + p.x + DX[d] : here;
                    }
                    if (to !== here && !this.pests.some(q => q !== p && q.y * COLS + q.x === to))
                        this.movePest(p, to, step);
                    else
                        p.move = step;
                }
            } else if (p.kind === PEST.VOLE) {
                p.t++;
                if (!this.livePlant(here)) {
                    p.gone = true;
                    continue;
                }
                if (!p.up && p.t >= VOLE_DIG) {
                    p.up = true;
                    p.t = 0;
                } else if (p.up && p.t >= byWeek(VOLE_UP, this.week)) {
                    this.lose(here, DEAD.EATEN);
                    p.gone = true;
                }
            } else if (p.kind === PEST.CAT) {
                const near = Math.max(Math.abs(g.x - p.x), Math.abs(g.y - p.y)) <= CAT_FEAR;
                if (near && !p.flee) {
                    p.flee = true;
                    p.dig = 0;
                    this.addPoints(PEST_POINTS[PEST.CAT]);
                    this.emit(EV.SCARE, { cell: here, points: PEST_POINTS[PEST.CAT] });
                }
                if (p.move > 0)
                    continue;
                if (p.flee) {
                    if (BORDER.includes(here) && p.age > 1) {
                        p.gone = true;
                        continue;
                    }
                    const to = this.stepTowards(p.x, p.y, i => BORDER.includes(i) &&
                        Math.max(Math.abs(g.x - i % COLS), Math.abs(g.y - Math.floor(i / COLS))) > 1);
                    if (to < 0)
                        p.gone = true;
                    else
                        this.movePest(p, to, CAT_FLEE_STEP);
                    continue;
                }
                const plant = this.livePlant(here);
                if (plant && plant.stage <= STAGE.SPROUT) {
                    if (++p.dig >= CAT_DIG) {
                        p.dig = 0;
                        this.lose(here, 'dug');
                    }
                    continue;
                }
                p.dig = 0;
                let to = this.stepTowards(p.x, p.y, i => {
                    const q = this.livePlant(i);
                    return q && q.stage <= STAGE.SPROUT;
                });
                if (to < 0) {
                    if (p.age > 8 * TICK_HZ) {
                        p.flee = true;      // nothing to dig: leave again
                        continue;
                    }
                    const d = Math.floor(this.rnd() * 4);
                    to = walkable(p.x + DX[d], p.y + DY[d]) ? (p.y + DY[d]) * COLS + p.x + DX[d] : here;
                }
                if (to !== here)
                    this.movePest(p, to, CAT_STEP);
                else
                    p.move = CAT_STEP;
            }
        }
        this.pests = this.pests.filter(p => !p.gone);
    }

    /* ---- The gardener ---- */

    addPoints(n) {
        this.score += n;
    }

    /* The cell the gardener acts on: the nearer one while walking. */
    gardenerCell() {
        const g = this.g;
        if (g.step > STEP_TICKS / 2)
            return Math.round(g.fy) * COLS + Math.round(g.fx);
        return g.y * COLS + g.x;
    }

    neighbours(i, diagonal) {
        const x = i % COLS, y = Math.floor(i / COLS), out = [];
        for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++)
                if ((dx || dy) && (diagonal || !dx || !dy) && x + dx >= 0 && x + dx < COLS && y + dy >= 0 &&
                    y + dy < ROWS)
                    out.push((y + dy) * COLS + x + dx);
        return out;
    }

    /* Chores done in passing (A held while walking) or by a press: weeds, lawn, hedge. */
    chores(i, press) {
        const g = this.g;
        let done = false;
        if (this.weed[i]) {
            this.weed[i] = 0;
            this.addPoints(POINTS_WEED);
            this.emit(EV.WEED, { cell: i, points: POINTS_WEED });
            g.tool = TOOL.HAND;
            return true;
        }
        const cut = this.neighbours(i, true).filter(n => TILES[n] === T.HEDGE && this.hedge[n] > 0);
        if (cut.length) {
            for (const n of cut)
                this.hedge[n] = 0;
            this.addPoints(POINTS_CUT * cut.length);
            this.emit(EV.CUT, { cells: cut, cell: i });
            g.tool = TOOL.SHEARS;
            done = true;
        }
        // the mower is three cells wide, across the walking direction
        const x = i % COLS, y = Math.floor(i / COLS), side = g.dir === DIR.LEFT || g.dir === DIR.RIGHT;
        const swath = [i, side ? i - COLS : i - 1, side ? i + COLS : i + 1].filter(n => {
            const nx = n % COLS, ny = Math.floor(n / COLS);
            return Math.abs(nx - x) <= 1 && Math.abs(ny - y) <= 1 && n >= 0 && n < COLS * ROWS &&
                   TILES[n] === T.LAWN && this.lawn[n] > 0;
        });
        if (swath.length && (TILES[i] === T.LAWN || press)) {
            for (const n of swath)
                this.lawn[n] = 0;
            this.addPoints(POINTS_MOW * swath.length);
            this.emit(EV.MOW, { cells: swath, cell: i });
            g.tool = TOOL.MOWER;
            done = true;
        }
        return done;
    }

    act() {
        const g = this.g, i = this.gardenerCell();
        // 1. pests within reach
        const reach = [i, ...this.neighbours(i, true)];
        const pest = this.pests.find(p => p.kind !== PEST.CAT && p.y * COLS + p.x === i) ||
                     this.pests.find(p => p.kind !== PEST.CAT && reach.includes(p.y * COLS + p.x));
        if (pest) {
            pest.gone = true;
            this.pests = this.pests.filter(p => !p.gone);
            this.addPoints(PEST_POINTS[pest.kind]);
            this.emit(EV.CATCH, { cell: pest.y * COLS + pest.x, kind: pest.kind, points: PEST_POINTS[pest.kind] });
            g.tool = TOOL.HAND;
            g.act = ACT_TICKS;
            return;
        }
        // 2. the bed under the gardener
        if (TILES[i] === T.BED) {
            const p = this.plants[i];
            g.act = ACT_TICKS;
            if (p && p.dead) {
                this.plants[i] = null;
                this.emit(EV.CLEAR, { cell: i });
                g.tool = TOOL.HAND;
            } else if (p && p.stage === STAGE.RIPE) {
                const mult = this.combo, points = CROPS[p.crop].points * mult;
                this.plants[i] = null;
                this.streak++;
                this.addPoints(points);
                this.emit(EV.HARVEST, { cell: i, crop: p.crop, points, mult, comboUp: this.combo > mult });
                g.tool = TOOL.HAND;
            } else if (p) {
                if (this.can > 0) {
                    // the can's rose waters the neighbouring beds too
                    this.can--;
                    const cells = [i, ...this.neighbours(i, false)].filter(n => {
                        const q = this.livePlant(n);
                        return q && q.stage !== STAGE.RIPE;
                    });
                    for (const n of cells) {
                        this.plants[n].water = byWeek(WATER_TICKS, this.week);
                        this.plants[n].thirst = 0;
                    }
                    this.emit(EV.WATER, { cell: i, cells, left: this.can });
                } else {
                    this.emit(EV.EMPTY, { cell: i });
                }
                g.tool = TOOL.CAN;
            } else if (this.weed[i]) {
                this.chores(i, true);
            } else {
                this.plants[i] = this.newPlant(this.seed);
                this.emit(EV.SOW, { cell: i, crop: this.seed });
                this.seed = this.drawSeed();
                g.tool = TOOL.HAND;
            }
            return;
        }
        // 3. the rain barrel
        if (this.neighbours(i, true).some(n => TILES[n] === T.BARREL)) {
            g.act = ACT_TICKS;
            g.tool = TOOL.CAN;
            if (this.can < CAN_MAX) {
                this.can = CAN_MAX;
                this.emit(EV.REFILL, { cell: i });
            } else {
                this.emit(EV.DENY, { cell: i });
            }
            return;
        }
        // 4. chores
        if (!this.chores(i, true))
            this.emit(EV.DENY, { cell: i });
    }

    moveGardener(dir, aHeld) {
        const g = this.g;
        if (g.act > 0) {
            g.act--;
            return;
        }
        if (g.step > 0) {
            g.step--;
            g.walk++;
            if (g.step === 0) {
                g.fx = g.x;
                g.fy = g.y;
                if (aHeld)
                    this.chores(g.y * COLS + g.x, false);
            }
            return;
        }
        if (dir === DIR.NONE)
            return;
        g.dir = dir;
        const nx = g.x + DX[dir], ny = g.y + DY[dir];
        if (!walkable(nx, ny))
            return;
        g.fx = g.x;
        g.fy = g.y;
        g.x = nx;
        g.y = ny;
        g.step = STEP_TICKS;
    }

    /* Position for drawing, in cells. */
    gardenerPos() {
        const g = this.g, t = g.step / STEP_TICKS;
        return [g.x + (g.fx - g.x) * t, g.y + (g.fy - g.y) * t];
    }

    /* ---- Week, weather, inspection ---- */

    newDay() {
        const r = this.rnd() * 100;
        const old = this.weather;
        if (this.day === 0 && this.week === 1)
            this.weather = WEATHER.SUN;
        else if (r < byWeek(RAIN_PERCENT, this.week))
            this.weather = WEATHER.RAIN;
        else if (r < byWeek(RAIN_PERCENT, this.week) + byWeek(HEAT_PERCENT, this.week))
            this.weather = WEATHER.HEAT;
        else
            this.weather = WEATHER.SUN;
        this.weatherTicks = 0;
        this.emit(EV.DAY, { day: this.day });
        if (this.weather === WEATHER.RAIN) {
            for (const i of BEDS) {
                const p = this.livePlant(i);
                if (p && p.stage !== STAGE.RIPE) {
                    p.water = byWeek(WATER_TICKS, this.week);
                    p.thirst = 0;
                }
            }
            this.emit(EV.RAIN);
        } else if (this.weather === WEATHER.HEAT && old !== WEATHER.HEAT) {
            this.emit(EV.HEAT);
        }
    }

    startInspection() {
        this.phase = PHASE.INSPECT;
        this.phaseTicks = 0;
        this.pests = [];
        const checks = this.checks();
        const faults = Math.min(WARNINGS_PER_VISIT, checks.filter(c => !c.ok).length);
        this.inspection = { checks, faults, model: faults === 0, points: 0, struck: false };
        this.emit(EV.INSPECT);
    }

    verdict() {
        const v = this.inspection, w = this.week;
        v.points = v.checks.filter(c => c.ok).length * POINTS_CHECK * w + (v.model ? POINTS_MODEL * w : 0);
        this.addPoints(v.points);
        if (v.model && this.warnings > 0) {
            this.warnings--;            // a model plot strikes one warning
            v.struck = true;
        }
        this.warnings = Math.min(WARNINGS_MAX, this.warnings + v.faults);
        v.terminated = this.warnings >= WARNINGS_MAX;
        this.emit(EV.VERDICT, { faults: v.faults, model: v.model, terminated: v.terminated, points: v.points });
    }

    nextWeek() {
        this.week++;
        this.weekTicks = 0;
        this.day = 0;
        this.weather = WEATHER.SUN;
        this.timers = { weed: 0, snail: 0, vole: 0, cat: 0 };
        this.phase = PHASE.INTRO;
        this.phaseTicks = 0;
        this.introTicks = INTRO_TICKS;
        this.firstIntro = false;
        this.inspection = null;
        const g = this.g;
        Object.assign(g, { x: 9, y: 9, fx: 9, fy: 9, step: 0, act: 0, dir: DIR.DOWN });
    }

    /* What is new in this week (for the intro screen). */
    news() {
        const out = [];
        for (const c of CROPS)
            if (c.week === this.week && this.week > 1)
                out.push(`NEUES SAATGUT: ${c.name}`);
        if (PEST_WEEK[PEST.VOLE] === this.week)
            out.push('ACHTUNG: WÜHLMÄUSE!');
        if (PEST_WEEK[PEST.CAT] === this.week)
            out.push('ACHTUNG: NACHBARS KATZE!');
        return out;
    }

    /* ---- One tick ---- */

    tick(dir, a, aHeld) {
        this.events = [];
        this.ticks++;
        this.phaseTicks++;
        switch (this.phase) {
        case PHASE.INTRO:
            if (this.phaseTicks >= this.introTicks || (a && this.phaseTicks >= SKIP_TICKS)) {
                this.phase = PHASE.PLAY;
                this.phaseTicks = 0;
                this.newDay();
                this.emit(EV.WEEK, { week: this.week });
            }
            return;
        case PHASE.INSPECT:
            if (this.phaseTicks < INSPECT_VERDICT && this.phaseTicks > INSPECT_WALK &&
                (this.phaseTicks - INSPECT_WALK) % INSPECT_STAMP === 0) {
                const k = (this.phaseTicks - INSPECT_WALK) / INSPECT_STAMP - 1;
                this.emit(EV.STAMP, { index: k, ok: this.inspection.checks[k].ok });
            }
            if (this.phaseTicks === INSPECT_VERDICT)
                this.verdict();
            if (this.phaseTicks >= INSPECT_END ||
                (a && this.phaseTicks >= INSPECT_VERDICT + SKIP_TICKS)) {
                if (this.inspection.terminated) {
                    this.phase = PHASE.GAME_OVER;
                    this.phaseTicks = 0;
                    this.emit(EV.GAME_OVER);
                } else {
                    this.nextWeek();
                }
            } else if (a && this.phaseTicks < INSPECT_VERDICT && this.phaseTicks > SKIP_TICKS / 2) {
                // A hurries the chairman along: straight to the next stamp
                const next = this.phaseTicks < INSPECT_WALK ? INSPECT_WALK :
                    INSPECT_WALK + Math.ceil((this.phaseTicks - INSPECT_WALK + 1) / INSPECT_STAMP) * INSPECT_STAMP;
                this.phaseTicks = Math.min(next, INSPECT_VERDICT) - 1;
            }
            return;
        case PHASE.GAME_OVER:
            if (this.phaseTicks >= GAME_OVER_TICKS || (a && this.phaseTicks >= 2 * SKIP_TICKS))
                this.done = true;
            return;
        }

        this.weekTicks++;
        this.weatherTicks++;
        const day = Math.min(DAYS - 1, Math.floor(this.weekTicks / DAY_TICKS));
        if (day !== this.day) {
            this.day = day;
            this.newDay();
        }
        if (a && this.g.act === 0)
            this.act();
        this.moveGardener(dir, aHeld);
        this.updatePlants();
        this.updateGrowth();
        this.spawnPests();
        this.updatePests();
        if (this.weekTicks >= WEEK_TICKS)
            this.startInspection();
    }
}
