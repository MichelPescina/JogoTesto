/**
 * JogoTesto - Client-side JavaScript for Multiplayer Battle Royale Text RPG
 * Handles Socket.IO communication, match system, and user interface interactions
 */

/**
 * Global variables and configuration
 */
let socket = null;
let isConnected = false;
let playerId = null;
let pingInterval = null;

// Match System State
let currentState = 'lobby'; // lobby, joining, inMatch, gameActive
let currentMatchId = null;
let playerName = null;
let sessionToken = null;
let countdownTimer = null;

/**
 * DOM element references
 */
const elements = {
  // Existing elements
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
  
  // Match system elements
  nameModal: null,
  nameInput: null,
  joinMatchButton: null,
  closeNameModal: null,
  currentPlayerName: null,
  matchStatus: null,
  countdownDisplay: null,
  lobbyInfo: null,
  matchInfo: null
};

/**
 * Session Manager for client-side cookie handling
 */
const SessionManager = {
  /**
   * Save match data to cookies
   */
  saveMatchData(matchId, playerId, sessionToken) {
    const sessionData = {
      matchId: matchId,
      playerId: playerId,
      sessionToken: sessionToken,
      timestamp: Date.now()
    };
    
    document.cookie = `gameSession=${JSON.stringify(sessionData)}; max-age=86400; path=/`;
    console.log('Session saved to cookie');
  },
  
  /**
   * Get match data from cookies
   */
  getMatchData() {
    try {
      const match = document.cookie.match(/gameSession=([^;]+)/);
      if (match) {
        const sessionData = JSON.parse(decodeURIComponent(match[1]));
        
        // Check if session is not too old (24 hours)
        const age = Date.now() - sessionData.timestamp;
        if (age < 24 * 60 * 60 * 1000) {
          return sessionData;
        }
      }
    } catch (error) {
      console.error('Error parsing session cookie:', error);
    }
    return null;
  },
  
  /**
   * Clear session cookie
   */
  clearSession() {
    document.cookie = 'gameSession=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    console.log('Session cleared');
  }
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
  
  // Match system elements
  elements.nameModal = document.getElementById('nameModal');
  elements.nameInput = document.getElementById('nameInput');
  elements.joinMatchButton = document.getElementById('joinMatchButton');
  elements.closeNameModal = document.getElementById('closeNameModal');
  elements.currentPlayerName = document.getElementById('currentPlayerName');
  elements.matchStatus = document.getElementById('matchStatus');
  elements.countdownDisplay = document.getElementById('countdownDisplay');
  elements.lobbyInfo = document.getElementById('lobbyInfo');
  elements.matchInfo = document.getElementById('matchInfo');

  // Set up event listeners
  setupEventListeners();

  // Initialize Socket.IO connection
  connectToServer();
}

/**
 * Set up event listeners for UI interactions
 */
function setupEventListeners() {
  // Existing event listeners
  elements.sendButton.addEventListener('click', sendMessage);
  elements.messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  elements.messageInput.addEventListener('input', updateCharacterCount);
  elements.closeErrorModal.addEventListener('click', closeErrorModal);

  // Match system event listeners
  if (elements.joinMatchButton) {
    elements.joinMatchButton.addEventListener('click', joinMatchWithName);
  }
  
  if (elements.closeNameModal) {
    elements.closeNameModal.addEventListener('click', closeNameModal);
  }
  
  if (elements.nameInput) {
    elements.nameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        joinMatchWithName();
      }
    });
  }

  // Close modals on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (elements.errorModal && elements.errorModal.style.display !== 'none') {
        closeErrorModal();
      }
      if (elements.nameModal && elements.nameModal.style.display !== 'none') {
        closeNameModal();
      }
    }
  });

  // Enable debug info toggle
  const footer = document.querySelector('.footer');
  if (footer) {
    footer.addEventListener('dblclick', toggleDebugInfo);
  }
}

/**
 * Connect to the Socket.IO server
 */
function connectToServer() {
  try {
    updateConnectionStatus('connecting');
        
    socket = io({
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 20000
    });

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
  // Connection events
  socket.on('connect', handleConnection);
  socket.on('connect_error', handleConnectionError);
  socket.on('disconnect', handleDisconnection);
  socket.on('reconnect_attempt', handleReconnectAttempt);
  socket.on('reconnect', handleReconnect);
  socket.on('reconnect_failed', handleReconnectFailed);

  // Legacy events (for backward compatibility)
  socket.on('messageReceived', displayPlayerMessage);
  socket.on('playerJoined', (data) => addSystemMessage(data.message, 'join'));
  socket.on('playerLeft', (data) => addSystemMessage(data.message, 'leave'));
  socket.on('playerCount', (data) => updatePlayerCount(data.count));
  socket.on('error', handleServerError);
  socket.on('pong', handlePong);
  socket.on('gameMasterMessage', displayGameMasterMessage);
  socket.on('roomChatMessage', displayRoomChatMessage);

  // Match System Events
  socket.on('lobbyWelcome', handleLobbyWelcome);
  socket.on('lobbyJoined', handleLobbyJoined);
  socket.on('lobbyStatus', handleLobbyStatus);
  socket.on('lobbyPlayerCount', handleLobbyPlayerCount);
  socket.on('lobbyChatMessage', displayLobbyChatMessage);
  socket.on('lobbyMessage', displayLobbyMessage);
  
  socket.on('nameValidationResult', handleNameValidationResult);
  socket.on('matchAssigned', handleMatchAssigned);
  socket.on('reconnectionSuccess', handleReconnectionSuccess);
  socket.on('sessionInvalid', handleSessionInvalid);
  socket.on('reconnectionFailed', handleReconnectionFailed);
  
  socket.on('countdownStarted', handleCountdownStarted);
  socket.on('countdownUpdate', handleCountdownUpdate);
  socket.on('countdownCancelled', handleCountdownCancelled);
  socket.on('gameStarted', handleGameStarted);
  
  socket.on('playerJoinedMatch', handlePlayerJoinedMatch);
  socket.on('playerLeftMatch', handlePlayerLeftMatch);
  socket.on('playerDisconnectedFromMatch', handlePlayerDisconnectedFromMatch);
  socket.on('matchChatMessage', displayMatchChatMessage);
  
  socket.on('connectionCount', handleConnectionCount);
  socket.on('serverShutdown', handleServerShutdown);
}

/**
 * Handle initial connection
 */
function handleConnection() {
  console.log('Connected to server');
  isConnected = true;
  playerId = socket.id;
  updateConnectionStatus('connected');
  enableInput();
  
  if (elements.playerId) {
    elements.playerId.textContent = playerId;
  }
  
  startPingMonitoring();
  
  // Check for existing session
  const sessionData = SessionManager.getMatchData();
  if (sessionData && sessionData.sessionToken) {
    console.log('Found existing session, attempting reconnection...');
    socket.emit('reconnectToMatch', sessionData);
  } else {
    // New connection - show lobby welcome
    addSystemMessage('Connected to JogoTesto! Welcome to the lobby.');
    updateGameState('lobby');
  }
}

/**
 * Handle connection error
 */
function handleConnectionError(error) {
  console.error('Connection error:', error);
  updateConnectionStatus('disconnected');
  disableInput();
  addSystemMessage(`Connection error: ${error.message}`, 'error');
}

/**
 * Handle disconnection
 */
function handleDisconnection(reason) {
  console.log('Disconnected from server:', reason);
  isConnected = false;
  updateConnectionStatus('disconnected');
  disableInput();
  stopPingMonitoring();
  clearCountdown();
  
  if (reason === 'io server disconnect') {
    addSystemMessage('Disconnected by server', 'error');
  } else {
    addSystemMessage('Connection lost. Attempting to reconnect...', 'error');
  }
}

/**
 * Handle reconnection attempt
 */
function handleReconnectAttempt(attemptNumber) {
  console.log(`Reconnection attempt ${attemptNumber}`);
  updateConnectionStatus('connecting');
  addSystemMessage(`Reconnecting... (attempt ${attemptNumber})`, 'system');
}

/**
 * Handle successful reconnection
 */
function handleReconnect(attemptNumber) {
  console.log(`Reconnected after ${attemptNumber} attempts`);
  addSystemMessage('Reconnected successfully!', 'system');
}

/**
 * Handle failed reconnection
 */
function handleReconnectFailed() {
  console.error('Failed to reconnect');
  addSystemMessage('Failed to reconnect. Please refresh the page.', 'error');
}

/**
 * Handle server error
 */
function handleServerError(data) {
  console.error('Server error:', data);
  showError(data.message || 'Server error occurred');
}

/**
 * Handle pong response
 */
function handlePong(latency) {
  if (elements.ping) {
    elements.ping.textContent = latency;
  }
}

/**
 * Handle lobby welcome
 */
function handleLobbyWelcome(data) {
  addSystemMessage(data.message, 'system');
  showNameModal();
}

/**
 * Handle lobby joined
 */
function handleLobbyJoined(data) {
  addSystemMessage(data.message, 'system');
  updateLobbyInfo(`Queue position: ${data.queuePosition} of ${data.totalInQueue}`);
}

/**
 * Handle lobby status
 */
function handleLobbyStatus(data) {
  updateLobbyInfo(`
    Players: ${data.totalPlayers} | 
    Matches: ${data.totalMatches} | 
    Waiting: ${data.matchStates.waiting || 0} | 
    Active: ${data.matchStates.active || 0}
  `);
}

/**
 * Handle lobby player count
 */
function handleLobbyPlayerCount(data) {
  updateLobbyInfo(`Players in lobby: ${data.count}`);
}

/**
 * Handle lobby chat message
 */
function displayLobbyChatMessage(data) {
  const messageElement = document.createElement('div');
  messageElement.className = 'message lobby-chat-message';
  
  messageElement.innerHTML = `
    <div class="message-header">
      <strong>[Lobby] ${data.playerName}</strong>
      <span class="timestamp">${formatTimestamp(data.timestamp)}</span>
    </div>
    <div class="message-content">${escapeHtml(data.text)}</div>
  `;
  
  addMessageToDisplay(messageElement);
}

/**
 * Handle lobby system message
 */
function displayLobbyMessage(data) {
  addSystemMessage(data.text, 'lobby');
}

/**
 * Handle name validation result
 */
function handleNameValidationResult(data) {
  if (data.isValid) {
    playerName = data.playerName;
    if (elements.currentPlayerName) {
      elements.currentPlayerName.textContent = playerName;
    }
    addSystemMessage(`Name validated: ${playerName}`, 'system');
  } else {
    showError(data.error);
  }
}

/**
 * Handle match assignment
 */
function handleMatchAssigned(data) {
  currentMatchId = data.matchId;
  playerId = data.playerId;
  playerName = data.playerName;
  sessionToken = data.sessionToken;
  
  // Save session
  if (sessionToken) {
    SessionManager.saveMatchData(currentMatchId, playerId, sessionToken);
  }
  
  updateGameState('inMatch');
  closeNameModal();
  
  const actionText = data.action === 'created' ? 'Created new match' : 
    data.action === 'joined' ? 'Joined existing match' : 'Rejoined match';
  
  addSystemMessage(`${actionText}: ${currentMatchId}`, 'system');
  addSystemMessage(`Players in match: ${data.playerCount}`, 'system');
  
  updateMatchInfo(`Match: ${currentMatchId} | Players: ${data.playerCount} | State: ${data.matchState}`);
  
  if (data.matchState === 'countdown' && data.timeLeft > 0) {
    startCountdownDisplay(data.timeLeft);
  }
}

/**
 * Handle successful reconnection to match
 */
function handleReconnectionSuccess(data) {
  currentMatchId = data.matchId;
  playerId = data.playerId;
  playerName = data.playerName;
  
  updateGameState(data.matchState === 'active' ? 'gameActive' : 'inMatch');
  
  addSystemMessage(`Reconnected to match: ${data.matchId}`, 'system');
  updateMatchInfo(`Match: ${data.matchId} | Players: ${data.playerCount} | State: ${data.matchState}`);
  
  if (data.matchState === 'countdown' && data.timeLeft > 0) {
    startCountdownDisplay(data.timeLeft);
  }
}

/**
 * Handle invalid session
 */
function handleSessionInvalid(data) {
  SessionManager.clearSession();
  currentMatchId = null;
  updateGameState('lobby');
  addSystemMessage(data.message, 'error');
  showNameModal();
}

/**
 * Handle reconnection failed
 */
function handleReconnectionFailed(data) {
  SessionManager.clearSession();
  currentMatchId = null;
  updateGameState('lobby');
  addSystemMessage(data.message, 'error');
  showNameModal();
}

/**
 * Handle countdown started
 */
function handleCountdownStarted(data) {
  addSystemMessage('Match countdown started!', 'system');
  startCountdownDisplay(data.timeLeft);
}

/**
 * Handle countdown update
 */
function handleCountdownUpdate(data) {
  updateCountdownDisplay(data.timeLeft);
}

/**
 * Handle countdown cancelled
 */
function handleCountdownCancelled(data) {
  addSystemMessage(data.message, 'system');
  clearCountdown();
}

/**
 * Handle game started
 */
function handleGameStarted(data) {
  updateGameState('gameActive');
  clearCountdown();
  addSystemMessage('Match has started! Good luck!', 'system');
  updateMatchInfo(`Match: ${currentMatchId} | Status: ACTIVE`);
}

/**
 * Handle player joined match
 */
function handlePlayerJoinedMatch(data) {
  addSystemMessage(`${data.playerName} joined the match (${data.playerCount} players)`, 'join');
}

/**
 * Handle player left match
 */
function handlePlayerLeftMatch(data) {
  addSystemMessage(`${data.playerName} left the match`, 'leave');
}

/**
 * Handle player disconnected from match
 */
function handlePlayerDisconnectedFromMatch(data) {
  addSystemMessage(`${data.playerName} disconnected`, 'leave');
}

/**
 * Handle match chat message
 */
function displayMatchChatMessage(data) {
  const messageElement = document.createElement('div');
  messageElement.className = 'message match-chat-message';
  
  const isOwnMessage = data.playerId === playerId;
  const displayName = isOwnMessage ? 'You' : data.playerName;
  
  messageElement.innerHTML = `
    <div class="message-header">
      <strong>[Match] ${displayName}</strong>
      <span class="timestamp">${formatTimestamp(data.timestamp)}</span>
    </div>
    <div class="message-content">${escapeHtml(data.text)}</div>
  `;
  
  addMessageToDisplay(messageElement);
}

/**
 * Handle connection count update
 */
function handleConnectionCount(data) {
  updatePlayerCount(data.count);
}

/**
 * Handle server shutdown
 */
function handleServerShutdown(data) {
  addSystemMessage(data.message, 'error');
  disableInput();
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
    // Determine message type based on current state
    if (currentState === 'gameActive' && currentMatchId) {
      // Send as match message
      socket.emit('matchMessage', {
        text: messageText,
        timestamp: new Date().toISOString()
      });
    } else if (currentState === 'lobby') {
      // Send as lobby message
      socket.emit('lobbyMessage', {
        text: messageText,
        timestamp: new Date().toISOString()
      });
    } else {
      // Fallback to legacy player message
      socket.emit('playerMessage', {
        text: messageText,
        timestamp: new Date().toISOString()
      });
    }
        
    elements.messageInput.value = '';
    updateCharacterCount();
        
  } catch (error) {
    console.error('Error sending message:', error);
    showError('Failed to send message');
  }
}

/**
 * Show name input modal
 */
function showNameModal() {
  if (elements.nameModal) {
    elements.nameModal.style.display = 'flex';
    if (elements.nameInput) {
      elements.nameInput.focus();
    }
  }
}

/**
 * Close name input modal
 */
function closeNameModal() {
  if (elements.nameModal) {
    elements.nameModal.style.display = 'none';
  }
}

/**
 * Join match with player name
 */
function joinMatchWithName() {
  const name = elements.nameInput?.value?.trim();
  
  if (!name) {
    showError('Please enter a player name');
    return;
  }
  
  if (name.length < 2) {
    showError('Name must be at least 2 characters');
    return;
  }
  
  if (name.length > 50) {
    showError('Name must be 50 characters or less');
    return;
  }
  
  // Validate name format
  if (!/^[a-zA-Z0-9_\-\s]+$/.test(name)) {
    showError('Name can only contain letters, numbers, spaces, hyphens, and underscores');
    return;
  }
  
  // Send join match request
  socket.emit('joinMatch', {
    playerName: name
  });
  
  updateGameState('joining');
  addSystemMessage(`Attempting to join match as "${name}"...`, 'system');
}

/**
 * Update game state
 */
function updateGameState(newState) {
  currentState = newState;
  
  // Update UI based on state
  switch (newState) {
  case 'lobby':
    updateMatchStatus('In Lobby');
    break;
  case 'joining':
    updateMatchStatus('Joining Match...');
    break;
  case 'inMatch':
    updateMatchStatus('In Match (Waiting)');
    break;
  case 'gameActive':
    updateMatchStatus('Game Active');
    break;
  }
}

/**
 * Update match status display
 */
function updateMatchStatus(status) {
  if (elements.matchStatus) {
    elements.matchStatus.textContent = status;
  }
}

/**
 * Update lobby info display
 */
function updateLobbyInfo(info) {
  if (elements.lobbyInfo) {
    elements.lobbyInfo.textContent = info;
  }
}

/**
 * Update match info display
 */
function updateMatchInfo(info) {
  if (elements.matchInfo) {
    elements.matchInfo.textContent = info;
  }
}

/**
 * Start countdown display
 */
function startCountdownDisplay(timeLeft) {
  clearCountdown();
  updateCountdownDisplay(timeLeft);
  
  countdownTimer = setInterval(() => {
    timeLeft--;
    updateCountdownDisplay(timeLeft);
    
    if (timeLeft <= 0) {
      clearCountdown();
    }
  }, 1000);
}

/**
 * Update countdown display
 */
function updateCountdownDisplay(timeLeft) {
  if (elements.countdownDisplay) {
    if (timeLeft > 0) {
      elements.countdownDisplay.textContent = `Game starts in: ${timeLeft}s`;
      elements.countdownDisplay.style.display = 'block';
    } else {
      elements.countdownDisplay.style.display = 'none';
    }
  }
}

/**
 * Clear countdown
 */
function clearCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
  if (elements.countdownDisplay) {
    elements.countdownDisplay.style.display = 'none';
  }
}

// Legacy functions (keep for backward compatibility)
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

function displayRoomChatMessage(data) {
  const messageElement = document.createElement('div');
  messageElement.className = 'message room-chat-message';
    
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

function addMessageToDisplay(messageElement) {
  elements.messages.appendChild(messageElement);
  elements.messages.scrollTop = elements.messages.scrollHeight;
    
  const maxMessages = 500;
  while (elements.messages.children.length > maxMessages) {
    elements.messages.removeChild(elements.messages.firstChild);
  }
}

function updateConnectionStatus(status) {
  if (elements.connectionStatus) {
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
}

function updatePlayerCount(count) {
  if (elements.playerCount) {
    elements.playerCount.textContent = `Players: ${count}`;
  }
}

function updateCharacterCount() {
  if (elements.characterCount && elements.messageInput) {
    const currentLength = elements.messageInput.value.length;
    elements.characterCount.textContent = `${currentLength}/500`;
      
    elements.characterCount.className = 'character-count';
    if (currentLength > 450) {
      elements.characterCount.classList.add('error');
    } else if (currentLength > 400) {
      elements.characterCount.classList.add('warning');
    }
  }
}

function enableInput() {
  if (elements.messageInput) elements.messageInput.disabled = false;
  if (elements.sendButton) elements.sendButton.disabled = false;
  if (elements.messageInput) elements.messageInput.focus();
}

function disableInput() {
  if (elements.messageInput) elements.messageInput.disabled = true;
  if (elements.sendButton) elements.sendButton.disabled = true;
}

function showError(message) {
  if (elements.errorMessage && elements.errorModal) {
    elements.errorMessage.textContent = message;
    elements.errorModal.style.display = 'flex';
  }
}

function closeErrorModal() {
  if (elements.errorModal) {
    elements.errorModal.style.display = 'none';
  }
}

function toggleDebugInfo() {
  const debugInfo = document.getElementById('debugInfo');
  if (debugInfo) {
    debugInfo.style.display = debugInfo.style.display === 'none' ? 'block' : 'none';
  }
}

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

function stopPingMonitoring() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    init,
    sendMessage,
    displayPlayerMessage,
    addSystemMessage,
    displayGameMasterMessage,
    displayRoomChatMessage,
    formatTimestamp,
    escapeHtml,
    SessionManager
  };
}