/**
 * Created by westopher on 9/22/15.
 */
var amqp = require('amqplib/callback_api');
var module = require('./patterns');

/*amqp.connect('amqp://localhost', function(err, conn) {
    conn.createChannel(function(err, ch) {
        var q = 'model.user.email';
        var msg = process.argv.slice(2).join(' ') || "Hello World!";

        ch.assertQueue(q, {durable: true});
        ch.sendToQueue(q, new Buffer(msg), {persistent: true});
        console.log(" [x] Sent '%s'", msg);
    });
    setTimeout(function() { conn.close(); process.exit(0) }, 500);
});*/

var service = module('model.user');

service.callRpc('getPassword', {}, function (response) {
    console.log('RPC succeeded!');
    console.log(response);
});