const { getEnv } = require("./js/helpers");
const { InfluxDB, Point } = require("@influxdata/influxdb-client");
const { setIntervalAsync, clearIntervalAsync } = require("set-interval-async/fixed");
const env = getEnv;
const risPortService = require("cisco-risport");
const sessionSSO = require("./js/sessionSSO");
const log = require("fancy-log");

// Setup influxdb connection
const org = env.INFLUXDB_ORG;
const bucket = env.INFLUXDB_BUCKET;
const client = new InfluxDB({
  url: env.INFLUXDB_URL,
  token: env.INFLUXDB_TOKEN,
});

// This should not be less than 4 seconds. By default RisPort70 accepts up to 18 requests per minute, combined across all RisPort70 applications
const interval = parseInt(env.RP_INTERVAL);
// Set up variable to hold select items variable. If set convert to an array, otherwise set to empty string
const selectItems = env.RP_SELECTITEM ? env.RP_SELECTITEM.split(",").map((item) => item.trim()) : "";

//SSO Array to store cookies for each server. This is used to keep the session alive and reduce the number of logins per interval.
var ssoArr = sessionSSO.getSSOArray();
// Check for rate control. If detected we will increase the interval to self heal.
var rateControl = false;

try {
  let timer = setIntervalAsync(request, interval);
  async function request() {
    log(`RISPORT DATA: Collection will (re)run every ${interval / 1000} seconds`);
    const writeApi = client.getWriteApi(org, bucket);
    var points = [];
    var service = new risPortService(env.CUCM_HOSTNAME, env.CUCM_USERNAME, env.CUCM_PASSWORD);
    const Models = service.returnModels();
    const StatusReason = service.returnStatusReasons();
    try {
      // Let's see if we have a cookie for this server, if so we will use it instead of basic auth.
      const ssoIndex = ssoArr.findIndex((element) => element.name === env.CUCM_HOSTNAME);
      if (ssoIndex !== -1) {
        // Update the perfmon service with the SSO auth cookie
        service = new risPortService(env.CUCM_HOSTNAME, "", "", { cookie: ssoArr[ssoIndex].cookie });
      }

      // Collect the counter data from the server
      var risportOutput = await service.selectCmDevice(env.RP_SOAPACTION, env.RP_MAXRETURNEDDEVICES, env.RP_DEVICECLASS, env.RP_MODEL, env.RP_STATUS, env.RP_NODE, env.RP_SELECTBY, selectItems, env.RP_PROTOCOL, env.RP_DOWNLOADSTATUS);

      if (risportOutput.cookie) {
        ssoArr = sessionSSO.updateSSO(env.CUCM_HOSTNAME, { cookie: risportOutput.cookie });
      }

      if (risportOutput.results) {
        risportOutput.results.map((item) => {
          if (item.ReturnCode === "Ok" && "CmDevices" in item) {
            server = item.Name;
            writeApi.useDefaultTags({ host: server });
            if (Array.isArray(item?.CmDevices?.item)) {
              // Array returned
              item?.CmDevices?.item.map((item) => {
                // Fix for SIP trunks being partially registered
                if (item.Status === "UnRegistered" && item.StatusReason === "0" && item.DeviceClass === "SIPTrunk") {
                  item.StatusReason = "2";
                }

                // Fix for SIP trunks being unregistered but StatusReason showing as registered
                if (item.Status === "Unknown" && item.StatusReason === "0" && item.DeviceClass === "SIPTrunk") {
                  item.StatusReason = "3";
                }

                // Fix for SIP trunks being rejected but StatusReason showing as registered
                if (item.Status === "Rejected" && item.StatusReason === "0" && item.DeviceClass === "SIPTrunk") {
                  item.StatusReason = "4";
                }

                // If we get a StatusReason that is not defined set it to Unknown
                if (!StatusReason.hasOwnProperty(parseInt(item.StatusReason))) {
                  item.StatusReason = 1;
                }

                points.push(
                  new Point(item.DeviceClass)
                    .tag("ipAddress", item.IPAddress.item.IP)
                    .tag("statusReason", StatusReason[parseInt(item.StatusReason)])
                    .tag("name", item.Name)
                    .tag("model", Models[parseInt(item.Model)])
                    .tag("userId", item.LoginUserId)
                    .tag("protocol", item.Protocol)
                    .tag("activeLoad", item.ActiveLoadID)
                    .tag("downloadStatus", item.DownloadStatus)
                    .tag("registrationAttempts", item.RegistrationAttempts)
                    .tag("timeStamp", item.TimeStamp)
                    .tag("status", item.Status)
                    .intField("reasonCode", item.StatusReason)
                );
              });
            } else {
              // Not an array returned

              // Fix for SIP trunks being partially registered
              if (item?.CmDevices?.item.Status === "UnRegistered" && item?.CmDevices?.item.StatusReason === "0" && item?.CmDevices?.item.DeviceClass === "SIPTrunk") {
                item.CmDevices.item.StatusReason = "2";
              }

              // Fix for SIP trunks being unregistered but StatusReason showing as registered
              if (item?.CmDevices?.item.Status === "Unknown" && item?.CmDevices?.item.StatusReason === "0" && item?.CmDevices?.item.DeviceClass === "SIPTrunk") {
                item.CmDevices.item.StatusReason = "3";
              }

              // Fix for SIP trunks being rejected but StatusReason showing as registered
              if (item?.CmDevices?.item.Status === "Rejected" && item?.CmDevices?.item.StatusReason === "0" && item?.CmDevices?.item.DeviceClass === "SIPTrunk") {
                item.CmDevices.item.StatusReason = "4";
              }

              // If we get a StatusReason that is not defined set it to Unknown
              if (!StatusReason.hasOwnProperty(parseInt(item?.CmDevices?.item.StatusReason))) {
                item.CmDevices.item.StatusReason = 1;
              }

              points.push(
                new Point(item?.CmDevices?.item.DeviceClass)
                  .tag("ipAddress", item?.CmDevices?.item.IPAddress.item.IP)
                  .tag("statusReason", StatusReason[parseInt(item?.CmDevices?.item.StatusReason)])
                  .tag("deviceName", item?.CmDevices?.item.Name)
                  .tag("model", Models[parseInt(item?.CmDevices?.item.Model)])
                  .tag("userId", item?.CmDevices?.item.LoginUserId)
                  .tag("protocol", item?.CmDevices?.item.Protocol)
                  .tag("activeLoad", item?.CmDevices?.item.ActiveLoadID)
                  .tag("downloadStatus", item?.CmDevices?.item.DownloadStatus)
                  .tag("registrationAttempts", item?.CmDevices?.item.RegistrationAttempts)
                  .tag("timeStamp", item?.CmDevices?.item.TimeStamp)
                  .tag("status", item?.CmDevices?.item.Status)
                  .intField("reasonCode", item?.CmDevices?.item.StatusReason)
              );
            }

            writeApi.writePoints(points);
          }
        });
      } else {
        log.error("risportOutput Error: No results returned.");
        process.exit(0);
      }
    } catch (error) {
      if (error.status >= 500) {
        log.error(`risportOutput Error: ${error.status} Service Unavailable. Possible RisPort Service Error, received ${error.status} error. Suggest rate limiting the number of counters or increasing the cooldown timer.`);
        rateControl = true;
      } else {
        log.error("risportOutput Error:", error);
        process.exit(0);
      }
    }

    writeApi
      .close()
      .then(() => {
        log(`RISPORT DATA: Wrote ${points.length} points to InfluxDB bucket ${bucket}`);
      })
      .catch((e) => {
        log.error("RISPORT DATA: InfluxDB write failed", e);
        process.exit(0);
      });

    // Rate control detected. Let's increase the interval to self heal.
    if (rateControl) {
      clearIntervalAsync(timer); // stop the setInterval()
      log.warn(`RISPORT DATA: RateControl detected. Doubling interval timer in attempt to self heal.`);
      interval = interval * 2;
      rateControl = false;
      // Update the console before restarting the interval
      timer = setIntervalAsync(request, interval);
    } else if (interval != env.RP_INTERVAL) {
      clearIntervalAsync(timer); // stop the setInterval()
      interval = env.RP_INTERVAL;
      // Update the console before restarting the interval
      timer = setIntervalAsync(request, interval);
    }
  }
} catch (error) {
  log.error(error);
  process.exit(0);
}
