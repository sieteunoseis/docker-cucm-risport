const { cleanEnv, str, host, num } = require("envalid");
const path = require("path");

// If not production load the local env file
if (process.env.NODE_ENV === "development") {
  require("dotenv").config({ path: path.join(__dirname, "..", "env", "development.env") });
} else if (process.env.NODE_ENV === "test") {
  require("dotenv").config({ path: path.join(__dirname, "..", "env", "test.env") });
} else if (process.env.NODE_ENV === "staging") {
  require("dotenv").config({ path: path.join(__dirname, "..", "env", "staging.env") });
}

module.exports = {
  getEnv: cleanEnv(process.env, {
    NODE_ENV: str({
      choices: ["development", "test", "production", "staging"],
      desc: "Node environment",
    }),
    CUCM_HOSTNAME: host({ desc: "Cisco CUCM Hostname or IP Address." }),
    CUCM_USERNAME: str({ desc: "Cisco CUCM AXL Username." }),
    CUCM_PASSWORD: str({ desc: "Cisco CUCM AXL Password." }),
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
    RISPORT_DOWNLOADSTATUS: str({ desc: "Download status to search for" }),
    RISPORT_INTERVAL: num({
      default: 5000,
      desc: "Interval timer. This should not be less than 4 seconds. By default RisPort70 accepts up to 18 requests per minute, combined across all RisPort70 applications.",
    }),
  })
};
