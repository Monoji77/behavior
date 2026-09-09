FROM maven:3.9.11-eclipse-temurin-21 AS build

WORKDIR /workspace

COPY services/stream-processor/pom.xml services/stream-processor/pom.xml
RUN mvn --batch-mode --file services/stream-processor/pom.xml dependency:go-offline

COPY services/stream-processor/src services/stream-processor/src
RUN mvn --batch-mode --file services/stream-processor/pom.xml package -DskipTests

FROM eclipse-temurin:21-jre-jammy

RUN groupadd --system --gid 10001 spring \
    && useradd --system --uid 10001 --gid spring --home-dir /app --shell /usr/sbin/nologin spring

WORKDIR /app
COPY --from=build /workspace/services/stream-processor/target/stream-processor-*.jar app.jar

USER spring:spring

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
