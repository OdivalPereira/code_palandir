import React from 'react';
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';
import type { FlowUIEdgeData, FlowUIEdgeRelation } from '@/types/graph';

export const CustomEdge: React.FC<EdgeProps<any>> = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}) => {
  const edgeData = data as FlowUIEdgeData | undefined;
  const relation = edgeData?.relation || 'renders';

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const getRelationColor = (rel: FlowUIEdgeRelation) => {
    switch (rel) {
      case 'routes_to': return '#3b82f6'; // blue
      case 'renders': return '#a855f7';   // purple
      case 'triggers': return '#f59e0b';  // amber
      case 'uses_hook': return '#6366f1'; // indigo
      case 'accesses_store': return '#06b6d4'; // cyan
      case 'calls_api': return '#f43f5e'; // rose
      default: return '#64748b';          // slate
    }
  };

  const strokeColor = getRelationColor(relation);

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: strokeColor,
          strokeWidth: 2,
          strokeOpacity: 0.6,
          strokeDasharray: relation === 'triggers' || relation === 'calls_api' ? '5,5' : undefined,
        }}
      />
      {edgeData?.label && (
        <foreignObject
          width={70}
          height={20}
          x={labelX - 35}
          y={labelY - 10}
          className="pointer-events-none"
        >
          <div className="flex h-full w-full items-center justify-center">
            <span
              className="rounded bg-slate-950/90 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-slate-400 border border-slate-800 shadow-sm"
              style={{ color: strokeColor }}
            >
              {edgeData.label}
            </span>
          </div>
        </foreignObject>
      )}
    </>
  );
};
