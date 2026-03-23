import { useState, useEffect, useRef } from 'react';
import './App.css';
import './vscode.d.ts'; // For type definitions

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
      />
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


function App() {
  const [languages, setLanguages] = useState<string[]>([]);
  const [translationsData, setTranslationsData] = useState<TranslationData[]>([]);
  // No need for [vscodeApi, setVscodeApi] state anymore, use the module-level 'vscode' directly

  const [editingCell, setEditingCell] = useState<{ key: string, lang: string, value: string, rect: DOMRect } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [newKeyInput, setNewKeyInput] = useState<string>('');

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

  const handleAddRow = () => {
    if (!newKeyInput.trim()) {
      alert('Please enter a key for the new translation row.');
      return;
    }
    // Check if key already exists
    if (translationsData.some(item => item.key === newKeyInput.trim())) {
      alert(`Key "${newKeyInput.trim()}" already exists.`);
      return;
    }

    const newTranslations: { [lang: string]: string } = {};
    languages.forEach(lang => {
      newTranslations[lang] = '';
    });

    setTranslationsData(prevData => [...prevData, { key: newKeyInput.trim(), translations: newTranslations }]);
    setNewKeyInput(''); // Clear input
    setHasUnsavedChanges(true); // Mark changes are made
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
        translationsMapForExtension[item.key] = item.translations;
    });

    vscode.postMessage({ // Use 'vscode' here
        command: 'saveAllTranslations',
        data: translationsMapForExtension,
    });
  };


  if (translationsData.length === 0) {
    return <h1>Loading translations...</h1>;
  }

  return (
    <>
      <table>
        <thead>
          <tr>
            <th>Key</th>
            {languages.map(lang => <th key={lang}>{lang}</th>)}
          </tr>
        </thead>
        <tbody>
          {translationsData.map((item) => (
            <tr key={item.key}>
              <td>{item.key}</td>
              {languages.map(lang => (
                <td key={lang} onClick={(e) => handleCellClick(item.key, lang, item.translations[lang] || '', e)}>
                  {item.translations[lang] || ''}
                </td>
              ))}
            </tr>
          ))}
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

      {/* Bottom Toolbar */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'var(--vscode-sideBar-background)', // Toolbar background
        borderTop: '1px solid var(--vscode-editorWidget-border)',
        padding: '10px 15px',
        zIndex: 10001, // Above floating dialog
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <input
          type="text"
          placeholder="New translation key"
          value={newKeyInput}
          onChange={(e) => setNewKeyInput(e.target.value)}
          style={{
            flexGrow: 1,
            padding: '5px',
            border: '1px solid var(--vscode-input-border)',
            backgroundColor: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            outline: 'none',
            borderRadius: '3px',
          }}
        />
        <button
          onClick={handleAddRow}
          style={{
            backgroundColor: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
            border: 'none',
            padding: '8px 12px',
            cursor: 'pointer',
            borderRadius: '3px',
            whiteSpace: 'nowrap',
          }}
        >
          Add Row
        </button>
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
    </>
  );
}

export default App;