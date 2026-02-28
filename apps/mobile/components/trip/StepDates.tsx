import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../constants/Theme';
import BottomSheet from '../common/BottomSheet';

interface Props {
  startDate?: string;
  endDate?: string;
  onChangeStartDate: (d: string) => void;
  onChangeEndDate: (d: string) => void;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function parseD(t?: string): Date | null {
  if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(`${t}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatLabel(t?: string) {
  const d = parseD(t); if (!d) return '';
  return `${d.getMonth()+1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

function getTripLen(s?: string, e?: string) {
  const sd = parseD(s), ed = parseD(e);
  if (!sd || !ed) return null;
  const n = Math.floor((ed.getTime() - sd.getTime()) / 86400000);
  return n >= 0 ? { nights: n, days: n + 1 } : null;
}

function CalendarPicker({ value, onChange, minDate, label }: {
  value?: string; onChange: (d: string) => void; minDate?: string; label: string;
}) {
  const [open, setOpen] = useState(false);
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const selDate = useMemo(() => parseD(value), [value]);
  const optStart = useMemo(() => {
    const m = parseD(minDate);
    return m && m.getTime() > today.getTime() ? m : today;
  }, [minDate, today]);
  const optEnd = useMemo(() => {
    const d = new Date(optStart);
    d.setDate(d.getDate() + 119);
    return d;
  }, [optStart]);
  const [month, setMonth] = useState<Date>(() => {
    if (selDate && selDate >= optStart && selDate <= optEnd) return new Date(selDate.getFullYear(), selDate.getMonth(), 1);
    return new Date(optStart.getFullYear(), optStart.getMonth(), 1);
  });

  const cells = useMemo(() => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const firstDay = start.getDay();
    const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    const arr: (Date | null)[] = [];
    for (let i = 0; i < 42; i++) {
      const day = i - firstDay + 1;
      arr.push(day >= 1 && day <= daysInMonth ? new Date(start.getFullYear(), start.getMonth(), day) : null);
    }
    return arr;
  }, [month]);

  const canPrev = new Date(month.getFullYear(), month.getMonth(), 0) >= optStart;
  const canNext = new Date(month.getFullYear(), month.getMonth() + 1, 1) <= optEnd;
  const selIso = selDate ? toIso(selDate) : '';

  return (
    <>
      <TouchableOpacity style={styles.dateField} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Ionicons name="calendar-outline" size={20} color={Theme.colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.dateFieldLabel}>{label}</Text>
          <Text style={[styles.dateFieldValue, !formatLabel(value) && styles.dateFieldPlaceholder]}>
            {formatLabel(value) || '날짜를 선택해주세요'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Theme.colors.textTertiary} />
      </TouchableOpacity>

      <BottomSheet visible={open} onClose={() => setOpen(false)} title={label}>
        <View style={styles.cal}>
          <View style={styles.calHeader}>
            <Pressable
              style={[styles.calArrow, !canPrev && styles.calArrowDisabled]}
              onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              disabled={!canPrev}
            >
              <Ionicons name="chevron-back" size={18} color={canPrev ? Theme.colors.textPrimary : Theme.colors.textTertiary} />
            </Pressable>
            <Text style={styles.calMonth}>{month.getFullYear()}년 {month.getMonth() + 1}월</Text>
            <Pressable
              style={[styles.calArrow, !canNext && styles.calArrowDisabled]}
              onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              disabled={!canNext}
            >
              <Ionicons name="chevron-forward" size={18} color={canNext ? Theme.colors.textPrimary : Theme.colors.textTertiary} />
            </Pressable>
          </View>
          <View style={styles.calWeekdays}>
            {WEEKDAYS.map((w) => (
              <Text key={w} style={[styles.calWeekday, w === '일' && { color: Theme.colors.error }, w === '토' && { color: Theme.colors.primary }]}>{w}</Text>
            ))}
          </View>
          <View style={styles.calGrid}>
            {cells.map((cell, i) => {
              if (!cell) return <View key={`e-${i}`} style={styles.calCell} />;
              const iso = toIso(cell);
              const isSel = iso === selIso;
              const disabled = cell < optStart || cell > optEnd;
              return (
                <View key={iso} style={styles.calCell}>
                  <Pressable
                    style={[styles.calDay, isSel && styles.calDaySel, disabled && styles.calDayDisabled]}
                    onPress={() => { setOpen(false); onChange(iso); }}
                    disabled={disabled}
                  >
                    <Text style={[
                      styles.calDayText,
                      isSel && styles.calDayTextSel,
                      disabled && styles.calDayTextDisabled,
                      cell.getDay() === 0 && !isSel && !disabled && { color: Theme.colors.error },
                      cell.getDay() === 6 && !isSel && !disabled && { color: Theme.colors.primary },
                    ]}>
                      {cell.getDate()}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      </BottomSheet>
    </>
  );
}

export default function StepDates({ startDate, endDate, onChangeStartDate, onChangeEndDate }: Props) {
  const len = getTripLen(startDate, endDate);

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="calendar" size={32} color={Theme.colors.primary} />
        </View>
        <Text style={styles.title}>언제 떠나시나요?</Text>
        <Text style={styles.subtitle}>출발일과 도착일을 선택해주세요</Text>
      </View>

      <CalendarPicker label="출발일" value={startDate} onChange={onChangeStartDate} />
      <CalendarPicker label="도착일" value={endDate} onChange={onChangeEndDate} minDate={startDate} />

      {len && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryLeft}>
            <Ionicons name="moon-outline" size={20} color={Theme.colors.primary} />
            <Text style={styles.summaryLabel}>여행 기간</Text>
          </View>
          <Text style={styles.summaryValue}>{len.nights}박 {len.days}일</Text>
        </View>
      )}

      {startDate && endDate && !len && (
        <View style={styles.warningBox}>
          <Ionicons name="warning-outline" size={16} color={Theme.colors.error} />
          <Text style={styles.warningText}>도착일은 출발일 이후여야 해요</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Theme.spacing.xl },
  hero: { alignItems: 'center', marginBottom: Theme.spacing.xxl },
  heroIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Theme.colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Theme.spacing.md,
  },
  title: { ...Theme.typography.h2, color: Theme.colors.textPrimary },
  subtitle: { ...Theme.typography.body2, color: Theme.colors.textSecondary, marginTop: 4 },
  dateField: {
    flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.md,
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.lg,
    borderWidth: 2, borderColor: Theme.colors.border,
    padding: Theme.spacing.lg, marginBottom: Theme.spacing.md,
    ...Theme.shadow.sm,
  },
  dateFieldLabel: { ...Theme.typography.caption, color: Theme.colors.textSecondary },
  dateFieldValue: { ...Theme.typography.body1, fontWeight: '600', color: Theme.colors.textPrimary, marginTop: 2 },
  dateFieldPlaceholder: { color: Theme.colors.textTertiary, fontWeight: '400' },
  summaryCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Theme.colors.primaryLight,
    borderRadius: Theme.radius.lg, padding: Theme.spacing.xl, marginTop: Theme.spacing.md,
  },
  summaryLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryLabel: { ...Theme.typography.body1, color: Theme.colors.textPrimary },
  summaryValue: { ...Theme.typography.h3, color: Theme.colors.primary },
  warningBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Theme.colors.secondaryLight, borderRadius: Theme.radius.md,
    padding: Theme.spacing.md, marginTop: Theme.spacing.md,
  },
  warningText: { ...Theme.typography.body2, color: Theme.colors.error },
  cal: {
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.lg,
    padding: Theme.spacing.md,
  },
  calHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Theme.spacing.lg,
  },
  calArrow: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Theme.colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  calArrowDisabled: { opacity: 0.4 },
  calMonth: { ...Theme.typography.body1, fontWeight: '700', color: Theme.colors.textPrimary },
  calWeekdays: { flexDirection: 'row', marginBottom: Theme.spacing.xs },
  calWeekday: {
    width: '14.2857%', textAlign: 'center',
    ...Theme.typography.caption, fontWeight: '700', color: Theme.colors.textTertiary,
  },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: '14.2857%', padding: 2 },
  calDay: {
    minHeight: 44, borderRadius: Theme.radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  calDaySel: { backgroundColor: Theme.colors.primary },
  calDayDisabled: { backgroundColor: Theme.colors.background },
  calDayText: { ...Theme.typography.body2, fontWeight: '600', color: Theme.colors.textPrimary },
  calDayTextSel: { color: '#FFF', fontWeight: '700' },
  calDayTextDisabled: { color: Theme.colors.textTertiary },
});
