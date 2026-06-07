import { GoogleGenAI } from '@google/genai';
import fs from 'fs/promises';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { parseDateDef } from 'openai/_vendor/zod-to-json-schema/index.mjs';

const SESISON_FILE_PATH = `${process.cwd()}/database.json`;
console.log("[PATH]", SESISON_FILE_PATH);


const PROVIDERS_MODELS = {
  google: ['gemini-3.5-flash'],
  openai: ['gpt-4.5'],
  claude: ['claude-opus-4.6'],
} as const;

type PROVIDERS_TYPES = keyof typeof PROVIDERS_MODELS;
type MODELS_SUPPORTED_TYPE =
  (typeof PROVIDERS_MODELS)[keyof typeof PROVIDERS_MODELS][number];

type AllSessiondetailsType = Partial<Record<PROVIDERS_TYPES, PesistedSession>>;

let allSessiondetails: AllSessiondetailsType = {};

interface PesistedSession {
  apiKey: string;
  model: MODELS_SUPPORTED_TYPE;
  active: boolean;
}

interface CurrentSessionProvider {
  apiKey: string;
  model: MODELS_SUPPORTED_TYPE;
  client: GoogleGenAI | OpenAI | Anthropic;
  provider: PROVIDERS_TYPES;
}

const currentSessionProvider: CurrentSessionProvider | null = null;

async function upsertProviderInSession(
  provider: PROVIDERS_TYPES,
  apiKey: string,
) {
  const model = PROVIDERS_MODELS[provider][0];

  console.log("hiiiiiiii");
  try {
    console.log("hiiiiiiii");
    
    const data = await fs.readFile(SESISON_FILE_PATH, 'utf-8');
    const parsedData = JSON.parse(data) as AllSessiondetailsType;
    if(parsedData[provider]){
      parsedData[provider].apiKey = apiKey;
    }

    parsedData[provider] = { apiKey, model, active: false };

    writeAllSessionDeatilInFile(parsedData);
  } catch (error) {
    console.log("hellloooooooo");

    allSessiondetails[provider] = {active:true , apiKey  , model}
    writeAllSessionDeatilInFile(allSessiondetails)
  }
}

async function createClient(
  apiKey: string,
  provider: string,
): Promise<GoogleGenAI | OpenAI | Anthropic> {
  let client: GoogleGenAI | OpenAI | Anthropic | null = null;
  if (apiKey && provider === 'google') {
    client = new GoogleGenAI({ apiKey });
  } else if (apiKey && provider === 'openai') {
    client = new OpenAI();
  } else if (apiKey && provider === 'claude') {
    client = new Anthropic({
      apiKey,
    });
  }
  if (!client)
    throw Error(`provider "${provider.toUpperCase()}" client failed create`);
  return client;
}

async function writeAllSessionDeatilInFile(session: AllSessiondetailsType) {
  const content = JSON.stringify(session);
  try {
    await fs.writeFile(SESISON_FILE_PATH, content);
  } catch (error) {
    throw Error('Failed to create session');
  }
}

async function updateProviderModel(
  provider: PROVIDERS_TYPES,
  model: MODELS_SUPPORTED_TYPE,
) {
  const data = await fs.readFile(SESISON_FILE_PATH, 'utf-8');
  const parsedData = JSON.parse(data) as AllSessiondetailsType;

  parsedData[provider]!.model = model;

  writeAllSessionDeatilInFile(parsedData);
}

async function getAllSessions(): Promise<AllSessiondetailsType> {
  const data = await fs.readFile(SESISON_FILE_PATH, 'utf-8');
  const currentSessionProviders = JSON.parse(data) as AllSessiondetailsType;

  if (!currentSessionProviders) {
    throw Error('first login and provide provider , no provider is present');
  }
  return currentSessionProviders;
}

async function getCurrentSession(): Promise<CurrentSessionProvider> {
  if (currentSessionProvider) return currentSessionProvider;

  const data = await fs.readFile(SESISON_FILE_PATH, 'utf-8');
  const parsedData = JSON.parse(data) as AllSessiondetailsType;
  if(!parsedData){
    throw Error("no Session is present")
  }

  const currentProvider = (Object.keys(parsedData) as PROVIDERS_TYPES[]).find((provider) => {
    return parsedData[provider]!.active === true;
  });

  if (!currentProvider) {
    throw Error('No actiive provider');
  }
  const { apiKey, model } = allSessiondetails[currentProvider]!;

  if (!apiKey) {
    throw Error('No api key availabel');
  }

  const client = await createClient(apiKey, currentProvider!);

  return {
    apiKey,
    model,
    provider: currentProvider!,
    client,
  };
}

export {
  PROVIDERS_MODELS,
  type PROVIDERS_TYPES,
  type MODELS_SUPPORTED_TYPE,
  getCurrentSession,
  getAllSessions,
  updateProviderModel,
  upsertProviderInSession,
  
};
