console.log('Start');

var aws = require('aws-sdk');
var _ = require('underscore');
var schedule = require('node-schedule');
var Moment = require('moment');

var dynamo = new aws.DynamoDB({ region: process.env.AWS_REGION });
var ecs = new aws.ECS({
  region: process.env.AWS_REGION
});

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

var executeJob = function(db_job) {
  console.log('Running Task:', db_job.id);
  var params = {
    taskDefinition: db_job.definition_arn, /* required */
    cluster: db_job.ecs_cluster_arn,
    count: 1,
    startedBy: 'ecs-aws-clockwork'
  };
  ecs.runTask(params, function(err, data) {
    console.log('err, data');
    console.log(err, data);
    if (err) console.log(err, err.stack); // an error occurred
    else     console.log(data);           // successful response
  });
};

var setUpJobs = function() {
  getAllDBJobs(function(err, db_jobs){
    if (db_jobs.length > 0 ) {
      // deal with any new or updated jobs
      _.each(db_jobs, function(db_job, index, db_jobs){
        var job = jobs[db_job.id];
        if (!_.isUndefined(job)) {
          if (start_time.isBefore(Moment(db_job.last_updated))) {
            job.cancel();
            job = schedule.scheduleJob(db_job.cron_time, function(){
                   executeJob(db_job);
            });
            jobs[db_job.id] = job;
          }
        } else {
          job = schedule.scheduleJob(db_job.cron_time, function(){
                 executeJob(db_job);
          });
          jobs[db_job.id] = job;
        }
      });
    }

    // Now deal with any jobs that have been deleted
    _.each(_.keys(jobs), function(job_key, index, job_keys){
      var found_job = _.find(db_jobs, function(db_job){
        if (db_job.id === job_key) {
          return true;
        } else {
          return false;
        }
      }, this);
      if (_.isUndefined(found_job)) {
        console.log('Cancelling Deleted Job:', job_key);
        jobs[job_key].cancel();
        delete jobs[job_key];
      }
    }, this);

  });
};



setUpJobs();

// Set the start time to no for job updates
start_time = Moment();


setInterval(function() {
  console.log('Checking for Job Changes');
  setUpJobs();
  console.log(jobs);
}, 10000);

console.log("Exit");
