'use client';

import { useEffect } from 'react';

/**
 * Răn đe mở DevTools (có thể bị bypass).
 * - Chặn chuột phải (context menu)
 * - Chặn phím tắt: F12, Ctrl+Shift+I/J/C, Ctrl+U
 * - debugger định kỳ khi DevTools mở (pause execution)
 */
export function DevToolsProtection() {
    useEffect(() => {
        const handleContextMenu = (e: MouseEvent) => e.preventDefault();

        const handleKeyDown = (e: KeyboardEvent) => {
            const blocked = [
                e.key === 'F12',
                (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C'),
                (e.ctrlKey || e.metaKey) && e.key === 'U',
            ].some(Boolean);
            if (blocked) e.preventDefault();
        };

        const debuggerInterval = setInterval(() => {
            // eslint-disable-next-line no-debugger
            debugger;
        }, 1500);

        document.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('keydown', handleKeyDown);
            clearInterval(debuggerInterval);
        };
    }, []);

    return null;
}
