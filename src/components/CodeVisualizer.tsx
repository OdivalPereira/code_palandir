import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { ClusterData, FileSystemNode, FlatNode, Link } from '../types';

interface CodeVisualizerProps {
  rootNode: FileSystemNode | null;
  highlightedPaths: string[];
  onNodeClick: (node: FlatNode) => void;
}

const CodeVisualizer: React.FC<CodeVisualizerProps> = ({ rootNode, highlightedPaths, onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 1000, height: 800 });
  const [visibleNodeFilter, setVisibleNodeFilter] = useState<'all' | 'directories'>('all');
  const zoomTransformRef = useRef(d3.zoomIdentity);
  const [expandedDirectories, setExpandedDirectories] = useState<Set<string>>(new Set(['']));
  const stablePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const stableTickCountRef = useRef(0);

  const isAggregateNode = (node: FlatNode) => node.type === 'directory' || node.type === 'cluster';

  // Nodes are restricted to directories when zoomed out below this threshold.
  // Adjust to change when file-level nodes become visible.
  const DIRECTORY_ONLY_ZOOM_THRESHOLD = 0.7;

  // Flatten hierarchical data
  const flattenData = (root: FileSystemNode, expanded: Set<string>): { nodes: FlatNode[], links: Link[] } => {
    const nodes: FlatNode[] = [];
    const links: Link[] = [];

    const countDescendants = (node: FileSystemNode): number => {
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

      if (node.children && node.children.length > 0) {
        const isExpanded = expanded.has(node.path);
        if (isExpanded) {
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
  }, [rootNode]);

  useEffect(() => {
    if (!rootNode || !svgRef.current) return;

    const { width, height } = dimensions;
    const { nodes, links } = flattenData(rootNode, expandedDirectories);
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

    const simulation = d3.forceSimulation(filteredNodes)
      .force("link", d3.forceLink(filteredLinks).id((d: any) => d.id).distance(d => isAggregateNode(d.target as FlatNode) ? 150 : 80))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(40));
    const stableAlphaThreshold = 0.03;
    const stableTicksRequired = 20;
    stableTickCountRef.current = 0;

    filteredNodes.forEach(node => {
      const savedPosition = stablePositionsRef.current.get(node.id);
      if (savedPosition) {
        node.x = savedPosition.x;
        node.y = savedPosition.y;
      }
    });
    simulation.alpha(1).restart();

    // Links
    const link = g.append("g")
      .attr("stroke", "#475569")
      .attr("stroke-opacity", 0.4)
      .selectAll("line")
      .data(filteredLinks)
      .join("line")
      .attr("stroke-width", d => isAggregateNode(d.target as FlatNode) ? 2 : 1);

    // Nodes
    const node = g.append("g")
      .selectAll("g")
      .data(filteredNodes)
      .join("g")
      .attr("cursor", "pointer")
      .on("click", (event, d) => {
        event.stopPropagation();
        if (d.type === 'cluster') {
          const { parentPath } = d.data as ClusterData;
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

    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as FlatNode).x!)
        .attr("y1", d => (d.source as FlatNode).y!)
        .attr("x2", d => (d.target as FlatNode).x!)
        .attr("y2", d => (d.target as FlatNode).y!);

      node
        .attr("transform", d => `translate(${d.x},${d.y})`);

      if (simulation.alpha() < stableAlphaThreshold) {
        stableTickCountRef.current += 1;
        if (stableTickCountRef.current >= stableTicksRequired) {
          simulation.stop();
          filteredNodes.forEach(d => {
            if (typeof d.x === 'number' && typeof d.y === 'number') {
              stablePositionsRef.current.set(d.id, { x: d.x, y: d.y });
            }
          });
        }
      } else {
        stableTickCountRef.current = 0;
      }
    });

    function dragstarted(event: any, d: FlatNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: FlatNode) {
      stableTickCountRef.current = 0;
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: FlatNode) {
      if (!event.active) simulation.alphaTarget(0);
      stablePositionsRef.current.set(d.id, { x: event.x, y: event.y });
      d.fx = null;
      d.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [rootNode, dimensions, highlightedPaths, onNodeClick, visibleNodeFilter, expandedDirectories]);

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
