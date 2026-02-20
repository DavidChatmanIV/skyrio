import React, { useMemo, useState } from "react";
import { Modal, Input, Upload, Button, message } from "antd";
import { PlusOutlined, UploadOutlined } from "@ant-design/icons";
import "./MomentsFeed.css";


const { TextArea } = Input;

const DEMO_POSTS = [
  {
    id: "demo_1",
    name: "Yuki Hayashi",
    handle: "@yukitravels",
    verified: true,
    location: "Kyoto, Japan",
    time: "20m",
    text: "Just hiked the hidden bamboo trail in Kyoto. Absolutely magical! ✨  #Kyoto",
    images: [
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&q=70",
      "https://images.unsplash.com/photo-1516900557549-41557f7ff3b2?auto=format&fit=crop&w=1400&q=70",
    ],
    likes: 12,
    comments: 3,
    saved: false,
  },
  {
    id: "demo_2",
    name: "Emi Tanaka",
    handle: "@emitakesoff",
    verified: true,
    location: "Okinawa, Japan",
    time: "45m",
    text: "Golden hour in Okinawa. Pure bliss 🌅💞",
    images: [
      "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1400&q=70",
    ],
    likes: 15,
    comments: 2,
    saved: false,
  },
];

export default function MomentsFeed({ posts = [] }) {
  const allPosts = useMemo(() => [...posts, ...DEMO_POSTS], [posts]);

  const [open, setOpen] = useState(false);
  const [caption, setCaption] = useState("");
  const [fileList, setFileList] = useState([]);

  const openComposer = () => setOpen(true);
  const closeComposer = () => setOpen(false);

  const handlePost = () => {
    if (!caption.trim() && fileList.length === 0) {
      message.info("Add a caption or photo to post a moment.");
      return;
    }

    message.success("Moment ready (hook to backend next).");
    setCaption("");
    setFileList([]);
    setOpen(false);
  };

  return (
    <section className="skyhub-feed">
      {/* ✅ Composer bar (REAL button = permanent click reliability) */}
      <button
        type="button"
        className="skyhub-composer skyhub-composerClickable"
        onClick={openComposer}
        aria-label="Share a moment"
      >
        <div className="skyhub-composerPlus">
          <PlusOutlined />
        </div>
        <div className="skyhub-composerText">
          Share a moment from your trip...
        </div>
      </button>

      {/* ✅ Modal */}
      <Modal
        open={open}
        onCancel={closeComposer}
        onOk={handlePost}
        okText="Post"
        title="Share a Moment"
        centered
      >
        <div style={{ display: "grid", gap: 12 }}>
          <TextArea
            rows={4}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="What happened? Drop a quick caption..."
          />

          <Upload
            listType="picture"
            fileList={fileList}
            beforeUpload={() => false}
            onChange={({ fileList: next }) => setFileList(next)}
            maxCount={2}
          >
            <Button icon={<UploadOutlined />}>Add photo (up to 2)</Button>
          </Upload>

          <div style={{ fontSize: 12, opacity: 0.7 }}>
            For March launch: this modal is UI-only. Next step is saving moments
            to MongoDB.
          </div>
        </div>
      </Modal>

      {/* Feed list */}
      <div className="skyhub-feedList">
        {allPosts.map((p) => {
          const imgCount = p.images?.length || 0;

          return (
            <article key={p.id} className="skyhub-post">
              <div className="skyhub-postHeader">
                <div className="skyhub-user">
                  <div className="skyhub-avatar" aria-hidden="true" />
                  <div className="skyhub-userMeta">
                    <div className="skyhub-nameRow">
                      <div className="skyhub-name">{p.name}</div>
                      {p.verified && (
                        <span className="skyhub-pill">Verified</span>
                      )}
                    </div>

                    <div className="skyhub-subRow">
                      <span className="skyhub-handle">{p.handle}</span>
                      {p.location ? (
                        <>
                          <span className="skyhub-dot">•</span>
                          <span className="skyhub-location">{p.location}</span>
                        </>
                      ) : null}
                      <span className="skyhub-dot">•</span>
                      <span className="skyhub-time">{p.time}</span>
                    </div>
                  </div>
                </div>

                <button
                  className="skyhub-moreBtn"
                  type="button"
                  aria-label="More"
                >
                  …
                </button>
              </div>

              {p.text ? <div className="skyhub-text">{p.text}</div> : null}

              {imgCount > 0 && (
                <div className="skyhub-media">
                  <div
                    className="skyhub-grid"
                    style={{
                      gridTemplateColumns: imgCount === 1 ? "1fr" : "1fr 1fr",
                    }}
                  >
                    {p.images.slice(0, 2).map((src, idx) => (
                      <img key={idx} src={src} alt={`Moment ${idx + 1}`} />
                    ))}
                  </div>
                </div>
              )}

              <div className="skyhub-postFooter">
                <div className="skyhub-actions">
                  <button className="skyhub-action" type="button">
                    ❤ <span>{p.likes}</span>
                  </button>
                  <button className="skyhub-action" type="button">
                    💬 <span>{p.comments}</span>
                  </button>
                </div>

                <button className="skyhub-saveBtn" type="button">
                  🔖 Save
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
