/**
 * Created by westopher on 9/22/15.
 */
var amqp = require('amqplib/callback_api');

/**
 * Pistol is the primary library used for delegating tests to workers for request checking
 *
 * @param test
 */
function pistol (test) {

    amqp.connect('amqp://localhost', function (err, conn) {

        conn.createChannel(function (err, channel) {

            var json_msg = JSON.stringify(test);

            channel.assertQueue('railgun_queue', {durable: true});
            channel.sendToQueue('railgun_queue', new Buffer(json_msg), {persistent: true});
            console.log('%s was successfully sent to the queue.', json_msg);

        });

    });
}

module.exports = pistol;