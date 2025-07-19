# Claude Code Configuration

This file contains configuration and context for Claude Code to help with development tasks.

## Project Overview
JogoTesto is a multiplayer text-based RPG experiment that uses AI-driven development through Product Requirement Prompts (PRPs). Built with Node.js, Express, and Socket.IO for real-time multiplayer functionality.

## Key Technologies
- Node.js
- Socket.IO for real-time communication
- Express.js for web server
- Jest for testing
- ESLint for code linting

## Project Structure
- `src/` - Main application code
  - `server.js` - Main server entry point
  - `systems/` - Game systems (room management, etc.)
  - `config/` - Configuration files
  - `utils/` - Utility functions
- `public/` - Client-side assets
- `tests/` - Test files
- `data/` - Game data (rooms, etc.)

## Common Commands
- `npm start` - Start the server
- `npm test` - Run tests
- `npm run lint` - Run ESLint

## Development Rules
- **Use the JSDoc style for documentation.**
- **Comment non-obvious code** and ensure everything is understandable to a mid-level developer.
- When writing complex logic, **add an inline comment explaining the why, not just the what.**
- **Use node:test for unit tests on the backend**
- **Never create a file longer than 500 lines of code.** If a file approaches this limit, refactor by splitting it into modules or helper files.
- **Organize code into clearly separated modules,** grouped by feature or responsibility.
- **Always create tests BEFORE**
	- Include at least:
		- 1 test for expected use
		- 1 edge case
		- 1 failure case

## Core Development Philosophy

- **KISS (Keep It Simple, Stupid).** Simplicity should be a key goal in design. Choose straightforward solutions over complex ones whenever possible. Simple solutions are easier to understand, maintain, and debug.
- **YAGNI (You Aren't Gonna Need It).** Avoid building functionality on speculation. Implement features only when they are needed, not when you anticipate they might be useful in the future.

## AI Behavior Rules
- **Never assume missing context. Ask questions if uncertain.**
- **Never hallucinate libraries or functions** – only use known, verified Python packages.
- **Always confirm file paths and module names** exist before referencing them in code or tests.
- **Never delete or overwrite existing code** unless explicitly instructed to or if part of a task from `TASK.md`.

## Development Notes
- The project uses a room-based system for game navigation
- WebSocket communication handles real-time player interactions
- Game state is managed server-side
