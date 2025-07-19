#!/usr/bin/env node

/**
 * JogoTesto Terminal Game Client - CLI Entry Point
 * Command-line interface for the terminal-based test client
 */

const TerminalGameClient = require('./client');
const { SERVER_CONFIG } = require('./config');

/**
 * Display usage information
 */
function showUsage() {
  console.log(`
JogoTesto Terminal Game Client

Usage: node src/testClient/index.js [options]

Options:
  --server <url>      Server URL to connect to (default: ${SERVER_CONFIG.DEFAULT_URL})
  --no-colors         Disable terminal colors
  --no-auto-connect   Don't auto-connect on startup
  --batch <file>      Run commands from file (for automation)
  --help, -h          Show this help message
  --version, -v       Show version information

Examples:
  node src/testClient/index.js
  node src/testClient/index.js --server http://localhost:3000
  node src/testClient/index.js --no-colors
  node src/testClient/index.js --batch commands.txt

Interactive Commands:
  /help               Show available game commands
  /look, /l           Look around the current room
  /go <direction>     Move in a direction (north, south, east, west, etc.)
  /exit, /quit, /q    Exit the client
  
  Any other text will be sent as a chat message to other players in your room.
`);
}

/**
 * Display version information
 */
function showVersion() {
  try {
    const packageJson = require('../../package.json');
    console.log(`JogoTesto Terminal Client v${packageJson.version}`);
  } catch (_error) {
    console.log('JogoTesto Terminal Client (version unknown)');
  }
}

/**
 * Parse command line arguments
 * @param {Array<string>} args - Command line arguments
 * @returns {Object} Parsed options object
 */
function parseArguments(args) {
  const options = {
    serverUrl: SERVER_CONFIG.DEFAULT_URL,
    useColors: true,
    autoConnect: true,
    batchFile: null,
    showHelp: false,
    showVersion: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
    case '--help':
    case '-h':
      options.showHelp = true;
      break;
        
    case '--version':
    case '-v':
      options.showVersion = true;
      break;
        
    case '--server':
      if (i + 1 < args.length) {
        options.serverUrl = args[i + 1];
        i++; // Skip next argument
      } else {
        console.error('Error: --server requires a URL argument');
        process.exit(1);
      }
      break;
        
    case '--no-colors':
      options.useColors = false;
      break;
        
    case '--no-auto-connect':
      options.autoConnect = false;
      break;
        
    case '--batch':
      if (i + 1 < args.length) {
        options.batchFile = args[i + 1];
        i++; // Skip next argument
      } else {
        console.error('Error: --batch requires a file path argument');
        process.exit(1);
      }
      break;
        
    default:
      if (arg.startsWith('--')) {
        console.error(`Error: Unknown option ${arg}`);
        console.error('Use --help for usage information');
        process.exit(1);
      }
      break;
    }
  }

  return options;
}

/**
 * Load and execute batch commands from file
 * @param {string} filePath - Path to batch command file
 * @param {TerminalGameClient} client - Client instance
 */
async function executeBatchFile(filePath, client) {
  const fs = require('fs');
  const path = require('path');
  
  try {
    console.log(`Loading batch commands from: ${filePath}`);
    
    const fullPath = path.resolve(filePath);
    const content = fs.readFileSync(fullPath, 'utf8');
    const commands = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#')); // Filter empty lines and comments

    if (commands.length === 0) {
      console.log('No commands found in batch file');
      return;
    }

    console.log(`Executing ${commands.length} batch commands...`);
    
    // Wait for connection if auto-connect is enabled
    if (client.autoConnect) {
      console.log('Waiting for connection...');
      let attempts = 0;
      while (!client.isConnected && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
      
      if (!client.isConnected) {
        console.error('Failed to connect to server. Cannot execute batch commands.');
        return;
      }
    }

    // Execute commands with delay
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      console.log(`> ${command}`);
      
      const result = await client.executeCommand(command);
      if (!result.success) {
        console.error(`Command failed: ${result.error}`);
      }
      
      // Add delay between commands
      if (i < commands.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log('Batch execution completed');
    
  } catch (error) {
    console.error(`Failed to execute batch file: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Validate server URL
 * @param {string} url - URL to validate
 * @returns {boolean} True if URL is valid
 */
function validateServerUrl(url) {
  try {
    const parsedUrl = new globalThis.URL(url);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch (_error) {
    return false;
  }
}

/**
 * Main application entry point
 */
async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const options = parseArguments(args);

    // Handle help and version flags
    if (options.showHelp) {
      showUsage();
      process.exit(0);
    }

    if (options.showVersion) {
      showVersion();
      process.exit(0);
    }

    // Validate server URL
    if (!validateServerUrl(options.serverUrl)) {
      console.error(`Error: Invalid server URL: ${options.serverUrl}`);
      console.error('URL must start with http:// or https://');
      process.exit(1);
    }

    // Display startup information
    console.log('JogoTesto Terminal Game Client');
    console.log('=====================================');
    console.log(`Server: ${options.serverUrl}`);
    console.log(`Colors: ${options.useColors ? 'enabled' : 'disabled'}`);
    console.log(`Auto-connect: ${options.autoConnect ? 'enabled' : 'disabled'}`);
    if (options.batchFile) {
      console.log(`Batch file: ${options.batchFile}`);
    }
    console.log('=====================================\n');

    // Create and start the client
    const client = new TerminalGameClient({
      serverUrl: options.serverUrl,
      useColors: options.useColors,
      autoConnect: options.autoConnect
    });

    const started = await client.start();
    if (!started) {
      console.error('Failed to start terminal client');
      process.exit(1);
    }

    // Execute batch file if specified
    if (options.batchFile) {
      // Run batch commands in the background
      setTimeout(() => {
        executeBatchFile(options.batchFile, client);
      }, 1000); // Give client time to start up
    }

    // Client is now running interactively
    console.log('Type /help for available commands or /exit to quit\n');

  } catch (error) {
    console.error('Fatal error:', error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Handle uncaught exceptions gracefully
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
if (require.main === module) {
  main();
}

module.exports = {
  main,
  parseArguments,
  validateServerUrl,
  showUsage,
  showVersion
};