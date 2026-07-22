# Deployment jobs

A successful generation and successful dry-run preview are required before live deployment. Only one active live deployment per project is allowed. Submit `POST /api/projects/{project}/deployments/preview`, observe the persisted result, and then submit `POST /api/projects/{project}/deployments`; both return 202.

The worker receives decrypted Application Passwords only through the authenticated internal context endpoint and never writes them locally. Cancellation prevents subsequent mutations, although a WordPress request already in progress may finish. Start the scheduler with `php artisan schedule:work`; it recovers expired heartbeats up to `max_attempts`.
