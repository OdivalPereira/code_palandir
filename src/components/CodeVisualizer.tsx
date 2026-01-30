import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { ClusterData, FileSystemNode, FlatNode, Link } from '../types';

interface CodeVisualizerProps {
  rootNode: FileSystemNode | null;
  highlightedPaths: string[];
  onNodeClick: (node: FlatNode) => void;
  onExpandNode: (path: string) => void;
  loadingPaths: Set<string>;
}

const CodeVisualizer: React.FC<CodeVisualizerProps> = ({ rootNode, highlightedPaths, onNodeClick, onExpandNode, loadingPaths }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 1000, height: 800 });
  const [visibleNodeFilter, setVisibleNodeFilter] = useState<'all' | 'directories'>('all');
  const zoomTransformRef = useRef(d3.zoomIdentity);
  const [expandedDirectories, setExpandedDirectories] = useState<Set<string>>(new Set(['']));
  const stablePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const workerRef = useRef<Worker | null>(null);
  const layoutRequestIdRef = useRef(0);
  const [layoutPositions, setLayoutPositions] = useState<Record<string, { x: number; y: number }>>({});

  const layoutPositionsRef = useRef(layoutPositions);
  useEffect(() => {
    layoutPositionsRef.current = layoutPositions;
  }, [layoutPositions]);

  const isAggregateNode = (node: FlatNode) => node.type === 'directory' || node.type === 'cluster';

  // Nodes are restricted to directories when zoomed out below this threshold.
  // Adjust to change when file-level nodes become visible.
  const DIRECTORY_ONLY_ZOOM_THRESHOLD = 0.7;

  // Flatten hierarchical data
  const flattenData = (root: FileSystemNode, expanded: Set<string>): { nodes: FlatNode[], links: Link[] } => {
    const nodes: FlatNode[] = [];
    const links: Link[] = [];

    const countDescendants = (node: FileSystemNode): number => {
      if (typeof node.descendantCount === 'number') return node.descendantCount;
      if (!node.children || node.children.length === 0) return 0;
      return node.children.reduce((total, child) => total + 1 + countDescendants(child), 0);
    };

    const addClusterNode = (node: FileSystemNode, depth: number) => {
      const childCount = countDescendants(node);
      const clusterId = `${node.path}::__cluster`;
      const clusterNode: FlatNode = {
        id: clusterId,
        name: `${childCount} items`,
        type: 'cluster',
        path: clusterId,
        group: depth + 1,
        relevant: false,
        data: {
          parentPath: node.path,
          childCount
        } as ClusterData,
        x: 0,
        y: 0
      };
      nodes.push(clusterNode);
      links.push({ source: node.path, target: clusterId });
    };

    const traverse = (node: FileSystemNode, parentId: string | null, depth: number) => {
      const flatNode: FlatNode = {
        id: node.path, // Use path as ID for uniqueness
        name: node.name,
        type: node.type,
        path: node.path,
        group: depth,
        relevant: highlightedPaths.some(p => node.path.includes(p)),
        data: node,
        x: 0,
        y: 0
      };
      nodes.push(flatNode);

      if (parentId) {
        links.push({ source: parentId, target: node.path });
      }

      const hasChildren = (node.children && node.children.length > 0) || node.hasChildren;
      if (hasChildren) {
        const isExpanded = expanded.has(node.path);
        if (isExpanded && node.children && node.children.length > 0) {
          node.children.forEach(child => traverse(child, node.path, depth + 1));
        } else {
          addClusterNode(node, depth);
        }
      }

      // If the node has analyzed code structure (expanded file), add those as children
      if (node.codeStructure) {
        node.codeStructure.forEach((codeNode) => {
          const codeId = `${node.path}#${codeNode.name}`;
          const flatCodeNode: FlatNode = {
            id: codeId,
            name: codeNode.name,
            type: codeNode.type,
            path: codeId,
            group: depth + 1,
            relevant: false, // Could be refined
            data: codeNode,
            x: 0,
            y: 0
          };
          nodes.push(flatCodeNode);
          links.push({ source: node.path, target: codeId });
        });
      }
    };

    traverse(root, null, 1);
    return { nodes, links };
  };

  useEffect(() => {
    const handleResize = () => {
      if (wrapperRef.current) {
        setDimensions({
          width: wrapperRef.current.clientWidth,
          height: wrapperRef.current.clientHeight
        });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!rootNode) return;
    setExpandedDirectories(new Set([rootNode.path]));
    stablePositionsRef.current = new Map();
    setLayoutPositions({});
  }, [rootNode]);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/graphLayout.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<{ requestId: number; positions: Record<string, { x: number; y: number }> }>) => {
      if (event.data.requestId !== layoutRequestIdRef.current) return;
      setLayoutPositions(event.data.positions);
      stablePositionsRef.current = new Map(Object.entries(event.data.positions));
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const { nodes, links } = useMemo(() => {
    if (!rootNode) {
      return { nodes: [], links: [] };
    }
    return flattenData(rootNode, expandedDirectories);
  }, [rootNode, expandedDirectories, highlightedPaths]);

  useEffect(() => {
    if (!rootNode || !workerRef.current) return;

    const shouldShowDirectoriesOnly = visibleNodeFilter === 'directories';
    const filteredNodes = shouldShowDirectoriesOnly
      ? nodes.filter(node => node.type === 'directory' || node.type === 'cluster')
      : nodes;
    const filteredNodeIds = new Set(filteredNodes.map(node => node.id));
    const filteredLinks = links.filter(link => filteredNodeIds.has(link.source as string) && filteredNodeIds.has(link.target as string));

    const requestId = layoutRequestIdRef.current + 1;
    layoutRequestIdRef.current = requestId;
    workerRef.current.postMessage({
      requestId,
      nodes: filteredNodes.map(node => ({ id: node.id, type: node.type })),
      links: filteredLinks.map(link => ({ source: link.source as string, target: link.target as string })),
      width: dimensions.width,
      height: dimensions.height,
      positions: Object.fromEntries(stablePositionsRef.current)
    });
  }, [rootNode, nodes, links, dimensions, visibleNodeFilter]);

  useEffect(() => {
    if (!rootNode || !svgRef.current) return;

    const { width, height } = dimensions;
    const shouldShowDirectoriesOnly = visibleNodeFilter === 'directories';
    const filteredNodes = shouldShowDirectoriesOnly
      ? nodes.filter(node => node.type === 'directory' || node.type === 'cluster')
      : nodes;
    const filteredNodeIds = new Set(filteredNodes.map(node => node.id));
    const filteredLinks = links.filter(link => filteredNodeIds.has(link.source as string) && filteredNodeIds.has(link.target as string));

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        zoomTransformRef.current = event.transform;
        const nextFilter = event.transform.k < DIRECTORY_ONLY_ZOOM_THRESHOLD ? 'directories' : 'all';
        setVisibleNodeFilter(current => (current === nextFilter ? current : nextFilter));
        g.attr("transform", event.transform);
      });

    svg.call(zoom);
    svg.call(zoom.transform, zoomTransformRef.current);

    filteredNodes.forEach(node => {
      const savedPosition = layoutPositionsRef.current[node.id] ?? stablePositionsRef.current.get(node.id);
      node.x = savedPosition?.x ?? width / 2;
      node.y = savedPosition?.y ?? height / 2;
    });

    // Links
    const link = g.append("g")
      .attr("stroke", "#475569")
      .attr("stroke-opacity", 0.4)
      .selectAll("line")
      .data(filteredLinks)
      .join("line")
      .attr("stroke-width", d => isAggregateNode(d.target as FlatNode) ? 2 : 1);

    // Nodes
    const isNodeLoading = (d: FlatNode) => {
      if (d.type === 'cluster') {
        const { parentPath } = d.data as ClusterData;
        return loadingPaths.has(parentPath);
      }
      return loadingPaths.has(d.path);
    };

    const node = g.append("g")
      .selectAll("g")
      .data(filteredNodes)
      .join("g")
      .attr("cursor", "pointer")
      .on("click", (event, d) => {
        event.stopPropagation();
        if (d.type === 'cluster') {
          const { parentPath } = d.data as ClusterData;
          onExpandNode(parentPath);
          setExpandedDirectories(prev => {
            const next = new Set(prev);
            next.add(parentPath);
            return next;
          });
          return;
        }
        onNodeClick(d);
      })
      .on("dblclick", (event, d) => {
        if (d.type === 'directory') {
          event.stopPropagation();
          setExpandedDirectories(prev => {
            const next = new Set(prev);
            if (next.has(d.path)) {
              next.delete(d.path);
            } else {
              onExpandNode(d.path);
              next.add(d.path);
            }
            return next;
          });
        }
      })
      .call(d3.drag<SVGGElement, FlatNode>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended) as any);

    // Node Shapes
    node.append("circle")
      .attr("r", d => {
        if (d.type === 'cluster') return 18;
        if (d.type === 'directory') return 15;
        if (d.type === 'file') return 10;
        return 6;
      })
      .attr("fill", d => {
        if (d.relevant) return "#facc15"; // Highlight
        switch (d.type) {
          case 'cluster': return "#0f172a";
          case 'directory': return "#3b82f6";
          case 'file': return "#64748b";
          case 'function': return "#4ade80";
          case 'class': return "#f472b6";
          case 'api_endpoint': return "#a78bfa";
          default: return "#94a3b8";
        }
      })
      .attr("stroke", d => {
        if (d.relevant) return "#ffffff";
        if (d.type === 'cluster') return "#38bdf8";
        return "none";
      })
      .attr("stroke-width", d => d.type === 'cluster' ? 2.5 : 2)
      .attr("stroke-dasharray", d => d.type === 'cluster' ? "4 3" : "0");

    node.filter(d => isNodeLoading(d))
      .append("circle")
      .attr("r", d => (d.type === 'cluster' || d.type === 'directory') ? 22 : 16)
      .attr("fill", "none")
      .attr("stroke", "#38bdf8")
      .attr("stroke-width", 2)
      .attr("class", "loading-ring");

    node.filter(d => isNodeLoading(d))
      .append("text")
      .text("Carregando...")
      .attr("x", 0)
      .attr("y", d => d.type === 'directory' ? 40 : 34)
      .attr("text-anchor", "middle")
      .attr("fill", "#38bdf8")
      .attr("font-size", "10px")
      .style("pointer-events", "none");

    // Labels
    node.append("text")
      .text(d => d.name)
      .attr("x", 0)
      .attr("y", d => d.type === 'directory' ? 25 : 20)
      .attr("text-anchor", "middle")
      .attr("fill", "#cbd5e1")
      .attr("font-size", d => d.type === 'directory' ? "12px" : "10px")
      .style("pointer-events", "none")
      .style("text-shadow", "0 1px 2px rgba(0,0,0,0.8)");

    const updateLayout = () => {
      link
        .attr("x1", d => (d.source as FlatNode).x!)
        .attr("y1", d => (d.source as FlatNode).y!)
        .attr("x2", d => (d.target as FlatNode).x!)
        .attr("y2", d => (d.target as FlatNode).y!);

      node
        .attr("transform", d => `translate(${d.x},${d.y})`);
    };

    updateLayout();

    function dragstarted(event: any, d: FlatNode) {
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: FlatNode) {
      d.fx = event.x;
      d.fy = event.y;
      d.x = event.x;
      d.y = event.y;
      updateLayout();
    }

    function dragended(event: any, d: FlatNode) {
      stablePositionsRef.current.set(d.id, { x: event.x, y: event.y });
      d.fx = null;
      d.fy = null;
      setLayoutPositions(prev => ({ ...prev, [d.id]: { x: event.x, y: event.y } }));
    }

    return () => {
      g.remove();
    };
  }, [rootNode, dimensions, highlightedPaths, onNodeClick, onExpandNode, visibleNodeFilter, expandedDirectories, loadingPaths, nodes, links, layoutPositions]);

  if (!rootNode) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 bg-slate-900/50 rounded-lg border-2 border-dashed border-slate-700 p-8">
        <p className="text-lg font-medium mb-2">No Project Loaded</p>
        <p className="text-sm">Import a GitHub repository or open a local directory to visualize the mind map.</p>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="w-full h-full relative bg-slate-950 overflow-hidden">
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="w-full h-full" />

      <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur p-3 rounded-lg border border-slate-700 text-xs text-slate-300 shadow-lg">
        <div className="font-semibold mb-2 text-slate-200">Legend</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Directory</div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-slate-500"></span> File</div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full border border-sky-300 bg-slate-900"></span> Cluster (collapsed)</div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-400"></span> Function</div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-pink-400"></span> Class</div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-400"></span> API</div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-400"></span> Relevant</div>
        </div>
        <div className="mt-2 text-[11px] text-slate-400">
          Double-click a directory to collapse/expand. Click a cluster to expand.
        </div>
      </div>
    </div>
  );
};

export default CodeVisualizer;
