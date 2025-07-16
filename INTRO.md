# JogoTesto

## Overview
The goal of this project is to create a multiplayer role playing game based on text interaction between the game world and the user. Also this project serves as an experiment to see how software development can be done using agentic ai text generation tools can be used throughout the whole process.

This is done through Product Requirement Prompt (in short PRP), which is a document that contains detailed explainations pertaining to the what and how of the implementation of a feature. The what might include a detailed explaination of the feature, user stories, and other software engineering documents while the how might involve documentation, examples from other projects, specifications, best practices, the technical stuff and more. This is fed to a command prompt (which can be fount at ./claude) that contains instructions for performing these tasks. Also you should include which patterns to follow and which not.

## The Rules
As this is a new project there is not much built right now but these are the general principles.

- **Use the JSDoc style for documentation.**
- **Comment non-obvious code** and ensure everything is understandable to a mid-level developer.
- When writing complex logic, **add an inline comment explaining the why, not just the what.**
- **Use node:test for unit tests on the backend**
- **Never create a file longer than 500 lines of code.** If a file approaches this limit, refactor by splitting it into modules or helper files.
- **Organize code into clearly separated modules,** grouped by feature or responsibility.
- **Preferably create tests BEFORE implementation (TDD)**
- **Check `TASK.md` before starting a new task.** If the task isn’t listed, add it with a brief description and today's date.

### Core Development Philosophy

- **KISS (Keep It Simple, Stupid).** Simplicity should be a key goal in design. Choose straightforward solutions over complex ones whenever possible. Simple solutions are easier to understand, maintain, and debug.

- **YAGNI (You Aren't Gonna Need It).** Avoid building functionality on speculation. Implement features only when they are needed, not when you anticipate they might be useful in the future.

### AI Behavior Rules
- **Never assume missing context. Ask questions if uncertain.**
- **Never hallucinate libraries or functions** – only use known, verified Python packages.
- **Always confirm file paths and module names** exist before referencing them in code or tests.
- **Never delete or overwrite existing code** unless explicitly instructed to or if part of a task from `TASK.md`.
