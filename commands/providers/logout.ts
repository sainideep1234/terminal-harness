
import { Command } from 'commander';
import { providerToApiMap } from './login';
import { session } from '../../utils/share';
const fs = require('node:fs');
// Source - https://stackoverflow.com/a/17371288
// Posted by Andbdrew, modified by community. See post 'Timeline' for change history
// Retrieved 2026-06-04, License - CC BY-SA 4.0



export const logoutCommand = new Command("logout")
    .description('Lets user logout from the provider')
    .option('-p, --provider <providerName>', 'Name of the provider (gemini, claude etc)', '')
    .action((options) => {
        if(options.p === "google" || options.provider === "google"){
                providerToApiMap.delete("google");
                session.apiKey = "";
                session.client = null;
                session.model= null;
                session.provider=null;
                const content = JSON.stringify(session)
                // fs.writeFile(`${process.cwd()}/database.txt `, content, err => {});
                fs.writeFile(`${process.cwd()}/database.json `, content, err => {});
                console.log(`api-key for provoder ${options.provider} is deletd successfully`)
        }
    })

