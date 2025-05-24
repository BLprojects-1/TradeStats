import React, { useMemo } from 'react';
import { PerformanceDataPoint } from '../services/performanceService';

interface PerformanceChartProps {
  dataPoints: PerformanceDataPoint[];
  className?: string;
}

export const PerformanceChart: React.FC<PerformanceChartProps> = ({ 
  dataPoints, 
  className = '' 
}) => {
  const chartId = React.useId();
  const [hoveredPointIndex, setHoveredPointIndex] = React.useState<number | null>(null);
  const [hoveredPoint, setHoveredPoint] = React.useState<PerformanceDataPoint | null>(null);

  const { pathData, minValue, maxValue, isPositive } = useMemo(() => {
    if (!dataPoints || dataPoints.length === 0) {
      return { pathData: '', minValue: 0, maxValue: 0, isPositive: true };
    }

    const values = dataPoints.map(point => point.cumulativePnL);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1; // Avoid division by zero
    const isPos = values[values.length - 1] >= values[0];

    // Create SVG path data
    const width = 400;
    const height = 160; // Increased height
    const padding = 15;

    const points = dataPoints.map((point, index) => {
      const x = padding + (index / (dataPoints.length - 1)) * (width - 2 * padding);
      const normalizedValue = (point.cumulativePnL - minVal) / range;
      const y = height - padding - normalizedValue * (height - 2 * padding);
      return `${x},${y}`;
    });

    const pathData = `M ${points.join(' L ')}`;

    return {
      pathData,
      minValue: minVal,
      maxValue: maxVal,
      isPositive: isPos
    };
  }, [dataPoints]);

  const strokeColor = isPositive ? '#10B981' : '#EF4444'; // Green for positive, red for negative
  const fillColor = isPositive ? '#10B98125' : '#EF444425'; // Semi-transparent fill

  if (!dataPoints || dataPoints.length === 0) {
    return (
      <div className={`bg-[#0f0f0f] rounded-lg p-4 border border-gray-800 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white text-sm font-medium">Realized PNL</h3>
          <div className="text-right">
            <div className="text-lg font-bold text-gray-500">$0.00</div>
            <div className="text-xs text-gray-500">24h</div>
          </div>
        </div>
        <div className="flex items-center justify-center h-40 text-gray-500 bg-[#141414] rounded-lg border border-gray-700/50">
          <div className="text-center">
            <div className="text-sm">No trading data available</div>
            <div className="text-xs mt-1">Data will appear when trades are made</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-[#0f0f0f] rounded-lg p-4 border border-gray-800 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white text-sm font-medium">Realized PNL</h3>
        <div className="text-right">
          <div className={`text-lg font-bold ${
            hoveredPointIndex !== null 
              ? (dataPoints[hoveredPointIndex].cumulativePnL >= 0 ? 'text-green-400' : 'text-red-400')
              : (isPositive ? 'text-green-400' : 'text-red-400')
          }`}>
            {hoveredPointIndex !== null 
              ? `${dataPoints[hoveredPointIndex].cumulativePnL >= 0 ? '+' : ''}$${dataPoints[hoveredPointIndex].cumulativePnL.toFixed(2)}`
              : `${isPositive ? '+' : ''}$${dataPoints[dataPoints.length - 1]?.cumulativePnL.toFixed(2) || '0.00'}`
            }
          </div>
          <div className="text-xs text-gray-500">
            {hoveredPointIndex !== null 
              ? new Date(dataPoints[hoveredPointIndex].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '24h'
            }
          </div>
        </div>
      </div>
      
      <div className="relative bg-[#141414] rounded-lg border border-gray-700/50 p-3">
        <svg 
          width="100%" 
          height="160" 
          viewBox="0 0 400 160" 
          className="overflow-visible"
          onMouseMove={(e) => {
            if (dataPoints.length === 0) return;
            
            const svg = e.currentTarget;
            const rect = svg.getBoundingClientRect();
            
            // Get actual mouse coordinates relative to SVG
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // Convert screen coordinates to viewBox coordinates
            // Screen width maps to viewBox width (400), screen height maps to viewBox height (160)
            const viewBoxX = (mouseX / rect.width) * 400;
            const viewBoxY = (mouseY / rect.height) * 160;
            
            // Only show hover if mouse is within the chart area (accounting for padding)
            const chartPadding = 20;
            if (viewBoxX >= chartPadding && viewBoxX <= (400 - chartPadding) && 
                viewBoxY >= chartPadding && viewBoxY <= (160 - chartPadding)) {
              
              // Map viewBox X coordinate to data point index
              const chartWidth = 400 - (2 * chartPadding);
              const dataIndex = Math.round(((viewBoxX - chartPadding) / chartWidth) * (dataPoints.length - 1));
              const clampedIndex = Math.max(0, Math.min(dataPoints.length - 1, dataIndex));
              
              if (clampedIndex !== hoveredPointIndex) {
                setHoveredPointIndex(clampedIndex);
                setHoveredPoint(dataPoints[clampedIndex]);
              }
            } else {
              // Mouse is outside chart area
              if (hoveredPointIndex !== null) {
                setHoveredPointIndex(null);
                setHoveredPoint(null);
              }
            }
          }}
          onMouseLeave={() => {
            setHoveredPointIndex(null);
            setHoveredPoint(null);
          }}
        >
          {/* Grid lines */}
          <defs>
            <pattern 
              id={`grid-${chartId}`}
              width="40" 
              height="32" 
              patternUnits="userSpaceOnUse"
            >
              <path 
                d="M 40 0 L 0 0 0 32" 
                fill="none" 
                stroke="#4B5563" 
                strokeWidth="0.5"
                opacity="0.2"
              />
            </pattern>
          </defs>
          
          <rect 
            width="100%" 
            height="100%" 
            fill={`url(#grid-${chartId})`}
            rx="4"
          />
          
          {/* Area fill */}
          {pathData && (
            <path
              d={`${pathData} L 385,145 L 15,145 Z`}
              fill={fillColor}
              stroke="none"
            />
          )}
          
          {/* Line */}
          {pathData && (
            <path
              d={pathData}
              fill="none"
              stroke={strokeColor}
              strokeWidth="2.5"
              className="drop-shadow-sm"
              style={{
                filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))'
              }}
            />
          )}
          
          {/* Data points */}
          {dataPoints.map((point, index) => {
            const x = 15 + (index / (dataPoints.length - 1)) * 370;
            const normalizedValue = (point.cumulativePnL - minValue) / (maxValue - minValue || 1);
            const y = 145 - normalizedValue * 130;
            
            return (
              <g key={index}>
                <circle
                  cx={x}
                  cy={y}
                  r={hoveredPointIndex === index ? "4" : "3"}
                  fill={strokeColor}
                  className={`${hoveredPointIndex === index ? 'opacity-100' : 'opacity-90'} drop-shadow-sm transition-all duration-200`}
                  stroke="#000"
                  strokeWidth="0.5"
                />
                
                {/* Hover tooltip */}
                {hoveredPointIndex === index && (
                  <g>
                    <rect
                      x={x - 45}
                      y={y - 35}
                      width="90"
                      height="25"
                      fill="#1f2937"
                      stroke="#374151"
                      strokeWidth="1"
                      rx="4"
                      className="opacity-95"
                    />
                    <text
                      x={x}
                      y={y - 15}
                      textAnchor="middle"
                      className="fill-white text-xs font-medium"
                    >
                      ${point.cumulativePnL.toFixed(2)}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}; 