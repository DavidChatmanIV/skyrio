import React, { useEffect, useState } from "react";
import { Modal, Typography, Button, Space } from "antd";
import { useLocation, useNavigate } from "react-router-dom";
import { apiUrl } from "@/lib/api";

const { Title, Text } = Typography;

export default function RequireAdminBlock({
  children,
  feature = "this page",
  loginPath = "/admin/login",
}) {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const nav = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let ignore = false;

    (async () => {
      try {
        const res = await fetch(apiUrl("/api/admin/me"), {
          credentials: "include",
        });
        const data = await res.json();
        if (ignore) return;
        setIsAdmin(!!data?.isAdmin);
      } catch {
        if (!ignore) setIsAdmin(false);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, []);

  if (loading) return null;

  if (!isAdmin) {
    return (
      <>
        <Modal
          open
          footer={null}
          centered
          closable={false}
          maskClosable={false}
          title={
            <Title level={4} style={{ margin: 0 }}>
              Admin access required
            </Title>
          }
        >
          <Text style={{ display: "block", marginBottom: 12 }}>
            To view <b>{feature}</b>, please log in with your Skyrio Admin
            account.
          </Text>
          <Space style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              type="primary"
              onClick={() => {
                const returnTo = location.pathname + location.search;
                nav(loginPath, { state: { returnTo } });
              }}
            >
              Go to Admin Login
            </Button>
          </Space>
        </Modal>
        <div style={{ minHeight: "60vh" }} />
      </>
    );
  }

  return <>{children}</>;
}
