export interface TranslationData {
  key: string;
  translations: { [lang: string]: string };
}

export interface FloatingDialogProps {
  currentKey: string;
  currentLang: string;
  initialValue: string;
  onAccept: (key: string, lang: string, newValue: string) => void;
  onDiscard: () => void;
  rect: DOMRect;
}

export interface PlaceholderDialogProps {
  translationKey: string;
  placeholder: string;
  existingMeta: any;
  onSave: (translationKey: string, placeholder: string, meta: any) => void;
  onClose: () => void;
}

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}
