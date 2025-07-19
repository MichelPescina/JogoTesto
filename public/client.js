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
let sessionData = {
  sessionID: null,
  playerID: null,
  username: null
};
let pingInterval = null;
let currentScreen = 'lobby';
let isInQueue = false;
let currentMatchId = null;
let matchStartTime = null;
let matchTimer = null;

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
  closeErrorModal: null,
  // Lobby elements
  lobbyScreen: null,
  matchmakingScreen: null,
  gameScreen: null,
  usernameInput: null,
  joinMatchButton: null,
  cancelQueueButton: null,
  queuePosition: null,
  playersNeeded: null,
  // Match elements
  matchInfo: null,
  matchId: null,
  matchPlayerCount: null,
  matchTime: null,
  forfeitButton: null
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
  
  // Lobby elements
  elements.lobbyScreen = document.getElementById('lobbyScreen');
  elements.matchmakingScreen = document.getElementById('matchmakingScreen');
  elements.gameScreen = document.getElementById('gameScreen');
  elements.usernameInput = document.getElementById('usernameInput');
  elements.joinMatchButton = document.getElementById('joinMatchButton');
  elements.cancelQueueButton = document.getElementById('cancelQueueButton');
  elements.queuePosition = document.getElementById('queuePosition');
  elements.playersNeeded = document.getElementById('playersNeeded');
  
  // Match elements
  elements.matchInfo = document.getElementById('matchInfo');
  elements.matchId = document.getElementById('matchId');
  elements.matchPlayerCount = document.getElementById('matchPlayerCount');
  elements.matchTime = document.getElementById('matchTime');
  elements.forfeitButton = document.getElementById('forfeitButton');

  // Set up event listeners
  setupEventListeners();

  // Initialize session management
  initializeSession();
  
  // Show appropriate screen based on session
  showInitialScreen();
  
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

  // Lobby event listeners
  if (elements.joinMatchButton) {
    elements.joinMatchButton.addEventListener('click', joinMatchQueue);
  }
  
  if (elements.usernameInput) {
    elements.usernameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        joinMatchQueue();
      }
    });
  }
  
  if (elements.cancelQueueButton) {
    elements.cancelQueueButton.addEventListener('click', cancelQueue);
  }
  
  if (elements.forfeitButton) {
    elements.forfeitButton.addEventListener('click', forfeitMatch);
  }
}

/**
 * Initialize session management from localStorage
 */
function initializeSession() {
  // Restore session from localStorage
  const storedSessionID = localStorage.getItem('sessionID');
  const storedPlayerID = localStorage.getItem('playerID');
  const storedUsername = localStorage.getItem('username');
  
  if (storedSessionID && storedPlayerID) {
    sessionData = {
      sessionID: storedSessionID,
      playerID: storedPlayerID,
      username: storedUsername
    };
    console.log('Restored session from localStorage:', sessionData.playerID);
  } else {
    console.log('No existing session found');
  }
}

/**
 * Save session data to localStorage
 * @param {Object} session - Session data from server
 */
function saveSessionData(session) {
  sessionData = session;
  localStorage.setItem('sessionID', session.sessionID);
  localStorage.setItem('playerID', session.playerID);
  localStorage.setItem('username', session.username);
  console.log('Session data saved to localStorage:', session.playerID);
}

/**
 * Clear session data from localStorage
 */
function clearSessionData() {
  sessionData = {
    sessionID: null,
    playerID: null,
    username: null
  };
  localStorage.removeItem('sessionID');
  localStorage.removeItem('playerID');
  localStorage.removeItem('username');
  console.log('Session data cleared from localStorage');
}

/**
 * Connect to the Socket.IO server with session authentication
 */
function connectToServer() {
  try {
    // Update connection status
    updateConnectionStatus('connecting');
    
    // Prepare authentication data
    const authData = {};
    if (sessionData.sessionID && sessionData.playerID) {
      authData.sessionID = sessionData.sessionID;
      authData.playerID = sessionData.playerID;
      authData.username = sessionData.username;
    }
        
    // Initialize Socket.IO connection with authentication
    socket = io({
      auth: authData,
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
  // Session data received from server
  socket.on('session', (session) => {
    console.log('Session received from server:', session);
    saveSessionData(session);
    playerId = session.playerID;
    
    // Update debug info
    if (elements.playerId) {
      elements.playerId.textContent = playerId;
    }
  });
  
  // Connection established
  socket.on('connect', () => {
    console.log('Connected to server');
    isConnected = true;
    updateConnectionStatus('connected');
    
    // Only enable input if we're in the game screen
    if (currentScreen === 'game') {
      enableInput();
    }
        
    // Start ping monitoring
    startPingMonitoring();
        
    // Only show welcome message if we're in game screen
    if (currentScreen === 'game') {
      const welcomeMessage = sessionData.username 
        ? `Welcome back, ${sessionData.username}!`
        : 'Connected to JogoTesto server!';
      addSystemMessage(welcomeMessage);
    }
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
    
    // Session should be automatically restored by auth middleware
    playerId = sessionData.playerID;
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
  
  // Authentication error
  socket.on('authError', (data) => {
    console.error('Authentication error:', data);
    addSystemMessage(`Authentication failed: ${data.message}`, 'error');
    
    // Clear invalid session data and reconnect
    if (data.action === 'RETRY_CONNECTION') {
      clearSessionData();
      setTimeout(() => {
        socket.disconnect();
        connectToServer();
      }, 2000);
    }
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

  // Matchmaking events
  socket.on('matchmaking', (data) => {
    handleMatchmakingUpdate(data);
  });

  socket.on('matchStarted', (data) => {
    handleMatchStart(data);
  });

  socket.on('matchEnded', (data) => {
    handleMatchEnd(data);
  });

  socket.on('reconnection', (data) => {
    handleReconnection(data);
  });

  socket.on('matchPlayerUpdate', (data) => {
    updateMatchPlayerCount(data.playerCount);
  });
}

/**
 * Show the appropriate initial screen based on session state
 */
function showInitialScreen() {
  if (sessionData.username) {
    // Pre-fill username if available
    if (elements.usernameInput) {
      elements.usernameInput.value = sessionData.username;
    }
  }
  showScreen('lobby');
}

/**
 * Show a specific screen and hide others
 * @param {string} screenName - 'lobby', 'matchmaking', or 'game'
 */
function showScreen(screenName) {
  currentScreen = screenName;
  
  // Hide all screens
  if (elements.lobbyScreen) elements.lobbyScreen.style.display = 'none';
  if (elements.matchmakingScreen) elements.matchmakingScreen.style.display = 'none';
  if (elements.gameScreen) elements.gameScreen.style.display = 'none';
  
  // Show the requested screen
  switch (screenName) {
  case 'lobby':
    if (elements.lobbyScreen) elements.lobbyScreen.style.display = 'flex';
    break;
  case 'matchmaking':
    if (elements.matchmakingScreen) elements.matchmakingScreen.style.display = 'flex';
    break;
  case 'game':
    if (elements.gameScreen) elements.gameScreen.style.display = 'flex';
    enableInput();
    break;
  }
}

/**
 * Join the match queue with username validation
 */
function joinMatchQueue() {
  if (!isConnected) {
    showError('Not connected to server');
    return;
  }
  
  if (isInQueue) {
    showError('Already in queue');
    return;
  }
  
  const username = elements.usernameInput.value.trim();
  
  if (username.length < 2 || username.length > 20) {
    showError('Username must be between 2 and 20 characters');
    elements.usernameInput.focus();
    return;
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    showError('Username can only contain letters, numbers, underscores, and hyphens');
    elements.usernameInput.focus();
    return;
  }
  
  isInQueue = true;
  sessionData.username = username;
  localStorage.setItem('username', username);
  
  socket.emit('joinMatch', { username });
  showScreen('matchmaking');
}

/**
 * Cancel the match queue
 */
function cancelQueue() {
  if (!isInQueue) {
    return;
  }
  
  isInQueue = false;
  socket.emit('cancelQueue');
  showScreen('lobby');
}

/**
 * Forfeit the current match
 */
function forfeitMatch() {
  if (!currentMatchId) {
    return;
  }
  
  if (confirm('Are you sure you want to forfeit this match? You will return to the lobby.')) {
    socket.emit('forfeitMatch');
  }
}

/**
 * Handle matchmaking status updates
 * @param {Object} data - Matchmaking status data
 */
function handleMatchmakingUpdate(data) {
  if (data.status === 'queued') {
    isInQueue = true;
    if (elements.queuePosition) {
      elements.queuePosition.textContent = data.queuePosition || '-';
    }
    if (elements.playersNeeded) {
      const needed = 10 - (data.queuePosition || 0);
      elements.playersNeeded.textContent = Math.max(0, needed);
    }
  } else if (data.status === 'cancelled') {
    isInQueue = false;
    showScreen('lobby');
  }
}

/**
 * Handle match start
 * @param {Object} data - Match start data
 */
function handleMatchStart(data) {
  isInQueue = false;
  currentMatchId = data.matchId;
  matchStartTime = Date.now();
  
  // Update match info
  if (elements.matchInfo) {
    elements.matchInfo.style.display = 'inline';
  }
  if (elements.matchId) {
    elements.matchId.textContent = data.matchId;
  }
  
  // Start match timer
  startMatchTimer();
  
  // Show game screen
  showScreen('game');
  
  // Add match start message
  addMatchMessage(`Match started! ${data.playerCount} players are competing. Good luck!`, 'match-start');
}

/**
 * Handle match end
 * @param {Object} data - Match end data
 */
function handleMatchEnd(data) {
  currentMatchId = null;
  matchStartTime = null;
  stopMatchTimer();
  
  // Hide match info
  if (elements.matchInfo) {
    elements.matchInfo.style.display = 'none';
  }
  
  // Add match end message
  addMatchMessage(data.message || 'Match has ended.', 'match-status');
  
  // Return to lobby after a delay
  setTimeout(() => {
    showScreen('lobby');
  }, 3000);
}

/**
 * Handle reconnection scenarios
 * @param {Object} data - Reconnection data
 */
function handleReconnection(data) {
  switch (data.status) {
  case 'lobby':
    showScreen('lobby');
    if (data.message) {
      addSystemMessage(data.message);
    }
    break;
  case 'match':
    currentMatchId = data.matchId;
    matchStartTime = Date.now() - (data.matchDuration || 0);
    startMatchTimer();
    showScreen('game');
    if (data.message) {
      addMatchMessage(data.message, 'match-status');
    }
    break;
  case 'error':
    showError(data.message);
    showScreen('lobby');
    break;
  }
}

/**
 * Update match player count display
 * @param {number} count - Current player count
 */
function updateMatchPlayerCount(count) {
  if (elements.matchPlayerCount) {
    elements.matchPlayerCount.textContent = count;
  }
}

/**
 * Start the match timer
 */
function startMatchTimer() {
  if (matchTimer) {
    clearInterval(matchTimer);
  }
  
  matchTimer = setInterval(() => {
    if (matchStartTime && elements.matchTime) {
      const elapsed = Date.now() - matchStartTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      elements.matchTime.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  }, 1000);
}

/**
 * Stop the match timer
 */
function stopMatchTimer() {
  if (matchTimer) {
    clearInterval(matchTimer);
    matchTimer = null;
  }
  if (elements.matchTime) {
    elements.matchTime.textContent = '00:00';
  }
}

/**
 * Add a match-specific message with special styling
 * @param {string} text - Message text
 * @param {string} type - Message type class
 */
function addMatchMessage(text, type = 'match-status') {
  const messageElement = document.createElement('div');
  messageElement.className = `message ${type}`;
  
  messageElement.innerHTML = `
    <div class="message-header">
      <strong>Match System</strong>
      <span class="timestamp">${formatTimestamp(new Date().toISOString())}</span>
    </div>
    <div class="message-content">${escapeHtml(text)}</div>
  `;
  
  addMessageToDisplay(messageElement);
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
    // Handle forfeit command
    if (messageText === '/forfeit' && currentMatchId) {
      forfeitMatch();
      elements.messageInput.value = '';
      updateCharacterCount();
      return;
    }
    
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