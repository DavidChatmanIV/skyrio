import React, { useMemo, useState } from "react";
import {
  Button,
  Card,
  Avatar,
  Segmented,
  Input,
  Progress,
  Tag,
  List,
} from "antd";
import {
  UserOutlined,
  HomeOutlined,
  CameraOutlined,
  TeamOutlined,
  MessageOutlined,
  BarChartOutlined,
  BookOutlined,
  EnvironmentOutlined,
  FireOutlined,
  ThunderboltOutlined,
  GlobalOutlined,
  PlusOutlined,
} from "@ant-design/icons";

import "@/styles/SkyHubFeed.css";

const { TextArea } = Input;

const mockPosts = {
  forYou: [
    {
      id: 1,
      user: "Maya",
      location: "Kyoto, Japan",
      content:
        "Just found the most peaceful hidden tea spot in Kyoto. Definitely one of my favorite travel moments so far.",
      vibe: "Trending",
    },
    {
      id: 2,
      user: "Jordan",
      location: "Santorini, Greece",
      content:
        "Sunset here really looks unreal in person. SkyHub needs a save-memory button for moments like this.",
      vibe: "Hot",
    },
  ],
  friends: [
    {
      id: 3,
      user: "Chris",
      location: "Bali, Indonesia",
      content:
        "Finally checked Bali off my list. Good food, good energy, and the views are crazy.",
      vibe: "Friend Trip",
    },
  ],
  trending: [
    {
      id: 4,
      user: "Ava",
      location: "Paris, France",
      content:
        "Everybody is posting Paris right now and honestly I get it. The city still hits every time.",
      vibe: "Trending",
    },
    {
      id: 5,
      user: "Leo",
      location: "Tokyo, Japan",
      content:
        "Tokyo might be one of the best places for food, nightlife, and clean city energy all in one.",
      vibe: "Rising",
    },
  ],
};

const trendingDestinations = [
  { id: 1, name: "Kyoto, Japan", posts: "2.4k posts" },
  { id: 2, name: "Santorini, Greece", posts: "1.8k posts" },
  { id: 3, name: "Bali, Indonesia", posts: "3.1k posts" },
];

export default function SkyHubFeed() {
  const [activeFeed, setActiveFeed] = useState("For You");
  const [momentText, setMomentText] = useState("");

  const feedItems = useMemo(() => {
    if (activeFeed === "Friends") return mockPosts.friends;
    if (activeFeed === "Trending") return mockPosts.trending;
    return mockPosts.forYou;
  }, [activeFeed]);

  return (
    <div className="skyhub-page">
      <div className="skyhub-shell skyhub-shell--social">
        {/* LEFT RAIL */}
        <aside className="skyhub-leftRail">
          <Card className="skyhub-profileCard">
            <div className="skyhub-profileTop">
              <Avatar
                size={68}
                icon={<UserOutlined />}
                className="skyhub-avatar"
              />
              <div className="skyhub-profileMeta">
                <h3>user</h3>
                <p>XP Level 1</p>
              </div>
            </div>

            <div className="skyhub-nav">
              <Button block className="skyhub-navBtn" icon={<HomeOutlined />}>
                Home
              </Button>
              <Button
                block
                className="skyhub-navBtn active"
                icon={<CameraOutlined />}
              >
                Moments
              </Button>
              <Button block className="skyhub-navBtn" icon={<TeamOutlined />}>
                Circles
              </Button>
              <Button
                block
                className="skyhub-navBtn"
                icon={<MessageOutlined />}
              >
                DMs
              </Button>
              <Button
                block
                className="skyhub-navBtn"
                icon={<BarChartOutlined />}
              >
                Insights
              </Button>
              <Button block className="skyhub-navBtn" icon={<BookOutlined />}>
                Saved
              </Button>
            </div>
          </Card>
        </aside>

        {/* CENTER FEED */}
        <main className="skyhub-centerFeed">
          <Card className="skyhub-glassCard skyhub-shareCard skyhub-shareCard--top">
            <div className="skyhub-shareTop">
              <Avatar icon={<UserOutlined />} className="skyhub-shareAvatar" />
              <div className="skyhub-shareMain">
                <TextArea
                  rows={3}
                  value={momentText}
                  onChange={(e) => setMomentText(e.target.value)}
                  placeholder="Share a travel moment, destination, or quick update..."
                  className="skyhub-textarea"
                />

                <div className="skyhub-shareActions">
                  <div className="skyhub-shareHints">
                    <Tag icon={<EnvironmentOutlined />}>Add location</Tag>
                    <Tag icon={<ThunderboltOutlined />}>Boost with XP</Tag>
                    <Tag icon={<GlobalOutlined />}>Travel vibe</Tag>
                  </div>

                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    className="skyhub-shareBtn"
                  >
                    Share
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <Card className="skyhub-glassCard skyhub-feedCard">
            <div className="skyhub-feedHeader">
              <div>
                <h2>SkyHub Feed</h2>
                <p>See what travelers are sharing right now</p>
              </div>

              <Segmented
                options={["For You", "Friends", "Trending"]}
                value={activeFeed}
                onChange={setActiveFeed}
                className="skyhub-segmented"
              />
            </div>

            <div className="skyhub-postList">
              {feedItems.map((post) => (
                <div key={post.id} className="skyhub-postCard">
                  <div className="skyhub-postTop">
                    <div className="skyhub-postUser">
                      <Avatar icon={<UserOutlined />} />
                      <div>
                        <strong>{post.user}</strong>
                        <p>{post.location}</p>
                      </div>
                    </div>

                    <Tag className="skyhub-postTag">{post.vibe}</Tag>
                  </div>

                  <p className="skyhub-postContent">{post.content}</p>

                  <div className="skyhub-postActions">
                    <Button type="text" className="skyhub-postActionBtn">
                      Like
                    </Button>
                    <Button type="text" className="skyhub-postActionBtn">
                      Comment
                    </Button>
                    <Button type="text" className="skyhub-postActionBtn">
                      Save
                    </Button>
                    <Button type="text" className="skyhub-postActionBtn">
                      Share
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </main>

        {/* RIGHT SUPPORT RAIL */}
        <aside className="skyhub-rightRail">
          <Card className="skyhub-glassCard skyhub-mapCard">
            <div className="skyhub-cardHeader">
              <div>
                <h2>Travel Map</h2>
                <p>Track your journey across the world</p>
              </div>
            </div>

            <div className="skyhub-mapPreview">
              <div className="skyhub-mapOverlay">
                <EnvironmentOutlined />
                <span>Map preview</span>
              </div>
            </div>

            <Button type="primary" className="skyhub-mapBtn">
              View your map
            </Button>

            <div className="skyhub-recentPlaces">
              <h4>Recent Places</h4>
              <div className="skyhub-placeList">
                <span>Tokyo</span>
                <span>Paris</span>
                <span>Bali</span>
              </div>
            </div>
          </Card>

          <Card className="skyhub-glassCard skyhub-snapshotCard skyhub-snapshotCard--side">
            <div className="skyhub-cardHeader">
              <div className="skyhub-cardTitleWrap">
                <div className="skyhub-miniBadge">Y</div>
                <div>
                  <h2>Journey Snapshot</h2>
                  <p>Your travel activity at a glance</p>
                </div>
              </div>
              <Tag className="skyhub-orangeTag">Explorer</Tag>
            </div>

            <div className="skyhub-xpRow">
              <div>
                <h3>340 XP</h3>
                <p>500 XP to next level</p>
              </div>
            </div>

            <Progress
              percent={68}
              showInfo={false}
              strokeColor="#ff9b3d"
              trailColor="rgba(255,255,255,0.12)"
              className="skyhub-progress"
            />

            <div className="skyhub-statGrid skyhub-statGrid--compact">
              <div className="skyhub-statBox">
                <strong>7</strong>
                <span>Countries</span>
              </div>
              <div className="skyhub-statBox">
                <strong>23</strong>
                <span>Trips</span>
              </div>
              <div className="skyhub-statBox">
                <strong>12</strong>
                <span>Posts</span>
              </div>
              <div className="skyhub-statBox">
                <strong>4</strong>
                <span>Saved</span>
              </div>
            </div>
          </Card>

          <Card className="skyhub-glassCard skyhub-trendingCard">
            <div className="skyhub-cardHeader">
              <div>
                <h2>Trending Destinations</h2>
                <p>Popular places travelers are talking about</p>
              </div>
            </div>

            <List
              dataSource={trendingDestinations}
              renderItem={(item) => (
                <List.Item className="skyhub-trendingItem">
                  <div className="skyhub-trendingLeft">
                    <div className="skyhub-trendingIcon">
                      <FireOutlined />
                    </div>
                    <div>
                      <strong>{item.name}</strong>
                      <p>{item.posts}</p>
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </aside>
      </div>
    </div>
  );
}