# Product

## Users

**Primary: Clients.** External companies, university departments, or organizations that have hired SBI for a sustainable building consultation. They sign in to track an ongoing project, read reports, submit requests, and communicate with their assigned directors. They are not technical, not power users, and not present every day. They open the portal to answer a specific question or do one specific thing, then leave.

**Directors.** SBI faculty leads and senior students. They oversee every project, assign members, review reports, manage Google Calendar integration, and respond to client requests. They are in the portal often and use the deepest workflows (lifecycle planning, team management, document review). Their context is academic + professional, often interleaved with classwork.

**Members.** Student contributors doing the actual project work (engineering, architecture, tech, business, PR, legal, research). They have narrow scope: their assigned tasks, files relevant to their project, messages on their conversations. They are read-mostly and care about clarity over capability.

The brand surface at `utsbi.org` (home, about, projects, outreach, contact) targets a different audience entirely: prospective clients, partner universities, sponsors, and recruits. That surface is governed by `docs/DESIGN.md` and should not be conflated with the portal.

## Product Purpose

The portal exists so a client can feel confident their project is being handled, without phoning a director to find out. The most important moment is the first 30 seconds after signing in: the client should see, at a glance, that work is happening, what stage it is in, and what (if anything) needs their attention.

For directors, the product exists to consolidate four tools they would otherwise juggle (email, Google Calendar, file share, request tracker) into one surface that knows about their projects and their teams.

For members, the product exists to keep the work they need in one place without making them feel surveilled.

Success looks like: clients renew engagements without being prompted because their first project felt transparent. Directors stop asking each other "who has X file" in Slack. Members can find the file they need without scrolling past 200 unrelated ones.

## Direction of flow

Every two-party surface in the portal has a deliberate direction. Naming it determines the role gating, the copy, and the button placement.

**Reports — SBI → Client.** The team writes; the client reads. A Report is an outbound status update from a project's directors or members ("Q3 site survey complete; here's what we found"). Clients acknowledge a Report to close the loop, but they never originate one. The Reports surface for a client is a reading-and-confirming experience, not a writing one.

**Requests — Client → SBI.** The client writes; the team reads. A Request is an inbound ask from a client ("can the architecture team look at this drawing?"). Directors and members triage and respond to Requests, but they don't file them — the team's internal coordination happens in conversations and lifecycle tasks, not in the Request inbox. If a non-client opens the Requests page, they should see "Incoming requests from clients," not a create button.

**Messages — Two-way.** Conversations are the only bidirectional channel. Anything that needs back-and-forth, ambiguity-resolution, or quick clarification belongs in Messages, not Reports or Requests.

Surfaces with a direction should refuse to grow features that drift the direction. A "Reply to this Report" button would make Reports two-way and erase the contract — that goes in Messages. A "Director assigns a Request to themselves" button is fine because it's triage, not authorship.

## Brand Personality

The dashboard shares its DNA with the brand site (architectural, minimal, precise) but drops the ornament. The brand site uses blueprint grids, diagonal accent lines, and large technical markers as identity. The dashboard does not. Inside the portal, those motifs appear only at intentional moments (empty states, onboarding, transitions), never as wallpaper.

Three words: **calm, exact, deliberate.**

- **Calm**: The portal is a status surface, not a feed. It does not pulse, announce, badge, or notify unless something genuinely changed.
- **Exact**: Numbers are tabular. Dates are unambiguous. Status labels are short and mean what they say. No "Activity," no "Updates," no soft euphemisms.
- **Deliberate**: Every screen has a clear primary thing. Secondary actions live a level below. No screens of equally-weighted tiles.

Tone of voice: a professional consultant who respects the client's time. Direct, not chatty. Empty states explain what would normally be here, not why nothing is here.

## Anti-references

**Not a generic SaaS dashboard.** No purple-and-blue corporate gradients, no celebratory hero metrics ("$1.2M in projects!" with a sparkline), no sidebar plus top nav plus tabs plus filters all simultaneously visible, no identical card grids with icon + heading + text. If the surface could pass for Linear or Stripe at a glance, that is the right direction; if it could pass for Salesforce, ClickUp, or Asana, it has drifted.

**Not a typical university or nonprofit portal.** No beige + maroon, no three-column footer inside the app, no dense text walls, no Bootstrap-era card stacks, no academic-website fonts. The portal must read as serious software, not as an extension of a university IT site.

**Not construction industry software.** Procore, Autodesk Construction Cloud, and Buildertrend are spreadsheets dressed as dashboards. SBI is not them. We do not need navy-and-safety-orange or data-table-everywhere. Our clients are not project managers reading Gantt charts; they are decision-makers checking progress.

**Not maximalist or playful.** No emoji-as-icons, no illustrations of cheerful diverse people, no gamification, no streaks. The seriousness of the work the firm does should be legible in the chrome of the tool.

## Design Principles

1. **The interface should disappear.** Every UI element earns its place by being load-bearing. If a panel, badge, or count can be removed without harming the user's task, remove it. The work, not the tool, is the point.

2. **Restraint is the accent.** sbi-green covers ≤10% of any surface. Light type weights, generous whitespace, hairline borders. The product should look like a thoughtful piece of architecture: a few precise lines doing a lot of work.

3. **Practice what we preach.** SBI consults on sustainable building. The product itself should embody that ethic: no waste, no decorative chrome, no infinite scroll feeds, no "engagement" tactics. Every screen does one job well and stops.

4. **Clients are not power users.** Default to clarity over capability. Show progress before showing the underlying system. Use plain English labels. Never assume the client knows what a "ticket" or a "lifecycle stage" is without context. Keyboard shortcuts and density are for directors and members, never required of clients.

5. **Texture is earned, not applied.** Blueprint motifs, technical markers, and architectural ornament from the brand DNA appear sparingly: empty states, onboarding moments, the seam between brand and product (login, sign-out). Never as background pattern under live content.

## Accessibility & Inclusion

**WCAG 2.1 AA baseline** across the portal.

- Color contrast: 4.5:1 for body text, 3:1 for large text and UI components. The current `text-sbi-muted` (#8a9a93) against `sbi-dark` (#050807) passes; `text-white/40` and `text-white/20` placeholders do not, and should not carry information.
- Full keyboard navigation through every workflow. Visible focus rings on every interactive element; current Tailwind defaults need an audit pass.
- `prefers-reduced-motion` respected on all `motion/react` entrance animations and the calendar's planned month transition.
- Status is never conveyed by color alone. Status pills include text labels and an icon (Phosphor) alongside the color.
- Form errors announce via inline text adjacent to the field, not toast alone.
- Time and date displays are absolute, not relative, in the portal's primary surfaces (the relative "3 days ago" pattern is reserved for activity logs).

No specific university-level accommodations are required at launch, but the portal will be used by UT-affiliated clients and should be ready for screen-reader testing during the next quality pass.
