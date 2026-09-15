import * as CryptoJS from 'crypto-js';
import * as path from 'path';
import * as vscode from 'vscode';
import { t } from './i18n';
import { FileRule, fileRules, shouldEncryptKey } from './struct';

const GITHUB_REPO = 'https://github.com/Khamit/MasterLock/issues';
const ENCRYPT_PREFIX = "MLK1:";

function deriveKey(password: string): string {
    return CryptoJS.SHA256(password).toString();
}

// ═══════════════════════════════════════════════════════════
// ИСПРАВЛЕНИЕ 1: verifyPassword возвращает результат + причину
// ═══════════════════════════════════════════════════════════
type VerifyResult = 
    | { ok: true; key: string; isNew: boolean }
    | { ok: false; reason: 'wrong_password' };

async function verifyPassword(
    password: string, 
    context: vscode.ExtensionContext
): Promise<VerifyResult> {
    const storedKey = await context.secrets.get('masterlock_password_hash');
    const key = deriveKey(password);

    if (!storedKey) {
        await context.secrets.store('masterlock_password_hash', key);
        return { ok: true, key, isNew: true };
    }

    if (storedKey !== key) {
        return { ok: false, reason: 'wrong_password' };
    }

    return { ok: true, key, isNew: false };
}

// ═══════════════════════════════════════════════════════════
// ИСПРАВЛЕНИЕ 2: Верификация пароля ОДИН РАЗ, до processObject
// ═══════════════════════════════════════════════════════════
function encryptStringWithKey(text: string, key: string): string {
    const encrypted = CryptoJS.AES.encrypt(text, key).toString();
    return ENCRYPT_PREFIX + encrypted;
}

function decryptStringWithKey(text: string, key: string): string {
    if (!text.startsWith(ENCRYPT_PREFIX)) {
        throw new Error(t('error_invalid_format'));
    }

    const encrypted = text.substring(ENCRYPT_PREFIX.length);

    try {
        const bytes = CryptoJS.AES.decrypt(encrypted, key);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);

        if (!decrypted) {
            throw new Error(t('error_corrupted_data'));
        }

        return decrypted;
    } catch (err) {
        console.error('Decryption error:', err);
        throw new Error(t('error_wrong_password'));
    }
}

// ═══════════════════════════════════════════════════════════
// ИСПРАВЛЕНИЕ 3: processObject принимает KEY, а не password+context
// Убраны лишние вызовы verifyPassword на каждый ключ
// ═══════════════════════════════════════════════════════════
async function processObject(
    obj: any,
    key: string,            // ← теперь принимает готовый ключ
    encrypt: boolean,
    rule: FileRule,
    excludeKeys: string[] = [],
    fileType: 'json' | 'env' | 'text' = 'json'
) {
    // Для .env и текстовых файлов
    if ((fileType === 'env' || fileType === 'text') && Array.isArray(obj)) {
        for (const item of obj) {
            if (item?.type === 'pair' && typeof item.value === 'string') {
                if (excludeKeys.some(k => k.toLowerCase() === item.key.toLowerCase())) {
                    console.log(`Skipping excluded key: ${item.key}`);
                    continue;
                }

                if (!shouldEncryptKey(item.key, rule)) {
                    console.log(`Skipping non-sensitive key: ${item.key}`);
                    continue;
                }

                const isEncrypted = item.value.startsWith(ENCRYPT_PREFIX);

                if (encrypt && !isEncrypted) {
                    console.log(`Encrypting ${item.key}`);
                    item.value = encryptStringWithKey(item.value, key);
                }
                if (!encrypt && isEncrypted) {
                    console.log(`Decrypting ${item.key}`);
                    item.value = decryptStringWithKey(item.value, key);
                }
            }
        }
        return;
    }

    // Для JSON — обрабатываем массивы рекурсивно
    if (Array.isArray(obj)) {
        for (const item of obj) {
            if (item && typeof item === 'object') {
                await processObject(item, key, encrypt, rule, excludeKeys, fileType);
            }
        }
        return;
    }

    // Для JSON объектов
    for (const k in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
        const value = obj[k];

        if (value && typeof value === 'object') {
            await processObject(value, key, encrypt, rule, excludeKeys, fileType);
            continue;
        }

        if (typeof value !== 'string') continue;
        if (excludeKeys.some(ex => ex.toLowerCase() === k.toLowerCase())) continue;
        if (!shouldEncryptKey(k, rule)) continue;

        const isEncrypted = value.startsWith(ENCRYPT_PREFIX);

        if (encrypt && !isEncrypted) {
            console.log(`Encrypting ${k}`);
            obj[k] = encryptStringWithKey(value, key);
        }
        if (!encrypt && isEncrypted) {
            console.log(`Decrypting ${k}`);
            obj[k] = decryptStringWithKey(value, key);
        }
    }
}

// ═══════════════════════════════════════════════════════════
// ИСПРАВЛЕНИЕ 4: toggleEncryptSelection — верификация один раз
// + кнопка "Reset Password" при ошибке
// ═══════════════════════════════════════════════════════════
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

    // Ввод пароля
    const password = await vscode.window.showInputBox({
        prompt: encrypt ? t('prompt_encrypt') : t('prompt_decrypt'),
        password: true,
        validateInput: value =>
            value && value.length > 0 ? null : t('warning_no_password')
    });

    if (!password) {
        vscode.window.showWarningMessage(t('warning_no_password'));
        return false;
    }

    // ═══════════════════════════════════════════
    // ВЕРИФИКАЦИЯ ПАРОЛЯ — ОДИН РАЗ!
    // ═══════════════════════════════════════════
    const verifyResult = await verifyPassword(password, context);

    if (!verifyResult.ok) {
        // Пароль неверный → предлагаем сброс
        const action = await vscode.window.showErrorMessage(
            t('error_wrong_password'),
            "Reset Password",
            "OK"
        );

        if (action === "Reset Password") {
            const confirm = await vscode.window.showWarningMessage(
                "⚠️ This will delete your saved master password. " +
                "You won't be able to decrypt previously encrypted data! Continue?",
                { modal: true },
                "Yes, Reset"
            );

            if (confirm === "Yes, Reset") {
                await context.secrets.delete('masterlock_password_hash');
                vscode.window.showInformationMessage(
                    "Password reset. Try encrypting again with a new password."
                );
            }
        }
        return false;
    }

    if (verifyResult.isNew) {
        vscode.window.showInformationMessage(t('info_new_key'));
    }

    const derivedKey = verifyResult.key;

    // Определяем правила
    const fileName = editor.document.fileName.toLowerCase();
    const ext = path.extname(fileName);

    const rule = fileRules.find(r =>
        r.extensions.some(e => fileName.endsWith(e))
    );

    if (!rule) {
        const supported = fileRules.flatMap(r => r.extensions).join(', ');
        vscode.window.showErrorMessage(
            t('error_unsupported_file', { ext: ext || 'unknown' }) +
            ` Supported: ${supported}`
        );
        return false;
    }

    const textSize = text.length;
    if (textSize > 100000) {
        const choice = await vscode.window.showWarningMessage(
            `Selected text is large (${(textSize / 1024).toFixed(1)}KB). Continue?`,
            "Continue",
            "Cancel"
        );
        if (choice !== "Continue") return false;
    }

    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: encrypt ? "MasterLock: Encrypting..." : "MasterLock: Decrypting...",
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

            let fileType: 'json' | 'env' | 'text' = 'json';
            if (ext === '.json') {
                fileType = 'json';
            } else if (['.env', '.env.local', '.env.development', '.env.production', '.env.test', '.env.example', '.env.sample'].some(e => fileName.endsWith(e))) {
                fileType = 'env';
            } else {
                fileType = 'text';
            }

            const excludeKeys = ['notes', 'message', 'name', 'description', 'version', 'module', 'mock', 'comment', 'title'];

            progress.report({ increment: 40, message: "Processing data..." });

            // ═══════════════════════════════════════════
            // Передаём КЛЮЧ, а не пароль + context
            // ═══════════════════════════════════════════
            await processObject(
                parsed,
                derivedKey,     // ← готовый ключ
                encrypt,
                rule,
                excludeKeys,
                fileType
            );

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

            vscode.window.showInformationMessage(
                encrypt ? t('info_encrypted_success') : t('info_decrypted_success')
            );

            return true;

        } catch (err) {
            console.error('MasterLock error:', err);
            const error = err as Error;
            const errorDetails = error.stack || error.message || String(err);

            const action = await vscode.window.showErrorMessage(
                t('error_process_failed_details', { details: errorDetails.substring(0, 100) }),
                "Report Issue",
                "Details",
                "OK"
            );

            if (action === "Report Issue") {
                const title = encodeURIComponent(`[Bug]: ${error.message}`);
                const body = encodeURIComponent(
                    `Error:\n${error.message}\n\nStack:\n${error.stack}\n\n` +
                    `File type: ${ext}\nOperation: ${encrypt ? 'encrypt' : 'decrypt'}`
                );
                vscode.env.openExternal(vscode.Uri.parse(`${GITHUB_REPO}/new?title=${title}&body=${body}`));
            }

            if (action === "Details") {
                vscode.window.showErrorMessage(errorDetails, { modal: true });
            }

            return false;
        }
    });
}

// ═══════════════════════════════════════════════════════════
// СМЕНА ПАРОЛЯ (с подтверждением через старый пароль)
// ═══════════════════════════════════════════════════════════
export async function changePassword(context: vscode.ExtensionContext): Promise<boolean> {
    const storedKey = await context.secrets.get('masterlock_password_hash');
    
    // Если пароля ещё нет — просто устанавливаем
    if (!storedKey) {
        const newPass = await vscode.window.showInputBox({
            prompt: "Set your MasterLock password",
            password: true,
            validateInput: v => v && v.length > 0 ? null : "Password cannot be empty"
        });
        if (!newPass) return false;
        
        await context.secrets.store('masterlock_password_hash', deriveKey(newPass));
        await context.globalState.update("masterlock_password_changed_at", Date.now());
        vscode.window.showInformationMessage("✅ MasterLock password set successfully!");
        return true;
    }

    // Шаг 1: Подтверждение старого пароля
    const currentPass = await vscode.window.showInputBox({
        prompt: "Enter your CURRENT password",
        password: true
    });
    if (!currentPass) return false;

    if (deriveKey(currentPass) !== storedKey) {
        vscode.window.showErrorMessage("Current password is incorrect");
        return false;
    }

    // Шаг 2: Предупреждение о последствиях
    const warning = await vscode.window.showWarningMessage(
        "⚠️ WARNING: Changing the password will make ALL previously encrypted data " +
        "impossible to decrypt! This cannot be undone.",
        { modal: true },
        "Yes, Change Password"
    );

    if (warning !== "Yes, Change Password") return false;

    // Шаг 3: Новый пароль
    const newPass = await vscode.window.showInputBox({
        prompt: "Enter NEW password",
        password: true,
        validateInput: v => v && v.length > 0 ? null : "Password cannot be empty"
    });
    if (!newPass) return false;

    // Шаг 4: Подтверждение
    const confirmPass = await vscode.window.showInputBox({
        prompt: "Confirm NEW password",
        password: true
    });
    if (confirmPass !== newPass) {
        vscode.window.showErrorMessage("Passwords don't match");
        return false;
    }

    // Сохраняем
    await context.secrets.store('masterlock_password_hash', deriveKey(newPass));
    await context.globalState.update("masterlock_password_changed_at", Date.now());

    vscode.window.showInformationMessage(
        "Password changed successfully! Remember: previously encrypted data cannot be decrypted anymore."
    );
    return true;
}

// Команды для сборки расширения
// npm install
// npx tsc

// VS Code расширения собираются через утилиту vsce
// npm install -g vsce

/*
Также часто используют ovsx (для публикации в Open VSX,
 например в VSCodium), но для Marketplace нужен именно vsce.
 */

/*
GitHub репозиторий инструкций:
чистая сборка:
# 1. Очистка кэша npm
npm cache clean --force

# 2. Удаление папки сборки, зависимостей и лок-файла
rm -rf out node_modules package-lock.json

# 3. Установка зависимостей заново
npm install

# 4. Чистая продакшн-сборка через ваш esbuild.js
npm run package
----------------------------------------------------------
npm cache clean --force && rm -rf out node_modules package-lock.json && npm install && npm run package

Обновить ветку DEV 
git add .
git commit -m "исправил ошибку keytar и package.json"
git push origin dev
===================
# 1 обновить версию
package.json → 1.0.ХХ

# 2 закоммитить
git add package.json
git commit -m "release 1.0.12"
git push

# 3 опубликовать
vsce publish
=====================
git push azure main
*/