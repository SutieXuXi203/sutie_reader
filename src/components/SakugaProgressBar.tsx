'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

// Helper math utilities
const TAU = Math.PI * 2;
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rnd = (a = 1, b?: number) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const out = (t: number) => 1 - Math.pow(1 - t, 3);
const inn = (t: number) => t * t * t;
const back = (t: number) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);

// Spring physics simulation
class Spring {
  x: number;
  v: number;
  to: number;
  k: number;
  d: number;

  constructor(x = 0, k = 300, d = 20) {
    this.x = x;
    this.v = 0;
    this.to = x;
    this.k = k;
    this.d = d;
  }

  step(dt: number) {
    if (!(dt > 0)) return this.x;
    for (let n = Math.ceil(dt / 0.008), h = dt / n; n--; ) {
      this.v += (-this.k * (this.x - this.to) - this.d * this.v) * h;
      this.x += this.v * h;
    }
    return this.x;
  }
}

// Lobe cluster definition for the rolling cloud
const LOBES: [number, number, number][] = [
  [0, -0.9, 0.9],
  [0.7, -0.5, 0.7],
  [-0.65, -0.7, 0.65],
  [0.3, -1.4, 0.65],
  [-0.35, -1.35, 0.58],
  [0.95, -1.1, 0.48],
  [-1.0, -0.25, 0.48],
  [0.55, 0.25, 0.45],
  [-0.75, 0.4, 0.45],
  [-1.3, 0.7, 0.32],
  [0.15, 0.65, 0.35],
];

// Manga SFX letterings: don (ドン!) and gogo (ゴゴゴゴ)
const WORDS: Record<string, [number, number, string]> = {
  don: [
    520,
    297,
    "M3 290C4 287 6 283 7 281C9 277 18 252 19 248C20 246 19 246 15 250C13 253 11 255 11 254C12 253 15 242 19 230C24 218 30 195 34 180C38 165 43 144 46 133C49 122 51 113 51 113C50 113 50 110 51 107C52 104 52 98 52 94C53 86 57 69 63 54C69 41 69 40 70 41C71 42 72 42 74 40L76 38L75 40C75 43 76 42 85 34C90 28 94 24 95 24C95 24 94 27 92 30C87 40 88 40 100 28C106 22 111 18 111 18C111 18 110 20 109 22C107 28 108 28 114 23C123 15 124 15 122 19C120 21 120 22 121 21C124 20 132 14 136 10C141 5 141 5 136 14C132 23 132 23 135 23C136 22 136 22 135 24C133 29 131 36 132 36C132 36 133 35 135 34C136 32 138 31 138 31C138 31 136 39 132 48C123 71 97 147 98 148C98 148 101 147 105 145C108 144 116 141 122 138C128 136 141 131 150 128C179 117 232 98 234 98C235 98 233 101 229 104C226 108 223 111 223 111C224 111 222 114 219 117C213 124 213 124 216 123C218 123 218 124 214 128C209 133 205 139 204 142C203 143 203 143 205 142C208 140 208 141 204 147C201 150 200 152 201 152C204 151 203 152 197 159C193 163 192 166 194 166C196 166 192 169 182 173C176 175 172 177 170 176C169 176 166 177 163 178C157 180 144 185 143 185C143 185 143 184 144 184C144 183 144 183 143 183C142 183 137 185 132 186C122 189 99 198 90 201L85 204L80 216C73 232 61 258 59 261C57 263 57 263 58 258L58 252L55 255C54 256 52 259 51 260C50 261 49 262 50 261C51 258 48 261 43 267C37 274 36 274 39 268C40 265 41 262 41 262C41 261 36 266 29 273C23 280 18 285 17 285C17 284 18 282 19 279C23 271 22 272 14 281C10 286 5 291 4 292L1 296L3 290ZM223 274C222 274 221 273 220 273C219 273 218 272 218 271C218 266 214 260 212 260C211 261 210 260 210 258C208 251 208 247 208 247C208 246 208 246 207 246C207 246 206 243 207 239C207 234 207 232 206 232C205 233 205 232 206 227C207 225 210 222 214 218C222 213 223 212 220 217C218 221 220 220 233 211C244 203 247 201 243 205C242 207 241 208 241 208C242 210 296 172 333 144C343 137 352 131 353 130C356 129 382 110 397 98C403 94 408 90 408 90C408 91 403 99 397 107C393 112 393 116 396 111C397 111 398 110 398 110C398 111 394 116 390 122C379 135 379 136 382 134C384 133 384 133 383 134C379 140 373 148 372 149C371 151 371 151 381 143C385 140 388 138 389 138C389 138 386 142 382 147C378 151 375 155 375 156C377 158 353 182 344 189C342 191 332 199 323 206C304 222 280 241 277 242C276 242 273 244 269 247C259 255 226 276 225 276C225 276 224 275 223 274ZM373 264C372 264 372 263 372 262C372 261 371 259 370 259C369 257 369 257 370 252C373 244 372 243 370 246C366 249 366 248 369 243C373 237 378 226 378 225C378 222 386 217 398 211C411 204 415 202 413 204C412 205 412 206 412 207C413 207 429 203 432 202C434 201 435 200 429 212C425 222 425 222 432 217C436 214 436 214 428 226C424 231 420 238 418 242L414 249L403 255C397 258 391 261 389 263C384 266 384 266 385 263C385 261 383 261 378 264C375 265 374 265 373 264ZM392 199C392 196 438 54 441 46C444 41 453 28 458 23C463 18 463 18 462 21C461 23 460 25 459 27L458 29L461 27C462 26 467 22 470 19C477 13 477 13 473 21C471 24 470 27 470 27C471 27 476 24 483 20C496 12 497 11 495 14C491 17 494 16 505 9C512 5 517 2 517 2C518 2 515 6 512 10C507 17 500 29 502 29C502 29 504 28 506 26C509 25 511 23 512 23C514 22 514 21 507 32C499 44 497 49 502 44C505 41 504 44 498 55C488 70 483 79 477 92C473 98 470 103 470 104C467 107 455 132 456 131C460 128 459 131 450 145C446 153 438 166 434 174C425 190 425 191 426 184L426 179L420 184C416 188 412 191 411 193C409 196 408 194 410 189C411 185 410 185 405 191C403 193 401 195 401 194C402 191 401 192 396 196C394 199 392 200 392 199ZM226 147C228 140 228 140 226 141C225 141 225 140 227 136C232 128 235 122 234 121C234 120 235 118 237 115C245 103 245 103 242 104C241 105 241 104 244 102C250 96 260 88 264 87C268 86 282 87 281 88C281 89 283 89 285 89C287 89 289 90 289 90C289 91 294 92 299 94C304 95 309 96 309 97C310 98 319 102 325 102C331 103 331 103 326 108C325 110 323 113 323 113C323 114 320 118 316 121C312 125 309 129 309 129C310 129 307 132 304 136L299 142L290 142C279 141 265 142 245 148C235 150 226 152 225 153L223 153L226 147ZM133 121C133 103 157 28 160 39C160 41 161 41 166 35C173 28 174 28 173 32C171 36 172 36 180 32C184 30 188 28 188 29C189 29 192 28 195 26C201 22 202 22 199 29C197 31 196 36 195 39C192 46 167 99 165 101C164 102 164 102 164 100C164 99 163 100 158 104C153 109 153 109 153 107L153 104L149 107C147 108 143 112 139 116C136 120 133 122 133 121ZM180 104C180 97 192 64 203 43C210 29 220 16 218 22L218 25L225 21C231 16 233 15 231 18C226 25 230 23 245 13C251 10 255 7 255 8C255 8 253 12 251 15C246 22 245 25 248 22C251 20 250 22 246 30C241 38 240 39 243 38C245 37 245 36 228 62C212 85 208 91 209 87C209 85 208 84 207 86C206 86 204 88 202 90L198 93L199 90C200 87 198 88 188 98C184 102 180 105 180 104Z",
  ],
  gogo: [
    520,
    288,
    "M1 284C1 281 1 274 1 268L2 257L15 253C22 250 32 247 37 246C42 245 46 244 46 243C47 243 50 217 49 216C48 215 31 222 19 228C4 235 6 235 6 231C7 229 7 229 6 229C4 230 4 231 6 220C8 215 9 208 10 206C10 202 10 201 13 201C15 200 24 197 34 194C43 190 51 187 52 187C52 187 52 189 52 192C52 198 53 199 60 196C66 193 79 190 80 190C80 191 79 198 77 207C73 225 70 242 70 254C69 263 72 261 44 270C28 275 18 279 1 288C0 288 0 286 1 284ZM84 281C84 280 85 273 87 263C88 254 89 245 89 243L88 239L102 234C109 232 122 228 129 226C136 224 143 222 143 222C143 221 149 189 149 187C149 185 148 186 133 192C119 197 105 204 97 209L93 211L93 207C94 203 94 202 93 203C91 203 91 202 93 198C98 186 102 173 102 169C102 167 103 166 103 166C109 164 125 159 137 154C145 151 151 149 152 149C152 149 153 152 154 156C154 160 154 163 155 163C155 163 159 161 164 159C171 156 190 152 191 153C191 153 189 164 185 178C179 205 174 231 174 240L174 245L163 248C157 250 148 253 142 255C131 258 101 271 90 278C85 281 84 281 84 281ZM191 269C191 268 192 260 193 251C195 241 196 230 196 225L196 217L200 216C203 215 217 211 233 206C249 200 263 196 265 196C267 195 268 194 269 194C269 193 276 149 276 148C275 147 241 160 230 166C226 168 219 172 214 175C201 182 202 183 205 165C206 159 208 147 209 140L211 126L215 125C217 125 231 121 247 116C263 110 276 106 278 106C280 105 280 105 281 114C281 122 281 123 283 123C284 122 289 120 294 118C307 113 327 109 327 112C327 113 324 125 321 139C312 173 305 212 307 219L307 223L298 226C293 228 283 231 276 232C259 237 209 259 196 267C192 269 192 269 191 269ZM321 255C321 253 333 202 333 201C334 201 333 199 332 197C330 192 331 191 338 191C342 190 357 187 372 184C387 180 404 176 410 175C415 174 420 173 420 172C421 172 433 117 433 115C433 113 430 114 418 118C396 124 369 136 353 146C348 150 344 152 343 152C343 151 343 148 344 144C346 137 346 136 343 138C340 139 340 139 344 124C349 108 352 94 352 88C352 83 353 81 356 81C359 81 381 75 402 69C421 63 436 59 437 59C437 60 437 65 438 70C438 76 439 81 439 82C440 82 446 80 454 77C466 72 469 72 481 70C500 68 498 68 496 73C496 76 493 84 491 92C489 99 485 112 483 119C478 132 470 167 469 178C468 182 467 187 466 191C465 195 465 200 465 203L464 209L455 211C450 212 441 215 435 216C429 218 420 221 415 223C395 228 372 237 353 246C332 257 332 257 332 254C333 251 331 251 326 254C322 257 321 258 321 255ZM55 179L56 164L64 160C69 158 74 156 74 157C74 157 73 164 71 173L67 188L62 191C59 193 56 194 56 194C55 194 55 187 55 179ZM72 188C72 186 78 162 79 161C80 160 93 155 94 155C95 155 93 162 89 173L85 184L79 186C73 188 72 188 72 188ZM157 140C157 130 157 121 156 119C156 116 156 115 159 115C160 114 166 112 171 109C176 107 181 105 181 106C182 106 181 111 179 116C178 122 176 132 175 138C174 145 173 151 173 151C172 151 158 158 158 158C157 158 157 150 157 140ZM178 149C178 146 185 115 186 114C187 113 202 107 204 107C206 107 205 113 199 131L195 146L188 148C184 149 180 150 179 150C179 150 178 150 178 149ZM285 103C285 95 285 84 285 78C285 67 285 67 288 66C293 65 300 63 308 59C320 54 319 54 315 69C311 81 308 93 306 102C305 108 305 109 302 109C301 110 296 112 292 114C288 115 285 117 285 117C284 117 284 111 285 103ZM311 106C311 105 313 97 316 87C318 77 320 68 321 67C321 66 322 65 323 64C325 63 345 56 346 56C348 56 347 62 341 78C332 104 334 102 323 105C318 106 313 107 312 108C312 108 311 107 311 106ZM443 74C442 73 442 15 442 14C443 14 445 13 447 13C450 13 458 10 466 6C474 3 481 0 481 1C482 1 480 10 478 20C475 30 472 45 470 52C469 60 467 66 467 66C466 66 461 68 455 71C442 76 443 75 443 74ZM475 64C475 64 478 52 481 37L487 11L503 5C512 2 519 0 519 1C521 2 505 55 502 59C502 59 497 61 490 62C484 63 478 64 477 65C476 65 475 65 475 64Z",
  ],
};

interface SakugaProgressBarProps {
  progress: number; // 0 to 100
  isDark?: boolean;
  className?: string;
  onDone?: () => void;
}

export function SakugaProgressBar({
  progress,
  isDark = true,
  className,
  onDone,
}: SakugaProgressBarProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [displayPct, setDisplayPct] = useState('0%');

  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  // Animation references and state
  const stateRef = useRef({
    p: 0,
    goal: 0,
    spd: 0,
    acc: 0,
    t: 0,
    doneAt: 0,
    said: false,
    particles: [] as Array<{
      t: number;
      life: number;
      draw: (k: number, t: number, dt: number) => void;
      dead?: boolean;
    }>,
    lobes: LOBES.map(([x, y, r], i) => ({
      x,
      y,
      r,
      ph: rnd(6.28),
      w: rnd(1.4, 2.6),
      i,
    })),
    peb: [0.14, 0.31, 0.5, 0.69, 0.87].map((u) => ({
      u,
      s: rnd(2.8, 4.5),
      ph: rnd(6.28),
      rot: rnd(-0.5, 0.5),
      lift: new Spring(0, 70, 7),
      pts: [
        [-1, 0.4],
        [-0.5, -0.8],
        [0.5, -1],
        [1, 0.1],
        [0.3, 0.9],
      ].map(([x, y]) => [x * rnd(0.8, 1.2), y * rnd(0.8, 1.2)]),
    })),
    size: new Spring(0, 90, 13),
    lag: new Spring(0, 120, 16),
    ck: new Spring(0, 260, 13),
    tag: new Spring(1, 500, 13),
    rest: new Spring(0, 160, 14),
    lastPct: '',
    bakedWords: new Map<string, HTMLCanvasElement>(),
  });

  // Update target progress
  useEffect(() => {
    const s = stateRef.current;
    const clampedGoal = clamp(progress / 100);
    s.goal = clampedGoal;
  }, [progress]);

  // Main animation frame loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Palette configured to match our design system seamlessly
    const P = isDark
      ? {
          fill: '#ffffff',
          shade: '#2d2d2d',
          line: '#ffffff',
          accent: '#ffffff',
          sfx: ['#ffffff', '#000000'], // Crisp white fill with black outline
          sparkle: '#fde047',
          ground: '#737373',
        }
      : {
          fill: '#ffffff',
          shade: '#e5e5e5',
          line: '#171717',
          accent: '#171717',
          sfx: ['#171717', '#ffffff'],
          sparkle: '#eab308',
          ground: '#a3a3a3',
        };

    const s = stateRef.current;

    // Particle manager
    const addParticle = (
      life: number,
      draw: (k: number, t: number, dt: number) => void
    ) => {
      s.particles.push({ t: 0, life, draw });
    };

    // Helper: draw manga cloud blob
    const drawBlob = (
      cs: [number, number, number][],
      lw = 1.3,
      deep = 1.3
    ) => {
      const u = new Path2D();
      for (const [x, y, r] of cs) {
        if (r > 0.3) {
          u.moveTo(x + r, y);
          u.arc(x, y, r, 0, TAU);
        }
      }
      ctx.save();
      ctx.lineWidth = lw * 2;
      ctx.strokeStyle = P.line;
      ctx.stroke(u);
      ctx.restore();

      ctx.save();
      ctx.clip(u);
      ctx.fillStyle = P.shade;
      ctx.fillRect(-1000, -1000, 2000, 2000);
      const r = cs[0] ? cs[0][2] : 6;
      ctx.save();
      ctx.translate(r * 0.2 * deep, -r * 0.26 * deep);
      ctx.fillStyle = P.fill;
      ctx.fill(u);
      ctx.restore();

      ctx.strokeStyle = P.line;
      ctx.lineWidth = lw * 0.75;
      ctx.beginPath();
      for (const [x, y, rr] of cs) {
        if (rr > 2.5) {
          ctx.moveTo(x + Math.cos(-2.7) * rr, y + Math.sin(-2.7) * rr);
          ctx.arc(x, y, rr, -2.7, -0.5);
        }
      }
      ctx.stroke();
      ctx.restore();
    };

    // Helper: draw pebble/shard shape
    const drawShape = (path: Path2D, lw = 1.1, off = 2.5, fill = P.fill) => {
      ctx.save();
      ctx.lineWidth = lw * 2;
      ctx.strokeStyle = P.line;
      ctx.stroke(path);
      ctx.restore();

      ctx.save();
      ctx.clip(path);
      ctx.fillStyle = P.shade;
      ctx.fillRect(-1000, -1000, 2000, 2000);
      ctx.translate(-off * 0.7, -off);
      ctx.fillStyle = fill;
      ctx.fill(path);
      ctx.restore();
    };

    // Anime 4-point sparkle star (kira ✨)
    const kira = (
      x: number,
      y: number,
      { r = 6.5, life = 0.5, col = P.sparkle } = {}
    ) => {
      addParticle(life, (k, t) => {
        const s = r * Math.pow(Math.sin(k * Math.PI), 0.6);
        const q = s * 0.16;
        const p = new Path2D();
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.sin(t * 3) * 0.2);
        p.moveTo(0, -s);
        p.quadraticCurveTo(q, -q, s * 0.75, 0);
        p.quadraticCurveTo(q, q, 0, s);
        p.quadraticCurveTo(-q, q, -s * 0.75, 0);
        p.quadraticCurveTo(-q, -q, 0, -s);
        ctx.fillStyle = col;
        ctx.fill(p);
        ctx.strokeStyle = P.line;
        ctx.lineWidth = 1.0;
        ctx.stroke(p);
        ctx.restore();
      });
    };

    // Smoke puff particle
    const puff = (
      x: number,
      y: number,
      { n = 3, size = 8, vx = 0, vy = -12, life = 0.55 } = {}
    ) => {
      const lobes = Array.from({ length: n }, (_, i) => ({
        a: (i / n) * TAU + rnd(0.6),
        d: rnd(0.25, 0.85) * size,
        r: rnd(0.55, 0.95) * size,
        ph: rnd(TAU),
        sp: rnd(0.6, 1.2),
      }));
      lobes.unshift({ a: 0, d: 0, r: size, ph: 0, sp: 1 });
      addParticle(life, (k, t) => {
        const grow = back(clamp(t / 0.2));
        const die = 1 - inn(clamp((k - 0.55) / 0.45));
        const px = x + vx * out(k) * life;
        const py = y + vy * out(k) * life;
        drawBlob(
          lobes.map((l) => [
            px + Math.cos(l.a + t * 0.9 * l.sp) * l.d * (0.5 + out(k) * 0.9),
            py + Math.sin(l.a + t * 0.9 * l.sp) * l.d * (0.5 + out(k) * 0.9) - out(k) * 4 * l.sp,
            l.r * grow * die * (1 + Math.sin(t * 9 + l.ph) * 0.05),
          ]),
          1.2,
          1.2
        );
      });
    };

    // Speed lines trailing the cloud
    const lines = (
      x: number,
      y: number,
      { n = 4, dir = Math.PI, len = 28, spread = 10, life = 0.25 } = {}
    ) => {
      for (let i = 0; i < n; i++) {
        const o = rnd(-spread, spread);
        const l = len * rnd(0.6, 1.2);
        const d = rnd(0, 0.2);
        const w = rnd(0.9, 1.8);
        addParticle(life, (k) => {
          const kk = clamp((k - d) / (1 - d));
          const a = out(kk);
          const b = inn(kk);
          const px = x - Math.sin(dir) * o;
          const py = y + Math.cos(dir) * o;
          ctx.strokeStyle = P.line;
          ctx.lineWidth = w * (1 - b);
          ctx.beginPath();
          ctx.moveTo(px + Math.cos(dir) * l * b * 1.3, py + Math.sin(dir) * l * b * 1.3);
          ctx.lineTo(px + Math.cos(dir) * l * (0.2 + a * 1.2), py + Math.sin(dir) * l * (0.2 + a * 1.2));
          if (kk > 0) ctx.stroke();
        });
      }
    };

    // Accent speed ticks
    const ticks = (
      x: number,
      y: number,
      { n = 2, r = 10, len = 7, dir = -0.9, life = 0.35, fan = 0.4 } = {}
    ) => {
      addParticle(life, (k) => {
        const a = out(clamp(k / 0.5));
        const b = inn(clamp((k - 0.4) / 0.6));
        ctx.save();
        ctx.fillStyle = P.accent;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const an = dir + (i - (n - 1) / 2) * fan;
          const r0 = r + len * b * 1.2;
          const r1 = r + len * a * 1.2;
          const hw = 0.07 + 2.2 / (r1 + 8);
          if (r1 - r0 < 0.6) continue;
          ctx.moveTo(x + Math.cos(an) * r0, y + Math.sin(an) * r0);
          ctx.lineTo(x + Math.cos(an - hw) * r1, y + Math.sin(an - hw) * r1);
          ctx.lineTo(x + Math.cos(an + hw) * r1, y + Math.sin(an + hw) * r1);
          ctx.closePath();
        }
        ctx.fill();
        ctx.restore();
      });
    };

    // Star burst on completion
    const burst = (x: number, y: number, { r = 32, spikes = 10, life = 0.35 } = {}) => {
      const j = Array.from({ length: spikes * 2 }, (_, i) =>
        i % 2 ? rnd(0.35, 0.5) : rnd(0.75, 1.15)
      );
      const rot = rnd(TAU);
      const pins = Array.from({ length: 6 }, (_, i) => ({
        a: (i / 6) * TAU + rnd(0.5),
        l: rnd(1.2, 1.5),
        w: rnd(0.03, 0.05),
      }));
      const star = (R: number, turn: number, inner = 1) => {
        const p = new Path2D();
        j.forEach((m, i) => {
          const a = rot + turn + (i / j.length) * TAU;
          const rr = R * (i % 2 ? m * inner : m);
          p[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        });
        p.closePath();
        return p;
      };
      addParticle(life, (k) => {
        const R = r * out(clamp(k / 0.3));
        const hollow = 1 + inn(clamp((k - 0.35) / 0.65)) * 1.3;
        const r0 = R * 0.6 * Math.min(1.8, hollow);
        ctx.save();
        ctx.fillStyle = P.sparkle;
        ctx.beginPath();
        for (const n of pins) {
          const l = R * n.l;
          if (l <= r0) continue;
          ctx.moveTo(x + Math.cos(n.a - n.w) * r0, y + Math.sin(n.a - n.w) * r0);
          ctx.lineTo(x + Math.cos(n.a) * l, y + Math.sin(n.a) * l);
          ctx.lineTo(x + Math.cos(n.a + n.w) * r0, y + Math.sin(n.a + n.w) * r0);
        }
        ctx.fill();
        ctx.restore();

        const big = star(R * 1.12, 0.16, hollow);
        ctx.save();
        ctx.fillStyle = P.shade;
        ctx.fill(big);
        ctx.strokeStyle = P.line;
        ctx.lineWidth = 1.1;
        ctx.stroke(big);
        ctx.restore();

        drawShape(star(R * 0.85, 0, hollow), 1.2, 2.5);
      });
    };

    // Flying shards of crystal on completion
    const shards = (x: number, y: number, { n = 7, speed = 180, size = 5, life = 0.7 } = {}) => {
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + rnd(-Math.PI * 0.6, Math.PI * 0.6);
        const v = speed * rnd(0.5, 1.1);
        const sc0 = size * rnd(0.6, 1.2);
        const spin = rnd(-6, 6);
        const pts: [number, number][] = [
          [-1.4, 0.1],
          [-0.6, -0.7],
          [1.2, -0.45],
          [1.5, 0.15],
          [0.4, 0.75],
        ].map(([px, py]) => [px * rnd(0.8, 1.2), py * rnd(0.8, 1.2)]);
        addParticle(life * rnd(0.7, 1), (k, t) => {
          const px = x + Math.cos(a) * v * t;
          const py = y + Math.sin(a) * v * t + 320 * t * t;
          const sc = sc0 * (1 - inn(clamp((k - 0.6) / 0.4)));
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(spin * t + a);
          const p = new Path2D();
          pts.forEach(([u, w], q) => p[q ? 'lineTo' : 'moveTo'](u * sc, w * sc));
          p.closePath();
          drawShape(p, 1.0, sc * 0.4, P.fill);
          ctx.restore();
        });
      }
    };

    // Manga SFX lettering bake and spring draw
    const bakeWord = (name: string, fc: string, oc: string) => {
      const key = `${name}_${fc}_${oc}`;
      let c = s.bakedWords.get(key);
      if (c) return c;
      const wData = WORDS[name];
      if (!wData) return null;
      const [w, h, d] = wData;
      const pad = 16;
      const e = w * 0.035;
      c = document.createElement('canvas');
      c.width = w + pad * 2;
      c.height = h + pad * 2;
      const x = c.getContext('2d')!;
      x.translate(pad, pad);
      x.lineJoin = 'round';
      const path = new Path2D(d);
      x.strokeStyle = oc;
      x.fillStyle = oc;
      x.lineWidth = e * 2;
      x.stroke(path);
      x.fill(path);
      x.fillStyle = fc;
      x.fill(path);
      s.bakedWords.set(key, c);
      return c;
    };

    const sfx = (name: string, x: number, y: number, { size = 80, rot = -0.1, life = 1.6 } = {}) => {
      const wData = WORDS[name];
      if (!wData) return;
      const c = bakeWord(name, P.sfx[0], P.sfx[1]);
      if (!c) return;
      const spring = new Spring(0.2, 520, 17);
      spring.to = 1;
      let lastT = 0;
      const k0 = size / wData[0];
      addParticle(life, (k, t) => {
        const sc = spring.step(t - lastT) * (1 - inn(clamp((k - 0.86) / 0.14))) * k0;
        lastT = t;
        ctx.save();
        ctx.translate(x + Math.sin(t * 31) * 0.8, y + Math.cos(t * 27) * 0.8);
        ctx.rotate(rot + Math.sin(t * 6) * 0.03);
        ctx.drawImage(c, (-c.width / 2) * sc, (-c.height / 2) * sc, c.width * sc, c.height * sc);
        ctx.restore();
      });
    };

    // Pre-bake both manga SFX letters ahead of time so they render immediately without any frame drop
    bakeWord('gogo', P.sfx[0], P.sfx[1]);
    bakeWord('don', P.sfx[0], P.sfx[1]);

    // Render loop function
    const loop = (now: number) => {
      const dt = clamp((now - lastTime) / 1000, 0, 0.034);
      lastTime = now;
      s.t += dt;

      // Handle canvas resize and DPR
      const rect = containerRef.current?.getBoundingClientRect();
      const w = rect?.width || 280;
      const h = 150;
      const dpr = Math.min(2.5, window.devicePixelRatio || 1);

      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      // Bar geometry in local canvas coordinates
      const barH = 22;
      const barW = Math.max(160, w - 24);
      const cx = w / 2;
      const cy = 75; // Centered on the bar (leaving top 75px for manga SFX lettering without clipping or touching sticker)
      const L = cx - barW / 2;
      const R = cx + barW / 2;
      const gy = cy + barH / 2 + 13; // Ground line y

      // Progress ease calculation
      const was = s.p;
      if (!s.doneAt && s.p < s.goal) {
        const rate = s.goal >= 1 ? Math.max(3.2, (s.goal - s.p) * 6) : clamp((s.goal - s.p) * 4, 0.15, 1.2);
        s.p = Math.min(s.goal, s.p + dt * rate);
      }
      s.spd = lerp(s.spd, dt > 0 ? (s.p - was) / dt : 0, Math.min(1, dt * 8));

      const p = s.p;
      const lead = L + 3 + (barW - 6) * p;
      const spd = s.spd;

      // Ground line drawing
      const reach = clamp(p * 1.25 + (s.doneAt ? 1 : 0));
      const gx1 = lerp(L + 6, R - 6, reach);
      if (reach > 0.02) {
        ctx.strokeStyle = P.ground;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(L + 6, gy);
        ctx.lineTo(gx1, gy);
        for (let x = L + 18; x < gx1 - 6; x += 28) {
          ctx.moveTo(x, gy);
          ctx.lineTo(x + 2.5, gy - 3);
          ctx.moveTo(x + 4.5, gy);
          ctx.lineTo(x + 6, gy - 1.8);
        }
        ctx.stroke();
      }

      // 5 bouncing pebbles on the ground line
      for (const q of s.peb) {
        const px = L + barW * q.u;
        q.lift.to = !s.doneAt && lead > px - 12 ? 1 : 0;
        const up = q.lift.step(dt);
        if (reach < q.u - 0.04 && up < 0.01) continue;
        const py = gy - q.s * 0.7 - up * (5 + q.s * 1.2) + Math.sin(s.t * 3 + q.ph) * 1.8 * up;
        const path = new Path2D();
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(q.rot + up * Math.sin(s.t * 2 + q.ph) * 0.4);
        q.pts.forEach(([x, yy], n) => path[n ? 'lineTo' : 'moveTo'](x * q.s, yy * q.s));
        path.closePath();
        drawShape(path, 1.0, q.s * 0.45);
        ctx.restore();
      }

      // Resting smoke puffs when done
      s.rest.to = s.doneAt ? 1 : 0;
      const rs = Math.max(0, s.rest.step(dt));
      if (rs > 0.02) {
        for (const [x, d] of [
          [L + 24, -1],
          [R - 28, 1],
        ]) {
          drawBlob(
            [
              [x, gy - 6 * rs, 5.5 * rs],
              [x + 6 * d, gy - 4 * rs, 4 * rs],
              [x - 4 * d, gy - 3 * rs, 3.5 * rs],
            ].map(([bx, by, br]) => [bx, by, br]),
            1.1
          );
        }
      }

      // Rolling storm cloud on the leading edge
      s.size.to = s.doneAt || p < 0.015 ? 0 : 5 + 9 * Math.sqrt(p);
      s.lag.to = spd;
      const S = Math.max(0, s.size.step(dt));
      const drag = s.lag.step(dt);

      if (S > 0.5) {
        drawBlob(
          s.lobes.map((l) => {
            const boil = 1 + 0.14 * Math.sin(s.t * l.w + l.ph);
            const roll = 0.85 + 0.18 * Math.sin(s.t * 2.6 - l.i * 0.9);
            return [
              lead + 2 + (l.x + Math.cos(s.t * l.w * 0.7 + l.ph) * 0.1 - drag * 1.2 * Math.max(0, -l.y) * 0.5) * S,
              cy - 2 + (l.y + Math.sin(s.t * l.w * 0.7 + l.ph) * 0.1) * S,
              l.r * S * boil * roll,
            ];
          }),
          1.3,
          1.3
        );
      }

      // Subtle checkmark on finish (bỏ vẽ đè lên chữ ドン! để chữ tiếng Nhật hiển thị trọn vẹn và sắc nét nhất)
      s.ck.to = s.doneAt ? 1 : 0;
      s.ck.step(dt);

      // Motion emission: speed lines, wisps, and manga gogo rumble sound
      if (!s.doneAt) {
        if (p > 0.06 && spd > 0.02) {
          s.acc += dt * (3 + spd * 40);
          while (s.acc > 1) {
            s.acc -= 1;
            const curS = 5 + 9 * Math.sqrt(p);
            if (Math.random() < 0.45) {
              puff(lead - curS * rnd(0.8, 1.4), cy - curS * rnd(0.1, 0.7), {
                size: rnd(2.2, 3.8) + p * 1.5,
                n: 2,
                vx: -rnd(25, 60),
                vy: rnd(-8, 2),
                life: rnd(0.3, 0.5),
              });
            } else {
              lines(lead - curS * 1.2, cy - curS * rnd(0.2, 0.9), {
                n: 1,
                dir: Math.PI,
                len: 20 + spd * 100,
                spread: 2.5,
                life: 0.22,
              });
            }
          }
        }

        // Manga rumble SFX: gogo (ゴゴゴゴ) - placed safely in the gap
        if (!s.said && p > 0.35 && p < 0.85) {
          s.said = true;
          sfx('gogo', cx - 18, cy - 36, { size: 85, rot: -0.08, life: 2.0 });
          ticks(cx + 36, cy - 44, { dir: -0.5, n: 2, r: 3, len: 7, life: 0.5 });
          ticks(L + 6, cy - 26, { dir: Math.PI + 0.3, n: 2, r: 3, len: 7, life: 0.5 });
        }
      }

      // Finish celebration: impact burst, ドン!, shards & celebration sparkles
      if (!s.doneAt && (p >= 0.995 || (s.goal >= 1.0 && p >= 0.985))) {
        s.p = 1.0;
        s.doneAt = s.t;
        burst(R - 35, cy, { r: 42, spikes: 12, life: 0.5 });
        shards(R - 25, cy, { n: 8, speed: 170, size: 4.8, life: 0.8 });
        sfx('don', cx - 10, cy - 36, { size: 95, rot: -0.08, life: 1.8 });
        for (let i = 0; i < 5; i++) {
          kira(cx + rnd(-50, 50), cy - rnd(20, 38), {
            r: rnd(5, 8.5),
            life: rnd(0.5, 0.9),
          });
        }
        s.tag.x = 1.3;

        // Giữ hiệu ứng chữ ドン! và trạng thái Hoàn tất trên màn hình 1.4s để người dùng chiêm ngưỡng rõ ràng
        setTimeout(() => {
          onDoneRef.current?.();
        }, 1400);
      }

      // Update particle effects
      s.particles = s.particles.filter((pt) => {
        pt.t += dt;
        if (pt.t >= pt.life) return false;
        ctx.save();
        pt.draw(pt.t / pt.life, pt.t, dt);
        ctx.restore();
        return true;
      });

      // Update UI percent display with spring bounce
      const n = s.doneAt ? 100 : Math.floor(p * 100);
      const key = s.doneAt ? 'Hoàn tất ✓' : `${n}%`;
      if (key !== s.lastPct) {
        s.lastPct = key;
        setDisplayPct(key);
        if (n % 5 === 0 && !s.doneAt) s.tag.x = 1.08;
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isDark]);

  // Derived percent for width style
  const fillWidth = `${Math.min(100, Math.max(0, progress))}%`;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex flex-col items-center justify-center select-none w-60 sm:w-68 max-w-full",
        className
      )}
    >
      {/* VFX Canvas overlay for clouds, speed lines, pebbles, stars and manga SFX */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 z-20"
        style={{ width: '100%', height: '150px' }}
        aria-hidden="true"
      />

      {/* Modern Sakuga Progress Bar Track & Fill */}
      <div
        className={cn(
          "relative w-full h-[20px] sm:h-[22px] rounded-full overflow-hidden transition-all duration-200 z-10",
          isDark
            ? "bg-neutral-900 border-2 border-neutral-700/80 shadow-[0_2px_12px_rgba(0,0,0,0.5)]"
            : "bg-neutral-100 border-2 border-neutral-300 shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
        )}
      >
        {/* Animated Fill Bar */}
        <div
          className={cn(
            "relative h-full transition-all duration-100 ease-out rounded-full overflow-hidden",
            isDark
              ? "bg-white shadow-[0_0_12px_rgba(255,255,255,0.85)]"
              : "bg-neutral-950 shadow-[0_0_8px_rgba(0,0,0,0.25)]"
          )}
          style={{ width: fillWidth }}
        >
          {/* Classic manga glossy highlights inside the fill */}
          <div
            className={cn(
              "absolute top-[2.5px] left-3 w-2 h-[7px] rounded-[1px] -skew-x-[26deg] pointer-events-none opacity-90",
              isDark ? "bg-neutral-900" : "bg-white"
            )}
          />
          <div
            className={cn(
              "absolute top-[2.5px] left-6 w-1.5 h-[7px] rounded-[1px] -skew-x-[26deg] pointer-events-none opacity-80",
              isDark ? "bg-neutral-900" : "bg-white"
            )}
          />
        </div>
      </div>

      {/* Styled Minimalist Percentage Badge consistent with Lubu design system */}
      <div className="mt-6 flex items-center justify-between w-full px-1 z-10">
        <span
          className={cn(
            "text-[10px] sm:text-[11px] font-sans font-semibold tracking-wider uppercase transition-colors duration-200",
            isDark ? "text-neutral-400" : "text-neutral-500"
          )}
        >
          {progress < 100 ? 'Đang tải...' : 'Hoàn tất'}
        </span>
        <div
          className={cn(
            "px-2.5 py-0.5 rounded-[6px] text-[11px] sm:text-[12px] font-mono font-bold tabular-nums transition-all duration-200 border",
            isDark
              ? "bg-neutral-900/90 border-neutral-700/80 text-white shadow-[2px_2px_0_rgba(255,255,255,0.15)]"
              : "bg-white border-neutral-300 text-neutral-900 shadow-[2px_2px_0_rgba(0,0,0,0.1)]"
          )}
        >
          {displayPct}
        </div>
      </div>
    </div>
  );
}
