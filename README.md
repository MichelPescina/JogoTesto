# JogoTesto - Text-Based Battle Royale

A real-time multiplayer text-based battle royale game built with Node.js, Express.js, and Socket.io. Fight against up to 20 players in interconnected rooms, search for weapons, and be the last warrior standing!

## Features

- **Real-time Multiplayer**: Up to 20 players per match
- **Terminal-Style Interface**: Retro terminal aesthetic with responsive design  
- **Strategic Combat**: Turn-based combat with attack/escape mechanics
- **Weapon System**: Find weapons to increase your attack power
- **Progressive Strength**: Gain strength with each victory
- **Interconnected World**: Navigate through 18 unique rooms
- **Vulnerability Mechanics**: Become vulnerable while searching for weapons

## Quick Start

### Prerequisites

- Node.js 16.x or higher
- npm 8.x or higher

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd JogoTesto
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser and navigate to:
```
http://localhost:3000
```

### Development

Run the development server with auto-restart:
```bash
npm run dev
```

Run tests:
```bash
npm test
```

Run linting:
```bash
npm run lint
```

## Gameplay

### Objective
Be the last player standing in the battle royale arena.

### Controls
- **W** - Move North
- **A** - Move West  
- **S** - Move South
- **D** - Move East
- **SPACE** - Search for weapons (makes you vulnerable for 2 seconds)
- **Arrow Keys** - Alternative movement controls

### Game Mechanics

#### Combat System
- When you enter a room with another player, you can choose to attack
- The defender can choose to attack back or attempt to escape
- Player with higher attack power (strength + weapon damage) wins
- Winners gain +1 strength and the loser is eliminated

#### Weapons
- **Wooden Stick**: +1 damage (common)
- **Sharp Knife**: +3 damage (uncommon)  
- **Steel Sword**: +5 damage (rare)

#### Vulnerability
- Searching for weapons makes you vulnerable for 2 seconds
- If attacked while vulnerable, you cannot defend and die instantly
- Risk vs reward - better weapons require taking risks

#### Escape Mechanics
- 50% chance to successfully escape from combat
- Successful escape moves you to a random adjacent room
- Failed escape results in instant death

### World Map

The game world consists of 18 interconnected rooms:

- **Spawn Areas**: Spawn Clearing (starting point)
- **Villages**: Abandoned Village with multiple connections
- **Natural Areas**: Deep Forest, River Crossing, Waterfall
- **Structures**: Sacred Temple, Ancient Ruins  
- **Dangerous Areas**: Cave Depths, Mountain Peak, Canyon Depths
- **And more...** Each with unique descriptions and weapon spawn rates

## Architecture

### Backend Structure
```
src/
├── server.js              # Main server entry point
├── game/
│   ├── GameEngine.js      # Core game mechanics
│   ├── MatchManager.js    # Match lifecycle management
│   ├── Player.js          # Player state management
│   └── Room.js            # Room logic and weapon spawning
├── handlers/
│   ├── socketHandlers.js  # Socket.io event handlers
│   └── httpHandlers.js    # REST API endpoints
├── utils/
│   ├── constants.js       # Game configuration
│   └── validation.js      # Input validation
└── data/
    └── world.json         # World map definition
```

### Frontend Structure
```
public/
├── index.html             # Terminal-style game interface
├── css/
│   └── terminal.css       # Terminal theme styling
└── js/
    └── client.js          # Socket.io client and game logic
```

### Key Technologies
- **Backend**: Node.js, Express.js, Socket.io
- **Frontend**: Vanilla JavaScript, CSS3, HTML5
- **Testing**: Node.js built-in test runner
- **Real-time Communication**: WebSocket via Socket.io

## API Endpoints

### REST API
- `GET /api/status` - Server health check
- `GET /api/matches` - Current match information and statistics
- `GET /api/info` - Game rules and configuration

### Socket.io Events

#### Client to Server
- `joinMatch` - Join the current match
- `move` - Move in a direction
- `search` - Search for weapons
- `attack` - Attack another player
- `escape` - Attempt to escape from combat

#### Server to Client
- `matchJoined` - Confirmation of joining match
- `matchStarted` - Match has begun
- `roomUpdate` - Room information update
- `combatInitiated` - Combat challenge received
- `searchStarted` - Weapon search begun
- `error` - Error message

## Configuration

Environment variables can be used to customize the game:

```bash
PORT=3000                    # Server port
MAX_PLAYERS=20              # Maximum players per match
MIN_PLAYERS_TO_START=2      # Minimum players to start match
WEAPON_SEARCH_DURATION=2000 # Search vulnerability time (ms)
ESCAPE_SUCCESS_CHANCE=0.5   # Escape success probability
```

## Testing

The project includes comprehensive tests:

```bash
# Run all tests
npm test

# Run specific test files
npm test tests/game/GameEngine.test.js
npm test tests/game/MatchManager.test.js
npm test tests/integration/socket.test.js
```

### Test Coverage
- **Unit Tests**: GameEngine, MatchManager, Player, Room classes
- **Integration Tests**: Socket.io communication and game flow
- **Edge Cases**: Error handling, disconnections, invalid input

## Development

### Code Style
The project follows these principles:
- **KISS**: Keep It Simple, Stupid
- **YAGNI**: You Aren't Gonna Need It
- **JSDoc**: All functions documented
- **Error-first**: Consistent error handling
- **Async by default**: Non-blocking I/O

### Adding New Features

1. **New Rooms**: Add to `src/data/world.json`
2. **New Weapons**: Add to `src/utils/constants.js`
3. **New Events**: Add to socket handlers and client
4. **New Game Mechanics**: Extend GameEngine class

### Performance Considerations
- Single match instance (simple architecture)
- Rate limiting on API endpoints
- Efficient room-based Socket.io broadcasting
- Memory cleanup on match completion

## Troubleshooting

### Common Issues

**Port already in use**
```bash
# Kill process on port 3000
npx kill-port 3000
```

**Dependencies issues**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Client connection issues**
- Check firewall settings
- Verify port 3000 is accessible
- Check browser console for errors

### Debug Mode

Enable debug logging:
```bash
DEBUG=socket.io* npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make changes and add tests
4. Run tests: `npm test`
5. Run linting: `npm run lint`
6. Commit changes: `git commit -am 'Add feature'`
7. Push to branch: `git push origin feature-name`
8. Create Pull Request

## License

MIT License - see LICENSE file for details.

## Credits

Built as an experimental AI-driven development project demonstrating:
- Real-time multiplayer game architecture
- Socket.io best practices
- Node.js game server development
- Terminal-style web interfaces

---

**Have fun battling! May the best warrior win!** ⚔️