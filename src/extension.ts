import * as path from 'path';
import * as vscode from 'vscode';
import { t } from './i18n';
import { toggleEncryptSelection } from './masterLock';

const AUTO_UNLOCK_TIMEOUT = 2 * 60 * 60 * 1000; // 2 часа
let unlockTimer: NodeJS.Timeout | undefined;
let statusBar: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.command = 'masterlock.toggleSelection';
    context.subscriptions.push(statusBar);

    vscode.commands.executeCommand('setContext', 'masterlock.isEncrypted', false);
    updateStatusBar(false);
    statusBar.show();
    
    checkAutoUnlock(context);

    // Проверка первого запуска
    const isFirstRun = context.globalState.get<boolean>('masterlock.firstRun', true);
    if (isFirstRun) {
        vscode.window.showInformationMessage(
            t('info_welcome'),
            "Show Demo", "GitHub", "OK"
        ).then(selection => {
            if (selection === "Show Demo") {
                vscode.commands.executeCommand('masterlock.showLogo');
            } else if (selection === "GitHub") {
                vscode.env.openExternal(vscode.Uri.parse('https://github.com/Khamit/MasterLock'));
            }
        });
        context.globalState.update('masterlock.firstRun', false);
    }

    const toggleDisposable = vscode.commands.registerCommand('masterlock.toggleSelection', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            vscode.window.showInformationMessage(t('info_select_text'));
            return;
        }

        const selectionText = editor.document.getText(editor.selection);
        const isEncrypted = selectionText.startsWith('U2FsdGVk');

        const result = await toggleEncryptSelection(!isEncrypted, context);
        if (!result) return;

        const newStatus = !isEncrypted;
        vscode.commands.executeCommand('setContext', 'masterlock.isEncrypted', newStatus);
        updateStatusBar(newStatus);
        
        if (newStatus) {
            startAutoUnlockTimer(context);
        }
    });

    context.subscriptions.push(toggleDisposable);

    const logoDisposable = vscode.commands.registerCommand('masterlock.showLogo', () => {
        const panel = vscode.window.createWebviewPanel(
            'masterlockLogo',
            'MasterLock Logo',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        const logoPath = vscode.Uri.file(
            path.join(context.extensionPath, 'resources', 'logo.png')
        );
        const logoUri = panel.webview.asWebviewUri(logoPath);

        panel.webview.html = getWebviewContent(logoUri.toString());
    });

    context.subscriptions.push(logoDisposable);
}

async function checkAutoUnlock(context: vscode.ExtensionContext) {
    const lockTime = context.workspaceState.get<number>("masterlock_lock_time");
    if (!lockTime) return;

    const now = Date.now();
    const diff = now - lockTime;

    if (diff > AUTO_UNLOCK_TIMEOUT) {
        await disableProtection(context);
    } else {
        const remaining = AUTO_UNLOCK_TIMEOUT - diff;
        unlockTimer = setTimeout(async () => {
            await disableProtection(context);
        }, remaining);
    }
}

function startAutoUnlockTimer(context: vscode.ExtensionContext) {
    if (unlockTimer) clearTimeout(unlockTimer);

    unlockTimer = setTimeout(async () => {
        const choice = await vscode.window.showWarningMessage(
            "MasterLock protection expired. Restore protection?",
            "Restore", "Disable"
        );

        if (choice === "Restore") {
            startAutoUnlockTimer(context);
        } else {
            await disableProtection(context);
        }
    }, AUTO_UNLOCK_TIMEOUT);
}

async function disableProtection(context: vscode.ExtensionContext) {
    const backup = context.workspaceState.get<string>("masterlock_backup");
    const fileUriString = context.workspaceState.get<string>("masterlock_file");
    const rangeData = context.workspaceState.get<any>("masterlock_range");

    if (backup && fileUriString && rangeData) {
        const uri = vscode.Uri.parse(fileUriString);
        const document = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(document);

        const range = new vscode.Range(
            new vscode.Position(rangeData.start.line, rangeData.start.character),
            new vscode.Position(rangeData.end.line, rangeData.end.character)
        );

        await editor.edit(editBuilder => {
            editBuilder.replace(range, backup);
        });

        const action = await vscode.window.showInformationMessage(
            t('info_auto_restored'),
            "Show File", "OK"
        );
        
        if (action === "Show File") {
            await vscode.commands.executeCommand('revealInExplorer', uri);
        }
    }

    await context.workspaceState.update("masterlock_backup", undefined);
    await context.workspaceState.update("masterlock_file", undefined);
    await context.workspaceState.update("masterlock_range", undefined);
    await context.workspaceState.update("masterlock_lock_time", undefined);

    await vscode.commands.executeCommand('setContext', 'masterlock.isEncrypted', false);
    updateStatusBar(false);
}

function updateStatusBar(isEncrypted: boolean) {
    if (isEncrypted) {
        statusBar.text = '$(lock) MasterLocked';
        statusBar.tooltip = 'Locked selection (auto-unlock in 2h)';
    } else {
        statusBar.text = '$(unlock) MasterUnlocked';
        statusBar.tooltip = 'Unlocked selection';
    }
}

export function deactivate() {
    if (statusBar) statusBar.dispose();
    if (unlockTimer) clearTimeout(unlockTimer);
}

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
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                }
                .container {
                    text-align: center;
                    padding: 2rem;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 20px;
                    backdrop-filter: blur(10px);
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
                }
                img {
                    width: 200px;
                    height: auto;
                    margin-bottom: 20px;
                    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
                }
                h1 {
                    color: white;
                    margin: 10px 0;
                    font-size: 2.5em;
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
                }
                p {
                    color: rgba(255,255,255,0.9);
                    margin: 10px 0;
                    font-size: 1.1em;
                }
                .links {
                    margin-top: 20px;
                    font-size: 0.95em;
                }
                .links a {
                    color: white;
                    text-decoration: none;
                    margin: 0 10px;
                    padding: 5px 15px;
                    border: 1px solid rgba(255,255,255,0.3);
                    border-radius: 20px;
                    transition: all 0.3s ease;
                }
                .links a:hover {
                    background: rgba(255,255,255,0.2);
                    border-color: white;
                }
                .version {
                    position: absolute;
                    bottom: 20px;
                    right: 20px;
                    color: rgba(255,255,255,0.6);
                    font-size: 0.9em;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <img src="${logoUri}" alt="MasterLock Logo" />
                <h1>MasterLock</h1>
                <p>Secure your sensitive data in JSON and .env files</p>
                <div class="links">
                    <a href="https://github.com/Khamit/MasterLock">⭐ GitHub</a>
                    <a href="https://github.com/Khamit/MasterLock/issues">🐛 Report Issue</a>
                </div>
            </div>
            <div class="version">Version 1.0.9</div>
        </body>
        </html>
    `;
}