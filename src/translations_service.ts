import * as vscode from 'vscode';
import utils from './utils';
import * as fs from 'fs';

class TranslationsService {

    public readonly allLanguages: Set<string>;
    public readonly translationsMap: Map<string, Map<string, string>>;
    private _languageToFileUriMap: Map<string, vscode.Uri>; // New: Store language to file URI mapping

    public constructor() {
        this.allLanguages = new Set<string>();
        this.translationsMap = new Map<string, Map<string, string>>();
        this._languageToFileUriMap = new Map<string, vscode.Uri>(); // Initialize
    }

    public async createTranslationsMap() {
        let allTranslationsFiles = await vscode.workspace.findFiles('**/*.arb');
        this.allLanguages.clear(); // Clear previous state
        this.translationsMap.clear();
        this._languageToFileUriMap.clear();

        for (let currentFile of allTranslationsFiles) {
            let filePath = currentFile.fsPath;
            let fileName = filePath.slice(filePath.lastIndexOf('/') + 1);

            const fileData = utils.readJsonFile(filePath);
            if (!fileName.endsWith('.arb')) {
                vscode.window.showErrorMessage('Please open a .arb file for localization editing.');
                continue;
            }

            let fileLanguage =
                new RegExp(/_(?<lan>[a-z]+)\.arb$/)
                    .exec(fileName)
                    ?.groups?.lan!;

            if (fileLanguage) { // Only add if language is successfully extracted
                this.allLanguages.add(fileLanguage);
                this._languageToFileUriMap.set(fileLanguage, currentFile); // Store the URI
            } else {
                console.warn(`Could not extract language from file: ${fileName}`);
                continue;
            }


            if (fileData == null) {
                console.log('Failed to read localization file.');
            }

            for (let key in fileData) {
                // Only process actual translation keys, ignore ARB metadata like @@locale, @key
                if (key.startsWith('@@') || key.startsWith('@')) continue;

                if (typeof fileData[key] !== 'string') continue;

                if (!this.translationsMap.has(key)) {
                    this.translationsMap.set(key, new Map<string, string>());
                }

                this.translationsMap.get(key)?.set(fileLanguage, fileData[key]);
            }
        }
    }

    public async saveAllTranslations(updatedTranslations: Map<string, Map<string, string>>): Promise<void> {
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
                    if (key.startsWith('@@') || key.startsWith('@')) { // Preserve ARB metadata
                        finalFileData[key] = existingFileData[key];
                    }
                }
                // Add or update actual translations
                for (const key in languageSpecificContent) {
                    finalFileData[key] = languageSpecificContent[key];
                }

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
