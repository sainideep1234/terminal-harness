import { GoogleGenAI } from "@google/genai";

export const PROVIDERS = ["google" , "claude" , "openai"]

export const MODELS_SUPPORTED  = ["gemini-3.5-flash"]

export type MODELS_SUPPORTED_TYPE = "gemini-3.5-flash" | null; 
export type PROVIDERS_TYPES = "google" | "claude" | "openai" | null

export interface ProviderToModel{
    PROVIDERS_TYPES: MODELS_SUPPORTED_TYPE
}

export let session :CurrentSessaion = {
    provider: null,
    apiKey:"",
    model:null, 
    client:null
}

interface CurrentSessaion{
    provider:PROVIDERS_TYPES,
    apiKey:string,
    model:MODELS_SUPPORTED_TYPE,
    client:unknown | GoogleGenAI
}