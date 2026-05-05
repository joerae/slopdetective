
import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PatternMatch, PatternDefinition } from '../types';

interface HighlightedTextProps {
  text: string;
  matches: PatternMatch[];
  patterns: PatternDefinition[];
}

interface TextSegment {
  text: string;
  match: PatternMatch | null;
}

const HighlightedText: React.FC<HighlightedTextProps> = ({ text, matches, patterns }) => {
  // State for the floating tooltip
  const [tooltip, setTooltip] = useState<{
    rect: DOMRect;
    match: PatternMatch;
    description: string;
  } | null>(null);

  // Close tooltip on scroll to prevent it from detaching visually from the moving text
  useEffect(() => {
    const handleScroll = () => {
      if (tooltip) setTooltip(null);
    };
    // Use capture phase to catch scroll events from any container (not just window)
    window.addEventListener('scroll', handleScroll, true); 
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [tooltip]);

  const segments = useMemo(() => {
    if (!text) return [];

    // 1. Initialize a map for each character index
    const charMap = new Array(text.length).fill(null);

    // 2. Sort matches by score descending (high severity takes precedence in overlaps)
    const sortedMatches = [...matches].sort((a, b) => b.score - a.score);

    // 3. Map characters to matches
    sortedMatches.forEach(match => {
      if (!match.evidence) return;
      
      match.evidence.forEach(phrase => {
        if (!phrase || phrase.length < 3) return; // Skip very short phrases

        const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedPhrase, 'gi');
        
        let execMatch;
        while ((execMatch = regex.exec(text)) !== null) {
          const start = execMatch.index;
          const end = start + phrase.length;
          
          for (let i = start; i < end; i++) {
            if (charMap[i] === null) {
              charMap[i] = match;
            }
          }
        }
      });
    });

    // 4. Build segments
    const result: TextSegment[] = [];
    if (text.length === 0) return result;

    let currentMatch: PatternMatch | null = charMap[0];
    let currentText = text[0];

    for (let i = 1; i < text.length; i++) {
      const match = charMap[i];
      if (match === currentMatch) {
        currentText += text[i];
      } else {
        result.push({ text: currentText, match: currentMatch });
        currentMatch = match;
        currentText = text[i];
      }
    }
    result.push({ text: currentText, match: currentMatch });

    return result;
  }, [text, matches]);

  const getHighlightClass = (score: number) => {
    if (score >= 70) return 'bg-red-200 text-red-900 border-b-2 border-red-400/50';
    if (score >= 40) return 'bg-orange-200 text-orange-900 border-b-2 border-orange-400/50';
    if (score >= 10) return 'bg-yellow-200 text-yellow-900 border-b-2 border-yellow-400/50';
    return 'bg-gray-200 text-gray-800';
  };

  return (
    <>
      <div className="font-mono text-sm leading-relaxed whitespace-pre-wrap break-words">
        {segments.map((segment, idx) => {
          if (!segment.match) {
            return <span key={idx} className="text-gray-800">{segment.text}</span>;
          }

          const patternDef = patterns.find(p => p.id === segment.match?.patternId);
          const description = patternDef?.description || segment.match.name;

          return (
            <span 
              key={idx} 
              className={`cursor-help px-0.5 rounded-sm transition-colors duration-200 ${getHighlightClass(segment.match.score)}`}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setTooltip({
                  rect,
                  match: segment.match!,
                  description
                });
              }}
              onMouseLeave={() => setTooltip(null)}
            >
              {segment.text}
            </span>
          );
        })}
      </div>

      {/* Portal Tooltip: Renders outside the container to avoid overflow clipping */}
      {tooltip && createPortal(
        <div 
          className="fixed z-[9999] pointer-events-none transition-opacity duration-200"
          style={{
            top: tooltip.rect.top - 8,
            left: tooltip.rect.left + (tooltip.rect.width / 2),
            transform: 'translate(-50%, -100%)', // Center horizontally, place above
          }}
        >
          <div className="w-72 p-4 bg-gray-900 text-white text-xs rounded-lg shadow-2xl relative">
            {/* Header */}
            <div className="flex justify-between items-start mb-2 border-b border-gray-700 pb-2">
              <span className="font-bold text-gray-100 text-sm">{tooltip.match.name}</span>
              <span className="font-mono font-bold text-gray-400">{tooltip.match.score}/100</span>
            </div>
            {/* Description */}
            <div className="text-gray-300 leading-relaxed text-xs">
              {tooltip.description}
            </div>
            {/* Bottom Arrow */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45 -mt-1"></div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default HighlightedText;
