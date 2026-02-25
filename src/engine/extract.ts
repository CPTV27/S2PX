// Notebook CPQ — LLM Extraction Layer
// Uses Google Gemini 3.1 Pro to extract structured pricing parameters from natural language.
// The LLM NEVER calculates prices — it only extracts structured data.

import { GoogleGenAI } from "@google/genai";
import type { ExtractionResult, Area } from './types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
const EXTRACTION_MODEL = "gemini-3.1-pro-preview";

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

export async function extractQuoteParameters(
  userInput: string,
  _apiKey?: string,
  existingAreas?: Area[],
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<ExtractionResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Gemini API key not configured. Set GEMINI_API_KEY in .env.");
  }

  // Build message content
  let messageContent = userInput;
  if (existingAreas && existingAreas.length > 0) {
    messageContent = `Current quote areas: ${JSON.stringify(existingAreas)}.\nThe user wants to modify this quote. Return the COMPLETE updated areas array (not just changes):\n\n${userInput}`;
  }

  // Build history for multi-turn conversation
  const history: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];
  if (conversationHistory) {
    for (const msg of conversationHistory) {
      history.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }
  }

  const chat = ai.chats.create({
    model: EXTRACTION_MODEL,
    config: {
      systemInstruction: EXTRACTION_SYSTEM_PROMPT,
      temperature: 0.1,
    },
    history,
  });

  const result = await chat.sendMessage({ message: messageContent });
  const text = result.text || "";

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
