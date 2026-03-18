'use strict';

module.exports =
    process.env.SAUCE_TUNNEL_NAME
    || process.env.BAMBOO_BUILD_KEY
    || `${process.env.USER || process.env.USERNAME || 'local'}-sharedid-dev`;
