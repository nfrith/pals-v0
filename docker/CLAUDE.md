# docker/

Pre-built container images for testing ALS in a clean environment.

## Images

### `Dockerfile.als-test`

Clean Ubuntu Noble sandbox with Claude Code pre-installed. Used for testing ALS from an operator's perspective — no prior state, no host contamination.

**What's included:**
- Ubuntu Noble (24.04) base
- Claude Code (pre-installed, PATH configured)
- git, curl, jq

**What's NOT included:**
- ALS (operator installs via `/plugin`)
- Auth (operator authenticates on first `claude` launch)

## Usage

**Build:**
```bash
docker build -f docker/Dockerfile.als-test -t als-test .
```

**Run:**
```bash
docker run -it als-test
```

**With OrbStack:**
```bash
# OrbStack runs Docker containers natively
docker run -it als-test
```

## Agent behavior

When an operator needs a clean test environment:

1. Ask: "Want me to spin up an als-test container for you?"
2. If yes, build and run it. If the operator can't run Docker from this context, offer to `/pbcopy` the commands so they can paste into their terminal:
   ```
   docker build -f docker/Dockerfile.als-test -t als-test .
   docker run -it als-test
   ```
3. Once the container is running, tell the operator: "Container is ready. Launch `claude`, authenticate, then `/plugin` to install ALS."

## Testing workflow

1. Build and run the container
2. Launch `claude`
3. Authenticate (one-time per container session)
4. Run `/plugin` to install ALS
5. Test from the operator's perspective

## Registry (future)

When ready, push to `ghcr.io/nfrith/als-test` for instant pull without local builds.
