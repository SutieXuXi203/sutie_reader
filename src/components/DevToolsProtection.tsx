'use client';

import { useEffect } from 'react';

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

        document.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    return null;
}
