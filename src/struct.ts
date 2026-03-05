// src/struct.ts
export type FileRule = {
  extensions: string[]; // список поддерживаемых расширений
  parse: (text: string) => any; // функция парсинга
  stringify: (obj: any) => string; // превращение объекта обратно в текст
  sensitiveKeys: string[]; // ключи для шифрования
};

export const fileRules: FileRule[] = [
  {
    extensions: ['.json'],
    parse: JSON.parse,
    stringify: (obj: any) => JSON.stringify(obj, null, 2),
    sensitiveKeys: ['user','auth','login','secret','api','pass','password','token','key']
  },

{
  extensions: [
    '.env',
    '.env.local',
    '.env.development',
    '.env.production',
    '.env.test'
  ],

  parse: (text: string) => {
    const lines = text.split('\n');

    return lines.map(line => {
      const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)$/);

      if (match) {
        return {
          type: 'pair',
          key: match[1],
          value: match[2].replace(/^['"]|['"]$/g, '')
        };
      }

      // комментарий или пустая строка
      return {
        type: 'raw',
        value: line
      };
    });
  },

  stringify: (arr: any[]) => {
    return arr.map(item => {
      if (item.type === 'pair') {
        return `${item.key}=${item.value}`;
      }
      return item.value;
    }).join('\n');
  },

  sensitiveKeys: ['USER','LOGIN','SECRET','API','PASS','PASSWORD','TOKEN','KEY']
},
/*
{
  extensions: ['.yml', '.yaml'],
  parse: (text: string) => require('js-yaml').load(text),
  stringify: (obj: any) => require('js-yaml').dump(obj),
  sensitiveKeys: ['user','login','secret','api','pass','password','token','key']
}
  */
];
