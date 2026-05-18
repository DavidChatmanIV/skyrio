import React, { useEffect, useState } from "react";
import { Modal, List, Avatar, Typography, Space, Tag, Spin } from "antd";
import { useAuth } from "../../auth/useAuth";
import { apiUrl } from "@/lib/api";
import FollowButton from "./FollowButton";

const { Text } = Typography;

function FollowerRow({ user: u, myId, token }) {
  const display = u.name || u.username || "Traveler";
  const handle = u.username ? `@${u.username}` : "";
  const isMe = myId && String(u.id || u._id) === String(myId);

  return (
    <List.Item
      className="sk-followRow"
      actions={
        isMe
          ? [] // don't show follow button on yourself
          : [
              <FollowButton
                key="follow"
                userId={u.id || u._id}
                isFollowing={!!u.isFollowing}
                size="small"
                token={token}
              />,
            ]
      }
    >
      <List.Item.Meta
        avatar={<Avatar src={u.avatarUrl || u.avatar} />}
        title={
          <Space size={8}>
            <Text className="sk-followName">{display}</Text>
            {u.isOfficial ? (
              <Tag className="sk-officialTag">Official</Tag>
            ) : null}
          </Space>
        }
        description={<Text className="sk-followHandle">{handle}</Text>}
      />
    </List.Item>
  );
}

export default function FollowersModal({
  open,
  onClose,
  mode = "following", // "following" | "followers"
}) {
  const { user, token } = useAuth();
  const myId = user?._id || user?.id || null;

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!open) return;

    async function load() {
      setLoading(true);
      try {
        const url =
          mode === "followers"
            ? apiUrl("/api/passport/followers?limit=25")
            : apiUrl("/api/passport/following?limit=25");

        const res = await fetch(url, {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (data?.ok) setItems(data.items || []);
      } catch (e) {
        console.error("FollowersModal load error:", e);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [open, mode, token]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      title={mode === "followers" ? "Followers" : "Following"}
      className="sk-followModal"
    >
      {loading ? (
        <div className="sk-followLoading">
          <Spin />
        </div>
      ) : (
        <List
          dataSource={items}
          renderItem={(u) => (
            <FollowerRow
              key={u.id || u._id}
              user={u}
              myId={myId}
              token={token}
            />
          )}
          locale={{ emptyText: "Nothing here yet." }}
        />
      )}
    </Modal>
  );
}
