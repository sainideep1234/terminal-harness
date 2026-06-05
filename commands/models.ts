import { Command } from "commander";
import axios from "axios"
import { MODELS_SUPPORTED } from "../utils/share";
export const modelsCommand = new Command("models")
  .description('Returns all the supported models')
  .option('-m, --model <modelName>', 'name of the model', 'all')
  .action(async (options) => {
    console.log("Listing models...");
    MODELS_SUPPORTED.forEach((model)=>{
      console.log("->",model);
    })
});