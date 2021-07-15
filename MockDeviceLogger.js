import moment from "moment";

const POSSIBLE_BEARINGS = [0, 45, 90, 135, 180, 225, 270, 315];

const degreesToRadians = (degrees) => (degrees * Math.PI) / 180;

const radiansToDegrees = (radians) => radians * (180 / Math.PI);

const getNewLocationFromDistanceAndBearing = (
  latitude,
  longitude,
  distance,
  bearing
) => {
  let R = 6378.1, // Radius of the Earth
    brng = degreesToRadians(bearing), // Convert bearing to radian
    lat1 = degreesToRadians(latitude), // Current coords to radians
    lon1 = degreesToRadians(longitude);

  // Math magic
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distance / R) +
    Math.cos(lat1) * Math.sin(distance / R) * Math.cos(brng)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(distance / R) * Math.cos(lat1),
      Math.cos(distance / R) - Math.sin(lat1) * Math.sin(lat2)
    );

  // Coords back to degrees and return
  return [radiansToDegrees(lat2), radiansToDegrees(lon2)];
};

class MockDeviceLogger {
  currentLng;
  currentLat;
  id;
  messages = [];
  timeToNextTransmission = 0;
  engineHeat = 200;
  isEngineMalfunction = false;
  currentBuffer;
  currentByteOffset;
  ws;
  velocityMetersPerSecond = 50 * 0.44704;
  currentBearing;

  constructor(id, startingLat, startingLng, ws) {
    this.id = id;
    this.currentLng = startingLng;
    this.currentLat = startingLat;
    this.currentBearing =
      POSSIBLE_BEARINGS[Math.floor(Math.random() * POSSIBLE_BEARINGS.length)];
  }

  checkEngine = () => {
    if (Math.random() <= 0.005) {
      // 0.5% chance of malfunction warning state change
      this.isEngineMalfunction = !this.isEngineMalfunction;
    }
  };

  addMessageToBuffer = () => {
    let engineHeat = new DataView(this.currentBuffer, this.currentByteOffset, 2);
    engineHeat.setUint16(0, this.engineHeat);
    this.currentByteOffset += 2;
    let latitude = new DataView(this.currentBuffer, this.currentByteOffset, 4);
    latitude.setFloat32(0, this.currentLat);
    this.currentByteOffset += 4;
    let longitude = new DataView(this.currentBuffer, this.currentByteOffset, 4);
    longitude.setFloat32(0, this.currentLng);
    this.currentByteOffset += 4;
    let epoch = new DataView(this.currentBuffer, this.currentByteOffset, 4);
    epoch.setUint32(0, moment().unix());
    this.currentByteOffset += 4;
    const malfunctionWarning = new DataView(this.currentBuffer, this.currentByteOffset, 1);
    malfunctionWarning.setUint8(0, this.isEngineMalfunction ? 1 : 0);
    this.currentByteOffset += 1;
  };

  initMessageCycle = () => {
    this.timeToNextTransmission = Math.floor(1 + Math.random() * 10);
    this.currentBuffer = new ArrayBuffer(
      4 + 1 + this.timeToNextTransmission * 15
    );
    let id = new DataView(this.currentBuffer, 0, 4);
    id.setInt32(0, this.id);
    let numOfMessages = new DataView(this.currentBuffer, 4, 1);
    numOfMessages.setUint8(0, this.timeToNextTransmission);
    this.currentByteOffset = 5;
  };

  readEngineHeat = () => {
    const moveByXDegrees = Math.floor(1 + Math.random() * 5);

    let moveDirection = Math.random() >= 0.5 ? 1 : -1;
    if (this.engineHeat >= 300) {
      moveDirection = -1;
    } else if (this.engineHeat <= 150) {
      moveDirection = 1;
    }

    this.engineHeat += moveDirection * moveByXDegrees;
  };

  move = () => {
    if (Math.random() <= 0.001) {
      // 0.1% to change direction
      this.currentBearing =
        POSSIBLE_BEARINGS[Math.floor(Math.random() * POSSIBLE_BEARINGS.length)];
    }

    if (Math.random() <= 0.05) {
      // 5% to change velocity
      this.velocityMetersPerSecond =
        Math.floor(20 + Math.random() * 50) * 0.44704;
    }

    const newLocation = getNewLocationFromDistanceAndBearing(
      this.currentLat,
      this.currentLng,
      this.velocityMetersPerSecond / 1000,
      this.currentBearing
    );

    this.currentLat = newLocation[0];
    this.currentLng = newLocation[1];
  };

  writeMessageCycle = () => {
    if (this.timeToNextTransmission === 0) {
      if (this.ws) {
        this.ws.send(this.currentBuffer);
      }

      this.initMessageCycle();
    }

    this.readEngineHeat();
    this.checkEngine();
    this.move();
    this.addMessageToBuffer();
    this.timeToNextTransmission--;

    setTimeout(this.writeMessageCycle, 1000);
  };

  startCollectingData = () => {
    this.initMessageCycle();
    this.writeMessageCycle();
  };

  startTransmitting = (ws) => {
    this.ws = ws;
    console.log(`Device ${this.id} starting to transmit data`);
    // console.log(`Device ${JSON.stringify(this)} starting to transmit data`);
  };

  stopTransmitting = () => {
    this.ws = undefined;
  };
}

export default MockDeviceLogger;
