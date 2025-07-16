/**
 * JogoTesto - Client-side JavaScript for Multiplayer Text RPG
 * Handles Socket.IO communication and user interface interactions
 */

/**
 * Global variables and configuration
 */
let socket = null;
let isConnected = false;
let playerId = null;
let pingInterval = null;

/**
 * DOM element references
 */
const elements = {
  messages: null,
  messageInput: null,
  sendButton: null,
  connectionStatus: null,
  playerCount: null,
  characterCount: null,
  playerId: null,
  ping: null,
  errorModal: null,
  errorMessage: null,
  closeErrorModal: null
};

/**
 * Initialize the client application
 */
function init() {
  // Get DOM element references
  elements.messages = document.getElementById('messages');
  elements.messageInput = document.getElementById('messageInput');
  elements.sendButton = document.getElementById('sendButton');
  elements.connectionStatus = document.getElementById('connectionStatus');
  elements.playerCount = document.getElementById('playerCount');
  elements.characterCount = document.getElementById('characterCount');
  elements.playerId = document.getElementById('playerId');
  elements.ping = document.getElementById('ping');
  elements.errorModal = document.getElementById('errorModal');
  elements.errorMessage = document.getElementById('errorMessage');
  elements.closeErrorModal = document.getElementById('closeErrorModal');

  // Set up event listeners
  setupEventListeners();

  // Initialize Socket.IO connection
  connectToServer();
}

/**
 * Set up event listeners for UI interactions
 */
function setupEventListeners() {
  // Send button click
  elements.sendButton.addEventListener('click', sendMessage);

  // Enter key press in input field
  elements.messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Character count update
  elements.messageInput.addEventListener('input', updateCharacterCount);

  // Error modal close
  elements.closeErrorModal.addEventListener('click', closeErrorModal);

  // Close modal on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && elements.errorModal.style.display !== 'none') {
      closeErrorModal();
    }
  });

  // Enable debug info toggle (click on footer)
  document.querySelector('.footer').addEventListener('dblclick', toggleDebugInfo);
}

/**
 * Connect to the Socket.IO server
 */
function connectToServer() {
  try {
    // Update connection status
    updateConnectionStatus('connecting');
        
    // Initialize Socket.IO connection
    socket = io({
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 20000
    });

    // Set up socket event listeners
    setupSocketListeners();
        
  } catch (error) {
    console.error('Failed to connect to server:', error);
    showError('Failed to connect to server. Please refresh the page and try again.');
  }
}

/**
 * Set up Socket.IO event listeners
 */
function setupSocketListeners() {
  // Connection established
  socket.on('connect', () => {
    console.log('Connected to server');
    isConnected = true;
    playerId = socket.id;
    updateConnectionStatus('connected');
    enableInput();
        
    // Update debug info
    if (elements.playerId) {
      elements.playerId.textContent = playerId;
    }
        
    // Start ping monitoring
    startPingMonitoring();
        
    addSystemMessage('Connected to JogoTesto server!');
  });

  // Connection error
  socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    updateConnectionStatus('disconnected');
    disableInput();
    addSystemMessage(`Connection error: ${error.message}`, 'error');
  });

  // Disconnection
  socket.on('disconnect', (reason) => {
    console.log('Disconnected from server:', reason);
    isConnected = false;
    updateConnectionStatus('disconnected');
    disableInput();
    stopPingMonitoring();
        
    if (reason === 'io server disconnect') {
      addSystemMessage('Disconnected by server', 'error');
    } else {
      addSystemMessage('Connection lost. Attempting to reconnect...', 'error');
    }
  });

  // Reconnection attempt
  socket.on('reconnect_attempt', (attemptNumber) => {
    console.log(`Reconnection attempt ${attemptNumber}`);
    updateConnectionStatus('connecting');
    addSystemMessage(`Reconnecting... (attempt ${attemptNumber})`, 'system');
  });

  // Reconnection successful
  socket.on('reconnect', (attemptNumber) => {
    console.log(`Reconnected after ${attemptNumber} attempts`);
    addSystemMessage('Reconnected successfully!', 'system');
  });

  // Reconnection failed
  socket.on('reconnect_failed', () => {
    console.error('Failed to reconnect');
    addSystemMessage('Failed to reconnect. Please refresh the page.', 'error');
  });

  // Message received from other players
  socket.on('messageReceived', (data) => {
    displayPlayerMessage(data);
  });

  // Player joined notification
  socket.on('playerJoined', (data) => {
    addSystemMessage(data.message, 'join');
  });

  // Player left notification
  socket.on('playerLeft', (data) => {
    addSystemMessage(data.message, 'leave');
  });

  // Player count update
  socket.on('playerCount', (data) => {
    updatePlayerCount(data.count);
  });

  // Server error
  socket.on('error', (data) => {
    console.error('Server error:', data);
    showError(data.message || 'Server error occurred');
  });

  // Pong response for ping monitoring
  socket.on('pong', (latency) => {
    if (elements.ping) {
      elements.ping.textContent = latency;
    }
  });

  // Game Master message
  socket.on('gameMasterMessage', (data) => {
    displayGameMasterMessage(data);
  });

  // Room chat message
  socket.on('roomChatMessage', (data) => {
    displayRoomChatMessage(data);
  });
}

/**
 * Send a message to the server
 */
function sendMessage() {
  const messageText = elements.messageInput.value.trim();
    
  if (!messageText) {
    return;
  }
    
  if (!isConnected) {
    showError('Not connected to server');
    return;
  }
    
  if (messageText.length > 500) {
    showError('Message too long (max 500 characters)');
    return;
  }
    
  try {
    // Send message to server
    socket.emit('playerMessage', {
      text: messageText,
      timestamp: new Date().toISOString()
    });
        
    // Clear input field
    elements.messageInput.value = '';
    updateCharacterCount();
        
  } catch (error) {
    console.error('Error sending message:', error);
    showError('Failed to send message');
  }
}

/**
 * Display a player message in the messages area
 */
function displayPlayerMessage(data) {
  const messageElement = document.createElement('div');
  messageElement.className = 'message player-message';
    
  const isOwnMessage = data.playerId === playerId;
  const playerName = isOwnMessage ? 'You' : `Player ${data.playerId.substring(0, 8)}`;
    
  messageElement.innerHTML = `
        <div class="message-header">
            <strong>${playerName}</strong>
            <span class="timestamp">${formatTimestamp(data.timestamp)}</span>
        </div>
        <div class="message-content">${escapeHtml(data.text)}</div>
    `;
    
  addMessageToDisplay(messageElement);
}

/**
 * Add a system message to the display
 */
function addSystemMessage(text, type = 'system') {
  const messageElement = document.createElement('div');
  messageElement.className = `message ${type}-message`;
    
  messageElement.innerHTML = `
        <div class="message-header">
            <strong>System</strong>
            <span class="timestamp">${formatTimestamp(new Date().toISOString())}</span>
        </div>
        <div class="message-content">${escapeHtml(text)}</div>
    `;
    
  addMessageToDisplay(messageElement);
}

/**
 * Display a Game Master message in the messages area
 */
function displayGameMasterMessage(data) {
  const messageElement = document.createElement('div');
  messageElement.className = 'message gm-message';
    
  messageElement.innerHTML = `
        <div class="message-header">
            <strong>Game Master</strong>
            <span class="timestamp">${formatTimestamp(data.timestamp)}</span>
        </div>
        <div class="message-content">${escapeHtml(data.text)}</div>
    `;
    
  addMessageToDisplay(messageElement);
}

/**
 * Display a room chat message in the messages area
 */
function displayRoomChatMessage(data) {
  const messageElement = document.createElement('div');
  messageElement.className = 'message room-chat-message';
    
  // Add additional class for self messages
  if (data.isSelf) {
    messageElement.classList.add('self-chat');
  }
    
  messageElement.innerHTML = `
        <div class="message-header">
            <strong>Room Chat</strong>
            <span class="timestamp">${formatTimestamp(data.timestamp)}</span>
        </div>
        <div class="message-content">${escapeHtml(data.text)}</div>
    `;
    
  addMessageToDisplay(messageElement);
}

/**
 * Add a message element to the messages display
 */
function addMessageToDisplay(messageElement) {
  elements.messages.appendChild(messageElement);
    
  // Scroll to bottom
  elements.messages.scrollTop = elements.messages.scrollHeight;
    
  // Limit number of messages to prevent memory issues
  const maxMessages = 500;
  while (elements.messages.children.length > maxMessages) {
    elements.messages.removeChild(elements.messages.firstChild);
  }
}

/**
 * Update the connection status display
 */
function updateConnectionStatus(status) {
  elements.connectionStatus.className = `status ${status}`;
    
  switch (status) {
  case 'connected':
    elements.connectionStatus.textContent = 'Connected';
    break;
  case 'connecting':
    elements.connectionStatus.textContent = 'Connecting...';
    break;
  case 'disconnected':
    elements.connectionStatus.textContent = 'Disconnected';
    break;
  }
}

/**
 * Update the player count display
 */
function updatePlayerCount(count) {
  elements.playerCount.textContent = `Players: ${count}`;
}

/**
 * Update the character count display
 */
function updateCharacterCount() {
  const currentLength = elements.messageInput.value.length;
  elements.characterCount.textContent = `${currentLength}/500`;
    
  // Update styling based on character count
  elements.characterCount.className = 'character-count';
  if (currentLength > 450) {
    elements.characterCount.classList.add('error');
  } else if (currentLength > 400) {
    elements.characterCount.classList.add('warning');
  }
}

/**
 * Enable the input field and send button
 */
function enableInput() {
  elements.messageInput.disabled = false;
  elements.sendButton.disabled = false;
  elements.messageInput.focus();
}

/**
 * Disable the input field and send button
 */
function disableInput() {
  elements.messageInput.disabled = true;
  elements.sendButton.disabled = true;
}

/**
 * Show an error modal
 */
function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorModal.style.display = 'flex';
}

/**
 * Close the error modal
 */
function closeErrorModal() {
  elements.errorModal.style.display = 'none';
}

/**
 * Toggle debug information display
 */
function toggleDebugInfo() {
  const debugInfo = document.getElementById('debugInfo');
  debugInfo.style.display = debugInfo.style.display === 'none' ? 'block' : 'none';
}

/**
 * Start ping monitoring
 */
function startPingMonitoring() {
  if (pingInterval) {
    clearInterval(pingInterval);
  }
    
  pingInterval = setInterval(() => {
    if (isConnected) {
      const start = Date.now();
      socket.emit('ping', start);
    }
  }, 5000);
}

/**
 * Stop ping monitoring
 */
function stopPingMonitoring() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Escape HTML characters to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Initialize the application when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', init);

// Export for testing purposes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    init,
    sendMessage,
    displayPlayerMessage,
    addSystemMessage,
    displayGameMasterMessage,
    displayRoomChatMessage,
    formatTimestamp,
    escapeHtml
  };
}