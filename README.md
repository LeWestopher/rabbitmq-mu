# Mu.js - An elegant solution to building RabbitMQ-based Node.js microservices

This respository is currently under construction due to the conversion from a callback based architecture to a promise based
architecture, but you are still welcome to peruse some of the code that is available to view.  Here are some (untested and potentially explosive) examples:

## Getting a connection object

To get a connection object, we use the `.connect()` method:

```javascript

var rabbitmq = require('./patterns');

rabbitmq('your-namespace')
    .connect()
    .then(function (connection) {
        // Use your connection object here!
    });
```

## Manually building a Publish/Subscribe exchange

First we must get our connection object, and then build a new PubSub object with it as the first argument:

```javascript

var rabbitmq = require('./patterns');
var PubSub = require('./PubSub/index');

rabbitmq('your-namespace')
    .connect()
    .then(function (connection) {
        var microservice = new PubSub('your-pubsub-namespace');
        // This returns a promise which contains the message object which can then be handled
        return microservice.consume(connection);
    }
    .then(function (message) {
        // Consume the message on publish here
        console.log('[MESSAGE RECEIVED] ' + message.content.toString());
    });

```

## Manually building a Topic-based exchange

Again, we get our connection object, then build a Topic based exchange object

```javascript

var rabbitmq = require('./patterns');
var Topic = require('./Topic/index');

rabbitmq('your-namespace')
    .connect()
    .then(function (connection) {
        // This exchange will only subscribe to 'your-pubsub-namepsace', with 'topicA', 'topicB', and 'TopicC'
        var microservice = new Topic('your-pubsub-namespace', ['topicA', 'topicB', 'topicC']);
        // This returns a promise which contains the message object which can then be handled
        return microservice.consume(connection);
    })
    .then(function (message) {
        // Consume the message on publish here
        console.log('[MESSAGE RECEIVED] ' + message.content.toString());
    });
```

## Roadmap

- [ ] Full Documentation for all subscription types
- [ ] Uploaded to NPM for inclusion via package manager
- [ ] Better design for how multiple microservice daemons are built on a single RabbitMQ namespace
- [ ] Inclusion of the message topic in the returned arguments for a Topic-based exchange
- [ ] Configurable connection input for RabbitMQ.  Currently is set to the typical localhost connection
- [ ] Full testing utilizing Jasmine