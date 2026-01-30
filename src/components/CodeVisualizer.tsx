import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { FileSystemNode, FlatNode, Link } from '../types';

interface CodeVisualizerProps {
  rootNode: FileSystemNode | null;
  highlightedPaths: string[];
  onNodeClick: (node: FlatNode) => void;
}

const CodeVisualizer: React.FC<CodeVisualizerProps> = ({ rootNode, highlightedPaths, onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 1000, height: 800 });

  // Flatten hierarchical data
  const flattenData = (root: FileSystemNode): { nodes: FlatNode[], links: Link[] } => {
    const nodes: FlatNode[] = [];
    const links: Link[] = [];

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

      if (node.children) {
        node.children.forEach(child => traverse(child, node.path, depth + 1));
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
    if (!rootNode || !svgRef.current) return;

    const { width, height } = dimensions;
    const { nodes, links } = flattenData(rootNode);

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(d => (d.target as FlatNode).type === 'directory' ? 150 : 80))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(40));

    // Links
    const link = g.append("g")
      .attr("stroke", "#475569")
      .attr("stroke-opacity", 0.4)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", d => (d.target as FlatNode).type === 'directory' ? 2 : 1);

    // Nodes
    const node = g.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .on("click", (event, d) => {
        event.stopPropagation();
        onNodeClick(d);
      })
      .call(d3.drag<SVGGElement, FlatNode>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended) as any);

    // Node Shapes
    node.append("circle")
      .attr("r", d => {
        if (d.type === 'directory') return 15;
        if (d.type === 'file') return 10;
        return 6;
      })
      .attr("fill", d => {
        if (d.relevant) return "#facc15"; // Highlight
        switch (d.type) {
          case 'directory': return "#3b82f6";
          case 'file': return "#64748b";
          case 'function': return "#4ade80";
          case 'class': return "#f472b6";
          case 'api_endpoint': return "#a78bfa";
          default: return "#94a3b8";
        }
      })
      .attr("stroke", d => d.relevant ? "#ffffff" : "none")
      .attr("stroke-width", 2);

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
    });

    function dragstarted(event: any, d: FlatNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: FlatNode) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: FlatNode) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

  }, [rootNode, dimensions, highlightedPaths, onNodeClick]);

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
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-400"></span> Function</div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-pink-400"></span> Class</div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-400"></span> API</div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-400"></span> Relevant</div>
        </div>
      </div>
    </div>
  );
};

export default CodeVisualizer;
