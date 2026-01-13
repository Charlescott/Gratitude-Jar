import React, { useEffect, useState } from "react";

export default function CirclesPage() {
  const [showContent, setShowContent] = useState(false);
  const [view, setView] = useState("welcome"); // 'welcome', 'create', 'join'
  const [circleName, setCircleName] = useState("");
  const [circleKey, setCircleKey] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [myCircles, setMyCircles] = useState([]); // Store created circles
  const [isShrinking, setIsShrinking] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

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

  const handleCreateCircle = () => {
    setView("create");
  };

  const handleJoinCircle = () => {
    setView("join");
  };

  const handleSubmitCreate = (name) => {
    if (name.trim()) {
      const key = Math.random().toString(36).substring(2, 8).toUpperCase();
      const link = `https://gratuityjar.app/circles/join/${key}`;
      setCircleKey(key);
      setInviteLink(link);

      // Add to myCircles array
      setMyCircles([...myCircles, { name, key, link }]);
    }
  };

  const handleBack = () => {
    setIsShrinking(true);
    setShowWelcome(true); // Start showing content immediately
    setTimeout(() => {
      setView("welcome");
      setCircleName("");
      setCircleKey("");
      setInviteLink("");
      setIsShrinking(false);
    }, 1200); // Match the shrink animation duration
  };

  const handleCircleClick = (circle) => {
    setCircleName(circle.name);
    setCircleKey(circle.key);
    setInviteLink(circle.link);
    setView("create");
  };

  return (
    <div className="app-container">
      <div className="circles-page">
        {/* Animated gradient circle background */}
        <div
          className={`circle-gradient-wrapper ${
            circleKey && !isShrinking ? "celebrating" : ""
          } ${isShrinking ? "shrinking" : ""}`}
        >
          <div className="circle-gradient circle-gradient-1"></div>
          <div className="circle-gradient circle-gradient-2"></div>
          <div className="circle-gradient circle-gradient-3"></div>
        </div>

        {/* Welcome View */}
        {(view === "welcome" || isShrinking) && (
          <div
            className={`circles-content ${
              showContent && showWelcome ? "show" : ""
            }`}
          >
            <h1 className="circles-title">
              {myCircles.length > 0 ? "My Circles" : "Circles"}
            </h1>

            {myCircles.length === 0 && (
              <p className="circles-description">
                Create intimate spaces where gratitude flows freely. Circles are
                your private communities—invite friends, family, or colleagues
                to share moments of appreciation together. Celebrate the good in
                each other's lives, anonymously or openly, in a warm space built
                for connection.
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
              <p className="circles-hint">
                Start small. Start now. Start together.
              </p>
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

                <button className="btn btn-primary share-gratitude-btn">
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
                  onClick={() => {
                    if (circleKey.trim()) {
                      console.log("Joining circle with key:", circleKey);
                      // TODO: API call to join circle
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
      </div>

      <style>{`
        .circles-page {
          min-height: calc(100vh - 120px);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          position: relative;
          overflow: hidden;
          isolation: isolate;
          margin-top: -60px;
          padding: 2rem;
        }

        /* Animated gradient ring */
        .circle-gradient-wrapper::before {
          content: '';
          position: absolute;
          width: 600px;
          height: 600px;
          border-radius: 50%;
          background: conic-gradient(
            from 0deg,
            rgba(47, 128, 237, 0.6),
            rgba(39, 174, 96, 0.6),
            rgba(255, 127, 80, 0.6),
            rgba(47, 128, 237, 0.6)
          );
          mask: radial-gradient(circle, transparent 65%, black 66%, black 68%, transparent 69%);
          -webkit-mask: radial-gradient(circle, transparent 65%, black 66%, black 68%, transparent 69%);
          animation: rotateRing 12s linear infinite;
          opacity: 0.7;
          transition: all 0.8s ease;
        }

        .circle-gradient-wrapper.celebrating::before {
          width: 700px;
          height: 700px;
          opacity: 0.9;
          animation: rotateRing 12s linear infinite, expandRing 1.2s ease forwards;
        }

        .circle-gradient-wrapper.shrinking::before {
          animation: rotateRing 12s linear infinite, shrinkRing 1.2s ease forwards;
        }

        @keyframes expandRing {
          from {
            width: 600px;
            height: 600px;
            opacity: 0.7;
          }
          to {
            width: 700px;
            height: 700px;
            opacity: 0.9;
          }
        }

        @keyframes shrinkRing {
          from {
            width: 700px;
            height: 700px;
            opacity: 0.9;
          }
          to {
            width: 600px;
            height: 600px;
            opacity: 0.7;
          }
        }

        @keyframes rotateRing {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        /* Gradient circle animations */
        .circle-gradient-wrapper {
          position: absolute;
          inset: 0;
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: -1;
        }

        .circle-gradient {
          position: absolute;
          border-radius: 50%;
          filter: blur(60px);
          opacity: 0;
          animation: circleGlow 8s ease-in-out infinite;
        }

        .circle-gradient-1 {
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(47, 128, 237, 0.25), transparent 70%);
          animation-delay: 0s;
        }

        .circle-gradient-2 {
          width: 400px;
          height: 400px;
          background: radial-gradient(circle, rgba(39, 174, 96, 0.2), transparent 70%);
          animation-delay: 2.6s;
        }

        .circle-gradient-3 {
          width: 350px;
          height: 350px;
          background: radial-gradient(circle, rgba(255, 127, 80, 0.15), transparent 70%);
          animation-delay: 5.2s;
        }

        @keyframes circleGlow {
          0%, 100% {
            opacity: 0;
            transform: scale(0.8);
          }
          50% {
            opacity: 1;
            transform: scale(1.1);
          }
        }

        /* Main content styling */
        .circles-content {
          max-width: 600px;
          width: 100%;
          text-align: center;
          padding: 2rem;
          opacity: 0;
          transform: translateY(30px);
          transition: opacity 1.2s ease, transform 1.2s ease;
          z-index: 1;
        }

        .circles-content.show {
          opacity: 1;
          transform: translateY(0);
        }

        .circles-title {
          font-size: 3.5rem;
          font-weight: 700;
          color: var(--text-color);
          margin-bottom: 1.5rem;
          font-family: "Segoe UI", sans-serif;
        }

        .circles-description {
          font-size: 1.15rem;
          line-height: 1.8;
          color: var(--muted-text);
          margin-bottom: 2.5rem;
          max-width: 540px;
          margin-left: auto;
          margin-right: auto;
        }

        [data-theme="dark"] .circles-description {
          opacity: 0.9;
        }

        .circles-content .btn-primary,
        .circles-content .btn-secondary {
          font-size: 1.05rem;
          padding: 0.75rem 1.75rem;
          min-width: 140px;
        }

        .circles-content .btn-primary {
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
        }

        .circles-content .btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.2);
          opacity: 0.95;
        }

        .circles-content .btn-primary:active {
          transform: translateY(0);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18);
        }

        .circles-content .btn-secondary {
          box-shadow: 0 5px 14px rgba(0, 0, 0, 0.12);
        }

        .circles-content .btn-secondary:hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.2);
          opacity: 0.95;
        }

        .circles-content .btn-secondary:active {
          transform: translateY(0);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18);
        }

        .circles-hint {
          font-size: 0.95rem;
          color: var(--muted-text);
          font-style: italic;
          opacity: 0.7;
          margin-top: 1rem;
        }

        /* Form styling */
        .circle-form {
          text-align: center;
          max-width: 500px;
          margin: 0 auto;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-group label {
          display: block;
          text-align: center;
          margin-bottom: 0.75rem;
        }

        .form-group input {
          width: 100%;
          box-sizing: border-box;
        }

        /* Input field styling - no border until focus */
        input,
        textarea {
          border: 1px solid transparent;
          background-color: var(--bg-color);
          color: var(--text-color);
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        input:focus,
        textarea:focus {
          outline: none;
          border-color: var(--accent-color);
          box-shadow: 0 0 0 3px rgba(255, 127, 80, 0.25);
        }

        .circle-created {
          animation: fadeIn 0.8s ease;
        }

        .celebration-text {
          margin-bottom: 2rem;
          font-size: 1.2rem;
          font-weight: 600;
        }

        .share-gratitude-btn {
          font-size: 1.4rem;
          padding: 1.1rem 3rem;
          margin: 2rem auto 1.5rem;
          display: block;
        }

        .back-btn-small {
          font-size: 0.9rem;
          padding: 0.5rem 1rem;
          min-width: 100px;
          margin-top: 1.5rem;
        }

        .circle-details {
          background: var(--card-bg);
          backdrop-filter: blur(8px);
          border-radius: 12px;
          padding: 0.75rem;
          margin: 0 auto;
          max-width: 400px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        .detail-row {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
        }

        .detail-section-compact {
          text-align: center;
          min-width: 120px;
        }

        .detail-label {
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--muted-text);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.4rem;
        }

        .detail-value-compact {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-color);
          font-family: monospace;
          letter-spacing: 0.05em;
        }

        .invite-link-short {
          font-size: 0.85rem;
          color: var(--muted-text);
        }

        /* My Circles Grid */
        .my-circles-container {
          margin: 1.5rem 0;
        }

        .circles-grid {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 0;
        }

        .circle-bubble {
          width: 90px;
          height: 90px;
          border-radius: 50%;
          background: linear-gradient(135deg, #2f80ed, #27ae60);
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.75rem;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .circle-bubble:hover {
          transform: translateY(-3px) scale(1.05);
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
        }

        .circle-bubble:active {
          transform: translateY(0) scale(1);
        }

        .circle-bubble-name {
          color: white;
          font-weight: 600;
          font-size: 0.8rem;
          text-align: center;
          word-break: break-word;
          line-height: 1.2;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
          .circles-title {
            font-size: 2.5rem;
          }

          .circles-description {
            font-size: 1rem;
          }

          .circle-gradient-wrapper::before {
            width: 400px;
            height: 400px;
          }

          .circle-gradient-1 {
            width: 350px;
            height: 350px;
          }

          .circle-gradient-2 {
            width: 280px;
            height: 280px;
          }

          .circle-gradient-3 {
            width: 240px;
            height: 240px;
          }
        }
      `}</style>
    </div>
  );
}
