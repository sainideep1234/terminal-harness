
import { Command } from 'commander';
import { GoogleGenAI } from "@google/genai";
import { session } from '../../utils/share';
const fs = require('node:fs');



export const providerToApiMap = new Map<string , string>();

export const loginCommand = new Command("login")
    .description('Lets user login into the provider (use it as default)')
    .option('-p, --provider <providerName>', 'Name of the provider (gemini, claude etc)', '')
    .option('-a, --api_key <apiKey>', 'Your api key', '')
    .action(async (options) => {

        if(options.p = "google" ){

            if(options.a || options.api_key){
                providerToApiMap.set("google" , options.a || options.api_key)
                session.provider = options.p
                session.apiKey = providerToApiMap.get("google")!;

                session.client = new GoogleGenAI({apiKey:session.apiKey});
                const content = JSON.stringify(session)
                fs.writeFile(`${process.cwd()}/database.json `, content, err => {});

                console.log("api-key is set for provider -> " , options.provider)
                console.log("api-key  for provider -> " , providerToApiMap.get("google"))
            }
            
        }
        
    })
