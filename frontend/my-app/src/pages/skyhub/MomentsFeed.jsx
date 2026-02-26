import React from "react";
import ShareMomentModal from "./ShareMomentModal";
import PostCard from "./PostCard";

const MOCK_POSTS = [
  {
    id: 1,
    name: "Yuki Hayashi",
    username: "yuki1987",
    time: "20m",
    location: "Kyoto, Japan",
    text: "Just hiked the hidden bamboo trail in Kyoto. Absolutely magical! ✨ #Kyoto",
    image: "/images/kyoto.jpg", // put this in /public/images/kyoto.jpg
    avatar: "/images/yuki.png", // optional
  },
  {
    id: 2,
    name: "Marcus Lee",
    username: "marcuslee",
    time: "1h",
    location: "Paris, France",
    text: "Golden hour by the Seine hits different.",
    image: "/images/paris.jpg",
  },
  {
    id: 3,
    name: "Aisha Carter",
    username: "aishac",
    time: "3h",
    location: "Bali, Indonesia",
    text: "Sunset surf session ✅",
    image: "/images/bali.jpg",
  },
];

export default function MomentsFeed() {
  return (
    <div className="momentsWrap">
      <div className="momentsPanel">
        <ShareMomentModal />

        <div className="momentsList">
          {MOCK_POSTS.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </div>
    </div>
  );
}
