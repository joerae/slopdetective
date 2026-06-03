
import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { SlopAnalysis, PatternDefinition } from '../types';

interface SlopChartProps {
  analysis: SlopAnalysis;
  patterns: PatternDefinition[];
}

const COLORS = [
  '#dc2626', // Red-600
  '#ea580c', // Orange-600
  '#d97706', // Amber-600
  '#ca8a04', // Yellow-600
  '#ef4444', // Red-500
  '#f97316', // Orange-500
  '#f59e0b', // Amber-500
  '#eab308', // Yellow-500
];

const SlopChart: React.FC<SlopChartProps> = ({ analysis, patterns }) => {
  const score = analysis.slopScore;
  const [hoveredSegmentIndex, setHoveredSegmentIndex] = useState<number | null>(null);

  // Transform data for the chart
  // We want to show the specific contribution of each pattern to the total score
  let chartData = analysis.patternMatches
    .filter(match => match.score > 0)
    .map((match, index) => {
      // Calculate weighted contribution roughly to size the slice
      const patternDef = patterns.find(p => p.id === match.patternId);
      const weight = patternDef ? patternDef.weight : 1.0;
      const value = match.score * weight;
      
      return {
        name: match.name,
        value: value,
        score: match.score, // Pass the raw score for tooltip
        weight: weight,
        color: COLORS[index % COLORS.length]
      };
    });

  // Calculate the "Remaining" empty space to make the chart act like a gauge
  // logic: sum(colored_slices) / (sum(colored_slices) + remainder) = score / 100
  if (score > 0 && score < 100) {
    const totalCurrentValue = chartData.reduce((acc, item) => acc + item.value, 0);
    const remainderValue = (totalCurrentValue * (100 - score)) / score;
    
    chartData.push({
      name: "Remaining",
      value: remainderValue,
      score: 0,
      weight: 0,
      color: "#f3f4f6" // gray-100
    });
  } else if (score === 0) {
     // If score is 0, show a full gray ring (Clean)
     chartData = [{
      name: "Clean Writing",
      value: 100,
      score: 0,
      weight: 0,
      color: "#f3f4f6"
     }];
  }

  const contributors = chartData
    .filter(item => item.name !== "Remaining" && item.name !== "Clean Writing")
    .sort((a, b) => b.value - a.value);

  const totalContributorValue = contributors.reduce((acc, item) => acc + item.value, 0);
  const topContributors = contributors.slice(0, 5);

  let scoreColor = '#0d9488'; // teal-600 for low/good scores
  if (score >= 30) scoreColor = '#ca8a04';
  if (score >= 60) scoreColor = '#dc2626';

  const getSegmentGlow = (index: number | null) => {
    if (index === null || !chartData[index]) {
      return {
        x: 50,
        y: 50,
        color: scoreColor,
        opacity: contributors.length > 0 ? 0.5 : 0.24,
      };
    }

    const segment = chartData[index];
    if (segment.name === "Remaining" || segment.name === "Clean Writing") {
      return {
        x: 50,
        y: 50,
        color: scoreColor,
        opacity: 0.28,
      };
    }

    const totalValue = chartData.reduce((acc, item) => acc + item.value, 0);
    const previousValue = chartData
      .slice(0, index)
      .reduce((acc, item) => acc + item.value, 0);
    const midpoint = totalValue > 0 ? (previousValue + segment.value / 2) / totalValue : 0;
    const angle = (90 - midpoint * 360) * (Math.PI / 180);

    return {
      x: 50 + Math.cos(angle) * 28,
      y: 50 - Math.sin(angle) * 28,
      color: segment.color,
      opacity: 0.72,
    };
  };

  const glow = getSegmentGlow(hoveredSegmentIndex);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      // Don't show tooltip for the empty space
      if (data.name === "Remaining") return null;

      if (data.name === "Clean Writing") {
        return (
           <div className="bg-gray-900 text-white p-3 rounded-lg shadow-xl border border-gray-700 text-sm z-50">
            <p className="font-bold">No Slop Detected</p>
          </div>
        )
      }

      return (
        <div className="bg-gray-900 text-white p-3 rounded-lg shadow-xl border border-gray-700 text-sm z-50">
          <p className="font-bold mb-1">{data.name}</p>
          <p className="text-gray-300">
            Severity <span className="font-mono font-bold text-white">{data.score}/100</span>
            <span className="text-gray-400 text-xs ml-1">at {data.weight?.toFixed(1)}x Impact</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 left-10 h-48 w-48 rounded-full bg-teal-100/60 blur-3xl"></div>
          <div className="absolute bottom-0 right-0 h-56 w-56 rounded-full bg-red-100/40 blur-3xl"></div>
          <div className="slop-chart-scan absolute left-0 right-0 h-12 bg-cyan-300/10"></div>
        </div>

        <div className="relative z-10 mb-5 grid grid-cols-1 md:grid-cols-[minmax(280px,0.95fr)_minmax(260px,1.05fr)] gap-6">
          <div className="flex flex-col gap-2 text-center">
            <span className="text-xs font-bold uppercase text-teal-700">Pattern contribution</span>
            <h3 className="text-xl font-bold text-gray-900">AI Slop Score</h3>
          </div>
          <div className="hidden md:block" aria-hidden="true"></div>
        </div>

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-[minmax(280px,0.95fr)_minmax(260px,1.05fr)] gap-6 items-center">
          <div className="h-[320px] w-full relative" onMouseLeave={() => setHoveredSegmentIndex(null)}>
            <div
              className="absolute h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl transition-all duration-300 ease-out"
              style={{
                left: `${glow.x}%`,
                top: `${glow.y}%`,
                backgroundColor: glow.color,
                opacity: glow.opacity,
              }}
            ></div>
            <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-gray-100 bg-white/80 shadow-inner"></div>
            
            {/* Center Label - Rendered FIRST so the Chart (and its Tooltip) stack ON TOP of it */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-6xl font-extrabold" style={{ color: scoreColor }}>
                    {score}
                </span>
                <span className="text-xs text-gray-400 uppercase font-bold mt-1">Slop Score</span>
            </div>

            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={110}
                        paddingAngle={score > 0 && score < 100 ? 2 : 0} // Add padding only if there are segments
                        dataKey="value"
                        stroke="none"
                        cornerRadius={4}
                        startAngle={90}
                        endAngle={-270}
                        isAnimationActive={true}
                        animationBegin={160}
                        animationDuration={1200}
                        animationEasing="ease-out"
                        onMouseEnter={(_, index) => setHoveredSegmentIndex(index)}
                        onMouseLeave={() => setHoveredSegmentIndex(null)}
                    >
                        {chartData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.color}
                              className={entry.name === "Remaining" || entry.name === "Clean Writing" ? "" : "slop-chart-segment"}
                            />
                        ))}
                    </Pie>
                    <Tooltip 
                      content={<CustomTooltip />} 
                      isAnimationActive={true}
                      cursor={{ fill: 'transparent' }}
                      wrapperStyle={{ zIndex: 50 }}
                    />
                </PieChart>
            </ResponsiveContainer>

          </div>

          <div className="rounded-xl border border-gray-200 bg-white/85 p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-gray-900">Score contributors</h4>
                <p className="text-xs text-gray-500 mt-1">
                  {score === 0 ? "No weighted pattern hits found." : "Ranked by weighted contribution."}
                </p>
              </div>
              <div className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-bold text-gray-600">
                {contributors.length} active
              </div>
            </div>

            {topContributors.length > 0 ? (
              <ol className="space-y-3">
                {topContributors.map((item, index) => {
                  const share = totalContributorValue > 0 ? Math.max(4, Math.round((item.value / totalContributorValue) * 100)) : 0;

                  return (
                    <li key={item.name} className="group">
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-3 w-3 shrink-0 rounded-full shadow-sm"
                            style={{ backgroundColor: item.color }}
                            aria-hidden="true"
                          ></span>
                          <span className="text-sm font-bold leading-snug text-gray-800" title={item.name}>
                            {index + 1}. {item.name}
                          </span>
                        </div>
                        <span className="shrink-0 font-mono text-xs font-bold text-gray-500">
                          {item.score}/100
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="slop-contributor-bar h-full rounded-full"
                          style={{ width: `${share}%`, backgroundColor: item.color }}
                        ></div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="rounded-lg border border-teal-100 bg-teal-50 px-4 py-5 text-sm font-semibold text-teal-800">
                No signs of AI generation detected.
              </div>
            )}
          </div>
        </div>
    </div>
  );
};

export default SlopChart;
