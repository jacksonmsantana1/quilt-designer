# The API as a package that runs the same anywhere. Built from the top folder (it needs @quilt/shared):
#   docker build -f server/Dockerfile -t quilt-api .
# No secrets in here: the host gives them to the server when it starts (server/README.md, "Going live").
FROM node:22-slim

ENV NODE_ENV=production
WORKDIR /srv

# npm needs every workspace's package.json to read the lock file, though only these two are installed
COPY package.json package-lock.json ./
COPY app/package.json app/
COPY shared/package.json shared/
COPY server/package.json server/
RUN npm ci --omit=dev --no-audit --no-fund -w @quilt/server -w @quilt/shared

COPY shared/src shared/src
COPY server/src server/src
COPY server/migrations server/migrations

# not as the administrator of the machine
USER node
EXPOSE 8787
CMD ["node", "server/src/server.js"]
