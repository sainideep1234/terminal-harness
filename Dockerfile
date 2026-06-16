FROM oven/bun:latest

WORKDIR /app

COPY package.json bun.lock ./

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

RUN bun install

COPY . .

WORKDIR /workspace

ENTRYPOINT ["bun" , "run" , "/app/cli.ts"]