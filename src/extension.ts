import * as vscode from 'vscode';
import { TranslationsPanel } from './translations_panel';

// Activate function is called when the extension is activated
export function activate(context: vscode.ExtensionContext) {
	// Register a command to open the localization file
	let disposable = vscode.commands.registerCommand('flutter-intl-editor.openLocalizationFile', async () => {
		if (vscode.workspace == null) {
			vscode.window.showErrorMessage('You should open a project first');
			return;
		}
	
		TranslationsPanel.createOrShow(context.extensionUri);
	});

	context.subscriptions.push(disposable);
}
