package com.personalusageanalytics.ingestion.web;

import com.personalusageanalytics.ingestion.event.KafkaPublishException;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(KafkaPublishException.class)
    public ResponseEntity<ProblemDetail> handleKafkaPublishFailure(
            KafkaPublishException exception
    ) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.SERVICE_UNAVAILABLE,
                "The event stream is temporarily unavailable."
        );
        problem.setTitle("Event publication failed");

        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(problem);
    }
}