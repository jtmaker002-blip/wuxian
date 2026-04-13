/**
 * ConnectionsLayer.tsx
 * 
 * Renders the SVG connections between nodes on the canvas.
 * Includes permanent connections and temporary drag connections.
 */

import React from 'react';
import { NodeData, Viewport } from '../../types';
import { calculateConnectionPath } from '../../utils/connectionHelpers';
import { getCanvasNodeDimensions } from '../../utils/canvasNodeLayout';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the width of a node based on its type and content
 * @param node - The node to calculate width for
 * @param parentNode - Optional parent node (used for Editor nodes to determine width when they have input content)
 */
const getNodeWidth = (node: NodeData, parentNode?: NodeData): number => {
    return getCanvasNodeDimensions(node, parentNode).width;
};

/**
 * Estimate the height of a node based on its type and aspect ratio.
 * The node card height is determined by the content's aspect ratio or min-height for empty states.
 * Note: The title label is positioned ABOVE the card (-top-8), not inside it.
 * @param node - The node to calculate height for
 * @param parentNode - Optional parent node (used for Editor nodes to determine if they have input content)
 */
const getNodeHeight = (node: NodeData, parentNode?: NodeData): number => {
    return getCanvasNodeDimensions(node, parentNode).height;
};

interface Connection {
    parentId: string;
    childId: string;
}

interface ConnectionsLayerProps {
    nodes: NodeData[];
    viewport: Viewport;
    // Connection dragging state
    isDraggingConnection: boolean;
    connectionStart: { nodeId: string; handle: 'left' | 'right' } | null;
    tempConnectionEnd: { x: number; y: number } | null;
    // Selection
    selectedConnection: Connection | null;
    onEdgeClick: (e: React.MouseEvent, parentId: string, childId: string) => void;
    canvasTheme?: 'dark' | 'light';
}

export const ConnectionsLayer: React.FC<ConnectionsLayerProps> = ({
    nodes,
    viewport,
    isDraggingConnection,
    connectionStart,
    tempConnectionEnd,
    selectedConnection,
    onEdgeClick,
    canvasTheme = 'dark'
}) => {
    const connectionStroke = canvasTheme === 'dark' ? '#d9dde3' : '#94a3b8';
    const glowStroke = canvasTheme === 'dark' ? '#67b7ff' : '#3b82f6';
    const lineShadow = canvasTheme === 'dark'
        ? 'drop-shadow(0 0 10px rgba(96,184,255,0.36))'
        : 'drop-shadow(0 0 8px rgba(59,130,246,0.26))';

    // Render permanent connections between nodes
    const connections: React.ReactNode[] = [];

    nodes.forEach(node => {
        if (!node.parentIds || node.parentIds.length === 0) return;

        node.parentIds.forEach(parentId => {
            const parent = nodes.find(n => n.id === parentId);
            if (!parent) return;

            const startX = parent.x + getNodeWidth(parent);
            const startY = parent.y + getNodeHeight(parent) / 2;
            const endX = node.x;
            const endY = node.y + getNodeHeight(node, parent) / 2;

            const path = calculateConnectionPath(startX, startY, endX, endY, 'right');
            const isSelected = selectedConnection?.parentId === parentId && selectedConnection?.childId === node.id;

            connections.push(
                <g
                    key={`${parent.id}-${node.id}`}
                    onClick={(e) => onEdgeClick(e, parent.id, node.id)}
                    className="cursor-pointer group pointer-events-auto"
                >
                    <path d={path} stroke="transparent" strokeWidth="20" fill="none" />
                    <path
                        d={path}
                        stroke={connectionStroke}
                        strokeWidth={isSelected ? '3.35' : '2.85'}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                        className={`transition-colors ${!isSelected ? (canvasTheme === 'dark' ? 'group-hover:stroke-neutral-200' : 'group-hover:stroke-slate-500') : ''}`}
                    />
                    <path
                        d={path}
                        stroke={glowStroke}
                        strokeWidth={isSelected ? '5.4' : '4.4'}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray={isSelected ? '24 82 30 118' : '20 108 26 124'}
                        fill="none"
                        opacity={isSelected ? 0.98 : 0.9}
                        style={{ filter: lineShadow }}
                    />
                </g>
            );
        });
    });

    // Render temporary drag connection
    let tempLine = null;
    if (isDraggingConnection && connectionStart && tempConnectionEnd) {
        const startNode = nodes.find(n => n.id === connectionStart.nodeId);
        if (startNode) {
            const startX = connectionStart.handle === 'right' ? startNode.x + getNodeWidth(startNode) : startNode.x;
            const startY = startNode.y + getNodeHeight(startNode) / 2;
            const endX = (tempConnectionEnd.x - viewport.x) / viewport.zoom;
            const endY = (tempConnectionEnd.y - viewport.y) / viewport.zoom;

            const path = calculateConnectionPath(
                startX,
                startY,
                endX,
                endY,
                connectionStart.handle
            );

            tempLine = (
                <>
                    <path
                        d={path}
                        stroke={connectionStroke}
                        strokeWidth="2.85"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                        className="pointer-events-none opacity-90"
                    />
                    <path
                        d={path}
                        stroke={glowStroke}
                        strokeWidth="4.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray="22 92 28 112"
                        fill="none"
                        className="pointer-events-none"
                        style={{ filter: lineShadow }}
                    />
                </>
            );
        }
    }

    return (
        <>
            {connections}
            {tempLine}
        </>
    );
};
