import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Player } from "../types/game";
import { getCellType } from "../game/rules";
import { Zap, Swords, Trophy, Flag, ShieldQuestion } from "lucide-react";
export function boardPoint(cell: number) {
  if (cell === 0) return { x: 110, y: 737 };
  const step = cell - 1;
  const row = Math.floor(step / 6);
  const col = row % 2 === 0 ? step % 6 : 5 - (step % 6);
  return { x: 100 + col * 160, y: 635 - row * 135 };
}
const cells = Array.from({ length: 30 }, (_, i) => i + 1);
const road = cells
  .map((n, i) => `${i ? "L" : "M"} ${boardPoint(n).x} ${boardPoint(n).y}`)
  .join(" ");
export const Board: React.FC<{
  players: Player[];
  activePlayerId?: string;
}> = ({ players, activePlayerId }) => {
  const reduce = useReducedMotion();
  return (
    <section
      className="adventure-board"
      aria-label="Tablero de Snake Word Race"
    >
      <header className="board-caption">
        <div>
          <span className="eyebrow">EL VALLE DE LAS PALABRAS</span>
          <h2>Tu aventura hacia la meta</h2>
        </div>
        <span className="finish-badge">
          <Trophy size={16} />
          30 casillas
        </span>
      </header>
      <div className="board-stage">
        <svg viewBox="0 0 1000 780" aria-hidden="true" className="board-route">
          <defs>
            <linearGradient id="road" x1="0" y1="1" x2="1" y2="0">
              <stop stopColor="#e6c992" />
              <stop offset="1" stopColor="#f6deb0" />
            </linearGradient>
            <filter id="roadshadow">
              <feDropShadow
                dx="0"
                dy="7"
                stdDeviation="2"
                floodColor="#947158"
                floodOpacity=".23"
              />
            </filter>
          </defs>
          <path
            d={road}
            fill="none"
            stroke="#b69b7440"
            strokeWidth="100"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={road}
            fill="none"
            stroke="url(#road)"
            strokeWidth="83"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#roadshadow)"
          />
          <path
            d={road}
            fill="none"
            stroke="#fff9d5"
            strokeWidth="59"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={road}
            fill="none"
            stroke="#dab978"
            strokeWidth="3"
            strokeDasharray="5 14"
          />
          {/* Illustrated snakes correspond to conditional -3 rescue penalties. */}
          {[
            [9, 6],
            [25, 22],
          ].map(([a, b]) => {
            const s = boardPoint(a),
              e = boardPoint(b);
            const d = `M${s.x + 12} ${s.y + 25} C ${s.x + 130} ${s.y + 40}, ${e.x + 50} ${e.y - 100}, ${e.x - 8} ${e.y - 25}`;
            return (
              <g key={a}>
                <path
                  d={d}
                  stroke="#a52d7040"
                  strokeWidth="24"
                  fill="none"
                  strokeLinecap="round"
                />
                <path
                  d={d}
                  stroke="#e780aa"
                  strokeWidth="17"
                  fill="none"
                  strokeLinecap="round"
                />
                <path
                  d={d}
                  stroke="#ffd1df"
                  strokeWidth="3"
                  strokeDasharray="4 17"
                  fill="none"
                />
                <ellipse
                  cx={s.x + 12}
                  cy={s.y + 25}
                  rx="18"
                  ry="13"
                  fill="#d56e9d"
                />
                <circle cx={s.x + 7} cy={s.y + 21} r="2.5" fill="#461d50" />
                <circle cx={s.x + 17} cy={s.y + 21} r="2.5" fill="#461d50" />
              </g>
            );
          })}
          {[
            [6, 8],
            [14, 16],
            [22, 24],
          ].map(([a, b]) => {
            const s = boardPoint(a),
              e = boardPoint(b);
            const dx = e.x - s.x,
              dy = e.y - s.y,
              len = Math.hypot(dx, dy),
              nx = (-dy / len) * 8,
              ny = (dx / len) * 8;
            return (
              <g key={a} stroke="#62b89e" strokeLinecap="round" opacity=".85">
                <path
                  d={`M${s.x + nx} ${s.y + ny} L${e.x + nx} ${e.y + ny} M${s.x - nx} ${s.y - ny} L${e.x - nx} ${e.y - ny}`}
                  strokeWidth="7"
                />
                {[0.2, 0.4, 0.6, 0.8].map((t) => (
                  <path
                    key={t}
                    d={`M${s.x + dx * t + nx} ${s.y + dy * t + ny} L${s.x + dx * t - nx} ${s.y + dy * t - ny}`}
                    strokeWidth="5"
                  />
                ))}
              </g>
            );
          })}
        </svg>
        {cells.map((n) => {
          const pt = boardPoint(n),
            type = getCellType(n);
          const Icon =
            type === "boost"
              ? Zap
              : type === "trap"
                ? ShieldQuestion
                : type === "duel"
                  ? Swords
                  : type === "meta"
                    ? Trophy
                    : null;
          return (
            <div
              key={n}
              className={"race-tile " + type}
              style={{ left: pt.x / 10 + "%", top: pt.y / 7.8 + "%" }}
              data-cell={n}
              aria-label={`Casilla ${n}${type === "normal" ? "" : type === "boost" ? ", impulso de dos casillas" : type === "trap" ? ", rescate" : type === "duel" ? ", duelo" : ", meta"}`}
            >
              <span className="tile-number">{n}</span>
              {Icon && <Icon aria-hidden="true" />}
              <small>
                {type === "boost"
                  ? "+2"
                  : type === "trap"
                    ? "RESCATE"
                    : type === "duel"
                      ? "DUELO"
                      : type === "meta"
                        ? "META"
                        : ""}
              </small>
            </div>
          );
        })}
        <div className="start-label">
          <Flag size={12} /> SALIDA
        </div>
        {players.map((p, i) => {
          const pt = boardPoint(Math.max(0, Math.min(30, p.position)));
          const peers = players.filter((o) => o.position === p.position);
          const offset =
            (peers.findIndex((o) => o.id === p.id) - (peers.length - 1) / 2) *
            27;
          return (
            <motion.div
              initial={false}
              key={p.id}
              className={
                "race-pawn " + (p.id === activePlayerId ? "you" : "rival")
              }
              animate={{
                left: `calc(${pt.x / 10}% + ${offset}px)`,
                top: pt.y / 7.8 + "%",
              }}
              transition={{ duration: reduce ? 0 : 0.65, ease: "easeInOut" }}
              data-player={p.id}
              data-position={p.position}
              role="img"
              aria-label={`${p.name}, casilla ${p.position}`}
            >
              <span className="pawn-crown">{i === 0 ? "✦" : "●"}</span>
              {p.id === activePlayerId || p.isBot ? (
                <img
                  src={p.isBot ? "/art/polyglot.webp" : "/art/warlock.webp"}
                  alt=""
                />
              ) : (
                <span className="pawn-face">
                  {p.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <b>
                {p.id === activePlayerId
                  ? "TÚ"
                  : p.isBot
                    ? "BOT"
                    : p.name.slice(0, 8)}
              </b>
            </motion.div>
          );
        })}
      </div>
      <footer className="board-legend">
        <span>
          <Zap />
          Impulso +2
        </span>
        <span>
          <ShieldQuestion />
          Rescate: fallar −3
        </span>
        <span>
          <Swords />
          Duelo +2
        </span>
        <span>
          <Trophy />
          Meta 30
        </span>
      </footer>
      <div className="player-strip">
        {players.map((p, i) => (
          <div key={p.id} className={p.id === activePlayerId ? "self" : ""}>
            <span className={"player-dot p" + i} />
            <strong>{p.name}</strong>
            <span>{p.position}/30</span>
            <progress
              value={p.position}
              max={30}
              aria-label={`Avance de ${p.name}`}
            />
            <small>
              {p.stats.correctCount} aciertos · {p.stats.totalAnswers}{" "}
              respuestas
            </small>
          </div>
        ))}
      </div>
    </section>
  );
};
