FROM maven:3.9.11-eclipse-temurin-21 AS build

WORKDIR /workspace

COPY services/analytics-api/pom.xml services/analytics-api/pom.xml
RUN mvn --batch-mode --file services/analytics-api/pom.xml dependency:go-offline

COPY services/analytics-api/src services/analytics-api/src
RUN mvn --batch-mode --file services/analytics-api/pom.xml package -DskipTests

FROM eclipse-temurin:21-jre-jammy

RUN apt-get update \
    && apt-get install --yes --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10001 spring \
    && useradd --system --uid 10001 --gid spring --home-dir /app --shell /usr/sbin/nologin spring

WORKDIR /app
COPY --from=build /workspace/services/analytics-api/target/analytics-api-*.jar app.jar

USER spring:spring

EXPOSE 8081

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
