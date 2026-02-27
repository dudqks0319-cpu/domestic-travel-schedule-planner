import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";

import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import Typography from "../../constants/Typography";
import BottomSheet from "./BottomSheet";

interface DatePickerProps {
  label: string;
  value?: string;
  onChange: (date: string) => void;
  placeholder?: string;
  minimumDate?: string;
  maximumDays?: number;
  error?: string;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

function parseDate(dateText?: string): Date | null {
  if (!dateText || !/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return null;
  const parsed = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(dateText?: string): string {
  const parsed = parseDate(dateText);
  if (!parsed) return "";

  const month = parsed.getMonth() + 1;
  const day = parsed.getDate();
  const weekday = WEEKDAYS[parsed.getDay()];
  return `${month}월 ${day}일 (${weekday})`;
}

function buildDateOptions(startDate: Date, maximumDays: number): string[] {
  const safeDays = Math.max(1, maximumDays);
  const list: string[] = [];

  for (let i = 0; i < safeDays; i += 1) {
    const nextDate = new Date(startDate.getTime() + DAY_IN_MS * i);
    list.push(toIsoDate(nextDate));
  }

  return list;
}

export default function DatePicker({
  label,
  value,
  onChange,
  placeholder = "날짜를 선택해주세요",
  minimumDate,
  maximumDays = 120,
  error
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const optionStartDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const min = parseDate(minimumDate);
    if (!min) return today;
    return min.getTime() > today.getTime() ? min : today;
  }, [minimumDate]);

  const dateOptions = useMemo(
    () => buildDateOptions(optionStartDate, maximumDays),
    [optionStartDate, maximumDays]
  );

  const selectedLabel = formatDate(value);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      <TouchableOpacity
        style={[styles.field, error && styles.fieldError]}
        onPress={() => setIsOpen(true)}
        activeOpacity={0.7}
        accessibilityRole="button"
      >
        <Text style={[styles.valueText, !selectedLabel && styles.placeholder]}>
          {selectedLabel || placeholder}
        </Text>
        <Text style={styles.icon}>📅</Text>
      </TouchableOpacity>

      {error ? <Text style={styles.errorText}>⚠️ {error}</Text> : null}

      <BottomSheet visible={isOpen} onClose={() => setIsOpen(false)} title={label}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {dateOptions.map((dateOption) => {
            const isSelected = value === dateOption;

            return (
              <TouchableOpacity
                key={dateOption}
                style={[styles.option, isSelected && styles.optionSelected]}
                onPress={() => {
                  onChange(dateOption);
                  setIsOpen(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                  {formatDate(dateOption)}
                </Text>
                <Text style={[styles.optionSubText, isSelected && styles.optionTextSelected]}>
                  {dateOption}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg
  },
  label: {
    ...Typography.normal.bodySmall,
    color: Colors.common.gray700,
    fontWeight: "700",
    marginBottom: Spacing.sm
  },
  field: {
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.common.gray200,
    backgroundColor: Colors.common.white,
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  fieldError: {
    borderColor: Colors.common.error
  },
  valueText: {
    ...Typography.normal.body,
    color: Colors.common.black
  },
  placeholder: {
    color: Colors.common.gray400
  },
  icon: {
    fontSize: 18
  },
  errorText: {
    ...Typography.normal.caption,
    color: Colors.common.error,
    marginTop: Spacing.xs
  },
  option: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.common.gray200,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm
  },
  optionSelected: {
    borderColor: Colors.young.primary,
    backgroundColor: "#EBF5FF"
  },
  optionText: {
    ...Typography.normal.body,
    color: Colors.common.gray800,
    fontWeight: "700"
  },
  optionSubText: {
    ...Typography.normal.caption,
    color: Colors.common.gray500,
    marginTop: 2
  },
  optionTextSelected: {
    color: Colors.young.primary
  }
});
