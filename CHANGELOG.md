# Change Log

All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org).

## [0.1.2] - 2016-02-27 - Wes King

### Added

-   Wired in the default/configs object
-   Changed the nomenclature from 'conn' to 'connection' for all cases of it's usage
-   Wired in new pattern for creating shorthand patterns that should potentially work
-   Added in the namespace divider in the appropriate places
-   Added in new shorthand work queue documentation
-   module.exports moved to top of file for readability

### Removed

-   Removed the useless init function from the patterns prototype

## [0.1.1] - 2016-02-23 - Wes King

### Added

-   Added in custom host configuration and defaults object

## [0.1.0] - 2016-02-23 - Wes King

### Added

-   Dropped in Q.js as our primary promise library, now all daemons can be asynchronously chained
-   Rearranged all of the queue types into discreet folders
-   Added some documentation regarding getting a connection object in the readme

