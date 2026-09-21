FROM node:26-alpine AS build
WORKDIR /app

COPY services/dashboard/package.json services/dashboard/package-lock.json ./
RUN npm ci

COPY services/dashboard/ ./
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY --chmod=644 services/dashboard/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
