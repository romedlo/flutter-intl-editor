import { useState, useEffect, useRef, useMemo } from 'react';
import type { TranslationData, SortConfig } from '../types';
import { getSpellChecker } from '../nspell-loader';

// vscode API is initialized in App.tsx and stored on window
function getVscode() { return (window as any).vscode; }

export const isValidFlutterKey = (key: string) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key);

export function useTranslationEditor() {
  const [languages, setLanguages] = useState<string[]>([]);
  const [translationsData, setTranslationsData] = useState<TranslationData[]>([]);
  const [spellCheckers, setSpellCheckers] = useState<{ [lang: string]: any }>({});
  const [editingCell, setEditingCell] = useState<{ key: string; lang: string; value: string; rect: DOMRect } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [syncAvailable, setSyncAvailable] = useState(false);
  const lastKnownDiskData = useRef<{ [key: string]: { [lang: string]: string } }>({});
  
  // History tracking for Undo/Redo
  const historyRef = useRef<TranslationData[][]>([]);
  const historyIndexRef = useRef<number>(-1);

  const pushHistory = (data: TranslationData[]) => {
    const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    newHistory.push(data);
    if (newHistory.length > 50) newHistory.shift();
    historyRef.current = newHistory;
    historyIndexRef.current = newHistory.length - 1;
  };

  const updateTranslations = (updater: TranslationData[] | ((prev: TranslationData[]) => TranslationData[])) => {
    setTranslationsData(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (next !== prev) pushHistory(next);
      return next;
    });
  };

  const handleUndo = () => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      setTranslationsData(historyRef.current[historyIndexRef.current]);
      setHasUnsavedChanges(true); // Reverting is considered an unsaved action
    }
  };

  const handleRedo = () => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1;
      setTranslationsData(historyRef.current[historyIndexRef.current]);
      setHasUnsavedChanges(true);
    }
  };

  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [filterText, setFilterText] = useState('');
  const [missingFilter, setMissingFilter] = useState('all');
  const [hoverRow, setHoverRow] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [metadataMap, setMetadataMap] = useState<{ [key: string]: any }>({});
  const [editingPlaceholder, setEditingPlaceholder] = useState<{ key: string; placeholder: string } | null>(null);
  const [columnWidths, setColumnWidths] = useState<{ [key: string]: number }>({ '_key_': 250 });

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  useEffect(() => {
    if (typeof getVscode() !== 'undefined') {
      getVscode().postMessage({ command: 'unsaved-changes', data: hasUnsavedChanges });
    }
  }, [hasUnsavedChanges]);

  // Load spell checkers when languages change
  useEffect(() => {
    let active = true;
    languages.forEach(lang => {
      if (lang === '_key_') return;
      getSpellChecker(lang).then(spell => {
        if (active && spell) setSpellCheckers(prev => ({ ...prev, [lang]: spell }));
      });
    });
    return () => { active = false; };
  }, [languages]);

  // Handle messages from the VS Code extension host
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.command) {
        case 'initial-data': {
          const receivedData = message.data;
          setLanguages(receivedData.languages);
          const translationsArray = Object.entries(receivedData.translations).map(([key, translations]) => ({
            key,
            translations: translations as { [lang: string]: string },
          }));
          setTranslationsData(translationsArray);
          historyRef.current = [translationsArray];
          historyIndexRef.current = 0;
          lastKnownDiskData.current = receivedData.translations;
          setMetadataMap(receivedData.metadata || {});
          setIsLoading(false);
          setErrorMsg(null);
          break;
        }
        case 'sync-available':
          setSyncAvailable(true);
          break;
        case 'sync-data': {
          const incomingData = message.data;
          updateTranslations(currentData => {
            const nextData: TranslationData[] = [];
            const newDisks = incomingData.translations;
            const oldDisks = lastKnownDiskData.current;

            // Update existing or new incoming keys
            for (const key of Object.keys(newDisks)) {
              const incomingLangs = newDisks[key];
              const oldLangs = oldDisks[key] || {};
              const existingRow = currentData.find(r => r.key === key);
              const newRow = existingRow 
                ? { ...existingRow, translations: { ...existingRow.translations } } 
                : { key, translations: {} };

              for (const lang of incomingData.languages) {
                const newVal = incomingLangs[lang] || '';
                const oldVal = oldLangs[lang] || '';
                const userVal = existingRow ? (existingRow.translations[lang] || '') : '';

                if (newVal !== oldVal) {
                  // Disk was manually changed, precedence to disk
                  newRow.translations[lang] = newVal;
                } else if (!existingRow) {
                  newRow.translations[lang] = newVal;
                } else {
                  // Disk not manually changed, keep user's active version (which might include unsaved changes)
                  newRow.translations[lang] = userVal;
                }
              }
              nextData.push(newRow);
            }

            // Keep user's newly created rows that aren't on disk at all
            currentData.forEach(row => {
              if (row.key.startsWith('__new_row_') || (!newDisks[row.key] && !row.key.startsWith('__new_row_'))) {
                if (!nextData.find(r => r.key === row.key)) {
                  nextData.push(row);
                }
              }
            });

            // Critical Fix: Sync the reference inside the state updater to prevent race conditions 
            // when rapid file-watcher events queue multiple batched state updates.
            lastKnownDiskData.current = incomingData.translations;

            return nextData;
          });
          setSyncAvailable(false);
          break;
        }
        case 'load-error':
          setIsLoading(false);
          setErrorMsg(message.data);
          break;
        case 'save-success':
          setHasUnsavedChanges(false);
          setSyncAvailable(false); // Just saved what we had
          
          // Also update our `lastKnownDiskData` to reflect what we just saved 
          // so future syncs compare against the newly saved disk state
          const translationsMapForExtension: { [key: string]: { [lang: string]: string } } = {};
          setTranslationsData(currentData => {
            currentData.forEach(item => {
              if (!item.key.startsWith('__new_row_') && isValidFlutterKey(item.key)) {
                translationsMapForExtension[item.key] = item.translations;
              }
            });
            lastKnownDiskData.current = translationsMapForExtension;
            return currentData;
          });
          break;
        default:
          break;
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Keyboard shortcuts: Cmd+F focuses filter, Cmd+S saves
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore global shortcuts if user is typing in dialog to prevent intercepting native text undo
      if (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        document.getElementById('filter-input')?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (hasUnsavedChanges) handleSaveChanges();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasUnsavedChanges, translationsData, metadataMap]);

  // --- Handlers ---

  const handleAcceptChange = (key: string, lang: string, newValue: string, direction?: 'next' | 'prev') => {
    const isNewRow = key.startsWith('__new_row_');
    const displayKey = isNewRow ? '' : key;
    let nextRowKey: string | null = key;

    if (lang === '_key_') {
      const trimmedNewValue = newValue.trim();
      if (!trimmedNewValue) { 
        getVscode().postMessage({ command: 'alert', text: 'Key cannot be empty.' }); 
        return; 
      }
      if (trimmedNewValue !== displayKey) {
        if (translationsData.some(item => item.key === trimmedNewValue)) {
          getVscode().postMessage({ command: 'alert', text: `Key "${trimmedNewValue}" already exists.` });
          return;
        }
        updateTranslations(prevData => {
          const newData = prevData.map(item => item.key === key ? { ...item, key: trimmedNewValue } : item);
          setHasUnsavedChanges(true);
          return newData;
        });
        setMetadataMap(prev => {
          const newMeta = { ...prev };
          if (newMeta[key] !== undefined) { newMeta[trimmedNewValue] = newMeta[key]; delete newMeta[key]; }
          return newMeta;
        });
      }
      nextRowKey = trimmedNewValue;
    } else {
      updateTranslations(prevData => {
        const newData = prevData.map(item =>
          item.key === key ? { ...item, translations: { ...item.translations, [lang]: newValue } } : item
        );
        const originalValue = prevData.find(item => item.key === key)?.translations[lang] || '';
        if (originalValue !== newValue) setHasUnsavedChanges(true);
        return newData;
      });
    }

    if (direction === 'next' || direction === 'prev') {
      const cols = ['_key_', ...languages];
      const colIndex = cols.indexOf(lang);
      
      let nextLang = cols[direction === 'next' ? colIndex + 1 : colIndex - 1];
      
      if (!nextLang) {
        if (direction === 'next') {
          nextLang = '_key_';
          const currentTd = document.getElementById(`cell-${key}-${lang}`);
          const nextTr = currentTd?.parentElement?.nextElementSibling as HTMLElement;
          const nextTd = nextTr?.firstElementChild as HTMLElement;
          nextRowKey = (nextTd && nextTd.dataset.rowkey) ? nextTd.dataset.rowkey : null;
        } else {
          nextLang = cols[cols.length - 1];
          const currentTd = document.getElementById(`cell-${key}-${lang}`);
          const prevTr = currentTd?.parentElement?.previousElementSibling as HTMLElement;
          const prevTd = prevTr?.firstElementChild as HTMLElement;
          nextRowKey = (prevTd && prevTd.dataset.rowkey) ? prevTd.dataset.rowkey : null;
        }
      }

      if (nextRowKey) {
        setTimeout(() => {
          const nextTd = document.getElementById(`cell-${nextRowKey}-${nextLang}`);
          if (nextTd) {
            nextTd.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
            // Retrieve latest accurate raw text for the dialog
            setTranslationsData(currentData => {
              const nextRowData = currentData.find(r => r.key === nextRowKey);
              const nextValue = nextLang === '_key_' 
                ? (nextRowKey!.startsWith('__new_row_') ? '' : nextRowKey!)
                : (nextRowData ? (nextRowData.translations[nextLang] || '') : '');
              
              setEditingCell({
                key: nextRowKey as string,
                lang: nextLang,
                value: nextValue,
                // Make sure to query the rect fresh from DOM after scroll/render
                rect: nextTd.getBoundingClientRect(),
              });
              return currentData;
            });
          } else {
            setEditingCell(null);
          }
        }, 0);
        return;
      }
    }

    setEditingCell(null);
  };

  const handleDiscardChange = () => setEditingCell(null);

  const handleCellClick = (key: string, lang: string, value: string, event: React.MouseEvent<HTMLTableCellElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setEditingCell({ key, lang, value, rect });
  };

  const handleAddRowMiddle = (afterKey: string) => {
    const newKeyId = `__new_row_${Date.now()}`;
    const newTranslations: { [lang: string]: string } = {};
    languages.forEach(lang => { newTranslations[lang] = ''; });
    updateTranslations(prev => {
      const next = [...prev];
      // Find the true position in raw data (not the sorted view index)
      const rawIndex = next.findIndex(item => item.key === afterKey);
      const insertAt = rawIndex >= 0 ? rawIndex + 1 : next.length;
      next.splice(insertAt, 0, { key: newKeyId, translations: newTranslations });
      return next;
    });
    setHasUnsavedChanges(true);

    setTimeout(() => {
      const tdEl = document.getElementById(`cell-${newKeyId}-_key_`);
      if (tdEl) {
        tdEl.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
        setEditingCell({
          key: newKeyId,
          lang: '_key_',
          value: '',
          rect: tdEl.getBoundingClientRect(),
        });
      }
    }, 0);
  };

  const handleDeleteRow = (key: string) => {
    updateTranslations(prev => {
      const rawIndex = prev.findIndex(item => item.key === key);
      if (rawIndex === -1) return prev;
      const next = [...prev];
      next.splice(rawIndex, 1);
      return next;
    });
    setHasUnsavedChanges(true);
  };

  const handleGhostCellClick = (langToEdit: string, event: React.MouseEvent<HTMLTableCellElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const newKeyId = `__new_row_${Date.now()}`;
    const newTranslations: { [lang: string]: string } = {};
    languages.forEach(lang => { newTranslations[lang] = ''; });
    updateTranslations(prev => [...prev, { key: newKeyId, translations: newTranslations }]);
    setHasUnsavedChanges(true);
    setEditingCell({ key: newKeyId, lang: langToEdit, value: '', rect });
  };

  const handlePlaceholderClick = (key: string, placeholder: string) => setEditingPlaceholder({ key, placeholder });

  const handleSavePlaceholder = (translationKey: string, placeholder: string, meta: any) => {
    setMetadataMap(prev => {
      const newMeta = { ...prev };
      if (!newMeta[translationKey]) newMeta[translationKey] = {};
      if (!newMeta[translationKey].placeholders) newMeta[translationKey].placeholders = {};
      newMeta[translationKey].placeholders = { ...newMeta[translationKey].placeholders, [placeholder]: meta };
      return newMeta;
    });
    setHasUnsavedChanges(true);
    setEditingPlaceholder(null);
  };

  const handleSaveChanges = () => {
    if (!hasUnsavedChanges) return;
    const translationsMapForExtension: { [key: string]: { [lang: string]: string } } = {};
    let invalidCount = 0;

    translationsData.forEach(item => {
      if (!item.key.startsWith('__new_row_')) {
        if (!isValidFlutterKey(item.key)) {
          invalidCount++;
        } else {
          translationsMapForExtension[item.key] = item.translations;
        }
      }
    });

    if (invalidCount > 0) {
      getVscode().postMessage({ 
        command: 'alert', 
        text: `Warning: ${invalidCount} key(s) have invalid Flutter formats and were ignored during save.` 
      });
    }

    getVscode().postMessage({
      command: 'saveAllTranslations',
      data: { translations: translationsMapForExtension, metadata: metadataMap },
    });
  };

  const handleDragSort = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) { dragItem.current = null; dragOverItem.current = null; return; }
    const newLanguages = [...languages];
    const dragged = newLanguages.splice(dragItem.current, 1)[0];
    newLanguages.splice(dragOverItem.current, 0, dragged);
    setLanguages(newLanguages);
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const handleResizeStart = (e: React.MouseEvent, colKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = columnWidths[colKey] || 250;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(100, startWidth + (moveEvent.clientX - startX));
      setColumnWidths(prev => ({ ...prev, [colKey]: newWidth }));
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleRequestSync = () => {
    getVscode().postMessage({ command: 'request-sync' });
  };

  const filteredAndSortedData = useMemo(() => {
    let processData = [...translationsData];

    if (missingFilter !== 'all') {
      processData = processData.filter(item => {
        if (item.key.startsWith('__new_row_')) return true;
        const val = item.translations[missingFilter];
        return !val || val.trim() === '';
      });
    }

    if (filterText) {
      const lowerFilter = filterText.toLowerCase();
      processData = processData.filter(item => {
        if (item.key.toLowerCase().includes(lowerFilter)) return true;
        return Object.values(item.translations).some(val => val.toLowerCase().includes(lowerFilter));
      });
    }

    if (sortConfig) {
      const sortVals = new Map<string, { val: string, origIdx: number }>();
      let lastParentVal = '';
      
      // Precompute sort values based on raw data. New rows inherit the value of the preceding non-new row.
      for (let i = 0; i < translationsData.length; i++) {
        const item = translationsData[i];
        if (!item.key.startsWith('__new_row_')) {
          lastParentVal = sortConfig.key === '_key_' ? item.key : (item.translations[sortConfig.key] || '');
        }
        sortVals.set(item.key, { val: lastParentVal, origIdx: i });
      }

      processData.sort((a, b) => {
        const aMeta = sortVals.get(a.key)!;
        const bMeta = sortVals.get(b.key)!;
        
        if (aMeta.val < bMeta.val) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aMeta.val > bMeta.val) return sortConfig.direction === 'asc' ? 1 : -1;
        
        // Preserve original insertion order to keep new rows below their parents
        return aMeta.origIdx - bMeta.origIdx;
      });
    }
    return processData;
  }, [translationsData, filterText, sortConfig, missingFilter]);

  return {
    // State
    languages, translationsData, spellCheckers, editingCell, hasUnsavedChanges,
    sortConfig, filterText, setFilterText, missingFilter, setMissingFilter,
    hoverRow, setHoverRow, isLoading, errorMsg, metadataMap, editingPlaceholder,
    setEditingPlaceholder, columnWidths, filteredAndSortedData, syncAvailable,
    // Refs
    dragItem, dragOverItem,
    // Handlers
    handleAcceptChange, handleDiscardChange, handleCellClick,
    handleAddRowMiddle, handleDeleteRow, handleGhostCellClick,
    handlePlaceholderClick, handleSavePlaceholder, handleSaveChanges,
    handleDragSort, requestSort, handleResizeStart, handleRequestSync,
  };
}
