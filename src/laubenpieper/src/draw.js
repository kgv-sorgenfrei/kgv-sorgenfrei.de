/*
 * draw.js - Laubenpieper graphics on a 640x480 canvas.
 *
 * The garden is pixel art at 320x240, drawn into an offscreen canvas and
 * scaled up 2x with sharp pixels: lawn with mowing stripes and growing tufts,
 * gravel paths, beds of soil (dark when watered), a hedge that bulges into
 * the plot as it grows, the summer house, rain barrel, compost and gnome.
 * People and animals are sprites with a dark outline, built once from
 * rectangles. The status bar and texts use the pixel font Press Start 2P.
 */
import {
    BEDS, BEDS_REQUIRED, CAN_MAX, CAT_DIG, CHAIR_ROUTE, COLS, CROPS, DAY_TICKS, DAYS, DEAD, DIR, EV,
    HEDGE_LIMIT, HEDGE_TOLERANCE, HEDGES, HOUSE, INSPECT_STAMP, INSPECT_VERDICT, INSPECT_WALK, LAWN_TOLERANCE,
    MESS_LIMIT, PEST, PHASE, RIPE_TICKS, ROWS, SKIP_TICKS, STAGE, T, THIRST_TICKS, TOOL, VOLE_DIG, WARNINGS_MAX,
    WEATHER, tileAt,
} from './game.js';

export const SCREEN_W = 640;
export const SCREEN_H = 480;

const PIX = 2;
const CELL = 16;
const W = SCREEN_W / PIX, H = SCREEN_H / PIX;
const FY = 32;                          // the field starts below the status bar (world pixels)
const HUD_H = FY * PIX;
const CX = SCREEN_W / 2;

const SPR_W = 18, SPR_H = 22, SPR_OX = 1, SPR_OY = 4;
const SHAKE_TICKS = 14;

/* Interface colours (texts, frames, panels) taken from the club logo: sun yellow
 * #fecc00, apple red #e31e24, light green #a2b922, leaf green #52812d. */
export const C = {
    HUD_BG: '#1a290d', HUD_LINE: '#52812d', LABEL: '#b3cb68', TEXT: '#fffbe8', DIM: '#436824',
    YELLOW: '#fecc00', RED: '#eb4a4f', GREEN: '#a2b922', BLUE: '#6ec8ff', ORANGE: '#ffa040', PINK: '#ff7ab0',
    WHITE: '#ffffff', OUTLINE: '#121a10', PANEL: 'rgba(26, 41, 13, 0.92)', PANEL_LINE: '#fecc00',
    SHADE: 'rgba(16, 26, 8, 0.62)',
};
const COMBO_COLOR = [null, C.TEXT, C.YELLOW, C.ORANGE, C.PINK, C.BLUE];
const DAY_NAMES = ['MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO'];
const CROP_COLOR = ['#e0304a', '#8ad85a', '#f08a24', '#e0302a', '#f0901e'];

/* The club logo (sun, leaf, apple in two hands) as pixel art for the title screen:
 * Y sun, R apple, L hands, G leaf and finger lines. */
const LOGO = [
    '.........Y...Y......',
    '..........Y..Y...Y..',
    '......Y...Y..Y..Y...',
    '.......YYY.YYYY.....',
    '........YYYYYYYY....',
    '..........YYYYYY.YY.',
    '......YYY.YYYYYY....',
    '......LLL.YYYYYY....',
    '....LLLLL..YYYY..YY.',
    '...LGGLLL.GG...Y....',
    'LGGGLLLL.GGGGG.YY...',
    'LLLLGGLL.GYGGGL.Y...',
    'LGGGLLLL.GGGGLL.....',
    'LLLLLRRRR..LLLL.....',
    '.LLLRRRRYRLLLLL.....',
    '.LLLRRRRRYLLLGL.....',
    '.LLLRRRRRRLLLGL.....',
    '..LLRRRRRRLLLGLL....',
    '...LRRRRRLLLLLLL....',
    '....LLRLLLLLLLL.....',
    '......LLLLLLL.......',
];
const LOGO_COLOR = { Y: '#fecc00', R: '#e31e24', L: '#a2b922', G: '#52812d' };

function hash(a, b = 0) {
    let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d);
    h ^= h >>> 12;
    return h >>> 0;
}

/* ---- Sprites: painted with put(x, y, w, h, color), outlined ---- */

function buildSprite(w, h, ox, oy, paint, outline = C.OUTLINE) {
    const pix = new Array(w * h).fill(null);
    const put = (x, y, pw, ph, c) => {
        for (let yy = y; yy < y + ph; yy++)
            for (let xx = x; xx < x + pw; xx++) {
                const px = xx + ox, py = yy + oy;
                if (px >= 0 && px < w && py >= 0 && py < h)
                    pix[py * w + px] = c;
            }
    };
    paint(put);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
            let c = pix[y * w + x];
            if (!c) {
                if (!outline)
                    continue;
                const edge = (x > 0 && pix[y * w + x - 1]) || (x < w - 1 && pix[y * w + x + 1]) ||
                             (y > 0 && pix[(y - 1) * w + x]) || (y < h - 1 && pix[(y + 1) * w + x]);
                if (!edge)
                    continue;
                c = outline;
            }
            ctx.fillStyle = c;
            ctx.fillRect(x, y, 1, 1);
        }
    return canvas;
}

/* The gardener: straw hat, moustache, checked shirt, green dungarees. Front view
 * (back view when walking up), the tool in the right hand. */
function paintGardener(put, frame, tool, back) {
    const skin = '#f0c8a0', hat = '#e8c860', hatD = '#c8a040', band = '#c84a3a';
    const shirt = '#d0503c', shirtL = '#f08a70', bib = '#3e7a4a', bibD = '#2e5e3a', boot = '#5a3a1e';
    put(5, -3, 6, 3, hat);
    put(5, -1, 6, 1, band);
    put(1, 0, 14, 2, hat);
    put(1, 1, 14, 1, hatD);
    put(4, 2, 8, 5, skin);
    put(3, 3, 1, 2, skin);
    put(12, 3, 1, 2, skin);
    if (back) {
        put(4, 2, 8, 3, '#9a9a96');
    } else {
        put(6, 3, 1, 1, '#1a1210');
        put(9, 3, 1, 1, '#1a1210');
        put(7, 4, 2, 1, '#e0a880');
        put(5, 5, 6, 1, '#7a4a26');
        put(4, 6, 1, 1, '#7a4a26');
        put(11, 6, 1, 1, '#7a4a26');
    }
    put(3, 7, 10, 4, shirt);
    for (let x = 3; x < 13; x += 2)
        put(x, 8, 1, 1, shirtL);
    put(3, 10, 10, 1, shirtL);
    if (!back) {
        put(5, 8, 6, 3, bib);
        put(7, 9, 2, 1, bibD);
    }
    put(5, 7, 1, 1, bib);
    put(10, 7, 1, 1, bib);
    put(2, 7, 1, 3, shirt);
    put(13, 7, 1, 3, shirt);
    put(2, 10, 1, 1, skin);
    put(13, 10, 1, 1, skin);
    put(4, 11, 8, 2, bib);
    put(4, 13, 3, 1, bib);
    put(9, 13, 3, 1, bib);
    put(frame ? 4 : 3, frame ? 15 : 14, 3, 1, boot);
    put(frame ? 10 : 9, frame ? 14 : 15, 3, 1, boot);
    put(frame ? 4 : 9, 14, 3, 1, bib);
    if (back)
        return;
    switch (tool) {
    case TOOL.CAN:
        put(13, 9, 4, 4, '#5f8f9f');
        put(14, 8, 2, 1, '#3f6f7f');
        put(16, 8, 1, 1, '#5f8f9f');
        put(14, 10, 2, 1, '#8fbfcf');
        break;
    case TOOL.MOWER:
        put(12, 12, 6, 3, '#d83a2a');
        put(13, 11, 3, 1, '#a02a1e');
        put(12, 15, 2, 1, '#202020');
        put(16, 15, 2, 1, '#202020');
        put(14, 7, 1, 5, '#606060');
        break;
    case TOOL.SHEARS:
        put(13, 5, 1, 5, '#c8c8d0');
        put(15, 5, 1, 5, '#c8c8d0');
        put(13, 10, 1, 2, '#c83030');
        put(15, 10, 1, 2, '#c83030');
        break;
    }
}

/* The club chairman: bald, glasses, grey suit, red tie, clipboard. */
function paintChairman(put, frame) {
    const skin = '#f0c0a0', suit = '#6a6f7a', suitD = '#50545e';
    put(5, -1, 6, 2, skin);
    put(4, 0, 1, 3, '#c0c0c0');
    put(11, 0, 1, 3, '#c0c0c0');
    put(4, 1, 8, 6, skin);
    put(3, 3, 1, 2, skin);
    put(12, 3, 1, 2, skin);
    put(5, 3, 2, 1, '#202020');
    put(9, 3, 2, 1, '#202020');
    put(7, 3, 2, 1, '#202020');
    put(6, 5, 4, 1, '#a0a0a0');
    put(3, 7, 10, 5, suit);
    put(6, 7, 4, 2, '#f4f4f4');
    put(7, 7, 2, 5, '#c83030');
    put(5, 8, 1, 3, suitD);
    put(10, 8, 1, 3, suitD);
    put(2, 7, 1, 4, suit);
    put(13, 7, 1, 4, suit);
    put(13, 11, 1, 1, skin);
    put(4, 12, 8, 2, '#3a3e4a');
    put(4, 14, 3, 1, '#3a3e4a');
    put(9, 14, 3, 1, '#3a3e4a');
    put(frame ? 4 : 3, frame ? 15 : 14, 3, 1, '#151515');
    put(frame ? 10 : 9, frame ? 14 : 15, 3, 1, '#151515');
    put(-1, 8, 4, 6, '#a0703c');
    put(0, 9, 2, 4, '#f4f4f0');
    put(0, 10, 2, 1, '#9090a0');
    put(0, 12, 2, 1, '#9090a0');
    put(0, 8, 2, 1, '#c0c0c0');
    put(2, 10, 1, 1, skin);
}

function paintGnome(put) {
    put(6, -2, 2, 2, '#d83030');
    put(5, 0, 5, 2, '#d83030');
    put(4, 2, 7, 2, '#d83030');
    put(5, 4, 5, 2, '#f0c8a0');
    put(6, 5, 1, 1, '#202020');
    put(8, 5, 1, 1, '#202020');
    put(4, 6, 7, 4, '#f4f4f4');
    put(3, 9, 9, 4, '#3a6ad0');
    put(5, 10, 5, 3, '#f4f4f4');
    put(3, 13, 9, 1, '#2a2a2a');
    put(4, 14, 3, 2, '#7a4a26');
    put(8, 14, 3, 2, '#7a4a26');
    put(12, 8, 1, 6, '#8a5a30');
    put(11, 7, 3, 1, '#ffe060');
}

function paintSnail(put) {
    put(2, 6, 9, 2, '#d8c890');
    put(9, 4, 2, 3, '#d8c890');
    put(9, 1, 1, 3, '#b8a870');
    put(11, 2, 1, 2, '#b8a870');
    put(9, 0, 1, 1, '#302010');
    put(11, 1, 1, 1, '#302010');
    put(1, 1, 7, 6, '#b86a2a');
    put(2, 0, 5, 1, '#b86a2a');
    put(2, 2, 5, 4, '#e09a4a');
    put(3, 3, 3, 2, '#b86a2a');
    put(4, 3, 1, 1, '#7a4018');
}

function paintVole(put) {
    put(2, 0, 3, 3, '#6a4a34');
    put(9, 0, 3, 3, '#6a4a34');
    put(3, 1, 8, 7, '#8a6a50');
    put(4, 3, 2, 2, '#101010');
    put(8, 3, 2, 2, '#101010');
    put(4, 3, 1, 1, '#f4f4f4');
    put(8, 3, 1, 1, '#f4f4f4');
    put(6, 5, 2, 1, '#e88a9a');
    put(6, 6, 2, 1, '#f4f4f4');
    put(2, 5, 1, 1, '#8a6a50');
    put(11, 5, 1, 1, '#8a6a50');
}

function paintCat(put, frame) {
    const fur = '#e8923a', stripe = '#b8641e';
    put(0, 1, 2, 2, fur);
    put(1, 3, 1, 3, fur);
    put(2, 5, 10, 5, fur);
    for (const x of [4, 7, 10])
        put(x, 5, 1, 3, stripe);
    put(10, 2, 5, 5, fur);
    put(10, 0, 2, 2, fur);
    put(13, 0, 2, 2, fur);
    put(13, 3, 1, 1, '#4ac830');
    put(15, 4, 1, 1, '#e88a9a');
    put(3, 9, 8, 1, '#f4d0a0');
    if (frame) {
        put(2, 10, 1, 2, fur);
        put(5, 10, 1, 1, fur);
        put(8, 10, 1, 2, fur);
        put(11, 10, 1, 1, fur);
    } else {
        put(3, 10, 1, 1, fur);
        put(4, 10, 1, 2, fur);
        put(9, 10, 1, 1, fur);
        put(10, 10, 1, 2, fur);
    }
}

/* ---- Plants, drawn straight onto a context: crop icons for the status bar too ---- */

function drawPlant(ctx, x0, y0, p, ticks, cell) {
    const put = (x, y, w, h, c) => {
        ctx.fillStyle = c;
        ctx.fillRect(x0 + x, y0 + y, w, h);
    };
    const leaf = '#3f8f34', leafL = '#5aaa3e', leafX = '#7cd04a';
    if (p.dead === DEAD.WILTED) {
        put(7, 7, 2, 6, '#8a7040');
        put(3, 10, 4, 2, '#a08850');
        put(9, 10, 4, 2, '#a08850');
        put(4, 12, 2, 1, '#7a6030');
        put(10, 12, 2, 1, '#7a6030');
        return;
    }
    if (p.dead === DEAD.ROTTEN) {
        put(3, 9, 10, 4, '#5a4a2a');
        put(4, 8, 7, 2, '#6e5e30');
        put(5, 10, 1, 1, '#a8a890');
        put(9, 9, 2, 1, '#a8a890');
        put(11, 11, 1, 1, '#a8a890');
        const a = ticks / 6 + (cell || 0);
        put(7 + Math.round(Math.cos(a) * 4), 5 + Math.round(Math.sin(a * 1.3) * 2), 1, 1, '#101010');
        put(8 + Math.round(Math.sin(a * 0.9) * 4), 4 + Math.round(Math.cos(a) * 2), 1, 1, '#101010');
        return;
    }
    if (p.dead === DEAD.EATEN) {
        put(5, 10, 1, 3, '#6a8a3a');
        put(8, 9, 1, 4, '#6a8a3a');
        put(10, 10, 1, 3, '#6a8a3a');
        put(3, 13, 2, 1, '#c8d8e0');
        put(7, 13, 1, 1, '#c8d8e0');
        put(11, 12, 2, 1, '#c8d8e0');
        return;
    }
    if (p.stage === STAGE.SEED) {
        put(2, 2, 1, 8, '#a0703c');
        put(1, 1, 4, 3, CROP_COLOR[p.crop]);
        put(1, 1, 4, 1, '#f4f4f0');
        put(5, 9, 7, 2, '#7d5232');
        put(6, 9, 1, 1, '#3a2412');
        put(8, 10, 1, 1, '#3a2412');
        put(10, 9, 1, 1, '#3a2412');
        return;
    }
    if (p.stage === STAGE.SPROUT) {
        put(7, 8, 2, 4, leafL);
        put(4, 6, 4, 3, leafX);
        put(9, 6, 4, 3, leafX);
        put(5, 7, 2, 1, leafL);
        put(10, 7, 2, 1, leafL);
        return;
    }
    const ripe = p.stage === STAGE.RIPE;
    switch (p.crop) {
    case 0:     // radishes
        put(6, 1, 4, 5, leaf);
        put(3, 3, 4, 5, leafL);
        put(9, 3, 4, 5, leafL);
        put(7, 5, 2, 5, leaf);
        if (ripe) {
            put(3, 9, 4, 4, '#e0304a');
            put(9, 9, 4, 4, '#e0304a');
            put(4, 10, 1, 1, '#ff9aaa');
            put(10, 10, 1, 1, '#ff9aaa');
            put(4, 13, 2, 1, '#f4e8e8');
            put(10, 13, 2, 1, '#f4e8e8');
        }
        break;
    case 1:     // lettuce
        if (ripe) {
            put(2, 4, 12, 10, leafX);
            put(1, 6, 14, 6, leafX);
            put(4, 5, 8, 7, '#b8ec80');
            put(6, 6, 4, 4, '#d4f4a0');
            put(3, 8, 1, 3, leafL);
            put(12, 8, 1, 3, leafL);
            put(7, 11, 2, 2, leafL);
        } else {
            put(4, 6, 8, 6, leafX);
            put(6, 7, 4, 3, '#b4e880');
            put(5, 11, 6, 1, leafL);
        }
        break;
    case 2:     // carrots
        for (const x of [5, 7, 8, 10])
            put(x, ripe ? 1 : 3, 1, ripe ? 9 : 7, leafL);
        put(4, ripe ? 3 : 5, 1, 2, leafX);
        put(6, ripe ? 2 : 4, 1, 2, leafX);
        put(9, ripe ? 2 : 4, 1, 2, leafX);
        put(11, ripe ? 3 : 5, 1, 2, leafX);
        if (ripe) {
            put(4, 10, 3, 3, '#f08a24');
            put(9, 10, 3, 3, '#f08a24');
            put(5, 10, 1, 1, '#ffb060');
            put(10, 10, 1, 1, '#ffb060');
        }
        break;
    case 3:     // tomatoes
        put(11, 0, 1, 13, '#a0703c');
        put(5, 2, 6, 10, leaf);
        put(4, 5, 8, 4, leafL);
        put(7, 11, 2, 2, leaf);
        if (ripe) {
            for (const [x, y] of [[4, 4], [8, 7], [5, 9], [9, 3]]) {
                put(x, y, 3, 3, '#e0302a');
                put(x, y, 1, 1, '#ff9080');
            }
        } else {
            put(6, 4, 1, 1, '#ffe050');
            put(9, 8, 1, 1, '#ffe050');
        }
        break;
    case 4:     // pumpkin
        if (ripe) {
            put(1, 2, 6, 4, leaf);
            put(9, 1, 6, 4, leafL);
            put(7, 4, 2, 3, '#6a8a2a');
            put(2, 6, 12, 9, '#f0901e');
            put(1, 8, 14, 5, '#f0901e');
            for (const x of [5, 8, 11])
                put(x, 7, 1, 7, '#c8701a');
            put(3, 8, 1, 2, '#ffb850');
        } else {
            put(2, 5, 6, 5, leaf);
            put(8, 3, 6, 6, leafL);
            put(4, 7, 2, 1, leafX);
            put(10, 5, 2, 1, leafX);
            put(6, 10, 4, 1, leafL);
            put(10, 9, 1, 3, leafL);
        }
        break;
    }
    if (ripe && p.ripe > RIPE_TICKS * 2 / 3) {
        put(4, 12, 1, 1, '#5a4a2a');
        put(11, 7, 1, 1, '#5a4a2a');
    }
}

/* ---- The renderer ---- */

export class Renderer {
    constructor(canvas, touch) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
        this.touch = touch;
        this.world = document.createElement('canvas');
        this.world.width = W;
        this.world.height = H;
        this.w = this.world.getContext('2d');
        this.w.imageSmoothingEnabled = false;
        this.sprites = new Map();
        this.ticks = 0;
        this.fx = [];                   // floating texts (screen pixels)
        this.parts = [];                // particles (world pixels)
        this.shake = 0;
        this.warnFlash = 0;
        this.icons = CROPS.map((c, crop) => {
            const icon = document.createElement('canvas');
            icon.width = icon.height = CELL;
            drawPlant(icon.getContext('2d'), 0, 0, { crop, stage: STAGE.RIPE, dead: 0, ripe: 0 }, 0, 0);
            return icon;
        });
    }

    sprite(key, make) {
        let s = this.sprites.get(key);
        if (!s) {
            s = make();
            this.sprites.set(key, s);
        }
        return s;
    }

    /* ---- Primitives ---- */

    r(x, y, w, h, c) {
        this.w.fillStyle = c;
        this.w.fillRect(x, y, w, h);
    }

    fill(x, y, w, h, c) {
        this.ctx.fillStyle = c;
        this.ctx.fillRect(x, y, w, h);
    }

    frameRect(x, y, w, h, t, c) {
        this.fill(x, y, w, t, c);
        this.fill(x, y + h - t, w, t, c);
        this.fill(x, y + t, t, h - 2 * t, c);
        this.fill(x + w - t, y + t, t, h - 2 * t, c);
    }

    /* Text in the pixel font; align -1 left, 0 centre, 1 right. */
    label(x, y, size, color, align, s, shadow = true) {
        const ctx = this.ctx;
        ctx.font = `${size}px "Press Start 2P"`;
        ctx.textBaseline = 'top';
        ctx.textAlign = align < 0 ? 'left' : align > 0 ? 'right' : 'center';
        if (shadow) {
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.fillText(s, Math.round(x) + size / 8 * 2, Math.round(y) + size / 8 * 2);
        }
        ctx.fillStyle = color;
        ctx.fillText(s, Math.round(x), Math.round(y));
    }

    panel(x, y, w, h) {
        this.fill(x, y, w, h, C.PANEL);
        this.frameRect(x, y, w, h, 4, C.PANEL_LINE);
        this.frameRect(x + 6, y + 6, w - 12, h - 12, 2, C.HUD_LINE);
    }

    blit(canvas, x, y, flip = false, scale = 1) {
        const ctx = this.w;
        if (flip) {
            ctx.save();
            ctx.translate(Math.round(x) + canvas.width * scale, Math.round(y));
            ctx.scale(-scale, scale);
            ctx.drawImage(canvas, 0, 0);
            ctx.restore();
        } else {
            ctx.drawImage(canvas, Math.round(x), Math.round(y), canvas.width * scale, canvas.height * scale);
        }
    }

    /* ---- Events: particles, texts, shaking ---- */

    cellCenter(i) {
        return [(i % COLS) * CELL + CELL / 2, FY + Math.floor(i / COLS) * CELL + CELL / 2];
    }

    burst(i, n, colors, speed = 1, up = 1) {
        const [x, y] = this.cellCenter(i);
        for (let k = 0; k < n; k++)
            this.parts.push({
                x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 6,
                vx: (Math.random() - 0.5) * 1.6 * speed, vy: -Math.random() * 1.6 * speed * up,
                g: 0.08, life: 30 + Math.random() * 20, c: colors[k % colors.length],
            });
    }

    text(i, s, color, size = 8) {
        const [x, y] = this.cellCenter(i);
        this.fx.push({ x: x * PIX, y: (y - 10) * PIX, s, color, size, t: 0, life: 60 });
    }

    event(game, e) {
        switch (e.type) {
        case EV.WATER: {
            const [x, y] = this.cellCenter(e.cell);
            for (let k = 0; k < 12; k++)
                this.parts.push({ x: x + 4 + Math.random() * 4, y: y - 10 + Math.random() * 3,
                                  vx: -0.3 - Math.random() * 0.5, vy: 0.4 + Math.random() * 0.6, g: 0.06,
                                  life: 18 + Math.random() * 8, c: k % 2 ? '#6ec8ff' : '#b8e4ff' });
            for (const c of e.cells)
                if (c !== e.cell)
                    this.burst(c, 5, ['#6ec8ff', '#b8e4ff'], 0.6);
            break;
        }
        case EV.EMPTY:
            this.text(e.cell, 'KANNE LEER!', C.RED);
            break;
        case EV.REFILL:
            this.text(e.cell, 'KANNE VOLL', C.BLUE);
            this.burst(e.cell, 10, ['#6ec8ff', '#b8e4ff'], 0.8);
            break;
        case EV.HARVEST:
            this.burst(e.cell, 16, [CROP_COLOR[e.crop], '#ffe060', '#7cd04a'], 1.3);
            this.text(e.cell, e.mult > 1 ? `+${e.points} X${e.mult}` : `+${e.points}`, COMBO_COLOR[e.mult]);
            if (e.comboUp)
                this.fx.push({ x: CX, y: HUD_H + 40, s: `KOMBO X${game.combo}!`, color: COMBO_COLOR[game.combo],
                               size: 16, t: 0, life: 70 });
            break;
        case EV.SOW:
            this.burst(e.cell, 6, ['#7d5232', '#5a381e'], 0.6);
            break;
        case EV.CLEAR:
            this.burst(e.cell, 8, ['#8a7040', '#5a4a2a'], 0.8);
            break;
        case EV.WEED:
            this.burst(e.cell, 8, ['#4c9a2e', '#ffd83a', '#7d5232'], 0.9);
            this.text(e.cell, `+${e.points}`, C.TEXT);
            break;
        case EV.MOW:
            for (const c of e.cells)
                this.burst(c, 4, ['#7fcf5c', '#4f9f3a', '#a8e080'], 0.9);
            break;
        case EV.CUT:
            for (const c of e.cells)
                this.burst(c, 3, ['#3d8a38', '#6cbf48'], 0.7);
            break;
        case EV.CATCH:
            this.burst(e.cell, 10, ['#ffe060', '#ffffff'], 1.2);
            this.text(e.cell, `+${e.points}`, C.YELLOW);
            break;
        case EV.SCARE:
            this.text(e.cell, `KSCHT! +${e.points}`, C.YELLOW);
            break;
        case EV.LOSS:
            this.burst(e.cell, 10, ['#5a4a2a', '#3a3020', '#8a7040'], 0.7);
            this.text(e.cell, e.cause === DEAD.WILTED ? 'VERTROCKNET' : e.cause === DEAD.ROTTEN ? 'VERFAULT' :
                      e.cause === 'dug' ? 'AUSGEBUDDELT' : 'GEFRESSEN', C.RED);
            if (e.comboLost)
                this.fx.push({ x: CX, y: HUD_H + 40, s: 'KOMBO WEG', color: C.RED, size: 16, t: 0, life: 60 });
            this.shake = SHAKE_TICKS;
            break;
        case EV.RAIN:
            this.fx.push({ x: CX, y: HUD_H + 40, s: 'REGENSCHAUER!', color: C.BLUE, size: 16, t: 0, life: 90 });
            break;
        case EV.HEAT:
            this.fx.push({ x: CX, y: HUD_H + 40, s: 'HITZE! ALLES TROCKNET', color: C.ORANGE, size: 16, t: 0,
                           life: 90 });
            break;
        case EV.VERDICT:
            if (e.faults)
                this.warnFlash = 60;
            break;
        }
    }

    tick() {
        this.ticks++;
        for (const p of this.parts) {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.g;
            p.life--;
        }
        this.parts = this.parts.filter(p => p.life > 0);
        for (const f of this.fx)
            f.t++;
        this.fx = this.fx.filter(f => f.t < f.life);
        if (this.shake > 0)
            this.shake--;
        if (this.warnFlash > 0)
            this.warnFlash--;
    }

    /* ---- The garden ---- */

    drawLawn(x0, y0, i, h) {
        const x = i % COLS;
        this.r(x0, y0, CELL, CELL, h === 0 ? (x % 2 ? '#5cb848' : '#53ac40') : h === 1 ? '#52a83e' : '#4d9e3a');
        if (h === 0) {
            const k = hash(i, 1);
            this.r(x0 + (k % 14), y0 + ((k >>> 4) % 14), 1, 1, '#6cc458');
            return;
        }
        const tufts = h === 1 ? 4 : h === 2 ? 9 : 14;
        for (let t = 0; t < tufts; t++) {
            const k = hash(i, t + 2), tx = x0 + (k % 15), ty = y0 + 2 + ((k >>> 4) % 13);
            const tall = h >= 3 ? 3 : 2;
            this.r(tx, ty - tall + 1, 1, tall, '#3d8a2c');
            this.r(tx, ty - tall + 1, 1, 1, '#7fcf5c');
        }
        if (h >= 3) {
            for (let t = 0; t < 2; t++) {
                const k = hash(i, t + 40), fx = x0 + 2 + (k % 11), fy = y0 + 2 + ((k >>> 4) % 11);
                const white = (k >>> 9) % 3 !== 0;
                this.r(fx - 1, fy, 3, 1, white ? '#f4f4f4' : '#ffd83a');
                this.r(fx, fy - 1, 1, 3, white ? '#f4f4f4' : '#ffd83a');
                this.r(fx, fy, 1, 1, white ? '#ffd83a' : '#f0a820');
            }
        }
    }

    drawPath(x0, y0, i) {
        this.r(x0, y0, CELL, CELL, '#d9c28e');
        for (let t = 0; t < 6; t++) {
            const k = hash(i, t + 7);
            this.r(x0 + (k % 15), y0 + ((k >>> 4) % 15), 1 + ((k >>> 8) & 1), 1, t % 2 ? '#bfa673' : '#ece0b8');
        }
    }

    drawBed(x0, y0, i, wet) {
        const x = i % COLS, y = Math.floor(i / COLS);
        this.r(x0, y0, CELL, CELL, wet ? '#56361d' : '#704828');
        for (let fy = 3; fy < CELL; fy += 4) {
            this.r(x0, y0 + fy, CELL, 1, wet ? '#45290f' : '#5a381e');
            this.r(x0, y0 + fy + 1, CELL, 1, wet ? '#62402a' : '#86583a');
        }
        const board = '#a0703c', boardD = '#7a5028';
        if (tileAt(x, y - 1) !== T.BED) {
            this.r(x0, y0, CELL, 2, board);
            this.r(x0, y0 + 2, CELL, 1, boardD);
        }
        if (tileAt(x, y + 1) !== T.BED)
            this.r(x0, y0 + CELL - 2, CELL, 2, board);
        if (tileAt(x - 1, y) !== T.BED)
            this.r(x0, y0, 2, CELL, board);
        if (tileAt(x + 1, y) !== T.BED)
            this.r(x0 + CELL - 2, y0, 2, CELL, boardD);
    }

    drawHedge(x0, y0, i) {
        this.r(x0, y0, CELL, CELL, '#2c6a2c');
        for (let t = 0; t < 10; t++) {
            const k = hash(i, t + 11);
            this.r(x0 + (k % 14), y0 + ((k >>> 4) % 14), 2, 2, t % 3 ? '#3d8a38' : '#1f4f22');
        }
    }

    /* The hedge grows into the plot: bulges and new shoots, the higher the more. */
    drawHedgeGrowth(game) {
        for (const i of HEDGES) {
            const h = game.hedge[i];
            if (!h)
                continue;
            const x = i % COLS, y = Math.floor(i / COLS), x0 = x * CELL, y0 = FY + y * CELL;
            const over = h >= HEDGE_LIMIT;
            const dirs = [];
            if (y === 0)
                dirs.push([0, 1]);
            if (x === 0)
                dirs.push([1, 0]);
            if (x === COLS - 1)
                dirs.push([-1, 0]);
            for (const [dx, dy] of dirs)
                for (let s = 0; s < CELL; s++) {
                    const k = hash(i * 31 + s, dx + 3 * dy);
                    const d = Math.max(0, h * 2 + (k % 3) - 1);
                    const shoot = over && (k >>> 5) % 4 === 0 ? 2 + ((k >>> 8) % 3) : 0;
                    if (dy) {
                        this.r(x0 + s, y0 + CELL, 1, d, '#3a8034');
                        if (h >= 2)
                            this.r(x0 + s, y0 + CELL + d - 1, 1, 1, '#6cbf48');
                        if (shoot)
                            this.r(x0 + s, y0 + CELL + d, 1, shoot, '#8ad85a');
                    } else {
                        const bx = dx > 0 ? x0 + CELL : x0 - d;
                        this.r(bx, y0 + s, d, 1, '#3a8034');
                        if (h >= 2)
                            this.r(dx > 0 ? bx + d - 1 : bx, y0 + s, 1, 1, '#6cbf48');
                        if (shoot)
                            this.r(dx > 0 ? bx + d : bx - shoot, y0 + s, shoot, 1, '#8ad85a');
                    }
                }
        }
    }

    drawFence(x0, y0, gate) {
        this.r(x0, y0, CELL, CELL, '#cdb680');
        if (gate) {
            this.r(x0 + 1, y0 + 3, 14, 11, '#9a6a3a');
            for (const x of [4, 8, 12])
                this.r(x0 + x, y0 + 3, 1, 11, '#7a4a22');
            this.r(x0 + 1, y0 + 5, 14, 1, '#7a4a22');
            this.r(x0 + 1, y0 + 11, 14, 1, '#7a4a22');
            this.r(x0 + 12, y0 + 8, 2, 1, '#e0c040');
            return;
        }
        this.r(x0, y0 + 6, CELL, 1, '#e8e4d8');
        this.r(x0, y0 + 11, CELL, 1, '#e8e4d8');
        for (let x = 1; x < CELL; x += 4) {
            this.r(x0 + x, y0 + 3, 2, 11, '#f2efe6');
            this.r(x0 + x + 1, y0 + 4, 1, 10, '#bdb7a6');
            this.r(x0 + x, y0 + 2, 1, 1, '#f2efe6');
        }
    }

    drawHouse() {
        const x0 = HOUSE.x * CELL, y0 = FY + HOUSE.y * CELL, w = HOUSE.w * CELL, h = HOUSE.h * CELL;
        // walls: green planks
        this.r(x0 + 2, y0 + 18, w - 4, h - 18, '#4f8a62');
        for (let x = 4; x < w - 2; x += 5)
            this.r(x0 + x, y0 + 18, 1, h - 18, '#3e7050');
        // roof
        this.r(x0 - 2, y0 + 2, w + 4, 18, '#b8452e');
        for (let y = 5; y < 20; y += 4)
            this.r(x0 - 2, y0 + y, w + 4, 1, '#962f22');
        for (let y = 3; y < 20; y += 4)
            for (let x = (y % 8 === 3 ? 0 : 3); x < w + 4; x += 6)
                this.r(x0 - 2 + x, y0 + y, 1, 2, '#d8654a');
        this.r(x0 - 2, y0 + 1, w + 4, 2, '#7a2418');
        this.r(x0 - 2, y0 + 20, w + 4, 2, '#5a1c12');
        this.r(x0 + w - 14, y0 - 4, 4, 8, '#707070');
        this.r(x0 + w - 15, y0 - 5, 6, 2, '#505050');
        // window with checked curtains and a flower box
        const wx = x0 + 6, wy = y0 + 25;
        this.r(wx, wy, 18, 13, '#f0ece0');
        this.r(wx + 2, wy + 2, 14, 9, '#7fb8d8');
        this.r(wx + 3, wy + 3, 3, 2, '#c8e8f8');
        this.r(wx + 8, wy + 2, 1, 9, '#f0ece0');
        for (let y = 0; y < 9; y++)
            for (let x = 0; x < 3; x++) {
                const red = (x + y) % 2 === 0;
                this.r(wx + 2 + x, wy + 2 + y, 1, 1, red ? '#d84a4a' : '#f4f4f4');
                this.r(wx + 13 + x, wy + 2 + y, 1, 1, red ? '#d84a4a' : '#f4f4f4');
            }
        this.r(wx - 1, wy + 13, 20, 4, '#8a5a30');
        for (let x = 0; x < 18; x += 3) {
            this.r(wx + x, wy + 11, 2, 2, x % 6 ? '#ffd83a' : '#e83a5a');
            this.r(wx + x + 1, wy + 12, 1, 1, '#3f8f34');
        }
        // door (above the path), house number plate "64"
        const dx = x0 + 30, dy = y0 + 26;
        this.r(dx, dy, 14, h - 26, '#7a4a26');
        this.r(dx + 1, dy + 1, 12, h - 27, '#8f5a2e');
        this.r(dx + 3, dy + 3, 8, 6, '#6a3a1a');
        this.r(dx + 10, dy + 12, 2, 2, '#e0c040');
        const px = x0 + 50, py = y0 + 27;
        this.r(px, py, 11, 9, '#f4f4f0');
        this.r(px, py, 11, 1, '#3060a0');
        const digits = [['###', '#..', '###', '#.#', '###'], ['#.#', '#.#', '###', '..#', '..#']];
        digits.forEach((rows, k) => rows.forEach((row, y) => [...row].forEach((c, x) => {
            if (c === '#')
                this.r(px + 2 + k * 4 + x, py + 2 + y, 1, 1, '#3060a0');
        })));
    }

    drawBarrel(x0, y0) {
        this.r(x0 + 2, y0 + 3, 12, 13, '#3c6e8a');
        this.r(x0 + 2, y0 + 3, 2, 13, '#2c546a');
        this.r(x0 + 12, y0 + 3, 2, 13, '#2c546a');
        this.r(x0 + 2, y0 + 6, 12, 1, '#22424f');
        this.r(x0 + 2, y0 + 12, 12, 1, '#22424f');
        this.r(x0 + 3, y0 + 1, 10, 3, '#5a90ad');
        this.r(x0 + 4, y0 + 2, 8, 1, '#6ec0e0');
        this.r(x0 + 6, y0 + 13, 3, 1, '#c8c8c8');
        this.r(x0 + 7, y0 + 14, 1, 1, '#c8c8c8');
        this.r(x0 + 5, y0 + 8, 1, 3, '#5a90ad');
    }

    drawCompost(x0, y0) {
        this.r(x0 + 1, y0 + 4, 14, 12, '#5a3a1e');
        this.r(x0 + 2, y0 + 2, 12, 4, '#4a301a');
        for (const [x, y, c] of [[3, 3, '#7cd04a'], [7, 2, '#f08a24'], [10, 4, '#a08850'], [5, 4, '#e0302a']])
            this.r(x0 + x, y0 + y, 2, 1, c);
        for (let y = 6; y < 16; y += 3)
            this.r(x0 + 1, y0 + y, 14, 2, '#8a5a30');
        this.r(x0 + 1, y0 + 4, 1, 12, '#6a4220');
        this.r(x0 + 14, y0 + 4, 1, 12, '#6a4220');
    }

    drawWeed(x0, y0, i) {
        const k = hash(i, 99), puff = k % 4 === 0;
        this.r(x0 + 4, y0 + 11, 3, 2, '#4c9a2e');
        this.r(x0 + 9, y0 + 11, 3, 2, '#4c9a2e');
        this.r(x0 + 6, y0 + 10, 4, 3, '#3d8a2c');
        this.r(x0 + 3, y0 + 10, 1, 1, '#4c9a2e');
        this.r(x0 + 12, y0 + 10, 1, 1, '#4c9a2e');
        this.r(x0 + 7, y0 + 6, 1, 4, '#5aaa3e');
        if (puff) {
            this.r(x0 + 5, y0 + 2, 5, 5, '#f4f4f4');
            this.r(x0 + 6, y0 + 3, 3, 3, '#d8d8d8');
        } else {
            this.r(x0 + 6, y0 + 3, 3, 3, '#ffd83a');
            this.r(x0 + 7, y0 + 4, 1, 1, '#f0a820');
            this.r(x0 + 5, y0 + 4, 1, 1, '#ffd83a');
            this.r(x0 + 9, y0 + 4, 1, 1, '#ffd83a');
        }
    }

    drawGround(game) {
        for (let i = 0; i < COLS * ROWS; i++) {
            const x = i % COLS, y = Math.floor(i / COLS), x0 = x * CELL, y0 = FY + y * CELL;
            switch (tileAt(x, y)) {
            case T.LAWN:
                this.drawLawn(x0, y0, i, game.lawn[i]);
                break;
            case T.BED: {
                const p = game.plants[i];
                this.drawBed(x0, y0, i, p && !p.dead && p.water > 0);
                break;
            }
            case T.HEDGE:
                this.drawHedge(x0, y0, i);
                break;
            case T.FENCE:
            case T.GATE:
                this.drawFence(x0, y0, tileAt(x, y) === T.GATE);
                break;
            case T.HOUSE:
                this.r(x0, y0, CELL, CELL, '#4d9e3a');
                break;
            default:
                this.drawPath(x0, y0, i);
            }
        }
        this.drawHedgeGrowth(game);
        for (let i = 0; i < COLS * ROWS; i++) {
            const x = i % COLS, y = Math.floor(i / COLS), x0 = x * CELL, y0 = FY + y * CELL;
            const t = tileAt(x, y);
            if (t === T.BARREL)
                this.drawBarrel(x0, y0);
            else if (t === T.COMPOST)
                this.drawCompost(x0, y0);
            if (game.weed[i])
                this.drawWeed(x0, y0, i);
            const p = game.plants[i];
            if (p)
                drawPlant(this.w, x0, y0, p, this.ticks, i);
        }
        this.drawHouse();
    }

    /* Marks over the beds: thirst drops, ripe sparkles. */
    drawMarks(game) {
        for (const i of BEDS) {
            const p = game.plants[i];
            if (!p || p.dead)
                continue;
            const [x, y] = this.cellCenter(i);
            if (p.stage !== STAGE.RIPE && p.water === 0) {
                const urgent = p.thirst > THIRST_TICKS / 2;
                if (urgent && (this.ticks >> 3) % 2)
                    continue;
                const bob = Math.round(Math.sin(this.ticks / 8 + i) * 1.5);
                const c = urgent ? '#ff6040' : '#6ec8ff';
                this.r(x - 1, y - 15 + bob, 2, 2, c);
                this.r(x - 2, y - 13 + bob, 4, 3, c);
                this.r(x - 1, y - 10 + bob, 2, 1, c);
                this.r(x - 1, y - 13 + bob, 1, 1, '#ffffff');
            } else if (p.stage === STAGE.RIPE) {
                const late = p.ripe > RIPE_TICKS * 2 / 3;
                const phase = (this.ticks + hash(i) % 40) % (late ? 16 : 40);
                if (phase < 6) {
                    const k = hash(i, Math.floor((this.ticks + hash(i) % 40) / 40));
                    const sx = x - 6 + (k % 12), sy = y - 8 + ((k >>> 4) % 8);
                    const c = late ? '#ff8040' : '#ffffff';
                    this.r(sx - 1, sy, 3, 1, c);
                    this.r(sx, sy - 1, 1, 3, c);
                }
            }
        }
    }

    /* Moving things, sorted by their row. */
    drawActors(game, chairman) {
        const list = [];
        const g = game.g, [gx, gy] = game.gardenerPos();
        list.push({ y: gy, draw: () => {
            const back = g.dir === DIR.UP, moving = g.step > 0;
            const frame = moving ? (Math.floor(g.walk / 5) % 2) : 0;
            const tool = back ? 0 : g.tool;
            const s = this.sprite(`g${frame}${tool}${back}`, () =>
                buildSprite(SPR_W, SPR_H, SPR_OX, SPR_OY, put => paintGardener(put, frame, tool, back)));
            const bob = g.act > 0 && g.act > 5 ? 1 : 0;
            this.shadow(gx * CELL + 8, FY + gy * CELL + 15);
            this.blit(s, gx * CELL - SPR_OX, FY + gy * CELL - SPR_OY + bob, g.dir === DIR.LEFT);
        } });
        list.push({ y: 7, draw: () => {
            const s = this.sprite('gnome', () => buildSprite(SPR_W, SPR_H, SPR_OX, SPR_OY, paintGnome));
            this.blit(s, 16 * CELL - SPR_OX, FY + 7 * CELL - SPR_OY);
        } });
        for (const p of game.pests) {
            const t = p.move > 0 ? p.move / p.moveTicks : 0;
            const px = p.x + (p.fx - p.x) * t, py = p.y + (p.fy - p.y) * t;
            list.push({ y: py, draw: () => this.drawPest(p, px, py) });
        }
        if (chairman) {
            const [cx, cy, frame] = chairman;
            list.push({ y: cy, draw: () => {
                const s = this.sprite(`chair${frame}`, () =>
                    buildSprite(SPR_W, SPR_H, SPR_OX, SPR_OY, put => paintChairman(put, frame)));
                this.shadow(cx * CELL + 8, FY + cy * CELL + 15);
                this.blit(s, cx * CELL - SPR_OX, FY + cy * CELL - SPR_OY);
            } });
        }
        list.sort((a, b) => a.y - b.y);
        for (const a of list)
            a.draw();
    }

    shadow(x, y) {
        this.r(x - 5, y, 10, 2, 'rgba(0,0,0,0.25)');
        this.r(x - 4, y + 2, 8, 1, 'rgba(0,0,0,0.18)');
    }

    drawPest(p, px, py) {
        const x0 = px * CELL, y0 = FY + py * CELL;
        if (p.kind === PEST.SNAIL) {
            const s = this.sprite('snail', () => buildSprite(14, 11, 1, 1, paintSnail));
            const wiggle = p.move > 0 && (this.ticks >> 3) % 2 ? 1 : 0;
            this.blit(s, x0 + 1 + wiggle, y0 + 4, p.dir === DIR.LEFT);
            if (p.eat > 0 && (this.ticks >> 4) % 2)
                this.r(x0 + 13, y0 + 3, 2, 2, '#7cd04a');
        } else if (p.kind === PEST.VOLE) {
            const shake = !p.up && (this.ticks >> 2) % 2 ? 1 : 0;
            const size = p.up ? 1 : Math.min(1, p.t / VOLE_DIG);
            const mw = Math.round(6 + 6 * size);
            this.r(x0 + 8 - mw / 2 + shake, y0 + 13 - Math.round(3 * size), mw, Math.round(3 * size) + 2,
                   '#7a5030');
            this.r(x0 + 9 - mw / 2 + shake, y0 + 13 - Math.round(3 * size), 2, 1, '#9a6a40');
            if (p.up) {
                const s = this.sprite('vole', () => buildSprite(16, 11, 1, 1, paintVole));
                const rise = Math.min(4, p.t / 3);
                this.blit(s, x0 + 1, y0 + 9 - rise);
                this.r(x0 + 2, y0 + 13, 12, 3, '#7a5030');
                this.r(x0 + 4, y0 + 13, 2, 1, '#9a6a40');
                this.r(x0 + 10, y0 + 14, 2, 1, '#9a6a40');
            }
        } else {
            const moving = p.move > 0, digging = p.dig > 0;
            const frame = (moving || digging) && (this.ticks >> (p.flee ? 2 : digging ? 2 : 3)) % 2 ? 1 : 0;
            const s = this.sprite(`cat${frame}`, () => buildSprite(18, 14, 1, 1, put => paintCat(put, frame)));
            this.shadow(x0 + 8, y0 + 14);
            this.blit(s, x0 - 1, y0 + 2, p.dir === DIR.LEFT);
            if (digging) {
                if ((this.ticks & 7) === 0)
                    this.parts.push({ x: x0 + 8, y: y0 + 13, vx: (Math.random() - 0.5) * 1.5, vy: -1.2, g: 0.1,
                                      life: 20, c: '#7d5232' });
                if (p.dig > CAT_DIG / 2 && (this.ticks >> 3) % 2)
                    this.r(x0 + 7, y0 - 6, 2, 5, '#ff5a4a');
            }
            if (p.flee)
                this.r(x0 + 7, y0 - 7, 2, 4, '#ffe060');
        }
    }

    drawParticles() {
        for (const p of this.parts)
            this.r(Math.round(p.x), Math.round(p.y), 1, 1, p.c);
    }

    drawWeather(game) {
        const fh = ROWS * CELL;
        if (game.weather === WEATHER.RAIN) {
            const heavy = game.weatherTicks < 4 * 60;
            this.r(0, FY, W, fh, heavy ? 'rgba(40,60,100,0.28)' : 'rgba(60,80,110,0.12)');
            if (heavy) {
                for (let k = 0; k < 70; k++) {
                    const x = (hash(k, 3) % (W + 40)) - 20 + ((this.ticks * 2) % 40);
                    const y = FY + (hash(k, 5) % fh + this.ticks * 5) % fh;
                    this.r(x - Math.floor(y / 8) % 4, y, 1, 4, 'rgba(180,210,255,0.7)');
                }
            }
        } else if (game.weather === WEATHER.HEAT) {
            this.r(0, FY, W, fh, 'rgba(255,170,60,0.12)');
        }
        // the evening of the last day
        const evening = (game.weekTicks - (DAYS - 0.5) * DAY_TICKS) / (DAY_TICKS / 2);
        if (game.phase === PHASE.PLAY && evening > 0)
            this.r(0, FY, W, fh, `rgba(255,120,40,${Math.min(1, evening) * 0.18})`);
        if (game.phase === PHASE.INSPECT)
            this.r(0, FY, W, fh, 'rgba(255,120,40,0.18)');
    }

    chairmanPos(game) {
        if (game.phase !== PHASE.INSPECT)
            return null;
        const legs = CHAIR_ROUTE.slice(1).map((p, k) => Math.abs(p[0] - CHAIR_ROUTE[k][0]) +
                                                          Math.abs(p[1] - CHAIR_ROUTE[k][1]));
        let d = Math.min(1, game.phaseTicks / INSPECT_WALK) * legs.reduce((s, l) => s + l, 0);
        for (let k = 0; k < legs.length; k++) {
            if (d <= legs[k] || k === legs.length - 1) {
                const [ax, ay] = CHAIR_ROUTE[k], [bx, by] = CHAIR_ROUTE[k + 1], f = Math.min(1, d / legs[k]);
                const walking = game.phaseTicks < INSPECT_WALK;
                return [ax + (bx - ax) * f, ay + (by - ay) * f, walking ? (game.phaseTicks >> 3) % 2 : 0];
            }
            d -= legs[k];
        }
        return null;
    }

    drawWorld(game) {
        const w = this.w;
        w.fillStyle = C.HUD_BG;
        w.fillRect(0, 0, W, H);
        this.drawGround(game);
        this.drawMarks(game);
        this.drawActors(game, this.chairmanPos(game));
        this.drawParticles();
        this.drawWeather(game);
        const sx = this.shake ? Math.round((Math.random() - 0.5) * 3) * PIX : 0;
        const sy = this.shake ? Math.round((Math.random() - 0.5) * 3) * PIX : 0;
        this.ctx.drawImage(this.world, 0, FY, W, H - FY, sx, HUD_H + sy, SCREEN_W, SCREEN_H - HUD_H);
    }

    /* ---- Status bar ---- */

    drawWeatherIcon(x, y, weather) {
        const p = (px, py, w, h, c) => this.fill(x + px * 2, y + py * 2, w * 2, h * 2, c);
        if (weather === WEATHER.RAIN) {
            p(2, 2, 10, 4, '#c8d0dc');
            p(4, 0, 5, 3, '#dfe6ee');
            p(3, 7, 1, 2, C.BLUE);
            p(6, 8, 1, 2, C.BLUE);
            p(9, 7, 1, 2, C.BLUE);
            return;
        }
        const c = weather === WEATHER.HEAT ? '#ff7040' : C.YELLOW;
        p(4, 2, 6, 6, c);
        p(3, 3, 8, 4, c);
        p(6, 0, 2, 1, c);
        p(6, 9, 2, 1, c);
        p(0, 4, 2, 2, c);
        p(12, 4, 2, 2, c);
    }

    drawHud(game) {
        this.fill(0, 0, SCREEN_W, HUD_H, C.HUD_BG);
        this.fill(0, HUD_H - 2, SCREEN_W, 2, C.HUD_LINE);
        // score and combo
        this.label(12, 8, 8, C.LABEL, -1, 'PUNKTE');
        this.label(12, 20, 16, C.YELLOW, -1, String(game.score).padStart(6, '0'));
        if (game.combo > 1)
            this.label(118, 24, 8, COMBO_COLOR[game.combo], -1, `X${game.combo}`);
        // week and days
        this.label(164, 8, 8, C.LABEL, -1, `WOCHE ${game.week}`);
        for (let d = 0; d < DAYS; d++) {
            const x = 164 + d * 30, y = 20, now = d === game.day && game.phase === PHASE.PLAY;
            const past = d < game.day || game.phase === PHASE.INSPECT || game.phase === PHASE.GAME_OVER;
            this.fill(x, y, 26, 16, now ? '#e8c860' : past ? '#2c3f27' : '#33502c');
            this.label(x + 14, y + 4, 8, now ? '#2a2010' : past ? C.DIM : C.TEXT, 0, DAY_NAMES[d], false);
            if (now) {
                const f = (game.weekTicks % DAY_TICKS) / DAY_TICKS;
                this.fill(x, y + 17, Math.round(26 * f), 2, C.YELLOW);
            }
        }
        this.drawWeatherIcon(378, 18, game.weather);
        // warnings
        this.label(430, 8, 8, C.LABEL, -1, 'ABMAHNUNGEN');
        for (let k = 0; k < WARNINGS_MAX; k++) {
            const x = 430 + k * 22, y = 20, got = k < game.warnings;
            const flash = got && k === game.warnings - 1 && this.warnFlash > 0 && (this.warnFlash >> 3) % 2;
            this.fill(x, y, 16, 20, got ? (flash ? C.YELLOW : '#f4f0e0') : '#2c3f27');
            if (got) {
                this.fill(x + 3, y + 4, 10, 1, '#9090a0');
                this.fill(x + 3, y + 7, 8, 1, '#9090a0');
                this.frameRect(x + 3, y + 10, 10, 7, 2, '#d83030');
            } else {
                this.frameRect(x, y, 16, 20, 2, '#3f5a37');
            }
        }
        // can, seed
        const y2 = 44;
        this.label(12, y2, 8, C.LABEL, -1, 'KANNE');
        for (let k = 0; k < CAN_MAX; k++) {
            const x = 60 + k * 10, full = k < game.can;
            this.fill(x + 2, y2, 2, 2, full ? C.BLUE : '#2c3f27');
            this.fill(x, y2 + 2, 6, 5, full ? C.BLUE : '#2c3f27');
            this.fill(x + 1, y2 + 7, 4, 1, full ? C.BLUE : '#2c3f27');
        }
        if (game.can === 0 && (this.ticks >> 4) % 2)
            this.label(60, y2, 8, C.RED, -1, 'LEER!', false);
        this.label(170, y2, 8, C.LABEL, -1, 'SAAT');
        this.ctx.drawImage(this.icons[game.seed], 206, y2 - 8, 16, 16);
        this.label(226, y2, 8, C.TEXT, -1, CROPS[game.seed].name);
        // the rules, as the chairman will see them
        const s = game.status();
        const lamp = (x, color, text) => {
            this.fill(x, y2, 8, 8, color);
            this.fill(x + 1, y2 + 1, 3, 3, 'rgba(255,255,255,0.45)');
            this.label(x + 12, y2, 8, C.TEXT, -1, text);
        };
        const tri = (bad, warn) => bad ? C.RED : warn ? C.YELLOW : C.GREEN;
        lamp(318, tri(s.hedge > HEDGE_TOLERANCE, s.hedge > 0), 'HECKE');
        lamp(384, tri(s.lawn > LAWN_TOLERANCE, s.lawn > LAWN_TOLERANCE / 2), 'RASEN');
        lamp(450, tri(s.planted < BEDS_REQUIRED, false), `BEETE ${s.planted}/${BEDS_REQUIRED}`);
        lamp(554, tri(s.mess >= MESS_LIMIT, s.mess >= MESS_LIMIT - 2), 'ORDNUNG');
    }

    drawFx() {
        for (const f of this.fx) {
            const a = f.t / f.life;
            const y = f.y - (f.size > 8 ? 0 : a * 24);
            if (f.size > 8 && f.t < 6 && (f.t & 2))
                continue;
            this.ctx.globalAlpha = a > 0.75 ? (1 - a) * 4 : 1;
            this.label(f.x, y, f.size, f.color, 0, f.s);
            this.ctx.globalAlpha = 1;
        }
    }

    /* ---- Screens ---- */

    drawIntro(game) {
        if (game.firstIntro) {
            const x = 52, y = HUD_H + 22, w = SCREEN_W - 104, h = 360;
            this.panel(x, y, w, h);
            this.label(CX, y + 22, 16, C.YELLOW, 0, 'LAUBENPIEPER');
            this.label(CX, y + 46, 8, C.TEXT, 0, 'DEIN ERSTER SOMMER IM KLEINGARTENVEREIN');
            const lines = this.touch ? [
                ['LINKS WISCHEN + HALTEN', 'GÄRTNER LAUFEN'],
                ['RECHTS TIPPEN', 'SÄEN, GIESSEN, ERNTEN'],
                ['RECHTS HALTEN + LAUFEN', 'MÄHEN, HECKE, UNKRAUT'],
            ] : [
                ['PFEILE / WASD', 'GÄRTNER LAUFEN'],
                ['LEERTASTE', 'SÄEN, GIESSEN, ERNTEN'],
                ['LEERTASTE HALTEN', 'BEIM LAUFEN: MÄHEN,'],
                ['', 'HECKE SCHNEIDEN, UNKRAUT'],
            ];
            let ly = y + 76;
            for (const [k, v] of lines) {
                this.label(x + 36, ly, 8, C.YELLOW, -1, k);
                this.label(x + 236, ly, 8, C.TEXT, -1, v);
                ly += 18;
            }
            ly += 8;
            for (const t of ['AN DER REGENTONNE: GIESSKANNE FÜLLEN',
                             'SCHNECKEN UND WÜHLMÄUSE: AKTION DANEBEN',
                             'REIFES GEMÜSE ERNTEN, BEVOR ES FAULT',
                             'ERNTEN OHNE VERLUST BRINGT KOMBO']) {
                this.label(x + 36, ly, 8, C.TEXT, -1, t);
                ly += 16;
            }
            ly += 12;
            this.label(CX, ly, 8, C.ORANGE, 0, 'SONNTAGABEND KOMMT DER VORSTAND!');
            this.label(CX, ly + 16, 8, C.TEXT, 0, 'HECKE, RASEN, DRITTELREGEL, ORDNUNG');
            this.label(CX, ly + 32, 8, C.RED, 0, '3 ABMAHNUNGEN = KÜNDIGUNG');
            if (game.phaseTicks >= SKIP_TICKS && (this.ticks >> 5) % 2)
                this.label(CX, y + h - 26, 8, C.GREEN, 0, this.touch ? 'TIPPEN: LOS GEHT\'S' :
                           'LEERTASTE: LOS GEHT\'S');
            return;
        }
        const news = game.news();
        const h = 120 + news.length * 18, y = HUD_H + 110;
        this.panel(140, y, SCREEN_W - 280, h);
        this.label(CX, y + 24, 16, C.YELLOW, 0, `WOCHE ${game.week}`);
        news.forEach((n, k) => this.label(CX, y + 56 + k * 18, 8, n.startsWith('ACHTUNG') ? C.ORANGE : C.GREEN, 0,
                                          n));
        this.label(CX, y + h - 40, 8, C.TEXT, 0, 'SONNTAG KOMMT DER VORSTAND');
    }

    drawInspection(game) {
        const v = game.inspection, t = game.phaseTicks;
        if (!v || t < INSPECT_WALK)
            return;
        const x = 96, y = HUD_H + 26, w = SCREEN_W - 192, h = 236;
        this.panel(x, y, w, h);
        this.label(CX, y + 18, 8, C.YELLOW, 0, 'BEGEHUNG DURCH DEN VORSTAND');
        this.label(CX, y + 34, 8, C.LABEL, 0, `WOCHE ${game.week}`);
        v.checks.forEach((c, k) => {
            const ry = y + 58 + k * 24;
            this.label(x + 24, ry, 8, C.TEXT, -1, c.name);
            const shown = t >= INSPECT_WALK + (k + 1) * INSPECT_STAMP;
            if (!shown) {
                if (t >= INSPECT_WALK + k * INSPECT_STAMP && (this.ticks >> 3) % 2)
                    this.label(x + w - 24, ry, 8, C.LABEL, 1, '...');
                return;
            }
            const col = c.ok ? C.GREEN : C.RED, s = c.ok ? 'OK' : 'MANGEL';
            const sw = s.length * 8 + 10;
            this.frameRect(x + w - 24 - sw, ry - 5, sw, 18, 2, col);
            this.label(x + w - 29, ry, 8, col, 1, s, false);
        });
        if (t < INSPECT_VERDICT)
            return;
        const vy = y + 162;
        if (v.terminated) {
            this.label(CX, vy, 16, C.RED, 0, `${game.warnings}. ABMAHNUNG!`);
        } else if (v.model) {
            this.label(CX, vy, 16, C.GREEN, 0, 'MUSTERPARZELLE!');
            if (v.struck)
                this.label(CX, vy + 22, 8, C.TEXT, 0, 'EINE ABMAHNUNG GESTRICHEN');
        } else {
            this.label(CX, vy, 16, C.ORANGE, 0, v.faults === 1 ? '1 ABMAHNUNG' : `${v.faults} ABMAHNUNGEN`);
        }
        this.label(CX, vy + (v.struck ? 40 : 26), 8, C.YELLOW, 0, `+${v.points} PUNKTE`);
        if (t >= INSPECT_VERDICT + SKIP_TICKS && (this.ticks >> 5) % 2)
            this.label(CX, y + h + 10, 8, C.TEXT, 0, this.touch ? 'TIPPEN: WEITER' : 'LEERTASTE: WEITER');
    }

    drawGameOver(game) {
        this.fill(0, HUD_H, SCREEN_W, SCREEN_H - HUD_H, C.SHADE);
        const ctx = this.ctx, t = Math.min(1, game.phaseTicks / 12);
        ctx.save();
        ctx.translate(CX, HUD_H + 150);
        ctx.rotate(-0.12);
        const scale = 2.2 - 1.2 * t;
        ctx.scale(scale, scale);
        this.frameRect(-176, -30, 352, 60, 6, C.RED);
        this.label(0, -16, 32, C.RED, 0, 'GEKÜNDIGT', false);
        ctx.restore();
        if (t < 1)
            return;
        this.label(CX, HUD_H + 220, 8, C.TEXT, 0, 'DREI ABMAHNUNGEN VOM VORSTAND.');
        this.label(CX, HUD_H + 236, 8, C.TEXT, 0, 'DIE PARZELLE WIRD NEU VERPACHTET.');
        this.label(CX, HUD_H + 276, 16, C.YELLOW, 0, `${game.score} PUNKTE`);
        this.label(CX, HUD_H + 302, 8, C.LABEL, 0, game.week === 1 ? 'NACH 1 WOCHE' : `NACH ${game.week} WOCHEN`);
    }

    drawGame(game, paused) {
        this.drawWorld(game);
        this.drawHud(game);
        this.drawFx();
        if (game.phase === PHASE.INTRO) {
            this.fill(0, HUD_H, SCREEN_W, SCREEN_H - HUD_H, 'rgba(16, 26, 8, 0.45)');
            this.drawIntro(game);
        } else if (game.phase === PHASE.INSPECT) {
            this.drawInspection(game);
        } else if (game.phase === PHASE.GAME_OVER) {
            this.drawGameOver(game);
        }
        if (paused) {
            this.fill(0, 0, SCREEN_W, SCREEN_H, C.SHADE);
            this.label(CX, 190, 32, C.YELLOW, 0, 'PAUSE');
            this.label(CX, 250, 8, C.TEXT, 0, this.touch ? 'TIPPEN: WEITER' : 'LEERTASTE: WEITER');
            this.label(CX, 270, 8, C.LABEL, 0, this.touch ? 'LANGE DRÜCKEN: AUFGEBEN' : 'Q: AUFGEBEN');
        }
    }

    drawTitle(demo, scores, last) {
        this.drawWorld(demo);
        this.fill(0, 0, SCREEN_W, HUD_H, C.HUD_BG);
        this.fill(0, HUD_H - 2, SCREEN_W, 2, C.HUD_LINE);
        // logo (drawn at 2x) and club name side by side, centred together
        const logo = this.sprite('logo', () => buildSprite(LOGO[0].length + 2, LOGO.length + 2, 1, 1, put =>
            LOGO.forEach((row, y) => [...row].forEach((c, x) => {
                if (c !== '.')
                    put(x, y, 1, 1, LOGO_COLOR[c]);
            }))));
        const lx = CX - (logo.width * PIX + 12 + 14 * 16) / 2;
        this.ctx.drawImage(logo, lx, (HUD_H - 2 - logo.height * PIX) / 2, logo.width * PIX, logo.height * PIX);
        this.label(lx + logo.width * PIX + 12, 24, 16, C.LABEL, -1, 'KGV SORGENFREI', false);
        this.fill(0, HUD_H, SCREEN_W, SCREEN_H - HUD_H, 'rgba(16, 26, 8, 0.74)');
        this.label(CX, HUD_H + 26, 32, C.YELLOW, 0, 'LAUBENPIEPER');
        const y = HUD_H + 112;
        this.label(CX, y, 8, C.LABEL, 0, 'BESTE GÄRTNER');
        if (!scores.length)
            this.label(CX, y + 26, 8, C.DIM, 0, 'NOCH KEINE ERNTE');
        scores.slice(0, 8).forEach((s, k) => {
            const mine = last && s.id === last.id && (this.ticks >> 4) % 2;
            const c = mine ? C.YELLOW : C.TEXT;
            this.label(CX - 150, y + 22 + k * 18, 8, c, -1, `${k + 1}.`);
            this.label(CX + 40, y + 22 + k * 18, 8, c, 1, String(s.score));
            this.label(CX + 150, y + 22 + k * 18, 8, C.LABEL, 1, `WOCHE ${s.week}`);
        });
        if (last && last.rank > 8)
            this.label(CX, y + 22 + 8 * 18, 8, C.YELLOW, 0, `DEIN PLATZ: ${last.rank}. MIT ${last.score}`);
        if ((this.ticks >> 5) % 2)
            this.label(CX, SCREEN_H - 50, 8, C.TEXT, 0, this.touch ? 'TIPPEN ZUM STARTEN' :
                       'LEERTASTE ODER ENTER ZUM STARTEN');
    }
}
