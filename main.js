const risPortService = require("cisco-risport");
const Models = require("./js/Models");
const StatusReason = require("./js/statusReasons");
const { InfluxDB, Point } = require("@influxdata/influxdb-client");

// Use dotenv for enviromental variables if development
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

// Setup influxdb connection
const org = process.env.INFLUXDB_ORG;
const bucket = process.env.INFLUXDB_BUCKET;
const client = new InfluxDB({
  url: process.env.INFLUXDB_URL,
  token: process.env.INFLUXDB_TOKEN,
});

// This should not be less than 4 seconds. By default RisPort70 accepts up to 18 requests per minute, combined across all RisPort70 applications
const interval = process.env.INTERVAL_TIMER;
// Set up variable to hold select items variable
var selectItems;
if (process.env.RISPORT_SELECTITEM) {
  selectItems = process.env.RISPORT_SELECTITEM.split(",").map((item) =>
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
        process.env.CUCM_PUB,
        process.env.CUCM_USERNAME,
        process.env.CUCM_PASSWORD
      );
      var risportOutput = await service
        .selectCmDevice(
          process.env.RISPORT_SOAPACTION,
          process.env.RISPORT_MAXRETURNEDDEVICES,
          process.env.RISPORT_DEVICECLASS,
          process.env.RISPORT_MODEL,
          process.env.RISPORT_STATUS,
          process.env.RISPORT_NODE,
          process.env.RISPORT_SELECTBY,
          selectItems,
          process.env.RISPORT_PROTOCOL,
          process.env.RISPORT_DOWNLOADSTATUS
        )
        .catch(console.error);

      console.log(JSON.stringify(risportOutput));

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
                  item.StatusReason === 0 &&
                  item.Model === 131
                ) {
                  item.StatusReason = 2;
                }

                // Fix for SIP trunks being unregistered but StatusReason showing as registered
                if (
                  item.Status === "Unknown" &&
                  item.StatusReason === 0 &&
                  item.Model === 131
                ) {
                  item.StatusReason = 3;
                }

                // Fix for SIP trunks being rejected but StatusReason showing as registered
                if (
                  item.Status === "Rejected" &&
                  item.StatusReason === 0 &&
                  item.Model === 131
                ) {
                  item.StatusReason = 4;
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
              points.push(
                new Point(item?.CmDevices?.item.DeviceClass)
                  .tag("ipAddress", item?.CmDevices?.item.IPAddress.item.IP)
                  .tag(
                    "statusReason",
                    StatusReason[parseInt(item?.CmDevices?.item.StatusReason)]
                  )
                  .tag("name", item?.CmDevices?.item.Name)
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
