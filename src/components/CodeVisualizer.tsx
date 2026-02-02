import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { ClusterData, FlatNode, Link } from '../types';
import { useGraphStore } from '../stores/graphStore';
import {
  selectExpandedDirectories,
  selectFlowPathLinkIds,
  selectFlowPathNodeIds,
  selectGraphLinks,
  selectGraphNodes,
  selectLoadingPaths,
  selectRequestExpandNode,
  selectRootNode
} from '../stores/graphSelectors';

const LAYOUT_DB_NAME = 'graphLayoutCache';
const LAYOUT_STORE_NAME = 'positions';

const openLayoutDB = () => new Promise<IDBDatabase | null>((resolve) => {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    resolve(null);
    return;
  }
  const request = window.indexedDB.open(LAYOUT_DB_NAME, 1);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(LAYOUT_STORE_NAME)) {
      db.createObjectStore(LAYOUT_STORE_NAME);
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => resolve(null);
});

const readLayoutCache = async (hash: string) => {
  const db = await openLayoutDB();
  if (!db) return null;
  return new Promise<Record<string, { x: number; y: number }> | null>((resolve) => {
    const transaction = db.transaction(LAYOUT_STORE_NAME, 'readonly');
    const store = transaction.objectStore(LAYOUT_STORE_NAME);
    const request = store.get(hash);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => resolve(null);
  });
};

const writeLayoutCache = async (hash: string, positions: Record<string, { x: number; y: number }>) => {
  const db = await openLayoutDB();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const transaction = db.transaction(LAYOUT_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(LAYOUT_STORE_NAME);
    store.put(positions, hash);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  });
};

const hashString = (input: string) => {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
};

const buildGraphHash = (nodes: FlatNode[], links: Link[]) => {
  const nodeParts = [...nodes]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(node => `${node.id}:${node.type}`)
    .join('|');
  const linkParts = [...links]
    .map(link => `${link.source}->${link.target}:${link.kind ?? 'structural'}`)
    .sort()
    .join('|');
  return hashString(`${nodeParts}::${linkParts}`);
};

const filterLayoutPositions = (
  positions: Record<string, { x: number; y: number }> | null | undefined,
  nodes: FlatNode[]
): Record<string, { x: number; y: number }> | null => {
  if (!positions) return null;
  const nodeIds = new Set(nodes.map(node => node.id));
  const next: Record<string, { x: number; y: number }> = {};
  Object.entries(positions).forEach(([id, position]) => {
    if (!nodeIds.has(id)) return;
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) return;
    next[id] = { x: position.x, y: position.y };
  });
  return Object.keys(next).length > 0 ? next : null;
};

const CodeVisualizer: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rootNode = useGraphStore(selectRootNode);
  const loadingPaths = useGraphStore(selectLoadingPaths);
  const expandedDirectories = useGraphStore(selectExpandedDirectories);
  const graphNodes = useGraphStore(selectGraphNodes);
  const graphLinks = useGraphStore(selectGraphLinks);
  const flowPathNodeIds = useGraphStore(selectFlowPathNodeIds);
  const flowPathLinkIds = useGraphStore(selectFlowPathLinkIds);
  const setSelectedNode = useGraphStore((state) => state.setSelectedNode);
  const expandDirectory = useGraphStore((state) => state.expandDirectory);
  const toggleDirectory = useGraphStore((state) => state.toggleDirectory);
  const requestExpandNode = useGraphStore(selectRequestExpandNode);
  const sessionLayout = useGraphStore((state) => state.sessionLayout);
  const setLayoutCache = useGraphStore((state) => state.setLayoutCache);
  const setSessionLayout = useGraphStore((state) => state.setSessionLayout);
  const [dimensions, setDimensions] = useState({ width: 1000, height: 800 });
  const [visibleNodeFilter, setVisibleNodeFilter] = useState<'all' | 'directories'>('all');
  const zoomTransformRef = useRef(d3.zoomIdentity);
  const stablePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const workerRef = useRef<Worker | null>(null);
  const layoutRequestIdRef = useRef(0);
  const [layoutPositions, setLayoutPositions] = useState<Record<string, { x: number; y: number }>>({});
  const pendingLayoutRef = useRef<{ requestId: number; positions: Record<string, { x: number; y: number }> } | null>(null);
  const layoutFrameRef = useRef<number | null>(null);
  const layoutCacheRef = useRef<Map<string, Record<string, { x: number; y: number }>>>(new Map());
  const layoutHashRef = useRef<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const renderCanvasRef = useRef<() => void>(() => {});
  const dragStateRef = useRef<{ nodeId: string | null; isDragging: boolean }>({ nodeId: null, isDragging: false });
  const clickTimeoutRef = useRef<number | null>(null);

  // VITE_GRAPH_RENDERER=canvas|webgl switches to the canvas-backed renderer (webgl currently uses canvas fallback).
  const renderMode = (import.meta.env.VITE_GRAPH_RENDERER ?? 'svg').toLowerCase();
  const useCanvasRenderer = renderMode === 'canvas' || renderMode === 'webgl';

  const layoutPositionsRef = useRef(layoutPositions);
  useEffect(() => {
    layoutPositionsRef.current = layoutPositions;
  }, [layoutPositions]);

  const isAggregateNode = (node: FlatNode) => node.type === 'directory' || node.type === 'cluster';
  const getNodeRadius = (node: FlatNode) => {
    if (node.type === 'cluster') return 18;
    if (node.type === 'directory') return 15;
    if (node.type === 'file') return 10;
    return 6;
  };
  const isFlowNode = useCallback((node: FlatNode) => flowPathNodeIds.has(node.id), [flowPathNodeIds]);
  const getLinkId = useCallback((link: Link) => {
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
    const targetId = typeof link.target === 'string' ? link.target : link.target.id;
    return link.kind ? `${link.kind}:${sourceId}-->${targetId}` : `${sourceId}-->${targetId}`;
  }, []);
  const isFlowLink = useCallback((link: Link) => flowPathLinkIds.has(getLinkId(link)), [flowPathLinkIds, getLinkId]);
  const getNodeFill = (node: FlatNode) => {
    if (isFlowNode(node)) return "#f97316";
    if (node.relevant) return "#facc15";
    switch (node.type) {
      case 'cluster': return "#0f172a";
      case 'directory': return "#3b82f6";
      case 'file': return "#64748b";
      case 'function': return "#4ade80";
      case 'class': return "#f472b6";
      case 'api_endpoint': return "#a78bfa";
      default: return "#94a3b8";
    }
  };
  const getNodeStroke = (node: FlatNode) => {
    if (isFlowNode(node)) return "#fdba74";
    if (node.relevant) return "#ffffff";
    if (node.type === 'cluster') return "#38bdf8";
    return "transparent";
  };
  const getNodeStrokeWidth = (node: FlatNode) => {
    if (isFlowNode(node)) return 3;
    return node.type === 'cluster' ? 2.5 : 2;
  };
  const getNodeDash = (node: FlatNode) => (node.type === 'cluster' ? [4, 3] : []);
  const getLinkStroke = (link: Link) => {
    if (isFlowLink(link)) return '#f97316';
    switch (link.kind) {
      case 'import':
        return '#38bdf8';
      case 'call':
        return '#4ade80';
      default:
        return '#475569';
    }
  };
  const getLinkDash = (link: Link) => {
    switch (link.kind) {
      case 'import':
        return [4, 3];
      case 'call':
        return [2, 2];
      default:
        return [];
    }
  };
  const getLinkOpacity = (link: Link) => (isFlowLink(link) ? 0.9 : (link.kind ? 0.6 : 0.4));
  const isNodeLoading = useCallback((d: FlatNode) => {
    if (d.type === 'cluster') {
      const { parentPath } = d.data as ClusterData;
      return loadingPaths.has(parentPath);
    }
    return loadingPaths.has(d.path);
  }, [loadingPaths]);

  // Nodes are restricted to directories when zoomed out below this threshold.
  // Adjust to change when file-level nodes become visible.
  const DIRECTORY_ONLY_ZOOM_THRESHOLD = 0.7;

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
    stablePositionsRef.current = new Map();
    setLayoutPositions({});
    setHoveredNodeId(null);
  }, [rootNode]);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/graphLayout.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<{ requestId: number; positions: Record<string, { x: number; y: number }> }>) => {
      if (event.data.requestId !== layoutRequestIdRef.current) return;
      pendingLayoutRef.current = event.data;
      if (layoutFrameRef.current !== null) return;
      layoutFrameRef.current = window.requestAnimationFrame(() => {
        layoutFrameRef.current = null;
        const pending = pendingLayoutRef.current;
        if (!pending) return;
        pendingLayoutRef.current = null;
        setLayoutPositions(pending.positions);
        stablePositionsRef.current = new Map(Object.entries(pending.positions));
      });
    };

    return () => {
      if (layoutFrameRef.current !== null) {
        window.cancelAnimationFrame(layoutFrameRef.current);
        layoutFrameRef.current = null;
      }
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const { filteredNodes, filteredLinks } = useMemo(() => {
    const shouldShowDirectoriesOnly = visibleNodeFilter === 'directories';
    const nextNodes = shouldShowDirectoriesOnly
      ? graphNodes.filter(node => node.type === 'directory' || node.type === 'cluster')
      : graphNodes;
    const filteredNodeIds = new Set(nextNodes.map(node => node.id));
    const nextLinks = graphLinks.filter(link => filteredNodeIds.has(link.source as string) && filteredNodeIds.has(link.target as string));
    return { filteredNodes: nextNodes, filteredLinks: nextLinks };
  }, [graphLinks, graphNodes, visibleNodeFilter]);

  const graphHash = useMemo(() => buildGraphHash(filteredNodes, filteredLinks), [filteredLinks, filteredNodes]);

  useEffect(() => {
    if (!rootNode) return;
    layoutHashRef.current = graphHash;
    let isActive = true;

    const applyPositions = (positions: Record<string, { x: number; y: number }>) => {
      if (!isActive || layoutHashRef.current !== graphHash) return;
      stablePositionsRef.current = new Map(Object.entries(positions));
      setLayoutPositions(positions);
    };

    const memoryCache = filterLayoutPositions(layoutCacheRef.current.get(graphHash) ?? null, filteredNodes);
    if (memoryCache) {
      applyPositions(memoryCache);
      return () => {
        isActive = false;
      };
    }

    stablePositionsRef.current = new Map();
    setLayoutPositions({});

    readLayoutCache(graphHash).then((cached) => {
      const compatible = filterLayoutPositions(cached, filteredNodes);
      if (!compatible) return;
      layoutCacheRef.current.set(graphHash, compatible);
      applyPositions(compatible);
    });

    return () => {
      isActive = false;
    };
  }, [graphHash, rootNode, filteredNodes]);

  useEffect(() => {
    if (!rootNode || !sessionLayout) return;
    if (sessionLayout.hash !== graphHash) return;
    const compatible = filterLayoutPositions(sessionLayout.positions, filteredNodes);
    if (!compatible) {
      setSessionLayout(null);
      return;
    }
    stablePositionsRef.current = new Map(Object.entries(compatible));
    setLayoutPositions(compatible);
    layoutCacheRef.current.set(graphHash, compatible);
    writeLayoutCache(graphHash, compatible);
    setSessionLayout(null);
  }, [filteredNodes, graphHash, rootNode, sessionLayout, setSessionLayout]);

  useEffect(() => {
    if (!graphHash || Object.keys(layoutPositions).length === 0) return;
    layoutCacheRef.current.set(graphHash, layoutPositions);
    writeLayoutCache(graphHash, layoutPositions);
    setLayoutCache(graphHash, layoutPositions);
  }, [graphHash, layoutPositions, setLayoutCache]);

  useEffect(() => {
    if (!rootNode || !workerRef.current) return;

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
  }, [rootNode, filteredNodes, filteredLinks, dimensions]);

  useEffect(() => {
    if (!rootNode || !svgRef.current || useCanvasRenderer) return;

    const { width, height } = dimensions;

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
      .selectAll("line")
      .data(filteredLinks)
      .join("line")
      .attr("stroke", d => getLinkStroke(d))
      .attr("stroke-opacity", d => getLinkOpacity(d))
      .attr("stroke-width", d => isAggregateNode(d.target as FlatNode) ? 2 : 1);
    link.attr("stroke-dasharray", d => getLinkDash(d).join(' '));

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
          requestExpandNode?.(parentPath);
          expandDirectory(parentPath);
          return;
        }
        setSelectedNode(d.id);
      })
      .on("dblclick", (event, d) => {
        if (d.type === 'directory') {
          event.stopPropagation();
          if (expandedDirectories.has(d.path)) {
            toggleDirectory(d.path);
          } else {
            requestExpandNode?.(d.path);
            toggleDirectory(d.path);
          }
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
      .attr("fill", d => getNodeFill(d))
      .attr("stroke", d => getNodeStroke(d))
      .attr("stroke-width", d => getNodeStrokeWidth(d))
      .attr("stroke-dasharray", d => getNodeDash(d).join(' '));

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
  }, [rootNode, dimensions, visibleNodeFilter, expandedDirectories, loadingPaths, filteredNodes, filteredLinks, layoutPositions, useCanvasRenderer, isNodeLoading, requestExpandNode, expandDirectory, toggleDirectory, setSelectedNode, flowPathNodeIds, flowPathLinkIds, isFlowLink, isFlowNode]);

  const updateNodePositions = useCallback(() => {
    const { width, height } = dimensions;
    const positions = new Map<string, { x: number; y: number }>();
    filteredNodes.forEach(node => {
      const savedPosition = layoutPositionsRef.current[node.id] ?? stablePositionsRef.current.get(node.id);
      const nextPosition = savedPosition ?? { x: width / 2, y: height / 2 };
      node.x = nextPosition.x;
      node.y = nextPosition.y;
      positions.set(node.id, nextPosition);
    });
    return positions;
  }, [dimensions, filteredNodes]);

  const resolveNodeAtPosition = useCallback((x: number, y: number) => {
    const transform = zoomTransformRef.current;
    const [graphX, graphY] = transform.invert([x, y]);
    for (let i = filteredNodes.length - 1; i >= 0; i -= 1) {
      const node = filteredNodes[i];
      const radius = getNodeRadius(node) + 4;
      const savedPosition = layoutPositionsRef.current[node.id] ?? stablePositionsRef.current.get(node.id);
      const nodeX = savedPosition?.x ?? node.x ?? dimensions.width / 2;
      const nodeY = savedPosition?.y ?? node.y ?? dimensions.height / 2;
      const dx = graphX - nodeX;
      const dy = graphY - nodeY;
      if (dx * dx + dy * dy <= radius * radius) {
        return node;
      }
    }
    return null;
  }, [dimensions.height, dimensions.width, filteredNodes]);

  const renderCanvas = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = dimensions;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const transform = zoomTransformRef.current;
    ctx.save();
    ctx.setTransform(transform.k * dpr, 0, 0, transform.k * dpr, transform.x * dpr, transform.y * dpr);

    const positions = updateNodePositions();
    const nodeById = new Map(filteredNodes.map(node => [node.id, node]));

    const aggregateLinks: Link[] = [];
    const normalLinks: Link[] = [];
    filteredLinks.forEach(link => {
      const targetNode = nodeById.get(link.target as string);
      if (targetNode && isAggregateNode(targetNode)) {
        aggregateLinks.push(link);
      } else {
        normalLinks.push(link);
      }
    });

    type LinkBatch = {
      links: Link[];
      stroke: string;
      dash: number[];
      opacity: number;
      width: number;
    };

    const renderLinkBatches = (links: Link[], strokeWidth: number) => {
      const batches = new Map<string, LinkBatch>();
      links.forEach((link) => {
        const stroke = getLinkStroke(link);
        const dash = getLinkDash(link);
        const opacity = getLinkOpacity(link);
        const key = `${stroke}|${dash.join(',')}|${opacity}|${strokeWidth}`;
        const batch = batches.get(key) ?? { links: [], stroke, dash, opacity, width: strokeWidth };
        batch.links.push(link);
        batches.set(key, batch);
      });
      batches.forEach((batch) => {
        if (batch.links.length === 0) return;
        ctx.beginPath();
        batch.links.forEach(link => {
          const sourcePos = positions.get(link.source as string);
          const targetPos = positions.get(link.target as string);
          if (!sourcePos || !targetPos) return;
          ctx.moveTo(sourcePos.x, sourcePos.y);
          ctx.lineTo(targetPos.x, targetPos.y);
        });
        ctx.strokeStyle = batch.stroke;
        ctx.globalAlpha = batch.opacity;
        ctx.lineWidth = batch.width;
        ctx.setLineDash(batch.dash);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
      });
    };

    renderLinkBatches(normalLinks, 1);
    renderLinkBatches(aggregateLinks, 2);

    type NodeBatch = {
      nodes: FlatNode[];
      fill: string;
      stroke: string;
      strokeWidth: number;
      dash: number[];
      radius: number;
    };

    const batches = new Map<string, NodeBatch>();
    filteredNodes.forEach(node => {
      const radius = getNodeRadius(node);
      const fill = getNodeFill(node);
      const stroke = getNodeStroke(node);
      const strokeWidth = getNodeStrokeWidth(node);
      const dash = getNodeDash(node);
      const key = `${fill}|${stroke}|${strokeWidth}|${dash.join(',')}|${radius}`;
      const batch = batches.get(key) ?? { nodes: [], fill, stroke, strokeWidth, dash, radius };
      batch.nodes.push(node);
      batches.set(key, batch);
    });

    batches.forEach(batch => {
      ctx.beginPath();
      batch.nodes.forEach(node => {
        const position = positions.get(node.id);
        if (!position) return;
        ctx.moveTo(position.x + batch.radius, position.y);
        ctx.arc(position.x, position.y, batch.radius, 0, Math.PI * 2);
      });
      ctx.fillStyle = batch.fill;
      ctx.fill();
      if (batch.stroke !== "transparent") {
        ctx.strokeStyle = batch.stroke;
        ctx.lineWidth = batch.strokeWidth;
        ctx.setLineDash(batch.dash);
        ctx.stroke();
      }
    });

    filteredNodes.forEach(node => {
      if (!isNodeLoading(node)) return;
      const position = positions.get(node.id);
      if (!position) return;
      const radius = (node.type === 'cluster' || node.type === 'directory') ? 22 : 16;
      ctx.beginPath();
      ctx.arc(position.x, position.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.stroke();

      ctx.fillStyle = "#38bdf8";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText("Carregando...", position.x, position.y + (node.type === 'directory' ? 40 : 34));
    });

    if (hoveredNodeId) {
      const hoveredNode = nodeById.get(hoveredNodeId);
      const position = hoveredNode ? positions.get(hoveredNode.id) : null;
      if (hoveredNode && position) {
        ctx.beginPath();
        ctx.arc(position.x, position.y, getNodeRadius(hoveredNode) + 6, 0, Math.PI * 2);
        ctx.strokeStyle = "#f8fafc";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
      }
    }

    ctx.fillStyle = "#cbd5e1";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;
    filteredNodes.forEach(node => {
      const position = positions.get(node.id);
      if (!position) return;
      ctx.font = node.type === 'directory' ? "12px sans-serif" : "10px sans-serif";
      const labelOffset = node.type === 'directory' ? 25 : 20;
      ctx.fillText(node.name, position.x, position.y + labelOffset);
    });

    ctx.restore();
  }, [dimensions, filteredLinks, filteredNodes, hoveredNodeId, isNodeLoading, updateNodePositions, flowPathNodeIds, flowPathLinkIds, isFlowLink, isFlowNode]);

  useEffect(() => {
    renderCanvasRef.current = renderCanvas;
  }, [renderCanvas]);

  useEffect(() => {
    if (!useCanvasRenderer || !canvasRef.current) return;
    const canvas = canvasRef.current;

    const zoom = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        zoomTransformRef.current = event.transform;
        const nextFilter = event.transform.k < DIRECTORY_ONLY_ZOOM_THRESHOLD ? 'directories' : 'all';
        setVisibleNodeFilter(current => (current === nextFilter ? current : nextFilter));
        renderCanvasRef.current();
      });

    const selection = d3.select(canvas);
    selection.call(zoom);
    selection.call(zoom.transform, zoomTransformRef.current);

    return () => {
      selection.on(".zoom", null);
    };
  }, [useCanvasRenderer]);

  useEffect(() => {
    if (!useCanvasRenderer || !canvasRef.current) return;
    const canvas = canvasRef.current;

    const handlePointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const node = resolveNodeAtPosition(event.clientX - rect.left, event.clientY - rect.top);
      const nextId = node?.id ?? null;
      if (nextId !== hoveredNodeId) {
        setHoveredNodeId(nextId);
        canvas.style.cursor = node ? "pointer" : "default";
        renderCanvasRef.current();
      }
      if (dragStateRef.current.isDragging && dragStateRef.current.nodeId) {
        const transform = zoomTransformRef.current;
        const [graphX, graphY] = transform.invert([event.clientX - rect.left, event.clientY - rect.top]);
        stablePositionsRef.current.set(dragStateRef.current.nodeId, { x: graphX, y: graphY });
        renderCanvasRef.current();
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const node = resolveNodeAtPosition(event.clientX - rect.left, event.clientY - rect.top);
      if (node) {
        dragStateRef.current = { nodeId: node.id, isDragging: true };
      }
    };

    const handlePointerUp = () => {
      if (dragStateRef.current.isDragging && dragStateRef.current.nodeId) {
        const nodeId = dragStateRef.current.nodeId;
        const position = stablePositionsRef.current.get(nodeId);
        if (position) {
          setLayoutPositions(prev => ({ ...prev, [nodeId]: position }));
        }
      }
      dragStateRef.current = { nodeId: null, isDragging: false };
    };

    const handleClick = (event: MouseEvent) => {
      if (dragStateRef.current.isDragging) return;
      const rect = canvas.getBoundingClientRect();
      const node = resolveNodeAtPosition(event.clientX - rect.left, event.clientY - rect.top);
      if (!node) return;
      if (clickTimeoutRef.current) {
        window.clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      clickTimeoutRef.current = window.setTimeout(() => {
        if (node.type === 'cluster') {
          const { parentPath } = node.data as ClusterData;
          requestExpandNode?.(parentPath);
          expandDirectory(parentPath);
          return;
        }
        setSelectedNode(node.id);
      }, 150);
    };

    const handleDoubleClick = (event: MouseEvent) => {
      if (clickTimeoutRef.current) {
        window.clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      const rect = canvas.getBoundingClientRect();
      const node = resolveNodeAtPosition(event.clientX - rect.left, event.clientY - rect.top);
      if (node?.type === 'directory') {
        if (expandedDirectories.has(node.path)) {
          toggleDirectory(node.path);
        } else {
          requestExpandNode?.(node.path);
          toggleDirectory(node.path);
        }
      }
    };

    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointerleave", handlePointerUp);
    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("dblclick", handleDoubleClick);

    return () => {
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointerleave", handlePointerUp);
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("dblclick", handleDoubleClick);
    };
  }, [expandedDirectories, hoveredNodeId, requestExpandNode, resolveNodeAtPosition, setSelectedNode, toggleDirectory, useCanvasRenderer, expandDirectory]);

  useEffect(() => {
    if (!useCanvasRenderer) return;
    renderCanvasRef.current();
  }, [dimensions, filteredLinks, filteredNodes, hoveredNodeId, layoutPositions, loadingPaths, useCanvasRenderer, visibleNodeFilter, flowPathNodeIds, flowPathLinkIds, isFlowLink, isFlowNode]);

  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        window.clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

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
      {useCanvasRenderer ? (
        <canvas ref={canvasRef} className="w-full h-full" role="img" aria-label="Graph canvas renderer" />
      ) : (
        <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="w-full h-full" />
      )}

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
