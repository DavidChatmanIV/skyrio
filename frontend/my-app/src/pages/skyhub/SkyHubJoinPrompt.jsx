import React from "react";
import { Modal } from "antd";
import { Link } from "react-router-dom";
import "@/styles/require-account.css";

/*
  Shown when a logged-out visitor tries to post, like, comment, follow,
  save, report or block on SkyHub. After signing up or logging in,
  they come straight back to /skyhub.
*/

const BACK_TO = { redirectTo: "/skyhub" };

const PostcardIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="22"
    height="22"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M22 2 11 13" />
    <path d="m22 2-7 20-4-9-9-4z" />
  </svg>
);

function JoinButtons({ onClick }) {
  return (
    <div className="sk-gateActions">
      <Link
        to="/register"
        state={BACK_TO}
        className="sk-gateBtn sk-gatePrimary"
        onClick={onClick}
      >
        Create your profile
      </Link>
      <Link
        to="/login"
        state={BACK_TO}
        className="sk-gateBtn sk-gateSecondary"
        onClick={onClick}
      >
        I already have an account
      </Link>
    </div>
  );
}

/* Pop-up for actions (like, follow, save, report, block, post) */
export function SkyHubJoinModal({ action, onClose }) {
  return (
    <Modal
      open={!!action}
      onCancel={onClose}
      footer={null}
      centered
      width={440}
      // Above the comment drawer (zIndex 2000) so it never opens behind it
      zIndex={2100}
      className="skyhub-modal"
      destroyOnHidden
    >
      <div style={{ textAlign: "center", padding: "8px 4px 4px" }}>
        <div className="sk-gateIcon">
          <PostcardIcon />
        </div>
        <h2 className="sk-gateTitle" style={{ color: "#fff" }}>
          Create a profile to {action}
        </h2>
        <p className="sk-gateText">
          Post your own postcards, follow travelers, save tips and earn XP on
          your Digital Passport.
        </p>
        <p className="sk-gateText sk-gateFaint">Creating a profile is free.</p>
        <JoinButtons onClick={onClose} />
      </div>
    </Modal>
  );
}

/* Inline card that replaces the composer for logged-out visitors */
export function SkyHubJoinCard() {
  return (
    <div style={{ textAlign: "center", padding: "6px 0 2px" }}>
      <p className="sk-gateText" style={{ marginBottom: 4 }}>
        Create a free profile to send your own postcards and earn XP.
      </p>
      <JoinButtons />
    </div>
  );
}
