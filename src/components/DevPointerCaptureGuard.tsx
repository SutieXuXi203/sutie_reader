'use client';

import { useEffect } from 'react';

const PATCH_FLAG = '__sutieSafeReleasePointerCapture';

type PatchedElementPrototype = Element & {
  [PATCH_FLAG]?: boolean;
};

export function DevPointerCaptureGuard() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    if (typeof Element === 'undefined') return;

    const elementPrototype = Element.prototype as PatchedElementPrototype;
    if (elementPrototype[PATCH_FLAG]) return;

    const originalReleasePointerCapture = elementPrototype.releasePointerCapture;
    if (typeof originalReleasePointerCapture !== 'function') return;

    elementPrototype[PATCH_FLAG] = true;
    elementPrototype.releasePointerCapture = function releasePointerCapture(pointerId: number) {
      try {
        if (typeof this.hasPointerCapture === 'function' && !this.hasPointerCapture(pointerId)) {
          return;
        }
        return originalReleasePointerCapture.call(this, pointerId);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'NotFoundError') {
          return;
        }
        throw error;
      }
    };
  }, []);

  return null;
}
