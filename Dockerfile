# syntax=docker/dockerfile:1.5

FROM node:20.11.0-alpine3.19 as builder

# Create app directory
WORKDIR /app

# Dev dependencies for building any local packages
RUN <<EOF
  apk update --no-cache
  apk add git             # Fetch some packages
  apk add python3         # Some node gyp bindings requires Python
  apk add make g++        # Standard tools for building native extensions
  npm install -g node-gyp # Compile native extensions
EOF

# Re-install packages if there were any changes
COPY package.json yarn.lock ./

RUN <<EOF
  # Install development node modules so we can build the project, but we'll
  # eventually throw these away in favor of the trimmed production node_modules
  yarn install && mv node_modules node_modules-development

  # Install only production node_modules and prune them so we're shipping as
  # small an image as possible. This will reuse the local cache of packages that
  # yarn already downloaded from the installation of development modules above.
  yarn install --production --prefer-offline

  # Move production node modules out of the directory so the build step doesn't
  # accidentally try to use it.
  mv node_modules ../node_modules-production

  # Swap production node modules with the development so we can build the app
  mv node_modules-development node_modules
EOF

# Copy application code after installing so we benefit from the layer cache
COPY . .

# Build the application so we can distribute
RUN yarn build

# When updating image version, make sure to update above layer as well
FROM node:20.11.0-alpine3.19 as app

WORKDIR /app

RUN <<EOF
  # Requirement for Datadog runtime metrics integration
  apk add libc6-compat
EOF

# Copy all packages including compiled extensions
COPY --from=builder /node_modules-production node_modules
# Copy essential source code
COPY --from=builder /app/build .

# Dummy value to get ESM detection to work
RUN echo '{"type":"module"}' > package.json

# BuildKit doesn't support the --squash flag, so we emulate it
# copying everything into a single layer.
FROM scratch
COPY --from=app / /

WORKDIR /app

CMD ["node", "index.js"]
