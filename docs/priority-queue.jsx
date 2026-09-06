import { useState, useMemo } from "react";

// ---------- sample data (transcribed from the current board) ----------
const RAW = {
  1: [
    { time: "2:30 PM", door: 720, lane: "CTII" },
    { time: "5:00 PM", door: 709, lane: "5261" },
    { time: "5:00 PM", door: 717, lane: "5959" },
    { time: "6:00 PM", door: 710, lane: "5255" },
    { time: "8:00 PM", door: 716, lane: "5887" },
    { time: "10:00 PM", door: 705, lane: "5088" },
    { time: "10:00 PM", door: 705, lane: "5088" },
    { time: "10:00 PM", door: 714, lane: "5835" },
  ],
  2: [
    { time: "2:30 PM", door: 722, lane: "EXLA" },
    { time: "8:00 PM", door: 723, lane: "5944" },
    { time: "10:00 PM", door: 724, lane: "5639" },
    { time: "10:00 PM", door: 725, lane: "S707" },
    { time: "10:00 PM", door: 725, lane: "S707" },
    { time: "10:00 PM", door: 735, lane: "5084" },
    { time: "10:00 PM", door: 735, lane: "5084" },
    { time: "10:00 PM", door: 738, lane: "S823" },
  ],
  3: [
    { time: "12:30 PM", door: 747, lane: "FEDEX" },
    { time: "3:00 PM", door: 747, lane: "FEDEX" },
    { time: "3:00 PM", door: 748, lane: "UPS" },
    { time: "4:30 PM", door: 746, lane: "FEDEX" },
    { time: "4:30 PM", door: 748, lane: "UPS" },
    { time: "10:00 PM", door: 750, lane: "5243" },
    { time: "11:00 PM", door: 749, lane: "5885" },
    { time: "11:00 PM", door: 749, lane: "5885" },
  ],
};

const ZONE_COLOR = { 1: "#4F8FE8", 2: "#B07CE0", 3: "#2FC7B0" };
const ZONE_LABEL = { 1: "Zone 1", 2: "Zone 2", 3: "Zone 3" };

function toMinutes(t) {
  const [time, period] = t.split(" ");
  let [h, m] = time.split(":").map(Number);
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return h * 60 + m;
}

const DEMO_NOW = toMinutes("1:15 PM"); // fixed reference so the mockup reads consistently

function statusOf(mins) {
  if (mins < DEMO_NOW - 15) return "DEPARTED";
  if (mins <= DEMO_NOW + 30) return "LOADING";
  return "OPEN";
}

function countdown(mins) {
  const diff = mins - DEMO_NOW;
  if (diff < -15) return "departed";
  if (diff < 0) return "now";
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return h > 0 ? `in ${h}h ${m}m` : `in ${m}m`;
}

const ALL = Object.entries(RAW).flatMap(([zone, rows]) =>
  rows.map((r) => ({ ...r, zone: Number(zone), mins: toMinutes(r.time) }))
);

const STATUS_COLOR = {
  OPEN: "#3ECF8E",
  LOADING: "#FFB020",
  DEPARTED: "#5B6473",
};

export default function PriorityQueue() {
  const [filter, setFilter] = useState("ALL");

  const sorted = useMemo(() => [...ALL].sort((a, b) => a.mins - b.mins), []);
  const upcoming = sorted.filter((r) => statusOf(r.mins) !== "DEPARTED");
  const nextUp = upcoming[0];
  const list = sorted.filter((r) => filter === "ALL" || r.zone === filter);

  return (
    <div style={{ background: "#F3F4F6", fontFamily: "'Manrope', sans-serif" }} className="min-h-screen p-4 sm:p-8">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@500;700;800&display=swap');`}</style>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-baseline justify-between mb-4">
          <h1 style={{ color: "#1A1D23" }} className="text-lg font-extrabold">
            Load Priority Queue
          </h1>
          <span style={{ color: "#9CA3AF" }} className="text-xs font-medium">
            07/14/2026 &middot; now 1:15 PM
          </span>
        </div>

        <div style={{ background: "#FFFFFF" }} className="rounded-2xl p-5 shadow-sm">
          {nextUp && (
            <div
              className="rounded-2xl p-5 mb-6 flex items-center justify-between"
              style={{
                background: `linear-gradient(135deg, ${ZONE_COLOR[nextUp.zone]}18, ${ZONE_COLOR[nextUp.zone]}05)`,
                border: `1px solid ${ZONE_COLOR[nextUp.zone]}40`,
              }}
            >
              <div>
                <div style={{ color: ZONE_COLOR[nextUp.zone] }} className="text-xs font-bold uppercase tracking-wider mb-1">
                  Next Up &middot; {ZONE_LABEL[nextUp.zone]}
                </div>
                <div style={{ color: "#1A1D23" }} className="text-3xl font-extrabold">
                  Door {nextUp.door}
                </div>
                <div style={{ color: "#6B7280" }} className="text-sm font-medium">
                  ({nextUp.lane}) &nbsp;&bull;&nbsp; cuts {nextUp.time}
                </div>
              </div>
              <div className="text-right">
                <div style={{ color: ZONE_COLOR[nextUp.zone] }} className="text-2xl font-extrabold">
                  {countdown(nextUp.mins)}
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 mb-4">
            {["ALL", 1, 2, 3].map((z) => (
              <button
                key={z}
                onClick={() => setFilter(z)}
                style={{
                  background: filter === z ? "#1A1D23" : "#F3F4F6",
                  color: filter === z ? "#FFFFFF" : "#4B5563",
                }}
                className="text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wide"
              >
                {z === "ALL" ? "All Zones" : ZONE_LABEL[z]}
              </button>
            ))}
          </div>

          <div className="divide-y" style={{ borderColor: "#F3F4F6" }}>
            {list.map((r, i) => {
              const status = statusOf(r.mins);
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 py-3 pl-3"
                  style={{ borderLeft: `3px solid ${ZONE_COLOR[r.zone]}` }}
                >
                  <div style={{ minWidth: 70 }}>
                    <div style={{ color: "#1A1D23" }} className="text-sm font-bold">
                      {r.time}
                    </div>
                  </div>
                  <div className="flex-1">
                    <span style={{ color: "#1A1D23" }} className="text-sm font-bold">
                      Door {r.door}
                    </span>
                    <span style={{ color: "#9CA3AF" }} className="text-sm">
                      {" "}
                      ({r.lane})
                    </span>
                  </div>
                  <span
                    style={{ color: ZONE_COLOR[r.zone] }}
                    className="text-[11px] font-bold uppercase hidden sm:inline"
                  >
                    {ZONE_LABEL[r.zone]}
                  </span>
                  <span
                    style={{ background: `${STATUS_COLOR[status]}1A`, color: STATUS_COLOR[status] }}
                    className="text-[10px] font-bold uppercase px-2 py-1 rounded-full"
                  >
                    {status}
                  </span>
                  <span style={{ color: "#9CA3AF", minWidth: 72, textAlign: "right" }} className="text-xs font-medium">
                    {countdown(r.mins)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
