package com.personalusageanalytics.processor.icon;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class AppIconRepository {

    // Apps with usage but no icon row yet, or whose last lookup found nothing
    // long enough ago to retry. Manual rows are never looked up.
    private static final String FIND_APPS_NEEDING_LOOKUP = """
            SELECT app
            FROM (SELECT DISTINCT app FROM app_usage_rollups) apps
            WHERE NOT EXISTS (
                SELECT 1 FROM app_icons i
                WHERE i.app = apps.app
                  AND (i.source <> 'none' OR i.looked_up_at >= ?)
            )
            ORDER BY app
            LIMIT ?
            """;
    private static final String SAVE_LOOKUP = """
            INSERT INTO app_icons (app, icon_url, source, looked_up_at)
            VALUES (?, ?, ?, NOW())
            ON CONFLICT (app) DO UPDATE
            SET icon_url = EXCLUDED.icon_url,
                source = EXCLUDED.source,
                looked_up_at = NOW()
            WHERE app_icons.source <> 'manual'
            """;

    private final JdbcTemplate jdbcTemplate;

    public AppIconRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<String> findAppsNeedingLookup(Instant retryNoneBefore, int limit) {
        return jdbcTemplate.queryForList(FIND_APPS_NEEDING_LOOKUP, String.class, Timestamp.from(retryNoneBefore), limit);
    }

    public void saveLookup(String app, String iconUrl) {
        jdbcTemplate.update(SAVE_LOOKUP, app, iconUrl, iconUrl == null ? "none" : "itunes");
    }
}
