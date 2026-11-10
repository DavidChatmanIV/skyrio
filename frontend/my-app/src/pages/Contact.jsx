// src/pages/Contact.jsx
import React from "react";
import { Typography, Form, Input, Button } from "antd";

const { Title, Paragraph } = Typography;

const Contact = () => {
  return (
    <section style={{ padding: "60px 20px" }}>
      <Title level={2}>📬 Contact Us</Title>
      <Paragraph>
        Have questions or feedback? Reach out and we&apos;ll be in touch!
      </Paragraph>

      <Form
        layout="vertical"
        style={{ maxWidth: 600 }}
        onFinish={() => alert("Message sent!")}
      >
        <Form.Item label="Name" name="name" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item label="Email" name="email" rules={[{ required: true }]}>
          <Input type="email" />
        </Form.Item>
        <Form.Item label="Message" name="message" rules={[{ required: true }]}>
          <Input.TextArea rows={4} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit">
            Send Message
          </Button>
        </Form.Item>
      </Form>
    </section>
  );
};

export default Contact;
