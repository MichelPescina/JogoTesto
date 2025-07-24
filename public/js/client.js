/**
 * JogoTesto Client-Side Game Controller
 */

class GameClient {
  constructor() {
    this.socket = null;
    this.playerData = null;
    this.currentRoom = null;
    this.gameState = 'disconnected'; // disconnected, joining, waiting, playing, game-over
    this.isSearching = false;
    this.inCombat = false;
    this.messageBuffer = [];

    this.init();
  }

  init() {
    this.initializeSocket();
    this.bindEventListeners();
    this.updateConnectionStatus();
    this.loadServerInfo();
  }

  /**
   * Initialize Socket.io connection
   */
  initializeSocket() {
    this.socket = io({
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 20000
    });

    // Connection events
    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.updateConnectionStatus(true);
      this.loadServerInfo();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
      this.updateConnectionStatus(false);
      this.showError('Disconnected from server: ' + reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.updateConnectionStatus(false);
      this.showError('Failed to connect to server');
    });

    // Game events
    this.socket.on('matchJoined', (data) => this.handleMatchJoined(data));
    this.socket.on('matchStarted', (data) => this.handleMatchStarted(data));
    this.socket.on('matchEnded', (data) => this.handleMatchEnded(data));
    this.socket.on('roomUpdate', (data) => this.handleRoomUpdate(data));
    this.socket.on('playerEntered', (data) => this.handlePlayerEntered(data));
    this.socket.on('playerLeft', (data) => this.handlePlayerLeft(data));
    this.socket.on('searchStarted', (data) => this.handleSearchStarted(data));
    this.socket.on('searchCompleted', (data) => this.handleSearchCompleted(data));
    this.socket.on('weaponFound', (data) => this.handleWeaponFound(data));
    this.socket.on('combatInitiated', (data) => this.handleCombatInitiated(data));
    this.socket.on('combatResult', (data) => this.handleCombatResult(data));
    this.socket.on('error', (data) => this.handleError(data));

    // Additional events
    this.socket.on('playerEscaped', (data) => this.addMessage(`${data.player.name} escaped!`, 'system'));
    this.socket.on('playerDied', (data) => this.addMessage(`${data.player.name} ${data.reason}`, 'combat'));
    this.socket.on('combatCompleted', (data) => this.addMessage(`${data.winner.name} defeated ${data.loser.name}!`, 'combat'));
  }

  /**
   * Bind UI event listeners
   */
  bindEventListeners() {
    // Join game
    const joinButton = document.getElementById('join-button');
    const playerNameInput = document.getElementById('player-name');

    joinButton.addEventListener('click', () => this.joinGame());
    playerNameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {this.joinGame();}
    });

    // Game controls
    document.addEventListener('keydown', (e) => this.handleKeyPress(e));

    // Combat modal buttons
    document.getElementById('attack-button').addEventListener('click', () => this.respondToCombat('attack'));
    document.getElementById('escape-button').addEventListener('click', () => this.respondToCombat('escape'));

    // Game over buttons
    document.getElementById('play-again-button').addEventListener('click', () => this.playAgain());
    document.getElementById('view-stats-button').addEventListener('click', () => this.viewStats());
  }

  /**
   * Handle keyboard input
   */
  handleKeyPress(event) {
    if (this.gameState !== 'playing') {return;}

    // Prevent default browser shortcuts
    if (['w', 'a', 's', 'd', ' ', 'Enter', 'Escape'].includes(event.key)) {
      event.preventDefault();
    }

    // Movement keys
    const moveKeys = {
      'w': 'north',
      'a': 'west',
      's': 'south',
      'd': 'east',
      'ArrowUp': 'north',
      'ArrowLeft': 'west',
      'ArrowDown': 'south',
      'ArrowRight': 'east'
    };

    if (moveKeys[event.key] && !this.isSearching && !this.inCombat) {
      this.move(moveKeys[event.key]);
    }

    // Action keys
    switch (event.key) {
    case ' ': // Space - Search
      if (!this.isSearching && !this.inCombat) {
        this.searchForWeapon();
      }
      break;
    case 'Escape':
      this.hideModals();
      break;
    }

    // Combat response keys
    if (this.inCombat) {
      switch (event.key.toLowerCase()) {
      case 'a':
        this.respondToCombat('attack');
        break;
      case 'e':
        this.respondToCombat('escape');
        break;
      }
    }
  }

  /**
   * Join the game
   */
  joinGame() {
    const playerName = document.getElementById('player-name').value.trim();

    if (!playerName) {
      this.showJoinError('Please enter your name');
      return;
    }

    if (playerName.length > 20) {
      this.showJoinError('Name must be 20 characters or less');
      return;
    }

    this.hideJoinError();
    this.gameState = 'joining';
    document.getElementById('join-button').disabled = true;
    document.getElementById('join-button').textContent = 'Joining...';

    this.socket.emit('joinMatch', { playerName });
  }

  /**
   * Move player
   */
  move(direction) {
    this.socket.emit('move', { direction });
  }

  /**
   * Search for weapon
   */
  searchForWeapon() {
    this.socket.emit('search', {});
    
    // Add defensive timeout in case server never responds
    this.searchBackupTimeout = setTimeout(() => {
      if (this.isSearching) {  // Only if still searching (server didn't respond)
        console.warn('Server search response timeout - forcing cleanup');
        this.handleSearchCompleted({ success: false, weaponFound: false, weapon: null });
      }
    }, 3000);  // 3 second timeout (2s search duration + 1s buffer)
  }

  /**
   * Respond to combat
   */
  respondToCombat(response) {
    if (!this.inCombat) {return;}

    this.socket.emit('combatResponse', {
      response: response,
      attackerId: this.combatData?.attacker?.id
    });

    this.hideModal('combat-modal');
    this.inCombat = false;
  }

  /**
   * Event Handlers
   */
  handleMatchJoined(data) {
    console.log('Match joined:', data);
    this.playerData = data.player;
    this.currentRoom = data.room;
    this.gameState = 'waiting';

    this.showScreen('game-screen');
    this.updatePlayerStatus();
    this.addMessage(`Welcome ${data.player.name}! Waiting for more players...`, 'system');

    if (data.match.playerCount < data.match.minPlayersToStart) {
      const needed = data.match.minPlayersToStart - data.match.playerCount;
      this.addMessage(`Need ${needed} more players to start`, 'system');
    }
  }

  handleMatchStarted(data) {
    console.log('Match started:', data);
    this.gameState = 'playing';
    this.addMessage('The battle begins! Find weapons and survive!', 'system');
    this.addMessage('Use WASD to move, SPACE to search for weapons', 'system');

    // Request initial room data
    this.requestRoomUpdate();
  }

  handleMatchEnded(data) {
    console.log('Match ended:', data);
    this.gameState = 'game-over';

    const isWinner = data.winner && data.winner.id === this.playerData?.id;
    this.showGameOver(isWinner, data);
  }

  handleRoomUpdate(data) {
    console.log('Room update:', data);
    this.currentRoom = data.room;
    this.updateRoomDisplay(data);
  }

  handlePlayerEntered(data) {
    this.addMessage(`${data.player.name} entered the room`, 'player');
    this.updateRoomPlayers();
  }

  handlePlayerLeft(data) {
    this.addMessage(`${data.player.name} left the room`, 'player');
    this.updateRoomPlayers();
  }

  handleSearchStarted(data) {
    console.log('Search started:', data);
    this.isSearching = true;
    this.showSearchModal(data.duration);
    this.addMessage('You are searching for weapons... VULNERABLE!', 'warning');
  }

  handleSearchCompleted(data) {
    console.log('Search completed:', data);

    // Clear backup timeout
    clearTimeout(this.searchBackupTimeout);
    
    this.isSearching = false;
    this.hideModal('search-modal');

    if (data.weaponFound) {
      this.playerData.weapon = data.weapon;
      this.updatePlayerStatus();
      this.addMessage(`Found ${data.weapon.name}! ${data.weapon.description}`, 'success');
    } else {
      this.addMessage('Search completed but found nothing', 'system');
    }
  }

  handleWeaponFound(data) {
    this.addMessage(`${data.player.name} found a ${data.weapon}!`, 'player');
  }

  handleCombatInitiated(data) {
    console.log('Combat initiated:', data);
    this.inCombat = true;
    this.combatData = data;
    this.showCombatModal(data);
  }

  handleCombatResult(data) {
    console.log('Combat result:', data);
    this.inCombat = false;
    this.hideModal('combat-modal');

    if (data.result === 'victory') {
      this.playerData.strength = data.newStats.strength;
      this.playerData.kills = data.newStats.kills;
      this.updatePlayerStatus();
      this.addMessage(`Victory! You defeated ${data.loser.name}`, 'success');
    } else {
      this.addMessage(`Defeated by ${data.winner.name}`, 'combat');
      // Player is dead, wait for match end
    }
  }

  handleError(data) {
    console.error('Server error:', data);

    if (data.code === 'MATCH_FULL') {
      this.showJoinError('Match is full. Please wait for the next match.');
    } else if (data.code === 'MATCH_STARTED') {
      this.showJoinError('Match already started. Please wait until it finishes.');
    } else {
      this.showError(data.message);
    }

    // Reset join button
    document.getElementById('join-button').disabled = false;
    document.getElementById('join-button').textContent = 'Enter Battle';
    this.gameState = 'disconnected';
  }

  /**
   * UI Update Methods
   */
  updateConnectionStatus(connected = false) {
    const statusElement = document.getElementById('connection-status');
    if (connected) {
      statusElement.textContent = 'Connected';
      statusElement.className = 'connected';
    } else {
      statusElement.textContent = 'Disconnected';
      statusElement.className = 'disconnected';
      this.gameState = 'disconnected';
    }
  }

  updatePlayerStatus() {
    if (!this.playerData) {return;}

    document.getElementById('player-name-display').textContent = this.playerData.name;
    document.getElementById('player-strength').textContent = this.playerData.strength;
    document.getElementById('player-weapon').textContent = this.playerData.weapon ? this.playerData.weapon.name : 'None';
    document.getElementById('player-kills').textContent = this.playerData.kills;
  }

  updateRoomDisplay(data) {
    document.getElementById('room-name').textContent = data.room.name;
    document.getElementById('room-description').textContent = data.description;

    const playersContainer = document.getElementById('room-players');
    playersContainer.innerHTML = '';

    if (data.playersInRoom && data.playersInRoom.length > 0) {
      const playersTitle = document.createElement('div');
      playersTitle.textContent = 'Other players here:';
      playersTitle.style.fontWeight = 'bold';
      playersTitle.style.marginBottom = '10px';
      playersContainer.appendChild(playersTitle);

      data.playersInRoom.forEach(playerId => {
        const playerElement = document.createElement('div');
        playerElement.className = 'player-item';
        playerElement.innerHTML = `
          <span class="player-name">Player ${playerId}</span>
          <button onclick="gameClient.initiateAttack('${playerId}')" class="attack-btn">Attack</button>
        `;
        playersContainer.appendChild(playerElement);
      });
    }
  }

  addMessage(text, type = 'system') {
    const messageList = document.getElementById('message-list');
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;

    const timestamp = new Date().toLocaleTimeString();
    messageElement.innerHTML = `
      <span class="timestamp">[${timestamp}]</span>
      ${text}
    `;

    messageList.appendChild(messageElement);
    messageList.scrollTop = messageList.scrollHeight;

    // Keep only last 100 messages
    while (messageList.children.length > 100) {
      messageList.removeChild(messageList.firstChild);
    }
  }

  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
  }

  showModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
  }

  hideModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
  }

  hideModals() {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.classList.add('hidden');
    });
  }

  showSearchModal(duration) {
    this.showModal('search-modal');

    const searchBar = document.getElementById('search-bar');
    const timer = document.getElementById('search-timer');

    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += 100;
      const progress = (elapsed / duration) * 100;
      searchBar.style.width = progress + '%';
      timer.textContent = `${((duration - elapsed) / 1000).toFixed(1)}s remaining`;

      if (elapsed >= duration) {
        clearInterval(interval);
        
        // Fix: Add proper cleanup (mirror handleSearchCompleted pattern)
        this.isSearching = false;
        this.hideModal('search-modal');
        
        // Add fallback message since server should have responded
        this.addMessage("Search completed (no weapon found)", 'game-message');
      }
    }, 100);
  }

  showCombatModal(data) {
    this.showModal('combat-modal');

    document.getElementById('combat-title').textContent = 'Combat!';
    document.getElementById('combat-info').innerHTML = `
      <p><strong>${data.attacker.name}</strong> wants to attack you!</p>
      <p>Your strength: ${this.playerData.strength} + weapon: ${this.playerData.weapon?.damage || 0}</p>
      <p>Their strength: ${data.attackerStats.strength} + weapon: ${data.attackerStats.weapon !== 'None' ? '?' : 0}</p>
    `;

    // 10 second timer
    let timeLeft = 10;
    const timer = document.getElementById('combat-timer');
    timer.textContent = `Time left: ${timeLeft}s`;

    const timerInterval = setInterval(() => {
      timeLeft--;
      timer.textContent = `Time left: ${timeLeft}s`;

      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        this.respondToCombat('escape'); // Default to escape
      }
    }, 1000);
  }

  showGameOver(isWinner, data) {
    this.showScreen('game-over-screen');

    const resultTitle = document.getElementById('result-title');
    const resultMessage = document.getElementById('result-message');
    const finalStats = document.getElementById('final-stats');

    if (isWinner) {
      resultTitle.textContent = 'VICTORY!';
      resultTitle.className = 'victory';
      resultMessage.textContent = 'You are the last warrior standing!';
    } else {
      resultTitle.textContent = 'DEFEATED';
      resultTitle.className = 'defeat';
      resultMessage.textContent = data.winner ? `${data.winner.name} won the battle` : 'The battle is over';
    }

    if (this.playerData) {
      finalStats.innerHTML = `
        <h4>Your Final Stats:</h4>
        <p>Kills: ${this.playerData.kills}</p>
        <p>Final Strength: ${this.playerData.strength}</p>
        <p>Final Weapon: ${this.playerData.weapon ? this.playerData.weapon.name : 'None'}</p>
      `;
    }
  }

  showError(message) {
    this.addMessage(`Error: ${message}`, 'combat');
  }

  showJoinError(message) {
    const errorElement = document.getElementById('join-error');
    errorElement.textContent = message;
    errorElement.classList.remove('hidden');
  }

  hideJoinError() {
    document.getElementById('join-error').classList.add('hidden');
  }

  /**
   * Game Actions
   */
  initiateAttack(targetPlayerId) {
    if (this.inCombat || this.isSearching) {return;}
    this.socket.emit('attack', { targetPlayerId });
  }

  playAgain() {
    location.reload();
  }

  viewStats() {
    // Could implement match history view
    this.addMessage('Match history feature coming soon!', 'system');
  }

  requestRoomUpdate() {
    // The server should send room updates automatically
    // This is a placeholder for requesting updates if needed
    if (!this.socket) {return;}
    this.socket.emit('roomInfo', {});
  }

  /**
   * Load server information
   */
  async loadServerInfo() {
    try {
      const response = await fetch('/api/matches');
      const data = await response.json();

      document.getElementById('match-info').textContent =
        `Current match: ${data.current.playerCount}/${data.current.maxPlayers} players`;

      document.getElementById('player-count').textContent =
        `${data.current.playerCount}/${data.current.maxPlayers} players`;

      document.getElementById('server-status').textContent =
        `Server: ${data.current.status} | Total matches: ${data.stats.totalMatches}`;

    } catch (error) {
      console.error('Failed to load server info:', error);
      document.getElementById('server-status').textContent = 'Server info unavailable';
    }
  }
}

// Initialize game client when DOM is loaded
let gameClient;
document.addEventListener('DOMContentLoaded', () => {
  gameClient = new GameClient();
});

// Make gameClient globally available for button onclick handlers
window.gameClient = gameClient;