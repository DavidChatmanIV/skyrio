import React, { useMemo, useState } from "react";
import { Modal, Input, Upload, Button, Space, Tag, message } from "antd";
import { PlusOutlined, PictureOutlined } from "@ant-design/icons";

const { TextArea } = Input;

export default function ShareMomentModal({ open, onClose, onSubmit }) {
  const [text, setText] = useState("");
  const [tags, setTags] = useState(["#Kyoto"]);
  const [files, setFiles] = useState([]);

  const canPost = useMemo(() => {
    return text.trim().length >= 3 || files.length > 0;
  }, [text, files]);

  const handleOk = async () => {
    if (!canPost) {
      message.info("Add a caption or at least one photo.");
      return;
    }

    // ✅ Keep it simple for March: return local preview info
    const payload = {
      text: text.trim(),
      tags,
      images: files.map((f) => f.thumbUrl || f.url).filter(Boolean),
      createdAt: Date.now(),
    };

    await onSubmit?.(payload);

    // reset
    setText("");
    setFiles([]);
    setTags(["#Kyoto"]);
    onClose?.();
  };

  return (
    <Modal
      title="Share a moment"
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText="Post"
      okButtonProps={{ disabled: !canPost }}
      destroyOnClose
      centered
      // ✅ This prevents “modal behind glass” problems in heavy UI shells
      maskClosable
      style={{ top: 24 }}
      styles={{
        mask: { backdropFilter: "blur(6px)" },
      }}
    >
      <Space direction="vertical" style={{ width: "100%" }} size={12}>
        <TextArea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What’s the moment? Add a caption..."
          autoSize={{ minRows: 3, maxRows: 7 }}
        />

        <Upload
          listType="picture-card"
          fileList={files}
          onChange={({ fileList }) => setFiles(fileList)}
          beforeUpload={() => false} // ✅ stop auto upload (simple local preview)
          accept="image/*"
        >
          {files.length >= 4 ? null : (
            <div style={{ display: "grid", gap: 6, placeItems: "center" }}>
              <PictureOutlined />
              <div style={{ fontSize: 12 }}>Add photo</div>
            </div>
          )}
        </Upload>

        <Space wrap>
          {tags.map((t) => (
            <Tag
              key={t}
              closable
              onClose={() => setTags(tags.filter((x) => x !== t))}
            >
              {t}
            </Tag>
          ))}
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setTags((prev) => [...prev, "#Skyrio"])}
          >
            Add tag
          </Button>
        </Space>
      </Space>
    </Modal>
  );
}