<?php

return [
    'plan_max_age_minutes' => (int) env('DEPLOYMENT_PLAN_MAX_AGE_MINUTES', 60),
    'snapshot_chunk_max_bytes' => (int) env('DEPLOYMENT_SNAPSHOT_CHUNK_MAX_BYTES', 524288),
    'snapshot_max_bytes' => (int) env('DEPLOYMENT_SNAPSHOT_MAX_BYTES', 104857600),
];
