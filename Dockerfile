FROM node:24-bookworm-slim
WORKDIR /app
COPY src ./src
COPY web ./web
ENV NODE_ENV=production \
    FIREWELL_BIND=0.0.0.0 \
    FIREWELL_DB=/data/firewell.sqlite
RUN mkdir -p /data
EXPOSE 3000
CMD ["node", "--experimental-strip-types", "src/server.ts"]
