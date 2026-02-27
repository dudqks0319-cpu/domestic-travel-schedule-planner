import React, { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

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

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
const CALENDAR_CELL_COUNT = 42;

function startOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function parseDate(dateText?: string): Date | null {
  if (!dateText || !/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return null;
  const parsed = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return startOfDay(parsed);
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

function addDays(baseDate: Date, amount: number): Date {
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + amount);
  return startOfDay(nextDate);
}

function addMonths(baseDate: Date, amount: number): Date {
  return new Date(baseDate.getFullYear(), baseDate.getMonth() + amount, 1);
}

function toMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function buildMonthCells(monthDate: Date): Array<Date | null> {
  const monthStart = toMonthStart(monthDate);
  const firstWeekday = monthStart.getDay();
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const cells: Array<Date | null> = [];

  for (let i = 0; i < CALENDAR_CELL_COUNT; i += 1) {
    const day = i - firstWeekday + 1;

    if (day < 1 || day > daysInMonth) {
      cells.push(null);
      continue;
    }

    cells.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), day));
  }

  return cells;
}

function isDateInRange(date: Date, minimumDate: Date, maximumDate: Date): boolean {
  const time = date.getTime();
  return time >= minimumDate.getTime() && time <= maximumDate.getTime();
}

function toMonthLabel(monthDate: Date): string {
  return `${monthDate.getFullYear()}년 ${monthDate.getMonth() + 1}월`;
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

  const today = useMemo(() => startOfDay(new Date()), []);
  const selectedDate = useMemo(() => parseDate(value), [value]);

  const optionStartDate = useMemo(() => {
    const min = parseDate(minimumDate);
    if (!min) return today;
    return min.getTime() > today.getTime() ? min : today;
  }, [minimumDate, today]);

  const optionEndDate = useMemo(
    () => addDays(optionStartDate, Math.max(1, maximumDays) - 1),
    [optionStartDate, maximumDays]
  );

  const [visibleMonth, setVisibleMonth] = useState<Date>(() => {
    if (selectedDate && isDateInRange(selectedDate, optionStartDate, optionEndDate)) {
      return toMonthStart(selectedDate);
    }
    return toMonthStart(optionStartDate);
  });

  const monthCells = useMemo(() => buildMonthCells(visibleMonth), [visibleMonth]);

  const canGoPreviousMonth = useMemo(() => {
    const previousMonth = addMonths(visibleMonth, -1);
    const previousMonthEnd = new Date(previousMonth.getFullYear(), previousMonth.getMonth() + 1, 0);
    previousMonthEnd.setHours(0, 0, 0, 0);
    return previousMonthEnd.getTime() >= optionStartDate.getTime();
  }, [visibleMonth, optionStartDate]);

  const canGoNextMonth = useMemo(() => {
    const nextMonthStart = addMonths(visibleMonth, 1);
    return nextMonthStart.getTime() <= optionEndDate.getTime();
  }, [visibleMonth, optionEndDate]);

  const openPicker = () => {
    if (selectedDate && isDateInRange(selectedDate, optionStartDate, optionEndDate)) {
      setVisibleMonth(toMonthStart(selectedDate));
    } else {
      setVisibleMonth(toMonthStart(optionStartDate));
    }
    setIsOpen(true);
  };

  const selectedLabel = formatDate(value);
  const selectedIso = selectedDate ? toIsoDate(selectedDate) : "";

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      <Pressable
        style={[styles.field, error && styles.fieldError]}
        onPress={openPicker}
        accessibilityRole="button"
      >
        <Text style={[styles.valueText, !selectedLabel && styles.placeholder]}>
          {selectedLabel || placeholder}
        </Text>
        <Text style={styles.icon}>달력</Text>
      </Pressable>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <BottomSheet visible={isOpen} onClose={() => setIsOpen(false)} title={label}>
        <View style={styles.calendar}>
          <View style={styles.monthHeader}>
            <Pressable
              style={[styles.monthMoveButton, !canGoPreviousMonth && styles.monthMoveButtonDisabled]}
              onPress={() => setVisibleMonth((prev) => addMonths(prev, -1))}
              disabled={!canGoPreviousMonth}
              accessibilityRole="button"
              accessibilityLabel="이전 달"
            >
              <Text style={[styles.monthMoveButtonText, !canGoPreviousMonth && styles.monthMoveButtonTextDisabled]}>
                {"<"}
              </Text>
            </Pressable>

            <Text style={styles.monthLabel}>{toMonthLabel(visibleMonth)}</Text>

            <Pressable
              style={[styles.monthMoveButton, !canGoNextMonth && styles.monthMoveButtonDisabled]}
              onPress={() => setVisibleMonth((prev) => addMonths(prev, 1))}
              disabled={!canGoNextMonth}
              accessibilityRole="button"
              accessibilityLabel="다음 달"
            >
              <Text style={[styles.monthMoveButtonText, !canGoNextMonth && styles.monthMoveButtonTextDisabled]}>
                {">"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((day) => (
              <Text key={day} style={styles.weekdayLabel}>
                {day}
              </Text>
            ))}
          </View>

          <View style={styles.dayGrid}>
            {monthCells.map((dateCell, index) => {
              if (!dateCell) {
                return <View key={`empty-${index}`} style={styles.dayCellSlot} />;
              }

              const dateText = toIsoDate(dateCell);
              const isSelected = dateText === selectedIso;
              const isDisabled = !isDateInRange(dateCell, optionStartDate, optionEndDate);

              return (
                <View key={dateText} style={styles.dayCellSlot}>
                  <Pressable
                    style={[
                      styles.dayCellButton,
                      isSelected && styles.dayCellButtonSelected,
                      isDisabled && styles.dayCellButtonDisabled
                    ]}
                    onPress={() => {
                      setIsOpen(false);
                      onChange(dateText);
                    }}
                    disabled={isDisabled}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected, disabled: isDisabled }}
                  >
                    <Text
                      style={[
                        styles.dayCellText,
                        isSelected && styles.dayCellTextSelected,
                        isDisabled && styles.dayCellTextDisabled
                      ]}
                    >
                      {dateCell.getDate()}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
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
    ...Typography.normal.caption,
    color: Colors.common.gray500,
    fontWeight: "700"
  },
  errorText: {
    ...Typography.normal.caption,
    color: Colors.common.error,
    marginTop: Spacing.xs
  },
  calendar: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.common.gray100,
    padding: Spacing.md,
    backgroundColor: Colors.common.white
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md
  },
  monthMoveButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.common.gray200,
    alignItems: "center",
    justifyContent: "center"
  },
  monthMoveButtonDisabled: {
    borderColor: Colors.common.gray100,
    backgroundColor: Colors.common.gray50
  },
  monthMoveButtonText: {
    ...Typography.normal.h3,
    color: Colors.common.gray700,
    lineHeight: 24
  },
  monthMoveButtonTextDisabled: {
    color: Colors.common.gray400
  },
  monthLabel: {
    ...Typography.normal.body,
    color: Colors.common.black,
    fontWeight: "700"
  },
  weekdayRow: {
    flexDirection: "row",
    marginBottom: Spacing.xs
  },
  weekdayLabel: {
    ...Typography.normal.caption,
    width: "14.2857%",
    textAlign: "center",
    color: Colors.common.gray500,
    fontWeight: "700"
  },
  dayGrid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  dayCellSlot: {
    width: "14.2857%",
    padding: 2
  },
  dayCellButton: {
    minHeight: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  dayCellButtonSelected: {
    backgroundColor: Colors.young.primary
  },
  dayCellButtonDisabled: {
    backgroundColor: Colors.common.gray50
  },
  dayCellText: {
    ...Typography.normal.bodySmall,
    color: Colors.common.gray800,
    fontWeight: "600"
  },
  dayCellTextSelected: {
    color: Colors.common.white,
    fontWeight: "700"
  },
  dayCellTextDisabled: {
    color: Colors.common.gray400
  }
});
