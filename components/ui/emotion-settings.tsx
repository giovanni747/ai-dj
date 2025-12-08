"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Save, X, HelpCircle, Heart, Pencil, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Emotion {
  id: number;
  emotion: string;
  definition: string;
  created_at: string;
}

interface EmotionRow {
  dbId?: number;
  tempId: string;
  emotion: string;
  definition: string;
}

export function EmotionSettings() {
  const [rows, setRows] = useState<EmotionRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  useEffect(() => {
    fetchEmotions();
  }, []);

  const fetchEmotions = async () => {
    try {
      const response = await fetch('/api/user-emotions-proxy', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        const emotions = data.emotions || [];
        
        if (emotions.length > 0) {
          setRows(emotions.map((e: Emotion) => ({
            dbId: e.id,
            tempId: `db-${e.id}`,
            emotion: e.emotion,
            definition: e.definition
          })));
        } else {
          // Start with one empty row if no data
          setRows([{ tempId: `temp-${Date.now()}`, emotion: '', definition: '' }]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch emotions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRow = () => {
    setRows([...rows, { tempId: `temp-${Date.now()}`, emotion: '', definition: '' }]);
  };

  const handleUpdateRow = (tempId: string, field: 'emotion' | 'definition', value: string) => {
    setRows(rows.map(row => row.tempId === tempId ? { ...row, [field]: value } : row));
  };

  const handleDeleteRow = (tempId: string) => {
    const rowToDelete = rows.find(r => r.tempId === tempId);
    if (rowToDelete?.dbId) {
      setDeletedIds(prev => new Set(prev).add(rowToDelete.dbId!));
    }
    setRows(rows.filter(r => r.tempId !== tempId));
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    
    // 1. Delete removed items
    for (const id of deletedIds) {
       try {
         await fetch(`/api/user-emotions-proxy?id=${id}`, { method: 'DELETE' });
       } catch (e) {
         console.error(`Failed to delete emotion ${id}`, e);
       }
    }

    // 2. Save/Update all current valid rows
    const validRows = rows.filter(r => r.emotion.trim() && r.definition.trim());
    
    // Process sequentially to ensure order (though ID determines order mostly)
    for (const row of validRows) {
        try {
            await fetch('/api/user-emotions-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emotion: row.emotion.trim(), definition: row.definition.trim() })
            });
        } catch (e) {
            console.error("Error saving row", row, e);
        }
    }

    // Short delay to show success state
    setTimeout(() => {
      setIsSaving(false);
      setDeletedIds(new Set());
      fetchEmotions(); // Reload to get fresh IDs and clean state
    }, 500);
  };

  return (
    <div className="bg-white/5 rounded-2xl p-6 border border-white/10 backdrop-blur-xl mb-8">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-xl font-semibold text-white">Emotional Context</h3>
        <div className="text-white/40 cursor-help" title="Define emotions to help the AI understand your mood">
            <HelpCircle size={16} />
        </div>
      </div>
      
      <p className="text-sm text-white/50 mb-6">You're currently defining these emotions:</p>

      {/* List */}
      <div className="space-y-3 mb-6">
        <AnimatePresence initial={false}>
            {rows.map((row) => (
                <motion.div 
                    key={row.tempId}
                    initial={{ opacity: 0, height: 0, y: -10 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col md:flex-row gap-3 items-start md:items-center group"
                >
                    {/* Emotion Input */}
                    <div className="relative flex-1 w-full md:w-1/3">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none group-focus-within:text-white/70 transition-colors">
                            <Heart size={16} />
                        </div>
                        <input
                            type="text"
                            value={row.emotion}
                            onChange={(e) => handleUpdateRow(row.tempId, 'emotion', e.target.value)}
                            placeholder="Emotion (e.g. Hype)"
                            className="w-full bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-2 text-white placeholder:text-white/20 focus:outline-none focus:border-white/40 focus:bg-white/10 transition-all"
                        />
                    </div>

                    {/* Definition Input */}
                    <div className="relative flex-2 w-full">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none group-focus-within:text-white/70 transition-colors">
                            <Pencil size={16} />
                        </div>
                        <input
                             type="text"
                             value={row.definition}
                             onChange={(e) => handleUpdateRow(row.tempId, 'definition', e.target.value)}
                             placeholder="Definition (e.g. High energy beats with heavy bass)"
                             className="w-full bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-2 text-white placeholder:text-white/20 focus:outline-none focus:border-white/40 focus:bg-white/10 transition-all"
                        />
                    </div>

                    {/* Delete Button */}
                    <button 
                        onClick={() => handleDeleteRow(row.tempId)}
                        className="p-2 text-white/20 hover:text-white hover:bg-white/10 rounded-full transition-colors shrink-0 md:ml-2"
                        title="Remove emotion"
                    >
                        <X size={18} />
                    </button>
                </motion.div>
            ))}
        </AnimatePresence>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
            onClick={handleAddRow}
            className="flex items-center gap-2 text-sm font-medium text-white/50 hover:text-white transition-colors px-2 py-1 -ml-2 rounded-lg hover:bg-white/5"
        >
            <Plus size={16} />
            Add Another Field
        </button>

        <button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2 bg-white text-black rounded-full font-medium text-sm hover:bg-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-white/5"
        >
            {isSaving ? (
                <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
            ) : (
                <Check size={16} strokeWidth={2.5} /> 
            )}
            {isSaving ? 'Saving...' : 'Save Context'}
        </button>
      </div>
    </div>
  );
}
