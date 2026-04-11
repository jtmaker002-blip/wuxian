/**
 * useVideoFrameExtraction.ts
 * 
 * Custom hook that automatically extracts lastFrame for video nodes
 * that have a resultUrl but no lastFrame set.
 * This ensures video thumbnails are available for motion control UI.
 */

import { useEffect, useRef } from 'react';
import { NodeData, NodeType, NodeStatus } from '../types';
import { extractVideoLastFrame } from '../utils/videoHelpers';

interface UseVideoFrameExtractionOptions {
    nodes: NodeData[];
    updateNode: (id: string, updates: Partial<NodeData>) => void;
}

export const useVideoFrameExtraction = ({
    nodes,
    updateNode
}: UseVideoFrameExtractionOptions) => {
    const completedNodesRef = useRef<Set<string>>(new Set());
    const inFlightNodesRef = useRef<Set<string>>(new Set());
    const retryCountRef = useRef<Map<string, number>>(new Map());
    const MAX_RETRIES = 3;

    useEffect(() => {
        // Find video nodes with resultUrl but no lastFrame
        const videosNeedingExtraction = nodes.filter(node =>
            node.type === NodeType.VIDEO &&
            node.status === NodeStatus.SUCCESS &&
            node.resultUrl &&
            !node.lastFrame &&
            !completedNodesRef.current.has(node.id) &&
            !inFlightNodesRef.current.has(node.id) &&
            (retryCountRef.current.get(node.id) ?? 0) < MAX_RETRIES
        );

        if (videosNeedingExtraction.length === 0) return;

        console.log(`[VideoFrameExtraction] Found ${videosNeedingExtraction.length} video(s) needing lastFrame extraction`);

        // Extract lastFrame for each video
        videosNeedingExtraction.forEach(async (node) => {
            inFlightNodesRef.current.add(node.id);

            try {
                console.log(`[VideoFrameExtraction] Extracting lastFrame for video node ${node.id}...`);
                const lastFrame = await extractVideoLastFrame(node.resultUrl!);
                updateNode(node.id, { lastFrame });
                completedNodesRef.current.add(node.id);
                retryCountRef.current.delete(node.id);
                console.log(`[VideoFrameExtraction] Successfully extracted lastFrame for node ${node.id}`);
            } catch (error) {
                const nextRetryCount = (retryCountRef.current.get(node.id) ?? 0) + 1;
                retryCountRef.current.set(node.id, nextRetryCount);
                console.error(`[VideoFrameExtraction] Failed to extract lastFrame for node ${node.id}:`, error);
            } finally {
                inFlightNodesRef.current.delete(node.id);
            }
        });
    }, [nodes, updateNode]);

    // Reset tracked nodes when nodes array changes drastically (new workflow loaded)
    useEffect(() => {
        const currentNodeIds = new Set(nodes.map(n => n.id));
        const trackedIds: string[] = Array.from(new Set([
            ...completedNodesRef.current,
            ...inFlightNodesRef.current,
            ...retryCountRef.current.keys(),
        ]));

        // Remove tracked IDs that no longer exist in nodes
        trackedIds.forEach(id => {
            if (!currentNodeIds.has(id)) {
                completedNodesRef.current.delete(id);
                inFlightNodesRef.current.delete(id);
                retryCountRef.current.delete(id);
            }
        });
    }, [nodes]);
};
