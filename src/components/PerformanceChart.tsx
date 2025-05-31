import React, { useMemo, useRef, useEffect, useState } from 'react';
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
  const svgRef = useRef<SVGSVGElement>(null);
  const [svgWidth, setSvgWidth] = useState(400);
  const [svgHeight, setSvgHeight] = useState(160);

  // Update SVG dimensions when the component mounts or window resizes
  useEffect(() => {
    const updateDimensions = () => {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        setSvgWidth(rect.width);
        setSvgHeight(rect.height);
      }
    };

    // Initial update
    updateDimensions();

    // Add resize listener
    window.addEventListener('resize', updateDimensions);

    // Cleanup
    return () => {
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  const { pathData, minValue, maxValue, isPositive, chartPadding, zeroY } = useMemo(() => {
    if (!dataPoints || dataPoints.length === 0) {
      return { pathData: '', minValue: 0, maxValue: 0, isPositive: true, chartPadding: 15, zeroY: 0 };
    }

    const values = dataPoints.map(point => point.cumulativePnL);
    const minVal = Math.min(...values, 0); // Ensure we include 0 in the range
    const maxVal = Math.max(...values, 0); // Ensure we include 0 in the range
    const range = maxVal - minVal || 1; // Avoid division by zero
    const isPos = values[values.length - 1] >= values[0];

    // Create SVG path data
    const padding = 15;

    // Use actual SVG dimensions for calculations
    const width = svgWidth || 400;
    const height = svgHeight || 160;

    const points = dataPoints.map((point, index) => {
      const x = padding + (index / (dataPoints.length - 1)) * (width - 2 * padding);
      const normalizedValue = (point.cumulativePnL - minVal) / range;
      const y = height - padding - normalizedValue * (height - 2 * padding);
      return `${x},${y}`;
    });

    const pathData = `M ${points.join(' L ')}`;

    // Calculate the y-coordinate for the zero line
    const zeroNormalized = (0 - minVal) / range;
    const zeroYCoord = height - padding - zeroNormalized * (height - 2 * padding);

    return {
      pathData,
      minValue: minVal,
      maxValue: maxVal,
      isPositive: isPos,
      chartPadding: padding,
      zeroY: zeroYCoord
    };
  }, [dataPoints, svgWidth, svgHeight]);

  // Define colors for positive and negative values
  const positiveColor = '#10b981'; // Emerald for positive
  const negativeColor = '#f43f5e'; // Rose for negative
  const positiveFillColor = '#10b98120'; // Semi-transparent emerald
  const negativeFillColor = '#f43f5e20'; // Semi-transparent rose

  if (!dataPoints || dataPoints.length === 0) {
    return (
      <div className={`bg-slate-900/40 backdrop-blur-sm rounded-xl p-6 border border-slate-600/25 ${className}`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-slate-100 text-lg font-semibold">Realized PNL</h3>
          <div className="text-right">
            <div className="text-2xl font-bold text-slate-400">$0.00</div>
            <div className="text-sm text-slate-500">24h</div>
          </div>
        </div>
        <div className="flex items-center justify-center h-48 text-slate-500 bg-slate-800/50 rounded-xl border border-slate-700/50 backdrop-blur-sm">
          <div className="text-center">
            <div className="text-base font-medium">No trading data available</div>
            <div className="text-sm mt-2 text-slate-600">Data will appear when trades are made</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-slate-900/40 backdrop-blur-sm rounded-xl p-6 border border-slate-600/25 transition-all duration-300 hover:bg-slate-800/50 hover:border-slate-500/30 hover:shadow-lg hover:shadow-slate-900/20 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-slate-100 text-lg font-semibold">Realized PNL</h3>
        <div className="text-right">
          <div className={`text-2xl font-bold ${
            hoveredPointIndex !== null 
              ? (dataPoints[hoveredPointIndex].cumulativePnL >= 0 ? 'text-emerald-400' : 'text-rose-400')
              : (dataPoints[dataPoints.length - 1]?.cumulativePnL >= 0 ? 'text-emerald-400' : 'text-rose-400')
          }`}>
            {hoveredPointIndex !== null 
              ? `${dataPoints[hoveredPointIndex].cumulativePnL >= 0 ? '+' : ''}$${dataPoints[hoveredPointIndex].cumulativePnL.toFixed(2)}`
              : `${dataPoints[dataPoints.length - 1]?.cumulativePnL >= 0 ? '+' : ''}$${dataPoints[dataPoints.length - 1]?.cumulativePnL.toFixed(2) || '0.00'}`
            }
          </div>
          <div className="text-sm text-slate-500">
            {hoveredPointIndex !== null 
              ? new Date(dataPoints[hoveredPointIndex].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '24h'
            }
          </div>
        </div>
      </div>

      <div className="relative bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4">
        <svg 
          ref={svgRef}
          width="100%" 
          height="160" 
          viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
          className="overflow-visible"
          preserveAspectRatio="none"
          onMouseMove={(e) => {
            if (dataPoints.length === 0) return;

            const svg = e.currentTarget;
            const rect = svg.getBoundingClientRect();

            // Get actual mouse coordinates relative to SVG
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Convert screen coordinates to viewBox coordinates
            // Use the actual SVG dimensions for accurate conversion
            const viewBoxX = (mouseX / rect.width) * svgWidth;
            const viewBoxY = (mouseY / rect.height) * svgHeight;

            // Check if mouse is directly over any data point pin
            // This will take precedence over the general chart area hover
            let foundPointIndex = null;

            // Loop through data points to find if mouse is over any pin
            for (let i = 0; i < dataPoints.length; i++) {
              const x = chartPadding + (i / (dataPoints.length - 1)) * (svgWidth - 2 * chartPadding);
              const normalizedValue = (dataPoints[i].cumulativePnL - minValue) / (maxValue - minValue || 1);
              const y = (svgHeight - chartPadding) - normalizedValue * (svgHeight - 2 * chartPadding);

              // Calculate distance from mouse to pin center
              const distance = Math.sqrt(Math.pow(viewBoxX - x, 2) + Math.pow(viewBoxY - y, 2));

              // If distance is less than pin radius plus some margin for easier hovering
              // Pin radius is 3-4px, we'll use 10px for easier hovering
              if (distance <= 10) {
                foundPointIndex = i;
                break;
              }
            }

            // If mouse is over a pin, use that point
            if (foundPointIndex !== null) {
              if (foundPointIndex !== hoveredPointIndex) {
                setHoveredPointIndex(foundPointIndex);
                setHoveredPoint(dataPoints[foundPointIndex]);
              }
              return;
            }

            // Otherwise, use the general chart area hover logic
            // Only show hover if mouse is within the chart area (accounting for padding)
            const hoverPadding = 20; // Slightly larger padding for hover area
            if (viewBoxX >= hoverPadding && viewBoxX <= (svgWidth - hoverPadding) && 
                viewBoxY >= hoverPadding && viewBoxY <= (svgHeight - hoverPadding)) {

              // Map viewBox X coordinate to data point index
              const chartWidth = svgWidth - (2 * hoverPadding);
              const dataIndex = Math.round(((viewBoxX - hoverPadding) / chartWidth) * (dataPoints.length - 1));
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
                stroke="#475569" 
                strokeWidth="0.5"
                opacity="0.15"
              />
            </pattern>
          </defs>

          <rect 
            width="100%" 
            height="100%" 
            fill={`url(#grid-${chartId})`}
            rx="8"
          />

          {/* Zero line */}
          {minValue < 0 && maxValue > 0 && (
            <line
              x1={chartPadding}
              y1={zeroY}
              x2={svgWidth - chartPadding}
              y2={zeroY}
              stroke="#64748b"
              strokeWidth="1.5"
              strokeDasharray="4,4"
              className="opacity-60"
            />
          )}

          {/* Area fills - separate for positive and negative values */}
          {dataPoints.length > 0 && (
            <>
              {/* Positive area fill (above zero) */}
              <path
                d={`
                  ${dataPoints.map((point, index) => {
                    const x = chartPadding + (index / (dataPoints.length - 1)) * (svgWidth - 2 * chartPadding);
                    const normalizedValue = (point.cumulativePnL - minValue) / (maxValue - minValue || 1);
                    const y = (svgHeight - chartPadding) - normalizedValue * (svgHeight - 2 * chartPadding);
                    // Use the minimum of the point's y-coordinate and the zero line
                    const clippedY = Math.min(y, zeroY);
                    return `${index === 0 ? 'M' : 'L'} ${x},${clippedY}`;
                  }).join(' ')}
                  L ${svgWidth - chartPadding},${zeroY}
                  L ${chartPadding},${zeroY}
                  Z
                `}
                fill={positiveFillColor}
                stroke="none"
              />

              {/* Negative area fill (below zero) */}
              <path
                d={`
                  ${dataPoints.map((point, index) => {
                    const x = chartPadding + (index / (dataPoints.length - 1)) * (svgWidth - 2 * chartPadding);
                    const normalizedValue = (point.cumulativePnL - minValue) / (maxValue - minValue || 1);
                    const y = (svgHeight - chartPadding) - normalizedValue * (svgHeight - 2 * chartPadding);
                    // Use the maximum of the point's y-coordinate and the zero line
                    const clippedY = Math.max(y, zeroY);
                    return `${index === 0 ? 'M' : 'L'} ${x},${clippedY}`;
                  }).join(' ')}
                  L ${svgWidth - chartPadding},${zeroY}
                  L ${chartPadding},${zeroY}
                  Z
                `}
                fill={negativeFillColor}
                stroke="none"
              />
            </>
          )}

          {/* Line segments */}
          {dataPoints.length > 1 && dataPoints.map((point, index) => {
            if (index === 0) return null; // Skip first point as we need pairs

            const prevPoint = dataPoints[index - 1];
            const x1 = chartPadding + ((index - 1) / (dataPoints.length - 1)) * (svgWidth - 2 * chartPadding);
            const x2 = chartPadding + (index / (dataPoints.length - 1)) * (svgWidth - 2 * chartPadding);

            const normalizedValue1 = (prevPoint.cumulativePnL - minValue) / (maxValue - minValue || 1);
            const normalizedValue2 = (point.cumulativePnL - minValue) / (maxValue - minValue || 1);

            const y1 = (svgHeight - chartPadding) - normalizedValue1 * (svgHeight - 2 * chartPadding);
            const y2 = (svgHeight - chartPadding) - normalizedValue2 * (svgHeight - 2 * chartPadding);

            // Determine color based on whether both points are above or below zero
            const color = (prevPoint.cumulativePnL >= 0 && point.cumulativePnL >= 0) ? positiveColor :
                         (prevPoint.cumulativePnL < 0 && point.cumulativePnL < 0) ? negativeColor :
                         // If crossing zero, use the color of the end point
                         (point.cumulativePnL >= 0) ? positiveColor : negativeColor;

            return (
              <line
                key={`line-${index}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={color}
                strokeWidth="2.5"
                className="drop-shadow-sm"
                style={{
                  filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))'
                }}
              />
            );
          })}

          {/* Hover line */}
          {hoveredPointIndex !== null && (
            <line
              x1={chartPadding + (hoveredPointIndex / (dataPoints.length - 1)) * (svgWidth - 2 * chartPadding)}
              y1={chartPadding}
              x2={chartPadding + (hoveredPointIndex / (dataPoints.length - 1)) * (svgWidth - 2 * chartPadding)}
              y2={svgHeight - chartPadding}
              stroke="#64748b"
              strokeWidth="1.5"
              strokeDasharray="4,4"
              className="opacity-50"
            />
          )}

          {/* Data points */}
          {dataPoints.map((point, index) => {
            const x = chartPadding + (index / (dataPoints.length - 1)) * (svgWidth - 2 * chartPadding);
            const normalizedValue = (point.cumulativePnL - minValue) / (maxValue - minValue || 1);
            const y = (svgHeight - chartPadding) - normalizedValue * (svgHeight - 2 * chartPadding);

            return (
              <g key={index}>
                <circle
                  cx={x}
                  cy={y}
                  r={hoveredPointIndex === index ? "5" : "3"}
                  fill={point.cumulativePnL >= 0 ? positiveColor : negativeColor}
                  className={`${hoveredPointIndex === index ? 'opacity-100' : 'opacity-90'} drop-shadow-md transition-all duration-200`}
                  stroke="#1e293b"
                  strokeWidth="1.5"
                  style={{ cursor: 'pointer' }}
                />

                {/* Hover tooltip */}
                {hoveredPointIndex === index && (
                  <g>
                    <rect
                      x={x - 50}
                      y={y - 45}
                      width="100"
                      height="35"
                      fill="#1e293b"
                      stroke="#475569"
                      strokeWidth="1"
                      rx="8"
                      className="opacity-95 drop-shadow-lg"
                    />
                    <text
                      x={x}
                      y={y - 28}
                      textAnchor="middle"
                      className="fill-slate-100 text-sm font-semibold"
                    >
                      ${point.cumulativePnL.toFixed(2)}
                    </text>
                    <text
                      x={x}
                      y={y - 16}
                      textAnchor="middle"
                      className="fill-slate-400 text-xs"
                    >
                      {new Date(point.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
