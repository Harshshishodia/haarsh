# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN --mount=type=secret,id=proxy_ca,required=true \
  NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca npm ci --strict-ssl=true
COPY . .
RUN npm run build

FROM node:24-alpine
ENV NODE_ENV=production PORT=4173 DATA_DIR=/data
WORKDIR /app
COPY package*.json ./
RUN --mount=type=secret,id=proxy_ca,required=true \
  NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca npm ci --omit=dev --strict-ssl=true
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/docs/phase-1/agent-specs.yaml ./agents/agent-specs.yaml
COPY --from=build /app/knowledge ./knowledge
VOLUME ["/data"]
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=3s --start-period=2s --start-interval=1s CMD node -e "fetch('http://127.0.0.1:4173/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist-server/index.js"]
