/// <reference path="./types/string.d.ts" />
import sleep from "./extensions/sleep";
import chalk from "chalk";
import figlet from "figlet";
import askQuestions from "./Questions";
import DevOpsService from "./DevOpsService";
import AzureService from "./AzureService";
import DevOpsRestService from "./DevOpsRestService";
import "./extensions/string.extensions";
const clear = require("clear");

const run = async () => {
  try {
    //Show introduction
    init();

     //ask questions;
     const params = await askQuestions();

    //Create Services
    const devOps = new DevOpsService(params);
    const devOpsRest = new DevOpsRestService(params);
    const azureService: AzureService = new AzureService(params);

    //Login:
    await azureService.azureLogin();


    //Create Azure Service Connection
    await devOpsRest.createServiceConnection(`Azure Service Connection`);

    //Create Git Serevice Connection
    await devOpsRest.createGitServiceConnection("Git Connection");


    //Create Build Dev Pipeline
    await devOps.createDevBuildPipeline();

    //Create Build Master Pipeline
    await devOps.createMasterBuildPipeline();
    
    //Create Release Pipeline
    await devOps.createReleasePipeline();

    //Create Prod Release Pipeline
    await devOps.createProdReleasePipeline();

    //Create Infrastructure Pipeline
    await devOps.createInfrastructurePipeline();

  } catch (e) {
    console.log(e);
  }
};

const init = () => {
  clear();
  console.log(
    chalk.blueBright(
      figlet.textSync("AzureRig-Cli", { horizontalLayout: "full" })
    )
  );
};

run();

