# RisPort InfluxDB Exporter

NodeJS application using Cisco RisPOrt API to export data to InfluxDB.

## Install

```node
npm run docker:build
npm run docker:run
```

## Needed Enviromental Variables

```node
NODE_ENV=production # production or development. uses dotenv for development purpose before building container
PM2_PUBLIC_KEY= # Optional for pm2.keymetrics.io
PM2_SECRET_KEY= # Optional for pm2.keymetrics.io
CUCM_PUB=<INSERT IP ADDRESS>
CUCM_USERNAME=<INSERT USERNAME>
CUCM_PASSWORD=<INSERT PASSWORD>

INFLUXDB_TOKEN=<INSERT INFLUXDB TOKEN>
INFLUXDB_ORG=<INSERT INFLUXDB ORG>
INFLUXDB_BUCKET=cisco_risport
INFLUXDB_URL=<INSERT INFLUXDB URL>

RP_RETRY=10
RP_RETRY_DELAY=20000
RP_INTERVAL=5000 # This should not be less than 4 seconds. By default RisPort70 accepts up to 18 requests per minute, combined across all RisPort70 applications
RP_SOAPACTION=SelectCmDeviceExt # SelectCmDevice, SelectCmDeviceExt
RP_MAXRETURNEDDEVICES=1000 # Max is 1000
RP_DEVICECLASS=Any # Any, Phone, Gateway, H323, Cti, VoiceMail, MediaResources, HuntList, SIPTrunk, Unknown
RP_MODEL=255 # Either ENUM integer or string of model name. 255 for "any model."
RP_STATUS=Any # Any, Registered, UnRegistered, Rejected, PartiallyRegistered, Unknow
RP_NODE= # The UC Manager node name to query. If no NodeName is given, all nodes in the cluster are queried.
RP_SELECTBY=Name # Search by Name, IPV4Address, IPV6Address, DirNumber, Description, SIPStatus
RP_SELECTITEM= # Either a single item or commma separated list
RP_PROTOCOL=Any # Search by device protocol: Any, SCCP, SIP, Unknown
RP_DOWNLOADSTATUS=Any # Any, Upgrading, Successful, Failed, Unknown
```

Save to .env file within project.

To view Docker enviromental variables within container run:

```linux
env
```

## Giving Back

If you would like to support my work and the time I put in creating the code, you can click the image below to get me a coffee. I would really appreciate it (but is not required).

[![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/black_img.png)](https://www.buymeacoffee.com/automatebldrs)

-Jeremy Worden

Enjoy!
