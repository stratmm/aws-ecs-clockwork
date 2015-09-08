console.log('Start');

var aws = require('aws-sdk');
var _ = require('underscore');
var schedule = require('node-schedule');
var Moment = require('moment');

var dynamo = new aws.DynamoDB({ region: process.env.AWS_REGION });

var jobs = {};

// Make the start time in the far past for startup
var start_time = Moment().subtract(10, 'years');

var getAllDBJobs = function(fn) {
  result = dynamo.scan({
    TableName: process.env.DYNAMO_TABLE,
    Limit: 1000
  }, function(err, data){
    var return_data = [];
    if (!_.isNull(data) && !_.isUndefined(data.Count) && data.Count > 0) {
      _.each(data.Items, function(item, index, items){
        console.log(item.id, item.name, item.cron_time, item.definition_arn, item.ecs_cluster_arn, item.last_updated);
        var return_item = {};
        return_item.id = item.id.S;
        return_item.cron_time = item.cron_time.S;
        return_item.name = item.name.S;
        return_item.definition_arn = item.definition_arn.S;
        return_item.ecs_cluster_arn = item.ecs_cluster_arn.S;
        return_item.last_updated = item.last_updated.S;
        return_data.push(return_item);
      }, this);
    }
    fn(err, return_data);
  });
};

var setUpJobs = function() {
  getAllDBJobs(function(err, db_jobs){
    if (db_jobs.length > 0 ) {
      _.each(db_jobs, function(db_job, index, db_jobs){
        var job = jobs[db_job.id];
        if (!_.isUndefined(job)) {
          if (start_time.isBefore(Moment(db_job.last_updated))) {
            console.log('removing job for update');
            job.cancel();
            job = schedule.scheduleJob(db_job.cron_time, function(){
                   console.log("Running:", db_job.id);
            });
            jobs[db_job.id] = job;
          }
        } else {
          console.log('scheduling job');
          job = schedule.scheduleJob(db_job.cron_time, function(){
                 console.log("Running:", db_job.id);
          });
          jobs[db_job.id] = job;
        }
      });
    }
  });
};

setUpJobs();
console.log(jobs);

// Set the start time to no for job updates
start_time = Moment();


setInterval(function() {
  console.log('Checking for Job Changes');
  setUpJobs();
  console.log(jobs);
}, 30000);

console.log("Exit");
