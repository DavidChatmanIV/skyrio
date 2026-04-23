import React, { useState } from "react";
import { Input, Button, message, Card } from "antd";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "@/lib/api";

const SignupForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    referralCode: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSignup = async () => {
    try {
      const res = await fetch(apiUrl("/api/auth/signup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Signup failed");

      localStorage.setItem("token", data.token);
      if (formData.referralCode) {
        localStorage.setItem("referralXpEarned", "true");
      }

      const bonus = formData.referralCode
        ? " You earned XP from referral 🎉"
        : "";
      message.success("Signup successful!" + bonus);
      navigate("/dashboard");
    } catch (err) {
      message.error(err.message);
    }
  };

  return (
    <div className="flex justify-center p-8">
      <Card title="Sign Up" style={{ width: 400 }}>
        <Input
          name="username"
          placeholder="Username"
          value={formData.username}
          onChange={handleChange}
          style={{ marginBottom: 12 }}
        />
        <Input
          name="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
          style={{ marginBottom: 12 }}
        />
        <Input.Password
          name="password"
          placeholder="Password"
          value={formData.password}
          onChange={handleChange}
          style={{ marginBottom: 12 }}
        />
        <Input
          name="referralCode"
          placeholder="Referral Code (optional)"
          value={formData.referralCode}
          onChange={handleChange}
          style={{ marginBottom: 16 }}
        />
        <Button type="primary" block onClick={handleSignup}>
          ✍️ Sign Up
        </Button>
      </Card>
    </div>
  );
};

export default SignupForm;
