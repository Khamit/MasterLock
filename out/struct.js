"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileRules = void 0;
exports.fileRules = [
    {
        extension: '.json',
        parse: JSON.parse,
        stringify: (obj) => JSON.stringify(obj, null, 2), // сохраняем форматирование
        sensitiveKeys: ['user', 'login', 'secret', 'api', 'pass', 'password', 'token', 'key']
    },
    {
        extension: '.env',
        parse: (text) => {
            const obj = {};
            text.split('\n').forEach(line => {
                const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)$/);
                if (match) {
                    obj[match[1]] = match[2];
                }
            });
            return obj;
        },
        stringify: (obj) => {
            return Object.entries(obj).map(([k, v]) => `${k}=${v}`).join('\n');
        },
        sensitiveKeys: ['USER', 'LOGIN', 'SECRET', 'API', 'PASS', 'PASSWORD', 'TOKEN', 'KEY']
    },
    {
        extension: '.yml',
        parse: (text) => {
            // можно подключить yaml-парсер позже
            // для примера пока простой объект
            return {};
        },
        stringify: (obj) => '',
        sensitiveKeys: ['user', 'login', 'secret', 'api', 'pass', 'password', 'token', 'key']
    }
];
