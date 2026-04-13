/**
 * useWorkflow.ts
 * 
 * Custom hook for managing workflow save/load functionality.
 * Handles persistence to the backend server.
 */

import React, { useState, useCallback, Dispatch, SetStateAction } from 'react';
import { NodeData, NodeGroup, Viewport } from '../types';
import { loadProject, saveProject } from '../services/projects/projectClient';
import type { CanvasEdge, Project } from '../types/project';

interface WorkflowData {
    id: string | null;
    title: string;
    nodes: NodeData[];
    edges: CanvasEdge[];
    groups: NodeGroup[];
    viewport: Viewport;
}

interface UseWorkflowOptions {
    nodes: NodeData[];
    groups: NodeGroup[];
    viewport: Viewport;
    canvasTitle: string;
    setNodes: Dispatch<SetStateAction<NodeData[]>>;
    setGroups: Dispatch<SetStateAction<NodeGroup[]>>; // For restoring groups when loading
    setSelectedNodeIds: Dispatch<SetStateAction<string[]>>;
    setCanvasTitle: (title: string) => void;
    setEditingTitleValue: (value: string) => void;
    onPanelOpen?: () => void; // Called when workflow panel opens
}

export const useWorkflow = ({
    nodes,
    groups,
    viewport,
    canvasTitle,
    setNodes,
    setGroups,
    setSelectedNodeIds,
    setCanvasTitle,
    setEditingTitleValue,
    onPanelOpen
}: UseWorkflowOptions) => {
    // Workflow state
    const [workflowId, setWorkflowId] = useState<string | null>(null);
    const [isWorkflowPanelOpen, setIsWorkflowPanelOpen] = useState(false);
    const [workflowPanelY, setWorkflowPanelY] = useState(0);

    /**
     * Save current workflow to server
     */
    const handleSaveWorkflow = useCallback(async () => {
        try {
            const workflow: WorkflowData = {
                id: workflowId,
                title: canvasTitle,
                edges: nodes.flatMap((node) =>
                    (node.parentIds || []).map((parentId) => ({
                        id: `${parentId}->${node.id}`,
                        source_node_id: parentId,
                        target_node_id: node.id,
                        source: parentId,
                        target: node.id,
                    }))
                ),
                nodes,
                groups,
                viewport
            };

            const project = await saveProject({
                ...workflow,
                name: canvasTitle,
                description: '',
            } as Project);

            setWorkflowId(project.id);
            console.log('Project saved:', project.id);

            // Keep legacy workflow files in sync for the existing workflow panel until it is fully migrated.
            void fetch('http://localhost:3001/api/workflows', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...workflow, id: project.id })
            });
        } catch (error) {
            console.error('Failed to save workflow:', error);
        }
    }, [workflowId, canvasTitle, nodes, groups, viewport]);

    /**
     * Load workflow from server
     * Supports both user workflows and public workflows (prefixed with "public:")
     * Returns the loaded workflow's node count and title for tracking
     */
    const handleLoadWorkflow = useCallback(async (id: string): Promise<{ nodeCount: number; title: string } | null> => {
        try {
            // Check if loading a public workflow
            const isPublic = id.startsWith('public:');
            const workflowId = isPublic ? id.replace('public:', '') : id;
            const endpoint = isPublic
                ? `http://localhost:3001/api/public-workflows/${workflowId}`
                : null;

            const workflow = isPublic
                ? await (async () => {
                    const response = await fetch(endpoint!);
                    if (!response.ok) return null;
                    return response.json();
                })()
                : await loadProject(workflowId);

            if (workflow) {
                const normalizedWorkflow = 'project' in workflow ? workflow.project : workflow;

                // For public workflows, don't set the workflowId so it saves as a new workflow
                if (!isPublic) {
                    setWorkflowId(normalizedWorkflow.id);
                } else {
                    setWorkflowId(null); // New copy, not linked to public workflow
                }

                setCanvasTitle(normalizedWorkflow.title || normalizedWorkflow.name || 'Untitled');
                setEditingTitleValue(normalizedWorkflow.title || normalizedWorkflow.name || 'Untitled');
                setNodes(normalizedWorkflow.nodes || []);
                setGroups(normalizedWorkflow.groups || []); // Restore groups
                // Reset selection
                setSelectedNodeIds([]);
                setIsWorkflowPanelOpen(false);
                console.log(isPublic ? 'Public workflow loaded:' : 'Workflow loaded:', workflowId);
                // Return info for tracking
                return {
                    nodeCount: (normalizedWorkflow.nodes || []).length,
                    title: normalizedWorkflow.title || normalizedWorkflow.name || 'Untitled'
                };
            }
        } catch (error) {
            console.error('Failed to load workflow:', error);
        }
        return null;
    }, [setNodes, setGroups, setSelectedNodeIds, setCanvasTitle, setEditingTitleValue]);

    /**
     * Handle workflow panel toggle from toolbar click
     */
    const handleWorkflowsClick = useCallback((e: React.MouseEvent) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setWorkflowPanelY(rect.top);
        setIsWorkflowPanelOpen(prev => !prev);
        onPanelOpen?.(); // Close other panels
    }, [onPanelOpen]);

    /**
     * Close workflow panel
     */
    const closeWorkflowPanel = useCallback(() => {
        setIsWorkflowPanelOpen(false);
    }, []);

    /**
     * Reset workflow ID (for creating a new canvas)
     */
    const resetWorkflowId = useCallback(() => {
        setWorkflowId(null);
    }, []);

    return {
        workflowId,
        isWorkflowPanelOpen,
        workflowPanelY,
        handleSaveWorkflow,
        handleLoadWorkflow,
        handleWorkflowsClick,
        closeWorkflowPanel,
        resetWorkflowId
    };
};
