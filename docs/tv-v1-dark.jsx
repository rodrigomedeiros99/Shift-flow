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
  CLAMP: { bg: "rgba(34,197,94,0.18)", border: "rgba(34,197,94,0.5)", text: "#4ade80" },
  PACER: { bg: "rgba(59,130,246,0.18)", border: "rgba(59,130,246,0.5)", text: "#60a5fa" },
  WALK:  { bg: "rgba(168,85,247,0.18)", border: "rgba(168,85,247,0.5)", text: "#c084fc" },
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
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.09)",
      borderRadius: 16,
      paddingBottom: 12,
      backdropFilter: "blur(18px)",
      WebkitBackdropFilter: "blur(18px)",
      boxShadow: "0 4px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.07)",
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
        <span style={{ background: "rgba(0,0,0,0.25)", color: "#fff", borderRadius: 20, padding: "2px 9px", fontSize: 12, fontWeight: 700 }}>
          <AnimatedCount target={zone.count} />
        </span>
      </div>
      <div style={{ padding: "0 12px", display: "flex", flexDirection: "column", gap: 6 }}>
        {zone.workers.map((w, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "5px 8px", borderRadius: 8,
            background: "rgba(255,255,255,0.03)",
            transition: "background 0.2s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(249,115,22,0.08)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
          >
            <span style={{ color: "#f1f5f9", fontWeight: 600, fontSize: 14 }}>{w.name}</span>
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
    const particles = Array.from({ length: 55 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.8 + 0.4,
      vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.22,
      alpha: Math.random() * 0.5 + 0.15,
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
      <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", fontVariantNumeric: "tabular-nums", letterSpacing: 2 }}>
        {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", letterSpacing: 1 }}>
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
      background: "radial-gradient(ellipse at 20% 20%, #1a0a2e 0%, #0d1117 45%, #0a1628 100%)",
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      position: "relative", overflow: "auto",
    }}>
      <Particles />
      <style>{`
        @keyframes blob1 { from{transform:translate(0,0) scale(1)} to{transform:translate(80px,60px) scale(1.15)} }
        @keyframes blob2 { from{transform:translate(0,0) scale(1)} to{transform:translate(-60px,-40px) scale(1.1)} }
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>

      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(249,115,22,0.07) 0%, transparent 70%)", top: "-150px", left: "-100px", animation: "blob1 12s ease-in-out infinite alternate" }} />
        <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)", bottom: "0px", right: "10%", animation: "blob2 15s ease-in-out infinite alternate" }} />
      </div>

      {/* Header */}
      <div style={{
        position: "relative", zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 28px 14px",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        backdropFilter: "blur(10px)",
        background: "rgba(0,0,0,0.25)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {["Outbound", "Inbound", "Full View"].map((t, i) => (
              <button key={t} style={{
                background: i === 2 ? "linear-gradient(135deg,#f97316,#fb923c)" : "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)", color: "#fff",
                borderRadius: 8, padding: "6px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>{t}</button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", display: "inline-block", animation: "pulse-dot 2s ease-in-out infinite" }} />
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, letterSpacing: 1 }}>LIVE · {total} ASSIGNED</span>
          </div>
        </div>
        <LiveClock />
      </div>

      <div style={{ position: "relative", zIndex: 10, padding: "14px 28px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: "#f1f5f9", fontWeight: 800, fontSize: 18, letterSpacing: 1.5 }}>OUTBOUND</span>
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, letterSpacing: 2 }}>KEY 1</span>
      </div>

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
