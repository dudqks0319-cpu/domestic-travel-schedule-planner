import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";

import Theme from "../../constants/Theme";
import { logAdEvent, type MonetizationPlacement } from "../../services/monetization";

interface AdPlacementProps {
  placement: MonetizationPlacement;
  premium: boolean;
  screen: string;
}

export default function AdPlacement({ placement, premium, screen }: AdPlacementProps) {
  useEffect(() => {
    if (premium) {
      return;
    }

    void logAdEvent({
      placement,
      eventType: "shown",
      metadata: { screen }
    }).catch(() => undefined);
  }, [placement, premium, screen]);

  if (premium) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>광고</Text>
      <Text style={styles.title}>무료 이용자를 위한 광고 영역</Text>
      <Text style={styles.description}>일정 생성 중간이 아닌 완료 후 화면에서만 표시됩니다.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    backgroundColor: Theme.colors.surface,
    padding: 14,
    gap: 4
  },
  label: {
    alignSelf: "flex-start",
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: Theme.colors.borderLight,
    paddingHorizontal: 7,
    paddingVertical: 3,
    fontSize: 11,
    lineHeight: 14,
    color: Theme.colors.textSecondary,
    fontWeight: "800",
    letterSpacing: 0
  },
  title: {
    ...Theme.typography.body2,
    color: Theme.colors.textPrimary,
    fontWeight: "800"
  },
  description: {
    ...Theme.typography.caption,
    color: Theme.colors.textSecondary
  }
});
