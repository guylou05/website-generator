<?php

return [
    'store_invalid_output' => env('AI_STORE_INVALID_OUTPUT', false),
    'invalid_output_retention_hours' => (int) env('AI_INVALID_OUTPUT_RETENTION_HOURS', 24),
];
