const express = require('express');
const axios = require('axios');
const { collectDefaultMetrics, Gauge, Registry } = require('prom-client');
const https = require('https');
const htmlEntities = require('html-entities');
const e = require('express');
const fs = require('fs');

const app = express();
const port = 3000; // Change to your desired port number

// Read the application configurations from environment variables
// const appConfigurations = JSON.parse(process.env.APP_CONFIG || '[]');

const scrapeInterval = process.env.SCRAPING_INTERVAL || 15; // Default to 15 seconds

// Create a Prometheus registry to hold the metrics
const promRegistry = new Registry();

// Define the Prometheus metrics
const appStatus = new Gauge({
  name: 'appStatus',
  help: 'Current status of the finacle application (0 = Unhealthy, 1 = Healthy)',
  labelNames: ['application'],
  registers: [promRegistry],
});

const lastUpdTime = new Gauge({
  name: 'lastUpdTime',
  help: 'Last update time of the metrics',
  registers: [promRegistry],
});


async function getAppConfigurations() {
  try {
    var setupEnv = process.env.SETUP_ENV || 'LOCAL';
    if (setupEnv === 'LOCAL') {
      const configFilePath = './app-config.json';
      const data = fs.readFileSync(configFilePath, 'utf8');
      const config = JSON.parse(data);
      return config.applications;
    }
    else {
      const config = JSON.parse(process.env.APP_CONFIG || '[]');
      return config.applications;
    }
  } catch (error) {
    console.error('Error reading app configurations:', error.message);
    return [];
  }
}

// Function to fetch the status from the application's endpoint
async function getAppStatus() {
  try {

    const appConfigurations = await getAppConfigurations();

    const responses = await Promise.all(
      appConfigurations.map(async (endpointObj) => {
        const response = await axios.get(endpointObj.url, {
          httpsAgent: new https.Agent({
            rejectUnauthorized: false,
          }),
        });

        var jsonObject = "";

        if (endpointObj.name === 'APIHUB') {
          jsonObject = response.data;
        }
        else {
          const trimmedString = response.data.trim();
          const decodedString = htmlEntities.decode(trimmedString);
          const updatedResponse = decodedString.replace(" status", "\"status\"");
          jsonObject = JSON.parse(updatedResponse);
        }
        return {
          name: endpointObj.name,
          status: jsonObject.status
        };
      })
    );
    return responses;

  } catch (error) {
    console.error('Error fetching app status:', error.message);
    const appStatus = [{
      name: 'FINACLE',
      status: 'DOWN'
    }];
    return appStatus;
  }
}

// Function to update the Prometheus metrics with the application status
async function updateMetrics() {
  try {
    const appStat = await getAppStatus();
    if (!appStat) {
      return;
    }

    // Reset the metrics before updating
    appStatus.reset();

    // Update the metrics for each endpoint and include the application names as labels
    appStat.forEach((stats) => {
      const { name, status } = stats;
      appStatus.set({ application: name }, status === 'UP' ? 1 : 0);
    });

    lastUpdTime.set(Date.now());
  } catch (error) {
    console.error('Error updating metrics:', error);
  }
}

// Update the metrics every 15 seconds (adjust the interval as needed)
setInterval(updateMetrics, scrapeInterval * 1000);

// Endpoint to serve the Prometheus metrics
app.get('/metrics', async (req, res) => {
  try {
    // Update metrics before serving to get the latest data
    await updateMetrics();

    // Get the metrics as a string in Prometheus Exposition Format
    const metrics = await promRegistry.metrics();

    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    console.error('An error occurred:', error);
    res.status(500).send('An error occurred');
  }
});

// Start collecting default metrics (e.g., CPU, memory, event loop)
// collectDefaultMetrics({ register: promRegistry });

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
