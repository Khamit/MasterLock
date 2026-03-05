import * as CryptoJS from 'crypto-js';
import * as keytar from 'keytar';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { t } from './i18n';
import { fileRules } from './struct';

const SERVICE_NAME = 'MasterLock';
const ACCOUNT_NAME = os.userInfo().username;
const GITHUB_REPO = 'https://github.com/Khamit/MasterLock/issues';

// Получаем или создаём ключ на основе пароля
async function getKey(password: string): Promise<string | null> {
    const storedKey = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
    const key = CryptoJS.SHA256(password).toString();

    if (!storedKey) {
        await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, key);
        vscode.window.showInformationMessage(t('info_new_key'));
        return key;
    }

    if (key !== storedKey) {
        vscode.window.showErrorMessage(t('error_wrong_password'));
        return null;
    }

    return key;
}

// Шифруем и расшифровываем строки
async function encryptString(text: string, password: string): Promise<string> {
    const key = await getKey(password);
    if (!key) throw new Error(t('error_getting_key'));
    return CryptoJS.AES.encrypt(text, key).toString();
}

// Расшифровка строки
async function decryptString(text: string, password: string): Promise<string> {
    const key = await getKey(password);
    if (!key) throw new Error(t('error_getting_key'));
    const bytes = CryptoJS.AES.decrypt(text, key);
    const result = bytes.toString(CryptoJS.enc.Utf8);
    
    if (!result) {
        throw new Error(t('error_wrong_password'));
    }
    
    return result;
}

// Рекурсивно обрабатываем объект, шифруя/расшифровывая чувствительные поля
async function processObject(
  obj: any,
  password: string,
  encrypt: boolean,
  sensitiveKeys: string[]
) {
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (item.type === 'pair') {
        if (sensitiveKeys.some(k =>
          item.key.toLowerCase().includes(k.toLowerCase())
        )) {
          item.value = encrypt
            ? await encryptString(item.value, password)
            : await decryptString(item.value, password);
        }
      }
    }
    return;
  }

  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;

    const value = obj[key];

    if (value !== null && typeof value === 'object') {
      await processObject(value, password, encrypt, sensitiveKeys);
    } else if (
      typeof value === 'string' &&
      sensitiveKeys.some(k => key.toLowerCase().includes(k.toLowerCase()))
    ) {
      obj[key] = encrypt
        ? await encryptString(value, password)
        : await decryptString(value, password);
    }
  }
}

// Основная функция с прогресс-баром и улучшенной обработкой ошибок
// шифрование/расшифровка - кнопка выделенного текстом
export async function toggleEncryptSelection(
    encrypt: boolean,
    context: vscode.ExtensionContext
): Promise<boolean> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showInformationMessage(t('info_open_file'));
        return false;
    }

    const selection = editor.selection;
    const text = editor.document.getText(selection);
    if (!text) return false;

    const password = await vscode.window.showInputBox({
        prompt: encrypt ? t('prompt_encrypt') : t('prompt_decrypt'),
        password: true,
        validateInput: (value) => {
            return value && value.length > 0 ? null : t('warning_no_password');
        }
    });

    if (!password) {
        vscode.window.showWarningMessage(t('warning_no_password'));
        return false;
    }

    const fileName = editor.document.fileName.toLowerCase();
    const ext = path.extname(fileName);

    const rule = fileRules.find(r =>
        r.extensions.some(e => fileName.endsWith(e))
    );

    if (!rule) {
        const supported = fileRules.flatMap(r => r.extensions).join(', ');
        vscode.window.showErrorMessage(
            t('error_unsupported_file', { ext: ext || 'unknown' }) + ` Supported: ${supported}`
        );
        return false;
    }

    // Проверка размера текста
    const textSize = text.length;
    if (textSize > 100000) {
        const choice = await vscode.window.showWarningMessage(
            `Selected text is large (${(textSize/1024).toFixed(1)}KB). This operation might take a moment. Continue?`,
            "Continue", "Cancel"
        );
        if (choice !== "Continue") {
            return false;
        }
    }

    // Прогресс-бар
    return await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: encrypt ? "🔐 Encrypting..." : "🔓 Decrypting...",
        cancellable: false
    }, async (progress) => {
        try {
            progress.report({ increment: 20, message: "Parsing file..." });
            
            let parsed;
            try {
                parsed = rule.parse(text);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                throw new Error(t('error_parse_failed_details', { error: errorMessage }));
            }

            progress.report({ increment: 40, message: "Processing sensitive data..." });
            
            try {
                await processObject(parsed, password, encrypt, rule.sensitiveKeys);
            } catch (err: any) {
                console.error('MasterLock processing error:', err);
                throw err;
            }

            progress.report({ increment: 30, message: "Generating output..." });
            const newText = rule.stringify(parsed);

            if (encrypt) {
                await context.workspaceState.update("masterlock_backup", text);
                await context.workspaceState.update("masterlock_file", editor.document.uri.toString());
                await context.workspaceState.update("masterlock_range", {
                    start: selection.start,
                    end: selection.end
                });
                await context.workspaceState.update("masterlock_lock_time", Date.now());
            }

            await editor.edit(editBuilder => {
                editBuilder.replace(selection, newText);
            });

            progress.report({ increment: 10, message: "Done!" });
            
            // Уведомление об успехе
            if (encrypt) {
                vscode.window.showInformationMessage(t('info_encrypted_success'));
            } else {
                vscode.window.showInformationMessage(t('info_decrypted_success'));
            }
            
            return true;

        } catch (err: any) {
            console.error('MasterLock error:', err);
            
            // Определяем тип ошибки и показываем соответствующее сообщение
            if (err.message === t('error_wrong_password')) {
                vscode.window.showErrorMessage(t('error_wrong_password'));
            } else if (err.message === t('error_getting_key')) {
                vscode.window.showErrorMessage(t('error_getting_key'));
            } else if (err.message.includes(t('error_parse_failed_details'))) {
                vscode.window.showErrorMessage(err.message);
            } else {
                const errorDetails = err instanceof Error ? err.stack || err.message : String(err);
                const shortMessage = t('error_process_failed_details', { 
                    details: errorDetails.substring(0, 100) + (errorDetails.length > 100 ? '...' : '')
                });
                
                const action = await vscode.window.showErrorMessage(
                    shortMessage,
                    "Report Issue", "Details", "OK"
                );
                
                if (action === "Report Issue") {
                    const title = encodeURIComponent(`[Bug]: ${err.message || 'Unknown error'}`);
                    const body = encodeURIComponent(
                        `**Error:**\n${err.message || 'Unknown'}\n\n` +
                        `**Stack:**\n${err.stack || 'Not available'}\n\n` +
                        `**File type:** ${ext}\n` +
                        `**Operation:** ${encrypt ? 'encrypt' : 'decrypt'}\n` +
                        `**Text size:** ${textSize} chars`
                    );
                    vscode.env.openExternal(vscode.Uri.parse(`${GITHUB_REPO}/new?title=${title}&body=${body}`));
                } else if (action === "Details") {
                    vscode.window.showErrorMessage(
                        errorDetails,
                        { modal: true, detail: "Error details" }
                    );
                }
            }
            return false;
        }
    });
}
// Команды для сборки расширения
// npm install
// npx tsc

// VS Code расширения собираются через утилиту vsce
// npm install -g vsce
/*Также часто используют ovsx (для публикации в Open VSX,
 например в VSCodium), но для Marketplace нужен именно vsce. */
// Сборка
// vsce package

/*GitHub репозиторий инструкций:
В какой ветке  - git branch 

Обновить ветку DEV 
git add .
git commit -m "fix: обновил icon и package.json"
git push origin dev



*/