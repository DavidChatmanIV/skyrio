import React from "react";

/*
  Catches crashes in any page (including lazy pages that fail to load)
  so visitors see a message instead of a blank screen.
  In development it also shows the actual error so it's easy to fix.
*/
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[Skyrio] Page crashed:", error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    // Clear the error when the user navigates to another page
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 20,
          background: "#0a0617",
          color: "#f0edff",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <div style={{ maxWidth: 520, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, margin: "0 0 10px" }}>
            This page didn't load
          </h1>
          <p style={{ color: "rgba(240,237,255,0.65)", margin: "0 0 20px" }}>
            Try reloading. If it keeps happening, let us know through Get help.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "12px 28px",
              borderRadius: 12,
              border: "none",
              background: "linear-gradient(135deg, #ff8a2a, #ffb066)",
              color: "#1a0800",
              fontWeight: 800,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Reload page
          </button>

          {import.meta.env.DEV && (
            <pre
              style={{
                marginTop: 24,
                padding: 14,
                borderRadius: 12,
                background: "rgba(255,77,79,0.12)",
                border: "1px solid rgba(255,99,99,0.4)",
                color: "#ffd9d6",
                fontSize: 12,
                textAlign: "left",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {String(error?.stack || error)}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
