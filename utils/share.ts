import { GoogleGenAI } from "@google/genai";
import fs from "fs/promises"
export const PROVIDERS = ["google", "claude", "openai"]

export const MODELS_SUPPORTED = ["gemini-3.5-flash"]

export type GEMINI_MODELS_SUPPORTED_TYPE = "gemini-3.5-flash" | null;
export type PROVIDERS_TYPES = "google" | "claude" | "openai" | null

export type PROVIDER_TO_MODEL = Record<PROVIDERS_TYPES , GEMINI_MODELS_SUPPORTED_TYPE >

let session: CurrentSessaion | null = null;



interface CurrentSessaion {
    provider: PROVIDERS_TYPES,
    apiKey: string | null,
    model: MODELS_SUPPORTED_TYPE,
    client: unknown | GoogleGenAI
}

export async function getSession(): Promise<CurrentSessaion> {
    if (session) return session;

    try {
        const data = await fs.readFile(`${process.cwd()}/database.json`, "utf-8");
        session = JSON.parse(data) as CurrentSessaion;
        return session;
    } catch (error) {
        throw new Error("No session found. Please login first: providers login -p google -a <key>");
    }
}