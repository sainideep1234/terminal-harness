import { Command } from "commander";
import { getSession } from "../../utils/share";

export const setModel = new Command("set").option("-m , --model <model_name>", "select model in current session", "").action(async (options) => {
    const session = await getSession();
    if(session.provider === "google"){
        // TODO: check googel models present and set that       
    }
})