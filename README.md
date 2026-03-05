# MasterLock - VSCode Extension

![VSCode](https://img.shields.io/badge/Visual%2520Studio%2520Code-1.67.0+-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-4.0+-blue.svg)

## Overview

MasterLock is a VSCode extension designed to protect sensitive project data by encrypting it with system-level security. It helps developers securely manage passwords, API keys, and other confidential information within their projects without exposing them in version control.

## MasterLock

 Protect and encrypt your secrets in VSCode.

## 🔐 Features

MasterLock helps you hide and protect sensitive information directly in VSCode.

### Core Functionality

1. **Key Management via Keytar**  
   - MasterLock creates and stores a unique key in the system’s secure storage (via [keytar](https://github.com/atom/node-keytar)).  
   - The key is generated from the password you provide using SHA-256.  
   - Entering the wrong password will prevent access to encrypted content.  

2. **Encryption & Decryption**  
   - Uses **AES (CryptoJS)** for strong symmetric encryption.  
   - Available commands:  
     - `MasterLock: Encrypt Selection` — encrypt the selected text.  
     - `MasterLock: Decrypt Selection` — decrypt the selected text.  

3. **File Format Support**  
   - Rules (`FileRule`) are applied depending on the file extension.  
   - Sensitive keys are automatically detected (e.g., `password`, `key`, `token`, secret`).  

4. **Recursive Object Handling**  
   - Works with strings, JSON, YAML, and other configuration objects.  
   - Nested fields are parsed and processed recursively.  

5. **VSCode Integration**  
   - Commands are available via the editor’s context menu when text is selected.  
   - Status bar shows the current state: 🔓 `MasterUnlocked` or 🔒 `MasterLocked`.  
   - Secure password input is requested via VSCode’s `InputBox`.  

### Example Usage

1. Select a block of code or JSON containing sensitive data.  
2. Open the Command Palette (`Ctrl+Shift+P`) → choose `MasterLock: Encrypt Selection`.  
3. Enter your password (stored securely in the system’s keychain).  
4. The selected text will be replaced with the encrypted version.  

To decrypt, repeat the steps and select `MasterLock: Decrypt Selection`. 
## 🎬 Demo

Here’s how MasterLock works in action:

![MasterLock Demo](resources/demo.gif)

### Sensitive Data Types

By default, MasterLock detects and processes keys such as:  
- `password`, `pass`, `pwd`  
- `key`, `secret`, `token`  
- and similar variations  


## Features

- 🔒 **Secure Encryption**: Encrypts sensitive data using system-level security  
- 📁 **Dedicated Storage**: Encrypted data stored in `lock_data/` directory  
- 🛡️ **Git Protection**: Prevents accidental commits of sensitive information 
- 🌐 **Internationalization**: Multi-language support built-in 

## Future Features
- 👁️ **Visual Indicators**: Icons show protected vs unprotected resources **(in future)** 
- 🔑 **System Integration**: Leverages system authentication for access control  **(in future)** 
- 🎨 **Theme Support**: Dark and light theme icons **(in future)** 

## Project Structure

```
MasterLock/
├── package.json                 # VSCode extension configuration
├── package-lock.json            # NPM dependency lock file
├── tsconfig.json                # TypeScript configuration
├── README.md                    # Project documentation
├── lock_data/                   # Folder for storing encrypted project data
│   └── secrets.enc              # Encrypted secrets file
├── node_modules/                # NPM dependencies (auto-generated)
├── out/                         # Compiled JavaScript output
├── resources/                   # Extension resources and icons
│   ├── dark/                    # Dark theme icons
│   │   ├── lock.svg             # Lock icon for dark theme
│   │   └── unlock.svg           # Unlock icon for dark theme
│   └── light/                   # Light theme icons
│       ├── lock.svg             # Lock icon for light theme
│       └── unlock.svg           # Unlock icon for light theme
└── src/                         # Source code
    ├── extension.ts             # Main entry point of the extension
    ├── masterLock.ts            # Core encryption/decryption logic
    ├── i18n.ts                  # Internationalization support
    ├── struct.ts                # Data structure definitions
    ├── utils.ts                 # Helper functions and utilities
    └── types/                   # TypeScript type definitions
        └── crypto/
            └── crypto-js.d.ts   # Crypto-js type definitions
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

## Security Notes

- 🔐 Encrypted data is stored in `lock_data/secrets.enc`  
- 🚫 Never commit the `lock_data/` directory to version control  
- 🔑 Access requires system authentication  
- 📝 Supports encryption of various sensitive data types  
- 🌐 Built with internationalization support for global use  

## Development

### Prerequisites

- Node.js  
- npm  
- Visual Studio Code  

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

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:

- Open an issue on GitHub  
- Check the documentation  
- Review the extension configuration in `package.json`  

## Version History

### 1.0.9
1.0.9 - fixed notification UI
1.0.8 - added logo UI
1.0.7 package.json → version 1.0.8.
- added logo - for UI
-----------------------------------------------------
- Initial release  
- Basic encryption/decryption functionality  
- VSCode integration  
- Theme-aware icons  
- Internationalization support  

**Important:** Always backup your encryption keys and ensure the `lock_data` directory is properly excluded from version control systems. The `out/` and `node_modules/` directories should also be excluded as they contain generated files and dependencies.

