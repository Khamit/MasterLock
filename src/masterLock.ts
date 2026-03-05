import * as CryptoJS from 'crypto-js';
import * as keytar from 'keytar';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { t } from './i18n';
import { FileRule, fileRules, shouldEncryptKey } from './struct';

const SERVICE_NAME = 'MasterLock';
const ACCOUNT_NAME = os.userInfo().username;
const GITHUB_REPO = 'https://github.com/Khamit/MasterLock/issues';

const ENCRYPT_PREFIX = "MLK1:";

// функция для получения хэша пароля (SHA-256) в hex
function deriveKey(password: string): string {
    return CryptoJS.SHA256(password).toString();
}

// проверка пароля и сохранение его в keytar при первом использовании
async function verifyPassword(password: string): Promise<string | null> {
    const storedKey = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
    const key = deriveKey(password);

    if (!storedKey) {
        await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, key);
        vscode.window.showInformationMessage(t('info_new_key'));
        return key;
    }

    if (storedKey !== key) {
        vscode.window.showErrorMessage(t('error_wrong_password'));
        return null;
    }

    return key;
}

// шифрование строки
async function encryptString(text: string, password: string): Promise<string> {
    const key = await verifyPassword(password);
    if (!key) throw new Error(t('error_getting_key'));

    const encrypted = CryptoJS.AES.encrypt(text, key).toString();
    return ENCRYPT_PREFIX + encrypted;
}

// расшифровка строки
async function decryptString(text: string, password: string): Promise<string> {
    const key = await verifyPassword(password);
    if (!key) throw new Error(t('error_getting_key'));

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

// рекурсивная обработка объекта или массива для шифрования/дешифрования
async function processObject(
  obj: any,
  password: string,
  encrypt: boolean,
  rule: FileRule,
  excludeKeys: string[] = [],
  fileType: 'json' | 'env' | 'text' = 'json'
) {
  // Для .env и текстовых файлов - обрабатываем массив с pair
  if ((fileType === 'env' || fileType === 'text') && Array.isArray(obj)) {
    for (const item of obj) {
      if (item?.type === 'pair' && typeof item.value === 'string') {
        const keyForCheck = fileType === 'env' ? item.key : item.key.toLowerCase();
        
        // исключаем определённые ключи
        if (excludeKeys.some(k => k.toLowerCase() === item.key.toLowerCase())) {
            console.log(`Skipping excluded key: ${item.key}`);
            continue;
        }

        // Используем shouldEncryptKey из struct.ts
        if (!shouldEncryptKey(item.key, rule)) {
            console.log(`Skipping non-sensitive key: ${item.key}`);
            continue;
        }

        const isEncrypted = item.value.startsWith(ENCRYPT_PREFIX);
        console.log(`Processing ${item.key}: isEncrypted=${isEncrypted}, encrypt=${encrypt}`);

        if (encrypt && !isEncrypted) {
          console.log(`Encrypting ${item.key}`);
          item.value = await encryptString(item.value, password);
        }
        if (!encrypt && isEncrypted) {
          console.log(`Decrypting ${item.key}`);
          try {
            item.value = await decryptString(item.value, password);
            console.log(`Successfully decrypted ${item.key}`);
          } catch (err) {
            console.error(`Decryption failed for key ${item.key}:`, err);
            throw err;
          }
        }
      }
    }
    return;
  }

  // Для JSON файлов - обрабатываем как обычный объект
  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
    const value = obj[key];

    // Рекурсивно обрабатываем вложенные объекты и массивы
    if (value && typeof value === 'object') {
      await processObject(value, password, encrypt, rule, excludeKeys, fileType);
      continue;
    }

    // Обрабатываем только строки
    if (typeof value !== 'string') continue;

    // исключаем определённые ключи
    if (excludeKeys.some(k => k.toLowerCase() === key.toLowerCase())) continue;

    // Используем shouldEncryptKey из struct.ts
    if (!shouldEncryptKey(key, rule)) continue;

    const isEncrypted = value.startsWith(ENCRYPT_PREFIX);

    if (encrypt && !isEncrypted) {
      console.log(`Encrypting ${key}`);
      obj[key] = await encryptString(value, password);
    }
    if (!encrypt && isEncrypted) {
      console.log(`Decrypting ${key}`);
      try {
        obj[key] = await decryptString(value, password);
        console.log(`Successfully decrypted ${key}`);
      } catch (err) {
        console.error(`Decryption failed for key ${key}:`, err);
        throw err;
      }
    }
  }
}

// основная функция переключения шифрования выделенного текста
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

    // ввод пароля пользователем
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

    const fileName = editor.document.fileName.toLowerCase();
    const ext = path.extname(fileName);

    // определяем правила парсинга для файла
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
            
            // Определяем тип файла
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
        
            // Вызываем processObject с полным rule
            await processObject(
                parsed, 
                password, 
                encrypt, 
                rule,  // Передаем весь rule, а не только sensitiveKeys
                excludeKeys,
                fileType
            );

            progress.report({ increment: 30, message: "Generating output..." });
            const newText = rule.stringify(parsed);

            // сохраняем backup при шифровании
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