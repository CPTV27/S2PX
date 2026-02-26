// ── Gemini AI Service for S2PX ──
// Ported from DT27-wrapper, scoped to S2P Operator persona.

import { GoogleGenAI, FunctionDeclaration, Type, ThinkingLevel, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const S2P_SYSTEM_INSTRUCTION = `
You are the S2P Operator, the AI assistant for Scan2Plan.
Your tone is technical, precise, enterprise-focused, and efficient.
You are an expert in 3D laser scanning, building documentation, BIM (Building Information Modeling), and construction technology.
You know Scan2Plan's service offerings: Scan-to-CAD, Scan-to-BIM, point cloud processing, and as-built documentation.
Focus: Lead pipeline, project scoping, pricing, and client communications.
When asked to create tasks, use the createLead function.
Keep responses concise and actionable.
`;

const createLeadTool: FunctionDeclaration = {
    name: "createLead",
    description: "Create a new lead in the Scan2Plan CRM pipeline.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            clientName: {
                type: Type.STRING,
                description: "Company or client name.",
            },
            projectName: {
                type: Type.STRING,
                description: "Name of the scanning project.",
            },
            contactName: {
                type: Type.STRING,
                description: "Primary contact name.",
            },
            contactEmail: {
                type: Type.STRING,
                description: "Contact email address.",
            },
            estimatedValue: {
                type: Type.NUMBER,
                description: "Estimated project value in USD.",
            },
            notes: {
                type: Type.STRING,
                description: "Additional context about the project scope.",
            },
        },
        required: ["clientName", "projectName"],
    },
};

export interface ChatConfig {
    useReasoning?: boolean;
    useSearch?: boolean;
}

export async function sendMessageToGemini(
    history: { role: 'user' | 'model'; text: string }[],
    message: string,
    chatConfig: ChatConfig = {},
    onToolCall?: (toolName: string, args: any) => void
) {
    try {
        let modelName = "gemini-2.5-flash";
        if (chatConfig.useReasoning) {
            modelName = "gemini-3.1-pro-preview";
        }

        const tools: any[] = [{ functionDeclarations: [createLeadTool] }];
        if (chatConfig.useSearch) tools.push({ googleSearch: {} });

        const config: any = {
            systemInstruction: S2P_SYSTEM_INSTRUCTION,
            tools,
        };

        if (chatConfig.useReasoning) {
            config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH, thinkingBudget: 32768 };
        }

        const chat = ai.chats.create({
            model: modelName,
            config,
            history: history.map(h => ({
                role: h.role,
                parts: [{ text: h.text }],
            })),
        });

        const result = await chat.sendMessage({ message });

        // Handle function calls
        const functionCalls = result.functionCalls;
        if (functionCalls && functionCalls.length > 0) {
            const call = functionCalls[0];
            if (call.name === 'createLead' && onToolCall && call.args) {
                onToolCall(call.name, call.args);
                return `I've created a new lead: "${call.args.projectName}" for ${call.args.clientName}.`;
            }
        }

        return result.text;
    } catch (error) {
        console.error("Gemini API Error:", error);
        return "Connection issue. Please check your API key and try again.";
    }
}

// ── Pricing Quote Chat ──

const generateQuoteTool: FunctionDeclaration = {
    name: "generateQuote",
    description: "Generate a structured pricing quote using the profit-first model. The PRIMARY line item (Scan-to-Plan architectural) uses the COGS multiplier from the pricing rules. ADD-ON line items use their lean markup factor. Call this whenever you have enough project details to calculate pricing.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            projectName: {
                type: Type.STRING,
                description: "Name or description of the project.",
            },
            clientName: {
                type: Type.STRING,
                description: "Client or company name (if provided).",
            },
            lineItems: {
                type: Type.ARRAY,
                description: "Array of quote line items. The first/primary item carries the full COGS multiplier. Add-ons use lean markup.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        service: { type: Type.STRING, description: "Name of the service." },
                        description: { type: Type.STRING, description: "Brief description of the line item." },
                        quantity: { type: Type.NUMBER, description: "Quantity (e.g., square footage, number of scans, days)." },
                        unit: { type: Type.STRING, description: "Unit of measure (e.g., sq ft, scan, trip, day, project)." },
                        vendorCostPerUnit: { type: Type.NUMBER, description: "Internal vendor/COGS cost per unit." },
                        marginPct: { type: Type.NUMBER, description: "Effective margin percentage on this line item." },
                        clientPricePerUnit: { type: Type.NUMBER, description: "Client-facing price per unit." },
                        isPrimary: { type: Type.BOOLEAN, description: "true = primary line item (full COGS multiplier), false = add-on (lean markup)." },
                    },
                    required: ["service", "description", "quantity", "unit", "vendorCostPerUnit", "marginPct", "clientPricePerUnit", "isPrimary"],
                },
            },
            appliedMultipliers: {
                type: Type.ARRAY,
                description: "Situational multipliers applied to the final total.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING, description: "Multiplier name." },
                        factor: { type: Type.NUMBER, description: "Multiplier factor (e.g., 1.5)." },
                    },
                    required: ["name", "factor"],
                },
            },
            notes: {
                type: Type.STRING,
                description: "Assumptions, caveats, or scope notes about this quote.",
            },
        },
        required: ["projectName", "lineItems"],
    },
};

export interface PricingChatConfig {
    useReasoning?: boolean;
    pricingContext: string; // Serialized pricing rules
}

export async function sendPricingMessage(
    history: { role: 'user' | 'model'; text: string }[],
    message: string,
    chatConfig: PricingChatConfig,
    onQuoteGenerated?: (args: any) => void
) {
    try {
        const modelName = chatConfig.useReasoning
            ? "gemini-3.1-pro-preview"
            : "gemini-2.5-flash";

        const systemInstruction = `
You are the S2P Pricing Engine — an AI-powered quote generator for Scan2Plan.

YOUR ROLE:
- Help the user scope projects and generate accurate pricing quotes using the PROFIT-FIRST model.
- Ask clarifying questions when project details are ambiguous (building type, square footage, deliverable type, timeline, etc.).
- Once you have enough information, call the generateQuote function with calculated line items.
- You can update quotes iteratively — if the user adds/removes services, regenerate the quote.

YOUR PERSONALITY:
- Technical, precise, and consultative.
- You understand 3D laser scanning, BIM, point cloud processing, and construction documentation.
- You proactively suggest services the client may need based on their project description.
- You flag risks or considerations (site access, complexity, timeline).

${chatConfig.pricingContext}

CONVERSATION FLOW:
1. User describes a project → Ask clarifying questions if needed (sq ft, building type, deliverable type, timeline).
2. Once scope is clear → Calculate COGS, apply the COGS multiplier to the PRIMARY line item, use lean markup for add-ons, then call generateQuote.
3. User wants changes → Adjust and call generateQuote again.
4. Present pricing conversationally. Reference line items by name, explain scope and value.
5. NEVER reveal vendor costs, COGS multiplier, margin percentages, or internal allocations in your conversational text — those only go in the function call data.
6. When estimating scan time, consider: building size, number of floors, complexity. A typical scan tech covers ~10,000-15,000 sq ft per day for standard commercial spaces.

PRICING CALCULATION STEPS:
1. Estimate scan days needed based on sq footage and complexity.
2. Calculate total COGS = (scan tech days × day rate) + (modeling cost × sq ft) + (point cloud processing × scans) + travel.
3. PRIMARY line item client price = total COGS × the COGS multiplier from the rules above.
4. Present the primary line item as a per-sqft rate to the client (total price / total sq ft).
5. ADD-ON services = vendor cost × their individual markup factor.
6. Apply situational multipliers if applicable.
7. Enforce minimum project value.

When calculating, ALWAYS use the cost basis and rules above. Do NOT make up prices.
`.trim();

        const config: any = {
            systemInstruction,
            tools: [{ functionDeclarations: [generateQuoteTool] }],
        };

        if (chatConfig.useReasoning) {
            config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH, thinkingBudget: 32768 };
        }

        const chat = ai.chats.create({
            model: modelName,
            config,
            history: history.map(h => ({
                role: h.role,
                parts: [{ text: h.text }],
            })),
        });

        const result = await chat.sendMessage({ message });

        // Handle quote generation function call
        const functionCalls = result.functionCalls;
        if (functionCalls && functionCalls.length > 0) {
            const call = functionCalls[0];
            if (call.name === 'generateQuote' && call.args) {
                onQuoteGenerated?.(call.args);

                // Also return conversational text if present, otherwise generate a summary
                const textResponse = result.text;
                if (textResponse && textResponse.trim().length > 0) {
                    return textResponse;
                }
                return "I've generated a quote based on your project details. You can see the breakdown in the quote panel. Let me know if you'd like to adjust anything.";
            }
        }

        return result.text;
    } catch (error) {
        console.error("Gemini Pricing API Error:", error);
        return "Connection issue. Please check your API key and try again.";
    }
}

// ── Image Generation (Pro Image) ──
export async function generateImage(prompt: string, aspectRatio: string = '16:9') {
    try {
        const enhancedPrompt = `${prompt}. Style: Professional, technical, clean. Colors: blue and white. Industry: construction, architecture, engineering.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: enhancedPrompt }] },
            config: {
                responseModalities: ['TEXT', 'IMAGE'] as any,
            },
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if ((part as any).inlineData) {
                const inlineData = (part as any).inlineData;
                return `data:${inlineData.mimeType};base64,${inlineData.data}`;
            }
        }
        return null;
    } catch (error) {
        console.error("Image Gen Error:", error);
        throw error;
    }
}

// ── Text-to-Speech ──
export async function generateSpeech(text: string) {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                },
            },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
            return `data:audio/mp3;base64,${base64Audio}`;
        }
        return null;
    } catch (error) {
        console.error("TTS Error:", error);
        throw error;
    }
}
