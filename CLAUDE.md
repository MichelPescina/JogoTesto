# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm start   # Start the server (src/server.js)
npm test    # Run tests using node:test
npm run lint    # Run ESLint
```

## Project Overview

JogoTesto is a multiplayer text-based RPG experiment that uses AI-driven development through Product Requirement Prompts (PRPs). Built with Node.js, Express, and Socket.IO for real-time multiplayer functionality.

## Current Project Structure

```
src/
├── server.js           # Main server entry point
├── config/
│   └── socket.js       # Socket.IO configuration
└── utils/
    └── validation.js   # Validation utilities

public/
├── index.html          # Client HTML
├── client.js          # Client-side JavaScript
└── style.css          # Client styles

tests/
├── server.test.js     # Server unit tests
└── integration.test.js # Integration tests

PRPs/                  # Product Requirement Prompts
features/              # Feature documentation
```

## Development Rules

- **File size limit**: Never create files longer than 500 lines - refactor into modules
- **Testing approach**: Create tests BEFORE implementation (TDD)
- **Documentation**: Use JSDoc style
- **Code principles**: KISS (Keep It Simple) and YAGNI (You Aren't Gonna Need It)

## AI Development Guidelines

- Never assume missing context - ask questions when uncertain
- Never hallucinate libraries or functions - only use verified packages
- Confirm file paths and module names exist before referencing
- Never delete existing code unless explicitly instructed

## Architecture

Node.js/Express server with Socket.IO for real-time communication. Uses native Node.js test runner for testing.

**Dependencies:**
- Production: express, socket.io
- Development: eslint, dotenv, socket.io-client