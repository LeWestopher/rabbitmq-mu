/**
 * Created by westopher on 9/22/15.
 */
var railgun = require('./railgun');
var module = require('./patterns');

var service = module('model.user')
    // Sets up a work queue on the module that subscribes to the 'model.user.email' queue
    .workQueue('email', function () {
        console.log('Emailing.');
    })
    // Sets up a routed exchange that routes based on keyword.  This maps to 'model.user.crud'
    .routed('crud', ['create', 'read', 'update', 'delete'], function (user) {

    })
    // Sets up a a subscription to a particular publication.  This one being 'model.user.save'
    .pubSub('save', function (user) {
        console.log('Saving.');
    })
    // Sets up a remote procedure call that allows us to call this service method like a function.
    // This has an extra key on it: 'model.user.rpc.getPassword'.
    .rpc('getPassword', function (password) {
        return {password: 'abc123'};
    });

console.log(
    service
);

// Our init function connects to the AMQP server and registers our patterns with the server under the respective
// queue and exchange names.  This method takes a callback to signify that the server is running.
service.init(function () {
    console.log('User service running!');
});