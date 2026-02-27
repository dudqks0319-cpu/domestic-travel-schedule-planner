import React from "react";
import { View, Text, StyleSheet } from "react-native";

import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import Typography from "../../constants/Typography";
import type { RouteSegmentEstimate, RouteTransportMode } from "../../services/routeApi";

interface RouteDetailCardProps {
  segment: RouteSegmentEstimate;
  segmentIndex: number;
  mode: RouteTransportMode;
}

function getTransportIcon(mode: RouteTransportMode): string {
  if (mode === "transit") {
    return "🚌";
  }

  if (mode === "walking") {
    return "🚶";
  }

  return "🚗";
}

function getProviderLabel(provider: RouteSegmentEstimate["provider"]): string {
  if (provider === "kakao") {
    return "Kakao";
  }

  if (provider === "odsay") {
    return "ODSAY";
  }

  return "Fallback";
}

function getProviderColor(provider: RouteSegmentEstimate["provider"]): string {
  if (provider === "kakao") {
    return Colors.young.primary;
  }

  if (provider === "odsay") {
    return Colors.senior.primary;
  }

  return Colors.common.gray500;
}

function formatDuration(durationMin: number): string {
  if (durationMin >= 60) {
    const hours = Math.floor(durationMin / 60);
    const mins = Math.round(durationMin % 60);
    return `${hours}시간 ${mins}분`;
  }

  return `${Math.round(durationMin)}분`;
}

export default function RouteDetailCard({ segment, segmentIndex, mode }: RouteDetailCardProps) {
  const fromName = segment.from.name ?? `Point ${segmentIndex + 1}`;
  const toName = segment.to.name ?? `Point ${segmentIndex + 2}`;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Text style={styles.stepText}>구간 {segmentIndex + 1}</Text>
          <Text style={styles.moveText}>{`${getTransportIcon(mode)} ${fromName} → ${toName}`}</Text>
        </View>
        <Text style={[styles.providerBadge, { color: getProviderColor(segment.provider) }]}>
          {getProviderLabel(segment.provider)}
        </Text>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricBlock}>
          <Text style={styles.metricLabel}>거리</Text>
          <Text style={styles.metricValue}>{segment.distanceKm.toFixed(1)} km</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricBlock}>
          <Text style={styles.metricLabel}>예상 시간</Text>
          <Text style={styles.metricValue}>{formatDuration(segment.durationMin)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.common.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.common.gray200,
    padding: Spacing.lg
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between"
  },
  titleRow: {
    flex: 1,
    paddingRight: Spacing.sm
  },
  stepText: {
    ...Typography.normal.caption,
    color: Colors.common.gray500
  },
  moveText: {
    ...Typography.normal.bodySmall,
    color: Colors.common.gray800,
    marginTop: 2,
    fontWeight: "700"
  },
  providerBadge: {
    ...Typography.normal.caption,
    fontWeight: "700"
  },
  metricsRow: {
    marginTop: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.common.gray50,
    borderRadius: 12,
    paddingVertical: Spacing.sm
  },
  metricBlock: {
    flex: 1,
    alignItems: "center"
  },
  metricLabel: {
    ...Typography.normal.caption,
    color: Colors.common.gray500
  },
  metricValue: {
    ...Typography.normal.bodySmall,
    color: Colors.common.gray800,
    fontWeight: "700",
    marginTop: 2
  },
  metricDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: Colors.common.gray200
  }
});
