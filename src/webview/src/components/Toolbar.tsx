import { useRef } from 'react';
import languageMapJson from '../languages.json';

const languageMap: Record<string, string> = languageMapJson;

interface ToolbarProps {
  filterText: string;
  setFilterText: (v: string) => void;
  missingFilter: string;
  setMissingFilter: (v: string) => void;
  languages: string[];
  resultCount: number;
  totalCount: number;
  hasUnsavedChanges: boolean;
  onSave: () => void;
}

export default function Toolbar({
  filterText,
  setFilterText,
  missingFilter,
  setMissingFilter,
  languages,
  resultCount,
  totalCount,
  hasUnsavedChanges,
  onSave,
}: ToolbarProps) {
  const filterInputRef = useRef<HTMLInputElement>(null);

  // Expose ref so parent can focus on Cmd+F — use a callback ref pattern instead via forwardRef if needed
  // For now, keyboard shortcut is handled in the hook and focuses by id
  return (
    <div
      id="toolbar"
      style={{
        position: 'sticky', top: 0,
        backgroundColor: 'var(--vscode-sideBar-background)',
        borderBottom: '1px solid var(--vscode-editorWidget-border)',
        padding: '10px 15px', zIndex: 10001,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
        marginBottom: '10px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            id="filter-input"
            ref={filterInputRef}
            type="text"
            placeholder="Filter translations..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            style={{
              width: '300px', padding: '5px', paddingRight: '25px',
              border: '1px solid var(--vscode-input-border)',
              backgroundColor: 'var(--vscode-input-background)',
              color: 'var(--vscode-input-foreground)',
              outline: 'none', borderRadius: '3px',
            }}
          />
          {filterText && (
            <button
              onClick={() => setFilterText('')}
              style={{ position: 'absolute', right: '5px', background: 'none', border: 'none', color: 'var(--vscode-input-foreground)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Clear filter"
            >
              ✕
            </button>
          )}
        </div>

        <select
          value={missingFilter}
          onChange={e => setMissingFilter(e.target.value)}
          style={{ padding: '6px', border: '1px solid var(--vscode-input-border)', backgroundColor: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', outline: 'none', borderRadius: '3px', cursor: 'pointer' }}
        >
          <option value="all">All Complete &amp; Pending</option>
          {languages.map(lang => (
            <option key={lang} value={lang}>Missing: {languageMap[lang] || lang}</option>
          ))}
        </select>

        {(filterText || missingFilter !== 'all') && (
          <span style={{ fontSize: '0.9em', opacity: 0.8 }}>
            {resultCount} / {totalCount} results
          </span>
        )}
      </div>

      <button
        onClick={onSave}
        disabled={!hasUnsavedChanges}
        style={{
          backgroundColor: hasUnsavedChanges ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondary-background)',
          color: hasUnsavedChanges ? 'var(--vscode-button-foreground)' : 'var(--vscode-button-secondary-foreground)',
          border: 'none', padding: '8px 12px',
          cursor: hasUnsavedChanges ? 'pointer' : 'not-allowed',
          borderRadius: '3px', whiteSpace: 'nowrap',
          opacity: hasUnsavedChanges ? 1 : 0.6,
        }}
      >
        Save Changes
      </button>
    </div>
  );
}
