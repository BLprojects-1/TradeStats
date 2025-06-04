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
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [svgWidth, setSvgWidth] = useState(400);
  const [svgHeight, setSvgHeight] = useState(180);
  const [isVisible, setIsVisible] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  // Intersection Observer for scroll animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            // Slight delay to make the animation feel more natural
            setTimeout(() => {
              setIsVisible(true);
              setHasAnimated(true);
            }, 150);
          }
        });
      },
      {
        threshold: 0.2, // Trigger when 20% of the component is visible
        rootMargin: '0px 0px -50px 0px' // Trigger slightly before it's fully visible
      }
    );

    if (chartContainerRef.current) {
      observer.observe(chartContainerRef.current);
    }

    return () => {
      if (chartContainerRef.current) {
        observer.unobserve(chartContainerRef.current);
      }
    };
  }, [hasAnimated]);

  // Reset animation when dataPoints change (wallet switching)
  useEffect(() => {
    if (dataPoints && dataPoints.length > 0) {
      setIsVisible(true);
      setHasAnimated(true);
    }
  }, [dataPoints]);

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
      return { pathData: '', minValue: 0, maxValue: 0, isPositive: true, chartPadding: 20, zeroY: 0 };
    }

    const values = dataPoints.map(point => point.cumulativePnL);
    const minVal = Math.min(...values, 0);
    const maxVal = Math.max(...values, 0);
    const range = maxVal - minVal || 1;
    const isPos = values[values.length - 1] >= values[0];

    const padding = 20;
    const width = svgWidth || 400;
    const height = svgHeight || 180;

    const points = dataPoints.map((point, index) => {
      const x = padding + (index / (dataPoints.length - 1)) * (width - 2 * padding);
      const normalizedValue = (point.cumulativePnL - minVal) / range;
      const y = height - padding - normalizedValue * (height - 2 * padding);
      return `${x},${y}`;
    });

    const pathData = `M ${points.join(' L ')}`;
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

  // TradeStats brand colors
  const positiveColor = '#10b981'; // Emerald
  const negativeColor = '#f43f5e'; // Rose  
  const positiveFillColor = 'url(#positiveGradient)';
  const negativeFillColor = 'url(#negativeGradient)';

  if (!dataPoints || dataPoints.length === 0) {
    return (
      <div 
        ref={chartContainerRef}
        className={`relative group ${className} transition-all duration-700 ease-out transform ${
          isVisible 
            ? 'opacity-100 translate-y-0 scale-100' 
            : 'opacity-0 translate-y-8 scale-95'
        }`}
      >
        {/* TradeStats-style background blur effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-0 group-hover:opacity-25 blur transition-all duration-500 rounded-2xl"></div>
        
        <div className="relative bg-gradient-to-br from-[#1a1a2e]/90 to-[#1a1a28]/90 backdrop-blur-xl border border-indigo-500/40 rounded-2xl p-8 shadow-xl shadow-indigo-900/10 transition-all duration-500 hover:border-indigo-500/60">
          {/* Header with staggered animation */}
          <div className={`flex items-center justify-between mb-8 transition-all duration-500 ease-out transform ${
            isVisible 
              ? 'opacity-100 translate-x-0' 
              : 'opacity-0 -translate-x-4'
          }`} style={{ transitionDelay: isVisible ? '200ms' : '0ms' }}>
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/15">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  Realized P&L Chart
                </h3>
                <p className="text-gray-400 text-sm">24-hour performance tracking</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-gray-300">$0.00</div>
              <div className="text-sm text-gray-500">No data</div>
            </div>
          </div>
          
          {/* Empty state with delayed animation */}
          <div className={`relative bg-gradient-to-br from-[#252525]/60 to-[#1a1a1a]/60 backdrop-blur-sm border border-indigo-500/20 rounded-xl p-12 shadow-inner transition-all duration-600 ease-out transform ${
            isVisible 
              ? 'opacity-100 translate-y-0 scale-100' 
              : 'opacity-0 translate-y-4 scale-98'
          }`} style={{ transitionDelay: isVisible ? '400ms' : '0ms' }}>
            <div className="flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-600/20 to-purple-600/20 rounded-2xl flex items-center justify-center border border-indigo-500/30">
                <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-gray-200 mb-2">No Trading Data Available</h4>
                <p className="text-gray-400 text-sm">Performance data will appear when trades are executed</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={chartContainerRef}
      className={`relative group ${className} transition-all duration-700 ease-out transform ${
        isVisible 
          ? 'opacity-100 translate-y-0 scale-100' 
          : 'opacity-0 translate-y-8 scale-95'
      }`}
    >
      {/* TradeStats-style background blur effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-0 group-hover:opacity-25 blur transition-all duration-500 rounded-2xl"></div>
      
      <div className="relative bg-gradient-to-br from-[#1a1a2e]/90 to-[#1a1a28]/90 backdrop-blur-xl border border-indigo-500/40 rounded-2xl p-8 shadow-xl shadow-indigo-900/10 transition-all duration-500 hover:border-indigo-500/60">
        {/* Enhanced Header with staggered animation */}
        <div className={`flex items-center justify-between mb-8 transition-all duration-500 ease-out transform ${
          isVisible 
            ? 'opacity-100 translate-x-0' 
            : 'opacity-0 -translate-x-4'
        }`} style={{ transitionDelay: isVisible ? '200ms' : '0ms' }}>
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/15">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Realized P&L Chart
              </h3>
              <p className="text-gray-400 text-sm">24-hour performance tracking</p>
            </div>
          </div>
          
          {/* Dynamic value display */}
          <div className="text-right">
            <div className={`text-3xl font-bold transition-colors duration-300 ${
              hoveredPointIndex !== null 
                ? (dataPoints[hoveredPointIndex].cumulativePnL >= 0 ? 'text-emerald-400' : 'text-rose-400')
                : (dataPoints[dataPoints.length - 1]?.cumulativePnL >= 0 ? 'text-emerald-400' : 'text-rose-400')
            }`}>
              {hoveredPointIndex !== null 
                ? `${dataPoints[hoveredPointIndex].cumulativePnL >= 0 ? '+' : ''}$${Math.abs(dataPoints[hoveredPointIndex].cumulativePnL).toFixed(2)}`
                : `${dataPoints[dataPoints.length - 1]?.cumulativePnL >= 0 ? '+' : ''}$${Math.abs(dataPoints[dataPoints.length - 1]?.cumulativePnL || 0).toFixed(2)}`
              }
            </div>
            <div className="text-sm text-gray-500">
              {hoveredPointIndex !== null 
                ? new Date(dataPoints[hoveredPointIndex].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '24h Total'
              }
            </div>
          </div>
        </div>

        {/* Enhanced Chart Container with delayed animation */}
        <div className={`relative bg-gradient-to-br from-[#252525]/60 to-[#1a1a1a]/60 backdrop-blur-sm border border-indigo-500/20 rounded-xl p-6 shadow-inner transition-all duration-600 ease-out transform ${
          isVisible 
            ? 'opacity-100 translate-y-0 scale-100' 
            : 'opacity-0 translate-y-4 scale-98'
        }`} style={{ transitionDelay: isVisible ? '400ms' : '0ms' }}>
          <svg 
            ref={svgRef}
            width="100%" 
            height="180" 
            viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
            className={`overflow-visible cursor-crosshair transition-all duration-800 ease-out ${
              isVisible 
                ? 'opacity-100 scale-100' 
                : 'opacity-0 scale-95'
            }`}
            style={{ transitionDelay: isVisible ? '600ms' : '0ms' }}
            preserveAspectRatio="none"
            onMouseMove={(e) => {
              if (dataPoints.length === 0) return;

              const svg = e.currentTarget;
              const rect = svg.getBoundingClientRect();
              const mouseX = e.clientX - rect.left;
              const mouseY = e.clientY - rect.top;
              const viewBoxX = (mouseX / rect.width) * svgWidth;
              const viewBoxY = (mouseY / rect.height) * svgHeight;

              // Check if mouse is over any data point
              let foundPointIndex = null;
              for (let i = 0; i < dataPoints.length; i++) {
                const x = chartPadding + (i / (dataPoints.length - 1)) * (svgWidth - 2 * chartPadding);
                const normalizedValue = (dataPoints[i].cumulativePnL - minValue) / (maxValue - minValue || 1);
                const y = (svgHeight - chartPadding) - normalizedValue * (svgHeight - 2 * chartPadding);
                const distance = Math.sqrt(Math.pow(viewBoxX - x, 2) + Math.pow(viewBoxY - y, 2));

                if (distance <= 15) {
                  foundPointIndex = i;
                  break;
                }
              }

              if (foundPointIndex !== null) {
                if (foundPointIndex !== hoveredPointIndex) {
                  setHoveredPointIndex(foundPointIndex);
                  setHoveredPoint(dataPoints[foundPointIndex]);
                }
                return;
              }

              // General chart area hover
              const hoverPadding = 25;
              if (viewBoxX >= hoverPadding && viewBoxX <= (svgWidth - hoverPadding) && 
                  viewBoxY >= hoverPadding && viewBoxY <= (svgHeight - hoverPadding)) {
                const chartWidth = svgWidth - (2 * hoverPadding);
                const dataIndex = Math.round(((viewBoxX - hoverPadding) / chartWidth) * (dataPoints.length - 1));
                const clampedIndex = Math.max(0, Math.min(dataPoints.length - 1, dataIndex));

                if (clampedIndex !== hoveredPointIndex) {
                  setHoveredPointIndex(clampedIndex);
                  setHoveredPoint(dataPoints[clampedIndex]);
                }
              } else {
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
            {/* Enhanced Gradient Definitions */}
            <defs>
              {/* TradeStats-branded grid pattern */}
              <pattern 
                id={`TradeStats-grid-${chartId}`}
                width="50" 
                height="40" 
                patternUnits="userSpaceOnUse"
              >
                <path 
                  d="M 50 0 L 0 0 0 40" 
                  fill="none" 
                  stroke="#4f46e5" 
                  strokeWidth="0.5"
                  opacity="0.1"
                />
              </pattern>
              
              {/* Positive gradient - TradeStats green */}
              <linearGradient id="positiveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.3"/>
                <stop offset="50%" stopColor="#10b981" stopOpacity="0.15"/>
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.05"/>
              </linearGradient>
              
              {/* Negative gradient - TradeStats red */}
              <linearGradient id="negativeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.05"/>
                <stop offset="50%" stopColor="#f43f5e" stopOpacity="0.15"/>
                <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.3"/>
              </linearGradient>
              
              {/* Line gradients */}
              <linearGradient id="positiveLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981"/>
                <stop offset="100%" stopColor="#059669"/>
              </linearGradient>
              
              <linearGradient id="negativeLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f43f5e"/>
                <stop offset="100%" stopColor="#e11d48"/>
              </linearGradient>
            </defs>

            {/* Background grid */}
            <rect 
              width="100%" 
              height="100%" 
              fill={`url(#TradeStats-grid-${chartId})`}
              rx="12"
            />

            {/* Zero line with TradeStats styling */}
            {minValue < 0 && maxValue > 0 && (
              <line
                x1={chartPadding}
                y1={zeroY}
                x2={svgWidth - chartPadding}
                y2={zeroY}
                stroke="#6366f1"
                strokeWidth="2"
                strokeDasharray="8,4"
                className="opacity-40"
              />
            )}

            {/* Enhanced area fills */}
            {dataPoints.length > 0 && (
              <>
                {/* Positive area fill */}
                <path
                  d={`
                    ${dataPoints.map((point, index) => {
                      const x = chartPadding + (index / (dataPoints.length - 1)) * (svgWidth - 2 * chartPadding);
                      const normalizedValue = (point.cumulativePnL - minValue) / (maxValue - minValue || 1);
                      const y = (svgHeight - chartPadding) - normalizedValue * (svgHeight - 2 * chartPadding);
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

                {/* Negative area fill */}
                <path
                  d={`
                    ${dataPoints.map((point, index) => {
                      const x = chartPadding + (index / (dataPoints.length - 1)) * (svgWidth - 2 * chartPadding);
                      const normalizedValue = (point.cumulativePnL - minValue) / (maxValue - minValue || 1);
                      const y = (svgHeight - chartPadding) - normalizedValue * (svgHeight - 2 * chartPadding);
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

            {/* Enhanced line segments with gradients */}
            {dataPoints.length > 1 && dataPoints.map((point, index) => {
              if (index === 0) return null;

              const prevPoint = dataPoints[index - 1];
              const x1 = chartPadding + ((index - 1) / (dataPoints.length - 1)) * (svgWidth - 2 * chartPadding);
              const x2 = chartPadding + (index / (dataPoints.length - 1)) * (svgWidth - 2 * chartPadding);

              const normalizedValue1 = (prevPoint.cumulativePnL - minValue) / (maxValue - minValue || 1);
              const normalizedValue2 = (point.cumulativePnL - minValue) / (maxValue - minValue || 1);

              const y1 = (svgHeight - chartPadding) - normalizedValue1 * (svgHeight - 2 * chartPadding);
              const y2 = (svgHeight - chartPadding) - normalizedValue2 * (svgHeight - 2 * chartPadding);

              const strokeGradient = (prevPoint.cumulativePnL >= 0 && point.cumulativePnL >= 0) ? 'url(#positiveLineGradient)' :
                                   (prevPoint.cumulativePnL < 0 && point.cumulativePnL < 0) ? 'url(#negativeLineGradient)' :
                                   (point.cumulativePnL >= 0) ? 'url(#positiveLineGradient)' : 'url(#negativeLineGradient)';

              return (
                <line
                  key={`line-${index}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={strokeGradient}
                  strokeWidth="3"
                  className="drop-shadow-sm"
                  style={{
                    filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.15))',
                    // Add subtle draw-in animation for lines
                    strokeDasharray: isVisible ? 'none' : `${Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))}`,
                    strokeDashoffset: isVisible ? '0' : `${Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))}`,
                    transition: 'stroke-dashoffset 0.8s ease-in-out',
                    transitionDelay: `${700 + (index * 50)}ms`
                  }}
                />
              );
            })}

            {/* Enhanced hover line */}
            {hoveredPointIndex !== null && (
              <line
                x1={chartPadding + (hoveredPointIndex / (dataPoints.length - 1)) * (svgWidth - 2 * chartPadding)}
                y1={chartPadding}
                x2={chartPadding + (hoveredPointIndex / (dataPoints.length - 1)) * (svgWidth - 2 * chartPadding)}
                y2={svgHeight - chartPadding}
                stroke="#6366f1"
                strokeWidth="2"
                strokeDasharray="6,3"
                className="opacity-60"
              />
            )}

            {/* Enhanced data points */}
            {dataPoints.map((point, index) => {
              const x = chartPadding + (index / (dataPoints.length - 1)) * (svgWidth - 2 * chartPadding);
              const normalizedValue = (point.cumulativePnL - minValue) / (maxValue - minValue || 1);
              const y = (svgHeight - chartPadding) - normalizedValue * (svgHeight - 2 * chartPadding);
              const isHovered = hoveredPointIndex === index;

              return (
                <g 
                  key={index}
                  className={`transition-all duration-300 ease-out ${
                    isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
                  }`}
                  style={{ 
                    transitionDelay: isVisible ? `${800 + (index * 75)}ms` : '0ms'
                  }}
                >
                  {/* Outer glow ring for hovered point */}
                  {isHovered && (
                    <circle
                      cx={x}
                      cy={y}
                      r="10"
                      fill="none"
                      stroke={point.cumulativePnL >= 0 ? "#10b981" : "#f43f5e"}
                      strokeWidth="2"
                      className="opacity-30 animate-pulse"
                    />
                  )}
                  
                  {/* Main data point */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isHovered ? "6" : "4"}
                    fill={point.cumulativePnL >= 0 ? "#10b981" : "#f43f5e"}
                    className={`${isHovered ? 'opacity-100' : 'opacity-90'} transition-all duration-200 drop-shadow-lg`}
                    stroke="#1a1a2e"
                    strokeWidth="2"
                    style={{ cursor: 'pointer' }}
                  />

                  {/* Enhanced tooltip */}
                  {isHovered && (
                    <g>
                      {/* Tooltip background with TradeStats styling */}
                      <rect
                        x={x - 60}
                        y={y - 55}
                        width="120"
                        height="45"
                        fill="url(#tooltipGradient)"
                        stroke="#6366f1"
                        strokeWidth="1.5"
                        rx="12"
                        className="opacity-95 drop-shadow-2xl"
                      />
                      
                      {/* Value text */}
                      <text
                        x={x}
                        y={y - 32}
                        textAnchor="middle"
                        className="fill-white text-sm font-bold"
                      >
                        ${Math.abs(point.cumulativePnL).toFixed(2)}
                      </text>
                      
                      {/* Time text */}
                      <text
                        x={x}
                        y={y - 18}
                        textAnchor="middle"
                        className="fill-gray-300 text-xs"
                      >
                        {new Date(point.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Tooltip gradient definition */}
            <defs>
              <linearGradient id="tooltipGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#1a1a2e" stopOpacity="0.95"/>
                <stop offset="100%" stopColor="#1a1a28" stopOpacity="0.98"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    </div>
  );
}; 
