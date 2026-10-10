/*
 * audio.js - Laubenpieper sound effects and music, synthesized at run time
 * with the Web Audio API (no sound files).
 *
 * The music is a cosy brass band waltz ("oompah-pah") in F major at 150 bpm:
 * a tuba on the first beat, chord stabs on the second and third, a clarinet
 * melody on top, 16 bars looping. It is scheduled a little ahead of time on
 * the audio clock. The audio context starts with the first key press or touch
 * (browsers do not allow sound before).
 */

const MUSIC_LEVEL = 0.22;
const EFFECTS_LEVEL = 0.5;
const BPM = 150;
const BEAT = 60 / BPM;
const LOOKAHEAD = 0.25;         // seconds of music scheduled ahead

const mtof = n => 440 * Math.pow(2, (n - 69) / 12);

/* Chords per bar: [tuba root, tuba alternate, chord notes]. */
const F = [41, 36, [57, 60, 65]], C7 = [36, 43, [55, 58, 64]], BB = [46, 41, [58, 62, 65]];
const CHORDS = [F, F, C7, C7, C7, C7, F, F, F, F, BB, BB, C7, C7, F, F];
/* The melody: [MIDI note or 0 for a rest, beats] per bar, three beats each. */
const MELODY = [
    [[69, 2], [72, 1]], [[77, 2], [72, 1]], [[70, 1], [69, 1], [67, 1]], [[72, 3]],
    [[67, 1], [70, 1], [72, 1]], [[76, 1], [74, 1], [72, 1]], [[69, 1], [72, 1], [69, 1]], [[65, 3]],
    [[69, 1], [70, 1], [72, 1]], [[77, 2], [77, 1]], [[74, 1], [72, 1], [70, 1]], [[74, 3]],
    [[72, 1], [70, 1], [67, 1]], [[64, 1], [67, 1], [72, 1]], [[69, 2], [67, 1]], [[65, 2], [0, 1]],
];

export class Audio {
    constructor() {
        this.ctx = null;
        this.wantMusic = false;
        this.musicOn = false;
        this.muted = false;
        this.mowAt = 0;
        try {
            this.muted = localStorage.getItem('laubenpieper.muted') === '1';
        } catch (e) { /* no storage */ }
    }

    /* Called on the first user input. */
    unlock() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended' && !this.paused)
                this.ctx.resume();
            return;
        }
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx)
            return;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 1;
        this.master.connect(this.ctx.destination);
        this.effects = this.ctx.createGain();
        this.effects.gain.value = EFFECTS_LEVEL;
        this.effects.connect(this.master);
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = MUSIC_LEVEL;
        this.musicGain.connect(this.master);
        const len = this.ctx.sampleRate;
        this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i++)
            data[i] = Math.random() * 2 - 1;
        setInterval(() => this.schedule(), 60);
        if (this.wantMusic)
            this.startMusic();
    }

    /* ---- Voices ---- */

    tone(freq, start, dur, { type = 'square', vol = 0.3, to = null, attack = 0.005, out = this.effects,
                             filter = 0, vibrato = 0 } = {}) {
        const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, start);
        if (to)
            o.frequency.exponentialRampToValueAtTime(to, start + dur);
        if (vibrato) {
            const lfo = ctx.createOscillator(), depth = ctx.createGain();
            lfo.frequency.value = 5.5;
            depth.gain.value = freq * vibrato;
            lfo.connect(depth).connect(o.frequency);
            lfo.start(start);
            lfo.stop(start + dur + 0.05);
        }
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(vol, start + attack);
        g.gain.exponentialRampToValueAtTime(0.001, start + dur);
        let node = o.connect(g);
        if (filter) {
            const f = ctx.createBiquadFilter();
            f.type = 'lowpass';
            f.frequency.value = filter;
            node = node.connect(f);
        }
        node.connect(out);
        o.start(start);
        o.stop(start + dur + 0.02);
    }

    noise(start, dur, { vol = 0.3, freq = 2000, q = 1, type = 'bandpass', to = null, out = this.effects } = {}) {
        const ctx = this.ctx, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        src.buffer = this.noiseBuffer;
        f.type = type;
        f.frequency.setValueAtTime(freq, start);
        if (to)
            f.frequency.exponentialRampToValueAtTime(to, start + dur);
        f.Q.value = q;
        g.gain.setValueAtTime(vol, start);
        g.gain.exponentialRampToValueAtTime(0.001, start + dur);
        src.connect(f).connect(g).connect(out);
        src.start(start, Math.random() * 0.5);
        src.stop(start + dur + 0.02);
    }

    /* ---- Effects ---- */

    play(name, arg = 0) {
        if (!this.ctx || this.ctx.state !== 'running')
            return;
        const t = this.ctx.currentTime;
        switch (name) {
        case 'sow':
            this.tone(300, t, 0.08, { type: 'sine', vol: 0.4, to: 120 });
            this.noise(t, 0.06, { vol: 0.15, freq: 800 });
            break;
        case 'water':
            this.noise(t, 0.35, { vol: 0.35, freq: 3500, to: 1800, q: 2 });
            this.tone(900, t + 0.05, 0.08, { type: 'sine', vol: 0.12, to: 1400 });
            this.tone(1100, t + 0.15, 0.06, { type: 'sine', vol: 0.1, to: 1600 });
            break;
        case 'empty':
        case 'deny':
            this.tone(name === 'empty' ? 160 : 200, t, 0.14, { vol: 0.18, filter: 900 });
            break;
        case 'refill':
            for (let k = 0; k < 6; k++)
                this.tone(300 + k * 60, t + k * 0.05, 0.06, { type: 'sine', vol: 0.25, to: 600 + k * 80 });
            break;
        case 'harvest': {
            const base = 72 + Math.min(4, arg - 1) * 2;
            [0, 4, 7, 12].forEach((n, k) =>
                this.tone(mtof(base + n), t + k * 0.06, 0.25, { type: 'triangle', vol: 0.3 }));
            this.noise(t, 0.1, { vol: 0.12, freq: 600 });
            break;
        }
        case 'clear':
            this.noise(t, 0.18, { vol: 0.25, freq: 500 });
            break;
        case 'weed':
            this.tone(500, t, 0.1, { type: 'sine', vol: 0.3, to: 900 });
            this.noise(t, 0.08, { vol: 0.15, freq: 1200 });
            break;
        case 'mow':
            if (t - this.mowAt < 0.1)
                return;
            this.mowAt = t;
            this.tone(70, t, 0.16, { type: 'sawtooth', vol: 0.12, filter: 700 });
            this.noise(t, 0.14, { vol: 0.12, freq: 3000, q: 0.7 });
            break;
        case 'cut':
            this.noise(t, 0.04, { vol: 0.3, freq: 5000, q: 3 });
            this.noise(t + 0.09, 0.04, { vol: 0.3, freq: 5500, q: 3 });
            break;
        case 'catch':
            this.tone(400, t, 0.12, { type: 'square', vol: 0.18, to: 900, filter: 2500 });
            this.tone(900, t + 0.1, 0.12, { type: 'square', vol: 0.15, to: 1300, filter: 2500 });
            break;
        case 'scare':
            this.noise(t, 0.3, { vol: 0.3, freq: 2500, q: 1.5, to: 1200 });
            this.tone(700, t + 0.1, 0.25, { type: 'sawtooth', vol: 0.08, to: 1100, filter: 3000 });
            break;
        case 'cat':
            this.tone(500, t, 0.35, { type: 'sawtooth', vol: 0.1, to: 750, filter: 1800, vibrato: 0.02 });
            this.tone(750, t + 0.3, 0.25, { type: 'sawtooth', vol: 0.08, to: 450, filter: 1800 });
            break;
        case 'vole':
            for (let k = 0; k < 3; k++)
                this.noise(t + k * 0.08, 0.07, { vol: 0.2, freq: 300, q: 2 });
            break;
        case 'loss':
            this.tone(392, t, 0.18, { type: 'triangle', vol: 0.3 });
            this.tone(330, t + 0.16, 0.18, { type: 'triangle', vol: 0.3 });
            this.tone(262, t + 0.32, 0.35, { type: 'triangle', vol: 0.3, to: 230 });
            break;
        case 'thirsty':
            this.tone(1500, t, 0.05, { type: 'sine', vol: 0.06 });
            break;
        case 'rain':
            this.noise(t, 2.5, { vol: 0.25, freq: 6000, q: 0.5, type: 'highpass' });
            break;
        case 'heat':
            this.tone(220, t, 0.6, { type: 'sine', vol: 0.15, to: 440, vibrato: 0.03 });
            break;
        case 'day':
            this.tone(mtof(84), t, 0.15, { type: 'sine', vol: 0.12 });
            break;
        case 'week':
            [65, 69, 72, 77].forEach((n, k) =>
                this.tone(mtof(n), t + k * 0.1, 0.3, { type: 'square', vol: 0.15, filter: 2200 }));
            break;
        case 'inspect':
            // the club bell
            for (let k = 0; k < 2; k++) {
                this.tone(mtof(79), t + k * 0.35, 0.6, { type: 'sine', vol: 0.3 });
                this.tone(mtof(91), t + k * 0.35, 0.3, { type: 'sine', vol: 0.1 });
            }
            break;
        case 'stamp-ok':
        case 'stamp-bad':
            this.noise(t, 0.12, { vol: 0.5, freq: 200, q: 1, type: 'lowpass' });
            this.tone(90, t, 0.12, { type: 'sine', vol: 0.5, to: 50 });
            if (name === 'stamp-ok')
                this.tone(mtof(84), t + 0.08, 0.25, { type: 'triangle', vol: 0.25 });
            else
                this.tone(110, t + 0.08, 0.3, { type: 'square', vol: 0.12, filter: 800 });
            break;
        case 'model':
            [72, 76, 79, 84, 79, 84].forEach((n, k) =>
                this.tone(mtof(n), t + k * 0.1, 0.3, { type: 'square', vol: 0.14, filter: 2500 }));
            break;
        case 'warning':
            this.tone(196, t, 0.25, { type: 'square', vol: 0.15, filter: 1200 });
            this.tone(185, t + 0.25, 0.4, { type: 'square', vol: 0.15, filter: 1200 });
            break;
        case 'game-over':
            [53, 52, 51, 50].forEach((n, k) =>
                this.tone(mtof(n - 12), t + k * 0.35, k === 3 ? 1.2 : 0.35,
                          { type: 'sawtooth', vol: 0.25, filter: 600, vibrato: k === 3 ? 0.02 : 0 }));
            break;
        case 'pause':
            this.tone(660, t, 0.08, { type: 'square', vol: 0.12, filter: 2000 });
            this.tone(440, t + 0.08, 0.1, { type: 'square', vol: 0.12, filter: 2000 });
            break;
        }
    }

    /* ---- Music ---- */

    startMusic() {
        this.wantMusic = true;
        if (!this.ctx || this.musicOn)
            return;
        this.musicOn = true;
        this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.musicGain.gain.setValueAtTime(MUSIC_LEVEL, this.ctx.currentTime);
        this.bar = 0;
        this.nextBar = this.ctx.currentTime + 0.1;
    }

    fadeMusic(seconds) {
        this.wantMusic = false;
        if (!this.ctx || !this.musicOn)
            return;
        const t = this.ctx.currentTime;
        this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, t);
        this.musicGain.gain.linearRampToValueAtTime(0, t + seconds);
        this.musicOn = false;
    }

    schedule() {
        if (!this.ctx || !this.musicOn || this.ctx.state !== 'running')
            return;
        while (this.nextBar < this.ctx.currentTime + LOOKAHEAD) {
            this.playBar(this.bar, this.nextBar);
            this.bar = (this.bar + 1) % CHORDS.length;
            this.nextBar += 3 * BEAT;
        }
    }

    playBar(bar, t) {
        const [root, alt, chord] = CHORDS[bar], out = this.musicGain;
        this.tone(mtof(bar % 2 ? alt : root), t, BEAT * 0.9,
                  { type: 'triangle', vol: 0.55, attack: 0.01, out });
        this.tone(mtof((bar % 2 ? alt : root) + 12), t, BEAT * 0.5,
                  { type: 'sawtooth', vol: 0.06, attack: 0.01, out, filter: 500 });
        for (const b of [1, 2])
            for (const n of chord)
                this.tone(mtof(n), t + b * BEAT, BEAT * 0.45,
                          { type: 'sawtooth', vol: 0.05, attack: 0.01, out, filter: 1400 });
        let beat = 0;
        for (const [n, len] of MELODY[bar]) {
            if (n)
                this.tone(mtof(n), t + beat * BEAT, len * BEAT * 0.92,
                          { type: 'square', vol: 0.12, attack: 0.02, out, filter: 1800, vibrato: 0.006 });
            beat += len;
        }
    }

    /* Pause: the whole context stops (music and effects). */
    pause(paused) {
        this.paused = paused;
        if (!this.ctx)
            return;
        if (paused) {
            this.ctx.suspend();
        } else {
            this.ctx.resume();
            if (this.musicOn)
                this.nextBar = Math.max(this.nextBar, this.ctx.currentTime + 0.05);
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        try {
            localStorage.setItem('laubenpieper.muted', this.muted ? '1' : '0');
        } catch (e) { /* no storage */ }
        if (this.master)
            this.master.gain.value = this.muted ? 0 : 1;
        return this.muted;
    }
}
