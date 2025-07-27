# Claude Code Configuration

This file contains configuration and context for Claude Code when working with this repository.

## Project Overview
JogoTesto will be a small multiplayer text-based RPG experiment with a battle royale format that uses AI-driven development through Product Requirement Prompts (PRPs).

## Core Development Philosophy

### OOP Principles
The system design should follow the principles of Object Oriented Programming to create a solution that can be easily integrated with the other components of the system and that ensures future collaborators can understand. The principles are:
- Abstraction
- Encapsulation
- Inheritance
- Polymorphism

### KISS (Keep It Simple, Stupid)
Simplicity should be a key goal in design. Choose straightforward solutions over complex ones whenever possible. Simple solutions are easier to understand, maintain, and debug.

### Design Principles
- **Modular Architecture**: Build with small, focused modules that do one thing well
- **Error-First Callbacks**: Always handle errors as the first parameter in callbacks
- **Fail Fast**: Validate inputs early and throw meaningful errors immediately
- **Security First**: Never trust user input, always validate and sanitize

## 🤖 AI Assistant Guidelines

### Context Awareness
- When implementing features, always check existing patterns first
- Prefer composition over inheritance in all designs
- Use existing utilities before creating new ones
- Check for similar functionality in other domains/features

### Common Pitfalls to Avoid
- Creating duplicate functionality
- Overwriting existing tests
- Modifying core frameworks without explicit instruction
- Adding dependencies without checking existing alternatives

### Workflow Patterns
- Prefferably create tests BEFORE implementation (TDD)
- Use "think hard" for architecture decisions
- Break complex tasks into smaller, testable units
- Validate understanding before implementation

## Common Commands
- `npm install` - Install dependencies
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
- **Preferably create tests BEFORE or DURING implementation**
	- Include at least:
		- 1 test for expected use
		- 1 edge case
		- 1 failure case

## AI Behavior Rules
- **Never assume missing context. Ask questions if uncertain.**
- **Never hallucinate libraries or functions**
- **Always confirm file paths and module names** exist before referencing them in code or tests.
- **Never delete or overwrite existing code**

## Anti-Patterns to Avoid
- ❌ Don't create new patterns when existing ones work
- ❌ Don't skip validation because "it should work"  
- ❌ Don't ignore failing tests - fix them
- ❌ Don't use sync functions in async context
- ❌ Don't hardcode values that should be config
- ❌ Don't catch all exceptions - be specific
