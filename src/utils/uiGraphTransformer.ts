import { FlatNode, Link, UINode, MissingDependency } from '../types';

/**
 * Transforms a hierarchical UINode tree into flat nodes and links for D3 visualization.
 * 
 * @param rootNode The root of the UI Graph
 * @returns Object containing flat nodes and links
 */
export const convertUIGraphToFlatNodes = (
    rootNode: UINode,
    missingDependencies: MissingDependency[] = []
): { nodes: FlatNode[], links: Link[] } => {
    const nodes: FlatNode[] = [];
    const links: Link[] = [];
    const processedIds = new Set<string>();
    const nodeByPath = new Map<string, string>(); // Path -> NodeID

    const traverse = (node: UINode, parentId: string | null) => {
        // Generate a unique ID if needed, though UINode should have one
        const nodeId = node.id || `ui-${Math.random().toString(36).substr(2, 9)}`;

        // Prevent duplicates
        if (processedIds.has(nodeId)) return;
        processedIds.add(nodeId);

        // Create FlatNode
        const flatNode: FlatNode = {
            id: nodeId,
            name: node.label || node.name,
            type: node.type as any, // app, page, component, button, etc. (Cast to allow new types)
            path: node.sourceFile || '',
            group: 1,
            uiNode: node, // Keep reference to original node for details
            // D3 properties init
            x: 0,
            y: 0
        };

        nodes.push(flatNode);
        if (flatNode.path) {
            nodeByPath.set(flatNode.path, nodeId);
        }

        // Create Link from parent
        if (parentId) {
            links.push({
                source: parentId,
                target: nodeId,
                kind: 'structural' // Hierarchical link
            });
        }

        // Traverse children
        if (node.children && node.children.length > 0) {
            node.children.forEach(child => traverse(child, nodeId));
        }
    };

    traverse(rootNode, null);

    // Phase 5: Generate Ghost Nodes for Missing Dependencies
    if (missingDependencies.length > 0) {
        missingDependencies.forEach(dep => {
            const ghostId = `ghost-${dep.id || Math.random().toString(36).substr(2, 9)}`;

            // Determine ghost type based on dependency type
            let ghostType = 'ghost_service'; // default
            if (dep.type === 'table') ghostType = 'ghost_table';
            if (dep.type === 'endpoint') ghostType = 'ghost_endpoint';

            const ghostNode: FlatNode = {
                id: ghostId,
                name: dep.name,
                type: ghostType,
                path: '',
                group: 2,
                isGhost: true,
                ghostData: dep,
                dependencyStatus: 'missing',
                x: 0,
                y: 0
            };

            nodes.push(ghostNode);

            // Link to ALL sources that require this dependency
            if (dep.requiredBy && dep.requiredBy.length > 0) {
                dep.requiredBy.forEach(sourcePath => {
                    const sourceNodeId = nodeByPath.get(sourcePath);
                    if (sourceNodeId) {
                        links.push({
                            source: sourceNodeId,
                            target: ghostId,
                            kind: 'dependency',
                            edgeStyle: 'dashed'
                        });
                    }
                });
            }
        });
    }

    return { nodes, links };
};
