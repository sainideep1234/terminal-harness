import { Command } from "commander";
import { GoogleGenAI } from "@google/genai";
import { session } from "../utils/share";
import { zshCommands } from "../utils/tools";
const fs = require('node:fs');
import {exec} from "child_process"
let parsedData


const data =  Bun.file(`${process.cwd()}/database.json `)
parsedData = await data.json();


export const agentCommand = new Command("agent")
  .description('Runs the agent')
  .option('-p, --prompt <prompt>', 'prompt', '')
  .action(async (options) => {


      if(options.p || options.prompt){
        let query = options.p || options.prompt;

        if(parsedData.provider === "google"){
          const ai = new GoogleGenAI({apiKey: parsedData.apiKey});

          while(1) {
            
            const response = await ai.models.generateContent({
              model: parsedData.model || "gemini-3.5-flash"  ,
              contents: query,
              config:{
                tools: [{functionDeclarations:[zshCommands]}]
              }
            });
          
            if(!response){
              continue;
            }
            
            console.log("[RESPONSE]",response.functionCalls);
            if(response.functionCalls && response.functionCalls.length > 0){
              const fc = response.functionCalls[0];
              const args = fc.args;
              if(!args){
                continue;
              }
              exec(args.comand as string, (error, stdout, stderr) => {
                if (error) {
                  console.error(`Error executing command: ${error.message}`);
                  return;
                }
                if (stderr) {
                  console.error(`Standard Error: ${stderr}`);
                  return;
                }
                console.log(`Output:\n${stdout}`);
              });
            }
            query = ""

        }  
      }
      
    }
  });