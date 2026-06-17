# folderex

Share any local folder via a public HTTPS URL with basic auth protection.

Launches a local file browser server and exposes it through a tunnel provider (Cloudflare or Loophole), giving you an instant public HTTPS URL. No infrastructure needed.

## Install

```bash
npm install -g folderex
```

## Quick start

```bash
# One-time setup
folderex config set user admin
folderex config set pass secret123

# Share a folder
folderex ./dist
```

## Usage

```bash
folderex <folder> [options]
```

### Examples

```bash
# Share the current directory
folderex . -u admin -p secret123

# Share with loophole (custom subdomain)
folderex ./dist -r loophole -s mioprogetto

# Use config defaults (no flags needed after setup)
folderex ./build

# Override a single setting
folderex ./dist -r loophole

# Local only (no public tunnel)
folderex ./build --no-tunnel

# Use a specific port
folderex ./output --port 8080
```

### Output

```
  folderex
  Sharing:  /home/user/project/dist
  Provider: cloudflare

  * Local server:  http://localhost:43821
  * Public URL:    https://abc-xyz-123.trycloudflare.com

  Auth: admin / *********
  Press Ctrl+C to stop
```

Share the public URL with your team. They will be prompted for username and password.

## Options

| Option | Description |
|--------|-------------|
| `<folder>` | Folder to share (default: `.`) |
| `-u, --user <name>` | Username for basic auth |
| `-p, --pass <secret>` | Password for basic auth |
| `-r, --provider <name>` | Tunnel provider: `cloudflare` or `loophole` |
| `-s, --subdomain <name>` | Custom subdomain (loophole only) |
| `--port <n>` | Local port (default: random) |
| `--no-tunnel` | Local server only, no public URL |
| `-V, --version` | Show version |
| `-h, --help` | Show help |

All options fall back to saved config values when not specified.

## Configuration

Settings are stored in `~/.folderex/conf/config.json`.

```bash
# Save defaults
folderex config set user admin
folderex config set pass secret123
folderex config set provider loophole
folderex config set subdomain mioprogetto

# Read a value
folderex config get user

# List all values
folderex config list

# Delete a value
folderex config delete subdomain
```

### Valid keys

| Key | Values | Description |
|-----|--------|-------------|
| `user` | any string | Default username for basic auth |
| `pass` | any string | Default password for basic auth |
| `provider` | `cloudflare`, `loophole` | Default tunnel provider |
| `subdomain` | any string | Custom subdomain for loophole |

CLI flags always override saved config values.

## Tunnel providers

### Cloudflare (default)

- Uses Cloudflare Quick Tunnels via `cloudflared`
- Binary is downloaded automatically and cached in `~/.folderex/bin/`
- URL is random (e.g. `https://abc-xyz.trycloudflare.com`)
- No account required

### Loophole

- Uses [loophole.cloud](https://loophole.cloud) tunnels
- Binary is downloaded automatically and cached in `~/.folderex/bin/`
- Supports custom subdomains on free tier: `https://yourname.loophole.site`
- Requires a free account (one-time login)

```bash
# First time: login (opens browser)
~/.folderex/bin/loophole account login

# Random subdomain
folderex ./dist -r loophole

# Custom subdomain
folderex ./dist -r loophole -s mioprogetto
# -> https://mioprogetto.loophole.site
```

## How it works

1. Starts a local Express server with basic auth and a file browser UI
2. Downloads the tunnel binary if needed (cached in `~/.folderex/bin/`)
3. Opens a tunnel (Cloudflare or Loophole) to expose the local server on a public HTTPS URL
4. Prints the URL, ready to share

The URL stays stable for the entire session. Press `Ctrl+C` to stop.

## Requirements

- Node.js >= 18
- Internet connection (for the tunnel)
- Free loophole.cloud account (for loophole provider only)

## Development

```bash
git clone https://github.com/your-org/folderex.git
cd folderex
npm install
npm run build
node dist/index.js ./test-folder -u admin -p test
```

## License

MIT
