# Sapphire

A local-first AI assistant framework with voice, memory, and extensibility.

## Overview

Sapphire is an open-source framework for building persistent AI personas. It features voice interaction, semantic memory, plugin architecture, and integrations with popular services — all self-hosted and privacy-first.

## Key Features

- **Voice Interface** - Wake word detection, speech-to-text, text-to-speech
- **Persistent Memory** - Semantic vector search and knowledge management
- **Customizable Personas** - 11 built-in personalities with voice, prompt, and tools
- **Plugins** - 20+ community plugins for Discord, Telegram, Email, Smart Home, and more
- **Privacy First** - Fully self-hosted, local-first, optional cloud support
- **Extensible** - Write custom tools and plugins at runtime

> **⚠️ Warning** — Sapphire can execute shell commands, control smart home devices, send emails, and more. Configure carefully and enable integrations only as needed.

## Requirements

- Ubuntu 22.04+ or Windows 11+
- Python 3.11+ (via conda)
- 16GB+ RAM
- (optional) Nvidia GPU for better performance

## Installation

### Using Conda (Recommended)

```bash
conda create -n sapphire python=3.11 -y
conda activate sapphire
git clone https://github.com/ddxfish/sapphire.git
cd sapphire
pip install -r requirements.txt
python main.py
```

Open https://localhost:8073 in your browser.

### Using Docker

```bash
mkdir ~/sapphire && cd ~/sapphire
curl -fsSL https://raw.githubusercontent.com/ddxfish/sapphire/main/docker-compose.yml -o docker-compose.yml
docker compose up -d
```

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/).

## Documentation

- [Installation Guide](docs/INSTALLATION.md) - Detailed setup and systemd service
- [Plugins](docs/PLUGINS.md) - Install and build plugins
- [API Reference](docs/API.md) - REST endpoints
- [Docker Setup](docs/DOCKER.md) - Container deployment
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues

## Contributing

Contributing is open! Start by reading [Plugin Author Guide](docs/plugin-author/README.md) to build plugins — this is the easiest way to extend Sapphire.

## License

[AGPL-3.0](LICENSE) - Free to modify and distribute. If deployed as a service, source changes must be shared.
