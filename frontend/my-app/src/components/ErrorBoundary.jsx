import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Log for now — wire this into Sentry or similar once monitoring is set up.
    console.error("[ErrorBoundary] Caught a render error:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#0f0520",
            color: "#fff",
            fontFamily: "'DM Sans', sans-serif",
            padding: 24,
            textAlign: "center",
          }}
        >
          <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700 }}>
            Something went wrong
          </h2>
          <p
            style={{
              color: "rgba(255,255,255,0.5)",
              margin: "0 0 24px",
              fontSize: 14,
              maxWidth: 320,
            }}
          >
            Your session may have just needed a refresh. Tap below to reload.
          </p>
          <button
            onClick={this.handleReload}
            style={{
              background: "linear-gradient(135deg, #ff8a2a, #ffb347)",
              color: "#1b1024",
              border: "none",
              borderRadius: 999,
              padding: "14px 36px",
              fontWeight: 800,
              fontSize: 15,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
