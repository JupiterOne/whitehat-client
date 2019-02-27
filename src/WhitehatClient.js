const request = require('request-promise-native');

const WH_BASE_URL = 'https://sentinel.whitehatsec.com/api';
const wh_key = process.env.WH_KEY;
const bitbucket_username = process.env.BB_APP_USER;
const bitbucket_password = process.env.BB_APP_PASS;

async function getApplications () {
  const wh_app_uri = WH_BASE_URL + '/application?key=' + wh_key + '&display_all=1';

  // Create the application
  const options = {
    method: 'GET',
    uri: wh_app_uri,
    json: true // Automatically stringifies the body to JSON
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
  for (app in applications.collection) {
    const appId = applications.collection[app].id;

    // This means the app was created successfully
    const exclusionOptions = {
      method: 'PUT',
      uri: WH_BASE_URL + '/application/' + appId + '?key=' + wh_key,
      body: {
        'engine_conf': { // Undocumented in WH API docs
          'exclude_directories': '/test/,test.js,test'
        }
      },
      json: true // Automatically stringifies the body to JSON
    };

    // Add exclusions to this app so you arent using test code
    await request(exclusionOptions)
      .then(function (parsedBody) {
        console.log('Asset Exclusions Updated for ' + parsedBody.label);
      })
      .catch(function (err) {
        console.log(err);
      });
  }
}

async function runFullScan (applications) {
  for (app in applications.collection) {
    const appId = applications.collection[app].id;
    const appName = applications.collection[app].label;

    const fullScanOptions = {
      method: 'PUT',
      uri: WH_BASE_URL + '/application/' + appId + '/full_scan' + '?key=' + wh_key,
      body: {
        'app_scan': 'full_scan'
      },
      json: true // Automatically stringifies the body to JSON
    };

    await request(fullScanOptions)
      .then(function (parsedBody) {
        console.log('Full scan started for ' + parsedBody.label);
      })
      .catch(function (err) {
        if (err.statusCode === 403) {
          console.log(appName + ': ' + err.message);
        } else {
          console.log(err.message);
        }
      });
  }
}

async function scheduleFullScan (applications) {
  for (app in applications.collection) {
    const appId = applications.collection[app].id;
    const appName = applications.collection[app].label;

    const scheduleOptions = {
      method: 'PUT',
      uri: WH_BASE_URL + '/application/' + appId + '/scan_schedule' + '?key=' + wh_key + '&format=json',
      body: {
        'timezone': 'America/New_York',
        'name': 'scan_daily',
        'specs': [
          {
            'type': 'daily',
            'time': '00:18:00'
          }
        ]
      },
      json: true // Automatically stringifies the body to JSON
    };

    await request(scheduleOptions)
      .then(function (parsedBody) {
        console.log('Schedule created for ' + parsedBody.id);
      })
      .catch(function (err) {
        if (err.statusCode === 403) {
          console.log('Schedule already made for ' + appName);
        } else {
          console.log(err.message);
        }
      });
  }
}

async function createApplications (repos, projectBlacklist, repoBlacklist) {
  // For each project, create the application in WH

  for (repo in repos) {
    const repoName = repos[repo].name;
    const projName = repos[repo].project.name;
    let repoURL = repos[repo].links.clone[0].href;
    let appID;
    let successFlag;

    repoURL = repoURL.replace('lifeomic', 'lifeomic-bitbucket');

    // Check to see if project is in blacklist
    if (!projectBlacklist.includes(projName) && !repoBlacklist.includes(repoName)) {
      // Create the application and start the prescan
      const options = {
        method: 'POST',
        uri: WH_BASE_URL + '/create_application_and_scan' + '?key=' + wh_key,
        body: {
          'label': projName + '/' + repoName,
          'appliance': {
            'id': '2131'
          },
          'language': 'Discover',
          'app_default_scan': 'prescan',
          'codebases': [
            {
              'label': projName + '/' + repoName,
              'repository_uri': repoURL,
              'repository_type': 'git',
              'repository_revision': 'HEAD',
              'auth_type': 'password',
              'username': bitbucket_username,
              'password': bitbucket_password
            }
          ]
        },
        json: true // Automatically stringifies the body to JSON
      };

      await request(options)
        .then(function (parsedBody) {
          appID = parsedBody.id;
          successFlag = true;
          return 'Asset Created for ' + repoName;
        })
        .catch(function (err) {
          if (err.statusCode == '409') {
            successFlag = false;
            console.log(repoName + ' already exists');
          } else {
            successFlag = false;
            console.log('Error: Could not create ' + repoName + ' application');
          }
        });
    } else {
      console.log(repoName + ' is on the blacklist. Skipping');
    }
  }
}

async function updateAppWithExclusions (exclusionOptions) {
  // Make request to update app

  await request(exclusionOptions)
    .then(function (parsedBody) {
      return 'Asset Exclusions Updated for ' + exclusionOptions.body.label;
    })
    .catch(function (err) {
      if (err.statusCode == '409') {
        console.log(exclusionOptions.body.label + ' exclusions already exist');
      } else {
        console.log('Error: Could not update ' + exclusionOptions.body.label + ' application');
      }
    });
}

function transformApplicationId (item, Index) {
  const container = {};
  container.name = item.label;
  container.id = item.id;

  return container;
}

module.exports = {
  createApplications: createApplications,
  addExclusions: addExclusions,
  runFullScan: runFullScan,
  scheduleFullScan: scheduleFullScan,
  getApplications

};
