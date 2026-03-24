import './App.css';
import './vscode.d.ts';
import { useTranslationEditor } from './hooks/useTranslationEditor';
import Toolbar from './components/Toolbar';
import TranslationTable from './components/TranslationTable';
import FloatingDialog from './components/FloatingDialog';
import PlaceholderDialog from './components/PlaceholderDialog';

// Acquire the VS Code API once at the module level.
// The hook reads it via (window as any).vscode.
const vscode = acquireVsCodeApi();
(window as any).vscode = vscode;

function App() {
  const {
    languages, translationsData, spellCheckers, editingCell, hasUnsavedChanges,
    sortConfig, filterText, setFilterText, missingFilter, setMissingFilter,
    hoverRow, setHoverRow, isLoading, errorMsg, metadataMap, editingPlaceholder,
    setEditingPlaceholder, columnWidths, filteredAndSortedData,
    dragItem, dragOverItem,
    handleAcceptChange, handleDiscardChange, handleCellClick,
    handleAddRowMiddle, handleDeleteRow, handleGhostCellClick,
    handlePlaceholderClick, handleSavePlaceholder, handleSaveChanges,
    handleDragSort, requestSort, handleResizeStart,
  } = useTranslationEditor();

  // --- Loading / Error / Empty states ---

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
          We couldn't find any <code>.arb</code> files. Please create at least one Flutter localization file (e.g. <code>app_en.arb</code>) in your workspace.
        </p>
      </div>
    );
  }

  if (translationsData.length === 0 && languages.length > 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '20px' }}>
        <h1>No Translations Yet</h1>
        <p style={{ opacity: 0.8, textAlign: 'center', maxWidth: '400px' }}>
          Your <code>.arb</code> files are currently empty. Let's add your first translation key!
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

  // --- Main editor view ---

  return (
    <>
      <Toolbar
        filterText={filterText}
        setFilterText={setFilterText}
        missingFilter={missingFilter}
        setMissingFilter={setMissingFilter}
        languages={languages}
        resultCount={filteredAndSortedData.length}
        totalCount={translationsData.filter(r => !r.key.startsWith('__new')).length}
        hasUnsavedChanges={hasUnsavedChanges}
        onSave={handleSaveChanges}
      />

      <TranslationTable
        languages={languages}
        filteredData={filteredAndSortedData}
        metadataMap={metadataMap}
        filterText={filterText}
        spellCheckers={spellCheckers}
        sortConfig={sortConfig}
        columnWidths={columnWidths}
        hoverRow={hoverRow}
        setHoverRow={setHoverRow}
        onCellClick={handleCellClick}
        onAddRow={handleAddRowMiddle}
        onDeleteRow={handleDeleteRow}
        onGhostCellClick={handleGhostCellClick}
        onPlaceholderClick={handlePlaceholderClick}
        onResizeStart={handleResizeStart}
        onSort={requestSort}
        dragItem={dragItem}
        dragOverItem={dragOverItem}
        onDragSort={handleDragSort}
      />

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