import nspell from 'nspell';

const loaders: Record<string, { aff: string; dic: string; instance: any | null; loading: Promise<any> | null }> = {
  en: { aff: 'dictionaries/en.aff', dic: 'dictionaries/en.dic', instance: null, loading: null },
  es: { aff: 'dictionaries/es.aff', dic: 'dictionaries/es.dic', instance: null, loading: null },
  fr: { aff: 'dictionaries/fr.aff', dic: 'dictionaries/fr.dic', instance: null, loading: null },
};

export async function getSpellChecker(langCode: string) {
  const baseLang = langCode.split('_')[0]; // simple fallback
  const loader = loaders[baseLang];
  if (!loader) {
    return null; // Not supported or fallback to nothing
  }
  
  if (loader.instance) {
    return loader.instance;
  }
  
  if (loader.loading) {
    return loader.loading;
  }
  
  loader.loading = Promise.all([
    fetch(loader.aff).then(r => r.text()),
    fetch(loader.dic).then(r => r.text())
  ]).then(([aff, dic]) => {
    try {
      loader.instance = nspell(aff, dic);
      return loader.instance;
    } catch (e) {
      console.error('Failed to initialize nspell for', baseLang, e);
      return null;
    }
  });

  return loader.loading;
}
