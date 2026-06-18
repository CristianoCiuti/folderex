# folderex

Share any local folder via a public HTTPS URL with basic auth protection.

Launches a local file browser server and exposes it through a tunnel provider (Cloudflare, Loophole, zrok, Expose.sh or Packetriot), giving you an instant public HTTPS URL. No infrastructure needed.

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

# Share with zrok (custom subdomain)
folderex ./dist -r zrok -s myname

# Share with expose.sh (uses GitHub SSH key)
folderex ./dist -r expose -s MyGithubUser --sshkey id_personal

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
| `-r, --provider <name>` | Tunnel provider: `cloudflare`, `loophole`, `zrok`, `expose`, or `packetriot` |
| `-s, --subdomain <name>` | Custom subdomain (loophole/zrok) or GitHub username (expose) |
| `--sshkey <path>` | SSH private key for expose.sh (name or full path) |
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
folderex config set sshkey id_personal

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
| `provider` | `cloudflare`, `loophole`, `zrok`, `expose`, `packetriot` | Default tunnel provider |
| `subdomain` | any string | Custom subdomain (loophole/zrok) or GitHub username (expose) |
| `sshkey` | any string | SSH key name or path for expose.sh |

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

### zrok

- Uses [zrok](https://zrok.io) tunnels
- Binary is downloaded automatically and cached in `~/.folderex/bin/`
- Supports custom subdomains: `https://yourname.share.zrok.io`
- Requires a free account (one-time enable)

```bash
# First time: enable your account
~/.folderex/bin/zrok2 enable <your-token>

# Custom subdomain
folderex ./dist -r zrok -s myname
```

### Expose.sh

- Uses [expose.sh](https://expose.sh) tunnels via SSH
- No binary to install — uses your system SSH client
- URL based on GitHub username: `https://yourusername.expos.es`
- Requires SSH keys on GitHub + starring the [EXPOSE repo](https://github.com/gaetanlhf/EXPOSE)

```bash
# Setup
folderex config set provider expose
folderex config set subdomain YourGithubUser
folderex config set sshkey id_personal

# Share
folderex ./dist
# -> https://yourgithubuser.expos.es
```

### Packetriot

- Uses [packetriot.com](https://packetriot.com) tunnels
- Binary is downloaded automatically and cached in `~/.folderex/bin/`
- Persistent hostname assigned at signup: `https://yourname.pktriot.xyz`
- Requires a free account (one-time configure)

```bash
# First time: configure (email + password)
~/.folderex/bin/pktriot configure

# Share
folderex ./dist -r packetriot
```

## How it works

1. Starts a local Express server with basic auth and a file browser UI
2. Downloads the tunnel binary if needed (cached in `~/.folderex/bin/`), or uses SSH for expose.sh
3. Opens a tunnel to expose the local server on a public HTTPS URL
4. Prints the URL, ready to share

The URL stays stable for the entire session. Press `Ctrl+C` to stop.

## Features

- File browser with upload and delete
- Dark/light theme toggle
- Shared clipboard via WebSocket
- Real-time file change notifications

## Requirements

- Node.js >= 18
- Internet connection (for the tunnel)
- Free account for loophole/zrok/packetriot providers
- GitHub SSH keys + star for expose.sh provider

## License

MIT
