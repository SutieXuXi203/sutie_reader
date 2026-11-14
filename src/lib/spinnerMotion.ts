// Motion Prompt #070 · MIT License (c) 2026 Shohei Ohtaki · https://showheyohtaki.github.io/motion-prompt/#070

export const clamp = (v: number, a = 0, b = 1): number => Math.max(a, Math.min(b, v));
export const seg = (t: number, a: number, b: number): number => clamp((t - a) / (b - a));
export const eo = (x: number): number => 1 - Math.pow(1 - x, 3);

export interface SpinnerFrameState {
  /** Scrim opacity 0 to 0.78 */
  scrimOpacity: number;
  /** Spinner opacity 0 to 1 */
  loadOpacity: number;
  /** Done checkmark opacity 0 to 1 */
  doneOpacity: number;
  /** Done checkmark scale 0.7 to 1 */
  doneScale: number;
  /** Overall overlay opacity factor 0 to 1 */
  overlayOpacity: number;
  /** Current rotation angle of the spinner arc in degrees (468 deg/sec) */
  rotationDeg: number;
  /** Whether the full motion cycle has finished */
  isComplete: boolean;
}

/**
 * Calculates the state of Motion Prompt #070 at time `t` (seconds since click).
 * Spec:
 * - Click "Send" / "Xong" at t = 0
 * - 0.05–0.2s (linear): scrim (opacity 0.78) and spinner fade in
 * - Spinner: pale ring (r=26, thickness=6), blue 243° (1.35π) arc turning 1.3 times/sec
 * - 1.95–2.05s: spinner fades
 * - 1.95–2.2s: blue circle (r=28) with white check scales 0.7 -> 1 (easeOutCubic)
 * - 2.75–3.0s: everything fades out linearly
 */
export function getSpinnerFrame(t: number): SpinnerFrameState {
  // Normalize t relative to click (in spec sample, click was at t=1.0s, cycle ended at 4.0s)
  const specT = t + 1.0;

  const load = seg(specT, 1.05, 1.2) * (1 - seg(specT, 2.95, 3.05));
  const done = seg(specT, 2.95, 3.15) * (1 - seg(specT, 3.75, 4.0));
  const ov = Math.max(load, done);

  const doneScale = 0.7 + 0.3 * eo(seg(specT, 2.95, 3.2));
  const rotationDeg = (t * 1.3 * 360) % 360;

  return {
    scrimOpacity: 0.78 * ov,
    loadOpacity: load,
    doneOpacity: done,
    doneScale,
    overlayOpacity: ov,
    rotationDeg,
    isComplete: specT >= 4.0,
  };
}

