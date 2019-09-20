import * as request from "request-promise";
import { AzDevOps, AzResources, RigParameters } from "./types/parameters";
import serviceConnectionTemplate from "./templates/createServiceConnectionSubscriptionTemplate.json";
import createGitServiceConnectionTemplate from "./templates/createGitServiceConnectionDataTemplate.json";
import chalk from "chalk";

export default class {
  constructor(private params: RigParameters) {}

  async createServiceConnection(serviceConnectionName: string) {
    try {
      console.log(chalk.blueBright("Creating Service Connection"));
      let replacedTemplate = JSON.stringify(serviceConnectionTemplate)
        .replaceAll("${serviceConnectionId}", "$(uuidgen)")
        .replaceAll("${tennantId}", `${this.params.azResources.tenantId}`)
        .replaceAll(
          "${subscriptionId}",
          `${this.params.azResources.subscription}`
        )
        .replaceAll(
          "${resourceGroupId}",
          this.params.azResources.baseResourceGroupName
        )
        .replaceAll("${subscriptionName}", "RigSubscription")
        .replaceAll("${connectionName}", serviceConnectionName);

      let results: any = await request.post(
        `${this.params.azDevOps.orgUrl}/${
          this.params.azDevOps.projName
        }/_apis/serviceendpoint/endpoints?api-version=5.0-preview.1`,
        {
          json: JSON.parse(replacedTemplate),
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${Buffer.from(
              this.params.azDevOps.username + ":" + this.params.azDevOps.pat
            ).toString("base64")}`
          }
        }
      );

      this.params.azDevOps.serviceConnectionId = results.id;
      console.log(chalk.green("Created Service Connection"));
    } catch (e) {
      console.log(chalk.red("Error Creating Service Connection"));
      console.log(e);
    }
  }

  async createGitServiceConnection(serviceConnectionName: string) {
    try {
      console.log(chalk.blueBright("Creating Git Service Connection"));
      let replacedTemplate = JSON.stringify(createGitServiceConnectionTemplate)
        .replaceAll("${gitServiceConnectionId}", "$(uuidgen)")
        .replaceAll("${gitPAT}", this.params.gitParams.pat)
        .replaceAll("${gitServiceConnectionName}", serviceConnectionName);

      let results: any = await request.post(
        `${this.params.azDevOps.orgUrl}/${
          this.params.azDevOps.projectId
        }/_apis/serviceendpoint/endpoints?api-version=5.1-preview.1`,
        {
          json: JSON.parse(replacedTemplate),
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${Buffer.from(
              this.params.azDevOps.username + ":" + this.params.azDevOps.pat
            ).toString("base64")}`
          }
        }
      );

      this.params.azDevOps.gitServiceConnectionId = results.id;
      console.log(chalk.green("Created Git Service Connection"));
    } catch (err) {
      console.log(chalk.red("Error Creating Git Service Connection"));
      console.log(err);
    }
  }
}
