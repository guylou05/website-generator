import type { WebsiteRevision } from './api-client';

export function deploymentRevisionState(revisions: WebsiteRevision[]) {
  const newest = revisions.reduce<WebsiteRevision | undefined>(
    (latest, revision) =>
      !latest || revision.revisionNumber > latest.revisionNumber
        ? revision
        : latest,
    undefined,
  );

  return {
    selectedRevisionId: newest?.id,
    showSelector: revisions.length > 1,
    canCreatePlan: revisions.length > 0,
  };
}
