/**
 * Created by westopher on 9/22/15.
 */
var railgun = require('./railgun');
var patterns = require('./patterns');

var service = patterns('model.user')
    .workQueue('email', function () {
        console.log('Emailing.');
    })
    .routed('crud', ['create', 'read', 'update', 'delete'], function (user) {

    })
    .pubSub('save', function (user) {
        console.log('Saving.');
    })
    .rpc('getPassword', function (password) {
        return {password: 'abc123'};
    });

console.log(
    service
);

service.init(function () {
    console.log('User service running!');
});