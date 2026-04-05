import React from "react";
import "@/styles/CirclesPage.css";

export default function CirclesPage() {
  return (
    <div className="circlesPage">
      <div className="circlesHero">
        <h2>Circles</h2>
        <p>
          Small groups for planning trips together, sharing updates, and keeping
          your travel crew close.
        </p>

        <div className="circlesHeroActions">
          <button className="circlesGhostBtn">← Back to Moments</button>
          <button className="circlesPrimaryBtn">+ Create Circle</button>
        </div>
      </div>

      <div className="circlesGrid">
        <section className="glassCard circlesMainPanel">
          <input
            className="circlesSearch"
            placeholder="Search circles or members"
          />

          <div className="circlesFilters">
            <button className="circleChip active">All</button>
            <button className="circleChip">Planning</button>
            <button className="circleChip">Voting</button>
            <button className="circleChip">Booked</button>
          </div>

          <article className="glassCard circleCard">
            <h3>Japan Spring Crew</h3>
            <p className="circleLocation">Tokyo + Kyoto</p>
            <span className="circleTag">Planning</span>

            <div className="circleMembers">
              <span>DC</span>
              <span>MJ</span>
              <span>TA</span>
              <span>KL</span>
            </div>

            <p className="circleUpdate">Next: Budget review tonight</p>
            <p className="circleSubtle">4 new updates</p>
          </article>

          <article className="glassCard circleCard">
            <h3>Miami Escape</h3>
            <p className="circleLocation">Miami Beach</p>
            <span className="circleTag">Voting</span>

            <div className="circleMembers">
              <span>AK</span>
              <span>RM</span>
              <span>DS</span>
            </div>

            <p className="circleUpdate">Vote on hotel by 8 PM</p>
            <p className="circleSubtle">2 pending decisions</p>
          </article>
        </section>

        <aside className="glassCard circlesSidePanel">
          <h3>Launch-Ready Circle Tools</h3>

          <ul>
            <li>Group voting for hotels, flights, and activities</li>
            <li>Shared trip planning and quick crew updates</li>
            <li>Future upgrade: live chat, polls, itinerary sync</li>
          </ul>

          <div className="circlesTipCard">
            <strong>Pro tip</strong>
            <p>
              Keep this lightweight for launch, then layer in realtime and smart
              planning features later.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}