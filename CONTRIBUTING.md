# Contributing

## Development

### Prerequisites

#### Rust

https://www.rust-lang.org/tools/install

#### Bun

https://bun.sh/

#### Nodejs LTS

https://nodejs.org/en

### Quick Start

1. Copy the sample .env file:

```bash
cp sample.env .env
```

2. Build the client:

```bash
bun run build
# Use development log in for multiple users
bun run build --mode development
```

3. Start the server:

```bash
bun run develop:server
```

### Manual Testing Tips

## Flight Manual

### Config

Required environment variables:

- `COOKIE_KEY`
  - 64+ utf-8 character string

Optional environment variables:

- `PORT`
  - Default: `8080`
- `ALLOWED_ORIGINS`
  - Default: `http://127.0.0.1:<PORT>`
- `REQUEST_BODY_SIZE_LIMIT`
  - Default: `5242880` (5MB)
- `REQUEST_TIMEOUT_IN_MS`
  - Default: `5000`

### Build

```bash
# Minimal
docker build .
# Suggested
docker build -t curriculum-press:latest -f Dockerfile .
```

### Run

```bash
# Minimal
docker run --env-file .env -p 8080:8080 <IMAGE_ID>
# Suggested
docker run --env-file .env -p 8080:8080 --name curriculum-press-instance curriculum-press:latest
```

### Logging

Filter requests by `RUST_LOG="server=<LEVEL>"`.
