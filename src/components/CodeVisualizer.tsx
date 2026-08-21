import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Maximize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { AIActionMode, ClusterData, FlatNode, Link } from '../types';
import { useGraphStore } from '../stores/graphStore';
import { usePresenceStore } from '../stores/presenceStore';
import {
  selectGraphLinks,
  selectGraphNodes,
  selectLoadingPaths,
  selectRootNode,
  selectSelectedNode,
  selectSelectedNodeIds,
  selectExpandedDirectories,
  selectFlowPathNodeIds,
  selectFlowPathLinkIds,
  selectRequestExpandNode,
  selectNodesById,
  selectGhostNodes,
  selectGhostLinks
} from '../stores/graphSelectors';
import AIContextBalloon from './AIContextBalloon';
import ContextualChat from './ContextualChat';
import { ErrorBoundary } from './ErrorBoundary';

// Helper functions for layout caching
const buildGraphHash = (nodes: FlatNode[], links: Link[]) => {
  const nodeIds = nodes.map(n => n.id).sort().join(',');
  const linkIds = links.map(l => {
    const s = typeof l.source === 'string' ? l.source : (l.source as any).id;
    const t = typeof l.target === 'string' ? l.target : (l.target as any).id;
    return `${s}-${t}`;
  }).sort().join(',');
  return `${nodeIds}|${linkIds}`;
};

const filterLayoutPositions = (positions: Record<string, { x: number; y: number }> | null, nodes: FlatNode[]) => {
  if (!positions) return null;
  const nodeIds = new Set(nodes.map(n => n.id));
  const filtered: Record<string, { x: number; y: number }> = {};
  let hasValid = false;
  Object.entries(positions).forEach(([id, pos]) => {
    if (nodeIds.has(id)) {
      filtered[id] = pos;
      hasValid = true;
    }
  });
  return hasValid ? filtered : null;
};

const readLayoutCache = async (hash: string): Promise<Record<string, { x: number; y: number }> | null> => {
  try {
    const item = localStorage.getItem(`graph_layout_${hash.substring(0, 32)}`);
    return item ? JSON.parse(item) : null;
  } catch {
    return null;
  }
};

const writeLayoutCache = (hash: string, positions: Record<string, { x: number; y: number }>) => {
  try {
    localStorage.setItem(`graph_layout_${hash.substring(0, 32)}`, JSON.stringify(positions));
  } catch { }
};

const CodeVisualizerContent: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const svgGroupRef = useRef<SVGGElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<Element, unknown> | null>(null);

  const rootNode = useGraphStore(selectRootNode);
  const loadingPaths = useGraphStore(selectLoadingPaths);
  const expandedDirectories = useGraphStore(selectExpandedDirectories);
  const graphNodes = useGraphStore(selectGraphNodes);
  const graphLinks = useGraphStore(selectGraphLinks);
  const nodesById = useGraphStore(selectNodesById);
  const flowPathNodeIds = useGraphStore(selectFlowPathNodeIds);
  const flowPathLinkIds = useGraphStore(selectFlowPathLinkIds);
  const ghostNodes = useGraphStore(selectGhostNodes);
  const ghostLinks = useGraphStore(selectGhostLinks);
  const selectedNode = useGraphStore(selectSelectedNode);
  const selectedNodeIds = useGraphStore(selectSelectedNodeIds);
  const expandDirectory = useGraphStore((state) => state.expandDirectory);
  const toggleDirectory = useGraphStore((state) => state.toggleDirectory);
  const toggleMultiSelection = useGraphStore((state) => state.toggleMultiSelection);
  const clearMultiSelection = useGraphStore((state) => state.clearMultiSelection);
  const requestExpandNode = useGraphStore(selectRequestExpandNode);
  const sessionLayout = useGraphStore((state) => state.sessionLayout);
  const setLayoutCache = useGraphStore((state) => state.setLayoutCache);
  const setSessionLayout = useGraphStore((state) => state.setSessionLayout);
  const localSelection = usePresenceStore((state) => state.localSelection);
  const setLocalCursor = usePresenceStore((state) => state.setLocalCursor);

  const triggerSelectNode = useCallback((nodeId: string | null) => {
    useGraphStore.getState().selectNode(nodeId);
  }, []);

  const peers = usePresenceStore((state) => state.peers);
  const peerPresences = useMemo(() => Object.values(peers), [peers]);
  const connectionStatus = usePresenceStore((state) => state.connectionStatus);
  const localProfile = usePresenceStore((state) => state.profile);
  const [dimensions, setDimensions] = useState({ width: 1000, height: 800 });

  // Camera transform state stored in Ref for 60 FPS viewport transformations without React re-renders
  const zoomTransformRef = useRef(d3.zoomIdentity);
  const stablePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const workerRef = useRef<Worker | null>(null);
  const layoutRequestIdRef = useRef(0);
  const [layoutPositions, setLayoutPositions] = useState<Record<string, { x: number; y: number }>>({});
  const pendingLayoutRef = useRef<{ requestId: number; positions: Record<string, { x: number; y: number }> } | null>(null);
  const layoutFrameRef = useRef<number | null>(null);
  const canvasRenderFrameRef = useRef<number | null>(null);
  const layoutCacheRef = useRef<Map<string, Record<string, { x: number; y: number }>>>(new Map());
  const layoutHashRef = useRef<string | null>(null);
  const lastSavedLayoutRef = useRef<{ hash: string; positions: Record<string, { x: number; y: number }> } | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const cursorFrameRef = useRef<number | null>(null);

  // AI Context Balloon state
  const [showBalloon, setShowBalloon] = useState(false);
  const [balloonPosition, setBalloonPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Contextual Chat state
  const [showChat, setShowChat] = useState(false);
  const [chatMode, setChatMode] = useState<AIActionMode>('explore');

  const renderMode = (import.meta.env.VITE_GRAPH_RENDERER ?? 'svg').toLowerCase();
  const useCanvasRenderer = renderMode === 'canvas' || renderMode === 'webgl';

  const cursorEntries = useMemo(
    () => peerPresences.filter((presence) => presence.cursor),
    [peerPresences]
  );
  const presenceList = useMemo(() => {
    return [
      {
        clientId: 'local',
        profile: localProfile,
        selection: localSelection
      },
      ...peerPresences
    ];
  }, [localProfile, localSelection, peerPresences]);

  const layoutPositionsRef = useRef(layoutPositions);
  useEffect(() => {
    layoutPositionsRef.current = layoutPositions;
  }, [layoutPositions]);

  const selectedNodes = useMemo(() => {
    return Array.from(selectedNodeIds).map(id => nodesById[id]).filter(Boolean);
  }, [selectedNodeIds, nodesById]);

  // Balloon positioning
  useEffect(() => {
    if (selectedNodes.length > 0) {
      const anchorNode = selectedNode || selectedNodes[0];
      if (anchorNode && anchorNode.type !== 'cluster') {
        const position = layoutPositionsRef.current[anchorNode.id] ?? stablePositionsRef.current.get(anchorNode.id);
        if (position && wrapperRef.current) {
          const transform = zoomTransformRef.current;
          const screenX = transform.applyX(position.x);
          const screenY = transform.applyY(position.y);
          setBalloonPosition({ x: screenX + 20, y: screenY - 20 });
          setShowBalloon(true);
        } else if (anchorNode.x !== undefined && anchorNode.y !== undefined) {
          const transform = zoomTransformRef.current;
          const screenX = transform.applyX(anchorNode.x);
          const screenY = transform.applyY(anchorNode.y);
          setBalloonPosition({ x: screenX + 20, y: screenY - 20 });
          setShowBalloon(true);
        } else if (wrapperRef.current) {
          setBalloonPosition({ x: dimensions.width / 2, y: dimensions.height / 2 });
          setShowBalloon(true);
        }
      } else {
        setShowBalloon(false);
      }
    } else {
      setShowBalloon(false);
    }
  }, [selectedNodes, selectedNode, dimensions.width, dimensions.height]);

  const handleAIAction = useCallback((mode: AIActionMode) => {
    setChatMode(mode);
    setShowChat(true);
    setShowBalloon(false);
  }, []);

  const handleCloseBalloon = useCallback(() => {
    setShowBalloon(false);
  }, []);

  const handleCloseChat = useCallback(() => {
    setShowChat(false);
  }, []);

  const isAggregateNode = (node: FlatNode) => node.type === 'directory' || node.type === 'cluster';
  const isGhostNode = (node: FlatNode) => node.isGhost || node.type.startsWith('ghost_');

  const getNodeRadius = (node: FlatNode) => {
    switch (node.type) {
      case 'app': return 25;
      case 'page': return 20;
      case 'layout': return 18;
      case 'section': return 16;
      case 'form': return 16;
      case 'component': return 14;
      case 'modal': return 14;
      case 'list': return 12;
      case 'button': return 10;
      case 'input': return 10;
    }
    if (node.type === 'cluster') return 18;
    if (node.type === 'directory') return 15;
    if (node.type === 'file') return 10;
    if (node.type === 'ghost_table') return 14;
    if (node.type === 'ghost_endpoint') return 12;
    if (node.type === 'ghost_service') return 14;
    return 6;
  };

  const isFlowNode = useCallback((node: FlatNode) => flowPathNodeIds.has(node.id), [flowPathNodeIds]);
  const getLinkId = useCallback((link: Link) => {
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
    const targetId = typeof link.target === 'string' ? link.target : link.target.id;
    return link.kind ? `${link.kind}:${sourceId}-->${targetId}` : `${sourceId}-->${targetId}`;
  }, []);
  const isFlowLink = useCallback((link: Link) => flowPathLinkIds.has(getLinkId(link)), [flowPathLinkIds, getLinkId]);

  const getNodeColor = (node: FlatNode) => {
    if (isFlowNode(node)) return "#f97316";
    if (node.relevant) return "#facc15";
    switch (node.type) {
      case 'app': return "#8b5cf6";
      case 'page': return "#3b82f6";
      case 'layout': return "#6366f1";
      case 'section': return "#94a3b8";
      case 'form': return "#f59e0b";
      case 'component': return "#10b981";
      case 'modal': return "#ec4899";
      case 'list': return "#06b6d4";
      case 'button': return "#f97316";
      case 'input': return "#64748b";
      case 'cluster': return "#0f172a";
      case 'directory': return "#3b82f6";
      case 'file': return "#64748b";
      case 'function': return "#4ade80";
      case 'class': return "#f472b6";
      case 'api_endpoint': return "#a78bfa";
      default: return "#94a3b8";
    }
  };

  const getNodeFill = (node: FlatNode) => {
    if (isFlowNode(node)) return "#f97316";
    if (node.diffStatus === 'added') return "rgba(16, 185, 129, 0.3)";
    if (node.diffStatus === 'modified') return "rgba(245, 158, 11, 0.3)";
    if (node.diffStatus === 'removed') return "rgba(244, 63, 94, 0.3)";
    if (isGhostNode(node)) {
      switch (node.type) {
        case 'ghost_table': return "rgba(59, 130, 246, 0.3)";
        case 'ghost_endpoint': return "rgba(34, 197, 94, 0.3)";
        case 'ghost_service': return "rgba(168, 85, 247, 0.3)";
        default: return "rgba(239, 68, 68, 0.3)";
      }
    }
    if (node.relevant) return "#facc15";
    switch (node.type) {
      case 'app': return "#8b5cf6";
      case 'page': return "#1e40af";
      case 'layout': return "#312e81";
      case 'section': return "#334155";
      case 'form': return "#78350f";
      case 'component': return "#064e3b";
      case 'modal': return "#831843";
      case 'list': return "#0e7490";
      case 'button': return "#9a3412";
      case 'input': return "#334155";
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
    if (node.diffStatus === 'added') return "#10b981";
    if (node.diffStatus === 'modified') return "#f59e0b";
    if (node.diffStatus === 'removed') return "#f43f5e";
    if (isGhostNode(node)) {
      switch (node.type) {
        case 'ghost_table': return "#3b82f6";
        case 'ghost_endpoint': return "#22c55e";
        case 'ghost_service': return "#a855f7";
        default: return "#ef4444";
      }
    }
    if (node.relevant) return "#ffffff";
    if (node.type === 'cluster') return "#38bdf8";
    if (['app', 'page', 'layout', 'section', 'form', 'component', 'modal', 'list', 'button', 'input'].includes(node.type)) {
      return getNodeColor(node);
    }
    return "transparent";
  };

  const getNodeStrokeWidth = (node: FlatNode) => {
    if (isFlowNode(node)) return 3;
    if (node.diffStatus) return 3.5;
    if (isGhostNode(node)) return 2;
    if (['app', 'page', 'layout'].includes(node.type)) return 3;
    if (['component', 'form'].includes(node.type)) return 2;
    return node.type === 'cluster' ? 2.5 : 2;
  };

  const getNodeDash = (node: FlatNode) => {
    if (isGhostNode(node)) return [4, 4];
    if (node.type === 'layout' || node.type === 'section') return [4, 2];
    return node.type === 'cluster' ? [4, 3] : [];
  };

  const getLinkStroke = (link: Link) => {
    if (isFlowLink(link)) return '#f97316';
    switch (link.kind) {
      case 'import': return '#38bdf8';
      case 'call': return '#4ade80';
      default: return '#475569';
    }
  };

  const getLinkDash = (link: Link) => {
    switch (link.kind) {
      case 'import': return [4, 3];
      case 'call': return [2, 2];
      default: return [];
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

  // Window resize handler
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

  // Cursor tracking
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const updateCursor = (event: PointerEvent) => {
      if (!wrapperRef.current) return;
      if (cursorFrameRef.current) return;
      const { clientX, clientY } = event;
      cursorFrameRef.current = window.requestAnimationFrame(() => {
        if (!wrapperRef.current) return;
        const rect = wrapperRef.current.getBoundingClientRect();
        setLocalCursor({
          x: Math.max(0, Math.min(rect.width, clientX - rect.left)),
          y: Math.max(0, Math.min(rect.height, clientY - rect.top))
        });
        cursorFrameRef.current = null;
      });
    };

    const clearCursor = () => {
      if (cursorFrameRef.current) {
        window.cancelAnimationFrame(cursorFrameRef.current);
        cursorFrameRef.current = null;
      }
      setLocalCursor(null);
    };

    wrapper.addEventListener('pointermove', updateCursor);
    wrapper.addEventListener('pointerleave', clearCursor);
    return () => {
      wrapper.removeEventListener('pointermove', updateCursor);
      wrapper.removeEventListener('pointerleave', clearCursor);
    };
  }, [setLocalCursor]);

  // Reset positions on root change
  useEffect(() => {
    if (!rootNode) return;
    stablePositionsRef.current = new Map();
    setLayoutPositions({});
    setHoveredNodeId(null);
  }, [rootNode]);

  // Layout Web Worker initialization
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
    const nextNodes = [...graphNodes, ...ghostNodes];
    const filteredNodeIds = new Set(nextNodes.map(node => node.id));
    let nextLinks = graphLinks.filter(link => {
      const s = typeof link.source === 'string' ? link.source : (link.source as any).id;
      const t = typeof link.target === 'string' ? link.target : (link.target as any).id;
      return filteredNodeIds.has(s) && filteredNodeIds.has(t);
    });
    nextLinks = [...nextLinks, ...ghostLinks];
    return { filteredNodes: nextNodes, filteredLinks: nextLinks };
  }, [graphLinks, graphNodes, ghostNodes, ghostLinks]);

  const graphHash = useMemo(() => buildGraphHash(filteredNodes, filteredLinks), [filteredLinks, filteredNodes]);

  // Read layout cache
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
      return () => { isActive = false; };
    }

    stablePositionsRef.current = new Map();
    setLayoutPositions({});

    readLayoutCache(graphHash).then((cached) => {
      const compatible = filterLayoutPositions(cached, filteredNodes);
      if (!compatible) return;
      layoutCacheRef.current.set(graphHash, compatible);
      applyPositions(compatible);
    });

    return () => { isActive = false; };
  }, [graphHash, rootNode, filteredNodes]);

  // Session layout restoration
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

  // Write layout cache
  useEffect(() => {
    if (!graphHash || Object.keys(layoutPositions).length === 0) return;
    if (lastSavedLayoutRef.current?.hash === graphHash &&
      lastSavedLayoutRef.current?.positions === layoutPositions) {
      return;
    }
    layoutCacheRef.current.set(graphHash, layoutPositions);
    writeLayoutCache(graphHash, layoutPositions);
    lastSavedLayoutRef.current = { hash: graphHash, positions: layoutPositions };
    setLayoutCache(graphHash, layoutPositions);
  }, [graphHash, layoutPositions, setLayoutCache]);

  // Worker calculation trigger
  useEffect(() => {
    if (!rootNode || !workerRef.current) return;
    const requestId = layoutRequestIdRef.current + 1;
    layoutRequestIdRef.current = requestId;
    workerRef.current.postMessage({
      requestId,
      nodes: filteredNodes.map(node => ({ id: node.id, type: node.type })),
      links: filteredLinks.map(link => ({
        source: typeof link.source === 'string' ? link.source : (link.source as any).id,
        target: typeof link.target === 'string' ? link.target : (link.target as any).id
      })),
      width: dimensions.width,
      height: dimensions.height,
      positions: Object.fromEntries(stablePositionsRef.current)
    });
  }, [rootNode, filteredNodes, filteredLinks, dimensions]);

  // Helper function to generate curved path between nodes
  const linkPath = (source: { x: number; y: number }, target: { x: number; y: number }) => {
    const midX = (source.x + target.x) / 2;
    return `M ${source.x} ${source.y} C ${midX} ${source.y}, ${midX} ${target.y}, ${target.x} ${target.y}`;
  };

  // Node position helper
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

  // Canvas 2D Renderer Loop (60 FPS, GPU-composited transform, zero React state re-renders)
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

    // Render Links
    filteredLinks.forEach(link => {
      const sId = typeof link.source === 'string' ? link.source : (link.source as any).id;
      const tId = typeof link.target === 'string' ? link.target : (link.target as any).id;
      const sourcePos = positions.get(sId);
      const targetPos = positions.get(tId);
      if (!sourcePos || !targetPos) return;

      ctx.beginPath();
      const midX = (sourcePos.x + targetPos.x) / 2;
      ctx.moveTo(sourcePos.x, sourcePos.y);
      ctx.bezierCurveTo(midX, sourcePos.y, midX, targetPos.y, targetPos.x, targetPos.y);

      ctx.strokeStyle = getLinkStroke(link);
      ctx.globalAlpha = getLinkOpacity(link);
      ctx.lineWidth = isAggregateNode(nodeById.get(tId) as FlatNode) ? 2 : 1.5;
      const dash = getLinkDash(link);
      ctx.setLineDash(dash);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
    });

    // Render Nodes
    filteredNodes.forEach(node => {
      const pos = positions.get(node.id);
      if (!pos) return;
      const radius = getNodeRadius(node);
      const isSelected = selectedNode?.id === node.id || selectedNodeIds.has(node.id);
      const isHovered = hoveredNodeId === node.id;

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = getNodeFill(node);
      ctx.fill();

      ctx.strokeStyle = isSelected ? "#f8fafc" : (isHovered ? "#bae6fd" : getNodeStroke(node));
      ctx.lineWidth = isSelected ? 3 : getNodeStrokeWidth(node);
      ctx.setLineDash(getNodeDash(node));
      ctx.stroke();
      ctx.setLineDash([]);

      // Label
      ctx.fillStyle = "#cbd5e1";
      ctx.font = node.type === 'directory' ? "12px sans-serif" : "10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const labelOffset = node.type === 'directory' || node.type === 'cluster' ? 25 : 20;
      ctx.fillText(node.name, pos.x, pos.y + labelOffset);
    });

    ctx.restore();
  }, [dimensions, filteredLinks, filteredNodes, hoveredNodeId, isAggregateNode, selectedNode, selectedNodeIds, updateNodePositions]);

  const scheduleCanvasRender = useCallback(() => {
    if (canvasRenderFrameRef.current !== null) return;
    canvasRenderFrameRef.current = window.requestAnimationFrame(() => {
      canvasRenderFrameRef.current = null;
      renderCanvas();
    });
  }, [renderCanvas]);

  // SVG Renderer & Zoom Pipeline (60 FPS on GPU compositing layer)
  useEffect(() => {
    if (!rootNode || !svgRef.current || useCanvasRenderer) return;
    const { width, height } = dimensions;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g");
    svgGroupRef.current = g.node();

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 8])
      .on("zoom", (event) => {
        zoomTransformRef.current = event.transform;
        g.attr("transform", event.transform);
      });

    zoomBehaviorRef.current = zoom as any;
    svg.call(zoom);
    svg.call(zoom.transform, zoomTransformRef.current);

    filteredNodes.forEach(node => {
      const savedPosition = layoutPositionsRef.current[node.id] ?? stablePositionsRef.current.get(node.id);
      node.x = savedPosition?.x ?? width / 2;
      node.y = savedPosition?.y ?? height / 2;
    });

    const link = g.append("g")
      .attr("fill", "none")
      .selectAll("path")
      .data(filteredLinks)
      .join("path")
      .attr("stroke", (d: any) => getLinkStroke(d))
      .attr("stroke-opacity", (d: any) => getLinkOpacity(d))
      .attr("stroke-width", (d: any) => isAggregateNode(d.target as FlatNode) ? 2 : 1.5)
      .attr("stroke-dasharray", (d: any) => getLinkDash(d).join(' '));

    const node = g.append("g")
      .selectAll("g")
      .data(filteredNodes, (d: any) => d.id)
      .join("g")
      .attr("cursor", "pointer")
      .attr("transform", d => {
        const pos = layoutPositionsRef.current[d.id] ?? stablePositionsRef.current.get(d.id);
        return pos ? `translate(${pos.x},${pos.y})` : `translate(${width / 2},${height / 2})`;
      })
      .on("click", (event, d) => {
        event.stopPropagation();
        if (d.type === 'cluster') {
          triggerSelectNode(d.id);
          const { parentPath } = d.data as ClusterData;
          requestExpandNode?.(parentPath);
          expandDirectory(parentPath);
          return;
        }
        if (event.shiftKey) {
          toggleMultiSelection(d.id);
        } else {
          if (selectedNodeIds.size > 0) clearMultiSelection();
          triggerSelectNode(d.id);
        }
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
      .on("mouseover", (_event, d) => setHoveredNodeId(d.id))
      .on("mouseout", () => setHoveredNodeId(null));

    node.each(function (d) {
      const gNode = d3.select(this);
      gNode.selectAll("*").remove();

      // Node circle
      gNode.append("circle")
        .attr("r", getNodeRadius(d))
        .attr("fill", getNodeFill(d))
        .attr("stroke", d.id === selectedNode?.id || selectedNodeIds.has(d.id) ? "#f8fafc" : (d.id === hoveredNodeId ? "#bae6fd" : getNodeStroke(d)))
        .attr("stroke-width", d.id === selectedNode?.id || selectedNodeIds.has(d.id) ? 3 : getNodeStrokeWidth(d))
        .attr("stroke-dasharray", getNodeDash(d).join(","))
        .style("filter", d.id === selectedNode?.id || selectedNodeIds.has(d.id) ? "drop-shadow(0 0 6px rgba(56, 189, 248, 0.6))" : "none");

      // Loading ring
      if (isNodeLoading(d)) {
        gNode.append("circle")
          .attr("r", (d.type === 'cluster' || d.type === 'directory') ? 22 : 16)
          .attr("fill", "none")
          .attr("stroke", "#38bdf8")
          .attr("stroke-width", 2)
          .attr("class", "loading-ring");
      }

      // Label
      gNode.append("text")
        .attr("dy", d.type === 'directory' || d.type === 'cluster' ? 25 : 20)
        .attr("text-anchor", "middle")
        .attr("fill", "#cbd5e1")
        .attr("font-size", d.type === 'directory' ? "12px" : "10px")
        .style("pointer-events", "none")
        .style("text-shadow", "0 1px 2px rgba(0,0,0,0.8)")
        .text(d.name);

      // Expand/Collapse Button for Directories
      if (d.type === 'directory') {
        const hasChildren = (d.data as any)?.children?.length > 0 || (d.data as any)?.hasChildren;
        if (hasChildren) {
          const isCollapsed = !!d.collapsed;
          const btnGroup = gNode.append("g")
            .attr("class", "expand-btn")
            .attr("transform", `translate(${getNodeRadius(d) + 6}, 0)`)
            .attr("cursor", "pointer");

          btnGroup.append("circle")
            .attr("r", 8)
            .attr("fill", "#1e293b")
            .attr("stroke", "#475569")
            .attr("stroke-width", 1.5);

          btnGroup.append("text")
            .attr("dy", 3.5)
            .attr("text-anchor", "middle")
            .attr("fill", "#f8fafc")
            .attr("font-size", "10px")
            .attr("font-weight", "bold")
            .style("pointer-events", "none")
            .text(isCollapsed ? "+" : "-");

          btnGroup.on("click", (e) => {
            e.stopPropagation();
            if (isCollapsed) {
              requestExpandNode?.(d.path);
              expandDirectory(d.path);
            } else {
              toggleDirectory(d.path);
            }
          });
        }
      }
    });

    const updateLayout = () => {
      const nMap = new Map(filteredNodes.map(n => [n.id, n]));
      link.attr("d", (d: any) => {
        const sId = typeof d.source === 'object' ? d.source.id : d.source;
        const tId = typeof d.target === 'object' ? d.target.id : d.target;
        const sNode = nMap.get(sId);
        const tNode = nMap.get(tId);
        if (!sNode || !tNode) return "";
        return linkPath({ x: sNode.x!, y: sNode.y! }, { x: tNode.x!, y: tNode.y! });
      });
      node.attr("transform", d => `translate(${d.x},${d.y})`);
    };

    function dragstarted(_event: any, d: FlatNode) {
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

    node.call(d3.drag<any, FlatNode>()
      .filter((event) => !event.target.closest('.expand-btn'))
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended));

    updateLayout();

    return () => {
      g.remove();
    };
  }, [rootNode, dimensions, expandedDirectories, loadingPaths, filteredNodes, filteredLinks, layoutPositions, useCanvasRenderer, isNodeLoading, requestExpandNode, expandDirectory, toggleDirectory, triggerSelectNode, flowPathNodeIds, flowPathLinkIds, isFlowLink, isFlowNode, peerPresences, selectedNode, selectedNodeIds, hoveredNodeId]);

  // Canvas zoom initialization
  useEffect(() => {
    if (!useCanvasRenderer || !canvasRef.current) return;
    const canvas = canvasRef.current;

    const zoom = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.05, 8])
      .on("zoom", (event) => {
        zoomTransformRef.current = event.transform;
        scheduleCanvasRender();
      });

    zoomBehaviorRef.current = zoom as any;
    const selection = d3.select(canvas);
    selection.call(zoom);
    selection.call(zoom.transform, zoomTransformRef.current);

    return () => {
      selection.on(".zoom", null);
    };
  }, [useCanvasRenderer, scheduleCanvasRender]);

  // Canvas render update
  useEffect(() => {
    if (!useCanvasRenderer) return;
    scheduleCanvasRender();
  }, [useCanvasRenderer, scheduleCanvasRender, dimensions, filteredLinks, filteredNodes, hoveredNodeId, layoutPositions]);

  // Recenter / Reset Viewport Handler
  const handleRecenter = useCallback(() => {
    const positions = Object.values(layoutPositions);
    if (positions.length === 0) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    positions.forEach(pos => {
      if (pos.x < minX) minX = pos.x;
      if (pos.x > maxX) maxX = pos.x;
      if (pos.y < minY) minY = pos.y;
      if (pos.y > maxY) maxY = pos.y;
    });

    const padding = 100;
    const dx = Math.max(50, maxX - minX + padding * 2);
    const dy = Math.max(50, maxY - minY + padding * 2);
    const { width, height } = dimensions;

    const scale = Math.min(2, Math.max(0.2, 0.85 / Math.max(dx / width, dy / height)));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const nextTransform = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(scale)
      .translate(-centerX, -centerY);

    const targetEl = useCanvasRenderer ? canvasRef.current : svgRef.current;
    if (targetEl && zoomBehaviorRef.current) {
      d3.select(targetEl)
        .transition()
        .duration(600)
        .ease(d3.easeCubicOut)
        .call(zoomBehaviorRef.current.transform as any, nextTransform);
    }
  }, [dimensions, layoutPositions, useCanvasRenderer]);

  const handleZoomIn = useCallback(() => {
    const targetEl = useCanvasRenderer ? canvasRef.current : svgRef.current;
    if (targetEl && zoomBehaviorRef.current) {
      d3.select(targetEl).transition().duration(250).call(zoomBehaviorRef.current.scaleBy as any, 1.3);
    }
  }, [useCanvasRenderer]);

  const handleZoomOut = useCallback(() => {
    const targetEl = useCanvasRenderer ? canvasRef.current : svgRef.current;
    if (targetEl && zoomBehaviorRef.current) {
      d3.select(targetEl).transition().duration(250).call(zoomBehaviorRef.current.scaleBy as any, 0.7);
    }
  }, [useCanvasRenderer]);

  const handleResetZoom = useCallback(() => {
    const targetEl = useCanvasRenderer ? canvasRef.current : svgRef.current;
    if (targetEl && zoomBehaviorRef.current) {
      d3.select(targetEl).transition().duration(300).call(zoomBehaviorRef.current.transform as any, d3.zoomIdentity);
    }
  }, [useCanvasRenderer]);

  if (!rootNode) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 bg-slate-900/50 rounded-lg border-2 border-dashed border-slate-700 p-8">
        <p className="text-lg font-medium mb-2">No Project Loaded</p>
        <p className="text-sm">Import a GitHub repository, open a local directory, or upload a .ZIP to visualize the graph.</p>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="w-full h-full relative bg-slate-950 overflow-hidden select-none">
      {useCanvasRenderer ? (
        <canvas ref={canvasRef} className="w-full h-full block" role="img" aria-label="Graph canvas renderer" />
      ) : (
        <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="w-full h-full block" />
      )}

      {/* Viewport & Navigation Controls */}
      <div className="absolute bottom-6 right-6 flex items-center bg-slate-900/90 backdrop-blur border border-slate-700/80 rounded-xl shadow-2xl p-1.5 gap-1 z-30">
        <button
          onClick={handleZoomIn}
          title="Zoom In (+)"
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={handleZoomOut}
          title="Zoom Out (-)"
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ZoomOut size={16} />
        </button>
        <button
          onClick={handleRecenter}
          title="Fit & Recenter Graph"
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-indigo-300 hover:text-white hover:bg-indigo-600/30 bg-indigo-500/10 border border-indigo-500/30 rounded-lg transition-colors"
        >
          <Maximize2 size={14} /> Recenter
        </button>
        <button
          onClick={handleResetZoom}
          title="Reset Viewport 1:1"
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <RotateCcw size={15} />
        </button>
      </div>

      {/* Peer Cursors */}
      {cursorEntries.map((presence) => (
        <div
          key={presence.clientId}
          className="absolute pointer-events-none flex items-center gap-2 text-xs"
          style={{
            left: presence.cursor?.x ?? 0,
            top: presence.cursor?.y ?? 0,
            transform: 'translate(8px, 8px)'
          }}
        >
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: presence.profile.color, boxShadow: `0 0 8px ${presence.profile.color}` }}
          />
          <span className="text-slate-200 bg-slate-900/80 px-2 py-0.5 rounded">
            {presence.profile.name}
          </span>
        </div>
      ))}

      {/* Presence Card */}
      <div className="absolute top-4 right-4 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg shadow-lg p-3 w-56 z-20">
        <div className="flex items-center justify-between text-xs text-slate-300">
          <span className="font-semibold text-slate-100">Presença</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${connectionStatus === 'connected'
            ? 'bg-emerald-500/20 text-emerald-300'
            : connectionStatus === 'connecting'
              ? 'bg-amber-500/20 text-amber-200'
              : 'bg-slate-700 text-slate-300'
            }`}>
            {connectionStatus === 'connected' ? 'Online' : connectionStatus === 'connecting' ? 'Conectando' : 'Offline'}
          </span>
        </div>
        <div className="mt-2 space-y-2">
          {presenceList.map((presence) => {
            const selectionId = presence.selection?.selectedNodeId ?? null;
            const nodeName = selectionId ? nodesById[selectionId]?.name ?? selectionId : 'Nenhuma seleção';
            return (
              <div key={presence.clientId} className="flex items-start gap-2 text-xs">
                <span
                  className="mt-1 w-2 h-2 rounded-full"
                  style={{ backgroundColor: presence.profile.color }}
                />
                <div>
                  <div className="text-slate-200">{presence.profile.name}{presence.clientId === 'local' ? ' (você)' : ''}</div>
                  <div className="text-slate-400">{nodeName}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur p-3 rounded-lg border border-slate-700 text-xs text-slate-300 shadow-lg z-20 max-w-sm">
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
        {ghostNodes.length > 0 && (
          <>
            <div className="font-semibold mb-2 mt-3 text-purple-300">🔮 Backend Necessário</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full border-2 border-dashed border-blue-400 bg-blue-500/30"></span> Tabela</div>
              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full border-2 border-dashed border-green-400 bg-green-500/30"></span> Endpoint</div>
              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full border-2 border-dashed border-purple-400 bg-purple-500/30"></span> Serviço</div>
            </div>
          </>
        )}
        <div className="mt-2 text-[11px] text-slate-400">
          Double-click a directory to collapse/expand. Click a cluster to expand.
        </div>
      </div>

      {/* AI Context Balloon */}
      {showBalloon && selectedNodes.length > 0 && (
        <AIContextBalloon
          selectedNodes={selectedNodes}
          position={balloonPosition}
          onSelectAction={handleAIAction}
          onClose={handleCloseBalloon}
        />
      )}

      {/* Contextual Chat Panel */}
      {showChat && selectedNodes.length > 0 && (
        <div className="absolute right-0 top-0 h-full w-[380px] z-40 shadow-2xl animate-in slide-in-from-right duration-300 ease-out">
          <ContextualChat
            selectedNodes={selectedNodes}
            initialMode={chatMode}
            onClose={handleCloseChat}
          />
        </div>
      )}
    </div>
  );
};

const CodeVisualizer: React.FC = () => {
  return (
    <ErrorBoundary name="CodeVisualizerEngine">
      <CodeVisualizerContent />
    </ErrorBoundary>
  );
};

export default CodeVisualizer;

