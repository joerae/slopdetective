import React, { useState } from 'react';
import { Plus, Check, Trash2, Microscope } from 'lucide-react';
import { ResearchItem } from '../types';

const INITIAL_TODOS: ResearchItem[] = [
  { id: '1', text: 'Identify the "It\'s not X, it\'s Y" contrarian rhetorical device', completed: true, category: 'marker' },
  { id: '2', text: 'Analyze frequency of "The Bottom Line" headers in GPT-4 outputs', completed: true, category: 'marker' },
  { id: '3', text: 'Detect "Simulated Edginess" (e.g., "Screw that", "Let\'s be real")', completed: false, category: 'theory' },
  { id: '4', text: 'Catalog the "LinkedIn Bro" one-sentence paragraph structure', completed: false, category: 'marker' },
];

const ResearchTodo: React.FC = () => {
  const [todos, setTodos] = useState<ResearchItem[]>(INITIAL_TODOS);
  const [newTodo, setNewTodo] = useState('');

  const addTodo = () => {
    if (!newTodo.trim()) return;
    setTodos([
      ...todos,
      {
        id: Date.now().toString(),
        text: newTodo,
        completed: false,
        category: 'marker'
      }
    ]);
    setNewTodo('');
  };

  const toggleTodo = (id: string) => {
    setTodos(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTodo = (id: string) => {
    setTodos(todos.filter(t => t.id !== id));
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mt-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-purple-500/10 rounded-lg">
          <Microscope className="w-6 h-6 text-purple-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Slop Detection Research</h2>
          <p className="text-sm text-zinc-400">Ongoing tasks to better identify the synthetic.</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTodo()}
          placeholder="Add a new research vector..."
          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-purple-500 transition-colors text-white"
        />
        <button
          onClick={addTodo}
          className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-3">
        {todos.map(todo => (
          <div key={todo.id} className="group flex items-center justify-between p-3 bg-zinc-950/50 rounded-lg border border-zinc-800/50 hover:border-zinc-700 transition-all">
            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleTodo(todo.id)}
                className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                  todo.completed 
                    ? 'bg-purple-600 border-purple-600 text-white' 
                    : 'border-zinc-600 hover:border-purple-500'
                }`}
              >
                {todo.completed && <Check className="w-3 h-3" />}
              </button>
              <span className={`text-sm ${todo.completed ? 'text-zinc-500 line-through' : 'text-zinc-300'}`}>
                {todo.text}
              </span>
            </div>
            <button 
              onClick={() => deleteTodo(todo.id)}
              className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {todos.length === 0 && (
          <div className="text-center py-8 text-zinc-500 italic">No research tasks active.</div>
        )}
      </div>
    </div>
  );
};

export default ResearchTodo;