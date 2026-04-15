/**
 * SelectionBoundingBox.tsx
 * 
 * Renders a bounding box around selected nodes with resize handles.
 * Shows "Group" button for multi-selection and group toolbar when grouped.
 */

import React, { useState } from 'react';
import { NodeData, NodeGroup } from '../../types';
import { getCanvasNodeDimensions } from '../../utils/canvasNodeLayout';

interface SelectionBoundingBoxProps {
    selectedNodes: NodeData[];
    group?: NodeGroup;
    viewport: { x: number; y: number; zoom: number };
    onGroup: () => void;
    onUngroup: () => void;
    onBoundingBoxPointerDown: (e: React.PointerEvent) => void;
    onRenameGroup?: (groupId: string, newLabel: string) => void;
    onSortNodes?: (direction: 'horizontal' | 'vertical' | 'grid') => void;
    onCreateVideo?: () => void;
    onEditStoryboard?: (groupId: string) => void;
    onCancelSceneTasks?: () => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the width of a node based on its type
 * @param node - The node to calculate width for
 * @param allNodes - All nodes in the selection (to find parent for Editor nodes)
 */
const getNodeWidth = (node: NodeData, allNodes?: NodeData[]): number => {
    const parentId = node.parentIds?.[0];
    const parentNode = parentId ? allNodes?.find(n => n.id === parentId) : undefined;
    return getCanvasNodeDimensions(node, parentNode).width;
};

/**
 * Estimate the height of a node based on its type and aspect ratio.
 * This accounts for the content area + any controls/padding.
 * @param node - The node to calculate height for
 * @param allNodes - All nodes in the selection (to find parent for Editor nodes)
 */
const getNodeHeight = (node: NodeData, allNodes?: NodeData[]): number => {
    const parentId = node.parentIds?.[0];
    const parentNode = parentId ? allNodes?.find(n => n.id === parentId) : undefined;
    return getCanvasNodeDimensions(node, parentNode).height;
};

export const SelectionBoundingBox: React.FC<SelectionBoundingBoxProps> = ({
    selectedNodes,
    group,
    viewport,
    onGroup,
    onUngroup,
    onBoundingBoxPointerDown,
    onRenameGroup,
    onSortNodes,
    onCreateVideo,
    onEditStoryboard,
    onCancelSceneTasks
}) => {
    // ============================================================================
    // STATE
    // ============================================================================

    const [isEditingLabel, setIsEditingLabel] = useState(false);
    const [editedLabel, setEditedLabel] = useState('');
    const [showSortDropdown, setShowSortDropdown] = useState(false);
    // ============================================================================
    // CALCULATIONS
    // ============================================================================

    // Don't render for 0 nodes or single nodes (unless it's a group)
    if (selectedNodes.length === 0) return null;
    if (selectedNodes.length === 1 && !group) return null;

    // Calculate bounding box from all selected nodes with proper dimensions
    const PADDING_X = 50; // Horizontal padding (accounts for + connectors on sides)
    const PADDING_TOP = 30; // Top padding for node titles
    const PADDING_BOTTOM = 50; // Bottom padding for controls

    const minX = Math.min(...selectedNodes.map(n => n.x)) - PADDING_X;
    const minY = Math.min(...selectedNodes.map(n => n.y)) - PADDING_TOP;
    const maxX = Math.max(...selectedNodes.map(n => n.x + getNodeWidth(n, selectedNodes))) + PADDING_X;
    const maxY = Math.max(...selectedNodes.map(n => n.y + getNodeHeight(n, selectedNodes))) + PADDING_BOTTOM;

    const width = maxX - minX;
    const height = maxY - minY;

    const isGrouped = !!group;
    const showGroupButton = selectedNodes.length > 1 && !isGrouped;

    // Calculate scale factor for UI elements - clamp to prevent elements from getting too large
    // At zoom 1.0: scale = 1.0 (normal size)
    // At zoom 0.5: scale = 1.5 (max clamped, instead of 2.0)
    // At zoom 2.0: scale = 0.5 (smaller)
    const uiScale = Math.min(1 / viewport.zoom, 1.5);

    // ============================================================================
    // RENDER
    // ============================================================================

    return (
        <div
            className="absolute pointer-events-auto cursor-move"
            style={{
                left: minX,
                top: minY,
                width,
                height,
                border: isGrouped ? '2px solid #6366f1' : '2px dashed #6366f1',
                borderRadius: '12px',
                backgroundColor: isGrouped ? 'rgba(55, 55, 55, 0.5)' : 'transparent',
                zIndex: 5
            }}
            onPointerDown={(e) => {
                // Only trigger group drag if clicking on the bounding box itself, not its children
                if (e.target === e.currentTarget) {
                    onBoundingBoxPointerDown(e);
                }
            }}
        >
            {/* Resize Handles */}
            {[
                { pos: 'top-left', cursor: 'nw-resize', top: -4, left: -4 },
                { pos: 'top', cursor: 'n-resize', top: -4, left: '50%', transform: 'translateX(-50%)' },
                { pos: 'top-right', cursor: 'ne-resize', top: -4, right: -4 },
                { pos: 'right', cursor: 'e-resize', top: '50%', right: -4, transform: 'translateY(-50%)' },
                { pos: 'bottom-right', cursor: 'se-resize', bottom: -4, right: -4 },
                { pos: 'bottom', cursor: 's-resize', bottom: -4, left: '50%', transform: 'translateX(-50%)' },
                { pos: 'bottom-left', cursor: 'sw-resize', bottom: -4, left: -4 },
                { pos: 'left', cursor: 'w-resize', top: '50%', left: -4, transform: 'translateY(-50%)' }
            ].map(handle => (
                <div
                    key={handle.pos}
                    className="absolute w-2 h-2 bg-white border border-indigo-500 rounded-sm pointer-events-auto"
                    style={{
                        top: handle.top,
                        left: handle.left,
                        right: handle.right,
                        bottom: handle.bottom,
                        transform: handle.transform,
                        cursor: handle.cursor
                    }}
                />
            ))}

            {/* Group Label (when grouped) - Positioned on left side */}
            {isGrouped && group && (
                isEditingLabel ? (
                    <input
                        type="text"
                        value={editedLabel}
                        onChange={(e) => setEditedLabel(e.target.value)}
                        onBlur={() => {
                            if (editedLabel.trim() && onRenameGroup) {
                                onRenameGroup(group.id, editedLabel.trim());
                            }
                            setIsEditingLabel(false);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                if (editedLabel.trim() && onRenameGroup) {
                                    onRenameGroup(group.id, editedLabel.trim());
                                }
                                setIsEditingLabel(false);
                            } else if (e.key === 'Escape') {
                                setIsEditingLabel(false);
                            }
                        }}
                        autoFocus
                        className="absolute text-sm font-medium text-white bg-indigo-600 px-3 py-1 rounded pointer-events-auto outline-none whitespace-nowrap"
                        style={{
                            top: 8,
                            right: 'calc(100% + 8px)',
                            transform: `scale(${uiScale})`,
                            transformOrigin: 'top right'
                        }}
                    />
                ) : (
                    <div
                        className="absolute text-sm font-medium text-white bg-indigo-600 px-3 py-1 rounded pointer-events-auto cursor-text whitespace-nowrap"
                        style={{
                            top: 8,
                            right: 'calc(100% + 8px)',
                            transform: `scale(${uiScale})`,
                            transformOrigin: 'top right'
                        }}
                        onDoubleClick={() => {
                            setEditedLabel(group.label);
                            setIsEditingLabel(true);
                        }}
                    >
                        {group.label}
                    </div>
                )
            )}

            {/* Group Button (when multiple nodes selected but not grouped) */}
            {showGroupButton && (
                <div
                    className="absolute flex gap-2 pointer-events-auto"
                    style={{
                        top: -10,
                        right: 0,
                        transform: `scale(${uiScale}) translateY(-100%)`,
                        transformOrigin: 'bottom right'
                    }}
                >
                    <button
                        onClick={onGroup}
                        className="bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-white text-sm px-4 py-2.5 rounded flex items-center gap-2 transition-colors"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="7" height="7" />
                            <rect x="14" y="3" width="7" height="7" />
                            <rect x="14" y="14" width="7" height="7" />
                            <rect x="3" y="14" width="7" height="7" />
                        </svg>
                        编组
                    </button>
                    {selectedNodes.some((node) => node.scene && node.taskInfo?.loading && node.taskInfo.taskId) && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onCancelSceneTasks?.();
                            }}
                            className="bg-rose-600 hover:bg-rose-500 text-white text-sm px-4 py-2.5 rounded flex items-center gap-2 transition-colors"
                        >
                            取消任务
                        </button>
                    )}
                </div>
            )}

            {/* Group Toolbar (when grouped) */}
            {isGrouped && (
                <div
                    className="absolute flex overflow-visible rounded-[14px] border border-white/10 bg-[#121212] shadow-[0_18px_50px_rgba(0,0,0,0.42)] pointer-events-auto"
                    style={{
                        top: -10,
                        left: '50%',
                        transform: `translateX(-50%) scale(${uiScale}) translateY(-100%)`,
                        transformOrigin: 'bottom center'
                    }}
                >
                    {/* Sort Button with Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setShowSortDropdown(!showSortDropdown)}
                            className="flex h-[78px] min-w-[210px] items-center justify-center gap-4 border-r border-white/10 bg-[#0f0f0f] px-8 text-[24px] font-semibold text-white transition-colors hover:bg-[#181818]"
                        >
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="4" y1="6" x2="20" y2="6" />
                                <line x1="4" y1="12" x2="16" y2="12" />
                                <line x1="4" y1="18" x2="12" y2="18" />
                            </svg>
                            整理
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="6 9 12 15 18 9" />
                            </svg>
                        </button>
                        {/* Dropdown Menu - Appears above */}
                        {showSortDropdown && (
                            <div className="absolute bottom-full mb-2 left-0 w-[180px] overflow-hidden rounded-lg border border-white/10 bg-[#242424]/96 p-1.5 text-white shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl z-50">
                                <button
                                    onClick={() => {
                                        onSortNodes?.('horizontal');
                                        setShowSortDropdown(false);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] font-medium text-neutral-100 transition-colors hover:bg-white/8"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="4" y1="12" x2="20" y2="12" />
                                        <polyline points="14 6 20 12 14 18" />
                                    </svg>
                                    横向排列
                                </button>
                                <button
                                    onClick={() => {
                                        onSortNodes?.('vertical');
                                        setShowSortDropdown(false);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] font-medium text-neutral-100 transition-colors hover:bg-white/8"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="12" y1="4" x2="12" y2="20" />
                                        <polyline points="6 14 12 20 18 14" />
                                    </svg>
                                    纵向排列
                                </button>
                                <button
                                    onClick={() => {
                                        onSortNodes?.('grid');
                                        setShowSortDropdown(false);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] font-medium text-neutral-100 transition-colors hover:bg-white/8"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="3" width="7" height="7" />
                                        <rect x="14" y="3" width="7" height="7" />
                                        <rect x="3" y="14" width="7" height="7" />
                                        <rect x="14" y="14" width="7" height="7" />
                                    </svg>
                                    网格排列
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Ungroup Button */}
                    <button
                        onClick={onUngroup}
                        className="flex h-[78px] min-w-[240px] items-center justify-center gap-4 border-r border-white/10 bg-[#101010] px-8 text-[24px] font-semibold text-white transition-colors hover:bg-[#181818]"
                    >
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="7" height="7" />
                            <rect x="14" y="3" width="7" height="7" />
                            <rect x="14" y="14" width="7" height="7" />
                            <rect x="3" y="14" width="7" height="7" />
                            <line x1="3" y1="3" x2="21" y2="21" />
                        </svg>
                        取消编组
                    </button>

                    {selectedNodes.some((node) => node.scene && node.taskInfo?.loading && node.taskInfo.taskId) && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onCancelSceneTasks?.();
                            }}
                            className="bg-rose-600 hover:bg-rose-500 text-white text-sm px-4 py-2.5 rounded flex items-center gap-2 transition-colors"
                        >
                            取消任务
                        </button>
                    )}

                    {/* Edit Storyboard Button (only for storyboards) */}
                    {group.storyContext && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onEditStoryboard) onEditStoryboard(group.id);
                            }}
                            className="bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-white text-sm px-4 py-2.5 rounded flex items-center gap-2 transition-colors mr-2"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            编辑分镜
                        </button>
                    )}

                    {/* Create Video Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onCreateVideo) onCreateVideo();
                        }}
                        disabled={!onCreateVideo}
                        className="flex h-[78px] min-w-[300px] items-center justify-center gap-6 rounded-r-[14px] bg-[#8b2cf6] px-10 text-[24px] font-semibold text-white shadow-lg shadow-purple-600/20 transition-colors hover:bg-[#9a3cff] disabled:cursor-not-allowed disabled:bg-[#5b3a86] disabled:text-white/55"
                        title={onCreateVideo ? '为当前分组生成视频' : '当前分组暂不能生成视频'}
                    >
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15 10l5 5-5 5" />
                            <path d="M4 4v16" />
                        </svg>
                        生成视频
                    </button>
                </div>
            )}
        </div>
    );
};
