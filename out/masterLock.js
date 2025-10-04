"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleEncryptSelection = toggleEncryptSelection;
const CryptoJS = __importStar(require("crypto-js"));
const keytar = __importStar(require("keytar"));
const os = __importStar(require("os"));
const vscode = __importStar(require("vscode"));
const i18n_1 = require("./i18n");
const struct_1 = require("./struct");
const SERVICE_NAME = 'MasterLock'; // имя сервиса для keytar
const ACCOUNT_NAME = os.userInfo().username; // имя аккаунта для keytar
// Получаем или создаём ключ на основе пароля
function getKey(password) {
    return __awaiter(this, void 0, void 0, function* () {
        const storedKey = yield keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
        const key = CryptoJS.SHA256(password).toString();
        if (!storedKey) {
            yield keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, key);
            vscode.window.showInformationMessage((0, i18n_1.t)('info_new_key'));
            return key;
        }
        if (key !== storedKey) {
            vscode.window.showErrorMessage((0, i18n_1.t)('error_wrong_password'));
            return null;
        }
        return key;
    });
}
// Шифруем и расшифровываем строки
function encryptString(text, password) {
    return __awaiter(this, void 0, void 0, function* () {
        const key = yield getKey(password);
        if (!key)
            throw new Error((0, i18n_1.t)('error_getting_key'));
        return CryptoJS.AES.encrypt(text, key).toString();
    });
}
// Расшифровка строки
function decryptString(text, password) {
    return __awaiter(this, void 0, void 0, function* () {
        const key = yield getKey(password);
        if (!key)
            throw new Error((0, i18n_1.t)('error_getting_key'));
        const bytes = CryptoJS.AES.decrypt(text, key);
        const result = bytes.toString(CryptoJS.enc.Utf8);
        if (!result) {
            throw new Error((0, i18n_1.t)('error_wrong_password'));
        }
        return result;
    });
}
// Рекурсивно обрабатываем объект, шифруя/расшифровывая чувствительные поля
function processObject(obj, password, encrypt, sensitiveKeys) {
    return __awaiter(this, void 0, void 0, function* () {
        for (const key in obj) {
            if (!Object.prototype.hasOwnProperty.call(obj, key))
                continue;
            const value = obj[key];
            if (value !== null && typeof value === 'object') {
                yield processObject(value, password, encrypt, sensitiveKeys);
            }
            else if (typeof value === 'string' && sensitiveKeys.some(k => key.toLowerCase().includes(k.toLowerCase()))) {
                try {
                    obj[key] = encrypt ? yield encryptString(value, password) : yield decryptString(value, password);
                }
                catch (err) {
                    throw err;
                }
            }
        }
    });
}
// Основная функция для шифрования/расшифровки выделенного текста
function toggleEncryptSelection(encrypt) {
    return __awaiter(this, void 0, void 0, function* () {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage((0, i18n_1.t)('info_open_file'));
            return false;
        }
        const selection = editor.selection;
        const text = editor.document.getText(selection);
        if (!text)
            return false;
        const password = yield vscode.window.showInputBox({
            prompt: encrypt ? (0, i18n_1.t)('prompt_encrypt') : (0, i18n_1.t)('prompt_decrypt'),
            password: true // скрытие ввода | hades input
        });
        // cancel on empty input
        if (!password) {
            vscode.window.showWarningMessage((0, i18n_1.t)('warning_no_password'));
            return false;
        }
        // определяем правило по расширению файла
        const ext = editor.document.fileName.split('.').pop() || '';
        const rule = struct_1.fileRules.find(r => r.extension.replace('.', '') === ext.toLowerCase());
        // если правило не найдено, показываем errror
        if (!rule) {
            vscode.window.showErrorMessage((0, i18n_1.t)('error_unsupported_file', { ext }));
            return false;
        }
        // парсим текст в объект | parse text to object by rule
        let parsed;
        try {
            parsed = rule.parse(text);
        }
        catch (err) {
            vscode.window.showErrorMessage((0, i18n_1.t)('error_parse_failed'));
            return false;
        }
        try {
            // await обрабатываем объект
            yield processObject(parsed, password, encrypt, rule.sensitiveKeys);
        }
        catch (err) {
            // показываем конкретные ошибки
            if (err.message === (0, i18n_1.t)('error_wrong_password')) {
                vscode.window.showErrorMessage((0, i18n_1.t)('error_wrong_password'));
            }
            else if (err.message === (0, i18n_1.t)('error_getting_key')) {
                vscode.window.showErrorMessage((0, i18n_1.t)('error_getting_key'));
            }
            else {
                vscode.window.showErrorMessage((0, i18n_1.t)('error_process_failed'));
            }
            return false;
        }
        // конвертируем обратно в строку | convert back to string
        const newText = rule.stringify(parsed);
        yield editor.edit(editBuilder => {
            // заменяем выделенный текст на новый | replace selected text with new one
            editBuilder.replace(selection, newText);
        });
        // возвращаем успех операции | return success
        return true;
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
