const request = require("request-promise-native");

class WhitehatClient {
  constructor (whKey) {
    if (!whKey) {
      throw new Error("Whitehat API key must be defined");
    }

    this.whKey = whKey;
    this.whBaseUrl = "https://sentinel.whitehatsec.com/api";
  }

  getUrl (options = {}) {
    let url = this.whBaseUrl + (options.base !== null
      ? this.urlPart(options.base || "application")
      : "/"
    );

    if (options.appId) { url += this.urlPart(options.appId); }
    if (options.additionalPathPart) { url += this.urlPart(options.additionalPathPart); }

    url += "?key=" + this.whKey;

    if (options.queryParams) { url += "&" + options.queryParams.join("&"); }

    return url;
  }

  async getAll (options) {
    let offset = 0;
    if (options.pageInfo) {
      const total = options.pageInfo.total;
      const limit = options.pageInfo.limit;
      const previousOffset = options.pageInfo.offset;

      if (previousOffset + limit < total) {
        offset = previousOffset + limit;
      } else {
        return options.collection;
      }
    }

    const requestOptions = this.requestOptions({
      uri: this.getUrl({
        ...options.url,
        queryParams: [`page:offset=${offset}`],
      }),
    });

    const result = await request(requestOptions);

    options.collection = (options.collection || []).concat(result.collection);
    options.pageInfo = result.page;

    return this.getAll(options);
  }

  urlPart (part) {
    return "/" + part;
  }

  requestOptions (options) {
    options.method = options.method || "GET";
    options.json = true; // Automatically stringifies the body to JSON
    return options;
  }

  async getApplications () {
    const options = this.requestOptions({
      uri: this.getUrl({
        queryParams: ["display_all=1"],
      }),
    });

    return (await request(options)).collection;
  }

  async getResources () {
    const options = this.requestOptions({
      uri: this.getUrl({
        base: null,
      }),
    });

    return request(options);
  }

  async getVulnerabilities (appId) {
    return this.getAll({
      url: {
        appId: appId,
        additionalPathPart: "vuln",
      },
    });
  }

  async addExclusions (applications) {
    // Loop through applications and add exclusions
    const exclusionRequests = [];

    for (const app in applications.collection) {
      const appId = applications.collection[app].id;

      // This means the app was created successfully
      const exclusionOptions = this.requestOptions({
        method: "PUT",
        uri: this.getUrl({ appId }),
        body: {
          "engine_conf": { // Undocumented in WH API docs
            "exclude_directories": "/test/,test.js,test",
          },
        },
      });

      // Add exclusions to this app so that you don't scan test code
      exclusionRequests.push(request(exclusionOptions));
    }

    return exclusionRequests;
  }

  async runFullScan (applications) {
    for (const app in applications.collection) {
      const appId = applications.collection[app].id;

      const fullScanOptions = this.requestOptions({
        method: "PUT",
        uri: this.getUrl({ appId, additionalPathPart: "full_scan" }),
        body: {
          "app_scan": "full_scan",
        },
      });

      return request(fullScanOptions);
    }
  }

  async scheduleFullScan (applications) {
    for (const app in applications.collection) {
      const appId = applications.collection[app].id;

      const scheduleOptions = this.requestOptions({
        method: "PUT",
        uri: this.getUrl({
          appId,
          additionalPathPart: "scan_schedule",
          queryParams: ["format=json"],
        }),
        body: {
          "timezone": "America/New_York",
          "name": "scan_daily",
          "specs": [
            {
              "type": "daily",
              "time": "00:18:00",
            },
          ],
        },
      });

      return request(scheduleOptions);
    }
  }

  async createApplications (repos, projectBlacklist, repoBlacklist, bitbucketUsername, bitbucketPassword) {
    // For each project, create the application in WH

    for (const repo in repos) {
      const repoName = repos[repo].name;
      const projName = repos[repo].project.name;
      let repoURL = repos[repo].links.clone[0].href;

      repoURL = repoURL.replace("lifeomic", "lifeomic-bitbucket");

      // Check to see if project is in blacklist
      if (!projectBlacklist.includes(projName) && !repoBlacklist.includes(repoName)) {
        // Create the application and start the prescan
        const options = this.requestOptions({
          method: "POST",
          uri: this.getUrl({ base: "create_application_and_scan" }),
          body: {
            "label": projName + "/" + repoName,
            "appliance": {
              "id": "2131",
            },
            "language": "Discover",
            "app_default_scan": "prescan",
            "codebases": [
              {
                "label": projName + "/" + repoName,
                "repository_uri": repoURL,
                "repository_type": "git",
                "repository_revision": "HEAD",
                "auth_type": "password",
                "username": bitbucketUsername,
                "password": bitbucketPassword,
              },
            ],
          },
        });

        await request(options)
          .then(function (parsedBody) {
            return "Asset Created for " + repoName;
          })
          .catch(function (err) {
            if (err.statusCode === "409") {
              console.log(repoName + " already exists");
            } else {
              console.log("Error: Could not create " + repoName + " application");
            }
          });
      } else {
        console.log(repoName + " is on the blacklist. Skipping");
      }
    }
  }
}

module.exports = WhitehatClient;
