# Build the self-contained browser application, then serve only the generated
# static site. The Node image is not present in the runtime image.
FROM node:22-alpine AS build
WORKDIR /workspace

COPY package.json ./
COPY public ./public
COPY src ./src
COPY tools ./tools

RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/dist/ /usr/share/nginx/html/

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1:8080/health || exit 1
