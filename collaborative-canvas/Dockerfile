# ── Build stage ────────────────────────────────────────────────────────────
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app

# Cache dependencies first.
COPY pom.xml .
RUN mvn -B -q -DskipTests dependency:go-offline || true

COPY src ./src
RUN mvn -B -q -DskipTests package \
    && find target -maxdepth 1 -name '*.jar' ! -name '*.original' -exec cp {} /app/app.jar \;

# ── Runtime stage ──────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Cap the heap so Kafka + Postgres + the JVM fit comfortably on a 4 GB VM.
ENV JAVA_TOOL_OPTIONS="-Xmx512m"

COPY --from=build /app/app.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
