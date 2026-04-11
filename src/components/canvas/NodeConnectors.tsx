/**
 * NodeConnectors.tsx
 * 
 * Renders the left and right connector buttons for a node.
 * Handles pointer events for drag-to-connect functionality.
 */

import React from 'react';
import { Plus } from 'lucide-react';

interface NodeConnectorsProps {
    nodeId: string;
    onConnectorDown: (e: React.PointerEvent, id: string, side: 'left' | 'right') => void;
    selected?: boolean;
    canvasTheme?: 'dark' | 'light';
}

export const NodeConnectors: React.FC<NodeConnectorsProps> = ({
    nodeId,
    onConnectorDown,
    selected = false,
    canvasTheme = 'dark'
}) => {
    const isDark = canvasTheme === 'dark';

    const buttonClassName = `absolute h-12 w-12 rounded-full border flex items-center justify-center transition-all z-10 cursor-pointer ${selected ? 'opacity-100 scale-100' : 'opacity-0 scale-95 group-hover/node:opacity-100 group-hover/node:scale-100'} ${isDark
            ? 'border-white/24 bg-[#1a1a1a]/96 text-white/88 shadow-[0_18px_36px_rgba(0,0,0,0.42)] hover:border-[#77c3ff] hover:bg-[#202020] hover:text-white'
            : 'border-neutral-300 bg-white text-neutral-500 hover:text-neutral-900 hover:border-neutral-400 shadow-sm'
        }`;

    return (
        <>
            {/* Left Connector */}
            <button
                type="button"
                aria-label={`Connect left side of ${nodeId}`}
                title="连接到左侧"
                data-node-id={nodeId}
                data-connector-side="left"
                onPointerDown={(e) => {
                    e.stopPropagation();
                    onConnectorDown(e, nodeId, 'left');
                }}
                className={`-left-[58px] top-1/2 -translate-y-1/2 ${buttonClassName}`}
            >
                <Plus size={18} />
            </button>

            {/* Right Connector */}
            <button
                type="button"
                aria-label={`Connect right side of ${nodeId}`}
                title="连接到右侧"
                data-node-id={nodeId}
                data-connector-side="right"
                onPointerDown={(e) => {
                    e.stopPropagation();
                    onConnectorDown(e, nodeId, 'right');
                }}
                className={`-right-[58px] top-1/2 -translate-y-1/2 ${buttonClassName}`}
            >
                <Plus size={18} />
            </button>
        </>
    );
};
