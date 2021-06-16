const Promise = require("bluebird");
const cacheManager = require("cache-manager");

function memoryCache(config) {
  return cacheManager.caching({
    store: "memory",
    ...config,
  });
}

function redisCache(config) {
  if (config && Array.isArray(config.configure)) {
    const redis = require("redis");
    const client = redis.createClient({
      retry_strategy() {},
      ...config,
    });

    Promise.all(
      config.configure.map(
        (options) =>
          new Promise((resolve, reject) => {
            client.config("SET", ...options, function (err, result) {
              if (err || result !== "OK") {
                reject(err);
              } else {
                resolve(result);
              }
            });
          })
      )
    ).then(() => client.quit());
  }

  return cacheManager.caching({
    store: require("cache-manager-redis"),
    retry_strategy() {},
    ...config,
  });
}

function redisClusterCache(config) {
  return cacheManager.caching({
    store: require("cache-manager-ioredis"),
    clusterConfig: {
      nodes: config.nodes,
      options: config.options,
    },
    ...config,
  });
}

function memcachedCache(config) {
  return cacheManager.caching({
    store: require("cache-manager-memcached-store"),
    ...config,
  });
}

function multiCache(config) {
  const stores = config.stores.map(makeCache);
  return cacheManager.multiCaching(stores);
}

const cacheBuilders = {
  memory: memoryCache,
  multi: multiCache,
  redis: redisCache,
  redisCluster: redisClusterCache,
  memcached: memcachedCache,
};

function makeCache(config = { type: "memory" }) {
  const builder = cacheBuilders[config.type];
  if (!builder) {
    throw new Error("Unknown store type: " + config.type);
  }

  return Promise.promisifyAll(builder(config));
}

module.exports = makeCache;
