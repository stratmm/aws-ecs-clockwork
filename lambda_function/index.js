console.log('Loading function');

exports.handler = function(event, context) {
  // dependencies
  var aws = require('aws-sdk');
  var uuid = require('node-uuid');

  // set variables
  var region = event.ResourceProperties.Region;
  var table = event.ResourceProperties.SchedulerDynamoDBTable;

  var response, dynamo;
  dynamo = new aws.DynamoDB({ region: region });
  console.log(dynamo);

  try {
      response = require('cfn-response');
  }
  catch( e ) {
      if ( e.code === 'MODULE_NOT_FOUND' ) {
          response = {
            SUCCESS: "SUCCESS",
            FAILED: 'FAILED',
            send: function(event, context, responseStatus, responseData, physicalResourceId) {
              console.log('event, context, responseStatus, responseData, physicalResourceId');
              console.log(event, context, responseStatus, responseData, physicalResourceId);
              return true;
            }
          };
      }
  }



  // batch create inside Dynamo
  var create_record = function(properties, fn) {
    properties.Id = uuid.v4();
    var obj = {
      TableName: table,
      Item: item(properties)
    };
    var result = dynamo.putItem(obj, fn);
    return result;
  };

  // batch update  inside Dynamo
  var update_record = function(properties, fn) {
    properties.Id = event.PhysicalResourceId;
    var obj = {
      TableName: table,
      Item: item(properties)
    };
    var result = dynamo.putItem(obj, fn);
    return result;
  };

  // batch delete tasks inside Dynamo
  var delete_record = function(properties, fn) {
    properties.Id = event.PhysicalResourceId;
    var obj = {
      TableName: table,
      Key: key(properties)
    };
    var result = dynamo.deleteItem(obj, fn);
    return result;
  };

  // handle errors encountered
  var onError = function(err, data) {
    var resp = { Error: err };
    console.log(resp.Error + ':\\n', err);
    console.log(data);
    response.send(event, context, response.FAILED, resp);
  };

  // map the new and old resource definitions
  var defs = event.ResourceProperties;
  var oldDefs = event.OldResourceProperties;

  switch(event.RequestType) {
    case 'Create':
      // just create tasks...
      if (is_cron_valid(defs.CronTime)) {
        create_record(defs, function(err, data) {
          if (err) onError('Create call failed', data);
          else response.send(event, context, response.SUCCESS, {}, defs.Id);
        });
      } else {
        response.send(event, context, response.FAILED, {}, defs.Id);
      }

      break;
    case 'Update':
      if (is_cron_valid(defs.CronTime)) {
        // first delete, then update the tasks
        update_record(defs, function(err, data) {
          if (err) onError('Update call failed', data);
          else response.send(event, context, response.SUCCESS, {}, defs.Id);
        });
      } else {
        response.send(event, context, response.FAILED, {}, defs.Id);
      }
      break;
    case 'Delete':
      // delete the tasks
      delete_record(defs, function(err, data) {
        if (err) onError('Delete call failed', data);
        else response.send(event, context, response.SUCCESS, {}, defs.Id);
      });
      break;
  }
};

var is_cron_valid = function(cron_time) {
    var parser = require('cron-parser');
  try {
    var interval = parser.parseExpression(cron_time);

    return true;
  } catch (err) {
    console.log(err);
    return false;
  }

};

var key = function(properties) {
  return {
    id: {
      S: properties.Id
    }
  };
};

var item = function(properties) {
  return {
    id: { S: properties.Id },
    cron_time: { S: properties.CronTime },
    name: { S: properties.Name },
    definition_arn: { S: properties.TaskDefinitionArn },
    ecs_cluster_arn: { S: properties.ECSClusterArn },
    last_updated: { S: new Date().toISOString() }
  };
};
