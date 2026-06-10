FROM oven/bun:latest

WORKDIR /app

COPY package.json bun.lock ./

RUN bun install

COPY . .

WORKDIR /workspace

ENTRYPOINT ["bun" , "run" , "/app/cli.ts"]