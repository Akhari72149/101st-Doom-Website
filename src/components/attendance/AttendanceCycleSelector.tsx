"use client";

import { CalendarRange, LocateFixed } from "lucide-react";
import { attendanceCyclesForMonth, attendanceMonths, attendanceYears, currentAttendancePeriod } from "@/lib/attendance-periods";

type AttendanceCycleSelectorProps = {
  month: string;
  week: number;
  year: number;
  onMonthChange: (month: string) => void;
  onWeekChange: (week: number) => void;
  onYearChange: (year: number) => void;
};

export default function AttendanceCycleSelector({
  month,
  week,
  year,
  onMonthChange,
  onWeekChange,
  onYearChange,
}: AttendanceCycleSelectorProps) {
  const cycles = attendanceCyclesForMonth(month, year);
  const current = currentAttendancePeriod();
  const isCurrent = current.year === year && current.month === month && current.week === week;

  function changeMonth(nextMonth: string) {
    const nextCycles = attendanceCyclesForMonth(nextMonth, year);
    onMonthChange(nextMonth);
    onWeekChange(nextCycles[0]?.week ?? 1);
  }

  function changeYear(nextYear: number) {
    const nextCycles = attendanceCyclesForMonth(month, nextYear);
    onYearChange(nextYear);
    onWeekChange(nextCycles[0]?.week ?? 1);
  }

  function selectCurrentCycle() {
    onYearChange(current.year);
    onMonthChange(current.month);
    onWeekChange(current.week);
  }

  return (
    <fieldset className="border border-[#00ff66]/20 bg-[#031009]/70 p-4">
      <legend className="sr-only">Attendance cycle</legend>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
        <CalendarRange className="mt-0.5 h-5 w-5 shrink-0 text-[#00ff66]" />
        <div>
          <div className="text-xs font-black uppercase tracking-[0.14em] text-white">Attendance cycle</div>
          <p className="mt-1 text-xs leading-5 text-[#7f9f8f]">
            Each cycle runs Sunday to Saturday. Select the month containing its closing Saturday.
          </p>
        </div>
        </div>
        <button type="button" onClick={selectCurrentCycle} className={`inline-flex h-9 shrink-0 items-center justify-center gap-2 border px-3 text-[10px] font-bold uppercase tracking-[0.12em] transition ${isCurrent ? "border-[#00ff66] bg-[#00ff66]/15 text-[#00ff66]" : "border-[#00ff66]/25 text-[#8eae99] hover:border-[#00ff66]/50 hover:text-white"}`}>
          <LocateFixed className="h-3.5 w-3.5" />
          {isCurrent ? "Current cycle" : "Jump to current"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="grid grid-cols-[1fr_100px]">
          <label className="block">
          <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-[#7f9f8f]">Closing month</span>
          <select
            value={month}
            onChange={(event) => changeMonth(event.target.value)}
            className="h-12 w-full border border-[#00ff66]/25 bg-[#06100a] px-3 text-sm text-white outline-none focus:border-[#00ff66]/70"
          >
            {attendanceMonths.map((item) => <option key={item}>{item}</option>)}
          </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-[#7f9f8f]">Year</span>
            <select value={year} onChange={(event) => changeYear(Number(event.target.value))} className="h-12 w-full border border-l-0 border-[#00ff66]/25 bg-[#06100a] px-2 text-sm text-white outline-none focus:border-[#00ff66]/70">
              {attendanceYears().map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>

        <div>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7f9f8f]">Cycle ending Saturday</div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-5">
            {cycles.map((cycle) => {
              const selected = cycle.week === week;
              const currentCycle = current.year === year && current.month === month && current.week === cycle.week;
              return (
                <button
                  key={cycle.week}
                  type="button"
                  onClick={() => onWeekChange(cycle.week)}
                  aria-pressed={selected}
                  className={`min-h-12 border px-3 py-2 text-left transition ${selected ? "border-[#00ff66] bg-[#00ff66]/15 text-white" : "border-[#00ff66]/20 bg-black/25 text-[#8eae99] hover:border-[#00ff66]/50 hover:text-white"}`}
                >
                  <span className={`block text-[9px] font-bold uppercase tracking-[0.14em] ${selected ? "text-[#00ff66]" : "text-[#63806e]"}`}>{currentCycle ? "Current · ends Saturday" : "Ends Saturday"}</span>
                  <span className="mt-1 block text-xs font-bold">{cycle.compactLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </fieldset>
  );
}
