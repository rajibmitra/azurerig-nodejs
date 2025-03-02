import chalk from "chalk";
import * as azdev from "azure-devops-node-api";
import * as coreInterfaces from "azure-devops-node-api/interfaces/CoreInterfaces";
import * as graphInterfaces from "azure-devops-node-api/interfaces/GraphInterfaces";
import { AzDevOps, RigParameters } from "./types/parameters";
import * as createBuildDefTemplate from "./templates/createBuildPipeline.json";
import * as createReleaseDefTemplate from "./templates/CreateReleasePipeline.json";
import * as createProdReleaseDefTemplate from "./templates/createProdReleasePipeline.json";
import * as createInfrastructurePipeline from "./templates/createInfrastructurePipeline.json";
import * as createSlackFunctionBuildPipeline from "./templates/CreateAzSlackFuncBuildPipeline.json";
import * as createSlackFunctionReleasePipeline from "./templates/SlackFuncReleasePipeline.json";
import "./extensions/string.extensions";
import { IBuildApi } from "azure-devops-node-api/BuildApi";
import { OperationReference } from "azure-devops-node-api/interfaces/common/OperationsInterfaces";
import { ICoreApi } from "azure-devops-node-api/CoreApi";
import { BuildDefinition } from "azure-devops-node-api/interfaces/BuildInterfaces";
import { ReleaseReason, ReleaseStatus, EnvironmentStatus } from "azure-devops-node-api/interfaces/ReleaseInterfaces";
import sleep from "./extensions/sleep";

export default class {
  private connection: azdev.WebApi;

  constructor(private params: RigParameters) {
    let authHandler = azdev.getPersonalAccessTokenHandler(params.azDevOps.pat);
    this.connection = new azdev.WebApi(params.azDevOps.orgUrl, authHandler);
  }


  async createDevBuildPipeline() {
    var tokenReplacedTemplate = JSON.stringify(createBuildDefTemplate)
    .replaceAll("${branch}", "dev")
    .replaceAll("${imageName}", this.params.azResources.baseResourceGroupName.toLocaleLowerCase())
    .replaceAll("${serviceConnectionId}", this.params.azDevOps.serviceConnectionId)
    .replaceAll("${registryAddress}", this.params.azResources.containeRegistryAddress)
    .replaceAll("${imageTag}", "unstable-")
    .replaceAll("${gitOrg}", "BuildIt")
    .replaceAll("${gitRepo}", "slackbot")
    .replaceAll("${gitServiceConnectionId}", this.params.azDevOps.gitServiceConnectionId)
    .replaceAll("${orgName}", this.params.azDevOps.orgName)
    .replaceAll("${pipelineId}", this.params.azDevOps.devBuildPipelineId.toString())
    .replaceAll("${sourcePipelineName}", `${this.params.azResources.baseResourceGroupName} Dev`)
    .replaceAll("${pipelineName}", `${this.params.azResources.baseResourceGroupName} Dev`)
    .replaceAll("${projectId}", this.params.azDevOps.projectId)
    .replaceAll("${projectName}", this.params.azDevOps.projName)
    .replaceAll("${storageAccountName}", this.params.azResources.storageAccountName)
    .replaceAll("${storageAccountUrl}", this.params.azResources.storageAccountBaseUrl + "dev-test-results")
    .replaceAll("${storageAccountKey}", this.params.azResources.storageAccountKey);  

    let result = await this.createBuildPipeline(tokenReplacedTemplate);


    this.params.azDevOps.devBuildPipelineId = result.id || -1;
    this.params.azDevOps.devAgentQueueId = (result.queue && result.queue.id) ? result.queue.id : -1;
    this.params.azDevOps.pipelineOwner = (result.authoredBy && result.authoredBy.id) ? result.authoredBy.id : "error";

    console.log(`Dev Build PipelineId: ${this.params.azDevOps.devBuildPipelineId}`);
    console.log(`Pipeline Owner: ${this.params.azDevOps.pipelineOwner}`);
    console.log(`Dev Buile Pipeline AgentQueueId ${this.params.azDevOps.devAgenetQueueId}`);
  }

  async createMasterBuildPipeline(){
    var tokenReplacedTemplate = JSON.stringify(createBuildDefTemplate)
    .replaceAll("${branch}", "master")
    .replaceAll("${imageName}", this.params.azResources.baseResourceGroupName.toLocaleLowerCase())
    .replaceAll("${serviceConnectionId}", this.params.azDevOps.serviceConnectionId)
    .replaceAll("${registryAddress}", this.params.azResources.containeRegistryAddress)
    .replaceAll("${imageTag}", "")
    .replaceAll("${gitOrg}", "BuildIt")
    .replaceAll("${gitRepo}", "slackbot")
    .replaceAll("${gitServiceConnectionId}", this.params.azDevOps.gitServiceConnectionId)
    .replaceAll("${orgName}", this.params.azDevOps.orgName)
    .replaceAll("${pipelineName}", `${this.params.azResources.baseResourceGroupName} Master`)
    .replaceAll("${projectId}", this.params.azDevOps.projectId)
    .replaceAll("${projectName}", this.params.azDevOps.projName)
    .replaceAll("${storageAccountName}", this.params.azResources.storageAccountName)
    .replaceAll("${storageAccountUrl}", this.params.azResources.storageAccountBaseUrl + "prod-test-results")
    .replaceAll("${storageAccountKey}", this.params.azResources.storageAccountKey);  

    let result = await this.createBuildPipeline(tokenReplacedTemplate);
    this.params.azDevOps.masterAgentQueueId = (result.queue && result.queue.id) ? result.queue.id : -1;
    this.params.azDevOps.masterBuildPipelineId = result.id || -1;
  }

  private async createBuildPipeline(parameterizedTempalate:string): Promise<BuildDefinition> {
    try {
      console.log(chalk.blueBright("Creating Build Pipeline"));
      let build : IBuildApi = await this.connection.getBuildApi();

      var temp = JSON.parse(parameterizedTempalate);

      var result = await build.createDefinition(<any>temp, this.params.azDevOps.projName);

       console.log(chalk.green("Created Build Pipeline"));
       return result;
    } catch (err) {
      console.log(err);
      if(err.result.typeKey == "InvalidProjectException"){
        console.log(chalk.yellow("Azure DevOps project still being provisioned"));
        return await this.createBuildPipeline(parameterizedTempalate);
      }else if(err.result.typeKey == "PipelineValidationException" && 
          (err.result.message.includes(this.params.azDevOps.serviceConnectionId) || err.result.message.includes(this.params.azDevOps.gitServiceConnectionId))){
        console.log(chalk.yellow("Service Connection is still being provisioned"));
        return await this.createBuildPipeline(parameterizedTempalate);
      }else {
        console.log(chalk.red("Error creating build pipeline"));
        console.log(err);
        throw err("Error creating Build Pipeline");
      }
    }
  }


  async createReleasePipeline() {
    try{
      console.log(chalk.blueBright("Creating Release Pipeline"));
      let release = await this.connection.getReleaseApi();

      let tokenReplacedTemplate = JSON.stringify(createReleaseDefTemplate)
                                      .replaceAll("${imageName}", this.params.azResources.baseResourceGroupName)
                                      .replaceAll("${imageTag}", "unstable-latest")
                                      .replaceAll("${owner_id}", this.params.azDevOps.pipelineOwner)
                                      .replaceAll("${agentQueueId}", this.params.azDevOps.devAgenetQueueId.toString())
                                      .replaceAll("${serviceConnectionId}", this.params.azDevOps.serviceConnectionId)
                                      .replaceAll("${gitHubServiceConnectionId}", this.params.azDevOps.gitServiceConnectionId)
                                      .replaceAll("${resourceGroupName}", this.params.azResources.baseResourceGroupName)
                                      .replaceAll("${location}", this.params.azResources.location)
                                      .replaceAll("${appName}", `${this.params.azResources.getAppName('Dev')}`)
                                      .replaceAll("${appUrl}", `${this.params.azResources.getAppUrl('Dev')}`)
                                      .replaceAll("${registryName}", this.params.azResources.containerRegistryName)
                                      .replaceAll("${registryAddress}", this.params.azResources.containeRegistryAddress)
                                      .replaceAll("${projectId}", this.params.azDevOps.projectId)
                                      .replaceAll("${projectName}", this.params.azDevOps.projName)
                                      .replaceAll("${pipelineId}", this.params.azDevOps.devBuildPipelineId.toString())
                                      .replaceAll("${pipelineName}", `${this.params.azResources.baseResourceGroupName} Dev`)
                                      .replaceAll("${sourcePipelineName}", "${this.params.azResources.baseResourceGroupName} Dev")
                                      .replaceAll("${orgName}", this.params.azDevOps.orgName)
                                      .replaceAll("${storageAccountName}", this.params.azResources.storageAccountName)
                                      .replaceAll("${storageAccountUrl}", this.params.azResources.storageAccountBaseUrl + "dev-test-results")
                                      .replaceAll("${storageAccountKey}", this.params.azResources.storageAccountKey);
                                   

      await release.createReleaseDefinition(JSON.parse(tokenReplacedTemplate), this.params.azDevOps.projName);


      console.log(chalk.green("Created Release Pipeline"));
    }catch(err){
      console.log(chalk.red("Error Creating Release Pipeline"));
      console.log(err);
    }
  }

  async createProdReleasePipeline(){
    try{
    console.log(chalk.blueBright("Creating Prod Release Pipeline"));
    let release = await this.connection.getReleaseApi();

    let tokenReplacedTemplate = JSON.stringify(createProdReleaseDefTemplate)
                                      .replaceAll("${imageName}", this.params.azResources.baseResourceGroupName)
                                      .replaceAll("${imageTag}", "latest")
                                      .replaceAll("${owner_id}", this.params.azDevOps.pipelineOwner)
                                      .replaceAll("${agentQueueId}", this.params.azDevOps.masterAgentQueueId.toString())
                                      .replaceAll("${serviceConnectionId}", this.params.azDevOps.serviceConnectionId)
                                      .replaceAll("${gitHubServiceConnectionId}", this.params.azDevOps.gitServiceConnectionId)
                                      .replaceAll("${resourceGroupName}", this.params.azResources.baseResourceGroupName)
                                      .replaceAll("${location}", this.params.azResources.location)
                                      .replaceAll("${appName}", `${this.params.azResources.baseAppName}`)
                                      .replaceAll("${registryName}", this.params.azResources.containerRegistryName)
                                      .replaceAll("${registryAddress}", this.params.azResources.containeRegistryAddress)
                                      .replaceAll("${projectId}", this.params.azDevOps.projectId)
                                      .replaceAll("${projectName}", this.params.azDevOps.projName)
                                      .replaceAll("${pipelineId}", this.params.azDevOps.masterBuildPipelineId.toString())
                                      .replaceAll("${pipelineName}", `${this.params.azResources.baseResourceGroupName} Prod`)
                                      .replaceAll("${sourcePipelineName}", "${this.params.azResources.baseResourceGroupName} Master")
                                      .replaceAll("${orgName}", this.params.azDevOps.orgName);

    await release.createReleaseDefinition(JSON.parse(tokenReplacedTemplate), this.params.azDevOps.projName);

    console.log(chalk.green("Created Prod Release Pipeline"));
    }
    catch(err){
      console.log(chalk.red("Error Creating Prod Release Pipeline"));
      console.log(err);
    }
  }

  async createInfrastructurePipeline(){
    try{
      console.log(chalk.blueBright("Creating infrastructure pipeline"));
      let release = await this.connection.getReleaseApi();

      var tokenReplacedTemplate = JSON.stringify(createInfrastructurePipeline)
          .replaceAll("${owner_id}", this.params.azDevOps.pipelineOwner)
          .replaceAll("${agentQueueId}", this.params.azDevOps.devAgenetQueueId.toString())
          .replaceAll("${serviceConnectionId}",  this.params.azDevOps.serviceConnectionId)
          .replaceAll("${gitServiceConnectionId}", this.params.azDevOps.gitServiceConnectionId)
          .replaceAll("${pipelineId}", this.params.azDevOps.devBuildPipelineId.toString())
          .replaceAll("${resourceGroupName}", this.params.azResources.baseResourceGroupName)
          .replaceAll("${stage}", "dev")
          .replaceAll("${location}", this.params.azResources.location)
          .replaceAll("${branch}", "master")
          .replaceAll("${projectId}", this.params.azDevOps.projectId)
          .replaceAll("${imageName}", this.params.azResources.baseResourceGroupName.toLocaleLowerCase())
          .replaceAll("${imageTag}", "unstable-latest")
          .replaceAll("${appName}", this.params.azResources.baseAppName)
          .replaceAll("${registryAddress}", this.params.azResources.containeRegistryAddress)
          .replaceAll("${sourcePipelineName}", "${this.params.azResources.baseResourceGroupName} Dev")
          .replaceAll("${pipelineName}", "Infrastructure Pipeline");

        let releaseDef = await release.createReleaseDefinition(JSON.parse(tokenReplacedTemplate), this.params.azDevOps.projName);
    
        console.log(chalk.green(`Created Release Pipeline: DefenitionId ${releaseDef.id}`));

        console.log(chalk.blueBright(`Kicking off new release of defenition ${releaseDef.id}`));
        let createdRelease = await release.createRelease({definitionId: releaseDef.id}, this.params.azDevOps.projName);
        console.log(chalk.green(`Release Defenition ${releaseDef.id} started`));
        
        let releaseResults : any = await release.getRelease(this.params.azDevOps.projName, createdRelease.id || 0);
        let condition = releaseResults.environments[0].status === EnvironmentStatus.Succeeded && 
                        releaseResults.environments[1].status === EnvironmentStatus.Succeeded &&
                        releaseResults.environments[2].status === EnvironmentStatus.Succeeded
        
        while(!condition){
          releaseResults = await release.getRelease(this.params.azDevOps.projName, createdRelease.id || 0);
          condition = releaseResults.environments[0].status === EnvironmentStatus.Succeeded && 
                        releaseResults.environments[1].status === EnvironmentStatus.Succeeded &&
                        releaseResults.environments[2].status === EnvironmentStatus.Succeeded

          console.log(`Environment 1 Complete: ${releaseResults.environments[0].status === EnvironmentStatus.Succeeded}`);
          console.log(`Environment 2 Complete: ${releaseResults.environments[1].status === EnvironmentStatus.Succeeded}`);
          console.log(`Environment 3 Complete: ${releaseResults.environments[2].status === EnvironmentStatus.Succeeded}`);

          console.log(chalk.yellow(`Release ${createdRelease.id} not yet created, sleeping for 2 minutes`));
          await sleep(120000);
        }

        console.log(chalk.green(`Release ${createdRelease.id} created`));
  
    }catch(err){
      console.log("Error while creating infrastructure pipeline");
      console.log(err);
    }
  }

}
