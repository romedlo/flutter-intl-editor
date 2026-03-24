
import * as vscode from 'vscode';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { TranslationsService } from './translations_service';

class TranslationsPanel {
    public static currentPanel: TranslationsPanel | undefined;

    public static readonly viewType = 'translations';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    private readonly translationsService: TranslationsService;

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this.translationsService = new TranslationsService();

        this._update(); // Set initial HTML

        this._loadAndSendTranslations();

        this._panel.onDidDispose(() => this._dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async message => { // Mark as async
                switch (message.command) {
                    case 'reload':
                        this._loadAndSendTranslations();
                        break;
                    case 'unsaved-changes':
                        this._panel.title = message.data ? 'Flutter Intl •' : 'Flutter Intl';
                        break;
                    case 'saveAllTranslations':
                        const isNewFormat = message.data && message.data.translations !== undefined;
                        const receivedTranslationsObject = isNewFormat ? message.data.translations : message.data;
                        const receivedMetadataObject = isNewFormat ? message.data.metadata : undefined;

                        const translationsMapForService = new Map<string, Map<string, string>>();
                        for (const key in receivedTranslationsObject) {
                            if (Object.prototype.hasOwnProperty.call(receivedTranslationsObject, key)) {
                                const langMapObject = receivedTranslationsObject[key];
                                const innerMap = new Map<string, string>();
                                for (const lang in langMapObject) {
                                    if (Object.prototype.hasOwnProperty.call(langMapObject, lang)) {
                                        innerMap.set(lang, langMapObject[lang]);
                                    }
                                }
                                translationsMapForService.set(key, innerMap);
                            }
                        }
                        
                        let metadataMapForService: Map<string, any> | undefined;
                        if (receivedMetadataObject) {
                            metadataMapForService = new Map<string, any>();
                            for (const key in receivedMetadataObject) {
                                if (Object.prototype.hasOwnProperty.call(receivedMetadataObject, key)) {
                                    metadataMapForService.set(key, receivedMetadataObject[key]);
                                }
                            }
                        }

                        try {
                            await this.translationsService.saveAllTranslations(translationsMapForService, metadataMapForService);
                            this._panel.webview.postMessage({ command: 'save-success' });
                            vscode.window.showInformationMessage('Translations saved successfully!'); // Show info in VS Code
                            
                            // Automatically run flutter pub get to regenerate dart models
                            const workspaceFolders = vscode.workspace.workspaceFolders;
                            if (workspaceFolders && workspaceFolders.length > 0) {
                                const cwd = workspaceFolders[0].uri.fsPath;
                                exec('flutter pub get', { cwd }, (err) => {
                                    if (err) {
                                        vscode.window.showWarningMessage(`Failed to run 'flutter pub get': ${err.message}`);
                                    } else {
                                        vscode.window.showInformationMessage('Flutter generated localization files successfully.');
                                    }
                                });
                            }
                        } catch (error: any) {
                            this._panel.webview.postMessage({ command: 'save-error' });
                            vscode.window.showErrorMessage(`Failed to save translations: ${error.message}`); // Show error in VS Code
                        }
                        return;

                    case 'alert':
                        vscode.window.showErrorMessage(message.text);
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    private _loadAndSendTranslations() {
        this.translationsService.createTranslationsMap().then(() => {
            const translations = this.translationsService.translationsMap;
            const serializableTranslations: { [key: string]: { [lang: string]: string } } = {};
            translations.forEach((value, key) => {
                serializableTranslations[key] = Object.fromEntries(value);
            });

            const metadata = this.translationsService.metadataMap;
            const serializableMetadata: { [key: string]: any } = {};
            metadata.forEach((value, key) => {
                serializableMetadata[key] = value;
            });

            this._panel.webview.postMessage({
                command: 'initial-data',
                data: {
                    languages: Array.from(this.translationsService.allLanguages),
                    translations: serializableTranslations,
                    metadata: serializableMetadata
                }
            });
        }).catch(e => {
            this._panel.webview.postMessage({
                command: 'load-error',
                data: e instanceof Error ? e.message : String(e)
            });
        });
    }

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (TranslationsPanel.currentPanel) {
            TranslationsPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            TranslationsPanel.viewType,
            'Translations',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'src', 'webview', 'dist')
                ],
                retainContextWhenHidden: true
            }
        );

        TranslationsPanel.currentPanel = new TranslationsPanel(panel, extensionUri);
    }

    private _update() {
        try {
            this._panel.webview.html = this._getHtmlForWebview();
        } catch (e) {
            if (e instanceof Error) {
                if ((e as any).code === 'ENOENT') {
                    vscode.window.showErrorMessage("Webview content not found. Please run 'npm run build' in the 'src/webview' directory.");
                    this._panel.webview.html = `<h1>Error</h1><p>Webview content not found. Please run 'npm run build' in the 'src/webview' directory.</p><p>Error details: ${e.message}</p>`;
                } else {
                    vscode.window.showErrorMessage(`An error occurred: ${e.message}`);
                    this._panel.webview.html = `<h1>Error</h1><p>${e.message}</p>`;
                }
            } else {
                vscode.window.showErrorMessage(`An unknown error occurred: ${e}`);
            }
        }
    }

    private _getHtmlForWebview(): string {
        const webviewDistPath = vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'dist');
        const webviewDistUri = this._panel.webview.asWebviewUri(webviewDistPath);

        const indexPath = path.join(webviewDistPath.fsPath, 'index.html');
        let indexHtml = fs.readFileSync(indexPath, 'utf8');
        
        // Inject base tag to resolve all relative URLs, making Vite's base: './' work perfectly
        indexHtml = indexHtml.replace('<head>', `<head>\n    <base href="${webviewDistUri}/">`);
        
        // Keep the old regex just in case it's still generating absolute paths somewhere
        indexHtml = indexHtml.replace(/(href|src)="\/assets\//g, `$1="${webviewDistUri}/assets/`);
        
        return indexHtml;
    }

    private _dispose() {
        TranslationsPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}

export {
    TranslationsPanel
};
