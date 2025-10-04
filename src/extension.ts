import * as vscode from 'vscode';
import { t } from './i18n';
import { toggleEncryptSelection } from './masterLock';
import * as path from 'path';

let statusBar: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    // создаём status bar item
    statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.command = 'masterlock.toggleSelection';
    context.subscriptions.push(statusBar);

    // инициализация контекста
    vscode.commands.executeCommand('setContext', 'masterlock.isEncrypted', false);
    updateStatusBar(false);
    statusBar.show();

    // команда переключения
    const toggleDisposable = vscode.commands.registerCommand('masterlock.toggleSelection', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            vscode.window.showInformationMessage(t('info_select_text'));
            return;
        }

        const selectionText = editor.document.getText(editor.selection);
        const isEncrypted = selectionText.includes('U2FsdGVk'); // простая проверка CryptoJS

        const result = await toggleEncryptSelection(!isEncrypted);
        if (!result) {
            return;
        }

        const newStatus = !isEncrypted;
        vscode.commands.executeCommand('setContext', 'masterlock.isEncrypted', newStatus);
        updateStatusBar(newStatus);
        
        if (newStatus) {
            vscode.window.showInformationMessage(t('info_encrypted'));
        } else {
            vscode.window.showInformationMessage(t('info_decrypted'));
        }
    });

    context.subscriptions.push(toggleDisposable);

    // команда для открытия webview с логотипом
    const logoDisposable = vscode.commands.registerCommand('masterlock.showLogo', () => {
        const panel = vscode.window.createWebviewPanel(
            'masterlockLogo',
            'MasterLock Logo',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        // путь до ресурса (logo.svg в resources/)
        const logoPath = vscode.Uri.file(
            path.join(context.extensionPath, 'resources', 'logo.svg')
        );
        const logoUri = panel.webview.asWebviewUri(logoPath);

        panel.webview.html = getWebviewContent(logoUri.toString());
    });

    context.subscriptions.push(logoDisposable);
}

function updateStatusBar(isEncrypted: boolean) {
    if (isEncrypted) {
        statusBar.text = '$(lock) MasterLocked';
        statusBar.tooltip = 'Locked selection';
    } else {
        statusBar.text = '$(unlock) MasterUnlocked';
        statusBar.tooltip = 'Unlocked selection';
    }
}

export function deactivate() {
    if (statusBar) statusBar.dispose();
}

// отдельная функция для html содержимого
function getWebviewContent(logoUri: string): string {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>MasterLock Logo</title>
            <style>
                body {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    background: #1e1e1e;
                }
                img {
                    width: 200px;
                    height: auto;
                }
            </style>
        </head>
        <body>
            <img src="${logoUri}" alt="MasterLock Logo" />
        </body>
        </html>
    `;
}
