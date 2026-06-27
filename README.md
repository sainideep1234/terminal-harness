# Chi Agent (Opencode CLI)

An intelligent AI coding assistant for your terminal. It understands your coding requests, creates step-by-step plans, writes best practices, and uses helper AI agents to get tasks done quickly and safely.

---

## 🚀 Key Features

### Works with Popular AI Models
- **Multiple AI Providers**: Supports Google Gemini, OpenAI (GPT models), and Anthropic Claude.
- **Easy Provider Switching**: Remembers your active AI provider, model, and API keys in a local file (`database.json`).

### Smart Coordinator & Helper Agents
- **Task Delegation**: A main coordinator AI breaks your request into smaller tasks and creates helper AI agents to work on them.
- **Automatic Best Practices**: Automatically writes coding guidelines for your project and shares them with helper agents before they start coding.

### Runs Tasks in Parallel
- **Smart Planning**: Organizes tools and actions into a step-by-step plan and runs independent tasks at the same time to save time.

### Built-in Safety Checks
- **Asks Before Risky Actions**: Asks for your permission before running dangerous commands like deleting files (`rm`).
- **Activity Tracking**: Tracks tool activity before and after execution to show progress clearly.

---

## 🛠️ Tools Available

- **`zsh`**: Runs terminal and shell commands.
- **`file_write`**: Creates or edits files on your computer.
- **`read_file`**: Reads text from a file.
- **`grep_search`**: Searches for specific text across files in a folder.
- **`find_files`**: Finds files by name in your project.
- **`git`**: Runs Git commands (`status`, `diff`, `commit`, etc.).
- **`create_a_subagent`**: Creates helper AI agents for specific jobs.
- **`plan_maker`**: Creates an ordered list of steps to execute.
- **`skill_maker`**: Writes coding rules and tips for helper agents to follow.

---

## 🛡️ Edge Cases Covered

### 1. Prevents File Overwriting Errors
- **Safe Simultaneous File Edits**: If multiple tasks try to write to the same file at once, it queues them up so file content doesn't get corrupted.

### 2. Stops Accidental File Deletion
- **Safety Prompt for Dangerous Commands**: Automatically detects risky commands like `rm` and pauses to ask for your approval (`y/n`).

### 3. Prevents Terminal Freezes
- **Automatic Timeouts**: Places time limits on background commands (30 seconds for shell commands, 15 seconds for Git) so the tool never freezes infinitely.

### 4. Cleans Up Search Results
- **Ignores Unnecessary Folders**: Automatically skips huge folders like `node_modules` and `.git` when searching for files, keeping search fast and clean.

### 5. Handles Provider Name Typos
- **Smart Provider Match**: Understands simple variations (like using `gemini` for `google`) and falls back smoothly to your active session settings.

---

## ⚡ Quickstart Guide

### 1. Prerequisites
Make sure you have [Bun](https://bun.sh) installed:

```bash
bun --version
```

### 2. Install Dependencies
Install required packages:

```bash
bun install
```

### 3. Log In to an AI Provider
Set up your API key for your chosen provider:

```bash
# For Google Gemini
bun run cli.ts providers login -p google -a YOUR_API_KEY

# For OpenAI
bun run cli.ts providers login -p openai -a YOUR_API_KEY

# For Anthropic Claude
bun run cli.ts providers login -p claude -a YOUR_API_KEY
```

### 4. Pick Your AI Model
List available models and pick the one you want to use:

```bash
# View available models
bun run cli.ts models ls

# Select a model
bun run cli.ts models set -m gemini-3.5-flash
```

### 5. Start Using the Agent
Run coding tasks directly from your terminal:

```bash
bun run cli.ts agent -p "Check git status and explain the recent changes"
```
