import React from "react";
import { View, Text, StyleSheet } from "react-native";

import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import Typography from "../../constants/Typography";
import DatePicker from "../common/DatePicker";

interface StepDatesProps {
  startDate?: string;
  endDate?: string;
  onChangeStartDate: (date: string) => void;
  onChangeEndDate: (date: string) => void;
}

function parseDate(dateText?: string): Date | null {
  if (!dateText || !/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return null;

  const parsed = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function getTripLength(startDate?: string, endDate?: string): { nights: number; days: number } | null {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end) return null;

  const diffInMs = end.getTime() - start.getTime();
  const nights = Math.floor(diffInMs / (24 * 60 * 60 * 1000));
  if (nights < 0) return null;

  return { nights, days: nights + 1 };
}

export default function StepDates({
  startDate,
  endDate,
  onChangeStartDate,
  onChangeEndDate
}: StepDatesProps) {
  const tripLength = getTripLength(startDate, endDate);

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🗓️</Text>
      <Text style={styles.title}>여행 날짜를 골라주세요</Text>
      <Text style={styles.description}>출발일과 도착일을 선택하면 일정 길이를 계산해드려요.</Text>

      <DatePicker label="출발일" value={startDate} onChange={onChangeStartDate} />
      <DatePicker label="도착일" value={endDate} onChange={onChangeEndDate} minimumDate={startDate} />

      {tripLength ? (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>여행 기간</Text>
          <Text style={styles.summaryValue}>
            {tripLength.nights}박 {tripLength.days}일
          </Text>
        </View>
      ) : null}

      {startDate && endDate && !tripLength ? (
        <Text style={styles.warning}>도착일은 출발일 이후로 선택해주세요.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.sm
  },
  emoji: {
    fontSize: 48,
    textAlign: "center",
    marginBottom: Spacing.sm
  },
  title: {
    ...Typography.normal.h2,
    color: Colors.common.black,
    textAlign: "center",
    marginBottom: Spacing.xs
  },
  description: {
    ...Typography.normal.bodySmall,
    color: Colors.common.gray500,
    textAlign: "center",
    marginBottom: Spacing.xxl
  },
  summaryBox: {
    marginTop: Spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.common.gray200,
    backgroundColor: Colors.common.gray50,
    padding: Spacing.lg,
    alignItems: "center"
  },
  summaryTitle: {
    ...Typography.normal.bodySmall,
    color: Colors.common.gray500,
    marginBottom: Spacing.xs
  },
  summaryValue: {
    ...Typography.normal.h3,
    color: Colors.young.primary
  },
  warning: {
    ...Typography.normal.caption,
    color: Colors.common.error,
    marginTop: Spacing.sm,
    textAlign: "center"
  }
});
