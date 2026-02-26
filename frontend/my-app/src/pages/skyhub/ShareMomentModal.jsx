import React, { useState } from "react";

export default function ShareMomentModal() {
  const [text, setText] = useState("");

  const handlePost = () => {
    // keep simple for now
    // later: call API to create moment
    console.log("Post:", text);
    setText("");
  };

  return (
    <div className="shareMomentCard">
      <div className="sharePlus">+</div>

      <input
        className="shareInput"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Capture a travel moment..."
      />

      <button
        className="sharePostBtn"
        onClick={handlePost}
        disabled={!text.trim()}
      >
        Post
      </button>
    </div>
  );
}
