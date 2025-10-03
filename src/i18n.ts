import * as vscode from 'vscode';

type Language = 'en' | 'ru' | 'kz';

const messages: Record<string, Record<Language, string>> = {
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
const lang: Language = systemLang.startsWith('ru') ? 'ru' :
                       systemLang.startsWith('kk') ? 'kz' : 'en';

export function t(id: string, params?: Record<string, string>) {
  let message = messages[id]?.[lang] || id;
  if (params) {
    for (const key in params) {
      message = message.replace(`{${key}}`, params[key]);
    }
  }
  return message;
}
