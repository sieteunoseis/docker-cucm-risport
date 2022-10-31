# Cisco CUCM RisPort Docker Gateway

NodeJS application using Cisco RisPort API to send data to InfluxDB cloud.

## Install

```node
npm run docker:build
npm run docker:push
```

## Needed Enviromental Variables

```node
NODE_ENV=production
CUCM_PUB=<INSERT IP ADDRESS>
CUCM_USERNAME=<INSERT USERNAME>
CUCM_PASSWORD=<INSERT PASSWORD>
INTERVAL_TIMER=3000
INFLUXDB_TOKEN=<INSERT INFLUXDB TOKEN>
INFLUXDB_ORG=<INSERT INFLUXDB ORG>
INFLUXDB_BUCKET=cisco_risport
INFLUXDB_URL=<INSERT INFLUXDB URL>
RISPORT_SOAPACTION="SelectCmDeviceExt" # SelectCmDevice, SelectCmDeviceExt
RISPORT_MAXRETURNEDDEVICES=1000 # Max is 1000
RISPORT_DEVICECLASS="Any" # Any, Phone, Gateway, H323, Cti, VoiceMail, MediaResources, HuntList, SIPTrunk, Unknown
RISPORT_MODEL="" # Either ENUM integer or string of model name
RISPORT_STATUS="Any" # Any, Registered, UnRegistered, Rejected, PartiallyRegistered, Unknow
RISPORT_NODE="" # The UC Manager node name to query. If no NodeName is given, all nodes in the cluster are queried.
RISPORT_SELECTBY="Name" # Search by Name, IPV4Address, IPV6Address, DirNumber, Description, SIPStatus
RISPORT_SELECTITEM="" # Either a single item or commma separated list
RISPORT_PROTOCOL="Any" # Search by device protocol: Any, SCCP, SIP, Unknown
RISPORT_DOWNLOADSTATUS="Any" # Any, Upgrading, Successful, Failed, Unknown
```

Save to docker.txt file within project.

To view Docker enviromental variables within container run:

```linux
env
```

## Giving Back

If you would like to support my work and the time I put in creating the code, you can click the image below to get me a coffee. I would really appreciate it (but is not required).

[![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/black_img.png)](https://www.buymeacoffee.com/automatebldrs)

-Jeremy Worden

Enjoy!
