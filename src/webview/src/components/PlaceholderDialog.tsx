import { useState } from 'react';
import type { PlaceholderDialogProps } from '../types';

export default function PlaceholderDialog({ translationKey, placeholder, existingMeta, onSave, onClose }: PlaceholderDialogProps) {
  const [type, setType] = useState(existingMeta?.type || 'String');
  const [example, setExample] = useState(existingMeta?.example || '');

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10002, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: 'var(--vscode-editor-background)', padding: '20px', border: '1px solid var(--vscode-editorWidget-border)', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '15px', minWidth: '350px', borderRadius: '4px' }}>
        <h3 style={{ margin: 0, color: 'var(--vscode-editorForeground)' }}>
          Edit Placeholder: <span style={{ fontFamily: 'monospace', color: 'var(--vscode-textPreformat-foreground)' }}>{placeholder}</span>
        </h3>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '13px' }}>
          Type:
          <select value={type} onChange={e => setType(e.target.value)}
            style={{ padding: '6px', backgroundColor: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)', outline: 'none' }}>
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
          <input type="text" value={example} onChange={e => setExample(e.target.value)} placeholder="e.g. John Doe"
            style={{ padding: '6px', backgroundColor: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)', outline: 'none' }} />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '5px' }}>
          <button onClick={onClose}
            style={{ padding: '6px 12px', backgroundColor: 'var(--vscode-button-secondary-background)', color: 'var(--vscode-button-secondary-foreground)', border: 'none', cursor: 'pointer', borderRadius: '2px' }}>
            Cancel
          </button>
          <button onClick={() => onSave(translationKey, placeholder, { type, example })}
            style={{ padding: '6px 12px', backgroundColor: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)', border: 'none', cursor: 'pointer', borderRadius: '2px' }}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
