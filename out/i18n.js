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
Object.defineProperty(exports, "__esModule", { value: true });
exports.t = t;
const vscode = __importStar(require("vscode"));
const messages = {
    info_select_text: {
        en: "Select text for MasterLock.",
        ru: "Выделите текст для MasterLock.",
        kz: "MasterLock үшін мәтінді таңдаңыз."
    },
    info_open_file: {
        en: "Open a file to use MasterLock.",
        ru: "Откройте файл для работы с MasterLock.",
        kz: "MasterLock қолдану үшін файл ашыңыз."
    },
    info_new_key: {
        en: "A new key has been created and saved.",
        ru: "Новый ключ создан и сохранён.",
        kz: "Жаңа кілт жасалып, сақталды."
    },
    error_wrong_password: {
        en: "Incorrect password.",
        ru: "Пароль неверный",
        kz: "Құпия сөз дұрыс емес."
    },
    warning_no_password: {
        en: "Password not entered, operation cancelled.",
        ru: "Пароль не введён, операция отменена.",
        kz: "Құпия сөз енгізілмеді, операция тоқтатылды."
    },
    error_unsupported_file: {
        en: "Files with extension .{ext} are not supported by MasterLock.",
        ru: "Файл с расширением .{ext} не поддерживается MasterLock.",
        kz: "MasterLock .{ext} кеңейтімі бар файлдарды қолдамайды."
    },
    error_parse_failed: {
        en: "Failed to parse the file according to format rules.",
        ru: "Не удалось разобрать файл по правилам формата.",
        kz: "Файлды формат ережелері бойынша талдау мүмкін болмады."
    },
    error_process_failed: {
        en: "Error encrypting/decrypting data.",
        ru: "Ошибка при шифровании/расшифровке данных.",
        kz: "Деректерді шифрлеу/дешифрлеу кезінде қате."
    },
    info_encrypted: {
        en: "Selected text encrypted!",
        ru: "Выделенный текст зашифрован!",
        kz: "Таңдалған мәтін шифрленді!"
    },
    info_decrypted: {
        en: "Selected text decrypted!",
        ru: "Выделенный текст расшифрован!",
        kz: "Таңдалған мәтін шифрдан шығарылды!"
    },
    prompt_encrypt: {
        en: "Enter password to encrypt",
        ru: "Введите пароль для шифрования",
        kz: "Шифрлау үшін құпия сөзді енгізіңіз"
    },
    prompt_decrypt: {
        en: "Enter password to decrypt",
        ru: "Введите пароль для расшифровки",
        kz: "Дешифрлау үшін құпия сөзді енгізіңіз"
    },
    error_getting_key: {
        en: "Failed to obtain key.",
        ru: "Не удалось получить ключ.",
        kz: "Кілтті алу мүмкін болмады."
    }
};
// Определяем язык по системе
const systemLang = vscode.env.language; // 'en', 'ru', 'kk', etc.
const lang = systemLang.startsWith('ru') ? 'ru' :
    systemLang.startsWith('kk') ? 'kz' : 'en';
function t(id, params) {
    var _a;
    let message = ((_a = messages[id]) === null || _a === void 0 ? void 0 : _a[lang]) || id;
    if (params) {
        for (const key in params) {
            message = message.replace(`{${key}}`, params[key]);
        }
    }
    return message;
}
