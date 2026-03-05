# MasterLock - VSCode Extension

![VSCode](https://img.shields.io/badge/Visual%20Studio%20Code-1.67.0+-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.10-green.svg)
![License](https://img.shields.io/badge/license-MIT-orange.svg)

<p align="center">
  <img src="https://raw.githubusercontent.com/Khamit/MasterLock/main/resources/logo.png" alt="MasterLock Logo" width="200"/>
</p>

<p align="center">
  <strong>🔒 Protect and encrypt your secrets directly in VSCode</strong>
</p>

##  Overview

MasterLock is a powerful VSCode extension designed to protect sensitive project data by encrypting it with system-level security. It helps developers securely manage passwords, API keys, tokens, and other confidential information within their projects without exposing them in version control.

##  Live Demo

Watch how MasterLock works in action (1MB GIF):

![MasterLock Demo](https://raw.githubusercontent.com/Khamit/MasterLock/main/src/demo/test800.gif)

*Demo shows: Selecting sensitive data → Encrypting with password → Verifying encryption → Decrypting back*

## ✨ Key Features

### 🔐 **Core Security**
- **System-Level Key Storage** - Uses [keytar](https://github.com/atom/node-keytar) to securely store encryption keys in the native system keychain
- **AES-256 Encryption** - Military-grade encryption for your sensitive data
- **SHA-256 Key Derivation** - Passwords are never stored, only their secure hashes
- **2-Hour Auto-Unlock** - Automatic decryption after timeout for safety

###  **Smart Detection**
- **500+ Sensitive Keywords** - Automatically detects passwords, tokens, API keys, secrets
- **Pattern-Based Matching** - Recognizes keys even with prefixes/suffixes (e.g., `stripe_live_key`)
- **Multi-Format Support** - Works with JSON, .env, YAML, INI, and text config files
- **Recursive Processing** - Handles nested objects and complex structures

###  **VSCode Integration**
- **Context Menu Commands** - Right-click any selection to encrypt/decrypt
- **Status Bar Indicator** - Shows current lock state with countdown timer
- **Password Prompts** - Secure input boxes for password entry
- **Progress Notifications** - Visual feedback during operations

### 🌐 **Internationalization**
- English (en)
- Russian (ru)
- Kazakh (kz)

## Project Structure

```
MasterLock/
├── package.json                 # Extension manifest
├── tsconfig.json                # TypeScript config
├── README.md                     # Documentation
├── 📁 src/                          # Source code
│   ├── extension.ts              # Main entry point
│   ├── masterLock.ts             # Core encryption logic
│   ├── i18n.ts                    # Internationalization
│   ├── struct.ts                  # Data structures
│   ├── utils.ts                   # Helper functions
│   ├── 📁 demo/                       # Demo files
│   │   └── test800.gif               # Animated demo (1MB)
│   └── 📁 types/                      # Type definitions
│       └── crypto/
│           └── crypto-js.d.ts
├── 📁 resources/                      # Icons and assets
│   ├── 📁 light/
│   │   ├── lock.svg
│   │   └── unlock.svg
│   ├── 📁 dark/
│   │   ├── lock.svg
│   │   └── unlock.svg
│   └── logo.png
└── 📁 lock_data/                      # Encrypted storage
    └── secrets.enc                    # Your encrypted data
```

## Installation

### From VSIX (Development)

1. Clone or download this repository  
2. Open VSCode  
3. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)  
4. Run `Extensions: Install from VSIX...`  
5. Select the MasterLock VSIX file  

### From Marketplace (When Published)

1. Open VSCode  
2. Go to Extensions view (`Ctrl+Shift+X`)  
3. Search for "MasterLock"  
4. Click **Install**  

## Usage

### Protecting Sensitive Data

1. Open Command Palette (`Ctrl+Shift+P`)  
2. Run "MasterLock: Protect Secrets"  
3. Follow prompts to select files or enter sensitive data  
4. Access protected data using "MasterLock: View Protected Data"  

### Icons

- 🔓 **Unlock Icon**: Indicates unprotected or public resources  
- 🔒 **Lock Icon**: Indicates protected/encrypted resources  

Icons are available in both dark and light themes for optimal visibility.

## Configuration

Add to your `.gitignore`:

```
lock_data/
*.enc
out/
node_modules/
```

## Troubleshooting
Common Issues
Q: "Command not found"
A: Ensure extension is activated. Try reloading VSCode window.

Q: "Failed to parse file"
A: Check file format. MasterLock supports JSON, .env, and text config files.

Q: "Wrong password" error
A: Each project uses its own password. The first password you set becomes the permanent key.

Q: Auto-unlock not working
A: Check that you haven't manually edited encrypted files. Backup is stored in workspace state.

## Development

### Prerequisites

- Node.js 16+
- npm 8+
- Visual Studio Code 1.67.0+

### Building from Source

```bash
# Clone the repository
git clone <repository-url>
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
# Run tests
npm test

# Open in Extension Development Host
code .
# Press F5 to launch extension development host
```

## File Descriptions

### Core Files

- `src/extension.ts` - Main extension entry point, handles VSCode integration  
- `src/masterLock.ts` - Core encryption/decryption logic and security features  
- `src/i18n.ts` - Internationalization and localization support  
- `src/struct.ts` - Data structures and type definitions  
- `src/utils.ts` - Utility functions and helpers  

### Resource Files

- `resources/dark/` - SVG icons optimized for dark themes  
- `resources/light/` - SVG icons optimized for light themes  

### Configuration

- `package.json` - Extension manifest with commands and configuration  
- `tsconfig.json` - TypeScript compilation settings  

### Commands

- `masterlock.protectSecrets` - Encrypt and protect sensitive data  
- `masterlock.viewProtected` - View protected data (requires authentication)  
- `masterlock.unlockData` - Temporarily unlock data for editing  

## Contributing

1. Fork the repository  
2. Create a feature branch (`git checkout -b feature/amazing-feature`)  
3. Commit your changes (`git commit -m 'Add amazing feature'`)  
4. Push to the branch (`git push origin feature/amazing-feature`)  
5. Open a Pull Request  

## Version History

### Version 1.0.10 (Latest)
- Added animated GIF demo - 1MB showcase of MasterLock in action
- Enhanced file type support - Now supports .txt, .cfg, .conf, .config, .ini, .-operties
- Expanded sensitive keys - 500+ keywords for better detection
- Improved auto-unlock - Persistent state across VS Code sessions
- Better i18n - Enhanced multi-language support
- Bug fixes - Fixed JSON parsing errors with non-standard structures

Version 1.0.9
- Fixed notification UI
- Improved status bar integration

Version 1.0.8
- Added logo UI
- Theme-aware icons

Version 1.0.7
- Initial release
- Basic encryption/decryption
- JSON and .env support
-----------------------------------------------------
- Initial release  
- Basic encryption/decryption functionality  
- VSCode integration  
- Theme-aware icons  
- Internationalization support  

**Important:** Always backup your encryption keys and ensure the `lock_data` directory is properly excluded from version control systems. The `out/` and `node_modules/` directories should also be excluded as they contain generated files and dependencies.

