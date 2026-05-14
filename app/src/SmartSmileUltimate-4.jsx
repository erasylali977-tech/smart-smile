import { useState, useEffect, useRef, useCallback } from "react";

// ══════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════
const TOTAL = 120, ZONE_T = 30;
const ZONES = [
  { id:0, label:"Верх лево",  color:"#06B6D4" },
  { id:1, label:"Верх право", color:"#8B5CF6" },
  { id:2, label:"Низ лево",   color:"#F43F5E" },
  { id:3, label:"Низ право",  color:"#10B981" },
];
const lerp = (a,b,t) => a+(b-a)*t;
const rand = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
const toothCol = w => `rgb(${Math.round(lerp(148,255,w))},${Math.round(lerp(128,252,w))},${Math.round(lerp(100,220,w))})`;
let _nid = 0; const nid = () => ++_nid;

// zone each tooth belongs to
// top: 0-6 = zone0(left), 7-13 = zone1(right)
// bot: 0-6 = zone2(left), 7-13 = zone3(right)
const toothZone = (jaw, idx) => jaw === 'top' ? (idx < 7 ? 0 : 1) : (idx < 7 ? 2 : 3);

// ══════════════════════════════════════════
// JAWS — built exactly from reference photo
// Upper: wide arch, teeth hang DOWN, big central incisors, smaller laterals,
//        canines, premolars, molars — all sized like ref
// Lower: narrower arch, V-shape — CENTER TEETH LOWER (higher Y), edges rise up
//        small incisors, prominent canines, then premolars/molars
// Dirty state: yellow-brown, dark stains, tartar at gum line
// Clean state: bright white with specular shine
// ══════════════════════════════════════════
const BRUSH_SVG = (flip) => (
  <svg width="22" height="62" viewBox="0 0 22 62"
    style={{
      filter:"drop-shadow(0 0 8px rgba(56,189,248,1)) drop-shadow(0 0 3px white)",
      transform: flip ? "scaleY(-1)" : "none",
    }}>
    {/* handle */}
    <rect x="7" y="22" width="8" height="40" rx="4" fill="#0284C7"/>
    <rect x="8.5" y="22" width="2.5" height="40" rx="1.5" fill="#38BDF8" opacity="0.5"/>
    {/* neck */}
    <rect x="8" y="14" width="6" height="10" rx="2" fill="#0369A1"/>
    {/* head body */}
    <rect x="1" y="1" width="20" height="15" rx="5" fill="#E0F2FE"/>
    <rect x="2" y="2" width="18" height="13" rx="4" fill="#BAE6FD"/>
    {/* rubber side strips */}
    <rect x="1" y="6" width="3" height="3" rx="1" fill="#38BDF8" opacity="0.7"/>
    <rect x="18" y="6" width="3" height="3" rx="1" fill="#38BDF8" opacity="0.7"/>
    {/* bristle tufts: 3 rows × 5 cols */}
    {[3,6.5,10,13.5,17].map(x =>
      [1,5,9].map(y => (
        <rect key={`${x}-${y}`} x={x-1} y={y} width="2.5" height="5" rx="1.2"
          fill={y===1?"#0EA5E9":y===5?"#38BDF8":"#7DD3FC"} opacity="0.96"/>
      ))
    )}
    {/* foam blobs at bristle tips */}
    {[2,6,10,14,18].map((x,i) => (
      <ellipse key={i} cx={x} cy={0} rx="2.2" ry="1.5" fill="white" opacity="0.9"/>
    ))}
    <ellipse cx="11" cy="-2" rx="4" ry="2" fill="white" opacity="0.6"/>
  </svg>
);

function Jaws({ whiteness, activeZone, doneZones, running, brushX, brushJaw }) {
  const [pulse, setPulse] = useState(0);
  useEffect(() => { const id = setInterval(() => setPulse(p=>p+1), 100); return () => clearInterval(id); }, []);
  const po = 0.42 + Math.sin(pulse*0.44)*0.42;

  // ── tooth colour: dirty brown/yellow → clean white (matches ref photo)
  const tCol = (w) => {
    // dirty: yellowish-brown (#C8B89A), medium: off-white (#EDE6D6), clean: bright white (#FAFAF8)
    const r = Math.round(lerp(162, 250, w));
    const g = Math.round(lerp(142, 250, w));
    const b = Math.round(lerp(110, 248, w));
    return `rgb(${r},${g},${b})`;
  };

  // ── dirty overlays per zone
  const DirtyOverlay = ({ w, zi, tw, th, cx, cy }) => {
    if (w > 0.85) return null;
    const str = 1 - w; // 0=clean, 1=very dirty
    const x0 = cx - tw/2, y0 = cy - th/2;
    if (zi === 0) return ( // CARIES zone – brown pits
      <>
        <ellipse cx={cx-tw*0.15} cy={cy-th*0.1} rx={tw*0.22*str+1.5} ry={th*0.18*str+1.5}
          fill="#6B3A0F" opacity={Math.min(0.88, str*1.3)}/>
        <ellipse cx={cx+tw*0.18} cy={cy+th*0.15} rx={tw*0.16*str+1} ry={th*0.14*str+1}
          fill="#7C4A1A" opacity={Math.min(0.7, str*1.1)}/>
      </>
    );
    if (zi === 1) return ( // PLAQUE – yellow film
      <rect x={x0+1} y={y0+1} width={tw-2} height={th-2} rx={tw*0.3}
        fill="#C9A820" opacity={Math.min(0.55, str*0.72)}/>
    );
    if (zi === 2) return ( // TARTAR – grey calculus at gum line (top of tooth)
      <rect x={x0} y={y0} width={tw} height={th*0.35}
        rx={tw*0.3} fill="#888880" opacity={Math.min(0.58, str*0.78)}/>
    );
    if (zi === 3) return ( // GINGIVITIS – red inflamed gum border
      <rect x={x0} y={y0} width={tw} height={th*0.28}
        rx={tw*0.3} fill="#DC3545" opacity={Math.min(0.52, str*0.68)}/>
    );
    return null;
  };

  // ── render one tooth as SVG group
  const T = ({ cx, cy, rot, w, h, zi, isMolar, isPremolar, idx, jaw }) => {
    const wn     = whiteness[zi];
    const col    = tCol(wn);
    const active = running && activeZone === zi;
    const done   = doneZones.includes(zi);
    const brushing = running && brushJaw === jaw && Math.abs(brushX - cx) < 18 && activeZone === zi;
    const glowC  = ZONES[zi].color;

    // tooth shape: rounded rect with slightly tapered bottom (canine: more tapered)
    const rx_ = isMolar ? w*0.28 : isPremolar ? w*0.32 : w*0.4;
    // shadow beneath
    return (
      <g transform={`rotate(${rot},${cx},${cy})`}>
        {/* drop shadow */}
        <ellipse cx={cx} cy={cy+h*0.42} rx={w*0.52} ry={h*0.12}
          fill="rgba(0,0,0,0.28)"/>
        {/* main tooth body */}
        <rect x={cx-w/2} y={cy-h/2} width={w} height={h} rx={rx_}
          fill={col}
          stroke={brushing?"#FFFFFF":active?glowC:done?"#4ADE80":"rgba(200,180,140,0.4)"}
          strokeWidth={brushing?2.5:active?1.8:done?1.2:0.6}
          style={{transition:"fill 1.1s ease, stroke 0.3s"}}
          filter={brushing?"url(#bGlow)":active?`url(#zGlow${zi})`:undefined}
        />
        {/* molar fissure groove */}
        {isMolar && (
          <path d={`M${cx-w*0.15},${cy-h*0.12} Q${cx},${cy+h*0.05} ${cx+w*0.15},${cy-h*0.1}`}
            stroke="rgba(0,0,0,0.14)" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
        )}
        {/* premolar cusp */}
        {isPremolar && (
          <line x1={cx} y1={cy-h*0.2} x2={cx} y2={cy+h*0.15}
            stroke="rgba(0,0,0,0.1)" strokeWidth="1.2" strokeLinecap="round"/>
        )}
        {/* specular shine — top-left highlight */}
        <ellipse cx={cx-w*0.18} cy={cy-h*0.22}
          rx={w*0.2} ry={h*0.15}
          fill="white" opacity={0.06+wn*0.26}
          style={{transition:"opacity 1s"}}/>
        {/* secondary sheen */}
        <ellipse cx={cx+w*0.1} cy={cy-h*0.35}
          rx={w*0.1} ry={h*0.08}
          fill="white" opacity={0.04+wn*0.14}
          style={{transition:"opacity 1s"}}/>
        {/* dirty overlay */}
        <DirtyOverlay w={wn} zi={zi} tw={w} th={h} cx={cx} cy={cy}/>
        {/* active zone pulse rim */}
        {active && (
          <rect x={cx-w/2-1.5} y={cy-h/2-1.5} width={w+3} height={h+3} rx={rx_+1.5}
            fill="none" stroke={glowC} strokeWidth="2.2" opacity={po*0.75}/>
        )}
        {/* sparkle when fully clean */}
        {wn > 0.9 && (idx===3||idx===10) && Math.floor(pulse/5)%3===0 && (
          <text x={cx-5} y={cy-h*0.65} fontSize="9" style={{userSelect:"none"}}>✨</text>
        )}
      </g>
    );
  };

  // ══ UPPER JAW teeth — 14 teeth
  // Reference: 2 central incisors (biggest, near center), 2 lateral incisors (smaller),
  // 2 canines (pointy, medium), 4 premolars, 4 molars (sides, biggest)
  // Arch: perfectly semicircular from left to right, teeth hang DOWN
  // SVG coords: viewBox 0 0 300 95, gum line at y≈15, tooth tips reach y≈60-70
  const TOP_TEETH = (() => {
    // Each tooth: [cx, cy-at-center, rotDeg, width, height, typeKey]
    // Mirror: left half [0..6], right half [7..13]
    // Gum line follows arch curve: center high (y≈20), sides lower (y≈38)
    const teeth = [];
    // Define right half (idx 7-13 = center→right), mirror for left (idx 0-6)
    // idx 6,7 = central incisors (widest, tallest, at center)
    // idx 5,8 = lateral incisors
    // idx 4,9 = canines
    // idx 3,10 = first premolars
    // idx 2,11 = second premolars
    // idx 1,12 = first molars
    // idx 0,13 = second molars (at far sides)
    const half = [
      // [distFromCenter, gumY, toothH, toothW, isMolar, isPremolar]
      { d:148, gy:48, h:32, w:20, mol:true,  pre:false },  // 0,13 second molar
      { d:121, gy:34, h:35, w:18, mol:true,  pre:false },  // 1,12 first molar
      { d: 96, gy:23, h:36, w:16, mol:false, pre:true  },  // 2,11 second premolar
      { d: 74, gy:16, h:37, w:15, mol:false, pre:true  },  // 3,10 first premolar
      { d: 54, gy:12, h:38, w:13, mol:false, pre:false },  // 4,9  canine
      { d: 36, gy:10, h:35, w:13, mol:false, pre:false },  // 5,8  lateral incisor
      { d: 18, gy: 8, h:38, w:16, mol:false, pre:false },  // 6,7  central incisor
    ];
    const CX = 150; // center of arch
    half.forEach((spec, hi) => {
      const iRight = 7 + hi; // right tooth index
      const iLeft  = 6 - hi; // left tooth index
      // rotation: outer teeth tilt outward more
      const rot = hi * 7.5; // 0° at center, ~45° at molar
      // tooth center: gum attachment point + half tooth height offset
      const tcy = spec.gy + spec.h * 0.42;
      // right side
      teeth[iRight] = {
        cx: CX + spec.d/2, cy: tcy, rot: rot,
        w: spec.w, h: spec.h, zi: toothZone('top', iRight),
        isMolar: spec.mol, isPremolar: spec.pre, i: iRight,
      };
      // left side (mirror)
      teeth[iLeft] = {
        cx: CX - spec.d/2, cy: tcy, rot: -rot,
        w: spec.w, h: spec.h, zi: toothZone('top', iLeft),
        isMolar: spec.mol, isPremolar: spec.pre, i: iLeft,
      };
    });
    return teeth;
  })();

  // ══ LOWER JAW teeth — 14 teeth
  // Reference: narrower arch, V-shape — front center teeth are LOWER (larger y),
  // edges (molars) are HIGHER (smaller y). Small lower incisors, pointy canines.
  const BOT_TEETH = (() => {
    const teeth = [];
    // Lower arch is narrower and shorter than upper
    // Gum base: center at y≈40 (low), edges rise to y≈15
    const half = [
      { d:136, gy:14, h:28, w:19, mol:true,  pre:false }, // 0,13 second molar
      { d:110, gy:18, h:30, w:17, mol:true,  pre:false }, // 1,12 first molar
      { d: 87, gy:22, h:30, w:15, mol:false, pre:true  }, // 2,11 second premolar
      { d: 66, gy:27, h:30, w:14, mol:false, pre:true  }, // 3,10 first premolar
      { d: 47, gy:33, h:30, w:12, mol:false, pre:false }, // 4,9  canine (taller)
      { d: 30, gy:37, h:26, w:10, mol:false, pre:false }, // 5,8  lateral incisor
      { d: 14, gy:40, h:25, w: 9, mol:false, pre:false }, // 6,7  central incisor (smallest)
    ];
    const CX = 150;
    half.forEach((spec, hi) => {
      const iRight = 7 + hi;
      const iLeft  = 6 - hi;
      const rot    = hi * 7;
      // For lower jaw teeth point UP, so cy is gumY - h*0.42 (tooth extends upward)
      const tcy    = spec.gy - spec.h * 0.42 + spec.h; // anchor at gum line, tooth extends up
      teeth[iRight] = {
        cx: CX + spec.d/2, cy: tcy, rot: rot,
        w: spec.w, h: spec.h, zi: toothZone('bot', iRight),
        isMolar: spec.mol, isPremolar: spec.pre, i: iRight,
      };
      teeth[iLeft] = {
        cx: CX - spec.d/2, cy: tcy, rot: -rot,
        w: spec.w, h: spec.h, zi: toothZone('bot', iLeft),
        isMolar: spec.mol, isPremolar: spec.pre, i: iLeft,
      };
    });
    return teeth;
  })();

  const zoneGlow = (zi) => running && activeZone===zi
    ? `, 0 0 20px ${ZONES[zi].color}55` : "";

  return (
    <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:3 }}>

      {/* ══ UPPER JAW ══ */}
      <div style={{
        position:"relative",
        background:"linear-gradient(180deg,#7A1020 0%,#B03060 28%,#D8706A 60%,#F0A0A0 85%,#F8C4BE 100%)",
        borderRadius:"52% 52% 14% 14% / 65% 65% 22% 22%",
        padding:"4px 8px 18px",
        boxShadow:`inset 0 -12px 28px rgba(0,0,0,0.5), 0 5px 16px rgba(0,0,0,0.45)${zoneGlow(0)}${zoneGlow(1)}`,
        transition:"box-shadow 0.8s", overflow:"hidden", minHeight:88,
      }}>
        {/* zone highlight overlays */}
        {running && activeZone===0 && (
          <div style={{position:"absolute",left:0,top:0,width:"50%",height:"100%",
            background:`radial-gradient(ellipse at 20% 50%,${ZONES[0].color}25,transparent 70%)`,
            pointerEvents:"none",opacity:po}}/>
        )}
        {running && activeZone===1 && (
          <div style={{position:"absolute",right:0,top:0,width:"50%",height:"100%",
            background:`radial-gradient(ellipse at 80% 50%,${ZONES[1].color}25,transparent 70%)`,
            pointerEvents:"none",opacity:po}}/>
        )}

        <svg viewBox="0 0 300 88" style={{width:"100%",display:"block",overflow:"visible"}}>
          <defs>
            {ZONES.map((z,i)=>(
              <filter key={i} id={`zGlow${i}`} x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="3.5" result="b"/>
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            ))}
            <filter id="bGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="5" result="b"/>
              <feFlood floodColor="white" floodOpacity="0.8" result="f"/>
              <feComposite in="f" in2="b" operator="in" result="c"/>
              <feMerge><feMergeNode in="c"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <radialGradient id="palateGrad" cx="50%" cy="60%" r="55%">
              <stop offset="0%" stopColor="#C06070"/>
              <stop offset="100%" stopColor="#A04050"/>
            </radialGradient>
          </defs>

          {/* palate / inner mouth */}
          <path d="M30,88 Q40,50 80,30 Q150,10 220,30 Q260,50 270,88 Z"
            fill="url(#palateGrad)" opacity="0.7"/>
          {/* gum arch — outer */}
          <path d="M0,88 Q5,30 50,12 Q150,-2 250,12 Q295,30 300,88 Z"
            fill="#C04858"/>
          {/* gum arch — inner lighter */}
          <path d="M8,88 Q14,34 56,16 Q150,4 244,16 Q286,34 292,88 Z"
            fill="#D8606E"/>
          {/* gum highlight ridge */}
          <path d="M20,88 Q28,42 68,22 Q150,10 232,22 Q272,42 280,88"
            fill="none" stroke="rgba(255,160,160,0.3)" strokeWidth="3"/>
          {/* center raphe */}
          <line x1="150" y1="5" x2="150" y2="88"
            stroke="rgba(140,50,60,0.3)" strokeWidth="1.8"/>

          {TOP_TEETH.map(td => (
            <T key={`top${td.i}`} {...td} jaw="top"/>
          ))}
        </svg>

        {/* Brush for upper jaw — bristles facing DOWN */}
        {running && brushJaw==='top' && (
          <div style={{
            position:"absolute",
            left:`${((brushX-30)/(300-60))*100}%`,
            bottom:"6%",
            transform:"translate(-50%,0)",
            zIndex:12, pointerEvents:"none",
            transition:"left 0.05s linear",
          }}>
            {BRUSH_SVG(false)}
          </div>
        )}
      </div>

      {/* ══ GAP (dark mouth interior) ══ */}
      <div style={{
        height:14, margin:"0 10px",
        background:"linear-gradient(180deg,#3A0810 0%,#1A0408 50%,#3A0810 100%)",
        borderRadius:4,
        boxShadow:"inset 0 2px 8px rgba(0,0,0,0.8)",
        position:"relative",overflow:"hidden",
      }}>
        {/* tongue visible in gap */}
        <div style={{
          position:"absolute",left:"50%",top:"50%",
          transform:"translate(-50%,-50%)",
          width:"45%",height:10,borderRadius:10,
          background:"radial-gradient(ellipse,#C05868,#8A2838)",
          opacity:0.7,
        }}/>
      </div>

      {/* ══ LOWER JAW ══ */}
      <div style={{
        position:"relative",
        background:"linear-gradient(0deg,#7A1020 0%,#B03060 28%,#D8706A 60%,#F0A0A0 85%,#F8C4BE 100%)",
        borderRadius:"14% 14% 52% 52% / 22% 22% 65% 65%",
        padding:"18px 8px 4px",
        boxShadow:`inset 0 12px 28px rgba(0,0,0,0.5), 0 -5px 16px rgba(0,0,0,0.45)${zoneGlow(2)}${zoneGlow(3)}`,
        transition:"box-shadow 0.8s", overflow:"hidden", minHeight:72,
      }}>
        {running && activeZone===2 && (
          <div style={{position:"absolute",left:0,bottom:0,width:"50%",height:"100%",
            background:`radial-gradient(ellipse at 20% 60%,${ZONES[2].color}25,transparent 70%)`,
            pointerEvents:"none",opacity:po}}/>
        )}
        {running && activeZone===3 && (
          <div style={{position:"absolute",right:0,bottom:0,width:"50%",height:"100%",
            background:`radial-gradient(ellipse at 80% 60%,${ZONES[3].color}25,transparent 70%)`,
            pointerEvents:"none",opacity:po}}/>
        )}

        <svg viewBox="0 0 300 72" style={{width:"100%",display:"block",overflow:"visible"}}>
          <defs>
            <radialGradient id="tongueGrad" cx="50%" cy="40%" r="55%">
              <stop offset="0%" stopColor="#D06880"/>
              <stop offset="100%" stopColor="#A03050"/>
            </radialGradient>
          </defs>

          {/* tongue / floor of mouth */}
          <path d="M40,0 Q80,8 150,10 Q220,8 260,0 Q275,30 260,55 Q215,72 150,72 Q85,72 40,55 Q25,30 40,0Z"
            fill="url(#tongueGrad)" opacity="0.5"/>
          {/* gum arch — outer */}
          <path d="M0,0 Q5,50 50,62 Q150,76 250,62 Q295,50 300,0 Z"
            fill="#C04858"/>
          {/* gum arch — inner lighter */}
          <path d="M8,0 Q14,48 56,60 Q150,72 244,60 Q286,48 292,0 Z"
            fill="#D8606E"/>
          {/* gum highlight */}
          <path d="M20,0 Q28,44 68,58 Q150,70 232,58 Q272,44 280,0"
            fill="none" stroke="rgba(255,160,160,0.3)" strokeWidth="3"/>
          <line x1="150" y1="0" x2="150" y2="72"
            stroke="rgba(140,50,60,0.3)" strokeWidth="1.8"/>

          {BOT_TEETH.map(td => (
            <T key={`bot${td.i}`} {...td} jaw="bot"/>
          ))}
        </svg>

        {/* Brush for lower jaw — bristles facing UP (flipped) */}
        {running && brushJaw==='bot' && (
          <div style={{
            position:"absolute",
            left:`${((brushX-30)/(300-60))*100}%`,
            top:"6%",
            transform:"translate(-50%,0)",
            zIndex:12, pointerEvents:"none",
            transition:"left 0.05s linear",
          }}>
            {BRUSH_SVG(true)}
          </div>
        )}
      </div>

      {/* Zone legend pills */}
      <div style={{display:"flex",gap:4,justifyContent:"center",flexWrap:"wrap",marginTop:4}}>
        {ZONES.map((z,i) => {
          const isActive = running && activeZone===i;
          const isDone   = doneZones.includes(i);
          return (
            <div key={i} style={{
              display:"flex",alignItems:"center",gap:3,
              borderRadius:20, padding:"2px 9px",
              background: isActive?`${z.color}22`:isDone?"rgba(74,222,128,0.1)":"rgba(255,255,255,0.04)",
              border:`1.5px solid ${isActive?z.color:isDone?"#4ADE80":"rgba(255,255,255,0.07)"}`,
              transition:"all 0.3s",
              boxShadow:isActive?`0 0 10px ${z.color}66`:isDone?"0 0 8px rgba(74,222,128,0.25)":"none",
            }}>
              <div style={{width:6,height:6,borderRadius:"50%",
                background:isDone?"#4ADE80":z.color,
                boxShadow:isActive?`0 0 6px ${z.color}`:isDone?"0 0 5px #4ADE80":"none",
              }}/>
              <span style={{color:isActive?z.color:isDone?"#4ADE80":"#475569",
                fontSize:8,fontWeight:700}}>{z.label}</span>
              {isDone && <span style={{fontSize:9}}>✓</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// KNIGHT HERO (left reference — blue/gold armor, fur hat, big brush sword)
// ══════════════════════════════════════════
function KnightHero({ running, attackSwing, pasteShot }) {
  const [t, setT] = useState(0);
  useEffect(() => { const id = setInterval(() => setT(x=>x+1), 100); return () => clearInterval(id); }, []);

  const bob = running ? Math.sin(t*0.85)*3 : 0;
  // sword arm angle: idle = -15, running = swinging, attack = extended forward
  const swordAng = attackSwing
    ? -70 + Math.sin(t*3)*15   // fast attack swing
    : running
    ? -20 + Math.sin(t*1.2)*18 // idle run bob
    : -15;
  const atk = running && attackSwing;

  return (
    <svg width="88" height="118" viewBox="0 0 100 134"
      style={{filter:"drop-shadow(0 6px 20px rgba(30,64,175,0.8))"}}>
      <g transform={`translate(0,${bob})`}>

        {/* ── CAPE (flowing blue) ── */}
        <path d={`M36,62 Q18,${92+Math.sin(t*0.5)*7} 24,${118+Math.sin(t*0.35)*4} Q42,124 48,118 Q36,92 36,62Z`}
          fill="#1D4ED8" opacity="0.85"/>
        <path d={`M36,62 Q20,${90+Math.sin(t*0.5)*7} 26,${116} Q40,120 46,116`}
          fill="#3B82F6" opacity="0.5"/>

        {/* ── LEGS ── */}
        <rect x="33" y="98" width="13" height="22" rx="5" fill="#1E3A8A"/>
        <rect x="50" y="98" width="13" height="22" rx="5" fill="#1E3A8A"/>
        {/* boots */}
        <rect x="30" y="114" width="17" height="11" rx="4" fill="#1C1917"/>
        <rect x="48" y="114" width="17" height="11" rx="4" fill="#1C1917"/>
        <rect x="30" y="114" width="17" height="5"  rx="3" fill="#292524"/>
        <rect x="48" y="114" width="17" height="5"  rx="3" fill="#292524"/>

        {/* ── BODY ARMOR ── */}
        <rect x="26" y="62" width="48" height="40" rx="9" fill="#1E40AF"/>
        <rect x="28" y="64" width="44" height="36" rx="8" fill="#2563EB"/>
        {/* chest plate diamond pattern */}
        <path d="M36,66 Q50,61 64,66 L62,86 Q50,92 38,86Z" fill="#1D4ED8"/>
        <path d="M40,70 L50,67 L60,70 L58,84 L50,87 L42,84Z" fill="#1E40AF" opacity="0.6"/>
        {/* gold trim lines */}
        <path d="M36,66 Q50,61 64,66" stroke="#D97706" strokeWidth="2" fill="none"/>
        <path d="M38,86 Q50,92 62,86" stroke="#D97706" strokeWidth="2" fill="none"/>
        {/* center emblem (tooth shape) */}
        <path d="M46,71 Q50,68 54,71 L53,80 Q50,83 47,80Z" fill="#FBBF24" opacity="0.9"/>
        {/* gold belt */}
        <rect x="26" y="90" width="48" height="9" rx="4" fill="#92400E"/>
        <rect x="28" y="91" width="44" height="7" rx="3" fill="#D97706"/>
        <rect x="45" y="89" width="10" height="9" rx="3" fill="#92400E"/>
        <circle cx="50" cy="94" r="3.5" fill="#FBBF24"/>
        {/* shoulder pads */}
        <ellipse cx="28" cy="68" rx="11" ry="7" fill="#1E3A8A"/>
        <ellipse cx="72" cy="68" rx="11" ry="7" fill="#1E3A8A"/>
        <ellipse cx="28" cy="67" rx="9"  ry="5.5" fill="#2563EB"/>
        <ellipse cx="72" cy="67" rx="9"  ry="5.5" fill="#2563EB"/>
        <ellipse cx="28" cy="65" rx="9"  ry="3" fill="#D97706" opacity="0.55"/>
        <ellipse cx="72" cy="65" rx="9"  ry="3" fill="#D97706" opacity="0.55"/>
        {/* fur trim on shoulders */}
        {[20,23,26,29,32,35].map((x,i)=>(
          <ellipse key={i} cx={x} cy="63" rx="2.2" ry="3.2" fill="#F5F5F4" opacity="0.92"/>
        ))}
        {[62,65,68,71,74,77,80].map((x,i)=>(
          <ellipse key={i} cx={x} cy="63" rx="2.2" ry="3.2" fill="#F5F5F4" opacity="0.92"/>
        ))}

        {/* ── HEAD ── */}
        {/* helmet — Kazakh style with fur brim */}
        <ellipse cx="50" cy="36" rx="24" ry="26" fill="#1E3A8A"/>
        {/* face opening */}
        <path d="M32,34 Q32,54 50,56 Q68,54 68,34 Q68,26 50,24 Q32,26 32,34Z" fill="#FED7AA"/>
        {/* helmet dome */}
        <ellipse cx="50" cy="20" rx="22" ry="10" fill="#1E40AF"/>
        <ellipse cx="50" cy="18" rx="20" ry="8"  fill="#2563EB"/>
        {/* top spike/crest */}
        <polygon points="50,6 53,14 57,14 50,20 43,14 47,14" fill="#D97706"/>
        {/* feather plume */}
        <path d={`M50,7 Q${52+Math.sin(t*0.7)*3},${1+Math.sin(t*0.5)*2} ${54+Math.sin(t*0.7)*2},8 Q52,13 50,18 Q48,13 50,7Z`}
          fill="#F5F5F4" opacity="0.95"/>
        <path d={`M50,7 Q${51+Math.sin(t*0.7)*2},3 ${52+Math.sin(t*0.7)*2},8 Q51,12 50,16`}
          fill="#E5E5E5"/>
        {/* helmet gold diamond gem */}
        <polygon points="50,20 54,25 50,30 46,25" fill="#FBBF24"/>
        <polygon points="50,21 53,25 50,29 47,25" fill="#FDE68A"/>
        {/* cheek guards */}
        <rect x="26" y="28" width="9" height="20" rx="4" fill="#1E3A8A"/>
        <rect x="65" y="28" width="9" height="20" rx="4" fill="#1E3A8A"/>
        {/* fur brim around helmet */}
        {[26,29,32,35,38,41,44,47,50,53,56,59,62,65,68,71,74].map((x,i)=>(
          <ellipse key={i} cx={x} cy="37" rx="2.5" ry="3.5" fill="#F5F5F4" opacity="0.85"/>
        ))}
        {/* visor */}
        <rect x="33" y="36" width="34" height="6" rx="3" fill="#1E1B4B" opacity="0.7"/>
        {/* eyes */}
        <circle cx="41" cy="38" r="5" fill="white"/>
        <circle cx="59" cy="38" r="5" fill="white"/>
        <circle cx={atk?42:41} cy={atk?39:38} r="3" fill="#1E1B4B"/>
        <circle cx={atk?60:59} cy={atk?39:38} r="3" fill="#1E1B4B"/>
        <circle cx={atk?43:42} cy={atk?37:36} r="1.1" fill="white"/>
        <circle cx={atk?61:60} cy={atk?37:36} r="1.1" fill="white"/>
        {atk && <>
          <path d="M36,30 Q41,26 46,30" stroke="#92400E" strokeWidth="2" fill="none" strokeLinecap="round"/>
          <path d="M54,30 Q59,26 64,30" stroke="#92400E" strokeWidth="2" fill="none" strokeLinecap="round"/>
        </>}
        {/* confident smirk */}
        <path d={atk
          ? "M42,49 L46,53 L50,48 L54,53 L58,49"
          : "M43,49 Q50,55 57,49"}
          stroke="#92400E" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        {atk && <>
          <rect x="45" y="49" width="4.5" height="5.5" rx="1.5" fill="white"/>
          <rect x="50.5" y="49" width="4.5" height="5.5" rx="1.5" fill="white"/>
        </>}

        {/* ── LEFT ARM — paste shield ── */}
        <g transform={`rotate(${running?Math.sin(t*0.9)*8:0},24,76)`}>
          {/* arm */}
          <rect x="18" y="66" width="10" height="22" rx="5" fill="#1E3A8A"/>
          {/* shield */}
          <ellipse cx="20" cy="80" rx="16" ry="19" fill="#1E3A8A"/>
          <ellipse cx="20" cy="80" rx="14" ry="17" fill="#1E40AF"/>
          {/* paste swirl */}
          <ellipse cx="20" cy="80" rx="10" ry="12" fill="white" opacity="0.92"/>
          <path d="M20,70 Q27,74 25,80 Q23,86 16,83 Q11,77 16,72 Q19,69 20,70Z"
            fill="#38BDF8" opacity="0.85"/>
          <ellipse cx="20" cy="80" rx="4.5" ry="5.5" fill="white"/>
          <ellipse cx="20" cy="80" rx="2" ry="2.5" fill="#0EA5E9" opacity="0.7"/>
          {/* shield gold trim */}
          <ellipse cx="20" cy="80" rx="16" ry="19" fill="none" stroke="#D97706" strokeWidth="2.2"/>
          <ellipse cx="20" cy="80" rx="16" ry="19" fill="none" stroke="#FBBF24" strokeWidth="0.8" opacity="0.5"/>
        </g>

        {/* ── RIGHT ARM — toothbrush sword ── */}
        <g transform={`rotate(${swordAng},76,70)`}>
          {/* upper arm */}
          <rect x="72" y="62" width="11" height="16" rx="5" fill="#1E3A8A"/>
          {/* gauntlet */}
          <rect x="71" y="76" width="13" height="12" rx="4" fill="#1E40AF"/>
          {/* cross guard */}
          <rect x="63" y="86" width="29" height="7" rx="3.5" fill="#92400E"/>
          <rect x="65" y="87" width="25" height="5" rx="2.5" fill="#D97706"/>
          <circle cx="77.5" cy="89.5" r="2.5" fill="#FBBF24"/>
          {/* handle */}
          <rect x="73" y="93" width="9" height="20" rx="4.5" fill="#1E3A8A"/>
          <rect x="74" y="94" width="7" height="18" rx="3.5" fill="#2563EB"/>
          {/* blue grip wrapping */}
          {[97,101,105,109].map(y=>(
            <rect key={y} x="73" y={y} width="9" height="2.5" rx="1" fill="#1D4ED8"/>
          ))}
          {/* brush head (top of sword) */}
          <rect x="69" y="44" width="17" height="20" rx="5" fill="#EFF6FF"/>
          <rect x="70" y="45" width="15" height="18" rx="4" fill="#DBEAFE"/>
          {/* gold head band */}
          <rect x="69" y="44" width="17" height="5" rx="4" fill="#D97706"/>
          <rect x="70" y="45" width="15" height="3" rx="2" fill="#FBBF24"/>
          {/* bristles */}
          {[71,73.5,76,78.5,81,83.5].map(x=>(
            <line key={x} x1={x} y1="44" x2={x} y2="36"
              stroke="#38BDF8" strokeWidth="2" strokeLinecap="round"/>
          ))}
          {/* foam when attacking */}
          {atk && [71,73.5,76,78.5,81,83.5].map((x,i)=>(
            <circle key={x} cx={x} cy={33-i*1.2} r={2.8-i*0.2}
              fill="white" opacity={0.92-i*0.1}/>
          ))}
        </g>

        {/* attack FX */}
        {atk && t%2===0 && <>
          <text x="80" y="28" fontSize="13" style={{userSelect:"none"}}>✨</text>
          <text x="62" y="22" fontSize="11" style={{userSelect:"none"}}>💥</text>
          {/* slash arc */}
          <path d="M65,38 Q78,28 88,40" stroke="#FBBF24" strokeWidth="2.5" fill="none"
            strokeLinecap="round" opacity="0.8"/>
        </>}

        {/* paste shot projectile */}
        {pasteShot !== null && (
          <g>
            {[0,1,2].map(i=>(
              <ellipse key={i}
                cx={76 + pasteShot*45 - i*10} cy={60 - i*3}
                rx={8-i*2} ry={5-i*1.5}
                fill={i===0?"#38BDF8":i===1?"#7DD3FC":"#BAE6FD"}
                opacity={0.92-i*0.2}
                style={{filter:i===0?"drop-shadow(0 0 6px #38BDF8)":"none"}}
              />
            ))}
          </g>
        )}
      </g>
    </svg>
  );
}

// ══════════════════════════════════════════
// 4 MONSTERS matching reference image
// ══════════════════════════════════════════
const BOSSES = [
  {
    name:"КАРИЕС", col:"#C8D800",
    taunt:["Я разрушу зубы! 😈","Сдавайся! 🦠","Хи-хи-хи!"],
    render(t, hurt, panic) {
      const sq = hurt ? 0.72 : 1 + Math.sin(t*0.9)*0.07;
      return (
        <g style={{transformOrigin:"50px 58px", transform:`scaleY(${sq}) scaleX(${hurt?1.25:1})`}}>
          {/* puddle */}
          <ellipse cx="50" cy="76" rx="44" ry="12" fill="#8B9600" opacity="0.55"/>
          <ellipse cx="35" cy="78" rx="9"  ry="7"  fill="#8B9600" opacity="0.4"/>
          {/* body */}
          <path d="M14,58 Q10,32 28,16 Q50,5 72,16 Q90,32 86,58 Q82,76 50,78 Q18,76 14,58Z"
            fill="#C8D800"/>
          {/* highlight */}
          <path d="M18,55 Q15,34 32,20 Q50,10 68,20 Q84,34 82,55 Q78,72 50,74 Q22,72 18,55Z"
            fill="#D4E820" opacity="0.7"/>
          {/* bumps on head */}
          <circle cx="24" cy="24" r="8"  fill="#D4E820"/>
          <circle cx="76" cy="28" r="7"  fill="#D4E820"/>
          <circle cx="50" cy="12" r="5.5" fill="#D4E820"/>
          <circle cx="38" cy="16" r="4"  fill="#DCF230"/>
          <circle cx="62" cy="14" r="3.5" fill="#DCF230"/>
          {/* shine */}
          <ellipse cx="33" cy="28" rx="11" ry="7" fill="white" opacity="0.14" transform="rotate(-20,33,28)"/>
          {/* drip */}
          <path d="M40,78 Q41,90 40,97" stroke="#8B9600" strokeWidth="4.5" strokeLinecap="round" fill="none"/>
          <circle cx="40" cy="98" r="5" fill="#8B9600" opacity="0.6"/>
          <path d="M62,77 Q63,86 62,92" stroke="#8B9600" strokeWidth="3" strokeLinecap="round" fill="none"/>
          {/* eyes — wide cartoon */}
          <circle cx="36" cy="44" r={panic?14:10} fill="white"/>
          <circle cx="64" cy="44" r={panic?14:10} fill="white"/>
          <circle cx="36" cy="44" r={panic?7:5.5} fill="#1a1a00"/>
          <circle cx="64" cy="44" r={panic?7:5.5} fill="#1a1a00"/>
          <circle cx="37" cy="43" r="2.2" fill="white"/>
          <circle cx="65" cy="43" r="2.2" fill="white"/>
          {hurt&&<>
            <line x1="28" y1="37" x2="44" y2="51" stroke="#1a1a00" strokeWidth="3.5" strokeLinecap="round"/>
            <line x1="44" y1="37" x2="28" y2="51" stroke="#1a1a00" strokeWidth="3.5" strokeLinecap="round"/>
            <line x1="56" y1="37" x2="72" y2="51" stroke="#1a1a00" strokeWidth="3.5" strokeLinecap="round"/>
            <line x1="72" y1="37" x2="56" y2="51" stroke="#1a1a00" strokeWidth="3.5" strokeLinecap="round"/>
          </>}
          {/* big open mouth */}
          <path d="M26,62 Q38,72 50,70 Q62,72 74,62 Q62,68 50,67 Q38,68 26,62Z" fill="#1a1a00"/>
          {/* teeth in mouth */}
          {[33,42,52,61].map((x,i)=>(
            <rect key={i} x={x-4} y={60} width="8" height={i%2===0?10:13} rx="2.5" fill="white"/>
          ))}
          {/* tongue */}
          <ellipse cx="50" cy="69" rx="12" ry="6" fill="#CC3300" opacity="0.85"/>
        </g>
      );
    }
  },
  {
    name:"НАЛЁТ", col:"#9CA3AF",
    taunt:["Я твёрдый как камень!","Щётка сломается!","ГЫ-ГЫ-ГЫ!"],
    render(t, hurt, panic) {
      return (
        <g>
          {/* shadow */}
          <ellipse cx="50" cy="82" rx="42" ry="11" fill="#374151" opacity="0.4"/>
          {/* stone chunks */}
          <rect x="4"  y="22" width="20" height="17" rx="5" fill="#6B7280" transform="rotate(-18,14,30)"/>
          <rect x="75" y="18" width="22" height="19" rx="5" fill="#6B7280" transform="rotate(15,86,27)"/>
          <rect x="8"  y="54" width="15" height="13" rx="4" fill="#9CA3AF" transform="rotate(-10,15,60)"/>
          <rect x="77" y="57" width="17" height="15" rx="4" fill="#9CA3AF" transform="rotate(12,85,64)"/>
          {/* main body */}
          <path d="M16,62 Q12,36 24,19 Q50,6 76,19 Q88,36 84,62 Q78,80 50,82 Q22,80 16,62Z"
            fill="#9CA3AF"/>
          <path d="M19,60 Q15,37 27,22 Q50,10 73,22 Q85,37 81,60 Q75,76 50,78 Q25,76 19,60Z"
            fill="#B0B7C0"/>
          {/* crack lines */}
          <path d="M40,14 L37,30 L44,44" stroke="#6B7280" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M62,18 L65,36" stroke="#6B7280" strokeWidth="2" fill="none" strokeLinecap="round"/>
          <path d="M22,46 L34,54" stroke="#6B7280" strokeWidth="2" fill="none" strokeLinecap="round"/>
          <path d="M68,50 L76,44" stroke="#6B7280" strokeWidth="2" fill="none" strokeLinecap="round"/>
          {/* green moss */}
          <ellipse cx="28" cy="56" rx="9"  ry="5.5" fill="#4B7C0A" opacity="0.65"/>
          <ellipse cx="72" cy="50" rx="8"  ry="5"   fill="#4B7C0A" opacity="0.5"/>
          <ellipse cx="50" cy="72" rx="10" ry="4"   fill="#4B7C0A" opacity="0.45"/>
          {/* shine */}
          <ellipse cx="33" cy="28" rx="12" ry="7" fill="white" opacity="0.12" transform="rotate(-18,33,28)"/>
          {/* angry eyes with heavy brows */}
          <path d="M24,38 L46,38 L46,54 Q35,62 24,54Z" fill="#78350F"/>
          <path d="M54,38 L76,38 L76,54 Q65,62 54,54Z" fill="#78350F"/>
          <circle cx="35" cy="46" r={panic?9:6.5} fill="#F97316"/>
          <circle cx="65" cy="46" r={panic?9:6.5} fill="#F97316"/>
          <circle cx="35" cy="46" r="3.5" fill="#1a0000"/>
          <circle cx="65" cy="46" r="3.5" fill="#1a0000"/>
          <line x1="24" y1="34" x2="46" y2="38" stroke="#1a0000" strokeWidth="4.5" strokeLinecap="round"/>
          <line x1="54" y1="38" x2="76" y2="34" stroke="#1a0000" strokeWidth="4.5" strokeLinecap="round"/>
          {hurt&&<>
            <line x1="26" y1="38" x2="44" y2="54" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
            <line x1="44" y1="38" x2="26" y2="54" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
            <line x1="56" y1="38" x2="74" y2="54" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
            <line x1="74" y1="38" x2="56" y2="54" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
          </>}
          {/* mouth */}
          <path d="M24,66 Q50,82 76,66 Q62,74 50,72 Q38,74 24,66Z" fill="#1a0000"/>
          {[31,40,50,60,69].map((x,i)=>(
            <rect key={i} x={x-4} y={64} width="8" height={i%2===0?11:14} rx="2.5" fill="white"/>
          ))}
        </g>
      );
    }
  },
  {
    name:"ТАРТАР", col:"#7C3AED",
    taunt:["Я прилип навсегда!","Буду тут вечно!","Сдавайся! 💜"],
    render(t, hurt, panic) {
      const bob = Math.sin(t*1.1)*3.5;
      return (
        <g transform={`translate(0,${bob})`}>
          <ellipse cx="50" cy="84" rx="38" ry="10" fill="#4C1D95" opacity="0.45"/>
          {/* spikes around body */}
          {[[-6,50,"-22"],[6,20,"-8"],[28,9,"4"],[50,6,"0"],[72,9,"-4"],[94,20,"8"],[106,50,"22"]].map(([x,y,r],i)=>(
            <polygon key={i} points={`${x},${y} ${x-7},${y+16} ${x+7},${y+16}`}
              fill="#4C1D95" transform={`rotate(${r},${x},${y+8})`}/>
          ))}
          {/* body */}
          <path d="M14,62 Q12,36 26,20 Q50,8 74,20 Q88,36 86,62 Q82,78 50,80 Q18,78 14,62Z"
            fill="#7C3AED"/>
          <path d="M17,60 Q15,37 28,23 Q50,12 72,23 Q85,37 83,60 Q79,74 50,76 Q21,74 17,60Z"
            fill="#8B5CF6"/>
          {/* shine */}
          <ellipse cx="32" cy="28" rx="12" ry="8" fill="white" opacity="0.14" transform="rotate(-22,32,28)"/>
          {/* drool */}
          <path d="M38,80 Q39,92 38,100" stroke="#FBBF24" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.9"/>
          <circle cx="38" cy="101" r="4" fill="#FBBF24" opacity="0.75"/>
          <path d="M58,78 Q59,87 58,93" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.65"/>
          {/* eyes */}
          <circle cx="36" cy="43" r={panic?13:10} fill="#1a0000"/>
          <circle cx="64" cy="43" r={panic?13:10} fill="#1a0000"/>
          <circle cx="36" cy="43" r={panic?8:6}   fill="#FBBF24"/>
          <circle cx="64" cy="43" r={panic?8:6}   fill="#FBBF24"/>
          <circle cx="37" cy="42" r="2.5" fill="#1a0000"/>
          <circle cx="65" cy="42" r="2.5" fill="#1a0000"/>
          {hurt&&<>
            <line x1="28" y1="36" x2="44" y2="50" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
            <line x1="44" y1="36" x2="28" y2="50" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
            <line x1="56" y1="36" x2="72" y2="50" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
            <line x1="72" y1="36" x2="56" y2="50" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
          </>}
          {/* open mouth */}
          <path d="M25,62 Q50,78 75,62 Q62,70 50,68 Q38,70 25,62Z" fill="#1a0000"/>
          {[31,40,50,60,69].map((x,i)=>(
            <rect key={i} x={x-4} y={60} width="8" height={i%2===0?12:15} rx="2.5" fill="white"/>
          ))}
          {/* tongue */}
          <ellipse cx="50" cy="68" rx="13" ry="6" fill="#CC0044" opacity="0.9"/>
        </g>
      );
    }
  },
  {
    name:"ГИНГИВИТ", col:"#22C55E",
    taunt:["Я заражу всё! 🤢","АРРРГ!","Зелёная смерть!"],
    render(t, hurt, panic) {
      const spit = Math.sin(t*1.8) > 0.55;
      return (
        <g>
          <ellipse cx="50" cy="82" rx="40" ry="11" fill="#14532D" opacity="0.38"/>
          {/* hairy/spiky body */}
          {Array.from({length:10}).map((_,i)=>{
            const a=(i/10)*Math.PI*2;
            const [x1,y1]=[50+40*Math.cos(a),50+36*Math.sin(a)];
            const [x2,y2]=[50+55*Math.cos(a),50+52*Math.sin(a)];
            const [xa,ya]=[50+40*Math.cos(a-0.18),50+36*Math.sin(a-0.18)];
            const [xb,yb]=[50+40*Math.cos(a+0.18),50+36*Math.sin(a+0.18)];
            return <polygon key={i} points={`${xa},${ya} ${x2},${y2} ${xb},${yb}`}
              fill="#16A34A" opacity="0.8"/>;
          })}
          <ellipse cx="50" cy="50" rx="40" ry="36" fill="#22C55E"/>
          <ellipse cx="50" cy="48" rx="37" ry="33" fill="#4ADE80"/>
          {/* texture */}
          {[[26,32],[68,28],[20,52],[80,56],[44,20],[58,18],[32,60],[70,62]].map(([x,y],i)=>(
            <circle key={i} cx={x} cy={y} r={4.5-i*0.2} fill="#16A34A" opacity="0.5"/>
          ))}
          {/* shine */}
          <ellipse cx="32" cy="28" rx="12" ry="7" fill="white" opacity="0.15" transform="rotate(-20,32,28)"/>
          {/* drip */}
          <path d="M30,84 Q31,96 30,104" stroke="#15803D" strokeWidth="4.5" strokeLinecap="round" fill="none"/>
          <circle cx="30" cy="105" r="5" fill="#15803D" opacity="0.7"/>
          {/* angry eyes */}
          <circle cx="36" cy="43" r={panic?14:11} fill="#1a1a00"/>
          <circle cx="64" cy="43" r={panic?14:11} fill="#1a1a00"/>
          <circle cx="36" cy="43" r={panic?9:7}   fill="#FBBF24"/>
          <circle cx="64" cy="43" r={panic?9:7}   fill="#FBBF24"/>
          <circle cx="37" cy="42" r="2.8" fill="#1a1a00"/>
          <circle cx="65" cy="42" r="2.8" fill="#1a1a00"/>
          <line x1="25" y1="32" x2="46" y2="37" stroke="#14532D" strokeWidth="4.5" strokeLinecap="round"/>
          <line x1="54" y1="37" x2="75" y2="32" stroke="#14532D" strokeWidth="4.5" strokeLinecap="round"/>
          {hurt&&<>
            <line x1="27" y1="36" x2="45" y2="50" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
            <line x1="45" y1="36" x2="27" y2="50" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
            <line x1="55" y1="36" x2="73" y2="50" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
            <line x1="73" y1="36" x2="55" y2="50" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
          </>}
          {/* BIG mouth */}
          <path d="M20,62 Q50,82 80,62 Q66,72 50,70 Q34,72 20,62Z" fill="#1a1a00"/>
          {[27,37,50,63,73].map((x,i)=>(
            <rect key={i} x={x-4.5} y={60} width="9" height={i%2===0?12:16} rx="2.5" fill="white"/>
          ))}
          {/* spit stream */}
          {spit && <>
            <ellipse cx="4"  cy="55" rx="14" ry="7"  fill="#86EFAC" opacity="0.95" style={{filter:"drop-shadow(0 0 6px #22C55E)"}}/>
            <ellipse cx="-14" cy="54" rx="10" ry="5.5" fill="#86EFAC" opacity="0.75"/>
            <ellipse cx="-28" cy="53" rx="6"  ry="3.5" fill="#86EFAC" opacity="0.55"/>
          </>}
        </g>
      );
    }
  },
];

function BossChar({ bossIdx, hp, maxHp, hurt, panic }) {
  const [t, setT] = useState(0);
  useEffect(() => { const id = setInterval(() => setT(x=>x+1), 105); return () => clearInterval(id); }, []);
  const boss = BOSSES[bossIdx];
  const wob  = Math.sin(t*(panic?2.1:0.75))*(hurt?16:panic?7:2.5);
  const sy   = hurt ? 0.72 : 1 + Math.sin(t*0.85)*0.065;
  const sx   = hurt ? 1.24 : 1 - Math.sin(t*0.85)*0.045;
  return (
    <svg width="92" height="108" viewBox="-12 -12 124 124"
      style={{
        filter: hurt
          ? `drop-shadow(0 0 30px ${boss.col}) brightness(2.3)`
          : `drop-shadow(0 6px 20px ${boss.col}aa)`,
        transform: `rotate(${wob}deg) scaleX(${sx}) scaleY(${sy})`,
        transition: hurt ? "none" : "transform 0.17s ease",
      }}>
      {boss.render(t, hurt, panic)}
    </svg>
  );
}

// ══════════════════════════════════════════
// UI ATOMS
// ══════════════════════════════════════════
const HPBar = ({ v, m, col }) => (
  <div style={{width:"100%",height:11,background:"rgba(0,0,0,0.45)",borderRadius:99,overflow:"hidden",border:"1px solid rgba(255,255,255,0.07)"}}>
    <div style={{height:"100%",borderRadius:99,width:`${Math.max(0,v/m)*100}%`,
      background:`linear-gradient(90deg,${col}66,${col})`,transition:"width 0.28s",boxShadow:`0 0 8px ${col}`}}/>
  </div>
);

const PARTICLE_STYLE = {
  dmg:    { color:"#FBBF24", size:26 },
  crit:   { color:"#EF4444", size:22 },
  miss:   { color:"#94A3B8", size:16 },
  combo:  { color:"#F97316", size:18 },
  star:   { color:"#FDE68A", size:18 },
  streak: { color:"#A78BFA", size:18 },
  hero:   { color:"#F87171", size:16 },
  rage:   { color:"#EF4444", size:20 },
  lvl:    { color:"#34D399", size:20 },
  bit:    { color:"white",   size:18 },
};
const Particle = ({ item }) => {
  const s = PARTICLE_STYLE[item.kind] || { color:"white", size:18 };
  return (
    <div style={{
      position:"absolute",left:item.x,top:item.y,transform:"translateX(-50%)",
      pointerEvents:"none",zIndex:50,animation:`pf ${item.dur||0.9}s ease forwards`,
      color:s.color,fontSize:s.size,
      fontWeight:900,fontFamily:"monospace",textShadow:"0 2px 10px rgba(0,0,0,0.95)",
      userSelect:"none",whiteSpace:"nowrap",
    }}>{item.text}</div>
  );
};

const Flash = ({ color }) => (
  <div style={{
    position:"absolute",inset:0,borderRadius:22,zIndex:40,pointerEvents:"none",
    background:`radial-gradient(circle,${color}77 0%,transparent 70%)`,
    animation:"flashAnim 0.55s ease forwards",
    display:"flex",alignItems:"center",justifyContent:"center",
  }}>
    <span style={{fontSize:60,animation:"flashAnim 0.55s ease forwards",userSelect:"none"}}>💥</span>
  </div>
);

function Victory({ coins, onRestart, onHub }) {
  return (
    <div style={{minHeight:"100vh",background:"radial-gradient(ellipse at 50% 40%,#0F3460,#0B1120)",
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      padding:24,fontFamily:"sans-serif",textAlign:"center",position:"relative",overflow:"hidden"}}>
      <style>{`
        @keyframes vp{from{transform:scale(0) rotate(-12deg);opacity:0}to{transform:scale(1);opacity:1}}
        @keyframes vr{0%{transform:translateY(-30px) rotate(0);opacity:1}100%{transform:translateY(120px) rotate(400deg);opacity:0}}
        @keyframes vg{0%,100%{box-shadow:0 0 18px #F59E0B44}50%{box-shadow:0 0 55px #F59E0Baa}}
      `}</style>
      <div style={{position:"fixed",top:0,left:0,right:0,height:"55vh",pointerEvents:"none",overflow:"hidden"}}>
        {Array.from({length:22}).map((_,i)=>(
          <span key={i} style={{position:"absolute",left:`${4+i*4.4}%`,top:`-${8+(i%4)*14}px`,
            fontSize:14+rand(0,8),animation:`vr ${1+i*0.1}s ease ${i*0.07}s infinite`,userSelect:"none"}}>🪙</span>
        ))}
      </div>
      <div style={{fontSize:90,animation:"vp 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards",marginBottom:6}}>🏆</div>
      <h1 style={{margin:"0 0 6px",fontSize:36,fontWeight:900,
        background:"linear-gradient(135deg,#F59E0B,#FDE68A)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
        ПОБЕДА! 🎉
      </h1>
      <p style={{color:"#94A3B8",fontSize:14,marginBottom:28}}>Все микробы уничтожены! Зубы сверкают! ✨</p>
      <div style={{background:"linear-gradient(135deg,rgba(245,158,11,0.2),rgba(251,191,36,0.08))",
        border:"2px solid rgba(245,158,11,0.5)",borderRadius:24,padding:"20px 44px",marginBottom:28,animation:"vg 2s ease infinite"}}>
        <p style={{color:"#F59E0B",fontSize:50,fontWeight:900,margin:0,fontFamily:"monospace"}}>+{coins}</p>
        <p style={{color:"#94A3B8",fontSize:13,margin:"4px 0 0"}}>🪙 DentCoins заработано</p>
      </div>
      <button onClick={onRestart} style={{width:"100%",maxWidth:320,padding:"18px",borderRadius:20,
        border:"none",cursor:"pointer",background:"linear-gradient(135deg,#1D4ED8,#6366F1)",
        color:"white",fontSize:17,fontWeight:800,boxShadow:"0 8px 32px rgba(29,78,216,0.5)"}}>
        🔄 Играть снова
      </button>
      {onHub && (
        <button onClick={onHub} style={{width:"100%",maxWidth:320,padding:"14px",borderRadius:20,
          marginTop:10,border:"1px solid rgba(255,255,255,0.15)",cursor:"pointer",
          background:"rgba(255,255,255,0.06)",
          color:"#94A3B8",fontSize:15,fontWeight:700}}>
          🏠 В главное меню
        </button>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// GAME TIMER (core brushing session)
// ══════════════════════════════════════════
function GameTimer({ selectedHero, currentMission, onMissionComplete, onBack }) {
  const [phase,       setPhase]       = useState("ready");
  const [elapsed,     setElapsed]     = useState(0);
  const [bossHP,      setBossHP]      = useState(100);
  const [hurt,        setHurt]        = useState(false);
  const [particles,   setParticles]   = useState([]);
  const [whiteness,   setWhiteness]   = useState([0.06,0.06,0.06,0.06]);
  const [doneZones,   setDoneZones]   = useState([]);
  const [coins,       setCoins]       = useState(0);
  const [shake,       setShake]       = useState(false);
  const [flash,       setFlash]       = useState(false);
  const [bossEnter,   setBossEnter]   = useState(false);
  const [attackSwing, setAttackSwing] = useState(false);
  const [pasteShot,   setPasteShot]   = useState(null);
  const [tauntIdx,    setTauntIdx]    = useState(0);
  const [brushX,      setBrushX]      = useState(40);
  const [brushJaw,    setBrushJaw]    = useState("top");
  // NEW gamification state
  const [combo,       setCombo]       = useState(0);
  const [streak,      setStreak]      = useState(0);   // zones done in a row
  const [rageMode,    setRageMode]    = useState(false); // boss enrages <25%
  const [shield,      setShield]      = useState(false); // boss blocks hit
  const [heroHP,      setHeroHP]      = useState(selectedHero?.maxHP ?? 100);
  const [critAnim,    setCritAnim]    = useState(false);
  const [xp,          setXp]          = useState(0);
  const [level,       setLevel]       = useState(1);

  const ivRef  = useRef(null);
  const pidRef = useRef(0);

  const zone     = Math.min(Math.floor(elapsed/ZONE_T),3);
  const zoneP    = (elapsed%ZONE_T)/ZONE_T;
  const totalP   = elapsed/TOTAL;
  const timeLeft = TOTAL-elapsed;
  const bossType = currentMission?.bossIdx ?? zone;
  const boss     = BOSSES[bossType];
  const zColor   = ZONES[zone].color;
  const panic    = bossHP < 30;
  const mm       = String(Math.floor(timeLeft/60)).padStart(2,"0");
  const ss       = String(timeLeft%60).padStart(2,"0");

  const spawnP = useCallback((kind,text,x,y,dur=0.9) => {
    const id = ++pidRef.current;
    setParticles(p=>[...p.slice(-10),{id,kind,text,x,y,dur}]);
    setTimeout(()=>setParticles(p=>p.filter(x=>x.id!==id)),dur*1000+100);
  },[]);

  const doZoneComplete = useCallback((zi) => {
    setFlash(true); setShake(true);
    ["💥","✨","⭐","💫","🌟"].forEach((e,i)=>{
      setTimeout(()=>spawnP("bit",e,rand(25,75)+"%",rand(18,55)+"%",0.65),i*55);
    });
    setTimeout(()=>{ setFlash(false); setShake(false); }, 560);
    setTimeout(()=>{ setBossEnter(true); setTimeout(()=>setBossEnter(false),650); }, 660);
  },[spawnP]);

  // brush sweep animation
  useEffect(() => {
    if (phase !== "running") return;
    let x = 30, dir = 1;
    const isLeft = zone === 0 || zone === 2;
    const minX = isLeft ? 15 : 150;
    const maxX = isLeft ? 140 : 268;
    setBrushJaw(zone < 2 ? "top" : "bot");
    const id = setInterval(() => {
      x += dir * 5;
      if (x >= maxX) { x = maxX; dir = -1; }
      if (x <= minX) { x = minX; dir = 1; }
      setBrushX(x);
    }, 55);
    return () => clearInterval(id);
  }, [phase, zone]);

  // main game tick
  useEffect(() => {
    if (phase !== "running") return;
    ivRef.current = setInterval(() => {
      setElapsed(e => {
        const n = e+1; if (n > TOTAL) return e;
        const pz = Math.floor(e/ZONE_T), nz = Math.floor(n/ZONE_T);
        if (nz > pz && pz < 4) {
          setDoneZones(d=>[...d,pz]);
          doZoneComplete(pz);
          setBossHP(100);
          setRageMode(false);
          setCombo(0);
          setStreak(s => {
            const ns = s + 1;
            if (ns >= 2) spawnP("streak", `🔥 СЕРИЯ x${ns}!`, "50%", "22%", 1.3);
            const bonus = ns * 15;
            setCoins(c => c + bonus);
            spawnP("star", `🪙+${bonus} БОНУС`, "50%", "38%", 1.2);
            return ns;
          });
          if (navigator.vibrate) navigator.vibrate([80,40,80]);
        }
        const zi = Math.min(Math.floor(n/ZONE_T),3);
        const zp = (n%ZONE_T)/ZONE_T;
        setWhiteness(prev=>{ const u=[...prev]; u[zi]=Math.min(1,zp*1.2); return u; });
        // ── attack every 2s with COMBO + CRIT + SHIELD logic ──
        if (n%2===0) {
          const newCombo = Math.min(combo + 1, 10);
          setCombo(newCombo);

          // boss may SHIELD (20% chance, only if not raging)
          const isShield = !rageMode && Math.random() < 0.20;
          setShield(isShield);
          setTimeout(() => setShield(false), 400);

          if (isShield) {
            // blocked! spawn MISS
            spawnP("miss", "🛡 БЛОК!", rand(55,78)+"%", rand(8,22)+"%", 0.9);
          } else {
            // base dmg + combo multiplier
            const baseDmg = rand(4,11);
            const comboBonus = newCombo >= 5 ? Math.floor(newCombo * 1.5) : 0;
            // CRIT: 15% chance, x2.5 dmg
            const isCrit = Math.random() < 0.15 + (rageMode ? 0.1 : 0);
            const dmg = Math.round((baseDmg + comboBonus) * (isCrit ? 2.5 : 1));

            setBossHP(h => Math.max(0, h - dmg));
            setHurt(true); setTimeout(() => setHurt(false), 165);
            setAttackSwing(true); setTimeout(() => setAttackSwing(false), 340);

            if (isCrit) {
              setCritAnim(true); setTimeout(() => setCritAnim(false), 600);
              spawnP("crit", `💥КРИТ! -${dmg}`, rand(52,78)+"%", rand(5,20)+"%", 1.2);
              if (navigator.vibrate) navigator.vibrate([60,20,60,20,80]);
              setShake(true); setTimeout(() => setShake(false), 350);
            } else {
              if (dmg >= 11) { setShake(true); setTimeout(() => setShake(false), 250); }
              spawnP("dmg", `-${dmg}`, rand(60,82)+"%", rand(8,28)+"%");
            }

            // combo announcement
            if (newCombo === 3)  spawnP("combo","🔥 x3 КОМБО!",  "50%","20%",1.0);
            if (newCombo === 5)  spawnP("combo","⚡ x5 ОГОНЬ!",  "50%","18%",1.1);
            if (newCombo === 10) spawnP("combo","🌟 x10 МАКС!!","50%","15%",1.3);

            // XP per hit
            const xpGain = isCrit ? 15 : 8 + comboBonus;
            setXp(prev => {
              const next = prev + xpGain;
              const needed = level * 60;
              if (next >= needed) {
                setLevel(l => l + 1);
                spawnP("lvl","⬆️ УРОВЕНЬ!", "50%","30%",1.4);
                setCoins(c => c + 20); // bonus coins on level up
                return next - needed;
              }
              return next;
            });
          }
        }

        // ── BOSS attacks hero every 7s (rage: every 4s) ──
        const bossAttackInterval = rageMode ? 4 : 7;
        if (n % bossAttackInterval === 0) {
          const bossDmg = rageMode ? rand(12,20) : rand(5,12);
          setHeroHP(h => Math.max(0, h - bossDmg));
          spawnP("hero", `👊-${bossDmg}`, rand(10,32)+"%", rand(8,25)+"%", 0.9);
        }

        // ── RAGE MODE when boss HP < 25 ──
        setBossHP(hp => {
          if (hp < 25 && !rageMode) {
            setRageMode(true);
            spawnP("rage","😡 ЯРОСТЬ!","50%","25%",1.5);
          }
          return hp;
        });

        // ── paste shot every 5s ──
        if (n%5===0) {
          let prog = 0;
          const sid = setInterval(()=>{
            prog += 0.14; setPasteShot(prog);
            if (prog >= 1) { clearInterval(sid); setPasteShot(null); }
          },38);
        }

        // ── COMBO reset if no attack (3s gap = missed) → only reset on pause/zone end ──

        // ── coins every 9s ──
        if (n%9===0)  { const c=rand(6,14) + (combo >= 5 ? 8 : 0); setCoins(x=>x+c); spawnP("star","🪙+"+c,rand(32,68)+"%",rand(36,56)+"%",1.1); }
        if (n%22===0) setTauntIdx(x=>(x+1)%3);
        if (n>=TOTAL) {
          clearInterval(ivRef.current);
          setWhiteness([1,1,1,1]);
          setCoins(x=>x+55);
          setTimeout(()=>setPhase("victory"),500);
        }
        return n;
      });
    },1000);
    return () => clearInterval(ivRef.current);
  },[phase, doZoneComplete, spawnP, combo, rageMode, level, xp]);

  const toggle = () => setPhase(p => p==="running"?"paused":"running");
  const restart = () => {
    setPhase("ready");setElapsed(0);setBossHP(100);setHurt(false);
    setParticles([]);setWhiteness([0.06,0.06,0.06,0.06]);setDoneZones([]);
    setCoins(0);setShake(false);setFlash(false);setAttackSwing(false);
    setPasteShot(null);setTauntIdx(0);setBrushX(40);
    setCombo(0);setStreak(0);setRageMode(false);setShield(false);
    setHeroHP(selectedHero?.maxHP ?? 100);setCritAnim(false);setXp(0);setLevel(1);
  };

  const handleVictory = () => {
    if (onMissionComplete) {
      onMissionComplete({ coins, level, xp, heroHP, heroId: selectedHero?.id });
    }
  };
  if (phase==="victory") return <Victory coins={coins} onRestart={restart} onHub={handleVictory}/>;

  return (
    <div style={{
      minHeight:"100vh", background:"#0B1120", fontFamily:"sans-serif",
      display:"flex", flexDirection:"column", alignItems:"center",
      padding:"18px 14px 72px",
      position:"relative", overflow:"hidden",
      transform: shake ? `translate(${rand(-4,4)}px,${rand(-3,3)}px)` : "none",
      transition: shake ? "none" : "transform 0.1s",
    }}>
      <style>{`
        @keyframes pf{0%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}100%{opacity:0;transform:translateX(-50%) translateY(-72px) scale(0.45)}}
        @keyframes flashAnim{0%{opacity:1;transform:scale(0.5)}50%{opacity:.85;transform:scale(1.5)}100%{opacity:0;transform:scale(2.3)}}
        @keyframes bossIn{from{opacity:0;transform:translateX(85px) scale(0.35)}to{opacity:1;transform:translateX(0) scale(1)}}
        @keyframes bgbeat{0%,100%{opacity:0.12}50%{opacity:0.22}}
        @keyframes ragePulse{from{box-shadow:0 0 6px rgba(239,68,68,0.4)}to{box-shadow:0 0 18px rgba(239,68,68,0.9)}}
        @keyframes shieldPop{0%{opacity:0;transform:scale(0.5)}50%{opacity:1;transform:scale(1.3)}100%{opacity:0;transform:scale(1)}}
        @keyframes critFlash{0%{opacity:0;transform:scale(0.6) rotate(-8deg)}40%{opacity:1;transform:scale(1.4) rotate(4deg)}100%{opacity:0;transform:scale(1) rotate(0)}}
        @keyframes lvlUp{0%{opacity:0;transform:translateY(10px) scale(0.8)}50%{opacity:1;transform:translateY(-8px) scale(1.2)}100%{opacity:0;transform:translateY(-24px) scale(0.9)}}
        *{box-sizing:border-box}
      `}</style>

      {/* ambient bg glow */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",
        background:`radial-gradient(ellipse at 50% 30%,${zColor} 0%,transparent 62%)`,
        opacity:0.13,transition:"background 1.1s",animation:"bgbeat 3.5s ease infinite"}}/>

      {/* ── HEADER ── */}
      <div style={{width:"100%",maxWidth:440,display:"flex",justifyContent:"space-between",
        alignItems:"center",marginBottom:10,zIndex:1}}>
        <div>
          <p style={{color:"#475569",fontSize:9,margin:0,fontWeight:700,textTransform:"uppercase",letterSpacing:1.2}}>{selectedHero?.name ?? "РЫЦАРЬ"}</p>
          <p style={{color:"white",fontSize:40,fontWeight:900,margin:0,fontFamily:"monospace",lineHeight:1,
            textShadow:`0 0 24px ${zColor}`}}>{mm}:{ss}</p>
        </div>
        <div style={{textAlign:"center"}}>
          <p style={{color:"#475569",fontSize:9,margin:0,fontWeight:700,textTransform:"uppercase",letterSpacing:1.2}}>ЗОНА {zone+1}/4</p>
          <p style={{color:zColor,fontSize:14,fontWeight:800,margin:"3px 0 0"}}>{ZONES[zone].label}</p>
        </div>
        <button onClick={onBack} style={{background:"none",border:"1px solid rgba(255,255,255,0.1)",
          borderRadius:10,padding:"4px 10px",color:"#475569",cursor:"pointer",fontSize:12,marginBottom:4}}>← Назад</button>
        <div style={{textAlign:"right"}}>
          <p style={{color:"#475569",fontSize:9,margin:0,fontWeight:700,textTransform:"uppercase",letterSpacing:1.2}}>МОНЕТЫ</p>
          <p style={{color:"#F59E0B",fontSize:22,fontWeight:900,margin:"3px 0 0",fontFamily:"monospace"}}>🪙{coins}</p>
        </div>
      </div>

      {/* total progress */}
      <div style={{width:"100%",maxWidth:440,marginBottom:12,zIndex:1}}>
        <div style={{background:"rgba(255,255,255,0.07)",borderRadius:99,height:7,overflow:"hidden"}}>
          <div style={{height:"100%",borderRadius:99,width:`${totalP*100}%`,
            background:"linear-gradient(90deg,#06B6D4,#8B5CF6,#F43F5E,#10B981)",
            transition:"width 1s linear",boxShadow:"0 0 10px rgba(139,92,246,0.5)"}}/>
        </div>
      </div>

      {/* ── BATTLE ARENA ── */}
      <div style={{
        width:"100%", maxWidth:440,
        background:"linear-gradient(180deg,#0D1B2E 0%,#0A1628 60%,#0D1B2E 100%)",
        border:`1px solid ${zColor}33`,
        borderRadius:24, marginBottom:10,
        position:"relative", zIndex:1, overflow:"hidden",
        boxShadow:`0 0 28px ${zColor}22, inset 0 1px 0 rgba(255,255,255,0.05)`,
        transition:"border-color 0.8s, box-shadow 0.8s",
      }}>
        {flash && <Flash color={zColor}/>}
        {particles.map(p=><Particle key={p.id} item={p}/>)}

        {/* arena bg atmosphere */}
        <div style={{position:"absolute",inset:0,pointerEvents:"none",
          background:`radial-gradient(ellipse at 50% 0%,${zColor}18 0%,transparent 65%)`,
          transition:"background 1s"}}/>

        {/* TOP: taunt / rage */}
        <div style={{padding:"8px 14px 4px",display:"flex",alignItems:"center",justifyContent:"center",minHeight:30}}>
          {rageMode ? (
            <div style={{display:"flex",alignItems:"center",gap:5,
              background:"rgba(239,68,68,0.18)",border:"1px solid rgba(239,68,68,0.55)",
              borderRadius:20,padding:"3px 12px",animation:"ragePulse 0.55s ease infinite alternate"}}>
              <span style={{fontSize:11}}>&#128545;</span>
              <span style={{color:"#EF4444",fontSize:9,fontWeight:900,letterSpacing:1.5}}>&#1056;&#1045;&#1046;&#1048;&#1052; &#1071;&#1056;&#1054;&#1057;&#1058;&#1048;!</span>
            </div>
          ) : (
            <div style={{background:`${boss.col}16`,border:`1px solid ${boss.col}30`,
              borderRadius:"16px 16px 16px 4px",padding:"3px 12px",maxWidth:"85%"}}>
              <span style={{color:`${boss.col}ee`,fontSize:9,fontStyle:"italic",fontWeight:600}}>
                {boss.taunt[tauntIdx%boss.taunt.length]}
              </span>
            </div>
          )}
        </div>

        {/* MAIN FIGHT ROW */}
        <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",
          padding:"0 10px 8px",gap:4}}>

          {/* LEFT: HERO */}
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,flexShrink:0,width:96}}>
            <KnightHero running={phase==="running"} attackSwing={attackSwing} pasteShot={pasteShot}/>
            <div style={{width:"100%",background:"rgba(0,0,0,0.4)",
              border:"1px solid rgba(34,197,94,0.2)",borderRadius:10,padding:"5px 7px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                <span style={{color:"#4ADE80",fontSize:8,fontWeight:800}}>&#9876;&#65039; &#1056;&#1067;&#1062;&#1040;&#1056;&#1068;</span>
                <span style={{
                  color:heroHP>60?"#4ADE80":heroHP>30?"#FCD34D":"#EF4444",
                  fontSize:8,fontWeight:700,
                }}>&#10084;&#65039;{heroHP}</span>
              </div>
              <HPBar v={heroHP} m={100} col={heroHP>60?"#22C55E":heroHP>30?"#EAB308":"#EF4444"}/>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4,marginBottom:1}}>
                <span style={{color:"#F59E0B",fontSize:7,fontWeight:800}}>&#11088; LV{level}</span>
                <span style={{color:"#475569",fontSize:6.5}}>{xp}/{level*60}xp</span>
              </div>
              <div style={{background:"rgba(255,255,255,0.07)",borderRadius:99,height:3,overflow:"hidden"}}>
                <div style={{height:"100%",borderRadius:99,
                  width:`${Math.min(100,(xp/(level*60))*100)}%`,
                  background:"linear-gradient(90deg,#D97706,#FDE68A)",
                  transition:"width 0.35s ease"}}/>
              </div>
            </div>
          </div>

          {/* CENTER: VS + COMBO + FX */}
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",
            gap:4,minWidth:0,padding:"0 2px"}}>
            <div style={{background:"linear-gradient(135deg,#1E293B,#0F172A)",
              border:"2px solid rgba(255,255,255,0.1)",borderRadius:12,padding:"2px 10px",
              boxShadow:"0 2px 12px rgba(0,0,0,0.5)"}}>
              <span style={{color:"white",fontSize:13,fontWeight:900,fontFamily:"monospace",
                letterSpacing:2,textShadow:"0 0 12px rgba(255,255,255,0.4)"}}>VS</span>
            </div>

            <div style={{width:"100%"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                <span style={{fontSize:7,fontWeight:800,letterSpacing:0.5,transition:"color 0.3s",
                  color:combo>=8?"#F59E0B":combo>=5?"#F97316":combo>=3?"#FB923C":"#475569"}}>
                  {combo>=8?"&#127775;&#1052;&#1040;&#1050;&#1057;":combo>=5?"&#9889; x"+combo:combo>=3?"&#128293; x"+combo:"&#1050;&#1054;&#1052;&#1041;&#1054;"}
                </span>
                <span style={{color:"#334155",fontSize:6.5}}>{combo}/10</span>
              </div>
              <div style={{background:"rgba(255,255,255,0.06)",borderRadius:99,height:5,overflow:"hidden",
                border:"1px solid rgba(255,255,255,0.04)"}}>
                <div style={{height:"100%",borderRadius:99,width:`${combo*10}%`,
                  background:combo>=8?"linear-gradient(90deg,#D97706,#FDE68A)":
                    combo>=5?"linear-gradient(90deg,#EA580C,#FB923C)":
                    "linear-gradient(90deg,#0284C7,#38BDF8)",
                  transition:"width 0.18s ease, background 0.35s",
                  boxShadow:combo>=5?`0 0 9px ${combo>=8?"#F59E0B":"#F97316"}`:"none"}}/>
              </div>
            </div>

            <div style={{position:"relative",height:18,width:"100%",display:"flex",
              alignItems:"center",justifyContent:"center"}}>
              {shield && (
                <span style={{position:"absolute",color:"#94A3B8",fontSize:11,fontWeight:800,
                  animation:"shieldPop 0.45s ease forwards",whiteSpace:"nowrap"}}>&#128737;&#65039; &#1041;&#1051;&#1054;&#1050;!</span>
              )}
              {critAnim && !shield && (
                <span style={{position:"absolute",color:"#EF4444",fontSize:13,fontWeight:900,
                  animation:"critFlash 0.6s ease forwards",whiteSpace:"nowrap",
                  textShadow:"0 0 14px #EF4444"}}>&#128165; &#1050;&#1056;&#1048;&#1058;!</span>
              )}
            </div>

            {pasteShot !== null && (
              <div style={{position:"absolute",
                left:`${10 + pasteShot*44}%`,top:"42%",
                pointerEvents:"none",zIndex:20,transform:"translateY(-50%)"}}>
                <svg width="32" height="16" viewBox="0 0 32 16">
                  <ellipse cx="26" cy="8" rx="7" ry="5" fill="#38BDF8"
                    style={{filter:"drop-shadow(0 0 5px #38BDF8)"}}/>
                  <ellipse cx="18" cy="8" rx="5" ry="3.5" fill="#7DD3FC" opacity="0.75"/>
                  <ellipse cx="11" cy="8" rx="3.5" ry="2.5" fill="#BAE6FD" opacity="0.55"/>
                  <ellipse cx="5"  cy="8" rx="2.5" ry="1.8" fill="#E0F2FE" opacity="0.35"/>
                </svg>
              </div>
            )}
          </div>

          {/* RIGHT: BOSS */}
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,
            flexShrink:0,width:96,
            animation:bossEnter?"bossIn 0.5s cubic-bezier(0.34,1.56,0.64,1)":"none"}}>
            <div style={{position:"relative"}}>
              <BossChar bossIdx={zone} hp={bossHP} maxHp={100} hurt={hurt} panic={panic}/>
              {shield && (
                <div style={{position:"absolute",inset:-4,borderRadius:"50%",
                  border:"3px solid rgba(148,163,184,0.8)",
                  boxShadow:"inset 0 0 14px rgba(148,163,184,0.4)",
                  animation:"shieldPop 0.45s ease forwards",pointerEvents:"none"}}/>
              )}
            </div>
            <div style={{width:"100%",background:"rgba(0,0,0,0.4)",
              border:`1px solid ${boss.col}28`,borderRadius:10,padding:"5px 7px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                <span style={{color:boss.col,fontSize:8,fontWeight:800}}>
                  {rageMode?"&#128545;":"&#128128;"} {boss.name}
                </span>
                <span style={{color:boss.col,fontSize:8,fontWeight:700}}>{bossHP}%</span>
              </div>
              <HPBar v={bossHP} m={100} col={bossHP<25?"#EF4444":bossHP<50?"#F97316":boss.col}/>
              {rageMode && (
                <div style={{marginTop:3,textAlign:"center",
                  color:"#EF4444",fontSize:6,fontWeight:700,letterSpacing:1,
                  animation:"ragePulse 0.55s ease infinite alternate"}}>
                  &#9679; &#1071;&#1056;&#1054;&#1057;&#1058;&#1068; &#9679;
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{padding:"0 12px 6px"}}>
          <Jaws
            whiteness={whiteness}
            activeZone={zone}
            doneZones={doneZones}
            running={phase==="running"}
            brushX={brushX}
            brushJaw={brushJaw}
          />
        </div>

        {/* BOTTOM: zone progress */}
        <div style={{padding:"0 14px 10px"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
            <span style={{color:"#64748B",fontSize:8,fontWeight:600}}>
              &#1047;&#1086;&#1085;&#1072;: <span style={{color:zColor,fontWeight:800}}>{ZONES[zone].label}</span>
            </span>
            <span style={{color:"#64748B",fontSize:8,fontWeight:700}}>{Math.round(zoneP*100)}%</span>
          </div>
          <div style={{background:"rgba(255,255,255,0.06)",borderRadius:99,height:6,overflow:"hidden",
            border:"1px solid rgba(255,255,255,0.04)"}}>
            <div style={{height:"100%",borderRadius:99,width:`${zoneP*100}%`,
              background:`linear-gradient(90deg,${zColor}88,${zColor})`,
              transition:"width 1s linear",boxShadow:`0 0 10px ${zColor}99`}}/>
          </div>
        </div>
      </div>

      {/* CTA */}
      <button onClick={toggle} style={{
        width:"100%",maxWidth:440,padding:"18px",borderRadius:20,
        border:phase==="running"?"1px solid rgba(239,68,68,0.35)":"none",
        cursor:"pointer",
        background:phase==="running"?"rgba(239,68,68,0.14)":"linear-gradient(135deg,#1D4ED8,#6366F1)",
        color:"white",fontSize:17,fontWeight:800,
        boxShadow:phase==="running"?"none":"0 8px 28px rgba(29,78,216,0.55)",
        transition:"all 0.2s",zIndex:1,
      }}
        onMouseDown={e=>e.currentTarget.style.transform="scale(0.97)"}
        onMouseUp={e=>e.currentTarget.style.transform="scale(1)"}
      >
        {phase==="running"?"⏸ Пауза":phase==="paused"?"▶ Продолжить":"⚔️ Начать сражение!"}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ██  PROGRESSION SYSTEM DATA
// ══════════════════════════════════════════════════════════════

const HEROES = [
  {
    id:"knight", name:"Арман", title:"Батыр-Рыцарь", emoji:"⚔️",
    desc:"Сбалансированный воин. Мастер атаки и защиты.",
    unlocked:true, cost:0,
    stats:{ atk:7, def:6, spd:6, crit:15 },
    maxHP:100,
    special:"Щит зубной пасты блокирует 30% урона",
    color:"#3B82F6", bgGrad:"linear-gradient(135deg,#1E3A8A,#3B82F6)",
    accentCol:"#FBBF24",
    tag:"СТАРТ",
  },
  {
    id:"sprinter", name:"Айдос", title:"Вихрь-Спринтер", emoji:"⚡",
    desc:"Молниеносные удары. Слабее, но атакует чаще.",
    unlocked:false, cost:120,
    stats:{ atk:5, def:4, spd:10, crit:25 },
    maxHP:80,
    special:"Каждые 1.5с вместо 2с. Криты x3 урона!",
    color:"#F59E0B", bgGrad:"linear-gradient(135deg,#78350F,#F59E0B)",
    accentCol:"#FDE68A",
    tag:"СКОРОСТЬ",
  },
  {
    id:"doctor", name:"Камила", title:"Доктор-Дантист", emoji:"🦷",
    desc:"Медленная атака, но лечит себя со временем.",
    unlocked:false, cost:150,
    stats:{ atk:6, def:9, spd:4, crit:10 },
    maxHP:130,
    special:"Восстанавливает 5 HP каждые 10 секунд",
    color:"#10B981", bgGrad:"linear-gradient(135deg,#064E3B,#10B981)",
    accentCol:"#A7F3D0",
    tag:"СТОЙКОСТЬ",
  },
  {
    id:"star", name:"Жұлдыз", title:"Звёздная", emoji:"🌟",
    desc:"Хрупкий, но крит-машина. Высокий риск = высокая награда.",
    unlocked:false, cost:200,
    stats:{ atk:9, def:3, spd:8, crit:35 },
    maxHP:65,
    special:"Критический удар каждые 4 секунды гарантированно",
    color:"#A855F7", bgGrad:"linear-gradient(135deg,#4C1D95,#A855F7)",
    accentCol:"#E879F9",
    tag:"КРИТ",
  },
  {
    id:"berserker", name:"Тимур", title:"Берсерк", emoji:"🔥",
    desc:"Чем меньше HP — тем сильнее атака. Живёт на грани.",
    unlocked:false, cost:280,
    stats:{ atk:10, def:2, spd:7, crit:20 },
    maxHP:75,
    special:"При HP < 30% урон x2, но защита = 0",
    color:"#EF4444", bgGrad:"linear-gradient(135deg,#7F1D1D,#EF4444)",
    accentCol:"#FCA5A5",
    tag:"БЕРСЕРК",
  },
  {
    id:"ninja", name:"Санжар", title:"Зубная Тень", emoji:"🥷",
    desc:"Невидимый удар. Враги не могут заблокировать его атаки.",
    unlocked:false, cost:350,
    stats:{ atk:8, def:5, spd:9, crit:30 },
    maxHP:85,
    special:"Блок босса игнорируется полностью. Никогда не промахивается.",
    color:"#64748B", bgGrad:"linear-gradient(135deg,#0F172A,#334155)",
    accentCol:"#94A3B8",
    tag:"ТЕНЬНИНДЗЯ",
  },
];

const MISSIONS = [
  {
    id:"m1", day:1, title:"Первый зуб", subtitle:"Знакомство с Кариесом",
    bossIdx:0, bossName:"КАРИЕС", bossEmoji:"🦠",
    story:"Арман замечает жёлтое пятно на зубе. Это Кариес — коварный разрушитель! Пора дать бой!",
    difficulty:"Легко", diffColor:"#22C55E",
    reward:{ coins:50, card:"caries" },
    bg:"#C8D80022",
  },
  {
    id:"m2", day:2, title:"Серая угроза", subtitle:"Налёт атакует",
    bossIdx:1, bossName:"НАЛЁТ", bossEmoji:"🪨",
    story:"Налёт — серый каменный монстр — облепил все зубы. Он твёрдый как скала, но щётка справится!",
    difficulty:"Средне", diffColor:"#F59E0B",
    reward:{ coins:70, card:"plaque" },
    bg:"#9CA3AF22",
  },
  {
    id:"m3", day:3, title:"Фиолетовый Клей", subtitle:"Тартар не сдаётся",
    bossIdx:2, bossName:"ТАРТАР", bossEmoji:"💜",
    story:"Тартар прицепился намертво! Этот фиолетовый слизень думает, что останется навсегда. Покажи ему!",
    difficulty:"Сложно", diffColor:"#F97316",
    reward:{ coins:90, card:"tartar" },
    bg:"#7C3AED22",
  },
  {
    id:"m4", day:4, title:"Зелёная Зараза", subtitle:"Гингивит атакует дёсны",
    bossIdx:3, bossName:"ГИНГИВИТ", bossEmoji:"🤢",
    story:"Гингивит добрался до дёсен! Он самый опасный из всех. Только идеальная чистка его победит!",
    difficulty:"Босс!", diffColor:"#EF4444",
    reward:{ coins:120, card:"gingivitis" },
    bg:"#22C55E22",
  },
  {
    id:"m5", day:5, title:"Финальная битва", subtitle:"Все враги вместе!",
    bossIdx:0, bossName:"MEGA КАРИЕС", bossEmoji:"💀",
    story:"Все четыре монстра объединились! Mega-Кариес ведёт армию микробов. Это финальный бой!",
    difficulty:"ЛЕГЕНДА", diffColor:"#A855F7",
    reward:{ coins:200, card:"mega" },
    bg:"#C8D80033",
  },
];

const MONSTER_CARDS = {
  caries:   { name:"Кариес",    emoji:"🦠", col:"#C8D800", rarity:"Обычная",  rarCol:"#6B7280", desc:"Разрушитель зубной эмали. Питается сахаром." },
  plaque:   { name:"Налёт",     emoji:"🪨", col:"#9CA3AF", rarity:"Редкая",   rarCol:"#3B82F6", desc:"Серый каменный монстр. Любит прятаться у дёсен." },
  tartar:   { name:"Тартар",    emoji:"💜", col:"#7C3AED", rarity:"Эпическая",rarCol:"#A855F7", desc:"Фиолетовый клей. Превращает налёт в камень." },
  gingivitis:{ name:"Гингивит", emoji:"🤢", col:"#22C55E", rarity:"Легенда",  rarCol:"#F59E0B", desc:"Воспаляет дёсны. Самый опасный враг полости рта." },
  mega:     { name:"Mega Boss", emoji:"💀", col:"#EF4444", rarity:"УНИКАЛЬНАЯ",rarCol:"#EF4444", desc:"Финальный монстр. Объединил силы всех врагов!" },
};

const ACHIEVEMENTS = [
  { id:"first_win",   icon:"🏆", title:"Первая победа",      desc:"Выиграй первую битву",             done:false },
  { id:"no_damage",   icon:"🛡", title:"Непробиваемый",       desc:"Пройди битву без потери HP",       done:false },
  { id:"max_combo",   icon:"⚡", title:"Комбо-Мастер",        desc:"Достигни x10 комбо",               done:false },
  { id:"all_chars",   icon:"🌟", title:"Коллекционер",        desc:"Разблокируй всех персонажей",      done:false },
  { id:"streak_7",    icon:"🔥", title:"Неделя без пропусков", desc:"7 чисток подряд",                 done:false },
  { id:"all_cards",   icon:"🃏", title:"Покеролог",           desc:"Собери все карточки монстров",     done:false },
  { id:"rich",        icon:"💰", title:"Богач",               desc:"Накопи 500 DentCoins",             done:false },
  { id:"crit_10",     icon:"💥", title:"Снайпер",             desc:"Сделай 10 крит-ударов за 1 чистку",done:false },
];

// ══════════════════════════════════════════════════════════════
// ██  STAT BAR MINI COMPONENT
// ══════════════════════════════════════════════════════════════
function StatBar({ label, value, max=10, col }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
      <span style={{color:"#475569",fontSize:7,fontWeight:700,width:28,textAlign:"right",letterSpacing:0.3}}>{label}</span>
      <div style={{flex:1,height:4,background:"rgba(255,255,255,0.07)",borderRadius:99,overflow:"hidden"}}>
        <div style={{height:"100%",borderRadius:99,width:`${(value/max)*100}%`,
          background:`linear-gradient(90deg,${col}99,${col})`,
          boxShadow:`0 0 6px ${col}66`,transition:"width 0.5s ease"}}/>
      </div>
      <span style={{color:col,fontSize:7,fontWeight:800,width:12}}>{value}</span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ██  HERO CARD (roster screen)
// ══════════════════════════════════════════════════════════════
function HeroCard({ hero, selected, onSelect, totalCoins }) {
  const canAfford = totalCoins >= hero.cost;
  const locked = !hero.unlocked;
  return (
    <div
      onClick={() => onSelect(hero)}
      style={{
        borderRadius:18,
        background: selected ? hero.bgGrad : "rgba(255,255,255,0.03)",
        border:`2px solid ${selected ? hero.color : locked ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.1)"}`,
        padding:"14px 12px",
        cursor:"pointer",
        position:"relative",
        transition:"all 0.25s",
        boxShadow: selected ? `0 0 28px ${hero.color}55` : "none",
        opacity: locked && !canAfford ? 0.55 : 1,
      }}
    >
      {/* Tag badge */}
      <div style={{position:"absolute",top:8,right:8,
        background: selected ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)",
        borderRadius:20,padding:"1px 7px"}}>
        <span style={{color: selected ? "white" : "#475569", fontSize:6.5, fontWeight:800, letterSpacing:0.8}}>
          {hero.tag}
        </span>
      </div>

      {/* Emoji + name */}
      <div style={{fontSize:32,marginBottom:4,filter:locked?"grayscale(0.6)":"none"}}>{hero.emoji}</div>
      <div style={{color: selected ? "white" : "#E2E8F0", fontSize:13, fontWeight:800, marginBottom:1}}>{hero.name}</div>
      <div style={{color: selected ? hero.accentCol : "#64748B", fontSize:9, fontWeight:600, marginBottom:8}}>{hero.title}</div>

      {/* Stats */}
      <StatBar label="АТК" value={hero.stats.atk} col={selected?hero.accentCol:hero.color}/>
      <StatBar label="ЗАЩ" value={hero.stats.def} col={selected?hero.accentCol:hero.color}/>
      <StatBar label="СКР" value={hero.stats.spd} col={selected?hero.accentCol:hero.color}/>
      <StatBar label="КРТ" value={hero.stats.crit/4} col={selected?hero.accentCol:hero.color}/>

      {/* Lock / unlock indicator */}
      {locked ? (
        <div style={{marginTop:8,textAlign:"center",padding:"4px 0",
          borderTop:"1px solid rgba(255,255,255,0.06)"}}>
          <span style={{color:canAfford?"#F59E0B":"#475569",fontSize:9,fontWeight:700}}>
            {canAfford ? `🔓 Купить за ${hero.cost} 🪙` : `🔒 ${hero.cost} 🪙`}
          </span>
        </div>
      ) : (
        <div style={{marginTop:8,textAlign:"center"}}>
          <span style={{color:selected?"#4ADE80":"#475569",fontSize:9,fontWeight:700}}>
            {selected ? "✓ ВЫБРАН" : "Нажми чтобы выбрать"}
          </span>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ██  MISSION CARD
// ══════════════════════════════════════════════════════════════
function MissionCard({ mission, completed, onPlay, dayNum }) {
  return (
    <div style={{
      borderRadius:18,
      background: completed
        ? "linear-gradient(135deg,rgba(34,197,94,0.12),rgba(16,185,129,0.06))"
        : `linear-gradient(135deg,${mission.bg},rgba(255,255,255,0.02))`,
      border: completed
        ? "1.5px solid rgba(34,197,94,0.35)"
        : "1.5px solid rgba(255,255,255,0.08)",
      padding:"14px 16px",
      position:"relative",
      overflow:"hidden",
    }}>
      {/* Day label */}
      <div style={{position:"absolute",top:10,right:12,
        background:"rgba(0,0,0,0.35)",borderRadius:20,padding:"2px 8px"}}>
        <span style={{color:"#475569",fontSize:7,fontWeight:700}}>ДЕНЬ {dayNum}</span>
      </div>

      <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
        {/* Monster emoji */}
        <div style={{fontSize:34,flexShrink:0,filter:completed?"saturate(0.3)":"none"}}>
          {mission.bossEmoji}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
            <span style={{color:"white",fontSize:14,fontWeight:800}}>{mission.title}</span>
            <span style={{
              color:mission.diffColor,fontSize:7,fontWeight:800,
              background:`${mission.diffColor}18`,borderRadius:20,padding:"1px 7px",
              border:`1px solid ${mission.diffColor}33`,
            }}>{mission.difficulty}</span>
          </div>
          <div style={{color:"#64748B",fontSize:9,marginBottom:6}}>{mission.subtitle}</div>
          <div style={{color:"#94A3B8",fontSize:9,fontStyle:"italic",lineHeight:1.4,marginBottom:8}}>
            "{mission.story}"
          </div>
          {/* Reward */}
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{color:"#F59E0B",fontSize:9,fontWeight:700}}>🪙 +{mission.reward.coins}</span>
            <span style={{color:"#A78BFA",fontSize:9,fontWeight:700}}>🃏 Новая карта</span>
          </div>
        </div>
      </div>

      <button
        onClick={() => onPlay(mission)}
        style={{
          width:"100%", marginTop:12, padding:"10px",
          borderRadius:12, border:"none", cursor:"pointer",
          background: completed
            ? "rgba(34,197,94,0.15)"
            : "linear-gradient(135deg,#1D4ED8,#6366F1)",
          color: completed ? "#4ADE80" : "white",
          fontSize:12, fontWeight:800,
          boxShadow: completed ? "none" : "0 4px 18px rgba(29,78,216,0.4)",
        }}
      >
        {completed ? "✓ Пройдено — Играть снова" : "⚔️ Начать миссию"}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ██  MONSTER CARD (collectible)
// ══════════════════════════════════════════════════════════════
function MonsterCardCollect({ cardKey, collected }) {
  const card = MONSTER_CARDS[cardKey];
  return (
    <div style={{
      borderRadius:16,
      background: collected
        ? `linear-gradient(145deg,${card.col}22,rgba(0,0,0,0.6))`
        : "rgba(255,255,255,0.02)",
      border: collected
        ? `1.5px solid ${card.col}55`
        : "1.5px solid rgba(255,255,255,0.06)",
      padding:"12px 10px",
      textAlign:"center",
      boxShadow: collected ? `0 0 20px ${card.col}33` : "none",
      transition:"all 0.3s",
    }}>
      <div style={{fontSize:28,marginBottom:4,filter:collected?"none":"grayscale(1)",opacity:collected?1:0.25}}>
        {card.emoji}
      </div>
      <div style={{color:collected?card.col:"#334155",fontSize:10,fontWeight:800,marginBottom:2}}>
        {collected ? card.name : "???"}
      </div>
      <div style={{
        display:"inline-block",fontSize:6.5,fontWeight:800,letterSpacing:0.5,
        color:collected?card.rarCol:"#1E293B",
        background:collected?`${card.rarCol}18`:"rgba(0,0,0,0.3)",
        borderRadius:20,padding:"1px 7px",marginBottom:4,
        border:collected?`1px solid ${card.rarCol}33`:"1px solid transparent",
      }}>
        {collected ? card.rarity : "ЗАБЛОКИРОВАНО"}
      </div>
      {collected && (
        <div style={{color:"#475569",fontSize:7.5,lineHeight:1.3,fontStyle:"italic"}}>
          {card.desc}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ██  HUB SCREEN (main menu between sessions)
// ══════════════════════════════════════════════════════════════
function HubScreen({ gameData, onNavigate, onExit }) {
  const { totalCoins, streak, completedMissions, achievements, heroId } = gameData;
  const hero = HEROES.find(h => h.id === heroId) || HEROES[0];
  const nextMission = MISSIONS.find(m => !completedMissions.includes(m.id)) || MISSIONS[MISSIONS.length-1];
  const doneCount = achievements.filter(Boolean).length;

  return (
    <div style={{
      minHeight:"100vh", background:"#070D1A",
      fontFamily:"'Segoe UI',system-ui,sans-serif",
      display:"flex", flexDirection:"column",
      alignItems:"center", padding:"20px 14px 80px",
      position:"relative", overflow:"hidden",
    }}>
      <style>{`
        @keyframes hubFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @keyframes hubPulse{0%,100%{opacity:0.6}50%{opacity:1}}
        @keyframes slideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spinStar{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      `}</style>

      {/* BG stars */}
      {Array.from({length:18}).map((_,i) => (
        <div key={i} style={{
          position:"fixed",
          left:`${5+i*5.2}%`, top:`${8+((i*37)%55)}%`,
          width:i%3===0?3:2, height:i%3===0?3:2,
          borderRadius:"50%", background:"white",
          opacity:0.12+i*0.02,
          animation:`hubPulse ${1.5+i*0.2}s ease ${i*0.1}s infinite`,
          pointerEvents:"none",
        }}/>
      ))}

      {/* Top bar */}
      <div style={{width:"100%",maxWidth:440,display:"flex",justifyContent:"space-between",
        alignItems:"center",marginBottom:20,zIndex:1}}>
        <div>
          <p style={{color:"#334155",fontSize:8,margin:0,fontWeight:700,textTransform:"uppercase",letterSpacing:1.2}}>SMARTSMILE</p>
          <p style={{color:"white",fontSize:20,fontWeight:900,margin:0}}>Добро пожаловать! 👋</p>
        </div>
        <div style={{textAlign:"right",display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
          {onExit && (
            <button onClick={onExit} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",
              borderRadius:12,padding:"8px 14px",color:"#94A3B8",cursor:"pointer",fontSize:13,fontWeight:700}}>
              🚪 Выход
            </button>
          )}
          <div style={{display:"flex",alignItems:"center",gap:6,
            background:"rgba(245,158,11,0.12)",border:"1px solid rgba(245,158,11,0.3)",
            borderRadius:20,padding:"6px 14px"}}>
            <span style={{fontSize:16}}>🪙</span>
            <span style={{color:"#F59E0B",fontSize:18,fontWeight:900,fontFamily:"monospace"}}>{totalCoins}</span>
          </div>
          {streak > 0 && (
            <div style={{color:"#F97316",fontSize:9,fontWeight:700}}>
              🔥 {streak} дней подряд!
            </div>
          )}
        </div>
      </div>

      {/* Active hero banner */}
      <div style={{
        width:"100%", maxWidth:440, marginBottom:14, zIndex:1,
        background: hero.bgGrad,
        borderRadius:22, padding:"16px 20px",
        boxShadow:`0 8px 32px ${hero.color}44`,
        display:"flex", alignItems:"center", gap:16,
        animation:"slideUp 0.4s ease",
        cursor:"pointer",
      }} onClick={() => onNavigate("roster")}>
        <div style={{fontSize:42, animation:"hubFloat 3s ease infinite"}}>{hero.emoji}</div>
        <div style={{flex:1}}>
          <div style={{color:"rgba(255,255,255,0.65)",fontSize:9,fontWeight:700,
            textTransform:"uppercase",letterSpacing:1}}>АКТИВНЫЙ ПЕРСОНАЖ</div>
          <div style={{color:"white",fontSize:18,fontWeight:900}}>{hero.name}</div>
          <div style={{color:hero.accentCol,fontSize:10,fontWeight:600}}>{hero.title}</div>
        </div>
        <div style={{color:"rgba(255,255,255,0.35)",fontSize:18}}>›</div>
      </div>

      {/* Next mission CTA */}
      <div style={{
        width:"100%", maxWidth:440, marginBottom:14, zIndex:1,
        animation:"slideUp 0.5s ease",
      }}>
        <p style={{color:"#475569",fontSize:9,fontWeight:700,textTransform:"uppercase",
          letterSpacing:1.2,margin:"0 0 8px"}}>СЛЕДУЮЩАЯ МИССИЯ</p>
        <div style={{
          background:`linear-gradient(135deg,${nextMission.bg},rgba(255,255,255,0.04))`,
          border:"1.5px solid rgba(255,255,255,0.1)",
          borderRadius:20, padding:"14px 16px",
          display:"flex", alignItems:"center", gap:14,
        }}>
          <div style={{fontSize:36}}>{nextMission.bossEmoji}</div>
          <div style={{flex:1}}>
            <div style={{color:"white",fontSize:15,fontWeight:800}}>{nextMission.title}</div>
            <div style={{color:"#64748B",fontSize:9,marginBottom:6}}>{nextMission.subtitle}</div>
            <div style={{display:"flex",gap:8}}>
              <span style={{color:nextMission.diffColor,fontSize:8,fontWeight:700,
                background:`${nextMission.diffColor}18`,borderRadius:20,padding:"1px 8px",
                border:`1px solid ${nextMission.diffColor}33`}}>{nextMission.difficulty}</span>
              <span style={{color:"#F59E0B",fontSize:8,fontWeight:700}}>🪙 +{nextMission.reward.coins}</span>
            </div>
          </div>
          <button
            onClick={() => onNavigate("play", nextMission)}
            style={{
              padding:"10px 16px", borderRadius:14, border:"none", cursor:"pointer",
              background:"linear-gradient(135deg,#1D4ED8,#6366F1)",
              color:"white", fontSize:12, fontWeight:800,
              boxShadow:"0 4px 16px rgba(29,78,216,0.5)",
              flexShrink:0,
            }}
          >⚔️ Играть</button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{width:"100%",maxWidth:440,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",
        gap:8,marginBottom:14,zIndex:1,animation:"slideUp 0.6s ease"}}>
        {[
          { label:"Миссий", value:completedMissions.length, icon:"⚔️", col:"#3B82F6" },
          { label:"Трофеев", value:`${doneCount}/${ACHIEVEMENTS.length}`, icon:"🏆", col:"#F59E0B" },
          { label:"Карт", value:`${Object.keys(gameData.cards||{}).length}/${Object.keys(MONSTER_CARDS).length}`, icon:"🃏", col:"#A855F7" },
        ].map(s => (
          <div key={s.label} style={{
            background:"rgba(255,255,255,0.03)",
            border:"1px solid rgba(255,255,255,0.07)",
            borderRadius:16, padding:"12px 8px", textAlign:"center",
          }}>
            <div style={{fontSize:20,marginBottom:4}}>{s.icon}</div>
            <div style={{color:s.col,fontSize:18,fontWeight:900,fontFamily:"monospace"}}>{s.value}</div>
            <div style={{color:"#475569",fontSize:8,fontWeight:600}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Nav buttons */}
      <div style={{width:"100%",maxWidth:440,display:"grid",gridTemplateColumns:"1fr 1fr",
        gap:8,zIndex:1,animation:"slideUp 0.7s ease"}}>
        {[
          { label:"📋 Миссии",     nav:"missions" },
          { label:"🧑 Персонажи",  nav:"roster" },
          { label:"🃏 Карточки",   nav:"cards" },
          { label:"🏆 Достижения", nav:"achievements" },
        ].map(b => (
          <button key={b.nav}
            onClick={() => onNavigate(b.nav)}
            style={{
              padding:"14px", borderRadius:16,
              border:"1px solid rgba(255,255,255,0.08)",
              background:"rgba(255,255,255,0.04)",
              color:"#94A3B8", fontSize:13, fontWeight:700,
              cursor:"pointer", transition:"all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background="rgba(255,255,255,0.08)"; e.currentTarget.style.color="white"; }}
            onMouseLeave={e => { e.currentTarget.style.background="rgba(255,255,255,0.04)"; e.currentTarget.style.color="#94A3B8"; }}
          >{b.label}</button>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ██  ROSTER SCREEN
// ══════════════════════════════════════════════════════════════
function RosterScreen({ gameData, onSelectHero, onBack, onBuyHero, onExit }) {
  const [selected, setSelected] = useState(gameData.heroId || "knight");
  const [preview, setPreview] = useState(null);

  const handleSelect = (hero) => {
    if (hero.unlocked || gameData.unlockedHeroes?.includes(hero.id)) {
      setSelected(hero.id);
      onSelectHero(hero.id);
    } else if (gameData.totalCoins >= hero.cost) {
      setPreview(hero);
    }
  };

  const heroes = HEROES.map(h => ({
    ...h,
    unlocked: h.unlocked || (gameData.unlockedHeroes||[]).includes(h.id),
  }));

  return (
    <div style={{minHeight:"100vh",background:"#070D1A",fontFamily:"'Segoe UI',system-ui,sans-serif",
      display:"flex",flexDirection:"column",alignItems:"center",padding:"20px 14px 80px",
      position:"relative",overflow:"hidden"}}>

      {/* Header */}
      <div style={{width:"100%",maxWidth:440,display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button onClick={onBack} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",
          borderRadius:12,padding:"8px 14px",color:"#94A3B8",cursor:"pointer",fontSize:13,fontWeight:700}}>← Назад</button>
        <div>
          <p style={{color:"#475569",fontSize:8,margin:0,fontWeight:700,textTransform:"uppercase",letterSpacing:1.2}}>ВЫБОР</p>
          <p style={{color:"white",fontSize:18,fontWeight:900,margin:0}}>🧑 Персонажи</p>
        </div>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10}}>
          {onExit && (
            <button onClick={onExit} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",
              borderRadius:12,padding:"8px 14px",color:"#94A3B8",cursor:"pointer",fontSize:13,fontWeight:700}}>
              🚪 Выход
            </button>
          )}
          <div style={{display:"flex",alignItems:"center",gap:4,
            background:"rgba(245,158,11,0.12)",border:"1px solid rgba(245,158,11,0.25)",
            borderRadius:20,padding:"5px 12px"}}>
            <span style={{fontSize:12}}>🪙</span>
            <span style={{color:"#F59E0B",fontSize:14,fontWeight:900,fontFamily:"monospace"}}>{gameData.totalCoins}</span>
          </div>
        </div>
      </div>

      {/* Hero grid */}
      <div style={{width:"100%",maxWidth:440,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {heroes.map(hero => (
          <HeroCard key={hero.id} hero={hero} selected={selected===hero.id}
            onSelect={handleSelect} totalCoins={gameData.totalCoins}/>
        ))}
      </div>

      {/* Special ability info for selected */}
      {(() => {
        const h = heroes.find(x => x.id === selected);
        return h ? (
          <div style={{width:"100%",maxWidth:440,marginTop:14,
            background:`${h.color}14`,border:`1px solid ${h.color}30`,
            borderRadius:16,padding:"12px 16px"}}>
            <div style={{color:h.color,fontSize:9,fontWeight:800,marginBottom:4,
              textTransform:"uppercase",letterSpacing:1}}>⚡ ОСОБАЯ СПОСОБНОСТЬ</div>
            <div style={{color:"#E2E8F0",fontSize:11,lineHeight:1.5}}>{h.special}</div>
          </div>
        ) : null;
      })()}

      {/* Buy confirm modal */}
      {preview && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",
          display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:20}}>
          <div style={{background:"#0F172A",border:`2px solid ${preview.color}55`,
            borderRadius:24,padding:28,maxWidth:320,width:"100%",textAlign:"center",
            boxShadow:`0 0 60px ${preview.color}33`}}>
            <div style={{fontSize:48,marginBottom:8}}>{preview.emoji}</div>
            <div style={{color:"white",fontSize:20,fontWeight:900,marginBottom:4}}>{preview.name}</div>
            <div style={{color:preview.accentCol,fontSize:11,marginBottom:16}}>{preview.title}</div>
            <div style={{color:"#94A3B8",fontSize:11,marginBottom:20}}>{preview.desc}</div>
            <div style={{color:"#F59E0B",fontSize:16,fontWeight:800,marginBottom:16}}>Стоимость: {preview.cost} 🪙</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={() => setPreview(null)}
                style={{flex:1,padding:"12px",borderRadius:14,border:"1px solid rgba(255,255,255,0.1)",
                  background:"transparent",color:"#94A3B8",cursor:"pointer",fontSize:13,fontWeight:700}}>
                Отмена
              </button>
              <button onClick={() => { onBuyHero(preview.id, preview.cost); setPreview(null); }}
                style={{flex:1,padding:"12px",borderRadius:14,border:"none",
                  background:`linear-gradient(135deg,${preview.color},${preview.accentCol})`,
                  color:"white",cursor:"pointer",fontSize:13,fontWeight:800,
                  boxShadow:`0 4px 16px ${preview.color}44`}}>
                Купить!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ██  MISSIONS SCREEN
// ══════════════════════════════════════════════════════════════
function MissionsScreen({ gameData, onPlay, onBack, onExit }) {
  return (
    <div style={{minHeight:"100vh",background:"#070D1A",fontFamily:"'Segoe UI',system-ui,sans-serif",
      display:"flex",flexDirection:"column",alignItems:"center",padding:"20px 14px 80px"}}>
      <div style={{width:"100%",maxWidth:440,display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button onClick={onBack} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",
          borderRadius:12,padding:"8px 14px",color:"#94A3B8",cursor:"pointer",fontSize:13,fontWeight:700}}>← Назад</button>
        <div>
          <p style={{color:"#475569",fontSize:8,margin:0,fontWeight:700,textTransform:"uppercase",letterSpacing:1.2}}>КАМПАНИЯ</p>
          <p style={{color:"white",fontSize:18,fontWeight:900,margin:0}}>📋 Миссии</p>
        </div>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10}}>
          <div style={{color:"#64748B",fontSize:10,fontWeight:700}}>
            {gameData.completedMissions.length}/{MISSIONS.length} пройдено
          </div>
          {onExit && (
            <button onClick={onExit} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",
              borderRadius:12,padding:"8px 14px",color:"#94A3B8",cursor:"pointer",fontSize:13,fontWeight:700}}>
              🚪 Выход
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{width:"100%",maxWidth:440,marginBottom:16,
        background:"rgba(255,255,255,0.05)",borderRadius:99,height:6,overflow:"hidden"}}>
        <div style={{height:"100%",borderRadius:99,
          width:`${(gameData.completedMissions.length/MISSIONS.length)*100}%`,
          background:"linear-gradient(90deg,#06B6D4,#8B5CF6,#F43F5E,#10B981,#A855F7)",
          transition:"width 0.5s ease"}}/>
      </div>

      <div style={{width:"100%",maxWidth:440,display:"flex",flexDirection:"column",gap:10}}>
        {MISSIONS.map((mission, i) => (
          <MissionCard
            key={mission.id}
            mission={mission}
            completed={gameData.completedMissions.includes(mission.id)}
            onPlay={onPlay}
            dayNum={i+1}
          />
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ██  CARDS SCREEN (monster collection)
// ══════════════════════════════════════════════════════════════
function CardsScreen({ gameData, onBack, onExit }) {
  const collected = gameData.cards || {};
  const total = Object.keys(MONSTER_CARDS).length;
  const have  = Object.keys(collected).length;
  return (
    <div style={{minHeight:"100vh",background:"#070D1A",fontFamily:"'Segoe UI',system-ui,sans-serif",
      display:"flex",flexDirection:"column",alignItems:"center",padding:"20px 14px 80px"}}>
      <div style={{width:"100%",maxWidth:440,display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
        <button onClick={onBack} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",
          borderRadius:12,padding:"8px 14px",color:"#94A3B8",cursor:"pointer",fontSize:13,fontWeight:700}}>← Назад</button>
        <div>
          <p style={{color:"#475569",fontSize:8,margin:0,fontWeight:700,textTransform:"uppercase",letterSpacing:1.2}}>АЛЬБОМ</p>
          <p style={{color:"white",fontSize:18,fontWeight:900,margin:0}}>🃏 Карточки монстров</p>
        </div>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10}}>
          <div style={{color:"#A855F7",fontSize:12,fontWeight:800}}>
            {have}/{total}
          </div>
          {onExit && (
            <button onClick={onExit} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",
              borderRadius:12,padding:"8px 14px",color:"#94A3B8",cursor:"pointer",fontSize:13,fontWeight:700}}>
              🚪 Выход
            </button>
          )}
        </div>
      </div>
      <div style={{width:"100%",maxWidth:440,
        background:"rgba(168,85,247,0.08)",border:"1px solid rgba(168,85,247,0.2)",
        borderRadius:14,padding:"8px 14px",marginBottom:14,textAlign:"center"}}>
        <span style={{color:"#A78BFA",fontSize:9,fontWeight:600}}>
          Побеждай боссов в миссиях, чтобы получить их карточки! 
          {have===total ? " 🎉 Коллекция завершена!" : ""}
        </span>
      </div>
      <div style={{width:"100%",maxWidth:440,display:"grid",
        gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
        {Object.keys(MONSTER_CARDS).map(key => (
          <MonsterCardCollect key={key} cardKey={key} collected={!!collected[key]}/>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ██  ACHIEVEMENTS SCREEN
// ══════════════════════════════════════════════════════════════
function AchievementsScreen({ gameData, onBack, onExit }) {
  const done = gameData.achievements || [];
  return (
    <div style={{minHeight:"100vh",background:"#070D1A",fontFamily:"'Segoe UI',system-ui,sans-serif",
      display:"flex",flexDirection:"column",alignItems:"center",padding:"20px 14px 80px"}}>
      <div style={{width:"100%",maxWidth:440,display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button onClick={onBack} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",
          borderRadius:12,padding:"8px 14px",color:"#94A3B8",cursor:"pointer",fontSize:13,fontWeight:700}}>← Назад</button>
        <div>
          <p style={{color:"#475569",fontSize:8,margin:0,fontWeight:700,textTransform:"uppercase",letterSpacing:1.2}}>ТРОФЕИ</p>
          <p style={{color:"white",fontSize:18,fontWeight:900,margin:0}}>🏆 Достижения</p>
        </div>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10}}>
          <div style={{color:"#F59E0B",fontSize:11,fontWeight:800}}>
            {done.length}/{ACHIEVEMENTS.length}
          </div>
          {onExit && (
            <button onClick={onExit} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",
              borderRadius:12,padding:"8px 14px",color:"#94A3B8",cursor:"pointer",fontSize:13,fontWeight:700}}>
              🚪 Выход
            </button>
          )}
        </div>
      </div>
      <div style={{width:"100%",maxWidth:440,display:"flex",flexDirection:"column",gap:8}}>
        {ACHIEVEMENTS.map(ach => {
          const isDone = done.includes(ach.id);
          return (
            <div key={ach.id} style={{
              display:"flex", alignItems:"center", gap:14,
              background: isDone
                ? "linear-gradient(135deg,rgba(245,158,11,0.12),rgba(251,191,36,0.04))"
                : "rgba(255,255,255,0.02)",
              border: isDone ? "1.5px solid rgba(245,158,11,0.35)" : "1.5px solid rgba(255,255,255,0.06)",
              borderRadius:16, padding:"14px 16px",
              opacity: isDone ? 1 : 0.6,
            }}>
              <div style={{fontSize:28,filter:isDone?"none":"grayscale(1)",opacity:isDone?1:0.3,
                flexShrink:0}}>{ach.icon}</div>
              <div style={{flex:1}}>
                <div style={{color:isDone?"#FDE68A":"#64748B",fontSize:12,fontWeight:800,marginBottom:2}}>
                  {ach.title}
                </div>
                <div style={{color:"#475569",fontSize:9}}>{ach.desc}</div>
              </div>
              {isDone && (
                <div style={{color:"#F59E0B",fontSize:16,flexShrink:0}}>✓</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ██  POST-GAME RESULTS SCREEN
// ══════════════════════════════════════════════════════════════
function ResultsScreen({ result, mission, newAchievements, onContinue, onExit }) {
  const [t, setT] = useState(0);
  useEffect(() => { const id = setInterval(() => setT(x=>x+1), 80); return () => clearInterval(id); }, []);
  const card = MONSTER_CARDS[mission?.reward?.card];

  return (
    <div style={{minHeight:"100vh",background:"radial-gradient(ellipse at 50% 30%,#0F2746,#070D1A)",
      fontFamily:"'Segoe UI',system-ui,sans-serif",
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      padding:"24px 14px",position:"relative",overflow:"hidden"}}>
      <style>{`
        @keyframes rIn{from{opacity:0;transform:scale(0.5) rotate(-10deg)}to{opacity:1;transform:scale(1) rotate(0)}}
        @keyframes rCoin{0%{transform:translateY(-20px) rotate(0);opacity:1}100%{transform:translateY(80px) rotate(360deg);opacity:0}}
        @keyframes rSlide{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}
      `}</style>

      {onExit && (
        <button onClick={onExit} style={{position:"fixed",left:14,top:14,zIndex:50,
          background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",
          borderRadius:12,padding:"8px 14px",color:"#94A3B8",cursor:"pointer",fontSize:13,fontWeight:700}}>
          🚪 Выход
        </button>
      )}

      {/* Falling coins */}
      {Array.from({length:12}).map((_,i)=>(
        <div key={i} style={{position:"fixed",left:`${8+i*7.5}%`,top:0,
          fontSize:16,animation:`rCoin ${1.2+i*0.15}s ease ${i*0.08}s infinite`,pointerEvents:"none"}}>🪙</div>
      ))}

      {/* Trophy */}
      <div style={{fontSize:70,animation:"rIn 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards",marginBottom:10}}>🏆</div>

      <h1 style={{color:"white",fontSize:28,fontWeight:900,margin:"0 0 4px",
        background:"linear-gradient(135deg,#F59E0B,#FDE68A)",
        WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
        Миссия завершена!
      </h1>
      <p style={{color:"#64748B",fontSize:12,margin:"0 0 24px"}}>{mission?.title} — победа!</p>

      {/* Rewards card */}
      <div style={{width:"100%",maxWidth:380,background:"rgba(255,255,255,0.04)",
        border:"1px solid rgba(255,255,255,0.1)",borderRadius:22,padding:"20px",marginBottom:16}}>

        {/* Coins earned */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
          borderBottom:"1px solid rgba(255,255,255,0.06)",paddingBottom:12,marginBottom:12}}>
          <span style={{color:"#94A3B8",fontSize:11}}>DentCoins заработано</span>
          <span style={{color:"#F59E0B",fontSize:22,fontWeight:900,fontFamily:"monospace"}}>
            +{result.coins} 🪙
          </span>
        </div>

        {/* New card */}
        {card && (
          <div style={{
            display:"flex",alignItems:"center",gap:12,
            background:`${card.col}14`,border:`1px solid ${card.col}33`,
            borderRadius:14,padding:"12px",marginBottom:12,
            animation:"rSlide 0.5s ease 0.3s both",
          }}>
            <div style={{fontSize:30}}>{card.emoji}</div>
            <div>
              <div style={{color:"#94A3B8",fontSize:8,fontWeight:700,marginBottom:2}}>НОВАЯ КАРТОЧКА!</div>
              <div style={{color:card.col,fontSize:14,fontWeight:800}}>{card.name}</div>
              <div style={{color:card.rarCol,fontSize:9}}>{card.rarity}</div>
            </div>
          </div>
        )}

        {/* New achievements */}
        {newAchievements?.length > 0 && newAchievements.map(id => {
          const ach = ACHIEVEMENTS.find(a=>a.id===id);
          return ach ? (
            <div key={id} style={{display:"flex",alignItems:"center",gap:10,
              background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.25)",
              borderRadius:12,padding:"8px 12px",marginBottom:8,
              animation:"rSlide 0.5s ease 0.5s both"}}>
              <span style={{fontSize:20}}>{ach.icon}</span>
              <div>
                <div style={{color:"#FDE68A",fontSize:10,fontWeight:800}}>Новое достижение!</div>
                <div style={{color:"#F59E0B",fontSize:11,fontWeight:700}}>{ach.title}</div>
              </div>
            </div>
          ) : null;
        })}

        {/* Level gained */}
        <div style={{display:"flex",justifyContent:"space-between",
          color:"#94A3B8",fontSize:10,marginTop:4}}>
          <span>Уровень достигнут: <span style={{color:"#A78BFA",fontWeight:800}}>LV{result.level}</span></span>
          <span>HP осталось: <span style={{
            color:result.heroHP>60?"#4ADE80":result.heroHP>30?"#FCD34D":"#EF4444",
            fontWeight:800}}>{result.heroHP}</span></span>
        </div>
      </div>

      <button onClick={onContinue}
        style={{width:"100%",maxWidth:380,padding:"18px",borderRadius:20,border:"none",
          cursor:"pointer",background:"linear-gradient(135deg,#1D4ED8,#6366F1)",
          color:"white",fontSize:16,fontWeight:800,
          boxShadow:"0 8px 28px rgba(29,78,216,0.5)"}}>
        🏠 В главное меню
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ██  ROOT APP — navigation + persistent state
// ══════════════════════════════════════════════════════════════
const DEFAULT_GAME_DATA = {
  totalCoins: 0,
  streak: 0,
  heroId: "knight",
  unlockedHeroes: ["knight"],
  completedMissions: [],
  achievements: [],
  cards: {},
};

function checkAchievements(prev, result, gameData) {
  const newOnes = [];
  const ach = gameData.achievements || [];
  if (!ach.includes("first_win")) newOnes.push("first_win");
  if (result.heroHP === (HEROES.find(h=>h.id===result.heroId)?.maxHP??100) && !ach.includes("no_damage"))
    newOnes.push("no_damage");
  if (result.maxCombo >= 10 && !ach.includes("max_combo"))
    newOnes.push("max_combo");
  if ((gameData.totalCoins + result.coins) >= 500 && !ach.includes("rich"))
    newOnes.push("rich");
  const newCards = Object.keys({...gameData.cards, ...prev}).length;
  if (newCards >= Object.keys(MONSTER_CARDS).length && !ach.includes("all_cards"))
    newOnes.push("all_cards");
  return newOnes;
}

export function SmartSmileUltimateGame({ language = "ru", onComplete, onExit }) {
  const [screen, setScreen] = useState("hub"); // hub | missions | roster | cards | achievements | play | results
  const [gameData, setGameData] = useState(DEFAULT_GAME_DATA);
  const [currentMission, setCurrentMission] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [newAchievements, setNewAchievements] = useState([]);
  const [startedAtISO, setStartedAtISO] = useState(null);
  const reportedRef = useRef(false);

  const selectedHero = HEROES.find(h => h.id === gameData.heroId) || HEROES[0];

  const navigate = (to, payload) => {
    if (to === "play") {
      setCurrentMission(payload || MISSIONS.find(m => !gameData.completedMissions.includes(m.id)) || MISSIONS[0]);
      setStartedAtISO(new Date().toISOString());
      reportedRef.current = false;
      setScreen("play");
    } else {
      setScreen(to);
    }
  };

  const handleMissionComplete = (result) => {
    const missionId = currentMission?.id;
    const newCard = currentMission?.reward?.card;
    const coinReward = currentMission?.reward?.coins ?? 50;

    const newCards = newCard ? { ...gameData.cards, [newCard]: true } : gameData.cards;
    const newCompleted = gameData.completedMissions.includes(missionId)
      ? gameData.completedMissions
      : [...gameData.completedMissions, missionId];

    const fullResult = { ...result, maxCombo: result.maxCombo || 0 };
    const earned = checkAchievements(newCards, fullResult, gameData);

    const updated = {
      ...gameData,
      totalCoins: gameData.totalCoins + result.coins + coinReward,
      completedMissions: newCompleted,
      cards: newCards,
      achievements: [...new Set([...(gameData.achievements||[]), ...earned])],
      streak: gameData.streak + 1,
    };
    setGameData(updated);
    setLastResult({ ...result, coins: result.coins + coinReward });
    setNewAchievements(earned);
    setScreen("results");

    if (!reportedRef.current && onComplete) {
      reportedRef.current = true;
      onComplete({
        startedAtISO: startedAtISO || new Date().toISOString(),
        coinsEarned: result.coins + coinReward,
        durationSeconds: TOTAL,
      });
    }
  };

  const handleSelectHero = (heroId) => {
    setGameData(d => ({ ...d, heroId }));
  };

  const handleBuyHero = (heroId, cost) => {
    setGameData(d => ({
      ...d,
      totalCoins: d.totalCoins - cost,
      unlockedHeroes: [...(d.unlockedHeroes||[]), heroId],
      heroId,
    }));
  };

  if (screen === "hub") return (
    <HubScreen gameData={gameData} onNavigate={navigate} language={language} onExit={onExit}/>
  );
  if (screen === "missions") return (
    <MissionsScreen gameData={gameData} onPlay={(m) => navigate("play", m)} onBack={() => setScreen("hub")} language={language} onExit={onExit}/>
  );
  if (screen === "roster") return (
    <RosterScreen
      gameData={gameData}
      onSelectHero={handleSelectHero}
      onBack={() => setScreen("hub")}
      onBuyHero={handleBuyHero}
      language={language}
      onExit={onExit}
    />
  );
  if (screen === "cards") return (
    <CardsScreen gameData={gameData} onBack={() => setScreen("hub")} language={language} onExit={onExit}/>
  );
  if (screen === "achievements") return (
    <AchievementsScreen gameData={gameData} onBack={() => setScreen("hub")} language={language} onExit={onExit}/>
  );
  if (screen === "results") return (
    <ResultsScreen
      result={lastResult}
      mission={currentMission}
      newAchievements={newAchievements}
      onContinue={() => setScreen("hub")}
      language={language}
      onExit={onExit}
    />
  );
  if (screen === "play") return (
    <GameTimer
      selectedHero={selectedHero}
      currentMission={currentMission}
      onMissionComplete={handleMissionComplete}
      onBack={onExit || (() => setScreen("hub"))}
    />
  );
  return null;
}

export default SmartSmileUltimateGame;
