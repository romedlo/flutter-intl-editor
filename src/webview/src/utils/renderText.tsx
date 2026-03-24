import React from 'react';

export function renderNormalText(text: string, filterStr: string, spellChecker: any): React.ReactNode {
  if (!text) return null;

  let parts: { text: string; isFilterMatch: boolean }[] = [{ text, isFilterMatch: false }];
  if (filterStr.trim()) {
    const regex = new RegExp(`(${filterStr})`, 'gi');
    parts = text.split(regex).map(part => ({
      text: part,
      isFilterMatch: regex.test(part),
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
                wordRegex.lastIndex = 0;
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

export function renderTranslationText(
  text: string,
  currentKey: string,
  metadata: any,
  filterStr: string,
  spellChecker: any,
  onPlaceholderClick: (key: string, placeholder: string) => void
): React.ReactNode {
  if (!text) return text;

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
                border: `1px solid ${isDefined ? 'var(--vscode-editor-snippetFinalTabstopHighlightBorder, transparent)' : 'var(--vscode-editorError-border, transparent)'}`,
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
