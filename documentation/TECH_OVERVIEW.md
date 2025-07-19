# JogoTesto - Architecture Documentation

## Overview

JogoTesto is a multiplayer Battle Royale text-based RPG that leverages AI-driven development through Product Requirement Prompts (PRPs). The application provides real-time multiplayer functionality with a sophisticated match system supporting up to 50 players per match, built using Node.js, Express, and Socket.IO with persistent session management.

## System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        C[Client Browser]
        L[Lobby Interface]
        M[Matchmaking Screen]
        G[Game Interface]
        CSS[Styling]
    end
    
    subgraph "Session Layer"
        SM[Session Manager]
        SA[Session Auth Middleware]
        LS[localStorage Persistence]
    end
    
    subgraph "Match Layer"
        MM[Match Manager]
        MQ[Matchmaking Queue]
        MA[Active Matches]
        MC[Match Instances]
    end
    
    subgraph "Server Layer"
        S[Express Server]
        IO[Socket.IO Server]
        RS[Room System Pool]
        V[Validation Utils]
    end
    
    subgraph "Data Layer"
        R[Rooms JSON]
        P[Player Sessions]
        MS[Match State]
    end
    
    C --> L
    C --> M  
    C --> G
    C --> CSS
    C <--> LS
    C <--> IO
    
    IO --> SA
    SA --> SM
    SM --> P
    
    IO --> MM
    MM --> MQ
    MM --> MA
    MA --> MC
    MC --> RS
    
    S --> IO
    IO --> V
    RS --> R
    MC --> MS
    
    classDef client fill:#e1f5fe
    classDef session fill:#fff3e0
    classDef match fill:#f3e5f5
    classDef server fill:#e8f5e8
    classDef data fill:#fce4ec
    
    class C,L,M,G,CSS client
    class SM,SA,LS session
    class MM,MQ,MA,MC match
    class S,IO,RS,V server
    class R,P,MS data
```

## Core Components

### 1. Session Management System

#### Session Manager (`src/systems/sessionManager.js`)
Manages persistent player identity across reconnections using a two-ID system.

```mermaid
classDiagram
    class SessionManager {
        -Map sessions
        -Map playerSessions
        -number sessionExpiry
        +createSession(playerID, username)
        +findSession(sessionID)
        +validateSession(sessionID, playerID)
        +updateActivity(sessionID)
        +updateUsername(sessionID, username)
        +updatePlayerMatch(sessionID, matchID)
        +expireSession(sessionID)
        +cleanupExpiredSessions()
        +getStats()
    }
```

**Key Features:**
- Two-ID authentication (sessionID + playerID)
- 24-hour session expiry with automatic cleanup
- Persistent username and match association
- Reconnection state recovery

#### Session Authentication (`src/middleware/sessionAuth.js`)
Socket.IO middleware that handles session restoration and new session creation.

```javascript
// Authentication flow
socket.on('connect') -> sessionAuth -> 
  existing session ? restore : create new ->
  attach session data to socket
```

### 2. Match Management System

#### Match Manager (`src/systems/matchManager.js`)
Orchestrates matchmaking queue and match lifecycle management.

```mermaid
classDiagram
    class MatchManager {
        -Map activeMatches
        -Set waitingQueue
        -Map playerMatches
        -number matchCounter
        -number minPlayersToStart
        -number maxPlayersPerMatch
        +addPlayerToQueue(playerID, username)
        +removePlayerFromQueue(playerID)
        +tryCreateMatch()
        +createMatch(players)
        +getPlayerMatch(playerID)
        +removePlayerFromMatch(playerID)
        +getStats()
    }
```

**Features:**
- Queue-based matchmaking (10-50 players)
- Automatic match creation when minimum threshold reached
- Player-to-match relationship tracking
- Match statistics and monitoring

#### Match Instance (`src/systems/match.js`)
Individual match with isolated RoomSystem and player management.

```mermaid
classDiagram
    class Match {
        -string matchId
        -Map players
        -Map connectedSockets
        -RoomSystem roomSystem
        -string status
        -number startedAt
        +addPlayerSocket(playerID, socket)
        +removePlayerSocket(playerID)
        +handlePlayerMessage(playerID, data)
        +handlePlayerForfeit(playerID)
        +broadcast(event, data, excludePlayers)
        +sendMatchState(playerID)
        +initializeWorld()
    }
```

**Key Features:**
- Isolated RoomSystem instance per match
- Independent game world with full room navigation
- Match-specific player communication
- Forfeit handling and match cleanup

### 3. Enhanced Server Layer (`src/server.js`)

**New Responsibilities:**
- Session-aware connection management
- Match-based message routing
- Reconnection handling with match state recovery
- Matchmaking event coordination

**Key Event Handlers:**
- `joinMatch` - Add player to matchmaking queue
- `cancelQueue` - Remove player from queue
- `forfeitMatch` - Handle match forfeit
- `playerMessage` - Route messages to match context

### 4. Client Interface Evolution

#### Multi-Screen Architecture
- **Lobby Screen**: Username entry and match joining
- **Matchmaking Screen**: Queue status and waiting interface  
- **Game Screen**: Full match interface with forfeit option

#### Enhanced Client (`public/client.js`)
```mermaid
stateDiagram-v2
    [*] --> Lobby
    Lobby --> Matchmaking : joinMatch
    Matchmaking --> Lobby : cancelQueue
    Matchmaking --> Game : matchStarted
    Game --> Lobby : forfeitMatch
    Game --> Lobby : matchEnded
    Lobby --> Game : reconnectToMatch
```

**New Functions:**
- `joinMatchQueue()` - Handle match joining with validation
- `handleMatchStart()` - Transition to game screen
- `handleReconnection()` - Process reconnection scenarios
- `forfeitMatch()` - Handle match forfeit
- `showScreen()` - Manage screen transitions

## Data Flow Architecture

### Session-Aware Connection Flow
```mermaid
sequenceDiagram
    participant C as Client
    participant SA as Session Auth
    participant SM as Session Manager
    participant MM as Match Manager
    participant M as Match Instance
    
    C->>SA: Connect with auth data
    SA->>SM: Validate/create session
    SM->>SA: Session data
    SA->>C: Session established
    
    alt Existing Match
        MM->>M: Get player match
        M->>C: Reconnect to match
    else No Match
        C->>C: Show lobby
    end
```

### Matchmaking Flow
```mermaid
sequenceDiagram
    participant C1 as Client 1
    participant C2 as Client N
    participant MM as Match Manager
    participant M as Match Instance
    participant RS as Room System
    
    C1->>MM: joinMatch
    MM->>MM: Add to queue
    C2->>MM: joinMatch  
    MM->>MM: Queue threshold reached
    MM->>M: Create match
    M->>RS: Initialize world
    M->>C1: matchStarted
    M->>C2: matchStarted
```

### Match Message Flow
```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server
    participant MM as Match Manager
    participant M as Match Instance
    participant RS as Room System
    
    C->>S: playerMessage
    S->>MM: getPlayerMatch()
    MM->>S: Match instance
    S->>M: handlePlayerMessage()
    M->>RS: Process command
    RS->>M: Result
    M->>C: Response (within match context)
```

## Enhanced Security & Validation

### Match Validation (`src/utils/matchValidation.js`)
- Player eligibility validation
- Match state consistency checks
- Movement validation within match context
- Chat message filtering for match isolation

### ID Generation (`src/utils/idGenerator.js`)
- Cryptographically secure ID generation
- Format validation for all ID types
- Collision-resistant match IDs

## Session Persistence

### Client-Side Storage
```javascript
// Session data persisted in localStorage
{
  sessionID: "session_abc123...",
  playerID: "player_def456...", 
  username: "PlayerName"
}
```

### Server-Side Session State
```javascript
// Session object structure
{
  sessionID: string,
  playerID: string,
  username: string,
  createdAt: timestamp,
  lastActivity: timestamp,
  matchID: string|null,
  isActive: boolean
}
```

## Match System Design

### Match Lifecycle
1. **Queue Phase**: Players join matchmaking queue
2. **Creation Phase**: Match created when 10+ players available
3. **Active Phase**: Match running with isolated world
4. **Completion Phase**: Match ends, players return to lobby

### Isolation Architecture
- Each match has its own RoomSystem instance
- Independent room navigation per match
- Isolated player communication
- Separate match timers and state

## Testing Architecture

### Enhanced Test Suite
- **Unit Tests**: Session management, match management, ID generation
- **Integration Tests**: Multi-match scenarios, reconnection flows
- **76/77 tests passing** with comprehensive coverage

### Test Categories
- Session persistence and validation
- Match creation and lifecycle
- Reconnection scenarios
- Error handling and edge cases

## Performance & Scalability

### Memory Management
- Session cleanup with 24-hour expiry
- Match instance garbage collection
- Efficient Map-based data structures
- Per-match RoomSystem isolation

### Scalability Features
- Support for multiple concurrent matches
- Session-based reconnection (not socket-dependent)
- Stateless authentication middleware
- Event-driven match coordination

## Development Commands

```bash
npm start      # Start the Battle Royale server
npm test       # Run comprehensive test suite
npm run lint   # Code quality validation
```

## Technology Stack

- **Backend**: Node.js, Express.js, Socket.IO v4.8.1
- **Session Management**: In-memory with localStorage persistence
- **Frontend**: Vanilla JavaScript with multi-screen SPA
- **Testing**: Node.js built-in test runner (76/77 tests)
- **Code Quality**: ESLint with comprehensive rules
- **Architecture**: Event-driven with isolated match instances

## Current Battle Royale Features

### Implemented
- ✅ **Multi-Match Support**: Up to 50 players per match
- ✅ **Persistent Sessions**: Reconnection to active matches
- ✅ **Queue System**: Automatic matchmaking (10-50 players)
- ✅ **Match Isolation**: Independent worlds per match
- ✅ **Forfeit System**: Leave match and return to lobby
- ✅ **Full UI**: Lobby → Matchmaking → Game screens
- ✅ **Error Handling**: Comprehensive validation and recovery

### Ready for Enhancement
- Database integration for persistent statistics
- Match history and player rankings
- Advanced matchmaking with skill-based matching
- Spectator mode for completed matches
- Tournament bracket system

## Future Architecture Considerations

### Immediate Enhancements
- Comprehensive test suite for new components
- Match statistics and analytics
- Advanced reconnection scenarios
- Performance monitoring and metrics

### Long-term Scaling
- Redis-based session persistence
- Microservices for match management
- Database integration for match history
- Advanced matchmaking algorithms
- Real-time match spectating

---

*This documentation reflects JogoTesto's evolution from a single-world text RPG to a sophisticated Battle Royale system supporting multiple concurrent matches with persistent session management.*