import * as vscode from 'vscode';
import utils from './utils';
import * as fs from 'fs';
import * as path from 'path';

class TranslationsService {

    public readonly allLanguages: Set<string>;
    public readonly translationsMap: Map<string, Map<string, string>>;
    public readonly metadataMap: Map<string, any>;
    private _languageToFileUriMap: Map<string, vscode.Uri>; // New: Store language to file URI mapping

    public constructor() {
        this.allLanguages = new Set<string>();
        this.translationsMap = new Map<string, Map<string, string>>();
        this.metadataMap = new Map<string, any>();
        this._languageToFileUriMap = new Map<string, vscode.Uri>(); // Initialize
    }

    private async _discoverArbFiles(): Promise<{ uri: vscode.Uri, language: string, isTemplate: boolean }[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) return [];

        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const l10nYamlPath = path.join(workspaceRoot, 'l10n.yaml');
        
        let arbDir = '';
        let templateArbFile = '';
        let hasL10nYaml = false;

        if (fs.existsSync(l10nYamlPath)) {
            hasL10nYaml = true;
            try {
                const yamlContent = fs.readFileSync(l10nYamlPath, 'utf8');
                const arbDirMatch = yamlContent.match(/^arb-dir\s*:\s*(.+)$/m);
                if (arbDirMatch && arbDirMatch[1]) {
                    arbDir = arbDirMatch[1].trim();
                }
                const templateMatch = yamlContent.match(/^template-arb-file\s*:\s*(.+)$/m);
                if (templateMatch && templateMatch[1]) {
                    templateArbFile = templateMatch[1].trim();
                }
            } catch (e) {
                console.warn('Failed to parse l10n.yaml', e);
            }
        }

        let searchPattern = '';
        if (hasL10nYaml && arbDir) {
            // Clean up arbDir to avoid leading slashes in glob
            const cleanArbDir = arbDir.replace(/^\/+/, '');
            searchPattern = `${cleanArbDir}/**/*.arb`;
        } else {
            // Fallback discovery
            const l10nFiles = await vscode.workspace.findFiles('lib/l10n/**/*.arb');
            if (l10nFiles.length > 0) return this._processDiscoveredFiles(l10nFiles, templateArbFile);
            
            const intlFiles = await vscode.workspace.findFiles('lib/intl/**/*.arb');
            if (intlFiles.length > 0) return this._processDiscoveredFiles(intlFiles, templateArbFile);

            searchPattern = '**/*.arb';
        }

        const files = await vscode.workspace.findFiles(searchPattern);
        return this._processDiscoveredFiles(files, templateArbFile);
    }

    private _processDiscoveredFiles(files: vscode.Uri[], templateArbFile: string): { uri: vscode.Uri, language: string, isTemplate: boolean }[] {
        const results: { uri: vscode.Uri, language: string, isTemplate: boolean }[] = [];
        
        for (const file of files) {
            const filePath = file.fsPath;
            const fileName = path.basename(filePath);
            if (!fileName.endsWith('.arb')) continue;

            let isTemplate = false;
            if (templateArbFile && fileName === templateArbFile) {
                isTemplate = true;
            }

            // Extract locale using robust regex
            // Matches: app_en.arb -> en | app_en_US.arb -> en_US | app_zh_Hant.arb -> zh_Hant
            const localeMatch = fileName.match(/_([a-z]{2}(?:_[A-Z]{2}|_[A-Z][a-z]{3})?)\.arb$/);
            
            let language = '';
            if (localeMatch && localeMatch[1]) {
                language = localeMatch[1];
            } else {
                // No locale suffix. Must be the template file (e.g. app.arb)
                isTemplate = true;
                // Try reading @@locale from file
                try {
                    const fileData = utils.readJsonFile(filePath);
                    if (fileData && typeof fileData['@@locale'] === 'string') {
                        language = fileData['@@locale'];
                    }
                } catch (e) {}
                if (!language) language = 'en'; // ultimate fallback
            }

            results.push({ uri: file, language, isTemplate });
        }

        // Sort so template is explicitly handled or optionally track it
        return results;
    }

    public async createTranslationsMap() {
        this.allLanguages.clear(); // Clear previous state
        this.translationsMap.clear();
        this.metadataMap.clear();
        this._languageToFileUriMap.clear();

        const discoveredFiles = await this._discoverArbFiles();

        for (let item of discoveredFiles) {
            let filePath = item.uri.fsPath;
            let fileLanguage = item.language;

            const fileData = utils.readJsonFile(filePath);
            if (fileData == null) {
                console.log(`Failed to read localization file: ${filePath}`);
                continue;
            }

            this.allLanguages.add(fileLanguage);
            this._languageToFileUriMap.set(fileLanguage, item.uri);

            for (let key in fileData) {
                // Ignore global metadata
                if (key.startsWith('@@')) continue;

                // Handle key-specific metadata
                if (key.startsWith('@')) {
                    const actualKey = key.slice(1);
                    // Usually we take the first we find, or we could merge. 
                    // Taking the first is fine because they should be identical across files if present.
                    if (!this.metadataMap.has(actualKey)) {
                        this.metadataMap.set(actualKey, fileData[key]);
                    }
                    continue;
                }

                if (typeof fileData[key] !== 'string') continue;

                if (!this.translationsMap.has(key)) {
                    this.translationsMap.set(key, new Map<string, string>());
                }

                this.translationsMap.get(key)?.set(fileLanguage, fileData[key]);
            }
        }
    }

    public async saveAllTranslations(
        updatedTranslations: Map<string, Map<string, string>>,
        updatedMetadata?: Map<string, any>
    ): Promise<void> {
        // Iterate through each language known
        for (const language of this.allLanguages) {
            const fileUri = this._languageToFileUriMap.get(language);
            if (!fileUri) {
                throw new Error(`File URI not found for language: ${language}. Cannot save.`);
            }

            // Construct the new content for the current language's .arb file
            const languageSpecificContent: { [key: string]: string } = {};
            updatedTranslations.forEach((translationMapForKey, key) => {
                const valueForLang = translationMapForKey.get(language);
                if (valueForLang !== undefined) {
                    languageSpecificContent[key] = valueForLang;
                }
            });

            try {
                // Read existing content to preserve metadata like @@locale, _description etc.
                let existingFileData = utils.readJsonFile(fileUri.fsPath);
                if (!existingFileData) {
                    existingFileData = {};
                }

                // Merge existing metadata with new translation values
                const finalFileData: { [key: string]: string | object } = {};
                for (const key in existingFileData) {
                    if (key.startsWith('@@')) { // Preserve global ARB metadata only
                        finalFileData[key] = existingFileData[key];
                    }
                }
                
                // Add or update actual translations and their metadata
                updatedTranslations.forEach((translationMapForKey, key) => {
                    const valueForLang = translationMapForKey.get(language);
                    if (valueForLang !== undefined) {
                        finalFileData[key] = valueForLang;
                        
                        if (updatedMetadata && updatedMetadata.has(key)) {
                            const meta = updatedMetadata.get(key);
                            if (meta && Object.keys(meta).length > 0) {
                                finalFileData[`@${key}`] = meta;
                            }
                        } else if (existingFileData[`@${key}`]) {
                            // Preserve existing metadata if no updated metadata was provided
                            finalFileData[`@${key}`] = existingFileData[`@${key}`];
                        }
                    }
                });

                // Write the updated content back to the file
                fs.writeFileSync(fileUri.fsPath, JSON.stringify(finalFileData, null, 2));
            } catch (error: any) {
                console.error(`Error saving translations for language ${language}: ${error.message}`);
                throw new Error(`Failed to save for ${language}: ${error.message}`);
            }
        }
    }
}

export {
    TranslationsService
}
