
import React from 'react';
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

  let scoreColor = '#0d9488'; // teal-600 for low/good scores
  if (score >= 30) scoreColor = '#ca8a04';
  if (score >= 60) scoreColor = '#dc2626';

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
        <h3 className="text-lg font-bold text-gray-700 mb-4 text-center">AI Slop Score</h3>
        <div className="h-[300px] w-full relative">
            
            {/* Center Label - Rendered FIRST so the Chart (and its Tooltip) stack ON TOP of it */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-6xl font-extrabold tracking-tighter" style={{ color: scoreColor }}>
                    {score}
                </span>
                <span className="text-xs text-gray-400 uppercase tracking-widest font-bold mt-1">Slop Score</span>
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
                    >
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip 
                      content={<CustomTooltip />} 
                      isAnimationActive={false}
                      cursor={{ fill: 'transparent' }}
                      wrapperStyle={{ zIndex: 50 }}
                    />
                </PieChart>
            </ResponsiveContainer>
            
        </div>
        <p className="text-center text-sm text-gray-500 mt-2 max-w-md mx-auto">
            {score === 0 
                ? "No signs of AI generation detected." 
                : "Mouse over the colored segments to see which patterns contributed to this score."}
        </p>
    </div>
  );
};

export default SlopChart;
