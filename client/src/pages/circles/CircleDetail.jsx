import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  fetchCircleById,
  fetchCircleMembers,
  fetchCircleEntries,
  createCircleEntry,
  deleteCircleEntry,
  leaveCircle,
  deleteCircle,
} from "../../api";
import { getRandomQuestion } from "../../api/questions";
import {
  clearCirclesCache,
  getCircleDetailCache,
  patchCircleDetailCache,
  clearCircleDetailCache,
} from "./Circles";

const MAX_VISIBLE_ENTRIES = 5;

export default function CircleDetail({ token }) {
  const { id } = useParams();
  const navigate = useNavigate();
  // Seed initial state from the module-scoped cache if we have it — avoids the
  // "Loading…" flash when navigating in from the circles list or from the
  // freshly-created "Share Gratitude" flow.
  const initialCached = getCircleDetailCache(id) || {};
  const [circle, setCircle] = useState(initialCached.circle ?? null);
  const [error, setError] = useState("");
  const [entries, setEntries] = useState(initialCached.entries ?? []);
  const [isLoadingEntries, setIsLoadingEntries] = useState(
    initialCached.entries == null,
  );
  const [isLoadingOlderEntries, setIsLoadingOlderEntries] = useState(false);
  const [entriesHasMore, setEntriesHasMore] = useState(
    Boolean(initialCached.hasMore),
  );
  const [entriesOffset, setEntriesOffset] = useState(initialCached.offset ?? 0);
  const entriesPageSize = 60;
  const [newEntry, setNewEntry] = useState("");
  const [postAnonymously, setPostAnonymously] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [prompt, setPrompt] = useState(null);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [showExplore, setShowExplore] = useState(false);
  const [entryPositions, setEntryPositions] = useState({});
  const [showArchive, setShowArchive] = useState(false);
  const [members, setMembers] = useState(initialCached.members ?? []);
  const [membersOpen, setMembersOpen] = useState(false);
  const [focusedEntryId, setFocusedEntryId] = useState(null);
  const [isEntering, setIsEntering] = useState(false);
  const [draggingEntryId, setDraggingEntryId] = useState(null);
  const [slidingEntries, setSlidingEntries] = useState({});
  const membersDropdownRef = useRef(null);
  const entriesListRef = useRef(null);
  const dragRef = useRef(null);
  const ignoreClickRef = useRef({ id: null, until: 0 });
  const inertiaRafsRef = useRef(new Map());
  const circleRadiusCacheRef = useRef({ value: null, ts: 0 });

  function getCircleRadiusPx() {
    const now = performance.now();
    const cached = circleRadiusCacheRef.current;
    if (cached.value != null && now - cached.ts < 250) return cached.value;

    let entriesRadius = window.innerWidth <= 768 ? 220 : 320;
    const el = entriesListRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      entriesRadius = Math.min(rect.width, rect.height) / 2;
    }

    let ringRadius = null;
    const ringEl = document.querySelector(".circle-gradient-wrapper");
    if (ringEl) {
      const before = window.getComputedStyle(ringEl, "::before");
      const w = parseFloat(before.width);
      const h = parseFloat(before.height);
      if (Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0) {
        ringRadius = Math.min(w, h) / 2;
      }
    }

    const radius = Math.max(entriesRadius, ringRadius || 0);
    circleRadiusCacheRef.current = { value: radius, ts: now };
    return radius;
  }

  function clampToCircle(x, y, entryRadius = 56) {
    const circleRadius = getCircleRadiusPx();
    const padding = 4;
    const maxDist = Math.max(0, circleRadius - entryRadius - padding);
    const dist = Math.hypot(x, y);
    if (dist <= maxDist || dist === 0) return { x, y, hitEdge: false };
    const scale = maxDist / dist;
    return { x: x * scale, y: y * scale, hitEdge: true };
  }

  function stopInertia(entryId) {
    const rafId = inertiaRafsRef.current.get(entryId);
    if (rafId) cancelAnimationFrame(rafId);
    inertiaRafsRef.current.delete(entryId);
    setSlidingEntries((prev) => {
      if (!prev[entryId]) return prev;
      const next = { ...prev };
      delete next[entryId];
      return next;
    });
  }

  useEffect(() => {
    // Background refetch while any cached state keeps the UI populated.
    setError("");
    setFocusedEntryId(null);
    setDraggingEntryId(null);
    setSlidingEntries({});
    dragRef.current = null;
    for (const rafId of inertiaRafsRef.current.values()) {
      cancelAnimationFrame(rafId);
    }
    inertiaRafsRef.current.clear();

    const cached = getCircleDetailCache(id) || {};
    const hadCachedEntries = cached.entries != null;

    fetchCircleById(token, id)
      .then((c) => {
        setCircle(c);
        patchCircleDetailCache(id, { circle: c });
      })
      .catch((err) => setError(err.message));

    if (!hadCachedEntries) setIsLoadingEntries(true);
    fetchCircleEntries(token, id, { limit: entriesPageSize, offset: 0 })
      .then((payload) => {
        const items = Array.isArray(payload) ? payload : payload.items || [];
        const hasMore = Boolean(payload?.hasMore);
        const nextOffset = Number.isFinite(payload?.offset) ? payload.offset : 0;
        const limit = Number.isFinite(payload?.limit) ? payload.limit : items.length;
        const offset = nextOffset + limit;
        setEntries(items);
        setEntriesHasMore(hasMore);
        setEntriesOffset(offset);
        patchCircleDetailCache(id, { entries: items, hasMore, offset });
      })
      .catch((err) => setError(err.message || "Failed to load circle entries."))
      .finally(() => setIsLoadingEntries(false));

    fetchCircleMembers(token, id)
      .then((m) => {
        setMembers(m);
        patchCircleDetailCache(id, { members: m });
      })
      .catch(() => setMembers([]));
  }, [id, token]);

  async function loadOlderEntries() {
    if (isLoadingOlderEntries || isLoadingEntries || !entriesHasMore) return;

    setIsLoadingOlderEntries(true);
    try {
      const payload = await fetchCircleEntries(token, id, {
        limit: entriesPageSize,
        offset: entriesOffset,
      });
      const items = Array.isArray(payload) ? payload : payload.items || [];
      const hasMore = Boolean(payload?.hasMore);
      const nextOffset = Number.isFinite(payload?.offset) ? payload.offset : entriesOffset;
      const limit = Number.isFinite(payload?.limit) ? payload.limit : items.length;

      setEntries((prev) => [...prev, ...items]);
      setEntriesHasMore(hasMore);
      setEntriesOffset(nextOffset + limit);
    } catch (err) {
      setError(err.message || "Failed to load older entries.");
    } finally {
      setIsLoadingOlderEntries(false);
    }
  }

  useLayoutEffect(() => {
    setIsEntering(true);
    document.body.classList.add("circles-celebrating");
    document.body.classList.add("circle-detail-view");
    document.body.classList.add("circle-detail-enter");
    const enterTimer = window.setTimeout(() => {
      document.body.classList.remove("circle-detail-enter");
    }, 1200);
    const enteringTimer = window.setTimeout(() => {
      setIsEntering(false);
    }, 1650);

    return () => {
      window.clearTimeout(enterTimer);
      window.clearTimeout(enteringTimer);
      document.body.classList.remove("circles-celebrating");
      document.body.classList.remove("circle-detail-view");
      document.body.classList.remove("circle-detail-enter");
      setIsEntering(false);
    };
  }, [id]);

  useEffect(() => {
    const flag = localStorage.getItem("show_explore_prompt");
    if (flag) {
      setShowExplore(true);
      localStorage.removeItem("show_explore_prompt");
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        membersDropdownRef.current &&
        !membersDropdownRef.current.contains(e.target)
      ) {
        setMembersOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const rafs = inertiaRafsRef.current;
    return () => {
      for (const rafId of rafs.values()) {
        cancelAnimationFrame(rafId);
      }
      rafs.clear();
    };
  }, []);

  useEffect(() => {
    function invalidate() {
      circleRadiusCacheRef.current = { value: null, ts: 0 };
    }

    window.addEventListener("resize", invalidate);
    return () => window.removeEventListener("resize", invalidate);
  }, []);

  const visibleEntries = useMemo(
    () => entries.slice(0, MAX_VISIBLE_ENTRIES),
    [entries]
  );
  const archivedEntries = useMemo(
    () => entries.slice(MAX_VISIBLE_ENTRIES),
    [entries]
  );

  function setEntryPosition(entryId, x, y) {
    setEntryPositions((prev) => {
      const existing = prev[entryId] || {};
      return { ...prev, [entryId]: { ...existing, x, y } };
    });
  }

  function startInertia(entryId, initialVx, initialVy) {
    const maxSpeed = 1.25; // px/ms
    let vx = Math.max(-maxSpeed, Math.min(maxSpeed, initialVx || 0));
    let vy = Math.max(-maxSpeed, Math.min(maxSpeed, initialVy || 0));
    let lastTs = performance.now();

    setSlidingEntries((prev) => ({ ...prev, [entryId]: true }));

    const tick = (now) => {
      const dt = Math.min(40, Math.max(8, now - lastTs));
      lastTs = now;

      const decayPerMs = 0.0065;
      const decay = Math.exp(-decayPerMs * dt);
      vx *= decay;
      vy *= decay;

      setEntryPositions((prev) => {
        const existing = prev[entryId] || {};
        const entryRadius = existing.radius || 56;
        const nextX = (existing.x || 0) + vx * dt;
        const nextY = (existing.y || 0) + vy * dt;
        const clamped = clampToCircle(nextX, nextY, entryRadius);

        if (clamped.hitEdge) {
          const dist = Math.hypot(clamped.x, clamped.y);
          if (dist > 0.0001) {
            const nx = clamped.x / dist;
            const ny = clamped.y / dist;
            const outward = vx * nx + vy * ny;
            if (outward > 0) {
              vx -= outward * nx;
              vy -= outward * ny;
              vx *= 0.65;
              vy *= 0.65;
            }
          }
        }

        return { ...prev, [entryId]: { ...existing, x: clamped.x, y: clamped.y } };
      });

      if (Math.hypot(vx, vy) < 0.02) {
        inertiaRafsRef.current.delete(entryId);
        setSlidingEntries((prev) => {
          if (!prev[entryId]) return prev;
          const next = { ...prev };
          delete next[entryId];
          return next;
        });
        return;
      }

      const rafId = requestAnimationFrame(tick);
      inertiaRafsRef.current.set(entryId, rafId);
    };

    const rafId = requestAnimationFrame(tick);
    inertiaRafsRef.current.set(entryId, rafId);
  }

  useLayoutEffect(() => {
    if (visibleEntries.length === 0) return;
    const radius = window.innerWidth <= 768 ? 190 : 290;
    const basePadding = window.innerWidth <= 768 ? 12 : 16;
    const maxAttempts = 600;

    setEntryPositions((prev) => {
      const visibleIds = new Set(visibleEntries.map((entry) => entry.id));
      const next = {};
      for (const [id, pos] of Object.entries(prev)) {
        if (visibleIds.has(Number(id))) {
          next[id] = pos;
        }
      }
      const existing = Object.values(next);

      function estimateRadius(entry) {
        const contentLength = (entry.content || "").length;
        const nameLength = (entry.name || "").length;
        const score = contentLength + nameLength * 0.6;
        const min = window.innerWidth <= 768 ? 48 : 58;
        const max = window.innerWidth <= 768 ? 88 : 104;
        return Math.max(min, Math.min(max, 38 + score * 0.38));
      }

      function isFarEnough(x, y, candidateRadius) {
        for (const pos of existing) {
          const dx = x - pos.x;
          const dy = y - pos.y;
          const required = (pos.radius || 52) + candidateRadius + basePadding;
          if (Math.hypot(dx, dy) < required) {
            return false;
          }
        }
        return true;
      }

      for (const entry of visibleEntries) {
        if (next[entry.id]) continue;
        const candidateRadius = estimateRadius(entry);
        const safetyRadius = candidateRadius + 8;
        let placed = false;
        let attempt = 0;

        while (!placed && attempt < maxAttempts) {
          const angle = Math.random() * Math.PI * 2;
          const distance = Math.sqrt(Math.random()) * radius;
          const x = Math.cos(angle) * distance;
          const y = Math.sin(angle) * distance;
          if (isFarEnough(x, y, safetyRadius)) {
            const rotate = (Math.random() * 6 - 3).toFixed(1);
            next[entry.id] = { x, y, rotate, radius: safetyRadius };
            existing.push(next[entry.id]);
            placed = true;
          }
          attempt += 1;
        }

        if (!placed) {
          // Deterministic sweep fallback: try outer rings before giving up.
          let fallbackPlaced = false;
          for (let distance = radius * 0.55; distance <= radius; distance += 14) {
            for (let angleStep = 0; angleStep < 24; angleStep += 1) {
              const angle = (Math.PI * 2 * angleStep) / 24;
              const x = Math.cos(angle) * distance;
              const y = Math.sin(angle) * distance;
              if (isFarEnough(x, y, safetyRadius)) {
                const rotate = (Math.random() * 6 - 3).toFixed(1);
                next[entry.id] = { x, y, rotate, radius: safetyRadius };
                existing.push(next[entry.id]);
                fallbackPlaced = true;
                break;
              }
            }
            if (fallbackPlaced) break;
          }

          if (!fallbackPlaced) {
            // Last resort: place on perimeter with stable spacing.
            const angle = (Math.PI * 2 * existing.length) / Math.max(visibleEntries.length, 1);
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            const rotate = (Math.random() * 6 - 3).toFixed(1);
            next[entry.id] = { x, y, rotate, radius: safetyRadius };
            existing.push(next[entry.id]);
          }
        }
      }
      return next;
    });
  }, [visibleEntries]);

  const areEntryPositionsReady = useMemo(() => {
    if (visibleEntries.length === 0) return true;
    return visibleEntries.every((entry) => Boolean(entryPositions[entry.id]));
  }, [entryPositions, visibleEntries]);

  function handleEntryPointerDown(event, entryId) {
    if (event.target.closest(".circle-entry-delete")) return;
    if (event.button !== 0 && event.pointerType !== "touch") return;

    event.stopPropagation();
    stopInertia(entryId);

    const now = performance.now();
    const origin = entryPositions[entryId] || {};
    dragRef.current = {
      entryId,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: origin.x || 0,
      originY: origin.y || 0,
      entryRadius: origin.radius || 56,
      moved: false,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      lastTs: now,
      vx: 0,
      vy: 0,
    };

    setDraggingEntryId(entryId);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleEntryPointerMove(event) {
    const drag = dragRef.current;
    if (!drag) return;
    if (event.pointerId !== drag.pointerId) return;

    const now = performance.now();
    const dt = Math.max(8, now - drag.lastTs);
    drag.vx = (event.clientX - drag.lastClientX) / dt;
    drag.vy = (event.clientY - drag.lastClientY) / dt;
    drag.lastClientX = event.clientX;
    drag.lastClientY = event.clientY;
    drag.lastTs = now;

    const dx = event.clientX - drag.startClientX;
    const dy = event.clientY - drag.startClientY;
    if (!drag.moved && Math.hypot(dx, dy) <= 6) return;
    drag.moved = true;

    const desiredX = drag.originX + dx;
    const desiredY = drag.originY + dy;
    const clamped = clampToCircle(desiredX, desiredY, drag.entryRadius);
    setEntryPosition(drag.entryId, clamped.x, clamped.y);
  }

  function handleEntryPointerUp(event) {
    const drag = dragRef.current;
    if (!drag) return;
    if (event.pointerId !== drag.pointerId) return;

    dragRef.current = null;
    setDraggingEntryId(null);

    if (!drag.moved) return;
    ignoreClickRef.current = { id: drag.entryId, until: Date.now() + 500 };
    startInertia(drag.entryId, drag.vx, drag.vy);
  }

  if (error) return <p>{error}</p>;

  async function handlePost() {
    if (!newEntry.trim() || isPosting) return;

    setIsPosting(true);
    setError("");

    try {
      const entry = await createCircleEntry(
        token,
        id,
        newEntry,
        undefined,
        postAnonymously
      );
      setEntries((prev) => {
        const next = [entry, ...prev];
        patchCircleDetailCache(id, { entries: next });
        return next;
      });
      setNewEntry("");
      setPostAnonymously(false);
    } catch (err) {
      setError(err.message || "Failed to share gratitude.");
    } finally {
      setIsPosting(false);
    }
  }

  async function handleDeleteEntry(entryId) {
    const ok = window.confirm("Delete this entry?");
    if (!ok) return;

    try {
      await deleteCircleEntry(token, id, entryId);
      setEntries((prev) => {
        const next = prev.filter((entry) => entry.id !== entryId);
        patchCircleDetailCache(id, { entries: next });
        return next;
      });
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleHelpMeOut() {
    setLoadingPrompt(true);
    try {
      const question = await getRandomQuestion();
      setPrompt(question.text);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPrompt(false);
    }
  }

  async function handleLeave() {
    const ok = window.confirm(
      "Leave this circle? You will lose access to its shared gratitude.",
    );
    if (!ok) return;

    try {
      await leaveCircle(token, id);
      clearCirclesCache();
      clearCircleDetailCache(id);
      navigate("/circles");
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDelete() {
    const ok = window.confirm(
      "Delete this circle for everyone? This cannot be undone.",
    );
    if (!ok) return;

    try {
      await deleteCircle(token, id);
      clearCirclesCache();
      clearCircleDetailCache(id);
      navigate("/circles");
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div
      className={`circle-detail ${
        isLoadingEntries
          ? "loading-entries"
          : entries.length
            ? "has-entries"
            : "no-entries"
      } ${isEntering ? "entering" : ""}`}
    >
      {/* Header */}
      <section className="circle-header">
        <h1>{circle?.name ?? "\u00A0"}</h1>
        <div className="circle-members-dropdown" ref={membersDropdownRef}>
          <button
            type="button"
            className="circle-members-toggle"
            onClick={() => setMembersOpen((prev) => !prev)}
            aria-expanded={membersOpen}
            aria-haspopup="true"
            disabled={!circle}
          >
            {circle
              ? `${circle.member_count} member${circle.member_count !== 1 ? "s" : ""} ▾`
              : "\u00A0"}
          </button>

          <div className={`circle-members-menu ${membersOpen ? "open" : ""}`}>
            {members.length === 0 ? (
              <p className="circle-members-empty">No members found.</p>
            ) : (
              <ul className="circle-members-list">
                {members.map((member) => (
                  <li key={member.id} className="circle-member-item">
                    {member.name || "Unnamed member"}
                    {member.is_owner ? " (Owner)" : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {circle?.is_owner && circle.invite_key && (
          <button
            className="btn-help circle-invite-btn"
            onClick={() => {
              const link = `${window.location.origin}/?join=${circle.invite_key}`;
              navigator.clipboard.writeText(link);
              alert("Invite link copied to clipboard!");
            }}
          >
            Invite people
          </button>
        )}
      </section>

      {/* Shared Gratitude (empty for now) */}
      <section className="circle-gratitude">
        {isLoadingEntries ? (
          <p className="muted">Loading circle entries…</p>
        ) : !areEntryPositionsReady ? (
          <p className="muted">Arranging entries…</p>
        ) : visibleEntries.length === 0 ? (
          <p className="muted">
            Nothing has been shared yet. Be the first to start the ripple.
          </p>
        ) : (
          <div
            className="entries-list"
            ref={entriesListRef}
            onClick={() => {
              if (draggingEntryId) return;
              setFocusedEntryId(null);
            }}
          >
            {visibleEntries.map((e, index) => {
              const isFocused = focusedEntryId === e.id;
              const isDragging = draggingEntryId === e.id;
              const isSliding = Boolean(slidingEntries[e.id]);
              const rotate = isFocused ? 0 : entryPositions[e.id]?.rotate || 0;
              const scale = isFocused ? 1.3 : 1;
              const revealDelay = 760 + ((e.id * 97 + index * 53) % 380);
              const x = entryPositions[e.id]?.x || 0;
              const y = entryPositions[e.id]?.y || 0;

              return (
                <div
                  key={e.id}
                  className={`circle-entry-card ${isFocused ? "focused" : ""} ${isDragging ? "dragging" : ""} ${isSliding ? "sliding" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-label="Expand entry"
                  onPointerDown={(event) => handleEntryPointerDown(event, e.id)}
                  onPointerMove={handleEntryPointerMove}
                  onPointerUp={handleEntryPointerUp}
                  onPointerCancel={handleEntryPointerUp}
                  onClick={(event) => {
                    event.stopPropagation();
                    const ignore = ignoreClickRef.current;
                    if (ignore?.id === e.id && Date.now() < ignore.until) return;
                    setFocusedEntryId((prev) => (prev === e.id ? null : e.id));
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setFocusedEntryId((prev) => (prev === e.id ? null : e.id));
                    }
                  }}
                  style={{
                    "--entry-delay": `${revealDelay}ms`,
                    left: "50%",
                    top: "50%",
                    transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${rotate}deg) scale(${scale})`,
                    zIndex: isFocused ? 25 : isDragging ? 24 : 2,
                  }}
                >
                  {e.is_mine && (
                    <button
                      type="button"
                      className="circle-entry-delete"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDeleteEntry(e.id);
                      }}
                      aria-label="Delete entry"
                      title="Delete entry"
                    >
                      ×
                    </button>
                  )}
                  <p>{e.content}</p>
                  <small className="circle-entry-author">
                    <span className="circle-entry-dash">–</span> {e.name}
                  </small>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {showExplore && (
        <section className="circle-explore">
          <p className="circle-explore-title">Explore more of Gratitude</p>
          <p className="circle-explore-text">
            You can also keep personal gratitude entries and set reminders.
          </p>
          <div className="circle-explore-actions">
            <button
              className="btn-help circle-explore-link"
              onClick={() => navigate("/entries")}
            >
              Go to Entries
            </button>
            <button
              className="btn-help circle-explore-link"
              onClick={() => navigate("/reminders")}
            >
              Set Reminders
            </button>
            <button
              className="circle-explore-dismiss"
              onClick={() => setShowExplore(false)}
            >
              Dismiss
            </button>
          </div>
        </section>
      )}

      {/* Actions */}
      <section className="circle-actions">
        <textarea
          value={newEntry}
          onChange={(e) => setNewEntry(e.target.value)}
          placeholder={prompt || "Share something you're grateful for..."}
          disabled={isPosting}
        />

        <div className="circle-actions-row">
          <button className="btn btn-primary" onClick={handlePost} disabled={isPosting}>
            {isPosting ? "Sharing..." : "Share Gratitude"}
          </button>

          <button
            type="button"
            className="btn-help"
            onClick={handleHelpMeOut}
          >
            {loadingPrompt ? "Thinking…" : "Help me out"}
          </button>
        </div>

        <label className="checkbox-label circle-anon-toggle">
          <input
            type="checkbox"
            checked={postAnonymously}
            onChange={(e) => setPostAnonymously(e.target.checked)}
            disabled={isPosting}
          />
          Post anonymously in this circle
        </label>

        {archivedEntries.length > 0 && (
          <div className="circle-archive">
            <button
              type="button"
              className="circle-archive-toggle"
              onClick={() => setShowArchive((prev) => !prev)}
            >
              {showArchive
                ? "Hide older entries"
                : `View older entries (${archivedEntries.length})`}
            </button>

            {showArchive && (
              <div className="circle-archive-list">
                {archivedEntries.map((entry) => (
                  <div key={entry.id} className="circle-archive-item">
                    <p>{entry.content}</p>
                    <small className="circle-entry-author">
                      <span className="circle-entry-dash">–</span> {entry.name}
                    </small>
                  </div>
                ))}

                {entriesHasMore && (
                  <button
                    type="button"
                    className="circle-archive-toggle"
                    onClick={loadOlderEntries}
                    disabled={isLoadingOlderEntries}
                    style={{ marginTop: "0.75rem" }}
                  >
                    {isLoadingOlderEntries ? "Loading…" : "Load older entries"}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Membership actions */}
      <section className="circle-member-actions">
        {circle?.is_owner ? (
          <button className="circle-danger-link" onClick={handleDelete}>
            Delete Circle
          </button>
        ) : circle ? (
          <button className="circle-danger-link" onClick={handleLeave}>
            Leave Circle
          </button>
        ) : null}
      </section>
    </div>
  );
}
