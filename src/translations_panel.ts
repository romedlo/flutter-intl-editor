
import * as vscode from 'vscode';
import fs from 'fs';
import path from 'path';
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

        this.translationsService.createTranslationsMap().then(() => {
            const translations = this.translationsService.translationsMap;
            const serializableTranslations: { [key: string]: { [lang: string]: string } } = {};
            translations.forEach((value, key) => {
                serializableTranslations[key] = Object.fromEntries(value);
            });

            this._panel.webview.postMessage({
                command: 'initial-data',
                data: {
                    languages: Array.from(this.translationsService.allLanguages),
                    translations: serializableTranslations
                }
            });
        });

        this._panel.onDidDispose(() => this._dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async message => { // Mark as async
                switch (message.command) {
                    case 'saveAllTranslations':
                        const receivedTranslationsObject = message.data; // { key: { lang: value } }

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

                        try {
                            await this.translationsService.saveAllTranslations(translationsMapForService);
                            this._panel.webview.postMessage({ command: 'save-success' });
                            vscode.window.showInformationMessage('Translations saved successfully!'); // Show info in VS Code
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
                ]
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
        
        // Update resource paths to work in the webview
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
