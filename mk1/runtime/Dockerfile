FROM node:24.19.0-bookworm-slim

ARG TEMPORAL_CLI_VERSION=1.8.1
ARG TEMPORAL_CLI_SHA256=b94417b9a8760b30217f4b881dabce4b16a76a38b5e99e2eca3ce358b8030f06

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSLo /tmp/temporal.tar.gz "https://github.com/temporalio/cli/releases/download/v${TEMPORAL_CLI_VERSION}/temporal_cli_${TEMPORAL_CLI_VERSION}_linux_amd64.tar.gz" \
    && echo "${TEMPORAL_CLI_SHA256}  /tmp/temporal.tar.gz" | sha256sum -c - \
    && tar -xzf /tmp/temporal.tar.gz -C /usr/local/bin temporal \
    && chmod 0755 /usr/local/bin/temporal \
    && rm /tmp/temporal.tar.gz

WORKDIR /app
RUN mkdir -p /data/attachments && chown -R node:node /app /data/attachments

COPY --chown=node:node package.json package-lock.json ./
USER node
RUN npm ci

COPY --chown=node:node . .
RUN npm run check

EXPOSE 7233 8233 8787

CMD ["npm", "run", "worker:b7"]
