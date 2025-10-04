// struct.ts
export type FileRule = {
  extension: string; // расширение файла
  parse: (text: string) => any; // функция парсинга в объект
  stringify: (obj: any) => string; // функция превращения объекта обратно в текст
  sensitiveKeys: string[]; // ключи, которые нужно шифровать
};

export const fileRules: FileRule[] = [
  {
    extension: '.json',
    parse: JSON.parse,
    stringify: (obj: any) => JSON.stringify(obj, null, 2), // сохраняем форматирование
    sensitiveKeys: ['user','auth', 'login', 'secret', 'api', 'pass', 'password', 'token', 'key']
  },
  {
    extension: '.env',
    parse: (text: string) => {
      const obj: Record<string, string> = {};
      text.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)$/);
        if (match) {
          obj[match[1]] = match[2];
        }
      });
      return obj;
    },
    stringify: (obj: Record<string, string>) => {
      return Object.entries(obj).map(([k, v]) => `${k}=${v}`).join('\n');
    },
    sensitiveKeys: ['USER', 'LOGIN', 'SECRET', 'API', 'PASS', 'PASSWORD', 'TOKEN', 'KEY']
  },
  {
    extension: '.yml',
    parse: (text: string) => {
      // можно подключить yaml-парсер позже
      // для примера пока простой объект
      return {}; 
    },
    stringify: (obj: any) => '',
    sensitiveKeys: ['user', 'login', 'secret', 'api', 'pass', 'password', 'token', 'key']
  }
];
