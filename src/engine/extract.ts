// Notebook CPQ — LLM Extraction Layer
// Uses Anthropic Claude API to extract structured pricing parameters from natural language.
// The LLM NEVER calculates prices — it only extracts structured data.

import type { ExtractionResult, Area } from './types';

const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

const EXTRACTION_SYSTEM_PROMPT = `You are a pricing parameter extractor for Scan2Plan, a 3D scanning and BIM documentation company.

Given a natural language project description, extract structured pricing parameters.

## Building Types (use the ID number):
1=Office, 2=Educational, 3=Healthcare, 4=Industrial, 5=Residential Multi-Family,
6=Residential Single-Family, 7=Retail, 8=Hospitality, 9=Mixed-Use, 10=Warehouse,
11=Religious, 12=Government, 13=Parking Structure, 14=Built Landscape,
15=Natural Landscape, 16=ACT Ceilings Only, 17=Matterport Only

## Disciplines:
arch (Architecture), mepf (Mechanical/Electrical/Plumbing/Fire), structure, site

## LOD Levels:
200 (Basic/Conceptual), 300 (Standard - DEFAULT), 350 (Detailed/Construction)

## Scopes:
full (default), interior, exterior, mixed

## Dispatch Locations:
TROY, WOODSTOCK, BOISE, BROOKLYN

## Risk Factors:
occupied (building is occupied), hazardous (hazardous materials), no_power (no power on site)

## Payment Terms:
partner, owner, net30, net60, net90

## Rules:
- Default LOD is 300 if not specified
- Default scope is "full" if not specified
- Default disciplines are ["arch"] if not specified
- If someone says "full BIM" or "all disciplines", use ["arch", "mepf", "structure", "site"]
- If someone mentions MEP, map to "mepf"
- Distance is in miles from dispatch location
- If no dispatch location mentioned, default to WOODSTOCK
- If no distance mentioned, set to 0
- Landscape types (14, 15) use acres, not sqft
- If the user mentions "ACT" or "above ceiling tile" scanning, create a SEPARATE area with buildingType "16"
- If per-discipline LOD overrides are specified (e.g., "LOD 300 arch, LOD 200 structure"), use the disciplineLods field

Respond ONLY with valid JSON matching this schema:
{
  "areas": [
    {
      "id": "area-0",
      "name": "descriptive name",
      "buildingType": "1",
      "squareFeet": 10000,
      "disciplines": ["arch", "mepf"],
      "lod": "300",
      "scope": "full",
      "risks": [],
      "additionalElevations": 0,
      "includeMatterport": false
    }
  ],
  "dispatchLocation": "WOODSTOCK",
  "distance": 50,
  "risks": [],
  "paymentTerms": "owner",
  "confidence": 0.9,
  "ambiguities": ["distance not specified, defaulting to 0"]
}`;

function getApiKey(): string {
  return (
    (typeof process !== "undefined" && process.env?.ANTHROPIC_API_KEY) ||
    localStorage.getItem("s2p-anthropic-key") ||
    ""
  );
}

export async function extractQuoteParameters(
  userInput: string,
  apiKey?: string,
  existingAreas?: Area[],
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<ExtractionResult> {
  const key = apiKey || getApiKey();
  if (!key) {
    throw new Error("Anthropic API key not configured. Set ANTHROPIC_API_KEY in .env or enter it in settings.");
  }

  // Build message content
  let messageContent = userInput;
  if (existingAreas && existingAreas.length > 0) {
    messageContent = `Current quote areas: ${JSON.stringify(existingAreas)}.\nThe user wants to modify this quote. Return the COMPLETE updated areas array (not just changes):\n\n${userInput}`;
  }

  // Build messages array with conversation history
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
  if (conversationHistory) {
    for (const msg of conversationHistory) {
      messages.push({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content,
      });
    }
  }
  messages.push({ role: "user", content: messageContent });

  const response = await fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Claude API error: ${response.status} — ${JSON.stringify(errorData)}`
    );
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || "";

  // Strip markdown code fences if present
  const clean = text.replace(/```json\n?|```\n?/g, "").trim();
  const parsed = JSON.parse(clean);

  // Ensure risks default to empty array for all areas
  if (parsed.areas) {
    for (const area of parsed.areas) {
      if (!area.risks) area.risks = [];
    }
  }
  if (!parsed.risks) parsed.risks = [];
  if (!parsed.ambiguities) parsed.ambiguities = [];

  return { ...parsed, rawInput: userInput } as ExtractionResult;
}
