const request = require("request-promise-native");

const WH_BASE_URL = "https://sentinel.whitehatsec.com/api";
const whKey = process.env.WH_KEY;
const bitbucketUsername = process.env.BB_APP_USER;
const bitbucketPassword = process.env.BB_APP_PASS;

async function getApplications () {
  const whAppUri = WH_BASE_URL + "/application?key=" + whKey + "&display_all=1";

  // Create the application
  const options = {
    method: "GET",
    uri: whAppUri,
    json: true, // Automatically stringifies the body to JSON
  };

  const applicationMappings = await request(options)
    .then(function (parsedBody) {
      return parsedBody;
    })
    .catch(function (err) {
      console.log(err);
    });

  return applicationMappings;
}

async function addExclusions (applications) {
  // Loop through applications and add exclusions
  for (const app in applications.collection) {
    const appId = applications.collection[app].id;

    // This means the app was created successfully
    const exclusionOptions = {
      method: "PUT",
      uri: WH_BASE_URL + "/application/" + appId + "?key=" + whKey,
      body: {
        "engine_conf": { // Undocumented in WH API docs
          "exclude_directories": "/test/,test.js,test",
        },
      },
      json: true, // Automatically stringifies the body to JSON
    };

    // Add exclusions to this app so you arent using test code
    return request(exclusionOptions);
  }
}

async function runFullScan (applications) {
  for (const app in applications.collection) {
    const appId = applications.collection[app].id;

    const fullScanOptions = {
      method: "PUT",
      uri: WH_BASE_URL + "/application/" + appId + "/full_scan" + "?key=" + whKey,
      body: {
        "app_scan": "full_scan",
      },
      json: true, // Automatically stringifies the body to JSON
    };

    return request(fullScanOptions);
  }
}

async function scheduleFullScan (applications) {
  for (const app in applications.collection) {
    const appId = applications.collection[app].id;

    const scheduleOptions = {
      method: "PUT",
      uri: WH_BASE_URL + "/application/" + appId + "/scan_schedule" + "?key=" + whKey + "&format=json",
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
      json: true, // Automatically stringifies the body to JSON
    };

    return request(scheduleOptions);
  }
}

async function createApplications (repos, projectBlacklist, repoBlacklist) {
  // For each project, create the application in WH

  for (const repo in repos) {
    const repoName = repos[repo].name;
    const projName = repos[repo].project.name;
    let repoURL = repos[repo].links.clone[0].href;

    repoURL = repoURL.replace("lifeomic", "lifeomic-bitbucket");

    // Check to see if project is in blacklist
    if (!projectBlacklist.includes(projName) && !repoBlacklist.includes(repoName)) {
      // Create the application and start the prescan
      const options = {
        method: "POST",
        uri: WH_BASE_URL + "/create_application_and_scan" + "?key=" + whKey,
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
        json: true, // Automatically stringifies the body to JSON
      };

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

module.exports = {
  createApplications,
  addExclusions,
  runFullScan,
  scheduleFullScan,
  getApplications,
};
