# Security Configuration Guide

## MCP Configuration Setup

This project uses MCP (Model Context Protocol) servers that require API keys. For security:

### 1. Configuration Files

- **Never commit `.mcp.json` or `.cursor/mcp.json`** - these are gitignored
- Use the template files: `.mcp.json.template` and `.cursor/mcp.json.template`
- Copy templates to actual files and replace `${ENV_VAR}` with your keys

### 2. Setup Instructions

```bash
# Copy template files
cp .mcp.json.template .mcp.json
cp .cursor/mcp.json.template .cursor/mcp.json

# Edit the files and replace environment variable placeholders with your API keys
# OR better yet, set actual environment variables and use envsubst:
envsubst < .mcp.json.template > .mcp.json
```

### 3. Required API Keys

At minimum you need ONE of these API keys:
- `ANTHROPIC_API_KEY` (recommended)
- `OPENAI_API_KEY`
- `GOOGLE_API_KEY`
- etc.

Optional but recommended:
- `PERPLEXITY_API_KEY` (for research features)

## Dependency Security

### Current Status
- ✅ Most vulnerabilities patched with `npm audit fix`
- ⚠️  webpack-dev-server vulnerabilities remain (development only, requires breaking changes)

### Ongoing Maintenance
```bash
# Regular security updates
npm audit
npm audit fix

# Check for outdated packages
npm outdated
```

## Development Security

- Use HTTPS for all external requests
- Validate all file paths in IPC handlers
- Keep dependencies updated
- Never commit secrets or API keys
- Use proper CSP headers in production builds