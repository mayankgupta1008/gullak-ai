FROM node:24-alpine

RUN corepack enable
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

# Workspace config + lockfile, then this package's manifest
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Source is bind-mounted by docker-compose, not copied.

EXPOSE 5001

CMD ["pnpm", "--filter", "backend", "dev"]
