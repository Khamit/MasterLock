# MasterLock - VSCode Extension

![VSCode](https://img.shields.io/badge/Visual%20Studio%20Code-1.104.0+-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.15-green.svg)
![License](https://img.shields.io/badge/license-MIT-orange.svg)

<p align="center">
  <img src="https://raw.githubusercontent.com/Khamit/MasterLock/main/resources/logo.png" alt="MasterLock Logo" width="200"/>
</p>

<p align="center">
  <strong>Protect and encrypt sensitive data in JSON and configuration files directly in VSCode</strong>
</p>

## Overview

MasterLock is a VSCode extension designed to protect sensitive project data by encrypting selected text. It helps developers securely manage passwords, API keys, tokens, and other confidential information within their projects without exposing them in version control. It features a 2-hour auto-unlock mechanism with automatic state restoration.

## Live Demo

Watch how MasterLock works in action:

![MasterLock Demo](https://raw.githubusercontent.com/Khamit/MasterLock/main/src/demo/test800.gif)

*Demo shows: Selecting sensitive data -> Encrypting with password -> Verifying encryption -> Decrypting back*

## Key Features

### Core Security
- **VS Code Secret Storage**: Uses the native `context.secrets` API to securely store the SHA-256 hash of the encryption password.
- **AES-256 Encryption**: Utilizes `crypto-js` for robust encryption of sensitive data.
- **Data Prefixing**: Encrypted values are marked with the `MLK1:` prefix for reliable format detection.
- **2-Hour Auto-Unlock**: Automatic decryption and restoration of original text after a 2-hour timeout for safety, with state persistence across VS Code sessions.

### Smart Detection
- **Extensive Keyword List**: Automatically detects passwords, tokens, API keys, and secrets based on a comprehensive list of sensitive keywords.
- **Pattern-Based Matching**: Recognizes keys even with prefixes or suffixes (e.g., `stripe_live_key`).
- **Multi-Format Support**: Works with JSON, .env (and its variants), .txt, .cfg, .conf, .config, .ini, and .properties files.
- **Recursive Processing**: Handles nested objects and complex JSON structures.

### VSCode Integration
- **Context Menu Commands**: Right-click any text selection to encrypt or decrypt.
- **Status Bar Indicator**: Shows the current lock state with visual feedback.
- **Secure Password Prompts**: Uses secure input boxes for password entry.
- **Progress Notifications**: Provides visual feedback during encryption/decryption operations.

### Internationalization
- English (en)
- Russian (ru)
- Kazakh (kz)

## Project Structure

```text
MasterLock/
├── package.json                 # Extension manifest and configuration
├── tsconfig.json                # TypeScript configuration
├── README.md                    # Documentation
├── src/                         # Source code
│   ├── extension.ts             # Main entry point, lifecycle, and UI logic
│   ├── masterLock.ts            # Core encryption/decryption logic
│   ├── i18n.ts                  # Internationalization and localization
│   ├── struct.ts                # File parsing rules and sensitive keywords
│   └── utils.ts                 # Helper functions
├── resources/                   # Icons and assets
│   ├── light/                   # Icons for light themes
│   ├── dark/                    # Icons for dark themes
│   └── logo.png                 # Extension logo
└── out/                         # Compiled JavaScript output (generated)
```

## Installation

### From VSIX (Development)
1. Clone or download this repository.
2. Open VSCode.
3. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac).
4. Run `Extensions: Install from VSIX...`.
5. Select the MasterLock VSIX file.

### From Marketplace (When Published)
1. Open VSCode.
2. Go to Extensions view (`Ctrl+Shift+X`).
3. Search for "MasterLock".
4. Click **Install**.

## Usage

### Encrypting and Decrypting Data
1. Open a supported file (e.g., `.json`, `.env`).
2. Select the text or value you want to protect.
3. Right-click and select **MasterLock** (or **MasterUnlock** if already encrypted), or run the `MasterLock encrypt` command from the Command Palette.
4. Enter your password when prompted. 
   - *Note: The first password you enter for a workspace becomes the stored hash for that workspace.*
5. The selected text will be replaced with an encrypted string starting with `MLK1:`.

### Auto-Unlock Behavior
- Once encrypted, a 2-hour timer starts.
- If VS Code is closed and reopened, the timer resumes based on the elapsed time.
- After 2 hours, the extension automatically restores the original text from the workspace state and clears the encrypted data.

## Configuration

Add the following to your `.gitignore` to prevent committing generated files:

```text
out/
node_modules/
```
*Note: MasterLock does not create external lock files. All backup states are stored securely within VS Code's workspace state.*

## Troubleshooting

**Q: "Command not found"**
A: Ensure the extension is activated. Try reloading the VS Code window (`Developer: Reload Window`).

**Q: "Failed to parse file"**
A: Check the file format. MasterLock strictly supports JSON, .env variants, and specific text config formats (.ini, .cfg, .properties, etc.). Malformed JSON will cause parsing to fail.

**Q: "Incorrect password" error**
A: The password hash is stored per workspace using VS Code's Secret Storage. Ensure you are entering the exact password used when the data was first encrypted in this workspace.

**Q: Auto-unlock is not working**
A: Auto-unlock relies on VS Code's `workspaceState`. Do not manually edit or remove the `MLK1:` prefix, as this corrupts the restoration mapping.

## Development

### Prerequisites
- Node.js 16+
- npm 8+
- Visual Studio Code 1.104.0+

### Building from Source
```bash
# Clone the repository
git clone https://github.com/Khamit/MasterLock.git
cd MasterLock

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Package extension
npm run package
```

### Testing
```bash
# Open in Extension Development Host
code .
# Press F5 to launch the extension development host and debug
```

## File Descriptions

### Core Files
- `src/extension.ts`: Main extension entry point, handles VS Code lifecycle, status bar, and command registration.
- `src/masterLock.ts`: Core encryption/decryption logic, password verification, and object traversal.
- `src/i18n.ts`: Internationalization and localization support.
- `src/struct.ts`: File parsing rules, stringification logic, and the extensive list of sensitive keywords.
- `src/utils.ts`: Utility functions.

### Configuration
- `package.json`: Extension manifest with commands, menus, and dependencies.
- `tsconfig.json`: TypeScript compilation settings.

### Available Commands
- `masterlock.toggleSelection`: Encrypts or decrypts the selected text based on its current state.
- `masterlock.showLogo`: Displays the extension's welcome webview.
- `masterlock.test`: A simple test command for development verification.

## Contributing

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

## Version History

### Version 1.0.14 (Current)
- Updated VS Code engine requirement to ^1.104.0.
- Refined auto-unlock logic with persistent workspace state tracking.
- Improved error handling and detailed error reporting with GitHub issue links.
- Expanded support for .env variants (.env.local, .env.production, etc.).

### Version 1.0.10
- Added animated GIF demo.
- Enhanced file type support (.txt, .cfg, .conf, .config, .ini, .properties).
- Expanded sensitive keys list for better pattern-based detection.
- Improved multi-language support (en, ru, kz).

### Version 1.0.9
- Fixed notification UI.
- Improved status bar integration.

### Version 1.0.8
- Added logo UI webview.
- Implemented theme-aware icons.

### Version 1.0.7
- Initial release.
- Basic AES-256 encryption/decryption.
- JSON and .env support.

---
**Important:** Always remember your encryption password. While the hash is stored securely, the actual password is required for decryption. Ensure you do not manually alter the `MLK1:` encrypted strings, as this will prevent successful decryption and auto-restoration.
