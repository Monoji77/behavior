package com.personalusageanalytics.ingestion.security;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import com.personalusageanalytics.ingestion.config.IngestionProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class CollectorTokenFilter extends OncePerRequestFilter {

    private static final String EVENT_PATH = "/api/v1/events";
    private static final String TOKEN_HEADER = "X-Collector-Token";

    private final IngestionProperties ingestionProperties;

    public CollectorTokenFilter(IngestionProperties ingestionProperties) {
        this.ingestionProperties = ingestionProperties;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !HttpMethod.POST.matches(request.getMethod())
                || !EVENT_PATH.equals(request.getServletPath());
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String suppliedToken = request.getHeader(TOKEN_HEADER);
        byte[] expected = ingestionProperties.collectorToken()
                .getBytes(StandardCharsets.UTF_8);
        byte[] supplied = suppliedToken == null
                ? new byte[0]
                : suppliedToken.getBytes(StandardCharsets.UTF_8);

        if (!MessageDigest.isEqual(expected, supplied)) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid collector token");
            return;
        }

        filterChain.doFilter(request, response);
    }
}