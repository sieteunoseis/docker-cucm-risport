const risPortService = require("cisco-risport");
const Models = require("./js/Models");
const StatusReason = require("./js/statusReasons");
const { InfluxDB, Point } = require("@influxdata/influxdb-client");
const { cleanEnv, str, host, num } = require("envalid");

// If not production load the local env file
if (process.env.NODE_ENV === "development") {
  require("dotenv").config({ path: `${__dirname}/env/development.env` });
} else if (process.env.NODE_ENV === "test") {
  require("dotenv").config({ path: `${__dirname}/env/test.env` });
} else if (process.env.NODE_ENV === "staging") {
  require("dotenv").config({ path: `${__dirname}/env/staging.env` });
}

const env = cleanEnv(process.env, {
  NODE_ENV: str({
    choices: ["development", "test", "production", "staging"],
    desc: "Node environment",
  }),
  CUCM_HOSTNAME: host({ desc: "Cisco CUCM Hostname or IP Address." }),
  CUCM_USERNAME: str({ desc: "Cisco CUCM AXL Username." }),
  CUCM_PASSWORD: str({ desc: "Cisco CUCM AXL Password." }),
  INTERVAL_TIMER: num({
    default: 5000,
    desc: "Interval timer. This should not be less than 4 seconds. By default RisPort70 accepts up to 18 requests per minute, combined across all RisPort70 applications.",
  }),
  INFLUXDB_TOKEN: str({ desc: "InfluxDB API token." }),
  INFLUXDB_ORG: str({ desc: "InfluxDB organization id." }),
  INFLUXDB_BUCKET: str({ desc: "InfluxDB bucket to save data to." }),
  INFLUXDB_URL: str({ desc: "URL of InfluxDB. i.e. http://hostname:8086." }),
  RISPORT_SOAPACTION: str({
    desc: "SelectCmDevice or SelectCmDeviceExt",
  }),
  RISPORT_MAXRETURNEDDEVICES: num({ default: 1000, desc: "Max returned devices" }),
  RISPORT_DEVICECLASS: str({ desc: "Device class to search for" }),
  RISPORT_MODEL: str({ desc: "Model to search for" }),
  RISPORT_STATUS: str({ desc: "Status to search for" }),
  RISPORT_NODE: str({ desc: "Node to search for" }),
  RISPORT_SELECTBY: str({ desc: "Select by" }),
  RISPORT_SELECTITEM: str({ desc: "Select item" }),
  RISPORT_PROTOCOL: str({ desc: "Protocol to search for" }),
  RISPORT_DOWNLOADSTATUS: str({ desc: "Download status to search for" })
});

// Setup influxdb connection
const org = env.INFLUXDB_ORG;
const bucket = env.INFLUXDB_BUCKET;
const client = new InfluxDB({
  url: env.INFLUXDB_URL,
  token: env.INFLUXDB_TOKEN,
});

// This should not be less than 4 seconds. By default RisPort70 accepts up to 18 requests per minute, combined across all RisPort70 applications
const interval = env.INTERVAL_TIMER;
// Set up variable to hold select items variable
var selectItems;
if (env.RISPORT_SELECTITEM) {
  selectItems = env.RISPORT_SELECTITEM.split(",").map((item) =>
    item.trim()
  );
} else {
  selectItems = "";
}

// error check. if detected exit process.
try {
  setInterval(function () {
    console.log(
      `RISPORT DATA: Starting interval, process will run every ${
        interval / 1000
      } seconds`
    );
    (async () => {
      const writeApi = client.getWriteApi(org, bucket);

      var points = [];
      var service = new risPortService(
        env.CUCM_HOSTNAME,
        env.CUCM_USERNAME,
        env.CUCM_PASSWORD
      );
      var risportOutput = await service
        .selectCmDevice(
          env.RISPORT_SOAPACTION,
          env.RISPORT_MAXRETURNEDDEVICES,
          env.RISPORT_DEVICECLASS,
          env.RISPORT_MODEL,
          env.RISPORT_STATUS,
          env.RISPORT_NODE,
          env.RISPORT_SELECTBY,
          selectItems,
          env.RISPORT_PROTOCOL,
          env.RISPORT_DOWNLOADSTATUS
        )
        .catch(console.error);

      if (Array.isArray(risportOutput)) {
        risportOutput.map((item) => {
          if (item.ReturnCode === "Ok" && "CmDevices" in item) {
            server = item.Name;
            writeApi.useDefaultTags({ host: server });
            if (Array.isArray(item?.CmDevices?.item)) {
              // Array returned
              item?.CmDevices?.item.map((item) => {
                // Fix for SIP trunks being partially registered
                if (
                  item.Status === "UnRegistered" &&
                  item.StatusReason === "0" &&
                  item.DeviceClass === "SIPTrunk"
                ) {
                  item.StatusReason = "2";
                }

                // Fix for SIP trunks being unregistered but StatusReason showing as registered
                if (
                  item.Status === "Unknown" &&
                  item.StatusReason === "0" &&
                  item.DeviceClass === "SIPTrunk"
                ) {
                  item.StatusReason = "3";
                }

                // Fix for SIP trunks being rejected but StatusReason showing as registered
                if (
                  item.Status === "Rejected" &&
                  item.StatusReason === "0" &&
                  item.DeviceClass === "SIPTrunk"
                ) {
                  item.StatusReason = "4";
                }

                // If we get a StatusReason that is not defined set it to Unknown
                if (!StatusReason.hasOwnProperty(parseInt(item.StatusReason))) {
                  item.StatusReason = 1;
                }

                points.push(
                  new Point(item.DeviceClass)
                    .tag("ipAddress", item.IPAddress.item.IP)
                    .tag(
                      "statusReason",
                      StatusReason[parseInt(item.StatusReason)]
                    )
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
              if (
                item?.CmDevices?.item.Status === "UnRegistered" &&
                item?.CmDevices?.item.StatusReason === "0" &&
                item?.CmDevices?.item.DeviceClass === "SIPTrunk"
              ) {
                item.CmDevices.item.StatusReason = "2";
              }

              // Fix for SIP trunks being unregistered but StatusReason showing as registered
              if (
                item?.CmDevices?.item.Status === "Unknown" &&
                item?.CmDevices?.item.StatusReason === "0" &&
                item?.CmDevices?.item.DeviceClass === "SIPTrunk"
              ) {
                item.CmDevices.item.StatusReason = "3";
              }

              // Fix for SIP trunks being rejected but StatusReason showing as registered
              if (
                item?.CmDevices?.item.Status === "Rejected" &&
                item?.CmDevices?.item.StatusReason === "0" &&
                item?.CmDevices?.item.DeviceClass === "SIPTrunk"
              ) {
                item.CmDevices.item.StatusReason = "4";
              }

              // If we get a StatusReason that is not defined set it to Unknown
              if (!StatusReason.hasOwnProperty(parseInt(item?.CmDevices?.item.StatusReason))) {
                item.CmDevices.item.StatusReason = 1;
              }

              points.push(
                new Point(item?.CmDevices?.item.DeviceClass)
                  .tag("ipAddress", item?.CmDevices?.item.IPAddress.item.IP)
                  .tag(
                    "statusReason",
                    StatusReason[parseInt(item?.CmDevices?.item.StatusReason)]
                  )
                  .tag("deviceName", item?.CmDevices?.item.Name)
                  .tag("model", Models[parseInt(item?.CmDevices?.item.Model)])
                  .tag("userId", item?.CmDevices?.item.LoginUserId)
                  .tag("protocol", item?.CmDevices?.item.Protocol)
                  .tag("activeLoad", item?.CmDevices?.item.ActiveLoadID)
                  .tag("downloadStatus", item?.CmDevices?.item.DownloadStatus)
                  .tag(
                    "registrationAttempts",
                    item?.CmDevices?.item.RegistrationAttempts
                  )
                  .tag("timeStamp", item?.CmDevices?.item.TimeStamp)
                  .tag("status", item?.CmDevices?.item.Status)
                  .intField("reasonCode", item?.CmDevices?.item.StatusReason)
              );
            }

            writeApi.writePoints(points);
          }
        });
        writeApi
          .close()
          .then(() => {
            console.log(
              `RISPORT DATA: Wrote ${points.length} points to InfluxDB bucket ${bucket}`
            );
          })
          .catch((e) => {
            console.log("RISPORT DATA: InfluxDB write failed", e);
          });
      }
    })();
  }, interval);
} catch (error) {
  console.log(error);
  process.exit(1);
}
