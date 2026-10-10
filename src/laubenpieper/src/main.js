/*
 * main.js - Laubenpieper in the browser: title screen with the best scores,
 * the game loop at a fixed 60 ticks per second, keyboard and touch input, pause.
 *
 * Keys: arrows or WASD walk, Space or Enter is the action button (held while
 * walking: mow, cut the hedge, pull weeds), Escape or P pause (Q in the pause
 * quits the run), M sound on/off, F fullscreen.
 * Touch: the left half of the screen is a joystick (put a finger down and
 * slide it), the right half the action button.
 */
import { DIR, EV, Game, PHASE, TICK_HZ } from './game.js';
import { Audio } from './audio.js';
import { Renderer } from './draw.js';

const MAX_CATCH_UP = 5;         // logic ticks per frame at most (after a stall)
const STICK_MIN = 14;           // pixels: the touch joystick's dead zone
const LONG_PRESS = 700;         // ms: quits the run in the pause
const SCORES = 'laubenpieper.scores';
const MAX_SCORES = 10;

const canvas = document.getElementById('screen');
const touch = window.matchMedia('(pointer: coarse)').matches;
const renderer = new Renderer(canvas, touch);
const audio = new Audio();

let mode = 'title';             // 'title' or 'game'
let game = null;
let paused = false;
let demo = newDemo();
let lastScore = null;
let scores = loadScores();
let held = [];                  // direction keys held, the last one counts
let stickDir = DIR.NONE;        // touch joystick
let tapDir = DIR.NONE;          // a short tap walks at least one cell
let a = false;                  // action pressed since the last tick
let aKeys = 0;                  // action keys and touches held

function newDemo() {
    const d = new Game(Date.now() >>> 0);
    d.startAt(3);
    return d;
}

/* ---- Best scores (only in this browser) ---- */

function loadScores() {
    try {
        return JSON.parse(localStorage.getItem(SCORES)) || [];
    } catch (e) {
        return [];
    }
}

function saveScore(score, week) {
    const scores = loadScores(), entry = { id: Date.now(), score, week };
    if (score <= 0)
        return null;
    scores.push(entry);
    scores.sort((p, q) => q.score - p.score || p.id - q.id);
    try {
        localStorage.setItem(SCORES, JSON.stringify(scores.slice(0, MAX_SCORES)));
    } catch (e) { /* no storage */ }
    return { ...entry, rank: scores.indexOf(entry) + 1 };
}

/* ---- Flow ---- */

function startGame() {
    game = new Game((Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0);
    mode = 'game';
    paused = false;
    a = false;
    audio.startMusic();
}

function endGame() {
    lastScore = saveScore(game.score, game.week);
    scores = loadScores();
    mode = 'title';
    game = null;
    paused = false;
    audio.pause(false);
    demo = newDemo();
    audio.startMusic();
}

function setPaused(p) {
    if (mode !== 'game' || paused === p)
        return;
    paused = p;
    a = false;
    if (p)
        audio.play('pause');
    // let the pause sound start before the context stops
    setTimeout(() => { if (paused === p) audio.pause(p); }, p ? 150 : 0);
}

function playEvent(e) {
    switch (e.type) {
    case EV.HARVEST:
        audio.play('harvest', e.mult);
        break;
    case EV.STAMP:
        audio.play(e.ok ? 'stamp-ok' : 'stamp-bad');
        break;
    case EV.VERDICT:
        audio.play(e.terminated ? 'warning' : e.model ? 'model' : 'warning');
        break;
    case EV.GAME_OVER:
        audio.fadeMusic(1);
        audio.play('game-over');
        break;
    case EV.WEEK:
        audio.startMusic();
        audio.play('week');
        break;
    case EV.DAY:
        if (e.day > 0)
            audio.play('day');
        break;
    default:
        audio.play(e.type);
    }
    renderer.event(game, e);
}

/* ---- Input ---- */

function heldDir() {
    return held.length ? held[held.length - 1] : stickDir;
}

function actionDown() {
    aKeys++;
    if (mode === 'title')
        startGame();
    else if (paused)
        setPaused(false);
    else
        a = true;
}

function actionUp() {
    aKeys = Math.max(0, aKeys - 1);
}

const KEY_DIRS = {
    ArrowRight: DIR.RIGHT, ArrowDown: DIR.DOWN, ArrowLeft: DIR.LEFT, ArrowUp: DIR.UP,
    KeyD: DIR.RIGHT, KeyS: DIR.DOWN, KeyA: DIR.LEFT, KeyW: DIR.UP,
};
const ACTION_KEYS = ['Space', 'Enter', 'NumpadEnter'];
const KEY_NAMES = { ' ': 'Space', Enter: 'Enter' };

/* The key's code, or a code made from its name for events without one. */
function keyCode(ev) {
    if (ev.code)
        return ev.code;
    return KEY_NAMES[ev.key] || ev.key;
}

function toggleFullscreen() {
    const el = document.documentElement;
    if (document.fullscreenElement)
        document.exitFullscreen();
    else if (el.requestFullscreen)
        el.requestFullscreen().catch(() => {});
}

function updateButtons() {
    document.getElementById('sound').textContent = audio.muted ? 'TON AUS' : 'TON AN';
    document.getElementById('pause').style.visibility = mode === 'game' ? 'visible' : 'hidden';
}

window.addEventListener('keydown', ev => {
    audio.unlock();
    const code = keyCode(ev);
    if (code in KEY_DIRS) {
        ev.preventDefault();
        const d = KEY_DIRS[code];
        held = held.filter(h => h !== d);
        held.push(d);
        tapDir = d;
        return;
    }
    if (ACTION_KEYS.includes(code)) {
        ev.preventDefault();
        if (!ev.repeat)
            actionDown();
        return;
    }
    if (ev.repeat)
        return;
    switch (code) {
    case 'Escape':
    case 'KeyP':
        setPaused(!paused);
        break;
    case 'KeyQ':
        if (paused)
            endGame();
        break;
    case 'KeyM':
        audio.toggleMute();
        break;
    case 'KeyF':
        toggleFullscreen();
        break;
    }
});

window.addEventListener('keyup', ev => {
    const code = keyCode(ev);
    if (code in KEY_DIRS) {
        const d = KEY_DIRS[code];
        // WASD and the arrows may both hold a direction
        const other = Object.keys(KEY_DIRS).some(k => k !== code && KEY_DIRS[k] === d && keysDown.has(k));
        if (!other)
            held = held.filter(h => h !== d);
    }
    if (ACTION_KEYS.includes(code))
        actionUp();
});

const keysDown = new Set();
window.addEventListener('keydown', ev => keysDown.add(keyCode(ev)), true);
window.addEventListener('keyup', ev => keysDown.delete(keyCode(ev)), true);
window.addEventListener('blur', () => {
    held = [];
    aKeys = 0;
    keysDown.clear();
});

/* Touch: one finger on the left half steers, one on the right half acts. */
let stick = null;               // { id, x, y }
const actionTouches = new Map(); // id -> start time

document.addEventListener('touchstart', ev => {
    if (ev.target.closest('button'))
        return;
    audio.unlock();
    ev.preventDefault();
    for (const t of ev.changedTouches) {
        if (mode === 'game' && !paused && t.clientX < window.innerWidth / 2 && !stick) {
            stick = { id: t.identifier, x: t.clientX, y: t.clientY };
        } else {
            actionTouches.set(t.identifier, performance.now());
            if (!paused)
                actionDown();
        }
    }
}, { passive: false });

document.addEventListener('touchmove', ev => {
    if (ev.target.closest('button'))
        return;
    ev.preventDefault();
    for (const t of ev.changedTouches) {
        if (!stick || t.identifier !== stick.id)
            continue;
        const dx = t.clientX - stick.x, dy = t.clientY - stick.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < STICK_MIN)
            stickDir = DIR.NONE;
        else
            stickDir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? DIR.RIGHT : DIR.LEFT) : (dy > 0 ? DIR.DOWN : DIR.UP);
    }
}, { passive: false });

function touchEnd(ev) {
    if (ev.target.closest && ev.target.closest('button'))
        return;
    ev.preventDefault();
    for (const t of ev.changedTouches) {
        if (stick && t.identifier === stick.id) {
            stick = null;
            stickDir = DIR.NONE;
            continue;
        }
        const start = actionTouches.get(t.identifier);
        if (start === undefined)
            continue;
        actionTouches.delete(t.identifier);
        if (paused)
            if (performance.now() - start >= LONG_PRESS)
                endGame();
            else
                setPaused(false);
        else
            actionUp();
    }
}

document.addEventListener('touchend', touchEnd, { passive: false });
document.addEventListener('touchcancel', touchEnd, { passive: false });

canvas.addEventListener('mousedown', () => {
    audio.unlock();
    actionDown();
});
window.addEventListener('mouseup', () => actionUp());

document.getElementById('pause').addEventListener('click', ev => {
    audio.unlock();
    setPaused(!paused);
    ev.currentTarget.blur();
});
document.getElementById('sound').addEventListener('click', ev => {
    audio.unlock();
    audio.toggleMute();
    ev.currentTarget.blur();
});
document.getElementById('full').addEventListener('click', ev => {
    toggleFullscreen();
    ev.currentTarget.blur();
});

/* Embedded in a page (iframe on the same site): the X button asks the page to close the game. */
if (window.parent !== window) {
    document.documentElement.classList.add('embedded');
    document.getElementById('close').addEventListener('click', () => {
        window.parent.postMessage('laubenpieper:close', location.origin);
    });
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden)
        setPaused(true);
});

/* ---- Loop ---- */

function tick() {
    if (mode === 'title') {
        demo.tick(DIR.NONE, false, false);
        if (demo.phase !== PHASE.PLAY)
            demo = newDemo();
        renderer.tick();
        return;
    }
    const g = game.g, ready = g.step === 0 && g.act === 0;
    const d = heldDir();
    game.tick(d === DIR.NONE ? tapDir : d, a, aKeys > 0);
    if (ready)
        tapDir = DIR.NONE;
    a = false;
    for (const e of game.events)
        playEvent(e);
    renderer.tick();
    if (game.done)
        endGame();
}

let last = performance.now(), acc = 0;

function frame(now) {
    acc += (now - last) / 1000;
    last = now;
    if (paused) {
        acc = 0;
    } else {
        let n = 0;
        while (acc >= 1 / TICK_HZ && n < MAX_CATCH_UP) {
            tick();
            acc -= 1 / TICK_HZ;
            n++;
        }
        if (n === MAX_CATCH_UP)
            acc = 0;
    }
    if (mode === 'title')
        renderer.drawTitle(demo, scores, lastScore);
    else
        renderer.drawGame(game, paused);
    updateButtons();
    requestAnimationFrame(frame);
}

document.fonts.load('16px "Press Start 2P"').finally(() => requestAnimationFrame(frame));
