
import React, { useState } from 'react';
import { PatternMatch, PatternDefinition } from '../types';
import { Quote, CheckCircle, AlertCircle, Info, X, ChevronDown, ChevronUp } from 'lucide-react';

interface PatternCardProps {
  match: PatternMatch;
  definition?: PatternDefinition;
  onDismissEvidence?: (index: number) => void;
}

const PatternCard: React.FC<PatternCardProps> = ({ match, definition, onDismissEvidence }) => {
  const [isEvidenceExpanded, setIsEvidenceExpanded] = useState(false);
  const score = match.score;
  const visibleEvidenceLimit = 3;
  const evidence = match.evidence || [];
  const evidenceCount = evidence.length;
  const instanceCount = Math.max(match.instanceCount ?? evidenceCount, evidenceCount);
  const hiddenEvidenceCount = Math.max(evidenceCount - visibleEvidenceLimit, 0);
  const hasMoreEvidence = hiddenEvidenceCount > 0;
  const visibleEvidence = isEvidenceExpanded
    ? evidence
    : evidence.slice(0, visibleEvidenceLimit);
  
  // Color Logic:
  // 70-100: Red (Severe)
  // 40-69: Orange (Warning)
  // 10-39: Amber/Yellow (Notice)
  // 0-9: Gray (Neutral)

  let theme = {
    border: 'border-gray-200',
    bg: 'bg-white',
    title: 'text-gray-900',
    text: 'text-gray-600',
    bar: 'bg-gray-200',
    score: 'text-gray-300',
    icon: 'text-gray-300'
  };

  if (score >= 70) {
    theme = {
      border: 'border-red-200',
      bg: 'bg-red-50',
      title: 'text-red-900',
      text: 'text-red-800',
      bar: 'bg-red-500',
      score: 'text-red-700',
      icon: 'text-red-500'
    };
  } else if (score >= 40) {
    theme = {
      border: 'border-orange-200',
      bg: 'bg-orange-50',
      title: 'text-orange-900',
      text: 'text-orange-800',
      bar: 'bg-orange-500',
      score: 'text-orange-700',
      icon: 'text-orange-500'
    };
  } else if (score >= 10) {
    theme = {
      border: 'border-yellow-200',
      bg: 'bg-yellow-50',
      title: 'text-yellow-900',
      text: 'text-yellow-800',
      bar: 'bg-yellow-400',
      score: 'text-yellow-700',
      icon: 'text-yellow-500'
    };
  }

  return (
    <div className={`rounded-xl border ${theme.border} ${theme.bg} p-6 transition-all shadow-sm hover:shadow-md hover:z-10 relative`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h4 className={`font-bold ${theme.title} text-lg`}>
              {match.name}
            </h4>
            
            {/* Info Tooltip */}
            <div className="relative group cursor-help inline-flex items-center">
              <Info className={`w-4 h-4 ${score >= 10 ? theme.title : 'text-gray-400'} opacity-50 hover:opacity-100 transition-opacity`} />
              {definition?.description && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 text-white text-xs font-normal rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none text-left leading-relaxed">
                  {definition.description}
                  {/* Arrow */}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45 -mt-1"></div>
                </div>
              )}
            </div>

            {score >= 70 && <AlertCircle className="w-5 h-5 text-red-500 ml-1" />}
          </div>
          <p className={`text-sm ${theme.text} mt-1 leading-relaxed font-medium`}>{match.explanation}</p>
        </div>
        <div className="flex flex-col items-end min-w-[60px]">
          <span className={`text-2xl font-bold ${theme.score}`}>{match.score}</span>
          <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Severity</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-gray-200/50 rounded-full mb-6 overflow-hidden">
        <div 
          className={`h-full ${theme.bar} transition-all duration-1000`} 
          style={{ width: `${match.score}%` }}
        />
      </div>

      {/* Evidence Section */}
      {evidenceCount > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h5 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2 tracking-wider">
              <Quote className="w-3 h-3" />
              Evidence Found
              <span className="normal-case tracking-normal font-semibold text-gray-400">
                ({visibleEvidence.length} of {instanceCount} shown)
              </span>
            </h5>
            {hasMoreEvidence && (
              <button
                type="button"
                onClick={() => setIsEvidenceExpanded(!isEvidenceExpanded)}
                className="inline-flex items-center gap-1 self-start rounded border border-gray-200 bg-white px-2 py-1 text-xs font-bold text-gray-500 hover:border-gray-300 hover:text-gray-800 transition-colors"
              >
                {isEvidenceExpanded ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    Show {hiddenEvidenceCount} more
                  </>
                )}
              </button>
            )}
          </div>
          <div className="space-y-3">
            {visibleEvidence.map((quote, idx) => {
              return (
              <div key={idx} className="group relative bg-white border border-gray-200 rounded p-3 text-sm text-gray-700 italic border-l-4 border-l-gray-300 leading-relaxed shadow-sm hover:border-gray-300 transition-colors pr-8">
                "{quote}"
                
                {onDismissEvidence && (
                  <button 
                    onClick={() => onDismissEvidence(idx)}
                    className="absolute top-2 right-2 p-1 text-gray-300 hover:text-red-500 bg-white rounded-full hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100 shadow-sm border border-transparent hover:border-red-100"
                    title="Dismiss as valid human writing (Mark as OK)"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )})}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-gray-400 text-sm mt-2 font-medium">
          <CheckCircle className="w-4 h-4 opacity-50" />
          <span>No significant evidence found for this pattern.</span>
        </div>
      )}
    </div>
  );
};

export default PatternCard;
