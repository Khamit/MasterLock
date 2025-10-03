import * as CryptoJS from 'crypto-js';
import * as keytar from 'keytar';
import * as os from 'os';
import * as vscode from 'vscode';
import { t } from './i18n';
import { FileRule, fileRules } from './struct';

const SERVICE_NAME = 'MasterLock'; // имя сервиса для keytar
const ACCOUNT_NAME = os.userInfo().username; // имя аккаунта для keytar

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
async function processObject(obj: any, password: string, encrypt: boolean, sensitiveKeys: string[]) {
    for (const key in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
        const value = obj[key];

        if (value !== null && typeof value === 'object') {
            await processObject(value, password, encrypt, sensitiveKeys);
        } else if (typeof value === 'string' && sensitiveKeys.some(k => key.toLowerCase().includes(k.toLowerCase()))) {
            try {
                obj[key] = encrypt ? await encryptString(value, password) : await decryptString(value, password);
            } catch (err) {
                throw err;
            }
        }
    }
}
// Основная функция для шифрования/расшифровки выделенного текста
export async function toggleEncryptSelection(encrypt: boolean): Promise<boolean> {
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
        password: true // скрытие ввода | hades input
    });
    // cancel on empty input
    if (!password) {
        vscode.window.showWarningMessage(t('warning_no_password'));
        return false;
    }
    // определяем правило по расширению файла
    const ext = editor.document.fileName.split('.').pop() || '';
    const rule: FileRule | undefined = fileRules.find(r => r.extension.replace('.', '') === ext.toLowerCase());
    // если правило не найдено, показываем errror
    if (!rule) {
        vscode.window.showErrorMessage(t('error_unsupported_file', { ext }));
        return false;
    }
        // парсим текст в объект | parse text to object by rule
    let parsed;
    try {
        parsed = rule.parse(text);
    } catch (err) {
        vscode.window.showErrorMessage(t('error_parse_failed'));
        return false;
    }

    try {
        // await обрабатываем объект
        await processObject(parsed, password, encrypt, rule.sensitiveKeys);
    } catch (err: any) {
        // показываем конкретные ошибки
        if (err.message === t('error_wrong_password')) {
            vscode.window.showErrorMessage(t('error_wrong_password'));
        } else if (err.message === t('error_getting_key')) {
            vscode.window.showErrorMessage(t('error_getting_key'));
        } else {
            vscode.window.showErrorMessage(t('error_process_failed'));
        }
        return false;
    }
    // конвертируем обратно в строку | convert back to string
    const newText = rule.stringify(parsed);

    await editor.edit(editBuilder => {
        // заменяем выделенный текст на новый | replace selected text with new one
        editBuilder.replace(selection, newText);
    });
    // возвращаем успех операции | return success
    return true;
}
// npm install
// npx tsc
// code .
// F5