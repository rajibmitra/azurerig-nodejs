import chalk from "chalk";
import * as azure from "ms-rest-azure";
import * as rm from "azure-arm-resource";
import * as storage from "azure-arm-storage";
import * as monitor from "azure-arm-monitor";
import * as website from "azure-arm-website";
import * as container from "azure-arm-containerregistry";
import alertTemplate from "./templates/ErrorLogAlert.json";
import actionGroupTemplate from "./templates/CreateActionGroup.json";
import * as moment from 'moment';
import { RigParameters } from "./types/parameters";


export default class {
  private credentials: any;

  constructor(private rigParams: RigParameters) {}

  async azureLogin() {
    console.log(chalk.blueBright("Logging into Azure"));
    const opts = {
      domain: this.rigParams.azResources.tenantId
    };
   
    this.credentials = await azure.interactiveLogin(opts);
    console.log(chalk.green("Successfully Logged into Azure"));
  }
}