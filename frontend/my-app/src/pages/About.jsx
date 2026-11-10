import React from "react";
import { Typography } from "antd";

const { Title, Paragraph } = Typography;

const About = () => {
  return (
    <section style={{ padding: "60px 20px" }}>
      <Title level={2}>🌍 About One Sky Quest</Title>
      <Paragraph style={{ maxWidth: 800 }}>
        One Sky Quest is your ultimate travel companion — built to help modern
        travelers like you plan unforgettable journeys, discover hidden gems,
        and connect with a global community. Whether you&apos;re chasing sunsets or
        building dream trips with AI, we're here to help you travel smarter,
        better, and together.
      </Paragraph>
    </section>
  );
};

export default About;
