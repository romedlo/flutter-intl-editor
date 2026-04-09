import { useState, useEffect, useRef } from 'react';
import type { FloatingDialogProps } from '../types';
import { getSpellChecker } from '../nspell-loader';

export default function FloatingDialog({ currentKey, currentLang, initialValue, onAccept, onDiscard, rect }: FloatingDialogProps) {
  const [editedValue, setEditedValue] = useState(initialValue);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [spellChecker, setSpellChecker] = useState<any>(null);
  const [spellErrors, setSpellErrors] = useState<{ word: string, suggestions: string[] }[]>([]);

  useEffect(() => {
    setEditedValue(initialValue);
  }, [currentKey, currentLang, initialValue]);

  useEffect(() => {
    setSpellChecker(null);
    setSpellErrors([]);
    if (currentLang === '_key_') return;
    let active = true;
    getSpellChecker(currentLang).then(spell => {
      if (active && spell) setSpellChecker(spell);
    });
    return () => { active = false; };
  }, [currentLang]);

  useEffect(() => {
    if (!spellChecker) { setSpellErrors([]); return; }
    const textWithoutPlaceholders = editedValue.replace(/\{[^}]+\}/g, ' ');
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
      inputRef.current.select();
    }
    const handleClickOutside = (event: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) {
        onDiscard();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onDiscard]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onAccept(currentKey, currentLang, editedValue);
    }
    else if (e.key === 'Tab') {
      e.preventDefault();
      onAccept(currentKey, currentLang, editedValue, e.shiftKey ? 'prev' : 'next');
    }
    else if (e.key === 'Escape') {
      e.preventDefault();
      onDiscard();
    }
  };

  return (
    <div
      ref={dialogRef}
      style={{
        position: 'fixed', top: rect.top, left: rect.left, width: rect.width, zIndex: 10000,
        backgroundColor: 'var(--vscode-editor-background)', border: '1px solid var(--vscode-editorWidget-border)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)', padding: '5px', display: 'flex', flexDirection: 'column', gap: '5px',
      }}
    >
      <textarea
        ref={inputRef}
        value={editedValue}
        onChange={(e) => setEditedValue(e.target.value)}
        onKeyDown={handleInputKeyDown}
        spellCheck={false}
        rows={2}
        style={{
          width: '100%', padding: '4px', border: '1px solid var(--vscode-input-border)',
          backgroundColor: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)',
          outline: 'none', boxSizing: 'border-box',
          resize: 'vertical', fontFamily: 'inherit'
        }}
      />
      {spellErrors.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px', backgroundColor: 'var(--vscode-editorError-background, rgba(255,0,0,0.1))', border: '1px solid var(--vscode-editorError-border, red)', borderRadius: '3px', fontSize: '11px', maxHeight: '100px', overflowY: 'auto' }}>
          {spellErrors.map(err => (
            <div key={err.word} style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
              <strong style={{ color: 'var(--vscode-editorError-foreground, red)' }}>{err.word}:</strong>
              {err.suggestions.length > 0 ? err.suggestions.map(sug => (
                <button key={sug} onClick={() => applySuggestion(err.word, sug)}
                  style={{ background: 'var(--vscode-button-secondary-background)', color: 'var(--vscode-button-secondary-foreground)', border: 'none', padding: '2px 4px', cursor: 'pointer', borderRadius: '2px', fontSize: '10px' }}>
                  {sug}
                </button>
              )) : <span>(no suggestions)</span>}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '5px' }}>
        <button onClick={onDiscard} title="Discard changes"
          style={{ backgroundColor: 'var(--vscode-button-secondary-background)', color: 'var(--vscode-button-secondary-foreground)', border: 'none', padding: '5px 10px', cursor: 'pointer', borderRadius: '3px' }}>
          ✖
        </button>
        <button onClick={() => onAccept(currentKey, currentLang, editedValue)} title="Accept changes"
          style={{ backgroundColor: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)', border: 'none', padding: '5px 10px', cursor: 'pointer', borderRadius: '3px' }}>
          ✔
        </button>
      </div>
    </div>
  );
}
