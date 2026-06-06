import {
  countAuditLogsOlderThan,
  createAuditLog,
  deleteAuditLogsOlderThan
} from "../db/audit";
import {
  countOperationalEventsOlderThan,
  deleteOperationalEventsOlderThan
} from "../db/operations";

export const DEFAULT_AUDIT_RETENTION_DAYS = 365;
export const DEFAULT_OPERATIONAL_RETENTION_DAYS = 90;

export interface OpsRetentionResult {
  dryRun: boolean;
  retention: {
    auditDays: number;
    operationalDays: number;
  };
  matched: {
    auditLogs: number;
    operationalEvents: number;
  };
  deleted: {
    auditLogs: number;
    operationalEvents: number;
  };
}

export async function runOpsRetention(input: {
  db: D1Database;
  auditRetentionDays?: number;
  operationalRetentionDays?: number;
  dryRun?: boolean;
  requestId: string;
  action: "ops.retention.run" | "ops.retention.scheduled";
}): Promise<OpsRetentionResult> {
  const auditRetentionDays = input.auditRetentionDays ?? DEFAULT_AUDIT_RETENTION_DAYS;
  const operationalRetentionDays = input.operationalRetentionDays ?? DEFAULT_OPERATIONAL_RETENTION_DAYS;
  const dryRun = input.dryRun === true;

  const [matchedAuditLogs, matchedOperationalEvents] = await Promise.all([
    countAuditLogsOlderThan(input.db, auditRetentionDays),
    countOperationalEventsOlderThan(input.db, operationalRetentionDays)
  ]);

  const [deletedAuditLogs, deletedOperationalEvents] = dryRun
    ? [0, 0]
    : await Promise.all([
        deleteAuditLogsOlderThan(input.db, auditRetentionDays),
        deleteOperationalEventsOlderThan(input.db, operationalRetentionDays)
      ]);

  await createAuditLog(input.db, {
    action: input.action,
    entityType: "ops_retention",
    requestId: input.requestId,
    metadata: {
      auditRetentionDays,
      operationalRetentionDays,
      matchedAuditLogs,
      matchedOperationalEvents,
      deletedAuditLogs,
      deletedOperationalEvents,
      dryRun
    }
  });

  return {
    dryRun,
    retention: {
      auditDays: auditRetentionDays,
      operationalDays: operationalRetentionDays
    },
    matched: {
      auditLogs: matchedAuditLogs,
      operationalEvents: matchedOperationalEvents
    },
    deleted: {
      auditLogs: deletedAuditLogs,
      operationalEvents: deletedOperationalEvents
    }
  };
}
