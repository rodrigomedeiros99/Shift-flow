import { useState, useEffect, useRef } from "react";

const data = {
  outbound: [
    { id: "CL", count: 4, workers: [{ name: "Keimani C.", role: "CLAMP" }, { name: "Nikolas B.", role: "CLAMP" }, { name: "Deandre C.", role: "CLAMP" }, { name: "Zachary S.", role: "CLAMP" }] },
    { id: "FLR", count: 5, workers: [{ name: "Seikou F.", role: "PACER" }, { name: "Shane T.", role: "PACER" }, { name: "Kayla B.", role: "PACER" }, { name: "Nathanial M.", role: "PACER" }, { name: "Winston F.", role: "PACER" }] },
    { id: "OBL", count: 1, workers: [{ name: "Jamie B.", role: "PACER" }] },
    { id: "PA/TL", count: 2, workers: [{ name: "Abdelhadi A.", role: "PACER" }, { name: "Robert O.", role: "PACER" }] },
    { id: "TRIM OVERBOX", count: 5, workers: [{ name: "Ilian R.", role: "WALK" }, { name: "Abdelmoumen A.", role: "WALK" }, { name: "Omar T.", role: "WALK" }, { name: "Heather B.", role: "WALK" }, { name: "Keisha M.", role: "WALK" }] },
    { id: "FLORING OVERBOX", count: 5, workers: [{ name: "Issa D.", role: "WALK" }, { name: "Jonnathan S.", role: "WALK" }, { name: "Evenson F.", role: "WALK" }, { name: "Nicholas T.", role: "WALK" }, { name: "Hamou G.", role: "WALK" }] },
    { id: "LOAD ZONE 1", count: 2, workers: [{ name: "Zachary S.", role: "CLAMP" }, { name: "Keighlee P.", role: "CLAMP" }] },
    { id: "LOAD ZONE 2", count: 2, workers: [{ name: "Corey S.", role: "CLAMP" }, { name: "Chris B.", role: "CLAMP" }] },
    { id: "LOAD ZONE 3", count: 1, workers: [{ name: "Justin E.", role: "CLAMP" }] },
    { id: "ALL ZONE LOAD", count: 1, workers: [{ name: "Mckayla K.", role: "PACER" }] },
    { id: "EPJ", count: 4, workers: [{ name: "Brandon S.", role: "CLAMP" }, { name: "Cesar R.", role: "CLAMP" }, { name: "Ebony M.", role: "CLAMP" }, { name: "Naomi C.", role: "CLAMP" }] },
  ]
};

const roleColors = {
  CLAMP: { bg: "rgba(22,163,74,0.1)", border: "rgba(22,163,74,0.35)", text: "#15803d" },
  PACER: { bg: "rgba(37,99,235,0.1)", border: "rgba(37,99,235,0.35)", text: "#1d4ed8" },
  WALK:  { bg: "rgba(124,58,237,0.1)", border: "rgba(124,58,237,0.35)", text: "#6d28d9" },
};

function RoleBadge({ role }) {
  const c = roleColors[role] || roleColors.WALK;
  return (
    <span style={{
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      borderRadius: 6, padding: "2px 10px",
      fontSize: 11, fontWeight: 700, letterSpacing: 1, fontFamily: "monospace",
    }}>{role}</span>
  );
}

function AnimatedCount({ target }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let n = 0;
    const step = () => { n++; setVal(n); if (n < target) setTimeout(step, 80); };
    setTimeout(step, Math.random() * 400);
  }, [target]);
  return <span>{val}</span>;
}

function WorkerCard({ zone, index }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), index * 80); return () => clearTimeout(t); }, [index]);

  return (
    <div style={{
      background: "rgba(255,255,255,0.72)",
      border: "1px solid rgba(0,0,0,0.07)",
      borderRadius: 16,
      paddingBottom: 12,
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      boxShadow: "0 2px 16px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.9)",
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(18px)",
      transition: "opacity 0.45s ease, transform 0.45s ease",
      overflow: "hidden",
    }}>
      <div style={{
        background: "linear-gradient(90deg, #f97316 0%, #fb923c 100%)",
        padding: "9px 14px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 10,
      }}>
        <span style={{ fontWeight: 800, fontSize: 13, color: "#fff", letterSpacing: 1.5, textTransform: "uppercase" }}>{zone.id}</span>
        <span style={{ background: "rgba(0,0,0,0.2)", color: "#fff", borderRadius: 20, padding: "2px 9px", fontSize: 12, fontWeight: 700 }}>
          <AnimatedCount target={zone.count} />
        </span>
      </div>
      <div style={{ padding: "0 12px", display: "flex", flexDirection: "column", gap: 6 }}>
        {zone.workers.map((w, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "5px 8px", borderRadius: 8,
            background: "rgba(0,0,0,0.02)",
            transition: "background 0.2s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(249,115,22,0.06)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0.02)"}
          >
            <span style={{ color: "#1e293b", fontWeight: 600, fontSize: 14 }}>{w.name}</span>
            <RoleBadge role={w.role} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Particles() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;
    const particles = Array.from({ length: 45 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 2 + 0.5,
      vx: (Math.random() - 0.5) * 0.2, vy: (Math.random() - 0.5) * 0.2,
      alpha: Math.random() * 0.25 + 0.08,
    }));
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(249,115,22,${p.alpha})`; ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    const resize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }} />;
}

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  return (
    <div style={{ textAlign: "right", lineHeight: 1.2 }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: "#1e293b", fontVariantNumeric: "tabular-nums", letterSpacing: 2 }}>
        {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </div>
      <div style={{ fontSize: 12, color: "#94a3b8", letterSpacing: 1 }}>
        {time.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }).toUpperCase()}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const total = data.outbound.reduce((a, z) => a + z.count, 0);

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at 20% 10%, #fff7ed 0%, #f1f5f9 40%, #e0f2fe 100%)",
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      position: "relative", overflow: "auto",
    }}>
      <Particles />
      <style>{`
        @keyframes blob1 { from{transform:translate(0,0) scale(1)} to{transform:translate(60px,50px) scale(1.12)} }
        @keyframes blob2 { from{transform:translate(0,0) scale(1)} to{transform:translate(-50px,-30px) scale(1.08)} }
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>

      {/* Soft background blobs */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 65%)", top: "-200px", left: "-150px", animation: "blob1 14s ease-in-out infinite alternate" }} />
        <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,189,248,0.07) 0%, transparent 65%)", bottom: "-100px", right: "5%", animation: "blob2 17s ease-in-out infinite alternate" }} />
        <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(249,115,22,0.05) 0%, transparent 65%)", top: "40%", right: "25%", animation: "blob1 20s ease-in-out infinite alternate" }} />
      </div>

      {/* Header */}
      <div style={{
        position: "relative", zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 28px 14px",
        borderBottom: "1px solid rgba(0,0,0,0.07)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        background: "rgba(255,255,255,0.6)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {["Outbound", "Inbound", "Full View"].map((t, i) => (
              <button key={t} style={{
                background: i === 2 ? "linear-gradient(135deg,#f97316,#fb923c)" : "rgba(0,0,0,0.05)",
                border: `1px solid ${i === 2 ? "transparent" : "rgba(0,0,0,0.1)"}`,
                color: i === 2 ? "#fff" : "#64748b",
                borderRadius: 8, padding: "6px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>{t}</button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block", animation: "pulse-dot 2s ease-in-out infinite" }} />
            <span style={{ color: "#94a3b8", fontSize: 12, letterSpacing: 1 }}>LIVE · {total} ASSIGNED</span>
          </div>
        </div>
        <LiveClock />
      </div>

      {/* Section label */}
      <div style={{ position: "relative", zIndex: 10, padding: "14px 28px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: "#1e293b", fontWeight: 800, fontSize: 18, letterSpacing: 1.5 }}>OUTBOUND</span>
        <span style={{ color: "#94a3b8", fontSize: 12, letterSpacing: 2 }}>KEY 1</span>
      </div>

      {/* Grid */}
      <div style={{
        position: "relative", zIndex: 10,
        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
        gap: 14, padding: "14px 28px 32px",
      }}>
        {data.outbound.map((zone, i) => <WorkerCard key={zone.id} zone={zone} index={i} />)}
      </div>
    </div>
  );
}
