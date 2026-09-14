import * as path from 'path';
import * as vscode from 'vscode';
import { t } from './i18n';
import { toggleEncryptSelection, changePassword } from './masterLock';
import * as fs from 'fs';

const AUTO_UNLOCK_TIMEOUT = 2 * 60 * 60 * 1000; // 2 часа
const CHECK_INTERVAL = 60 * 1000; // Проверка каждую минуту
let unlockTimer: NodeJS.Timeout | undefined;
let statusBar: vscode.StatusBarItem;
let intervalTimer: NodeJS.Timeout | undefined;
let isDisabling = false;
// читаем версию один раз:
let extensionVersion = 'unknown';
// Глобальная переменная для активного webview (для обновления таймера)
let activeDashboard: vscode.WebviewPanel | undefined;



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
                vscode.commands.executeCommand('masterlock.dashboard');
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
            // Очищаем все данные при ручной расшифровке
            await context.workspaceState.update("masterlock_backup", undefined);
            await context.workspaceState.update("masterlock_file", undefined);
            await context.workspaceState.update("masterlock_range", undefined);
            await context.workspaceState.update("masterlock_lock_time", undefined);
            await clearLockState(context);
            if (unlockTimer) {
                clearTimeout(unlockTimer);
                unlockTimer = undefined;
            }
        }
    });
    context.subscriptions.push(toggleDisposable);

// ═══════════════════════════════════════════════════════════
// КОМАНДА: Открываем Dashboard (бывший showLogo)
// ═══════════════════════════════════════════════════════════
const dashboardDisposable = vscode.commands.registerCommand('masterlock.dashboard', async () => {
    const logoPath = path.join(context.extensionPath, 'resources', 'logo.png');
    
    let hasLogo = false;
    try {
        await vscode.workspace.fs.stat(vscode.Uri.file(logoPath));
        hasLogo = true;
    } catch {
        // логотипа нет
    }

    const packageJsonPath = path.join(context.extensionPath, 'package.json');
    try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        extensionVersion = pkg.version;
    } catch (err) {
        console.error('Failed to read package.json:', err);
    }

    // Закрываем предыдущий dashboard если он есть
    if (activeDashboard) {
        activeDashboard.dispose();
    }

    const panel = vscode.window.createWebviewPanel(
        'masterlockDashboard',
        'MasterLock Dashboard',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true  //  Сохраняем JS состояние при переключении вкладок
        }
    );

    activeDashboard = panel;

    // ═══════════════════════════════════════════════════════════
    // Обработчик сообщений от webview
    // ═══════════════════════════════════════════════════════════
    panel.webview.onDidReceiveMessage(async (message) => {
        switch (message.command) {
            case 'extendTimer':
                // Продлеваем на 2 часа
                await context.workspaceState.update("masterlock_lock_time", Date.now());
                await context.globalState.update("masterlock_lock_start", Date.now());
                await saveLockState(context, true);
                startAutoUnlockTimer(context);
                vscode.window.showInformationMessage('MasterLock: Protection extended for another 2 hours');
                // Отправляем обновлённое состояние обратно
                panel.webview.postMessage({
                    command: 'stateUpdate',
                    state: getDashboardState(context)
                });
                break;

            case 'unlockNow':
                if (isDisabling) return;
                await disableProtection(context);
                await clearLockState(context);
                panel.webview.postMessage({
                    command: 'stateUpdate',
                    state: getDashboardState(context)
                });
                break;

            case 'changePassword':
                await changePassword(context);
                // Обновляем дату смены
                panel.webview.postMessage({
                    command: 'stateUpdate',
                    state: getDashboardState(context)
                });
                break;
        }
    }, undefined, context.subscriptions);

    panel.onDidDispose(() => {
        activeDashboard = undefined;
    }, null, context.subscriptions);

    // ═══════════════════════════════════════════════════════════
    // Рендерим HTML с актуальным состоянием
    // ═══════════════════════════════════════════════════════════
    const state = getDashboardState(context);
    const finalLogoUri = hasLogo
        ? panel.webview.asWebviewUri(vscode.Uri.file(logoPath)).toString()
        : '';
    
    panel.webview.html = getDashboardContent(finalLogoUri, extensionVersion, state);
});
context.subscriptions.push(dashboardDisposable);

// ═══════════════════════════════════════════════════════════
// АЛИАС: masterlock.showLogo → masterlock.dashboard (обратная совместимость)
// ═══════════════════════════════════════════════════════════
const showLogoAlias = vscode.commands.registerCommand('masterlock.showLogo', async () => {
    await vscode.commands.executeCommand('masterlock.dashboard');
});
context.subscriptions.push(showLogoAlias);

// ═══════════════════════════════════════════════════════════
// Автономная команда смены пароля (через палитру команд)
// ═══════════════════════════════════════════════════════════
const changePasswordDisposable = vscode.commands.registerCommand('masterlock.changePassword', async () => {
    await changePassword(context);
});
context.subscriptions.push(changePasswordDisposable);
    
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
    await context.workspaceState.update("masterlock_lock_time", undefined);
}

// ═══════════════════════════════════════════════════════════
// Собираем состояние для Dashboard
// ═══════════════════════════════════════════════════════════
function getDashboardState(context: vscode.ExtensionContext) {
    const lockTime = context.workspaceState.get<number>("masterlock_lock_time");
    const isEncrypted = !!lockTime;
    
    let remainingMs = 0;
    if (lockTime) {
        remainingMs = Math.max(0, AUTO_UNLOCK_TIMEOUT - (Date.now() - lockTime));
    }

    return {
        isEncrypted,
        lockStartTime: lockTime || null,
        remainingMs,
        autoUnlockTimeoutMs: AUTO_UNLOCK_TIMEOUT,
        passwordChangedAt: context.globalState.get<number>("masterlock_password_changed_at") || null,
        hasPassword: true  // Мы не можем точно проверить, не открывая secrets
    };
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
    if (isDisabling) {
        console.log('Periodic check: disabled, skipping');
        return;
    }
    
    const lockTime = context.workspaceState.get<number>("masterlock_lock_time");
    if (!lockTime) return;

    const now = Date.now();
    const diff = now - lockTime;

    if (diff > AUTO_UNLOCK_TIMEOUT) {
        console.log('Auto-unlock timeout reached in periodic check');
        
        isDisabling = true;
        
        if (unlockTimer) {
            clearTimeout(unlockTimer);
            unlockTimer = undefined;
        }
        
        try {
            await disableProtection(context);
        } finally {
            isDisabling = false;
        }
    }
}

// проверка авто-разблокировки при старте
async function checkAutoUnlock(context: vscode.ExtensionContext) {
    console.log('Checking auto-unlock on startup...');

    const wasLocked = context.globalState.get<boolean>("masterlock_was_locked", false);
    const lastClose = context.globalState.get<number>("masterlock_last_close");
    const lockStart = context.globalState.get<number>("masterlock_lock_start");
    const lockTime = context.workspaceState.get<number>("masterlock_lock_time");

    if (!lockTime) return;

    const now = Date.now();

    if (wasLocked && lastClose && lockStart) {
        const timePassed = now - lockStart;

        console.log(`Session closed with active lock. Time passed: ${timePassed / 1000 / 60} minutes`);

        if (timePassed >= AUTO_UNLOCK_TIMEOUT) {
            console.log('Auto-unlock timeout reached during closed session');
            await disableProtection(context);
            await clearLockState(context);
            return; // disableProtection уже показывает уведомление
        }

        const remaining = AUTO_UNLOCK_TIMEOUT - timePassed;
        console.log(`Resuming auto-unlock timer. Remaining: ${remaining / 1000 / 60} minutes`);

        vscode.commands.executeCommand('setContext', 'masterlock.isEncrypted', true);
        updateStatusBar(true);

        unlockTimer = setTimeout(async () => {
            if (isDisabling) return;  
            
            const choice = await vscode.window.showWarningMessage(
                "MasterLock protection expired. Restore protection?",
                "Restore", "Disable"
            );

            if (isDisabling) return;  
            
            if (choice === "Restore") {
                await context.workspaceState.update("masterlock_lock_time", Date.now());
                await context.globalState.update("masterlock_lock_start", Date.now());
                await saveLockState(context, true); 
                startAutoUnlockTimer(context);
            } else {
                await disableProtection(context);
                await clearLockState(context);
            }
        }, remaining);

        return; // ранний выход — предотвращает двойной таймер
    }

    // Стандартная проверка: lockTime есть, но нет данных о закрытой сессии
    const diff = now - lockTime;

    if (diff > AUTO_UNLOCK_TIMEOUT) {
        await disableProtection(context);
        await clearLockState(context);
    } else {
        const remaining = AUTO_UNLOCK_TIMEOUT - diff;
        console.log(`Auto-unlock timer active. Remaining: ${remaining / 1000 / 60} minutes`);

        vscode.commands.executeCommand('setContext', 'masterlock.isEncrypted', true);
        updateStatusBar(true);

        unlockTimer = setTimeout(async () => {
            await disableProtection(context);
            await clearLockState(context);
        }, remaining);
    }
}

// таймер авто-разблокировки после шифрования
function startAutoUnlockTimer(context: vscode.ExtensionContext) {
    if (unlockTimer) clearTimeout(unlockTimer);

    unlockTimer = setTimeout(async () => {
        // Защита от race condition
        if (isDisabling) {
            console.log('Auto-unlock: already being disabled, skipping timer');
            return;
        }
        
        const choice = await vscode.window.showWarningMessage(
            "MasterLock: 2 hours have passed. Restore protection for another 2 hours?",
            "Restore (another 2h)", "Unlock Now"
        );

        // Повторная проверка после await
        if (isDisabling) return;

        if (choice === "Restore (another 2h)") {
            await context.workspaceState.update("masterlock_lock_time", Date.now());
            await context.globalState.update("masterlock_lock_start", Date.now());
            await saveLockState(context, true);  
            startAutoUnlockTimer(context);
            vscode.window.showInformationMessage('MasterLock: Protection extended for another 2 hours');
        } else {
            if (isDisabling) return;
            await disableProtection(context);
            await clearLockState(context);
        }
    }, AUTO_UNLOCK_TIMEOUT);
}

// функция восстановления текста из backup при авто-разблокировке
async function disableProtection(context: vscode.ExtensionContext) {
    if (isDisabling) return;
    
    const attempts = context.workspaceState.get<number>("masterlock_restore_attempts", 0);
    if (attempts >= 3) {
        // Сдаёмся — очищаем lockTime, но сохраняем backup
        vscode.window.showErrorMessage(
            'MasterLock: Auto-unlock failed after 3 attempts. ' +
            'Manual restoration required. Backup preserved in workspace state.'
        );
        await context.workspaceState.update("masterlock_lock_time", undefined);
        await context.workspaceState.update("masterlock_restore_attempts", undefined);
        await vscode.commands.executeCommand('setContext', 'masterlock.isEncrypted', false);
        updateStatusBar(false);
        return;
    }
    
    isDisabling = true;
    let restoreSuccess = false;
    let showUserError = false;

    try {
        const backup = context.workspaceState.get<string>("masterlock_backup");
        const fileUriString = context.workspaceState.get<string>("masterlock_file");
        const rangeData = context.workspaceState.get<any>("masterlock_range");

        if (backup && fileUriString && rangeData) {
            try {
                const uri = vscode.Uri.parse(fileUriString);
                const document = await vscode.workspace.openTextDocument(uri);
                const editor = await vscode.window.showTextDocument(document, { 
                    preview: false, preserveFocus: true 
                });

                const range = new vscode.Range(
                    new vscode.Position(rangeData.start.line, rangeData.start.character),
                    new vscode.Position(rangeData.end.line, rangeData.end.character)
                );

                const success = await editor.edit(editBuilder => {
                    editBuilder.replace(range, backup);
                });

                if (!success) {
                    showUserError = true;
                } else {
                    restoreSuccess = true;
                    const action = await vscode.window.showInformationMessage(
                        'MasterLock: File automatically unlocked',
                        "Show File", "OK"
                    );
                    if (action === "Show File") {
                        await vscode.commands.executeCommand('revealInExplorer', uri);
                    }
                }
            } catch (err) {
                console.error('Error during auto-unlock:', err);
                showUserError = true;
            }
        } else {
            restoreSuccess = true;
        }

        if (showUserError) {
            // Сохраняем счётчик попыток, чтобы выйти на следующей итерации
            await context.workspaceState.update("masterlock_restore_attempts", attempts + 1);
        }

    } finally {
        // Очищаем состояние ТОЛЬКО при успехе
        if (restoreSuccess) {
            await context.workspaceState.update("masterlock_backup", undefined);
            await context.workspaceState.update("masterlock_file", undefined);
            await context.workspaceState.update("masterlock_range", undefined);
            await context.workspaceState.update("masterlock_lock_time", undefined);
            await context.workspaceState.update("masterlock_restore_attempts", undefined);

            await vscode.commands.executeCommand('setContext', 'masterlock.isEncrypted', false);
            updateStatusBar(false);
            if (activeDashboard) {
                activeDashboard.webview.postMessage({
                    command: 'stateUpdate',
                    state: getDashboardState(context)
                });
            }
        }
        
        isDisabling = false;
    }
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
function getDashboardContent(logoUri: string, version: string, state: any): string {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>MasterLock Dashboard</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                
                body {
                    min-height: 100vh;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                    padding: 2rem;
                    color: white;
                }

                .dashboard {
                    max-width: 720px;
                    margin: 0 auto;
                }

                .header {
                    text-align: center;
                    margin-bottom: 2rem;
                }

                .logo {
                    width: 100px;
                    height: auto;
                    margin-bottom: 1rem;
                    filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.25));
                }

                h1 {
                    font-size: 2.2em;
                    font-weight: 700;
                    letter-spacing: -0.5px;
                    margin-bottom: 0.3rem;
                }

                .tagline {
                    opacity: 0.85;
                    font-size: 1em;
                }

                /* Статусная карточка */
                .status-card {
                    background: rgba(255, 255, 255, 0.12);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 16px;
                    padding: 2rem;
                    margin-bottom: 1.5rem;
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                }

                .status-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 14px;
                    border-radius: 20px;
                    font-size: 0.85em;
                    font-weight: 600;
                    margin-bottom: 1.2rem;
                }

                .status-badge.locked {
                    background: rgba(255, 193, 7, 0.25);
                    color: #ffd54f;
                    border: 1px solid rgba(255, 193, 7, 0.4);
                }

                .status-badge.unlocked {
                    background: rgba(76, 175, 80, 0.25);
                    color: #81c784;
                    border: 1px solid rgba(76, 175, 80, 0.4);
                }

                .status-badge svg {
                    width: 16px;
                    height: 16px;
                }

                /* Таймер */
                .timer {
                    font-size: 2.8em;
                    font-weight: 300;
                    font-variant-numeric: tabular-nums;
                    margin: 1rem 0;
                    letter-spacing: 1px;
                }

                .timer.expired {
                    color: #ff6b6b;
                }

                .timer-label {
                    opacity: 0.7;
                    font-size: 0.9em;
                    margin-bottom: 1rem;
                }

                /* Действия */
                .actions {
                    display: flex;
                    gap: 10px;
                    flex-wrap: wrap;
                }

                .btn {
                    padding: 10px 18px;
                    border-radius: 10px;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    background: rgba(255, 255, 255, 0.08);
                    color: white;
                    font-size: 0.95em;
                    font-weight: 500;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    transition: all 0.2s ease;
                    font-family: inherit;
                }

                .btn:hover {
                    background: rgba(255, 255, 255, 0.18);
                    border-color: white;
                    transform: translateY(-1px);
                }

                .btn:active {
                    transform: translateY(0);
                }

                .btn.primary {
                    background: rgba(255, 255, 255, 0.2);
                    border-color: rgba(255, 255, 255, 0.5);
                }

                .btn.danger {
                    background: rgba(255, 107, 107, 0.2);
                    border-color: rgba(255, 107, 107, 0.4);
                }

                .btn svg {
                    width: 16px;
                    height: 16px;
                }

                /* Информационная карточка */
                .info-card {
                    background: rgba(255, 255, 255, 0.08);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    border-radius: 16px;
                    padding: 1.5rem 2rem;
                    margin-bottom: 1.5rem;
                }

                .info-card h3 {
                    font-size: 0.95em;
                    font-weight: 600;
                    opacity: 0.8;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 1rem;
                }

                .info-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.6rem 0;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                }

                .info-row:last-child {
                    border-bottom: none;
                }

                .info-label {
                    opacity: 0.75;
                    font-size: 0.95em;
                }

                .info-value {
                    font-weight: 500;
                    font-size: 0.95em;
                    font-variant-numeric: tabular-nums;
                }

                .info-value.obscured {
                    letter-spacing: 2px;
                    opacity: 0.8;
                }

                /* Нижние ссылки */
                .footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 2rem;
                    padding-top: 1.5rem;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                }

                .footer-links {
                    display: flex;
                    gap: 16px;
                }

                .footer-links a {
                    color: rgba(255, 255, 255, 0.7);
                    text-decoration: none;
                    font-size: 0.85em;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    transition: color 0.2s;
                }

                .footer-links a:hover {
                    color: white;
                }

                .footer-links svg {
                    width: 14px;
                    height: 14px;
                }

                .version {
                    color: rgba(255, 255, 255, 0.5);
                    font-size: 0.8em;
                }

                .empty-state {
                    text-align: center;
                    padding: 2rem;
                    opacity: 0.7;
                }

                .empty-state svg {
                    width: 48px;
                    height: 48px;
                    margin-bottom: 1rem;
                    opacity: 0.5;
                }

                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }

                .pulse {
                    animation: pulse 2s ease-in-out infinite;
                }
            </style>
        </head>
        <body>
            <div class="dashboard">
                <div class="header">
                    ${logoUri ? `<img src="${logoUri}" alt="MasterLock" class="logo" />` : ''}
                    <h1>MasterLock</h1>
                    <p class="tagline">Secure your sensitive data in JSON and .env files</p>
                </div>

                <!-- Статус + Таймер + Действия -->
                <div class="status-card">
                    <div id="statusBadge" class="status-badge ${state.isEncrypted ? 'locked' : 'unlocked'}">
                        ${state.isEncrypted 
                            ? `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2m3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2"/></svg>
                               <span>PROTECTION ACTIVE</span>`
                            : `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M11 1a2 2 0 0 0-2 2v4a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h5V3a3 3 0 0 1 6 0v4a.5.5 0 0 1-1 0V3a2 2 0 0 0-2-2"/></svg>
                               <span>PROTECTION INACTIVE</span>`
                        }
                    </div>

                    <div class="timer-label" id="timerLabel">
                        ${state.isEncrypted ? 'Auto-unlock in' : 'No active protection'}
                    </div>
                    <div class="timer" id="timer">--:--:--</div>

                    <div class="actions">
                        ${state.isEncrypted ? `
                            <button class="btn primary" onclick="sendMessage('extendTimer')">
                                <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71z"/><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16m7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0"/></svg>
                                Extend 2 Hours
                            </button>
                            <button class="btn" onclick="sendMessage('unlockNow')">
                                <svg viewBox="0 0 16 16" fill="currentColor"><path d="M11 1a2 2 0 0 0-2 2v4a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h5V3a3 3 0 0 1 6 0v4a.5.5 0 0 1-1 0V3a2 2 0 0 0-2-2"/></svg>
                                Unlock Now
                            </button>
                        ` : `
                            <button class="btn primary" onclick="showUsageInfo()">
                                <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/><path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c.194.132.298.256.313.378.014.115-.046.22-.187.345l-.2.178a.83.83 0 0 1-.302.126.83.83 0 0 1-.39-.028.8.8 0 0 1-.294-.191.83.83 0 0 1-.12-.327l.737-3.468c-.057-.242-.01-.408.145-.5l.203-.118.081-.38-2.29-.287a1.6 1.6 0 0 1-.083-.342c0-.118.08-.198.202-.24l.737-.245.372-1.755a.83.83 0 0 1 .44-.56.83.83 0 0 1 .682.012.83.83 0 0 1 .383.426l-.372 1.755.082.024z"/><path d="M8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2"/></svg>
                                How to Use
                            </button>
                        `}
                    </div>
                </div>

                <!-- Информация о пароле -->
                <div class="info-card">
                    <h3>Password Management</h3>
                    
                    <div class="info-row">
                        <span class="info-label">Current password</span>
                        <span class="info-value obscured">••••••••</span>
                    </div>

                    <div class="info-row">
                        <span class="info-label">Password set on</span>
                        <span class="info-value" id="passwordDate">
                            ${state.passwordChangedAt ? formatDate(state.passwordChangedAt) : 'Never set'}
                        </span>
                    </div>

                    <div class="info-row">
                        <span class="info-label">Days since change</span>
                        <span class="info-value" id="daysSince">
                            ${state.passwordChangedAt ? Math.floor((Date.now() - state.passwordChangedAt) / 86400000) + ' days' : '—'}
                        </span>
                    </div>

                    <div style="margin-top: 1rem;">
                        <button class="btn" onclick="sendMessage('changePassword')">
                            <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4"/><path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8m8-7a7 7 0 1 0 0 14A7 7 0 0 0 8 1"/></svg>
                            Change Password
                        </button>
                    </div>
                </div>

                <!-- Подвал -->
                <div class="footer">
                    <div class="footer-links">
                        <a href="https://github.com/Khamit/MasterLock">
                            <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8"/></svg>
                            GitHub
                        </a>
                        <a href="https://github.com/Khamit/MasterLock/issues">
                            <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3"/><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0M1 8a7 7 0 1 0 14 0A7 7 0 0 0 1 8"/></svg>
                            Report Issue
                        </a>
                    </div>
                    <div class="version">v${version}</div>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                
                // Начальное состояние от расширения
                let state = ${JSON.stringify(state)};

                // Обновление таймера каждую секунду
                function updateTimer() {
                    const timerEl = document.getElementById('timer');
                    const labelEl = document.getElementById('timerLabel');
                    
                    if (!state.isEncrypted || state.lockStartTime === null) {
                        timerEl.textContent = '--:--:--';
                        labelEl.textContent = 'No active protection';
                        timerEl.classList.remove('expired');
                        return;
                    }

                    const elapsed = Date.now() - state.lockStartTime;
                    const remaining = Math.max(0, state.autoUnlockTimeoutMs - elapsed);

                    if (remaining === 0) {
                        timerEl.textContent = '00:00:00';
                        timerEl.classList.add('expired');
                        labelEl.textContent = 'Protection expired';
                        return;
                    }

                    timerEl.classList.remove('expired');
                    labelEl.textContent = 'Auto-unlock in';

                    const hours = Math.floor(remaining / 3600000);
                    const mins = Math.floor((remaining % 3600000) / 60000);
                    const secs = Math.floor((remaining % 60000) / 1000);

                    timerEl.textContent = 
                        String(hours).padStart(2, '0') + ':' + 
                        String(mins).padStart(2, '0') + ':' + 
                        String(secs).padStart(2, '0');
                }

                // Отправка сообщений в расширение
                function sendMessage(command) {
                    vscode.postMessage({ command });
                }

                function showUsageInfo() {
                    // Показываем инструкцию
                    const info = document.createElement('div');
                    info.innerHTML = \`
                        <div style="
                            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                            background: rgba(0,0,0,0.7); display: flex;
                            align-items: center; justify-content: center; z-index: 1000;
                        " onclick="this.remove()">
                            <div style="
                                background: rgba(255,255,255,0.15);
                                backdrop-filter: blur(20px);
                                padding: 2rem; border-radius: 16px;
                                max-width: 500px; border: 1px solid rgba(255,255,255,0.2);
                            " onclick="event.stopPropagation()">
                                <h3 style="margin-bottom: 1rem;">How to Use MasterLock</h3>
                                <ol style="line-height: 1.8; padding-left: 1.2rem;">
                                    <li>Open a JSON or .env file</li>
                                    <li>Select the text you want to encrypt</li>
                                    <li>Click the lock icon in the status bar, or right-click → "MasterLock"</li>
                                    <li>Enter your master password</li>
                                    <li>Text will be encrypted with <code>MLK1:</code> prefix</li>
                                    <li>Auto-unlocks after 2 hours (can be extended)</li>
                                </ol>
                                <p style="margin-top: 1rem; opacity: 0.8; font-size: 0.9em;">
                                    Tip: Right-click selection to see context menu options.
                                </p>
                                <button class="btn" style="margin-top: 1rem;" onclick="this.closest('div[style]').parentElement.remove()">Got it!</button>
                            </div>
                        </div>
                    \`;
                    document.body.appendChild(info);
                }

                // Обработка сообщений от расширения
                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.command === 'stateUpdate') {
                        state = message.state;
                        updateTimer();
                        
                        // Обновляем UI состояние
                        const badge = document.getElementById('statusBadge');
                        if (state.isEncrypted) {
                            badge.className = 'status-badge locked';
                            badge.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2m3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2"/></svg><span>PROTECTION ACTIVE</span>';
                        } else {
                            badge.className = 'status-badge unlocked';
                            badge.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M11 1a2 2 0 0 0-2 2v4a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h5V3a3 3 0 0 1 6 0v4a.5.5 0 0 1-1 0V3a2 2 0 0 0-2-2"/></svg><span>PROTECTION INACTIVE</span>';
                        }
                    }
                });

                // Старт обновления таймера
                setInterval(updateTimer, 1000);
                updateTimer();
            </script>
        </body>
        </html>
    `;
}

// Форматирование даты
function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}