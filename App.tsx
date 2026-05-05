
import React, { useState, useEffect } from 'react';
import { Sparkles, AlertTriangle, FileSearch, RefreshCw, ChevronRight, ScanLine, Edit, RotateCcw } from 'lucide-react';
import { analyzeTextForSlop, calculateCalculatedSlopScore, getWritingStyle } from './services/geminiService';
import { SlopAnalysis, AnalysisStatus, PatternDefinition } from './types';
import SlopChart from './components/SlopChart';
import PatternCard from './components/PatternCard';
import ConfigPanel from './components/ConfigPanel';
import HighlightedText from './components/HighlightedText';
import { DETECTION_PATTERNS } from './data/patterns';
import { logClientError } from './services/errorLogger';

function App() {
  const [inputText, setInputText] = useState('');
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [result, setResult] = useState<SlopAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("");
  
  // UI State
  const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false);
  
  // State holds the FULL definitions now, allowing for edits/adds/deletes
  const [activePatterns, setActivePatterns] = useState<PatternDefinition[]>(DETECTION_PATTERNS);
  const canAnalyze = inputText.trim().length > 0;

  // Simulated progress bar effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (status === AnalysisStatus.ANALYZING) {
      setProgress(0);
      interval = setInterval(() => {
        // Slowed down significantly (0.8 per tick)
        const increment = (prev: number) => prev < 50 ? 0.8 : prev < 80 ? 0.4 : 0.2;
        setProgress(prev => Math.min(prev + increment(prev), 95));
      }, 200);
    }
    return () => clearInterval(interval);
  }, [status]);

  // Cycle loading messages: Dynamic based on active patterns
  useEffect(() => {
    let messageInterval: ReturnType<typeof setInterval>;
    if (status === AnalysisStatus.ANALYZING) {
      // Generate messages dynamically from the currently active configuration
      const dynamicTips = activePatterns.map(p => p.description);
      
      // Pick a random starting point
      let msgIndex = Math.floor(Math.random() * dynamicTips.length);
      setLoadingMessage(dynamicTips[msgIndex]);
      
      messageInterval = setInterval(() => {
        // Move sequentially from the random start
        msgIndex = (msgIndex + 1) % dynamicTips.length;
        setLoadingMessage(dynamicTips[msgIndex]);
      }, 3500); // 3.5 seconds per tip
    }
    return () => clearInterval(messageInterval);
  }, [status, activePatterns]);

  const handleAnalyze = async () => {
    if (!inputText.trim()) return;
    
    // Close the config panel for better UX
    setIsConfigPanelOpen(false);
    
    setStatus(AnalysisStatus.ANALYZING);
    setError(null);
    setResult(null);

    try {
      const data = await analyzeTextForSlop(inputText, activePatterns);
      setResult(data);
      setProgress(100);
      setTimeout(() => setStatus(AnalysisStatus.COMPLETE), 500); // Slight delay to show 100%
    } catch (err) {
      logClientError(err, {
        source: "handleAnalyze",
        metadata: {
          textLength: inputText.length,
          patternCount: activePatterns.length,
        },
      });
      setError(err instanceof Error ? err.message : "Failed to analyze text. Please try again later.");
      setStatus(AnalysisStatus.ERROR);
    }
  };

  const handleStartOver = () => {
    setInputText('');
    setResult(null);
    setStatus(AnalysisStatus.IDLE);
  };

  const handleEdit = () => {
    // Keep result but allow editing
    // Actually we probably want to hide the result if we are editing?
    // Let's just go back to IDLE state but keep the text
    setStatus(AnalysisStatus.IDLE);
  };

  const handleDismissEvidence = (patternId: string, evidenceIndex: number) => {
    if (!result) return;

    // Clone result deep enough to mutate
    const newResult = { ...result };
    const matchIndex = newResult.patternMatches.findIndex(m => m.patternId === patternId);
    
    if (matchIndex === -1) return;

    const match = { ...newResult.patternMatches[matchIndex] };
    const oldEvidenceCount = match.evidence.length;
    
    // Initialize dismissedCount if not present
    const currentDismissed = match.dismissedCount || 0;
    const newDismissedCount = currentDismissed + 1;
    
    // Remove the evidence
    const newEvidence = [...match.evidence];
    newEvidence.splice(evidenceIndex, 1);
    match.evidence = newEvidence;
    match.dismissedCount = newDismissedCount;

    // Scale the score proportionally
    // New Score = Old Score * (New Count / Old Count)
    // If we removed the last item, score goes to 0
    if (oldEvidenceCount > 0) {
      const ratio = newEvidence.length / oldEvidenceCount;
      match.score = Math.round(match.score * ratio);
    }

    // Update explanation text to reflect changes
    // Format: "7 instances flagged in 580 words. 1 instance marked as OK by user."
    const wordCount = newResult.wordCount || 0;
    const instanceLabel = newDismissedCount === 1 ? 'instance' : 'instances';
    match.explanation = `${newEvidence.length} instances flagged in ${wordCount} words. ${newDismissedCount} ${instanceLabel} marked as OK by user.`;
    
    // Update the match in the list
    newResult.patternMatches[matchIndex] = match;

    // Recalculate Total Slop Score
    newResult.slopScore = calculateCalculatedSlopScore(newResult.patternMatches, activePatterns);
    
    // Update classification
    newResult.writingStyle = getWritingStyle(newResult.slopScore);

    setResult(newResult);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4 md:p-8 font-sans flex flex-col">
      <div className="max-w-7xl mx-auto w-full flex-grow">
        
        {/* Header */}
        <header className="mb-12 text-center md:text-left border-b border-gray-200 pb-8">
          <div className="flex flex-col md:flex-row items-center gap-6 justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-teal-50 p-4 rounded-2xl border border-teal-100 shadow-sm relative">
                {status === AnalysisStatus.ANALYZING && (
                    <div className="absolute inset-0 bg-teal-400 rounded-2xl animate-ping-slow opacity-20"></div>
                )}
                <FileSearch className="w-8 h-8 text-teal-600 relative z-10" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
                  AI Slop Detective
                </h1>
                <p className="text-gray-500 mt-1 font-medium">
                  Analyse writing to see if it contains AI Slop.
                </p>
              </div>
            </div>
            <div className="hidden md:block text-right">
              <div className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-1">System Status</div>
              <div className="flex items-center gap-2 justify-end">
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                <span className="text-gray-600 text-sm font-medium">Gemini 2.5 Flash Online</span>
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Input or Highlighted Result */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-gray-200 rounded-2xl p-1 shadow-lg shadow-gray-100/50 flex flex-col h-full max-h-[calc(100vh-200px)] min-h-[600px]">
              <div className="bg-gray-50/50 rounded-xl p-4 flex-grow flex flex-col overflow-hidden">
                
                {/* Header for the input box */}
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <label className="block text-sm font-bold text-gray-700 flex items-center gap-2">
                    <Sparkles className="w-3 h-3 text-teal-500"/> 
                    {status === AnalysisStatus.COMPLETE ? 'Annotated Text' : 'Input Source'}
                  </label>
                  
                  {status === AnalysisStatus.COMPLETE ? (
                    <div className="flex gap-2">
                      <button 
                        onClick={handleEdit}
                        className="text-xs flex items-center gap-1 bg-white border border-gray-200 text-gray-600 px-2 py-1 rounded hover:border-teal-500 hover:text-teal-600 transition-colors"
                        title="Edit original text"
                      >
                        <Edit className="w-3 h-3" />
                        Edit Text
                      </button>
                      <button 
                        onClick={handleStartOver}
                        className="text-xs flex items-center gap-1 bg-white border border-gray-200 text-gray-600 px-2 py-1 rounded hover:border-red-500 hover:text-red-600 transition-colors"
                        title="Clear and start over"
                      >
                        <RotateCcw className="w-3 h-3" />
                        New Scan
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-mono text-gray-400">{inputText.length} chars</span>
                  )}
                </div>

                {/* Content Area */}
                {status === AnalysisStatus.COMPLETE && result ? (
                   <div className="w-full flex-grow bg-white rounded-lg p-4 border border-gray-200 shadow-inner overflow-y-auto custom-scrollbar">
                      <HighlightedText 
                        text={inputText} 
                        matches={result.patternMatches} 
                        patterns={activePatterns} 
                      />
                   </div>
                ) : (
                  <textarea
                    className="w-full flex-grow bg-white text-gray-900 rounded-lg p-4 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-none resize-none text-sm leading-relaxed border border-gray-200 placeholder-gray-400 font-mono shadow-inner"
                    placeholder="Paste article, email, or LinkedIn post..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    disabled={status === AnalysisStatus.ANALYZING}
                  />
                )}
                
                {/* Config and Action Buttons - Only show when NOT analyzing or complete */}
                {status !== AnalysisStatus.COMPLETE && (
                  <div className="mt-4 shrink-0">
                      <ConfigPanel 
                        patterns={activePatterns} 
                        onPatternsChange={setActivePatterns}
                        isOpen={isConfigPanelOpen}
                        onToggle={() => setIsConfigPanelOpen(!isConfigPanelOpen)}
                      />

                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={handleAnalyze}
                          disabled={status === AnalysisStatus.ANALYZING || !canAnalyze}
                          className={`
                            flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-all w-full md:w-auto justify-center shadow-md
                            ${status === AnalysisStatus.ANALYZING || !canAnalyze
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                              : 'bg-teal-600 hover:bg-teal-700 text-white hover:shadow-lg hover:shadow-teal-500/20 active:transform active:scale-95'
                            }
                          `}
                        >
                          {status === AnalysisStatus.ANALYZING ? (
                            <>
                              <RefreshCw className="w-5 h-5 animate-spin" />
                              Scanning...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-5 h-5" />
                              Run Analysis
                            </>
                          )}
                        </button>
                      </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-7">
            {status === AnalysisStatus.IDLE && (
              <div className="h-full flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-gray-300 rounded-3xl bg-white text-gray-500 min-h-[500px]">
                <div className="bg-gray-50 p-6 rounded-full mb-6">
                   <FileSearch className="w-12 h-12 text-gray-300" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-gray-900">Awaiting Input</h3>
                <p className="max-w-md text-sm text-gray-500 leading-relaxed">Paste text on the left to scan for robotic phrasing, structural clichés, and hollow insights.</p>
              </div>
            )}

            {status === AnalysisStatus.ANALYZING && (
              <div className="h-full flex flex-col items-center justify-center p-12 text-center border border-gray-200 rounded-3xl bg-white text-gray-500 min-h-[500px] relative overflow-hidden">
                <div className="absolute inset-0 bg-gray-50/50"></div>
                <div className="relative z-10 max-w-sm w-full">
                   <div className="relative mx-auto bg-white p-4 rounded-xl shadow-lg border border-gray-100 mb-8 inline-block">
                      <div className="absolute inset-0 bg-teal-500 rounded-xl animate-ping-slow opacity-10"></div>
                      <ScanLine className="w-8 h-8 text-teal-600 relative z-10" />
                   </div>
                   <h3 className="text-xl font-bold text-gray-900 mb-2">Analyzing Patterns...</h3>
                   <p className="text-gray-500 text-sm mb-6 min-h-[40px] transition-all duration-300 flex items-center justify-center text-center px-4">
                     {loadingMessage}
                   </p>
                   
                   {/* Progress Bar */}
                   <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div 
                        className="bg-teal-500 h-full rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                      ></div>
                   </div>
                   <div className="flex justify-between text-xs text-gray-400 mt-2 font-mono">
                      <span>Initializing</span>
                      <span>Processing</span>
                      <span>Verdict</span>
                   </div>
                </div>
              </div>
            )}

            {status === AnalysisStatus.ERROR && (
              <div className="h-full flex flex-col items-center justify-center p-12 text-center border border-red-200 rounded-3xl bg-red-50 text-red-600 min-h-[500px]">
                <AlertTriangle className="w-16 h-16 mb-4 text-red-400" />
                <h3 className="text-xl font-bold mb-2 text-red-900">Analysis Failed</h3>
                <p className="text-red-700">{error}</p>
                <button 
                  onClick={handleEdit}
                  className="mt-6 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-bold"
                >
                  Go Back
                </button>
              </div>
            )}

            {status === AnalysisStatus.COMPLETE && result && (
              <div className="space-y-8 animate-fade-in pb-12">
                
                {/* Verdict Banner */}
                <div className="bg-white border border-gray-200 rounded-2xl p-8 relative overflow-hidden shadow-xl shadow-gray-200/50">
                  <div className="absolute top-0 right-0 p-4 opacity-[0.03]">
                    <Sparkles className="w-48 h-48 text-black" />
                  </div>
                  <div className="relative z-10">
                    <span className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-2 block">Our Take:</span>
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 tracking-tight leading-tight">{result.verdict}</h2>
                  </div>
                </div>

                {/* Interactive Chart Section */}
                <div className="flex justify-center">
                   <div className="w-full">
                     <SlopChart analysis={result} patterns={activePatterns} />
                   </div>
                </div>

                {/* Detailed Analysis Section */}
                <div className="grid grid-cols-1 gap-6">

                  {/* Pattern Breakdown */}
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                      <ChevronRight className="w-5 h-5 text-teal-600" />
                      Pattern Analysis
                    </h3>
                    
                    <div className="grid grid-cols-1 gap-4">
                      {result.patternMatches.map((match) => (
                        <PatternCard 
                          key={match.patternId} 
                          match={match} 
                          definition={activePatterns.find(p => p.id === match.patternId)}
                          onDismissEvidence={(idx) => handleDismissEvidence(match.patternId, idx)}
                        />
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <footer className="mt-12 border-t border-gray-200 pt-8 text-center text-gray-400 text-sm">
        <p>&copy; 2025 Joe Raeburn</p>
      </footer>
    </div>
  );
}

export default App;
