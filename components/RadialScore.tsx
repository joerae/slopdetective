
import React from 'react';
import { Info } from 'lucide-react';

interface RadialScoreProps {
  score: number;
  label: string;
  color: string;
  description?: string;
  size?: 'md' | 'lg';
}

const RadialScore: React.FC<RadialScoreProps> = ({ score, label, color, description, size = 'md' }) => {
  const isLarge = size === 'lg';
  const radius = isLarge ? 80 : 40;
  const stroke = isLarge ? 12 : 8;
  const dimension = isLarge ? 192 : 128; // 48x4 (w-48) or 32x4 (w-32)
  const cx = dimension / 2;
  const cy = dimension / 2;
  
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className={`flex flex-col items-center justify-center ${isLarge ? 'p-10' : 'p-6'} bg-white rounded-xl border border-gray-200 shadow-sm relative group hover:shadow-md transition-shadow`}>
      
      {/* Tooltip trigger - only visible if description exists */}
      {description && (
        <div className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors cursor-help">
          <Info className="w-4 h-4" />
          {/* Tooltip Popup */}
          <div className="absolute bottom-full right-0 mb-2 w-56 p-4 bg-gray-900 text-white text-xs leading-relaxed rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 pointer-events-none">
            {description}
            {/* Arrow */}
            <div className="absolute top-full right-1 w-2 h-2 bg-gray-900 transform rotate-45 -mt-1"></div>
          </div>
        </div>
      )}

      <div className={`relative mb-4 ${isLarge ? 'w-48 h-48' : 'w-32 h-32'}`}>
        {/* Background Circle */}
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke="currentColor"
            strokeWidth={stroke}
            fill="transparent"
            className="text-gray-100"
          />
          {/* Progress Circle */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col">
          <span className={`${isLarge ? 'text-7xl' : 'text-4xl'} font-bold text-gray-900 tracking-tighter`}>{score}</span>
          {isLarge && <span className="text-xs text-gray-400 uppercase tracking-widest font-bold mt-2">/100</span>}
        </div>
      </div>
      <h3 className={`${isLarge ? 'text-2xl' : 'text-lg'} font-bold text-gray-700 mb-1`}>{label}</h3>
    </div>
  );
};

export default RadialScore;
