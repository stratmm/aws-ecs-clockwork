# A Lambda function and ECS Container service to provide CRON like behavior

This project provides users of Amazon AWS ECS the ability to schedule Task Definitions to run in a CRON like manner.  The project has three components.

## Lambda Function lambda_ecs_clockwork

A Lambda function that provides a Cloudformation custom resource.  Allowing users to declare Schedules within their Cloudformation stacks.

In the example below a task Definition is scheduled to run every two minutes.

```
"DoAccuralsScheduledJob" : {
  "Type" : "AWS::CloudFormation::CustomResource",
  "Properties" : {
    "ServiceToken" : { "Fn::GetAtt": [ "Clockwork", "TokenArn" ] },
    "SchedulerDynamoDBTable" : { "Fn::GetAtt": [ "Clockwork", "SchedulerDynamoDBTable" ] },
    "Region" : { "Ref" : "AWS::Region"},
    "Name" : "Do Accruals Nightly Processing",
    "CronTime" : "*/2 * * * *",
    "TaskDefinitionArn" : { "Ref" : "DoAccrualsTaskDefinition" },
    "ECSClusterArn" : { "Fn::GetAtt": [ "ECSCluster", "ECSCluster" ] }
  }
},
```

The properties are:

| Property             | Value                                                          |
|-----------------|----------------------------------------------------------------|
| ServiceToken    | The ARN for the lambda_ecs_clockwork lambda function
| SchedulerDynamoDBTable| The name of the DynamoDB table that the scheduler service is using        |
| TaskDefinitionArn | The ARN of the task definition you want to run      |
| Region      | Your aws region                                              |
| CronTime       | The execution schdule as supported by  https://github.com/harrisiirak/cron-parser |
| ECSClusterArn      | The cluster that is to run the task|

The actual scheduler is https://github.com/tejasmanohar/node-schedule so you can use any ```CronTime``` that the project supports.


## Worker service

This project's Dockerfile will build a container that can run the worker service.

It is started so:

```
docker run --rm=true --env AWS_REGION=<Your Region> --env DYNAMO_TABLE=<Your DyanmoDB TableName> quay.io/elevate_invest/aws-ecs-clockwork "node worker/process.js"
```

## Cloudformation

The ```.aws/cloudformation.json``` shows an example stack that will create the Lambda function, DynamoDB table, and ECS Cluster service and hook them all together.  Once the stack is up you can use the Custom resource in your cloud formations.
