
import { Command } from 'commander';
import {  session } from '../../utils/share';

export const setProviderCommand = new Command("provider")
    .description('Lets user set the default provider')
    .option('-p, --provider <providerName>', 'Name of the provider (gemini, claude etc)', '')
    .action((options) => {
        if(options.p === "google" || options.provider === "google"){
            session.provider = "google"
        }
    })
