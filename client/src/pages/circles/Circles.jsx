import React, { useEffect, useState } from "react";
import "./circles.css";
import { useNavigate } from "react-router-dom";

import { fetchCircles, createCircle, joinCircle } from "../../api";

export default function CirclesPage({ token }) {
  const [showContent, setShowContent] = useState(false);
  const [view, setView] = useState("welcome"); // 'welcome', 'create', 'join'
  const [circleName, setCircleName] = useState("");
  const [circleKey, setCircleKey] = useState("");
  const [circleId, setCircleId] = useState(null);
  const [inviteLink, setInviteLink] = useState("");
  const [myCircles, setMyCircles] = useState([]); // Store created circles
  const [isShrinking, setIsShrinking] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [animate, setAnimate] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (view === "welcome") {
      // Delay showing welcome content to allow for smooth transition
      const timer = setTimeout(() => setShowWelcome(true), 100);
      return () => clearTimeout(timer);
    } else {
      setShowWelcome(false);
    }
  }, [view]);

  useEffect(() => {
    async function loadCircles() {
      try {
        const circles = await fetchCircles(token);
        setMyCircles(circles);
      } catch (err) {
        console.error("Failed to load circles", err);
      }
    }

    if (token) {
      loadCircles();
    }
  }, [token]);

  useEffect(() => {
    const body = document.body;

    if (circleKey && animate && !isShrinking) {
      body.classList.add("circles-celebrating");
    } else {
      body.classList.remove("circles-celebrating");
    }

    if (isShrinking) {
      body.classList.add("circles-shrinking");
    } else {
      body.classList.remove("circles-shrinking");
    }

    if (!animate) {
      body.classList.add("circles-no-animate");
    } else {
      body.classList.remove("circles-no-animate");
    }

    return () => {
      body.classList.remove(
        "circles-celebrating",
        "circles-shrinking",
        "circles-no-animate"
      );
    };
  }, [circleKey, animate, isShrinking]);

  const handleCreateCircle = () => {
    setView("create");
  };

  const handleJoinCircle = () => {
    setView("join");
  };

  const handleSubmitCreate = async (name) => {
    if (!name.trim()) return;

    try {
      const circle = await createCircle(token, name);

      setMyCircles((prev) => [circle, ...prev]);
      setCircleName(circle.name);
      setCircleKey(circle.key);
      setCircleId(circle.id);
      setInviteLink(`${window.location.origin}/?join=${circle.key}`);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleBack = () => {
    setIsShrinking(true);

    setTimeout(() => {
      setView("welcome");
      setCircleName("");
      setCircleKey("");
      setCircleId(null);
      setInviteLink("");
      setIsShrinking(false);
    }, 1200);
  };

  const handleCircleClick = (circle) => {
    navigate(`/circles/${circle.id}`);
    setCircleName(circle.name);
    setCircleKey(circle.key);
    setCircleId(circle.id);
    setInviteLink(circle.link);
    setView("create");
  };

  return (
    <>
      {/* Welcome View */}
      {view === "welcome" && (
        <div
          className={`circles-content ${showContent && showWelcome ? "show" : ""}`}
        >
          <h1 className="circles-title">
            {myCircles.length > 0 ? "My Circles" : "Circles"}
          </h1>

          {myCircles.length === 0 && (
            <p className="circles-description circles-description-intro">
              Circles are shared spaces for quiet gratitude. Create one for
              people you trust, and reflect together without noise, pressure,
              or timelines.
            </p>
          )}

          {/* Display existing circles */}
          {myCircles.length > 0 && (
            <div className="my-circles-container">
              <div className="circles-grid">
                {myCircles.map((circle, index) => (
                  <button
                    key={index}
                    className="circle-bubble"
                    onClick={() => handleCircleClick(circle)}
                  >
                    <div className="circle-bubble-name">{circle.name}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: "1rem",
              flexDirection: "column",
              alignItems: "center",
              marginBottom: "1rem",
              marginTop: myCircles.length > 0 ? "2rem" : "0",
            }}
          >
            <button className="btn btn-primary" onClick={handleCreateCircle}>
              Create {myCircles.length > 0 ? "Another" : "Your First"} Circle
            </button>

            <button className="btn btn-secondary" onClick={handleJoinCircle}>
              Join a Circle
            </button>
          </div>

          {myCircles.length === 0 && (
            <p className="circles-hint">Start small. Start now. Start together.</p>
          )}
        </div>
      )}

      {/* Create Circle View */}
      {view === "create" && (
        <div className={`circles-content show`}>
          <h1 className="circles-title">
            {circleKey ? circleName : "Create a Circle"}
          </h1>

          {!circleKey ? (
            <div className="circle-form">
              <p
                className="circles-description"
                style={{ marginBottom: "1.5rem" }}
              >
                Give your Circle a name that reflects the warmth you want to
                share.
              </p>

              <div className="form-group">
                <label
                  htmlFor="circleName"
                  style={{
                    fontSize: "0.95rem",
                    fontWeight: "500",
                    marginBottom: "0.5rem",
                    display: "block",
                    color: "var(--text-color)",
                  }}
                >
                  What would you like to call your Circle?
                </label>
                <input
                  id="circleName"
                  type="text"
                  value={circleName}
                  onChange={(e) => setCircleName(e.target.value)}
                  placeholder="Family Gratitude, Team Appreciation..."
                  autoFocus
                />
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "1rem",
                  marginTop: "1.5rem",
                  justifyContent: "center",
                }}
              >
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleSubmitCreate(circleName)}
                >
                  Create Circle
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleBack}
                >
                  Back
                </button>
              </div>
            </div>
          ) : (
            <div className="circle-created">
              <p className="circles-description celebration-text">
                Welcome home! Your Circle is ready.
              </p>

              <button
                className="btn btn-primary share-gratitude-btn"
                onClick={() => {
                  if (circleId) {
                    navigate(`/circles/${circleId}`);
                  }
                }}
              >
                Share Gratitude
              </button>

              <div className="circle-details">
                <p
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--muted-text)",
                    marginBottom: "0.75rem",
                    textAlign: "center",
                  }}
                >
                  Invite others to join your Circle by sharing:
                </p>

                <div className="detail-row">
                  <div className="detail-section-compact">
                    <div className="detail-label">Circle Key</div>
                    <div className="detail-value-compact">{circleKey}</div>
                  </div>

                  <div className="detail-section-compact">
                    <div className="detail-label">Invite Link</div>
                    <div className="detail-value-compact invite-link-short">
                      .../{circleKey}
                    </div>
                    <button
                      className="btn-help"
                      onClick={() => {
                        navigator.clipboard.writeText(inviteLink);
                        alert("Link copied to clipboard!");
                      }}
                      style={{
                        marginTop: "0.4rem",
                        fontSize: "0.7rem",
                        padding: "0.2rem 0.5rem",
                      }}
                    >
                      Copy Full Link
                    </button>
                  </div>
                </div>
              </div>

              <button
                className="btn btn-secondary back-btn-small"
                onClick={handleBack}
              >
                Back to Circles
              </button>
            </div>
          )}
        </div>
      )}

      {/* Join Circle View */}
      {view === "join" && (
        <div className={`circles-content show`}>
          <h1 className="circles-title">Join a Circle</h1>

          <div className="circle-form">
            <p
              className="circles-description"
              style={{ marginBottom: "1.5rem" }}
            >
              Enter the Circle Key you received to join a community of
              gratitude.
            </p>

            <div className="form-group">
              <label
                htmlFor="circleKey"
                style={{
                  fontSize: "0.95rem",
                  fontWeight: "500",
                  marginBottom: "0.5rem",
                  display: "block",
                  color: "var(--text-color)",
                }}
              >
                Circle Key
              </label>
              <input
                id="circleKey"
                type="text"
                value={circleKey}
                onChange={(e) => setCircleKey(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={6}
                autoFocus
                style={{
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  maxWidth: "200px",
                  margin: "0 auto",
                  textAlign: "center",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                gap: "1rem",
                marginTop: "1.5rem",
                justifyContent: "center",
              }}
            >
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  try {
                    const circle = await joinCircle(token, circleKey);
                    setMyCircles((prev) => [circle, ...prev]);
                    setView("welcome");
                    setCircleKey("");
                  } catch (err) {
                    alert(err.message);
                  }
                }}
              >
                Join Circle
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleBack}
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
