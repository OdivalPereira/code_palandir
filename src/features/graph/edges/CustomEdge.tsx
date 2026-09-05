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
  const isDimmed = Boolean(edgeData?.isDimmed);

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: strokeColor,
          strokeWidth: isDimmed ? 1.5 : 2,
          strokeOpacity: isDimmed ? 0.15 : 0.8,
          strokeDasharray: relation === 'triggers' || relation === 'calls_api' ? '4,4' : undefined,
          transition: 'stroke 0.2s, stroke-width 0.2s, stroke-opacity 0.2s',
        }}
      />
      {edgeData?.label && (
        <foreignObject
          width={90}
          height={24}
          x={labelX - 45}
          y={labelY - 12}
          className="pointer-events-none"
        >
          <div className="flex h-full w-full items-center justify-center">
            <span
              className={`rounded-full bg-slate-950/95 px-2 py-0.5 text-[9px] font-semibold tracking-wider uppercase border shadow-md backdrop-blur-sm transition-opacity duration-200 ${
                isDimmed ? 'opacity-25' : 'opacity-100'
              }`}
              style={{
                color: strokeColor,
                borderColor: `${strokeColor}40`,
                boxShadow: isDimmed ? 'none' : `0 2px 8px ${strokeColor}15`,
              }}
            >
              {edgeData.label}
            </span>
          </div>
        </foreignObject>
      )}
    </>
  );
};
