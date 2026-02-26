import React, { useState } from "react";
import { Input, Typography, Alert } from "antd";

const { Title } = Typography;

const ProfileMusic = () => {
  const [link, setLink] = useState("");
  const [embed, setEmbed] = useState("");

  const handleLinkChange = (e) => {
    const value = e.target.value;
    setLink(value);

    // Handle Spotify
    if (value.includes("spotify.com")) {
      const embedLink = value.replace("/track/", "/embed/track/");
      setEmbed(
        `<iframe style="border-radius:12px" src="${embedLink}" width="100%" height="80" frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`
      );
    }
    // Handle YouTube
    else if (value.includes("youtube.com/watch?v=")) {
      const videoId = value.split("v=")[1].split("&")[0];
      setEmbed(
        `<iframe width="100%" height="120" src="https://www.youtube.com/embed/${videoId}" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>`
      );
    }
    // Handle Apple Music
    else if (value.includes("music.apple.com")) {
      setEmbed(
        `<iframe allow="autoplay *; encrypted-media *;" frameborder="0" height="150" style="width:100%;max-width:660px;overflow:hidden;background:transparent;" sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation" src="https://embed.music.apple.com/us/song/${value
          .split("/")
          .pop()}"></iframe>`
      );
    } else {
      setEmbed("");
    }
  };

  return (
    <div className="mt-4">
      <Title level={5}>🎶 Profile Music</Title>
      <Input
        placeholder="Paste your Apple Music, Spotify, or YouTube link"
        value={link}
        onChange={handleLinkChange}
      />
      {embed ? (
        <div className="mt-4" dangerouslySetInnerHTML={{ __html: embed }} />
      ) : link.length > 10 ? (
        <Alert
          message="Unsupported or invalid link."
          type="warning"
          showIcon
          className="mt-4"
        />
      ) : null}
    </div>
  );
};

export default ProfileMusic;
