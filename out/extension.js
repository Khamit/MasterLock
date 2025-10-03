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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const i18n_1 = require("./i18n");
const masterLock_1 = require("./masterLock");
let statusBar;
function activate(context) {
    // создаём статус-бар
    statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.command = 'masterlock.toggleSelection';
    context.subscriptions.push(statusBar);
    // инициализация контекста
    vscode.commands.executeCommand('setContext', 'masterlock.isEncrypted', false);
    updateStatusBar(false);
    statusBar.show();
    // команда переключения
    const toggleDisposable = vscode.commands.registerCommand('masterlock.toggleSelection', () => __awaiter(this, void 0, void 0, function* () {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            vscode.window.showInformationMessage((0, i18n_1.t)('info_select_text'));
            return;
        }
        const selectionText = editor.document.getText(editor.selection);
        const isEncrypted = selectionText.includes('U2FsdGVk'); // простая проверка CryptoJS
        const result = yield (0, masterLock_1.toggleEncryptSelection)(!isEncrypted);
        if (!result) {
            // Показываем уведомления только при отмене операции
            return;
        }
        const newStatus = !isEncrypted;
        vscode.commands.executeCommand('setContext', 'masterlock.isEncrypted', newStatus);
        updateStatusBar(newStatus);
        // Показываем информационное сообщение об успешной операции
        if (newStatus) {
            vscode.window.showInformationMessage((0, i18n_1.t)('info_encrypted'));
        }
        else {
            vscode.window.showInformationMessage((0, i18n_1.t)('info_decrypted'));
        }
    }));
    context.subscriptions.push(toggleDisposable);
}
function updateStatusBar(isEncrypted) {
    if (isEncrypted) {
        statusBar.text = '$(lock) MasterLocked';
        statusBar.tooltip = 'Locked selection';
    }
    else {
        statusBar.text = '$(unlock) MasterUnlocked';
        statusBar.tooltip = 'Unlocked selection';
    }
}
function deactivate() {
    if (statusBar)
        statusBar.dispose();
}
