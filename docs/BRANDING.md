# AgentPanorama — Branding Guide

## Identity

- **Name:** AgentPanorama
- **Code name:** `agent-panorama`
- **Marketplace display name:** AgentPanorama — AI Agent Monitor
- **Primary tagline:** See every coding agent at a glance.
- **Technical tagline:** Local-first monitoring for Claude, Codex, Copilot, and LiteLLM.

The panorama metaphor describes one wide, coherent view assembled from many separate agent sessions. In prose, always use `AgentPanorama` as one PascalCase word.

## Positioning

AgentPanorama is the local mission view for developers who run several AI coding agents at once. It reveals which sessions are working, waiting, complete, or failing without collecting source code or requiring a hosted account.

## Visual System

The mark is a rounded observation aperture containing three converging activity traces. It should read as both a panoramic lens and a compact monitoring dashboard at 32 px.

| Role | Name | Hex | Use |
|---|---|---|---|
| Primary | Horizon Violet | `#7C5CFC` | Identity and active selection |
| Secondary | Signal Cyan | `#31C7D5` | Live activity |
| Accent | Attention Amber | `#F4B740` | Waiting states |
| Success | Complete Green | `#42C878` | Completed states |
| Error | Fault Coral | `#F06464` | Failed states |
| Dark surface | Night Panel | `#161922` | Marketing artwork only |

Extension UI uses VS Code theme tokens instead of hard-coded backgrounds and text colors. Statuses always include text or an icon; color is never the only signal.

Typography follows the host UI font. Marketing and repository assets use Inter with a system sans-serif fallback; code uses the platform monospace font.

## Voice

- Calm, precise, and privacy-conscious.
- Say what was observed and label inference explicitly.
- Prefer “Waiting for input” to “Agent stuck.”
- Prefer “Copilot session telemetry is not exposed by the installed API” to “Copilot unsupported.”
- Avoid claims such as autonomous, intelligent, revolutionary, or complete visibility.

## Asset Requirements

| Asset | Format | Size |
|---|---|---:|
| Marketplace icon | PNG | 128×128 |
| Source mark | SVG | scalable |
| README banner | SVG | 1200×300 |
| Dashboard screenshot | PNG | 1400×900 |
| Marketplace screenshot | PNG | 1400×900 |

## Logo Construction Prompt

Create a minimal flat vector icon for a developer monitoring tool: a rounded panoramic lens with three clean activity traces converging toward a central observation point; Horizon Violet and Signal Cyan on transparent background; strong silhouette at 32 px; no text, gradients, shadows, mascots, robots, brains, or provider logos; square 1:1 composition with generous clear space.

