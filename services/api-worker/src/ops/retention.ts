import {
  countAuditLogsOlderThan,
  createAuditLog,
  deleteAuditLogsOlderThan
} from "../db/audit";
import {
  countOperationalEventsOlderThan,
  deleteOperationalEventsOlderThan
} from "../db/operations";
import {
  expireTripExportsForCleanup,
  listExpiredTripExportsForCleanup
} from "../db/exports";

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
    tripExports: number;
    exportObjects: number;
  };
  deleted: {
    auditLogs: number;
    operationalEvents: number;
    exportObjects: number;
  };
  expired: {
    tripExports: number;
  };
}

export async function runOpsRetention(input: {
  db: D1Database;
  assets?: R2Bucket;
  auditRetentionDays?: number;
  operationalRetentionDays?: number;
  dryRun?: boolean;
  requestId: string;
  action: "ops.retention.run" | "ops.retention.scheduled";
}): Promise<OpsRetentionResult> {
  const auditRetentionDays = input.auditRetentionDays ?? DEFAULT_AUDIT_RETENTION_DAYS;
  const operationalRetentionDays = input.operationalRetentionDays ?? DEFAULT_OPERATIONAL_RETENTION_DAYS;
  const dryRun = input.dryRun === true;

  const [matchedAuditLogs, matchedOperationalEvents, expiredExportRecords] = await Promise.all([
    countAuditLogsOlderThan(input.db, auditRetentionDays),
    countOperationalEventsOlderThan(input.db, operationalRetentionDays),
    listExpiredTripExportsForCleanup(input.db)
  ]);
  const expiredExportObjectKeys = Array.from(new Set(expiredExportRecords.flatMap((record) => [
    record.manifest_key,
    ...(record.asset_key ? [record.asset_key] : [])
  ])));

  const assets = input.assets;
  if (!dryRun && assets && expiredExportObjectKeys.length > 0) {
    await Promise.all(expiredExportObjectKeys.map((key) => assets.delete(key)));
  }

  const [deletedAuditLogs, deletedOperationalEvents] = dryRun
    ? [0, 0]
    : await Promise.all([
        deleteAuditLogsOlderThan(input.db, auditRetentionDays),
        deleteOperationalEventsOlderThan(input.db, operationalRetentionDays)
      ]);
  const expiredTripExports = dryRun ? 0 : await expireTripExportsForCleanup(input.db);
  const deletedExportObjects = dryRun || !assets ? 0 : expiredExportObjectKeys.length;

  await createAuditLog(input.db, {
    action: input.action,
    entityType: "ops_retention",
    requestId: input.requestId,
    metadata: {
      auditRetentionDays,
      operationalRetentionDays,
      matchedAuditLogs,
      matchedOperationalEvents,
      matchedTripExports: expiredExportRecords.length,
      matchedExportObjects: expiredExportObjectKeys.length,
      deletedAuditLogs,
      deletedOperationalEvents,
      deletedExportObjects,
      expiredTripExports,
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
      operationalEvents: matchedOperationalEvents,
      tripExports: expiredExportRecords.length,
      exportObjects: expiredExportObjectKeys.length
    },
    deleted: {
      auditLogs: deletedAuditLogs,
      operationalEvents: deletedOperationalEvents,
      exportObjects: deletedExportObjects
    },
    expired: {
      tripExports: expiredTripExports
    }
  };
}
