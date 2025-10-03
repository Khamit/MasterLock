import * as vscode from 'vscode';
import { t } from './i18n';
import { toggleEncryptSelection } from './masterLock';

let statusBar: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    // создаём status bar item
    statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.command = 'masterlock.toggleSelection';
    context.subscriptions.push(statusBar);

    // инициализация КоньТекста)
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
            // Показываем уведомления только при отмене операции
            // Where is the error message?
            return;
        }

        const newStatus = !isEncrypted;
        vscode.commands.executeCommand('setContext', 'masterlock.isEncrypted', newStatus);
        updateStatusBar(newStatus);
        
        // Показываем информационное сообщение об успешной операции
        // there is my notification)) i hope .. 
        if (newStatus) {
            vscode.window.showInformationMessage(t('info_encrypted'));
        } else {
            vscode.window.showInformationMessage(t('info_decrypted'));
        }
    });

    context.subscriptions.push(toggleDisposable);
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

// so i cant add icons or text changing for locked/unlocked state

// npm install
// npx tsc
// code .
// F5

// --- IGNORE ---
// --- IGNORE ---