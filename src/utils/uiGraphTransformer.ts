import { FlatNode, Link, UINode, MissingDependency } from '../types';

/**
 * Transforms a hierarchical UINode tree into flat nodes and links for D3 visualization.
 * Sanitizes graph outputs:
 * - Deduplicates edges
 * - Prevents infinite recursion on cyclic structures
 * - Prunes dangling links
 * - Provides fallback hierarchical metadata
 * 
 * @param rootNode The root of the UI Graph
 * @param missingDependencies List of missing backend dependencies
 * @returns Object containing flat nodes and links
 */
export const convertUIGraphToFlatNodes = (
    rootNode: UINode | null | undefined,
    missingDependencies: MissingDependency[] = []
): { nodes: FlatNode[], links: Link[] } => {
    if (!rootNode) {
        return { nodes: [], links: [] };
    }

    const nodes: FlatNode[] = [];
    const links: Link[] = [];
    const processedIds = new Set<string>();
    const linkSet = new Set<string>();
    const nodeByPath = new Map<string, string>(); // Path -> NodeID

    const addUniqueLink = (source: string, target: string, kind: 'structural' | 'dependency' | 'import' | 'call' = 'structural', edgeStyle?: 'dashed') => {
        if (!source || !target || source === target) return;
        const key = `${source}-->${target}:${kind}`;
        if (!linkSet.has(key)) {
            linkSet.add(key);
            links.push({
                source,
                target,
                kind,
                edgeStyle
            });
        }
    };

    const traverse = (node: UINode, parentId: string | null, depth: number = 1) => {
        if (!node) return;
        // Generate a stable unique ID if needed
        const nodeId = node.id || `ui-${node.name || 'node'}-${node.sourceFile || ''}-${depth}`;

        // Prevent infinite recursion on cyclic children
        if (processedIds.has(nodeId)) {
            if (parentId) {
                addUniqueLink(parentId, nodeId, 'structural');
            }
            return;
        }
        processedIds.add(nodeId);

        // Create FlatNode with fallback positions and hierarchical metadata
        const flatNode: FlatNode = {
            id: nodeId,
            name: node.label || node.name || 'Component',
            type: (node.type || 'component') as any,
            path: node.sourceFile || '',
            group: depth,
            uiNode: node,
            x: 0,
            y: 0
        };

        nodes.push(flatNode);
        if (flatNode.path) {
            nodeByPath.set(flatNode.path, nodeId);
        }

        // Create Link from parent
        if (parentId) {
            addUniqueLink(parentId, nodeId, 'structural');
        }

        // Traverse children safely
        if (Array.isArray(node.children) && node.children.length > 0) {
            node.children.forEach(child => traverse(child, nodeId, depth + 1));
        }
    };

    traverse(rootNode, null, 1);

    // Generate Ghost Nodes for Missing Dependencies
    if (Array.isArray(missingDependencies) && missingDependencies.length > 0) {
        missingDependencies.forEach((dep, index) => {
            if (!dep) return;
            const ghostId = `ghost-${dep.id || dep.name || index}`;

            if (processedIds.has(ghostId)) return;
            processedIds.add(ghostId);

            let ghostType = 'ghost_service';
            if (dep.type === 'table') ghostType = 'ghost_table';
            if (dep.type === 'endpoint') ghostType = 'ghost_endpoint';

            const ghostNode: FlatNode = {
                id: ghostId,
                name: dep.name || 'Backend Resource',
                type: ghostType as any,
                path: '',
                group: 99,
                isGhost: true,
                ghostData: dep,
                dependencyStatus: 'missing',
                x: 0,
                y: 0
            };

            nodes.push(ghostNode);

            // Link to ALL sources that require this dependency
            if (Array.isArray(dep.requiredBy) && dep.requiredBy.length > 0) {
                dep.requiredBy.forEach(sourcePath => {
                    const sourceNodeId = nodeByPath.get(sourcePath);
                    if (sourceNodeId) {
                        addUniqueLink(sourceNodeId, ghostId, 'dependency', 'dashed');
                    }
                });
            }
        });
    }

    // Prune dangling links
    const validNodeIds = new Set(nodes.map(n => n.id));
    const prunedLinks = links.filter(link => {
        const s = typeof link.source === 'string' ? link.source : (link.source as any)?.id;
        const t = typeof link.target === 'string' ? link.target : (link.target as any)?.id;
        return validNodeIds.has(s) && validNodeIds.has(t);
    });

    return { nodes, links: prunedLinks };
};

