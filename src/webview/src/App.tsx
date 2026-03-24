import { useState, useEffect, useRef, useMemo } from 'react';
import './App.css';
import './vscode.d.ts'; // For type definitions
import { getSpellChecker } from './nspell-loader';
import languageMapJson from './languages.json';

const languageMap: Record<string, string> = languageMapJson;

// Define the VS Code API once at the module level
const vscode = acquireVsCodeApi();

interface TranslationData {
  key: string;
  translations: { [lang: string]: string };
}

interface FloatingDialogProps {
  currentKey: string;
  currentLang: string;
  initialValue: string;
  onAccept: (key: string, lang: string, newValue: string) => void;
  onDiscard: () => void;
  rect: DOMRect; // Pass the bounding client rect of the clicked cell
}

function FloatingDialog({ currentKey, currentLang, initialValue, onAccept, onDiscard, rect }: FloatingDialogProps) {
  const [editedValue, setEditedValue] = useState(initialValue);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [spellChecker, setSpellChecker] = useState<any>(null);
  const [spellErrors, setSpellErrors] = useState<{ word: string, suggestions: string[] }[]>([]);

  useEffect(() => {
    if (currentLang === '_key_') return;
    let active = true;
    getSpellChecker(currentLang).then(spell => {
      if (active && spell) setSpellChecker(spell);
    });
    return () => { active = false; };
  }, [currentLang]);

  useEffect(() => {
    if (!spellChecker) {
      setSpellErrors([]);
      return;
    }
    // Remove {placeholders} before checking
    const textWithoutPlaceholders = editedValue.replace(/\{[^}]+\}/g, ' ');
    // Match word characters, including accents
    const words = Array.from(new Set(textWithoutPlaceholders.match(/[A-Za-zÀ-ÖØ-öø-ÿ']+/g) || []));
    
    const errors = words
      .filter(w => w.length > 1 && !spellChecker.correct(w))
      .map(w => ({ word: w, suggestions: spellChecker.suggest(w).slice(0, 4) }));
    setSpellErrors(errors);
  }, [editedValue, spellChecker]);

  const applySuggestion = (oldWord: string, newWord: string) => {
    const rx = new RegExp(`(^|[^A-Za-zÀ-ÖØ-öø-ÿ'])${oldWord}(?=[^A-Za-zÀ-ÖØ-öø-ÿ']|$)`, 'g');
    setEditedValue(prev => prev.replace(rx, `$1${newWord}`));
  };

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select(); // Select all text in the input
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) {
        onDiscard();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onDiscard]); // onDiscard is stable, so no infinite loop

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onAccept(currentKey, currentLang, editedValue);
    } else if (e.key === 'Escape') {
      onDiscard();
    }
  };

  const dialogStyle: React.CSSProperties = {
    position: 'fixed',
    top: rect.top,
    left: rect.left,
    width: rect.width,
    zIndex: 10000, // Make sure it's on top
    backgroundColor: 'var(--vscode-editor-background)',
    border: '1px solid var(--vscode-editorWidget-border)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    padding: '5px',
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '4px',
    border: '1px solid var(--vscode-input-border)',
    backgroundColor: 'var(--vscode-input-background)',
    color: 'var(--vscode-input-foreground)',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const buttonContainerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '5px',
  };

  const discardButtonStyle: React.CSSProperties = {
    backgroundColor: 'var(--vscode-button-secondary-background)',
    color: 'var(--vscode-button-secondary-foreground)',
    border: 'none',
    padding: '5px 10px',
    cursor: 'pointer',
    borderRadius: '3px',
    fontSize: '1em', // Ensure icon is visible
  };

  const acceptButtonStyle: React.CSSProperties = {
    backgroundColor: 'var(--vscode-button-background)',
    color: 'var(--vscode-button-foreground)',
    border: 'none',
    padding: '5px 10px',
    cursor: 'pointer',
    borderRadius: '3px',
    fontSize: '1em', // Ensure icon is visible
  };

  return (
    <div style={dialogStyle} ref={dialogRef}>
      <input
        ref={inputRef}
        type="text"
        value={editedValue}
        onChange={(e) => setEditedValue(e.target.value)}
        onKeyDown={handleInputKeyDown}
        style={inputStyle}
        spellCheck={false} // Custom nspell handles it
      />
      {spellErrors.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px', backgroundColor: 'var(--vscode-editorError-background, rgba(255,0,0,0.1))', border: '1px solid var(--vscode-editorError-border, red)', borderRadius: '3px', fontSize: '11px', maxHeight: '100px', overflowY: 'auto' }}>
          {spellErrors.map(err => (
            <div key={err.word} style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
              <strong style={{ color: 'var(--vscode-editorError-foreground, red)' }}>{err.word}:</strong>
              {err.suggestions.length > 0 ? err.suggestions.map(sug => (
                <button
                  key={sug}
                  onClick={() => applySuggestion(err.word, sug)}
                  style={{ background: 'var(--vscode-button-secondary-background)', color: 'var(--vscode-button-secondary-foreground)', border: 'none', padding: '2px 4px', cursor: 'pointer', borderRadius: '2px', fontSize: '10px' }}
                >
                  {sug}
                </button>
              )) : <span>(no suggestions)</span>}
            </div>
          ))}
        </div>
      )}
      <div style={buttonContainerStyle}>
        <button
          onClick={onDiscard}
          title="Discard changes"
          style={discardButtonStyle}
        >
          ✖
        </button>
        <button
          onClick={() => onAccept(currentKey, currentLang, editedValue)}
          title="Accept changes"
          style={acceptButtonStyle}
        >
          ✔
        </button>
      </div>
    </div>
  );
}

function renderNormalText(text: string, filterStr: string, spellChecker: any) {
  if (!text) return null;
  
  // First, filter match logic
  let parts: { text: string; isFilterMatch: boolean }[] = [{ text, isFilterMatch: false }];
  if (filterStr.trim()) {
      const regex = new RegExp(`(${filterStr})`, 'gi');
      parts = text.split(regex).map(part => ({
          text: part,
          isFilterMatch: regex.test(part)
      }));
  }

  return (
      <>
          {parts.map((partObj, i) => {
              if (partObj.isFilterMatch) {
                  return (
                      <mark key={i} style={{ backgroundColor: 'var(--vscode-editor-findMatchHighlightBackground, #ffff0055)', color: 'inherit', borderRadius: '2px' }}>
                          {partObj.text}
                      </mark>
                  );
              } else if (spellChecker) {
                  const wordRegex = /([A-Za-zÀ-ÖØ-öø-ÿ']+)/g;
                  const subParts = partObj.text.split(wordRegex);
                  return (
                      <span key={i}>
                          {subParts.map((subPart, j) => {
                              const isWord = wordRegex.test(subPart);
                              wordRegex.lastIndex = 0; // reset
                              
                              if (isWord && subPart.length > 1 && !spellChecker.correct(subPart)) {
                                  return (
                                      <span key={j} style={{ textDecorationStyle: 'wavy', textDecorationLine: 'underline', textDecorationColor: 'var(--vscode-editorError-foreground, red)', textUnderlinePosition: 'under' }} title="Misspelled word">
                                          {subPart}
                                      </span>
                                  );
                              }
                              return <span key={j}>{subPart}</span>;
                          })}
                      </span>
                  );
              } else {
                  return <span key={i}>{partObj.text}</span>;
              }
          })}
      </>
  );
}

interface PlaceholderDialogProps {
  translationKey: string;
  placeholder: string;
  existingMeta: any;
  onSave: (translationKey: string, placeholder: string, meta: any) => void;
  onClose: () => void;
}

function PlaceholderDialog({ translationKey, placeholder, existingMeta, onSave, onClose }: PlaceholderDialogProps) {
  const [type, setType] = useState(existingMeta?.type || 'String');
  const [example, setExample] = useState(existingMeta?.example || '');
  
  return (
    <div style={{ position: 'fixed', top: '0', left: '0', right: '0', bottom: '0', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10002, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: 'var(--vscode-editor-background)', padding: '20px', border: '1px solid var(--vscode-editorWidget-border)', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '15px', minWidth: '350px', borderRadius: '4px' }}>
        <h3 style={{ margin: '0', color: 'var(--vscode-editorForeground)' }}>Edit Placeholder: <span style={{ fontFamily: 'monospace', color: 'var(--vscode-textPreformat-foreground)' }}>{placeholder}</span></h3>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '13px' }}>
          Type:
          <select value={type} onChange={e => setType(e.target.value)} style={{ padding: '6px', backgroundColor: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)', outline: 'none' }}>
            <option value="String">String</option>
            <option value="int">int</option>
            <option value="double">double</option>
            <option value="num">num</option>
            <option value="DateTime">DateTime</option>
            <option value="Object">Object</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '13px' }}>
          Example:
          <input type="text" value={example} onChange={e => setExample(e.target.value)} placeholder="e.g. John Doe" style={{ padding: '6px', backgroundColor: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)', outline: 'none' }} />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '5px' }}>
          <button onClick={onClose} style={{ padding: '6px 12px', backgroundColor: 'var(--vscode-button-secondary-background)', color: 'var(--vscode-button-secondary-foreground)', border: 'none', cursor: 'pointer', borderRadius: '2px' }}>Cancel</button>
          <button onClick={() => onSave(translationKey, placeholder, { type, example })} style={{ padding: '6px 12px', backgroundColor: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)', border: 'none', cursor: 'pointer', borderRadius: '2px' }}>Save</button>
        </div>
      </div>
    </div>
  );
}

function renderTranslationText(
    text: string, 
    currentKey: string, 
    metadata: any, 
    filterStr: string,
    spellChecker: any,
    onPlaceholderClick: (key: string, placeholder: string) => void
) {
    if (!text) return text;
    
    // First, split by placeholders {var}
    const placeholderRegex = /(\{[^}]+\})/g;
    const parts = text.split(placeholderRegex);
    
    const keyMetadata = metadata[currentKey] || {};
    const definedPlaceholders = keyMetadata.placeholders || {};

    return (
        <>
            {parts.map((part, i) => {
                const match = part.match(/^\{([^}]+)\}$/);
                if (match) {
                    const placeholderName = match[1];
                    const isDefined = definedPlaceholders[placeholderName] !== undefined;
                    const exampleValue = isDefined ? definedPlaceholders[placeholderName].example : undefined;
                    
                    return (
                        <mark 
                            key={i} 
                            onClick={(e) => { e.stopPropagation(); onPlaceholderClick(currentKey, placeholderName); }}
                            style={{ 
                                backgroundColor: isDefined ? 'var(--vscode-editor-snippetFinalTabstopHighlightBackground, #00ff0033)' : 'var(--vscode-editorError-background, #ff000055)', 
                                color: 'inherit', 
                                cursor: 'pointer',
                                borderRadius: '3px',
                                padding: '1px 3px',
                                border: `1px solid ${isDefined ? 'var(--vscode-editor-snippetFinalTabstopHighlightBorder, transparent)' : 'var(--vscode-editorError-border, transparent)'}`
                            }}
                            title={isDefined ? `Example: ${exampleValue || 'none'} (Click to edit)` : 'Missing metadata! Click to define.'}
                        >
                            {part}
                        </mark>
                    );
                } else {
                    return <span key={i}>{renderNormalText(part, filterStr, spellChecker)}</span>;
                }
            })}
        </>
    );
}

function App() {
  const [languages, setLanguages] = useState<string[]>([]);
  const [translationsData, setTranslationsData] = useState<TranslationData[]>([]);
  // No need for [vscodeApi, setVscodeApi] state anymore, use the module-level 'vscode' directly

  const [spellCheckers, setSpellCheckers] = useState<{ [lang: string]: any }>({});

  const [editingCell, setEditingCell] = useState<{ key: string, lang: string, value: string, rect: DOMRect } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [filterText, setFilterText] = useState<string>('');
  const [missingFilter, setMissingFilter] = useState<string>('all');
  const [hoverRow, setHoverRow] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (vscode) {
      vscode.postMessage({ command: 'unsaved-changes', data: hasUnsavedChanges });
    }
  }, [hasUnsavedChanges]);

  const [metadataMap, setMetadataMap] = useState<{ [key: string]: any }>({});
  const [editingPlaceholder, setEditingPlaceholder] = useState<{ key: string, placeholder: string } | null>(null);

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const handleDragSort = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) {
        dragItem.current = null;
        dragOverItem.current = null;
        return;
    }
    
    const newLanguages = [...languages];
    const draggedItemContent = newLanguages.splice(dragItem.current, 1)[0];
    newLanguages.splice(dragOverItem.current, 0, draggedItemContent);
    setLanguages(newLanguages);
    
    dragItem.current = null;
    dragOverItem.current = null;
  };

  useEffect(() => {
    let active = true;
    languages.forEach(lang => {
      if (lang === '_key_') return;
      getSpellChecker(lang).then(spell => {
        if (active && spell) {
          setSpellCheckers(prev => ({ ...prev, [lang]: spell }));
        }
      });
    });
    return () => { active = false; };
  }, [languages]);

  useEffect(() => {
    // No need to call acquireVsCodeApi() here anymore, 'vscode' is already defined

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.command) {
        case 'initial-data':
          const receivedData = message.data;
          setLanguages(receivedData.languages);
          const translationsArray = Object.entries(receivedData.translations).map(([key, translations]) => ({
            key,
            translations: translations as { [lang: string]: string }
          }));
          setTranslationsData(translationsArray);
          setMetadataMap(receivedData.metadata || {});
          setIsLoading(false);
          setErrorMsg(null);
          break;
        case 'load-error':
          setIsLoading(false);
          setErrorMsg(message.data);
          break;
        case 'save-success':
            setHasUnsavedChanges(false);
            // Optionally show a success message if needed, but extension can handle this
            break;
        case 'save-error':
            // Optionally show an error message, but extension can handle this
            break;
        default:
            // console.log('Unknown command:', message.command);
            break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []); // Remove vscodeApi from dependencies, as it's no longer state

  const handleAcceptChange = (key: string, lang: string, newValue: string) => {
    const isNewRow = key.startsWith('__new_row_');
    const displayKey = isNewRow ? '' : key;

    if (lang === '_key_') {
      const trimmedNewValue = newValue.trim();
      if (!trimmedNewValue) {
        alert('Key cannot be empty.');
        return;
      }
      if (trimmedNewValue === displayKey) {
        setEditingCell(null);
        return;
      }
      if (translationsData.some(item => item.key === trimmedNewValue)) {
        alert(`Key "${trimmedNewValue}" already exists.`);
        return;
      }
      
      setTranslationsData(prevData => {
        const newData = prevData.map(item =>
          item.key === key
            ? { ...item, key: trimmedNewValue }
            : item
        );
        setHasUnsavedChanges(true);
        return newData;
      });
      setMetadataMap(prev => {
        const newMeta = { ...prev };
        if (newMeta[key] !== undefined) {
          newMeta[trimmedNewValue] = newMeta[key];
          delete newMeta[key];
        }
        return newMeta;
      });
      setEditingCell(null);
      return;
    }

    setTranslationsData(prevData => {
      const newData = prevData.map(item =>
        item.key === key
          ? { ...item, translations: { ...item.translations, [lang]: newValue } }
          : item
      );
      const originalValue = prevData.find(item => item.key === key)?.translations[lang] || '';
      if (originalValue !== newValue) {
        setHasUnsavedChanges(true);
      }
      return newData;
    });
    setEditingCell(null);
  };

  const handleDiscardChange = () => {
    setEditingCell(null);
  };

  const handleCellClick = (key: string, lang: string, value: string, event: React.MouseEvent<HTMLTableCellElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setEditingCell({ key, lang, value, rect });
  };

  const handleAddRowMiddle = (index: number) => {
    const newKeyId = `__new_row_${Date.now()}`;
    const newTranslations: { [lang: string]: string } = {};
    languages.forEach(lang => {
      newTranslations[lang] = '';
    });
    
    setTranslationsData(prev => {
        const next = [...prev];
        next.splice(index + 1, 0, { key: newKeyId, translations: newTranslations });
        return next;
    });
    setHasUnsavedChanges(true);
  };

  const handleDeleteRow = (index: number) => {
    if (window.confirm('Are you sure you want to delete this row entirely?')) {
      setTranslationsData(prev => {
        const next = [...prev];
        next.splice(index, 1);
        return next;
      });
      setHasUnsavedChanges(true);
    }
  };

  const handleGhostCellClick = (langToEdit: string, event: React.MouseEvent<HTMLTableCellElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const newKeyId = `__new_row_${Date.now()}`;
    
    const newTranslations: { [lang: string]: string } = {};
    languages.forEach(lang => {
      newTranslations[lang] = '';
    });
    
    setTranslationsData(prev => [...prev, { key: newKeyId, translations: newTranslations }]);
    setHasUnsavedChanges(true);

    // Set editing cell immediately to the newly created row!
    setEditingCell({ key: newKeyId, lang: langToEdit, value: '', rect });
  };

  const handlePlaceholderClick = (key: string, placeholder: string) => {
    setEditingPlaceholder({ key, placeholder });
  };

  const handleSavePlaceholder = (translationKey: string, placeholder: string, meta: any) => {
    setMetadataMap(prev => {
      const newMeta = { ...prev };
      if (!newMeta[translationKey]) newMeta[translationKey] = {};
      if (!newMeta[translationKey].placeholders) newMeta[translationKey].placeholders = {};
      newMeta[translationKey].placeholders = {
        ...newMeta[translationKey].placeholders,
        [placeholder]: meta
      };
      return newMeta;
    });
    setHasUnsavedChanges(true);
    setEditingPlaceholder(null);
  };

  const handleSaveChanges = () => {
    // Use the module-level 'vscode' directly
    if (!vscode) { // Still good to check if it somehow failed, though less likely now
      console.error('VS Code API not available.');
      return;
    }
    if (!hasUnsavedChanges) {
        return;
    }

    const translationsMapForExtension: { [key: string]: { [lang: string]: string } } = {};
    translationsData.forEach(item => {
        if (!item.key.startsWith('__new_row_')) {
            translationsMapForExtension[item.key] = item.translations;
        }
    });

    vscode.postMessage({ // Use 'vscode' here
        command: 'saveAllTranslations',
        data: {
            translations: translationsMapForExtension,
            metadata: metadataMap
        },
    });
  };
  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedData = useMemo(() => {
    let processData = [...translationsData];

    if (missingFilter !== 'all') {
      processData = processData.filter(item => {
        if (item.key.startsWith('__new_row_')) return true; // keep newly created ghost rows visible
        const val = item.translations[missingFilter];
        return !val || val.trim() === ''; // Empty means missing/pending
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
      processData.sort((a, b) => {
        const aValue = sortConfig.key === '_key_' ? a.key : (a.translations[sortConfig.key] || '');
        const bValue = sortConfig.key === '_key_' ? b.key : (b.translations[sortConfig.key] || '');
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return processData;
  }, [translationsData, filterText, sortConfig, missingFilter]);


  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', opacity: 0.7 }}>
        <h1>Loading translations...</h1>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '20px' }}>
        <h1 style={{ color: 'var(--vscode-errorForeground)' }}>Error Loading Translations</h1>
        <p style={{ opacity: 0.8, textAlign: 'center', maxWidth: '600px' }}>{errorMsg}</p>
        <button 
           onClick={() => vscode.postMessage({ command: 'reload' })}
           style={{ padding: '8px 16px', background: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
           Retry
        </button>
      </div>
    );
  }

  if (translationsData.length === 0 && languages.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '20px' }}>
        <h1>No Translation Files Found</h1>
        <p style={{ opacity: 0.8, textAlign: 'center', maxWidth: '400px' }}>
          We couldn't find any <code>.arb</code> files. Please create at least one Flutter localization file (e.g. <code>app_en.arb</code>) in your workspace natively.
        </p>
      </div>
    );
  }

  if (translationsData.length === 0 && languages.length > 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '20px' }}>
        <h1>No Translations Yet</h1>
        <p style={{ opacity: 0.8, textAlign: 'center', maxWidth: '400px' }}>
          Your `.arb` files are currently empty. Let's add your first translation key!
        </p>
        <button 
           onClick={() => handleAddRowMiddle(-1)}
           style={{ padding: '10px 20px', fontSize: '14px', background: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
           + Add First Key
        </button>
      </div>
    );
  }

  return (
    <>
      <div style={{
        position: 'sticky',
        top: 0,
        backgroundColor: 'var(--vscode-sideBar-background)',
        borderBottom: '1px solid var(--vscode-editorWidget-border)',
        padding: '10px 15px',
        zIndex: 10001,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        marginBottom: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Filter translations..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              style={{
                width: '300px',
                padding: '5px',
                paddingRight: '25px',
                border: '1px solid var(--vscode-input-border)',
                backgroundColor: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)',
                outline: 'none',
                borderRadius: '3px',
              }}
            />
            {filterText && (
              <button
                onClick={() => setFilterText('')}
                style={{
                  position: 'absolute',
                  right: '5px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--vscode-input-foreground)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Clear filter"
              >
                ✕
              </button>
            )}
          </div>
          <select 
            value={missingFilter} 
            onChange={e => setMissingFilter(e.target.value)}
            style={{
              padding: '6px',
              border: '1px solid var(--vscode-input-border)',
              backgroundColor: 'var(--vscode-input-background)',
              color: 'var(--vscode-input-foreground)',
              outline: 'none',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Complete & Pending</option>
            {languages.map(lang => (
              <option key={lang} value={lang}>Missing: {languageMap[lang] || lang}</option>
            ))}
          </select>
          {(filterText || missingFilter !== 'all') && (
            <span style={{ fontSize: '0.9em', opacity: 0.8 }}>
              {filteredAndSortedData.length} / {translationsData.filter(r => !r.key.startsWith('__new')).length} results
            </span>
          )}
        </div>
        <button
          onClick={handleSaveChanges}
          disabled={!hasUnsavedChanges}
          style={{
            backgroundColor: hasUnsavedChanges ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondary-background)',
            color: hasUnsavedChanges ? 'var(--vscode-button-foreground)' : 'var(--vscode-button-secondary-foreground)',
            border: 'none',
            padding: '8px 12px',
            cursor: hasUnsavedChanges ? 'pointer' : 'not-allowed',
            borderRadius: '3px',
            whiteSpace: 'nowrap',
            opacity: hasUnsavedChanges ? 1 : 0.6,
          }}
        >
          Save Changes
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th onClick={() => requestSort('_key_')} style={{ cursor: 'pointer', userSelect: 'none' }}>
              Key 🔑 {sortConfig?.key === '_key_' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
            </th>
            {languages.map((lang, index) => {
              const displayLang = languageMap[lang] || lang;
              return (
              <th
                key={lang}
                draggable
                onDragStart={() => (dragItem.current = index)}
                onDragEnter={() => (dragOverItem.current = index)}
                onDragEnd={handleDragSort}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => requestSort(lang)}
                style={{ cursor: 'grab', userSelect: 'none' }}
                title={`Drag to reorder, click to sort (${lang})`}
              >
                {displayLang} {sortConfig?.key === lang ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
              </th>
            )})}
          </tr>
        </thead>
        <tbody>
          {filteredAndSortedData.map((item, index) => {
            const isNewRow = item.key.startsWith('__new_row_');
            const displayKey = isNewRow ? '' : item.key;
            return (
            <tr key={item.key} onMouseEnter={() => setHoverRow(item.key)} onMouseLeave={() => setHoverRow(null)}>
              <td 
                onClick={(e) => handleCellClick(item.key, '_key_', displayKey, e)} 
                style={{ zIndex: hoverRow === item.key ? 10 : undefined }}
              >
                {hoverRow === item.key && (
                  <div style={{ position: 'absolute', bottom: '-10px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '4px', zIndex: 10 }}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleAddRowMiddle(index); }}
                      style={{ width: '20px', height: '20px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--vscode-editorWidget-border)', background: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)', cursor: 'pointer', fontSize: '14px', lineHeight: '10px', opacity: 0.9, boxShadow: '0 2px 5px rgba(0,0,0,0.3)' }}
                      title="Insert row below"
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '0.9'}
                    >
                      +
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteRow(index); }}
                      style={{ width: '20px', height: '20px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--vscode-editorWidget-border)', background: 'var(--vscode-errorForeground, red)', color: 'white', cursor: 'pointer', fontSize: '12px', lineHeight: '10px', opacity: 0.9, boxShadow: '0 2px 5px rgba(0,0,0,0.3)' }}
                      title="Delete row"
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '0.9'}
                    >
                      ✕
                    </button>
                  </div>
                )}
                {isNewRow && !displayKey ? <span style={{ opacity: 0.5, fontStyle: 'italic' }}>New Key...</span> : renderTranslationText(displayKey, item.key, metadataMap, filterText, null, handlePlaceholderClick)}
              </td>
              {languages.map(lang => (
                <td key={lang} onClick={(e) => handleCellClick(item.key, lang, item.translations[lang] || '', e)}>
                  {renderTranslationText(item.translations[lang] || '', item.key, metadataMap, filterText, spellCheckers[lang], handlePlaceholderClick)}
                </td>
              ))}
            </tr>
          )})}
          {/* Ghost Row */}
          {!filterText && (
            <tr style={{ opacity: 0.6 }}>
              <td onClick={(e) => handleGhostCellClick('_key_', e)} style={{ cursor: 'text' }}>
                 <span style={{ color: 'var(--vscode-descriptionForeground)', fontStyle: 'italic' }}>+ Add new key...</span>
              </td>
              {languages.map(lang => (
                 <td key={lang} onClick={(e) => handleGhostCellClick(lang, e)} style={{ cursor: 'text' }}></td>
              ))}
            </tr>
          )}
        </tbody>
      </table>

      {editingCell && (
        <FloatingDialog
          currentKey={editingCell.key}
          currentLang={editingCell.lang}
          initialValue={editingCell.value}
          onAccept={handleAcceptChange}
          onDiscard={handleDiscardChange}
          rect={editingCell.rect}
        />
      )}

      {editingPlaceholder && (
        <PlaceholderDialog
          translationKey={editingPlaceholder.key}
          placeholder={editingPlaceholder.placeholder}
          existingMeta={metadataMap[editingPlaceholder.key]?.placeholders?.[editingPlaceholder.placeholder] || {}}
          onSave={handleSavePlaceholder}
          onClose={() => setEditingPlaceholder(null)}
        />
      )}
    </>
  );
}

export default App;