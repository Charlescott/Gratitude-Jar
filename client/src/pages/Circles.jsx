import React, { useEffect, useState } from "react";
import "./styles.css";

export default function CirclesPage() {
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    // Trigger the fade-in animation after mount
    const timer = setTimeout(() => setShowContent(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="app-container">
      <div className="circles-page">
        {/* Animated gradient circle background */}
        <div className="circle-gradient-wrapper">
          <div className="circle-gradient circle-gradient-1"></div>
          <div className="circle-gradient circle-gradient-2"></div>
          <div className="circle-gradient circle-gradient-3"></div>
        </div>

        {/* Main content */}
        <div className={`circles-content ${showContent ? "show" : ""}`}>
          <h1 className="circles-title">Circles</h1>

          <p className="circles-description">
            Create intimate spaces where gratitude flows freely. Circles are
            your private communities—invite friends, family, or colleagues to
            share moments of appreciation together. Celebrate the good in each
            other's lives, anonymously or openly, in a warm space built for
            connection.
          </p>

          <button className="btn btn-primary">Create Your First Circle</button>

          <p className="circles-hint">
            Start small. Start now. Start together.
          </p>
        </div>
      </div>

      <style>{`
        .circles-page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          position: relative;
          overflow: hidden;
          isolation: isolate;
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
          font-family: inherit;
          background: linear-gradient(135deg, #2f80ed, #27ae60);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
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

        .circles-content .btn-primary {
          margin-bottom: 1rem;
          font-size: 1.05rem;
          padding: 0.85rem 2rem;
          box-shadow: 0 10px 30px rgba(47, 128, 237, 0.3);
        }

        .circles-content .btn-primary:hover {
          box-shadow: 0 14px 40px rgba(47, 128, 237, 0.4);
        }

        .circles-hint {
          font-size: 0.95rem;
          color: var(--muted-text);
          font-style: italic;
          opacity: 0.7;
          margin-top: 1rem;
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
          .circles-title {
            font-size: 2.5rem;
          }

          .circles-description {
            font-size: 1rem;
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
