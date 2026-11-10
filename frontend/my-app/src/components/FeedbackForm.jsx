import React, { useState } from "react";
import { Card, Form, Input, Button, message } from "antd";

const { TextArea } = Input;

const FeedbackForm = () => {
  const [loading, setLoading] = useState(false);

  const handleSubmit = (values) => {
    console.log("📩 Submitted Feedback:", values); 

    setLoading(true);
    setTimeout(() => {
      message.success("Thanks for your feedback!");
      setLoading(false);
    }, 1000);
  };

  return (
    <Card
      title="💬 We'd love your feedback!"
      bordered={false}
      style={{ maxWidth: 600, margin: "3rem auto" }}
    >
      <Form layout="vertical" onFinish={handleSubmit}>
        <Form.Item name="name" label="Name (optional)">
          <Input placeholder="Your name" />
        </Form.Item>

        <Form.Item
          name="feedback"
          label="Your feedback"
          rules={[{ required: true, message: "Please share your feedback." }]}
        >
          <TextArea
            rows={4}
            placeholder="Let us know what you loved or what could be better…"
          />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            Submit
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default FeedbackForm;
