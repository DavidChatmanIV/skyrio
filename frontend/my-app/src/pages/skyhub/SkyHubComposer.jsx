import React from "react";
import "@/styles/SkyHubComposer.css";
import { Button, Input, Segmented, Tag } from "antd";
import {
  EnvironmentOutlined,
  SendOutlined,
  CompassOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { skyhubPostTypes } from "./skyhubData";

const { TextArea } = Input;

export default function SkyHubComposer({
  composerText,
  setComposerText,
  activePostType,
  setActivePostType,
  destination,
  setDestination,
  onCreatePost,
  creatingPost = false,
}) {
  const charCount = composerText.length;
  const maxRecommended = 280;

  return (
    <section className="skyhub-composerCard">
      <div className="skyhub-composerTop">
        <div className="skyhub-composerTitleWrap">
          <h2 className="skyhub-sectionTitle">Share with the community</h2>
          <p className="skyhub-sectionSubtext">
            Post travel tips, ask smart questions, and help other travelers move
            better.
          </p>
        </div>
      </div>

      {/* POST TYPE */}
      <div className="skyhub-composerTypeRow">
        <div className="skyhub-toolbarLabel">Post type</div>
        <Segmented
          options={skyhubPostTypes}
          value={activePostType}
          onChange={setActivePostType}
          block
        />
      </div>

      {/* INPUTS */}
      <div className="skyhub-composerInputs">
        <div className="skyhub-composerField">
          <div className="skyhub-composerFieldLabel">Destination</div>
          <Input
            size="large"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Add destination or city"
            prefix={<EnvironmentOutlined />}
            className="skyhub-input"
          />
        </div>

        <div className="skyhub-composerField">
          <div className="skyhub-composerFieldLabel">Your post</div>
          <TextArea
            value={composerText}
            onChange={(e) => setComposerText(e.target.value)}
            placeholder="Share a travel tip, story, question, meetup idea, or something useful..."
            autoSize={{ minRows: 5, maxRows: 8 }}
            className="skyhub-textarea"
          />
        </div>
      </div>

      {/* META */}
      <div className="skyhub-composerMetaRow">
        <div className="skyhub-composerHints">
          <Tag className="skyhub-softTag" icon={<CompassOutlined />}>
            Travel-first
          </Tag>
          <Tag className="skyhub-softTag" icon={<InfoCircleOutlined />}>
            Helpful posts win
          </Tag>
          <Tag className="skyhub-softTag">{activePostType}</Tag>
        </div>

        <div
          className={`skyhub-charCount ${
            charCount > maxRecommended ? "is-over" : ""
          }`}
        >
          {charCount}/{maxRecommended}
        </div>
      </div>

      {/* FOOTER */}
      <div className="skyhub-composerFooter">
        <div className="skyhub-composerHelperText">
          Keep it useful, clear, and travel-related so the right people can find
          it.
        </div>

        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={onCreatePost}
          className="skyhub-primaryBtn"
          loading={creatingPost}
        >
          Post to SkyHub
        </Button>
      </div>
    </section>
  );
}
