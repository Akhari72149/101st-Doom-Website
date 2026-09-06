"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAppAuthHeaders } from "@/lib/client-auth";
import { useRouter } from "next/navigation";

type Booking = {
  id: string;
  server_id: number;
  start_time: string;
  end_time: string;
  title: string;
  booked_for: string;
  personnel?: {
    name: string;
  };
};

type PersonnelSearchRow = {
  id: string;
  name: string;
};

type DurationHours = 1 | 2 | 4;

type ServerDayCounts = Record<number, number>;

type BookingApiResponse = {
  bookings: Booking[];
  counts: Record<string, number>;
  personnel: PersonnelSearchRow[];
  canEdit: boolean;
  error?: string;
};

export default function ServersPage() {
  const router = useRouter();

  const [activeServer, setActiveServer] = useState(1);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [serverCounts, setServerCounts] = useState<ServerDayCounts>({
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
  });

  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [selectedStartIndex, setSelectedStartIndex] = useState<number | null>(null);
  const [durationHours, setDurationHours] = useState<DurationHours>(1);

  const [personnelList, setPersonnelList] = useState<PersonnelSearchRow[]>([]);
  const [selectedPerson, setSelectedPerson] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [bookingTitle, setBookingTitle] = useState("");

  const [canBook, setCanBook] = useState(false);

  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  const [loadError, setLoadError] = useState("");

  const resultsRef = useRef<HTMLDivElement>(null);
  const fetchTokenRef = useRef(0);

  const slots = useMemo(() => generateSlots(selectedDate), [selectedDate]);

  const filteredPersonnel = useMemo(() => {
    return personnelList.filter((person) =>
      person.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [personnelList, searchQuery]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchBookingsForActiveServer = useCallback(async () => {
    const fetchToken = ++fetchTokenRef.current;
    setIsLoadingBookings(true);
    setLoadError("");

    const [start, end] = getDayBounds(selectedDate);
    const params = new URLSearchParams({
      serverId: String(activeServer),
      start: start.toISOString(),
      end: end.toISOString(),
    });
    const authHeaders = await getAppAuthHeaders();

    try {
      const response = await fetch(`/api/server-bookings?${params}`, {
        cache: "no-store",
        headers: authHeaders,
      });
      const data = (await response.json().catch(() => null)) as BookingApiResponse | null;
      if (!response.ok || !data) {
        throw new Error(data?.error || "Failed to load server bookings");
      }
      if (fetchToken !== fetchTokenRef.current) return;
      const counts: ServerDayCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      for (const [serverId, count] of Object.entries(data.counts || {})) {
        counts[Number(serverId)] = Number(count) || 0;
      }
      setBookings(data.bookings || []);
      setServerCounts(counts);
      setPersonnelList(data.personnel || []);
      setCanBook(Boolean(data.canEdit));
    } catch (error) {
      if (fetchToken !== fetchTokenRef.current) return;
      setBookings([]);
      setPersonnelList([]);
      setCanBook(false);
      setLoadError(error instanceof Error ? error.message : "Failed to load server bookings");
    } finally {
      if (fetchToken === fetchTokenRef.current) setIsLoadingBookings(false);
    }
  }, [activeServer, selectedDate]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      fetchBookingsForActiveServer();
    });
    const refreshTimer = window.setInterval(fetchBookingsForActiveServer, 10_000);

    return () => {
      window.clearInterval(refreshTimer);
    };
  }, [fetchBookingsForActiveServer]);

  function getBookingsForSlot(slot: Date) {
    return bookings.filter((b) => {
      const slotEnd = new Date(slot.getTime() + 30 * 60 * 1000);
      const bookingStart = new Date(b.start_time);
      const bookingEnd = new Date(b.end_time);
      return slot < bookingEnd && slotEnd > bookingStart;
    });
  }

  function isBlocked(slot: Date) {
    return getBookingsForSlot(slot).length > 0;
  }

  function wouldSelectionConflict(startIndex: number | null, duration: DurationHours) {
    if (startIndex === null) return false;

    const selectionStart = slots[startIndex];
    if (!selectionStart) return true;

    const selectionEnd = new Date(selectionStart.getTime() + duration * 60 * 60 * 1000);

    return bookings.some((booking) => {
      const bookingStart = new Date(booking.start_time);
      const bookingEnd = new Date(booking.end_time);

      return selectionStart < bookingEnd && selectionEnd > bookingStart;
    });
  }

  async function handleDelete(id: string) {
    if (id.startsWith("recurring-")) return;
    if (!canBook) return;

    const old = bookings;
    setBookings((prev) => prev.filter((b) => b.id !== id));
    const authHeaders = await getAppAuthHeaders();
    const response = await fetch(`/api/server-bookings?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setBookings(old);
      alert(result?.error || "Failed to cancel booking");
      return;
    }

    await fetchBookingsForActiveServer();
  }

  async function handleConfirmBooking() {
    if (!canBook || !selectedPerson) return;

    if (selectedStartIndex === null) {
      alert("Please select a time slot first.");
      return;
    }

    if (wouldSelectionConflict(selectedStartIndex, durationHours)) {
      alert("That booking overlaps an existing booking or block.");
      return;
    }

    const start = slots[selectedStartIndex];
    const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);

    const authHeaders = await getAppAuthHeaders();
    const response = await fetch("/api/server-bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({
        serverId: activeServer,
        bookedFor: selectedPerson,
        title: bookingTitle.trim() || "Server Booking",
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      }),
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      alert(result?.error || "Failed to create booking");
      return;
    }

    clearBookingDraft();
    await fetchBookingsForActiveServer();
  }

  function clearBookingDraft() {
    setSelectedStartIndex(null);
    setSelectedPerson("");
    setSearchQuery("");
    setBookingTitle("");
    setShowResults(false);
    setDurationHours(1);
  }

  function handleSlotClick(index: number, blocked: boolean) {
    if (blocked) return;

    if (!canBook) {
      alert("Your account has view-only access to server bookings.");
      return;
    }

    setSelectedStartIndex(index);
  }

  function shiftDate(days: number) {
    const [year, month, day] = selectedDate.split("-").map(Number);
    const next = new Date(year, month - 1, day + days);
    setSelectedDate(toLocalDateInputValue(next));
    clearBookingDraft();
  }

  const selectedBookingStart =
    selectedStartIndex !== null ? slots[selectedStartIndex] : null;

  const selectedBookingEnd =
    selectedBookingStart !== null
      ? new Date(selectedBookingStart.getTime() + durationHours * 60 * 60 * 1000)
      : null;

  const hasSelectionConflict = wouldSelectionConflict(selectedStartIndex, durationHours);

  const directBookings = bookings.filter((b) => !b.id.startsWith("recurring-"));
  const recurringBlocks = bookings.filter((b) => b.id.startsWith("recurring-"));

  const totalBookedHours = directBookings.reduce((sum, booking) => {
    const start = new Date(booking.start_time).getTime();
    const end = new Date(booking.end_time).getTime();
    return sum + (end - start) / (1000 * 60 * 60);
  }, 0);

  const blockedSlotCount = slots.filter((slot) => isBlocked(slot)).length;
  const freeSlotCount = slots.length - blockedSlotCount;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_center,#001f11_0%,#000a06_100%)] px-3 py-5 text-white sm:px-6 sm:py-8 lg:px-10">
      <div className="mx-auto max-w-[1800px]">
        <button
          onClick={() => router.push("/pcs")}
          className="mb-6 rounded-xl border border-[#00ff66]/50 px-4 py-2 font-semibold text-[#00ff66] transition hover:scale-105 hover:bg-[#00ff66]/10"
        >
          ← Return to Dashboard
        </button>

        <div className="mb-6 sm:mb-8">
          <div className="text-xs uppercase tracking-[0.4em] text-[#7da28c]">
            Server Operations
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-[0.16em] text-[#00ff66] sm:text-4xl sm:tracking-[0.3em]">
              SERVER BOOKINGS
            </h1>

            <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
              canBook
                ? "border-[#00ff66]/40 bg-[#00ff66]/10 text-[#00ff66]"
                : "border-white/15 bg-white/[0.03] text-gray-400"
            }`}>
              {canBook ? "Booking Access" : "View Only"}
            </span>
          </div>
          {loadError && <p className="mt-3 text-sm text-red-300">{loadError}</p>}
        </div>

        <div className="mb-6 rounded-2xl border border-[#00ff66]/20 bg-black/55 p-3 backdrop-blur-xl shadow-[0_0_35px_rgba(0,255,100,0.08)] sm:sticky sm:top-4 sm:z-30 sm:mb-8 sm:rounded-3xl sm:p-4">
          <div className="grid grid-cols-1 gap-6">
            <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2 sm:flex sm:flex-wrap sm:items-end sm:gap-3">
              <div className="col-span-3 sm:col-span-1">
                <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-[#7fa08e]">
                  Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    clearBookingDraft();
                  }}
                  className="w-full rounded-xl border border-[#00ff66]/30 bg-black/40 px-3 py-3 text-[#00ff66] outline-none transition focus:border-[#00ff66] sm:w-auto sm:rounded-2xl sm:px-4"
                />
              </div>

              <button
                onClick={() => shiftDate(-1)}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-2 py-3 text-sm font-semibold text-white transition hover:border-white/20 sm:rounded-2xl sm:px-4"
              >
                ← Previous
              </button>

              <button
                onClick={() => {
                  setSelectedDate(getLocalDateString());
                  clearBookingDraft();
                }}
                className="rounded-xl border border-[#00ff66]/25 bg-[#00ff66]/6 px-2 py-3 text-sm font-semibold text-[#00ff66] transition hover:bg-[#00ff66]/12 sm:rounded-2xl sm:px-4"
              >
                Today
              </button>

              <button
                onClick={() => shiftDate(1)}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-2 py-3 text-sm font-semibold text-white transition hover:border-white/20 sm:rounded-2xl sm:px-4"
              >
                Next →
              </button>
            </div>

            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-[#7fa08e]">
                Server Selection
              </label>
              <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-6">
                {[1, 2, 3, 4, 5, 6].map((server) => {
                  const count = serverCounts[server] || 0;
                  const hasBookings = count > 0;

                  return (
                    <button
                      key={server}
                      onClick={() => {
                        setActiveServer(server);
                        clearBookingDraft();
                      }}
                      className={`rounded-xl border p-3 text-left transition-all duration-200 sm:rounded-2xl sm:p-4 ${
                        activeServer === server
                          ? "scale-[1.02] border-[#00ff66] bg-[#00ff66]/12 shadow-[0_0_20px_rgba(0,255,100,0.2)]"
                          : "border-[#00ff66]/20 bg-black/35 hover:border-[#00ff66]/45 hover:bg-[#00ff66]/6"
                      }`}
                    >
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[#7f9f8f]">
                        Server
                      </div>
                      <div className="mt-1 text-lg font-bold text-[#00ff66]">
                        {server}
                      </div>
                      <div className="mt-1 text-[11px] text-[#cbead6] sm:mt-2 sm:text-xs">
                        {count} item{count !== 1 ? "s" : ""}
                      </div>
                      <div
                        className={`mt-2 hidden rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] sm:inline-flex ${
                          hasBookings
                            ? "bg-amber-500/10 text-amber-300"
                            : "bg-[#00ff66]/10 text-[#00ff66]"
                        }`}
                      >
                        {hasBookings ? "Busy" : "Available"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-[#7fa08e]">
                Legend
              </label>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <LegendChip label="Available" className="border-white/10 bg-white/[0.03] text-white" />
                <LegendChip label="Selected" className="border-[#00ff66]/40 bg-[#00ff66]/12 text-[#00ff66]" />
                <LegendChip label="Booked" className="border-[#00ff66]/30 bg-[#002714] text-[#9cffc8]" />
                <LegendChip label="System Block" className="border-amber-400/35 bg-amber-400/10 text-amber-300" />
                <LegendChip label="Conflict" className="border-red-400/35 bg-red-500/10 text-red-300" />
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2 sm:mb-8 sm:gap-4 lg:grid-cols-4">
          <SummaryCard label="Bookings" value={String(directBookings.length)} accent />
          <SummaryCard label="System Blocks" value={String(recurringBlocks.length)} />
          <SummaryCard label="Booked Hours" value={totalBookedHours.toFixed(1)} />
          <SummaryCard label="Free Half-Hours" value={String(freeSlotCount)} />
        </div>

        <div className="grid grid-cols-1 gap-6 sm:gap-8 2xl:grid-cols-[minmax(0,1fr)_400px]">
          <section className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-[#7f9f8f]">
                  Active Server
                </div>
                <div className="mt-1 text-2xl font-bold text-[#00ff66]">
                  Server {activeServer}
                </div>
              </div>

              {isLoadingBookings && (
                <div className="rounded-full border border-[#00ff66]/25 bg-[#00ff66]/6 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#00ff66]">
                  Refreshing
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[#00ff66]/25 bg-black/35 p-2 shadow-[0_0_30px_rgba(0,255,100,0.06)] sm:rounded-3xl sm:p-4">
              <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
                {slots.map((slot, index) => {
                  const slotBookings = getBookingsForSlot(slot);
                  const blocked = slotBookings.length > 0;
                  const durationSlots = durationHours * 2;

                  const inSelectedRange =
                    selectedStartIndex !== null &&
                    index >= selectedStartIndex &&
                    index < selectedStartIndex + durationSlots;

                  const isConflictPreview = inSelectedRange && blocked;
                  const isSelected = inSelectedRange && !blocked;

                  let slotClass =
                    "border-[#00ff66]/15 bg-black/30 hover:border-[#00ff66]/40 hover:bg-[#00ff66]/5";

                  if (isConflictPreview) {
                    slotClass = "border-red-400/45 bg-red-500/10";
                  } else if (isSelected) {
                    slotClass =
                      "scale-[1.02] border-[#00ff66] bg-[#003d14] shadow-[0_0_20px_rgba(0,255,100,0.2)]";
                  } else if (blocked) {
                    slotClass = "border-[#00ff66]/25 bg-black/45";
                  }

                  return (
                    <div
                      key={slot.toISOString()}
                      onClick={() => handleSlotClick(index, blocked)}
                      role="button"
                      tabIndex={blocked ? -1 : 0}
                      aria-disabled={blocked}
                      onKeyDown={(event) => {
                        if (!blocked && (event.key === "Enter" || event.key === " ")) {
                          event.preventDefault();
                          handleSlotClick(index, false);
                        }
                      }}
                      className={`min-h-[112px] rounded-xl border p-3 transition-all duration-200 sm:min-h-[185px] sm:rounded-2xl sm:p-4 ${slotClass}`}
                    >
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div className="text-base font-bold text-[#00ff66] sm:text-lg">
                          {slot.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>

                        <div className="hidden rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-gray-400 sm:block">
                          {Math.floor(index / 2)
                            .toString()
                            .padStart(2, "0")}
                          :{index % 2 === 0 ? "00" : "30"}
                        </div>
                      </div>

                      <div className="space-y-2">
                        {slotBookings.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-2 py-2 text-xs text-gray-500 sm:rounded-xl sm:px-3 sm:py-3 sm:text-sm">
                            Available
                          </div>
                        ) : (
                          slotBookings.map((b) => {
                            const recurring = b.id.startsWith("recurring-");

                            return (
                              <div
                                key={b.id}
                                className={`rounded-xl border px-3 py-3 ${
                                  recurring
                                    ? "border-amber-400/30 bg-amber-400/10"
                                    : "border-[#00ff66]/30 bg-[#001108]/80"
                                }`}
                              >
                                <div className="mb-2 flex items-start justify-between gap-2">
                                  <div
                                    className={`min-w-0 text-sm font-semibold ${
                                      recurring ? "text-amber-300" : "text-[#00ff66]"
                                    }`}
                                  >
                                    <div className="truncate">{b.personnel?.name}</div>
                                  </div>

                                  <span
                                    className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                                      recurring
                                        ? "bg-amber-400/10 text-amber-300"
                                        : "bg-[#00ff66]/10 text-[#00ff66]"
                                    }`}
                                  >
                                    {recurring ? "System Block" : "Booking"}
                                  </span>
                                </div>

                                <div className="break-words text-sm text-gray-200">
                                  {b.title}
                                </div>

                                <div className="mt-2 text-[11px] uppercase tracking-[0.14em] text-gray-400">
                                  {formatTimeRange(b.start_time, b.end_time)}
                                </div>

                                {canBook && !recurring && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(b.id);
                                    }}
                                    className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-red-400 transition hover:text-red-300"
                                  >
                                    Cancel Booking
                                  </button>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <aside className="min-w-0 2xl:sticky 2xl:top-[360px] 2xl:self-start">
            <div className="rounded-2xl border border-[#00ff66]/25 bg-black/55 p-4 backdrop-blur-xl shadow-[0_0_35px_rgba(0,255,100,0.08)] sm:rounded-3xl sm:p-6">
              <div className="mb-5">
                <div className="text-xs uppercase tracking-[0.25em] text-[#7f9f8f]">
                  Booking Console
                </div>
                <h2 className="mt-2 text-2xl font-bold text-[#00ff66]">
                  {selectedStartIndex !== null ? "Create Booking" : "Select a Slot"}
                </h2>
              </div>

              {selectedStartIndex !== null ? (
                <>
                  <div className="mb-5 rounded-2xl border border-[#00ff66]/20 bg-black/35 p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[#7f9f8f]">
                      Booking Window
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      Server {activeServer}
                    </div>
                    <div className="mt-1 text-sm text-gray-300">
                      {formatFriendlyDate(selectedDate)}
                    </div>
                    <div className="mt-3 text-sm font-semibold text-[#00ff66]">
                      {selectedBookingStart && selectedBookingEnd
                        ? `${selectedBookingStart.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })} → ${selectedBookingEnd.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`
                        : "No range selected"}
                    </div>

                    {hasSelectionConflict && (
                      <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                        This duration overlaps an existing booking or block.
                      </div>
                    )}
                  </div>

                  <div ref={resultsRef} className="relative mb-4">
                    <label className="mb-2 block text-sm text-[#00ff66]">
                      Eligible Personnel
                    </label>
                    <input
                      placeholder="Search personnel..."
                      value={searchQuery}
                      onFocus={() => setShowResults(true)}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setShowResults(true);
                      }}
                      className="w-full rounded-xl border border-[#00ff66]/30 bg-black px-4 py-3 text-white outline-none transition focus:border-[#00ff66]"
                    />

                    {showResults && searchQuery && (
                      <div className="absolute z-50 mt-2 max-h-60 w-full overflow-y-auto rounded-xl border border-[#00ff66]/30 bg-black/95 shadow-[0_0_20px_rgba(0,255,100,0.1)]">
                        {filteredPersonnel.length === 0 ? (
                          <div className="p-3 text-sm text-gray-400">
                            No matching personnel.
                          </div>
                        ) : (
                          filteredPersonnel.map((person) => (
                            <button
                              key={person.id}
                              onClick={() => {
                                setSelectedPerson(person.id);
                                setSearchQuery(person.name);
                                setShowResults(false);
                              }}
                              className="w-full px-3 py-3 text-left text-sm transition hover:bg-[#00ff66] hover:text-black"
                            >
                              {person.name}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {selectedPerson && (
                    <div className="mb-4 rounded-xl border border-[#00ff66]/20 bg-[#00ff66]/5 px-3 py-2 text-sm text-[#bfffdc]">
                      Selected: {searchQuery}
                    </div>
                  )}

                  <div className="mb-4">
                    <label className="mb-2 block text-sm text-[#00ff66]">
                      Duration
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {([1, 2, 4] as DurationHours[]).map((hours) => (
                        <button
                          key={hours}
                          onClick={() => setDurationHours(hours)}
                          className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                            durationHours === hours
                              ? "border-[#00ff66]/45 bg-[#00ff66]/12 text-[#00ff66]"
                              : "border-white/10 bg-white/[0.03] text-white hover:border-[#00ff66]/25"
                          }`}
                        >
                          {hours}H
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="mb-2 block text-sm text-[#00ff66]">
                      Booking Title
                    </label>
                    <input
                      placeholder="Training, Operation Prep, Testing..."
                      value={bookingTitle}
                      onChange={(e) => setBookingTitle(e.target.value)}
                      className="w-full rounded-xl border border-[#00ff66]/30 bg-black px-4 py-3 text-white outline-none transition focus:border-[#00ff66]"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      onClick={handleConfirmBooking}
                      disabled={!selectedPerson || hasSelectionConflict}
                      className="w-full rounded-xl bg-[#00ff66] px-4 py-3 font-semibold text-black transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Confirm Booking
                    </button>

                    <button
                      onClick={clearBookingDraft}
                      className="w-full rounded-xl border border-red-500 px-4 py-3 font-semibold text-red-400 transition hover:bg-red-500 hover:text-black"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm leading-7 text-gray-400">
                  Select an available half-hour slot from the grid to begin a booking.
                  Once selected, the booking range, eligible personnel search, and
                  duration controls will appear here.
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function LegendChip({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <span
      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${className}`}
    >
      {label}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#00ff66]/20 bg-black/35 p-3 sm:rounded-2xl sm:p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[#7f9f8f]">
        {label}
      </div>
      <div className={`mt-2 text-xl font-bold sm:text-2xl ${accent ? "text-[#00ff66]" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}

function getLocalDateString() {
  const today = new Date();
  return toLocalDateInputValue(today);
}

function toLocalDateInputValue(date: Date) {
  return (
    date.getFullYear() +
    "-" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getDate()).padStart(2, "0")
  );
}

function getDayBounds(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  const start = new Date(year, month - 1, day, 0, 0, 0);
  const end = new Date(year, month - 1, day + 1, 0, 0, 0);
  return [start, end] as const;
}

function generateSlots(dateString: string) {
  const slots: Date[] = [];
  const [year, month, day] = dateString.split("-").map(Number);
  const base = new Date(year, month - 1, day, 0, 0, 0);

  for (let i = 0; i < 48; i++) {
    slots.push(new Date(base.getTime() + i * 30 * 60 * 1000));
  }

  return slots;
}

function formatTimeRange(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);

  return `${startDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })} → ${endDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function formatFriendlyDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString([], {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
