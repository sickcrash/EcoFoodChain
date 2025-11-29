FROM postgres:15-alpine

ENV POSTGRES_DB=refood \
    POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres

COPY docker/database/init/ /docker-entrypoint-initdb.d/
COPY backend/src/database/postgres/schema_full.sql /docker-entrypoint-initdb.d/01_schema_full.sql
RUN chmod +x /docker-entrypoint-initdb.d/*.sh
