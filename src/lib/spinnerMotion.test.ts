import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getSpinnerFrame, eo, seg, clamp } from './spinnerMotion';

describe('Motion Prompt #070 — Spinner math & easing spec', () => {
  it('clamp và seg tính đúng các mốc biên', () => {
    assert.equal(clamp(-1), 0);
    assert.equal(clamp(0.5), 0.5);
    assert.equal(clamp(2), 1);

    assert.equal(seg(1.0, 1.05, 1.2), 0);
    assert.equal(seg(1.2, 1.05, 1.2), 1);
    assert.ok(Math.abs(seg(1.125, 1.05, 1.2) - 0.5) < 1e-6);
  });

  it('eo tính chuẩn theo easeOutCubic', () => {
    assert.equal(eo(0), 0);
    assert.equal(eo(1), 1);
    assert.equal(eo(0.5), 0.875);
  });

  it('0.05s -> 0.2s: scrim và spinner mờ dần hiện ra', () => {
    const frameStart = getSpinnerFrame(0);
    assert.equal(frameStart.scrimOpacity, 0);
    assert.equal(frameStart.loadOpacity, 0);

    const frameIn = getSpinnerFrame(0.2);
    assert.ok(Math.abs(frameIn.scrimOpacity - 0.78) < 1e-6);
    assert.equal(frameIn.loadOpacity, 1);
    assert.equal(frameIn.doneOpacity, 0);
  });

  it('1.95s -> 2.2s: spinner mờ đi và vòng tròn checkmark phóng to 0.7 -> 1.0', () => {
    const frameBefore = getSpinnerFrame(1.9);
    assert.equal(frameBefore.doneOpacity, 0);
    assert.equal(frameBefore.doneScale, 0.7);

    const frameScaled = getSpinnerFrame(2.2);
    assert.equal(frameScaled.doneScale, 1.0);
    assert.equal(frameScaled.loadOpacity, 0);
  });

  it('2.75s -> 3.0s: toàn bộ mờ dần và kết thúc', () => {
    const frameFade = getSpinnerFrame(2.875);
    assert.ok(frameFade.doneOpacity < 1);
    assert.ok(frameFade.doneOpacity > 0);

    const frameEnd = getSpinnerFrame(3.0);
    assert.equal(frameEnd.isComplete, true);
    assert.equal(frameEnd.overlayOpacity, 0);
  });
});

