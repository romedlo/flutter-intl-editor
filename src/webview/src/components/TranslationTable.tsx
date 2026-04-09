import type { TranslationData, SortConfig } from '../types';
import { renderTranslationText } from '../utils/renderText';
import languageMapJson from '../languages.json';
import { isValidFlutterKey } from '../hooks/useTranslationEditor';

const languageMap: Record<string, string> = languageMapJson;

interface TranslationTableProps {
  languages: string[];
  filteredData: TranslationData[];
  metadataMap: { [key: string]: any };
  filterText: string;
  spellCheckers: { [lang: string]: any };
  sortConfig: SortConfig | null;
  columnWidths: { [key: string]: number };
  hoverRow: string | null;
  setHoverRow: (key: string | null) => void;
  onCellClick: (key: string, lang: string, value: string, e: React.MouseEvent<HTMLTableCellElement>) => void;
  onAddRow: (key: string) => void;
  onDeleteRow: (key: string) => void;
  onGhostCellClick: (lang: string, e: React.MouseEvent<HTMLTableCellElement>) => void;
  onPlaceholderClick: (key: string, placeholder: string) => void;
  onResizeStart: (e: React.MouseEvent, colKey: string) => void;
  onSort: (key: string) => void;
  dragItem: React.MutableRefObject<number | null>;
  dragOverItem: React.MutableRefObject<number | null>;
  onDragSort: () => void;
}

export default function TranslationTable({
  languages, filteredData, metadataMap, filterText, spellCheckers,
  sortConfig, columnWidths, hoverRow, setHoverRow,
  onCellClick, onAddRow, onDeleteRow, onGhostCellClick, onPlaceholderClick,
  onResizeStart, onSort, dragItem, dragOverItem, onDragSort,
}: TranslationTableProps) {

  return (
    <table>
      <thead>
        <tr>
          <th
            onClick={() => onSort('_key_')}
            style={{ cursor: 'pointer', userSelect: 'none', width: columnWidths['_key_'] || 250, minWidth: columnWidths['_key_'] || 250, maxWidth: columnWidths['_key_'] || 250 }}
          >
            Key 🔑 {sortConfig?.key === '_key_' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
            <div className="resizer" onMouseDown={(e) => onResizeStart(e, '_key_')} onClick={(e) => e.stopPropagation()} />
          </th>
          {languages.map((lang, index) => {
            const displayLang = languageMap[lang] || lang;
            return (
              <th
                key={lang}
                draggable
                onDragStart={() => (dragItem.current = index)}
                onDragEnter={() => (dragOverItem.current = index)}
                onDragEnd={onDragSort}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => onSort(lang)}
                style={{ cursor: 'grab', userSelect: 'none', width: columnWidths[lang] || 250, minWidth: columnWidths[lang] || 250, maxWidth: columnWidths[lang] || 250 }}
                title={`Drag to reorder, click to sort (${lang})`}
              >
                {displayLang} {sortConfig?.key === lang ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                <div className="resizer" onMouseDown={(e) => onResizeStart(e, lang)} onClick={(e) => e.stopPropagation()} />
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {filteredData.map((item, _) => {
          const isNewRow = item.key.startsWith('__new_row_');
          const displayKey = isNewRow ? '' : item.key;
          return (
            <tr key={item.key} onMouseEnter={() => setHoverRow(item.key)} onMouseLeave={() => setHoverRow(null)}>
              <td
                id={`cell-${item.key}-_key_`}
                data-rowkey={item.key}
                data-lang="_key_"
                onClick={(e) => onCellClick(item.key, '_key_', displayKey, e)}
                style={{ zIndex: hoverRow === item.key ? 10 : undefined, fontFamily: 'monospace' }}
              >
                {hoverRow === item.key && (
                  <div style={{ position: 'absolute', bottom: '-10px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '4px', zIndex: 10 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); onAddRow(item.key); }}
                      style={{ width: '20px', height: '20px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--vscode-editorWidget-border)', background: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)', cursor: 'pointer', fontSize: '14px', lineHeight: '10px', opacity: 0.9, boxShadow: '0 2px 5px rgba(0,0,0,0.3)' }}
                      title="Insert row below"
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '0.9'}
                    >
                      +
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteRow(item.key); }}
                      style={{ width: '20px', height: '20px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--vscode-editorWidget-border)', background: 'var(--vscode-errorForeground, red)', color: 'white', cursor: 'pointer', fontSize: '12px', lineHeight: '10px', opacity: 0.9, boxShadow: '0 2px 5px rgba(0,0,0,0.3)' }}
                      title="Delete row"
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '0.9'}
                    >
                      ✕
                    </button>
                  </div>
                )}
                {isNewRow && !displayKey
                  ? <span style={{ opacity: 0.5, fontStyle: 'italic' }}>New Key...</span>
                  : (
                    <span 
                      style={(!isValidFlutterKey(displayKey) && !isNewRow) ? {
                        textDecorationLine: 'underline',
                        textDecorationStyle: 'wavy',
                        textDecorationColor: 'var(--vscode-editorError-foreground, red)',
                        textUnderlineOffset: '3px',
                      } : undefined}
                      title={(!isValidFlutterKey(displayKey) && !isNewRow) ? 'Invalid key format. Only alphanumeric and _, starting with a letter or _.' : undefined}
                    >
                      {renderTranslationText(displayKey, item.key, metadataMap, filterText, null, onPlaceholderClick)}
                    </span>
                  )
                }
              </td>
              {languages.map(lang => (
                <td 
                  key={lang} 
                  id={`cell-${item.key}-${lang}`}
                  data-rowkey={item.key}
                  data-lang={lang}
                  onClick={(e) => onCellClick(item.key, lang, item.translations[lang] || '', e)}
                >
                  {renderTranslationText(item.translations[lang] || '', item.key, metadataMap, filterText, spellCheckers[lang], onPlaceholderClick)}
                </td>
              ))}
            </tr>
          );
        })}
        {/* Ghost row */}
        {!filterText && (
          <tr style={{ opacity: 0.6 }}>
            <td onClick={(e) => onGhostCellClick('_key_', e)} style={{ cursor: 'text', fontFamily: 'monospace' }}>
              <span style={{ color: 'var(--vscode-descriptionForeground)', fontStyle: 'italic' }}>+ Add new key...</span>
            </td>
            {languages.map(lang => (
              <td key={lang} onClick={(e) => onGhostCellClick(lang, e)} style={{ cursor: 'text' }} />
            ))}
          </tr>
        )}
      </tbody>
    </table>
  );
}
