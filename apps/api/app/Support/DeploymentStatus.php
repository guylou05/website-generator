<?php

namespace App\Support;

use DomainException;

final class DeploymentStatus
{
    /** Legacy `completed` and `stale` remain valid until production rows are retired. */
    public const ALL = ['queued', 'claimed', 'running', 'succeeded', 'failed', 'partially_succeeded', 'cancelling', 'cancelled', 'completed', 'stale'];

    public const TERMINAL = ['succeeded', 'failed', 'partially_succeeded', 'cancelled', 'completed', 'stale'];

    private const TRANSITIONS = [
        'queued' => ['claimed', 'cancelling'],
        'claimed' => ['running', 'failed', 'queued'],
        'running' => ['succeeded', 'failed', 'partially_succeeded', 'cancelling'],
        'cancelling' => ['cancelled'],
    ];

    public static function permits(string $from, string $to): bool
    {
        return in_array($to, self::TRANSITIONS[$from] ?? [], true);
    }

    public static function assertTransition(string $from, string $to): void
    {
        if (! self::permits($from, $to)) {
            throw new DomainException("Invalid deployment transition: {$from} -> {$to}");
        }
    }
}
