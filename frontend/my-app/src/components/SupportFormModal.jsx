import React, { useEffect, useMemo } from "react";
import {
  Modal,
  Form,
  Input,
  Upload,
  Button,
  Typography,
  message,
  Space,
} from "antd";
import { InboxOutlined, CustomerServiceOutlined } from "@ant-design/icons";

const { Text } = Typography;

export default function SupportFormModal({
  open,
  onClose,
  onSubmit,
  defaults = {},

  // OPTIONAL (won’t break if you don’t pass them)
  mode = "form", // "form" | "chatbase" | "both"
  chatbaseScriptSrc, // e.g. "https://www.chatbase.co/embed.min.js"
  chatbaseChatbotId, // your chatbot id
  chatbaseDomain = "www.chatbase.co",
}) {
  const [form] = Form.useForm();

  const initialValues = useMemo(() => {
    const { name = "", email = "", subject = "" } = defaults || {};
    return { name, email, subject, details: "", files: [] };
  }, [defaults]);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue(initialValues);
  }, [open, form, initialValues]);

  // --- Optional Chatbase embed loader (only if you choose to use it) ---
  useEffect(() => {
    if (!open) return;
    if (mode === "form") return;
    if (!chatbaseScriptSrc || !chatbaseChatbotId) return;

    // avoid injecting script multiple times
    const existing = document.querySelector('script[data-chatbase="embed"]');
    if (existing) return;

    window.chatbase =
      window.chatbase ||
      function () {
        (window.chatbase.q = window.chatbase.q || []).push(arguments);
      };
    window.chatbase("init", {
      chatbotId: chatbaseChatbotId,
      domain: chatbaseDomain,
    });

    const s = document.createElement("script");
    s.src = chatbaseScriptSrc;
    s.async = true;
    s.defer = true;
    s.dataset.chatbase = "embed";
    document.body.appendChild(s);
  }, [open, mode, chatbaseScriptSrc, chatbaseChatbotId, chatbaseDomain]);

  const normFile = (e) => (Array.isArray(e) ? e : e?.fileList || []);

  const handleFinish = async (values) => {
    const payload = {
      name: values?.name || "",
      email: values?.email || "",
      subject: values?.subject || "",
      details: values?.details || "",
      files: (values?.files || []).map((f) => ({
        name: f?.name,
        size: f?.size,
        type: f?.type,
        uid: f?.uid,
      })),
      createdAt: new Date().toISOString(),
      source: "support_modal",
    };

    try {
      if (onSubmit) await onSubmit(payload);
      else console.log("[SupportFormModal] submit", payload);

      message.success("Thanks! We received your request.");
      form.resetFields();
      onClose?.();
    } catch (e) {
      console.error(e);
      message.error("Could not send your request. Please try again.");
    }
  };

  const closeAndReset = () => {
    form.resetFields();
    onClose?.();
  };

  // Footer behavior:
  // - If mode is "form": show Cancel + Send in footer (no extra button in body)
  // - If mode includes chatbase: show a "Open Help Chat" button too
  const footer = (
    <Space>
      <Button onClick={closeAndReset}>Cancel</Button>

      {(mode === "chatbase" || mode === "both") && (
        <Button
          icon={<CustomerServiceOutlined />}
          onClick={() => {
            // if Chatbase is initialized, open the widget (behavior depends on Chatbase embed)
            // safest: scroll to embed container if present
            const el = document.getElementById("chatbase-embed");
            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
          Open Help Chat
        </Button>
      )}

      {mode !== "chatbase" && (
        <Button type="primary" onClick={() => form.submit()}>
          Send
        </Button>
      )}
    </Space>
  );

  return (
    <Modal
      title="Contact Support"
      open={open}
      onCancel={closeAndReset}
      footer={footer}
      destroyOnClose
    >
      <Text type="secondary">
        Tell us what you need help with. We usually reply within a few hours.
      </Text>

      {/* CHATBASE EMBED (optional) */}
      {(mode === "chatbase" || mode === "both") && (
        <div style={{ marginTop: 14 }}>
          <div
            id="chatbase-embed"
            style={{
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 12,
              overflow: "hidden",
              minHeight: 360,
            }}
          >
            {/* Many Chatbase embeds render into a placeholder automatically.
                If yours requires an iframe snippet, paste it here instead. */}
            <div style={{ padding: 12 }}>
              <Text type="secondary">Loading help chat…</Text>
            </div>
          </div>

          {mode === "both" && (
            <div style={{ marginTop: 14 }}>
              <Text type="secondary">Or send a request below:</Text>
            </div>
          )}
        </div>
      )}

      {/* SUPPORT FORM */}
      {mode !== "chatbase" && (
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 12 }}
          onFinish={handleFinish}
          requiredMark={false}
        >
          <Form.Item name="name" label="Name">
            <Input placeholder="Your name" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[{ type: "email", message: "Enter a valid email" }]}
          >
            <Input placeholder="name@example.com" />
          </Form.Item>

          <Form.Item name="subject" label="Subject">
            <Input placeholder="e.g., Change dates / seat / cancel booking" />
          </Form.Item>

          <Form.Item
            name="details"
            label="Details"
            rules={[{ required: true, message: "Please describe the issue" }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="Explain what you need help with…"
            />
          </Form.Item>

          <Form.Item
            name="files"
            label="Attachments"
            valuePropName="fileList"
            getValueFromEvent={normFile}
          >
            <Upload.Dragger
              multiple
              beforeUpload={() => false}
              accept="image/*,application/pdf"
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">
                Click or drag file to this area to upload
              </p>
              <p className="ant-upload-hint">
                Screenshots or PDFs help us resolve faster.
              </p>
            </Upload.Dragger>
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}