import React, { useMemo, useState } from "react";
import { Card, Button, Modal, Input, Upload, Space, message } from "antd";
import { PlusOutlined, PictureOutlined } from "@ant-design/icons";

import "@/styles/SkyHubFeed.css"; // keep your existing styles
// If your pill styles live elsewhere, keep that import too

const { TextArea } = Input;

export default function SkyHubFeed() {
  // ✅ modal state
  const [shareOpen, setShareOpen] = useState(false);

  // ✅ composer state
  const [caption, setCaption] = useState("");
  const [files, setFiles] = useState([]);

  // ✅ feed state (simple mock)
  const [posts, setPosts] = useState(() => [
    {
      id: "seed-1",
      name: "Yuki Hayashi",
      handle: "@yuki1987",
      location: "Kyoto, Japan",
      time: "20m",
      text: "Just hiked the hidden bamboo trail in Kyoto. Absolutely magical! ✨ #Kyoto",
      images: [],
    },
  ]);

  const canPost = useMemo(() => {
    return caption.trim().length > 0 || files.length > 0;
  }, [caption, files]);

  const openShare = () => {
    console.log("✅ Share moment clicked");
    setShareOpen(true);
  };

  const closeShare = () => setShareOpen(false);

  const handlePost = () => {
    if (!canPost) {
      message.info("Add a caption or at least one photo.");
      return;
    }

    const images = files.map((f) => f.thumbUrl || f.url).filter(Boolean);

    const newPost = {
      id: String(Date.now()),
      name: "You",
      handle: "@you",
      location: "—",
      time: "now",
      text: caption.trim(),
      images,
    };

    setPosts((prev) => [newPost, ...prev]);

    // reset
    setCaption("");
    setFiles([]);
    setShareOpen(false);
    message.success("Moment posted ✅");
  };

  return (
    <div className="skyhub-feed">
      {/* ✅ SHARE PILL (MAKE IT A REAL BUTTON) */}
      <button type="button" className="shareMomentCard" onClick={openShare}>
        <span className="sharePlus">
          <PlusOutlined />
        </span>
        <span className="sharePlaceholder">
          Share a moment from your trip...
        </span>
      </button>

      {/* ✅ MODAL */}
      <Modal
        title="Share a moment"
        open={shareOpen} // ✅ AntD v5 uses OPEN
        onCancel={closeShare}
        onOk={handlePost}
        okText="Post"
        okButtonProps={{ disabled: !canPost }}
        destroyOnClose
        centered
      >
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <TextArea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="What happened? Add a caption..."
            autoSize={{ minRows: 3, maxRows: 7 }}
          />

          <Upload
            listType="picture-card"
            fileList={files}
            onChange={({ fileList }) => setFiles(fileList)}
            beforeUpload={() => false} // ✅ local preview only
            accept="image/*"
          >
            {files.length >= 4 ? null : (
              <div style={{ display: "grid", gap: 6, placeItems: "center" }}>
                <PictureOutlined />
                <div style={{ fontSize: 12 }}>Add photo</div>
              </div>
            )}
          </Upload>
        </Space>
      </Modal>

      {/* ✅ FEED */}
      <div className="skyhub-feedList">
        {posts.map((p) => (
          <Card key={p.id} className="postCard" bordered={false}>
            <div className="postHeader">
              <div>
                <div className="postTitleRow">
                  <span className="postName">{p.name}</span>
                  <span className="postDot">•</span>
                  <span className="postTime">{p.time}</span>
                </div>
                <div className="postMetaRow">
                  <span className="postHandle">{p.handle}</span>
                  <span className="postDot">•</span>
                  <span className="postLoc">{p.location}</span>
                </div>
              </div>
            </div>

            {p.images?.length > 0 && (
              <div className="postImages">
                {p.images.slice(0, 2).map((src, idx) => (
                  <img key={idx} src={src} alt="" className="postImg" />
                ))}
              </div>
            )}

            <div className="postText">{p.text}</div>

            <Space style={{ marginTop: 10 }} wrap>
              <Button size="small">❤️ Like</Button>
              <Button size="small">💬 Comment</Button>
              <Button size="small">↗️ Share</Button>
              <Button size="small">💾 Save</Button>
            </Space>
          </Card>
        ))}
      </div>
    </div>
  );
}