
import React, { useRef } from 'react';
import { Settings2, ChevronDown, ChevronUp, RotateCcw, Plus, Trash2, Save, Upload, AlertCircle } from 'lucide-react';
import { PatternDefinition } from '../types';
import { DETECTION_PATTERNS } from '../data/patterns';

interface ConfigPanelProps {
  patterns: PatternDefinition[];
  onPatternsChange: (newPatterns: PatternDefinition[]) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({ patterns, onPatternsChange, isOpen, onToggle }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (id: string, field: keyof PatternDefinition, value: string | number) => {
    onPatternsChange(patterns.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleReset = () => {
    if (confirm("Reset to default detection patterns? Any custom patterns will be lost.")) {
      onPatternsChange(DETECTION_PATTERNS);
    }
  };

  const handleDelete = (id: string) => {
    if (patterns.length <= 1) {
      alert("You must have at least one detection pattern.");
      return;
    }
    if (confirm("Delete this pattern?")) {
      onPatternsChange(patterns.filter(p => p.id !== id));
    }
  };

  const handleAdd = () => {
    const newId = `custom_${Date.now()}`;
    const newPattern: PatternDefinition = {
      id: newId,
      name: "New Pattern",
      description: "Describe what this pattern detects.",
      promptInstruction: "Describe exactly what the AI should look for in the text.",
      defaultTolerance: 5.0,
      weight: 1.0
    };
    onPatternsChange([...patterns, newPattern]);
  };

  const handleSaveConfig = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(patterns, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "slop_detective_config.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleLoadConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (Array.isArray(json) && json.length > 0 && json[0].id && json[0].promptInstruction) {
           onPatternsChange(json);
           alert("Configuration loaded successfully.");
        } else {
           alert("Invalid configuration file.");
        }
      } catch (err) {
        alert("Error parsing JSON file.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm mb-6">
      <button 
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left rounded-2xl"
      >
        <div className="flex items-center gap-2 text-gray-700 font-bold">
          <Settings2 className="w-5 h-5 text-teal-600" />
          <span>Slop Analysis</span>
          <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-1 rounded-full border border-gray-200 hidden sm:inline-block">
            {patterns.length} Detection Rules Active
          </span>
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>

      {isOpen && (
        <div className="max-h-[50vh] overflow-y-auto overscroll-contain p-6 border-t border-gray-100 bg-gray-50/30 animate-fade-in rounded-b-2xl">
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-gray-200 pb-4">
            <div className="flex gap-2">
                 <button 
                  onClick={handleSaveConfig}
                  className="text-xs flex items-center gap-1 bg-white border border-gray-300 text-gray-600 px-3 py-1.5 rounded hover:border-teal-500 hover:text-teal-600 transition-all font-medium"
                >
                  <Save className="w-3 h-3" />
                  Save Config
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs flex items-center gap-1 bg-white border border-gray-300 text-gray-600 px-3 py-1.5 rounded hover:border-teal-500 hover:text-teal-600 transition-all font-medium"
                >
                  <Upload className="w-3 h-3" />
                  Load Config
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleLoadConfig} 
                    accept=".json" 
                    className="hidden" 
                />
            </div>
            
            <button 
              onClick={handleReset}
              className="text-xs flex items-center gap-1 text-gray-400 hover:text-red-500 transition-colors font-medium whitespace-nowrap"
            >
              <RotateCcw className="w-3 h-3" />
              Reset to Defaults
            </button>
          </div>

          <div className="space-y-6">
            {patterns.map((item, index) => (
                <div key={item.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm relative group transition-all hover:border-teal-200 hover:shadow-md">
                   
                   <div className="flex justify-between items-start mb-4">
                        <div className="flex-1 mr-4">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Pattern Name</label>
                            <input 
                                type="text" 
                                value={item.name}
                                onChange={(e) => handleChange(item.id, 'name', e.target.value)}
                                className="w-full font-bold text-gray-800 text-sm border-b border-transparent focus:border-teal-500 focus:outline-none bg-transparent hover:border-gray-300 transition-colors pb-1 placeholder-gray-300"
                                placeholder="Pattern Name"
                            />
                        </div>
                        <button 
                            onClick={() => handleDelete(item.id)}
                            className="text-gray-300 hover:text-red-500 p-1 rounded transition-colors"
                            title="Delete Pattern"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                   </div>

                   <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Description (Tooltip)</label>
                            <input 
                                type="text" 
                                value={item.description}
                                onChange={(e) => handleChange(item.id, 'description', e.target.value)}
                                className="w-full text-xs text-gray-600 border border-gray-200 rounded px-2 py-1.5 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 outline-none"
                                placeholder="Short description for the UI"
                            />
                        </div>

                        <div>
                             <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-2">
                                AI Prompt Instruction
                                <AlertCircle className="w-3 h-3 text-orange-400" />
                             </label>
                             <textarea 
                                value={item.promptInstruction}
                                onChange={(e) => handleChange(item.id, 'promptInstruction', e.target.value)}
                                className="w-full text-xs text-gray-700 font-mono bg-gray-50 border border-gray-200 rounded p-2 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 outline-none h-20 resize-y leading-relaxed"
                                placeholder="Instruct the AI on exactly what to detect..."
                             />
                        </div>
                   </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-4 border-t border-gray-100">
                    
                    {/* Tolerance Slider */}
                    <div>
                      <div className="flex justify-between mb-2 items-end">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Tolerance</label>
                        <span className="text-[10px] font-mono bg-gray-100 px-2 py-1 rounded text-teal-700 font-bold">
                            {item.defaultTolerance.toFixed(1)} / 1k words
                        </span>
                      </div>
                      <div className="relative h-4 flex items-center">
                         <div className="absolute top-1/2 left-0 w-full h-1.5 bg-gray-200 rounded-full overflow-hidden transform -translate-y-1/2">
                             <div 
                                className="h-full bg-teal-500/50 rounded-full" 
                                style={{ width: `${(item.defaultTolerance / 20) * 100}%` }}
                             />
                         </div>
                         {/* Visual Thumb */}
                         <div 
                            className="absolute top-1/2 w-4 h-4 bg-white border border-gray-300 shadow-sm rounded-full transform -translate-y-1/2 pointer-events-none transition-all"
                            style={{ left: `calc(${(item.defaultTolerance / 20) * 100}% - 8px)` }}
                         ></div>
                         <input 
                            type="range" 
                            min="0.5" 
                            max="20" 
                            step="0.5"
                            value={item.defaultTolerance} 
                            onChange={(e) => handleChange(item.id, 'defaultTolerance', parseFloat(e.target.value))}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                        <span>Strict</span>
                        <span>Lenient</span>
                      </div>
                    </div>

                    {/* Severity Slider */}
                    <div>
                      <div className="flex justify-between mb-2 items-end">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Global Impact</label>
                        <span className="text-[10px] font-mono bg-gray-100 px-2 py-1 rounded text-teal-700 font-bold">{item.weight.toFixed(1)}x</span>
                      </div>
                      <div className="relative h-4 flex items-center">
                         <div className="absolute top-1/2 left-0 w-full h-1.5 bg-gray-200 rounded-full overflow-hidden transform -translate-y-1/2">
                             <div 
                                className="h-full bg-orange-400/50 rounded-full" 
                                style={{ width: `${(item.weight / 5) * 100}%` }}
                             />
                         </div>
                         {/* Visual Thumb */}
                         <div 
                            className="absolute top-1/2 w-4 h-4 bg-white border border-gray-300 shadow-sm rounded-full transform -translate-y-1/2 pointer-events-none transition-all"
                            style={{ left: `calc(${(item.weight / 5) * 100}% - 8px)` }}
                         ></div>
                         <input 
                            type="range" 
                            min="0.1" 
                            max="5.0" 
                            step="0.1"
                            value={item.weight} 
                            onChange={(e) => handleChange(item.id, 'weight', parseFloat(e.target.value))}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          />
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                        <span>Minor</span>
                        <span>Dominant</span>
                      </div>
                    </div>

                  </div>
                </div>
              ))}
          </div>

          <button 
            onClick={handleAdd}
            className="w-full mt-6 flex items-center justify-center gap-2 bg-white border border-dashed border-gray-300 text-gray-500 p-4 rounded-xl hover:bg-gray-50 hover:border-teal-300 hover:text-teal-600 transition-all font-bold text-sm"
          >
            <Plus className="w-4 h-4" />
            Add New Pattern
          </button>

        </div>
      )}
    </div>
  );
};

export default ConfigPanel;
