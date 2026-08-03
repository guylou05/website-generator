# Deployment status constraint

The production constraint was inspected with:

```sql
SELECT pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'deployments'::regclass AND conname = 'deployments_status_check';
```

Its definition allows `queued`, `running`, `cancelling`, `cancelled`, `succeeded`, `failed`, and `stale`. It does not allow `claimed`, which caused worker claims to fail. The canonical application list additionally includes `claimed`, `partially_succeeded`, and the legacy `completed` value still used by existing deployment records. Migration `2026_08_03_000005` validates all existing rows before replacing the named constraint.
