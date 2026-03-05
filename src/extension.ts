import * as path from 'path';
import * as vscode from 'vscode';
import { t } from './i18n';
import { toggleEncryptSelection } from './masterLock';

const AUTO_UNLOCK_TIMEOUT = 2 * 60 * 60 * 1000; // 2 часа
const CHECK_INTERVAL = 60 * 1000; // Проверка каждую минуту
let unlockTimer: NodeJS.Timeout | undefined;
let statusBar: vscode.StatusBarItem;
let intervalTimer: NodeJS.Timeout | undefined;

// функция активации расширения
export function activate(context: vscode.ExtensionContext) {
    console.log('MasterLock activating...');
    
    // создаем статусбар
    statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.command = 'masterlock.toggleSelection';
    context.subscriptions.push(statusBar);

    // установка контекста по умолчанию
    vscode.commands.executeCommand('setContext', 'masterlock.isEncrypted', false);
    updateStatusBar(false);
    statusBar.show();
    
    // проверка авто-разблокировки при старте
    checkAutoUnlock(context);
    
    // Запускаем периодическую проверку
    startPeriodicCheck(context);

    // тестовая команда для проверки
    const testCommand = vscode.commands.registerCommand('masterlock.test', () => {
        vscode.window.showInformationMessage('Test command works!');
    });
    context.subscriptions.push(testCommand);

    // проверка первого запуска расширения
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

    // команда переключения шифрования выделения
    const toggleDisposable = vscode.commands.registerCommand('masterlock.toggleSelection', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            vscode.window.showInformationMessage(t('info_select_text'));
            return;
        }

        const selectionText = editor.document.getText(editor.selection);
        
        // Определяем режим работы
        const isEncrypted = selectionText.includes('MLK1:'); // Проверяем наличие префикса
        const encrypt = !isEncrypted; // Если уже зашифровано - расшифровываем, иначе - шифруем
        
        console.log(`Mode: ${encrypt ? 'encrypt' : 'decrypt'}, isEncrypted: ${isEncrypted}`);
        
        const result = await toggleEncryptSelection(encrypt, context);
        if (!result) return;

        // Обновление статуса
        vscode.commands.executeCommand('setContext', 'masterlock.isEncrypted', encrypt);
        updateStatusBar(encrypt);
        
        if (encrypt) {
            await saveLockState(context, true);
            startAutoUnlockTimer(context);
        } else {
            // Очищаем таймер при расшифровке
            await clearLockState(context);
            if (unlockTimer) {
                clearTimeout(unlockTimer);
                unlockTimer = undefined;
            }
        }
    });
    context.subscriptions.push(toggleDisposable);

    // команда показа логотипа
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
    
    // Подписываемся на закрытие VS Code
    context.subscriptions.push({
        dispose: () => {
            // Сохраняем время закрытия
            if (unlockTimer) {
                const lockTime = context.workspaceState.get<number>("masterlock_lock_time");
                if (lockTime) {
                    context.globalState.update("masterlock_last_close", Date.now());
                }
            }
        }
    });
}

// Сохранить состояние блокировки
async function saveLockState(context: vscode.ExtensionContext, isLocked: boolean) {
    await context.globalState.update("masterlock_was_locked", isLocked);
    if (isLocked) {
        await context.globalState.update("masterlock_lock_start", Date.now());
    }
}

// Очистить состояние блокировки
async function clearLockState(context: vscode.ExtensionContext) {
    await context.globalState.update("masterlock_was_locked", false);
    await context.globalState.update("masterlock_lock_start", undefined);
    await context.globalState.update("masterlock_last_close", undefined);
}

// Запустить периодическую проверку
function startPeriodicCheck(context: vscode.ExtensionContext) {
    if (intervalTimer) clearInterval(intervalTimer);
    
    intervalTimer = setInterval(async () => {
        await checkAndRestoreIfNeeded(context);
    }, CHECK_INTERVAL);
    
    context.subscriptions.push({ dispose: () => {
        if (intervalTimer) clearInterval(intervalTimer);
    }});
}

// Проверка и восстановление если нужно
async function checkAndRestoreIfNeeded(context: vscode.ExtensionContext) {
    const lockTime = context.workspaceState.get<number>("masterlock_lock_time");
    if (!lockTime) return;
    
    const now = Date.now();
    const diff = now - lockTime;
    
    if (diff > AUTO_UNLOCK_TIMEOUT) {
        console.log('Auto-unlock timeout reached, restoring...');
        await disableProtection(context);
        await clearLockState(context);
        
        vscode.window.showInformationMessage(
            '🔓 MasterLock: Files were automatically unlocked after 2 hours'
        );
    }
}

// проверка авто-разблокировки при старте
async function checkAutoUnlock(context: vscode.ExtensionContext) {
    console.log('Checking auto-unlock on startup...');
    
    // Проверяем, было ли расширение закрыто с активной блокировкой
    const wasLocked = context.globalState.get<boolean>("masterlock_was_locked", false);
    const lastClose = context.globalState.get<number>("masterlock_last_close");
    const lockStart = context.globalState.get<number>("masterlock_lock_start");
    const lockTime = context.workspaceState.get<number>("masterlock_lock_time");
    
    if (wasLocked && lastClose && lockStart && lockTime) {
        const timePassed = Date.now() - lockStart;
        const remaining = AUTO_UNLOCK_TIMEOUT - timePassed;
        
        console.log(`Session was closed with active lock. Time passed: ${timePassed/1000/60} minutes`);
        
        if (timePassed >= AUTO_UNLOCK_TIMEOUT) {
            // Уже прошло 2 часа, расшифровываем
            console.log('Auto-unlock timeout reached during closed session');
            await disableProtection(context);
            await clearLockState(context);
            
            vscode.window.showInformationMessage(
                '🔓 MasterLock: Files were automatically unlocked while VS Code was closed'
            );
        } else {
            // Еще не прошло 2 часа, возобновляем таймер
            console.log(`Resuming auto-unlock timer. Remaining: ${remaining/1000/60} minutes`);
            
            // Восстанавливаем состояние
            await context.workspaceState.update("masterlock_lock_time", lockTime);
            
            unlockTimer = setTimeout(async () => {
                const choice = await vscode.window.showWarningMessage(
                    "MasterLock protection expired. Restore protection?",
                    "Restore", "Disable"
                );
                
                if (choice === "Restore") {
                    startAutoUnlockTimer(context);
                } else {
                    await disableProtection(context);
                    await clearLockState(context);
                }
            }, remaining);
            
            // Обновляем статус бар
            vscode.commands.executeCommand('setContext', 'masterlock.isEncrypted', true);
            updateStatusBar(true);
        }
    }
    
    // Стандартная проверка
    if (!lockTime) return;
    
    const now = Date.now();
    const diff = now - lockTime;
    
    if (diff > AUTO_UNLOCK_TIMEOUT) {
        await disableProtection(context);
        await clearLockState(context);
        
        vscode.window.showInformationMessage(
            '🔓 MasterLock: Files were automatically unlocked'
        );
    } else {
        const remaining = AUTO_UNLOCK_TIMEOUT - diff;
        console.log(`Auto-unlock timer active. Remaining: ${remaining/1000/60} minutes`);
        
        unlockTimer = setTimeout(async () => {
            await disableProtection(context);
            await clearLockState(context);
            
            vscode.window.showInformationMessage(
                '🔓 MasterLock: Files were automatically unlocked'
            );
        }, remaining);
    }
}

// таймер авто-разблокировки после шифрования
function startAutoUnlockTimer(context: vscode.ExtensionContext) {
    if (unlockTimer) clearTimeout(unlockTimer);

    unlockTimer = setTimeout(async () => {
        const choice = await vscode.window.showWarningMessage(
            "⏰ MasterLock: 2 hours have passed. Restore protection for another 2 hours?",
            "Restore (another 2h)", "Unlock Now"
        );

        if (choice === "Restore (another 2h)") {
            // Обновляем время блокировки
            await context.workspaceState.update("masterlock_lock_time", Date.now());
            await context.globalState.update("masterlock_lock_start", Date.now());
            startAutoUnlockTimer(context);
            
            vscode.window.showInformationMessage(
                '🔒 MasterLock: Protection extended for another 2 hours'
            );
        } else {
            await disableProtection(context);
            await clearLockState(context);
            
            vscode.window.showInformationMessage(
                '🔓 MasterLock: Files were unlocked'
            );
        }
    }, AUTO_UNLOCK_TIMEOUT);
}

// функция восстановления текста из backup при авто-разблокировке
async function disableProtection(context: vscode.ExtensionContext) {
    console.log('Disabling protection...');
    
    const backup = context.workspaceState.get<string>("masterlock_backup");
    const fileUriString = context.workspaceState.get<string>("masterlock_file");
    const rangeData = context.workspaceState.get<any>("masterlock_range");

    if (backup && fileUriString && rangeData) {
        try {
            const uri = vscode.Uri.parse(fileUriString);
            
            // Проверяем, открыт ли файл
            const document = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(document, { preview: false, preserveFocus: true });

            const range = new vscode.Range(
                new vscode.Position(rangeData.start.line, rangeData.start.character),
                new vscode.Position(rangeData.end.line, rangeData.end.character)
            );

            await editor.edit(editBuilder => {
                editBuilder.replace(range, backup);
            });

            // Показываем уведомление
            const action = await vscode.window.showInformationMessage(
                '🔓 MasterLock: Files automatically unlocked',
                "Show File", "OK"
            );
            
            if (action === "Show File") {
                await vscode.commands.executeCommand('revealInExplorer', uri);
            }
            
        } catch (err) {
            console.error('Error during auto-unlock:', err);
            vscode.window.showErrorMessage(
                'Failed to auto-unlock files. Please check logs.'
            );
        }
    }

    // очистка всех временных данных
    await context.workspaceState.update("masterlock_backup", undefined);
    await context.workspaceState.update("masterlock_file", undefined);
    await context.workspaceState.update("masterlock_range", undefined);
    await context.workspaceState.update("masterlock_lock_time", undefined);

    await vscode.commands.executeCommand('setContext', 'masterlock.isEncrypted', false);
    updateStatusBar(false);
}

// обновление статус-бара
function updateStatusBar(isEncrypted: boolean) {
    if (!statusBar) return;
    
    if (isEncrypted) {
        statusBar.text = '$(lock) MasterLocked';
        statusBar.tooltip = '🔒 Locked (auto-unlock in 2h)';
        statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
        statusBar.text = '$(unlock) MasterUnlocked';
        statusBar.tooltip = '🔓 Unlocked';
        statusBar.backgroundColor = undefined;
    }
    statusBar.show();
}

// деактивация расширения
export function deactivate() {
    console.log('MasterLock deactivating...');
    
    if (statusBar) statusBar.dispose();
    if (unlockTimer) clearTimeout(unlockTimer);
    if (intervalTimer) clearInterval(intervalTimer);
}

// HTML контент для вебвью с логотипом
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
                <p style="font-size: 0.9em; opacity: 0.8;">Auto-unlock after 2 hours ⏰</p>
                <div class="links">
                    <a href="https://github.com/Khamit/MasterLock">⭐ GitHub</a>
                    <a href="https://github.com/Khamit/MasterLock/issues">🐛 Report Issue</a>
                </div>
            </div>
            <div class="version">Version 1.0.10</div>
        </body>
        </html>
    `;
}