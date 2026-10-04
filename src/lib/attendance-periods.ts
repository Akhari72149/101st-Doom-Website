export const attendanceMonths: string[] = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const attendanceWeeks = [1, 2, 3, 4, 5] as const;

export type AttendanceCycle = {
  week: number;
  startDate: string;
  endDate: string;
  startLabel: string;
  endLabel: string;
  compactLabel: string;
  fullLabel: string;
};

function localIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shortDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date);
}

export function attendanceCyclesForMonth(month: string, year = new Date().getFullYear()): AttendanceCycle[] {
  const monthIndex = attendanceMonths.indexOf(month);
  if (monthIndex < 0) return [];

  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cycles: AttendanceCycle[] = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const cycleEnd = new Date(year, monthIndex, day, 12);
    if (cycleEnd.getDay() !== 6) continue;

    const cycleStart = new Date(cycleEnd);
    cycleStart.setDate(cycleEnd.getDate() - 6);
    const startLabel = shortDate(cycleStart);
    const endLabel = shortDate(cycleEnd);

    cycles.push({
      week: Math.ceil(day / 7),
      startDate: localIsoDate(cycleStart),
      endDate: localIsoDate(cycleEnd),
      startLabel,
      endLabel,
      compactLabel: `${startLabel} - ${endLabel}`,
      fullLabel: `Sun ${startLabel} - Sat ${endLabel}`,
    });
  }

  return cycles;
}

export function attendanceYears(currentYear = new Date().getFullYear()) {
  const firstYear = 2026;
  return Array.from({ length: Math.max(1, currentYear - firstYear + 1) }, (_, index) => currentYear - index);
}

export function currentAttendancePeriod(today = new Date()) {
  const cycleEnd = new Date(today);
  const daysUntilSaturday = today.getDay() === 6 ? 0 : (6 - today.getDay() + 7) % 7;
  cycleEnd.setDate(today.getDate() + daysUntilSaturday);
  return {
    year: cycleEnd.getFullYear(),
    month: attendanceMonths[cycleEnd.getMonth()],
    week: Math.ceil(cycleEnd.getDate() / 7),
    cycleEndDate: localIsoDate(cycleEnd),
  };
}

export function attendanceCycleEndDate(month: string, week: number, year = new Date().getFullYear()) {
  return attendanceCyclesForMonth(month, year).find((item) => item.week === week)?.endDate || null;
}

export function attendanceWeekRangeLabel(week: number) {
  if (week === 5) return "Days 29-end";
  const startDay = (week - 1) * 7 + 1;
  return `Days ${startDay}-${week * 7}`;
}

export function attendancePeriodLabel(month: string, week: number, year = new Date().getFullYear()) {
  const cycle = attendanceCyclesForMonth(month, year).find((item) => item.week === week);
  if (cycle) return cycle.fullLabel;
  if (week === 5) return `Days 29-end of ${month}`;
  return `${attendanceWeekRangeLabel(week)} ${month}`;
}
