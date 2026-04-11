/**
 * useGenerationRecovery.ts
 * 
 * Custom hook that checks for nodes in 'loading' status and polls
 * the backend to see if their generation has finished.
 */

import { useEffect, useCallback, useRef } from 'react';
import { NodeData, NodeStatus, NodeType } from '../types';
import { extractVideoLastFrame } from '../utils/videoHelpers';

interface UseGenerationRecoveryOptions {
    nodes: NodeData[];
    updateNode: (id: string, updates: Partial<NodeData>) => void;
}

type RecoverGenerationStatusOptions = {
    nodeId: string;
    getNodes: () => NodeData[];
    updateNode: (id: string, updates: Partial<NodeData>) => void;
    fetchImpl?: typeof fetch;
    extractLastFrame?: typeof extractVideoLastFrame;
};

export async function recoverGenerationStatusForNode({
    nodeId,
    getNodes,
    updateNode,
    fetchImpl = fetch,
    extractLastFrame = extractVideoLastFrame,
}: RecoverGenerationStatusOptions) {
    try {
        const response = await fetchImpl(`/api/generation-status/${nodeId}`);
        if (!response.ok) {
            return;
        }

        const data = await response.json();
        if (data.status !== 'success' || !data.resultUrl) {
            return;
        }

        const node = getNodes().find(n => n.id === nodeId);
        const recoveredAt = Date.now();

        if (node?.generationStartTime && data.createdAt) {
            const resultCreatedAt = new Date(data.createdAt).getTime();
            if (resultCreatedAt < node.generationStartTime) {
                return;
            }
        }

        console.log(`[Recovery] Found new result for node ${nodeId}`);

        const recoveredResultUrl = `${data.resultUrl}${data.resultUrl.includes('?') ? '&' : '?'}t=${recoveredAt}`;

        const updates: Partial<NodeData> = {
            status: NodeStatus.SUCCESS,
            resultUrl: recoveredResultUrl,
            errorMessage: undefined,
            generationStartTime: undefined
        };

        const isVideoNode =
            node?.type === NodeType.VIDEO ||
            node?.type === NodeType.LOCAL_VIDEO_MODEL ||
            data.type === 'video';

        if (isVideoNode) {
            const recoveredCreatedAt = data.createdAt
                ? new Date(data.createdAt).getTime()
                : undefined;
            const requestedVideoModel =
                data.requestedModel ??
                node?.requestedVideoModel ??
                node?.videoModel;
            const executedVideoModel =
                data.executedModel ??
                node?.executedVideoModel;
            const executedVideoMode =
                data.executedMode ??
                node?.executedVideoMode;
            const executionProvider =
                data.executionProvider ??
                node?.executionProvider;

            if (requestedVideoModel) {
                updates.requestedVideoModel = requestedVideoModel;
            }
            if (executedVideoModel) {
                updates.executedVideoModel = executedVideoModel;
            }
            if (executedVideoMode) {
                updates.executedVideoMode = executedVideoMode;
            }
            if (executionProvider) {
                updates.executionProvider = executionProvider;
            }

            try {
                const lastFrame = await extractLastFrame(recoveredResultUrl);
                const latestNode = getNodes().find(n => n.id === nodeId);
                if (
                    latestNode?.generationStartTime &&
                    recoveredCreatedAt &&
                    recoveredCreatedAt < latestNode.generationStartTime
                ) {
                    return;
                }
                updates.lastFrame = lastFrame;
            } catch (err) {
                console.error(`[Recovery] Failed to extract last frame for node ${nodeId}:`, err);
            }
        }

        updateNode(nodeId, updates);
    } catch (error) {
        console.error(`[Recovery] Error checking status for node ${nodeId}:`, error);
    }
}

export const useGenerationRecovery = ({
    nodes,
    updateNode
}: UseGenerationRecoveryOptions) => {
    // Use a ref to access current nodes without causing re-renders
    const nodesRef = useRef<NodeData[]>(nodes);
    nodesRef.current = nodes;

    const checkStatus = useCallback(async (nodeId: string) => {
        await recoverGenerationStatusForNode({
            nodeId,
            getNodes: () => nodesRef.current,
            updateNode,
        });
    }, [updateNode]); // Only updateNode as dependency, nodes accessed via ref

    // Track loading node IDs for stable dependency
    const loadingNodeIds = nodes
        .filter(n => n.status === NodeStatus.LOADING)
        .map(n => n.id)
        .join(',');

    useEffect(() => {
        if (!loadingNodeIds) return;

        const nodeIds = loadingNodeIds.split(',');

        // Check each loading node every 10 seconds
        const checkAll = () => {
            nodeIds.forEach(nodeId => checkStatus(nodeId));
        };

        checkAll(); // Initial check

        const interval = setInterval(checkAll, 10000); // Check every 10s

        return () => clearInterval(interval);
    }, [loadingNodeIds, checkStatus]); // Stable string dependency instead of nodes array
};

