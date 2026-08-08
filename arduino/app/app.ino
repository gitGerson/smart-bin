#include <WiFi.h>
#include <HTTPClient.h>

const char* wifiSsid = "Pojok";
const char* wifiPassword = "aapppwwww";
const char* deviceApiKey = "a764245b6295d1ce4cea1fdab1c0b88d4cb2d2ed693bbc51afb3ed8aa783d53c";

const char* alertApiUrl = "https://smart-bin-rosy.vercel.app/api/alerts/distance";

const int trigPin = 5;
const int echoPin = 18;
const int warningPin = 23;

const float warningDistanceCm = 5.0;
const float rearmDistanceCm = 7.0;
const unsigned long notificationRetryMs = 30000;
const unsigned long wifiJoinTimeoutMs = 10000;
const int maxOpenNetworks = 10;

#define SOUND_SPEED 0.034
#define CM_TO_INCH 0.393701

bool notificationSent = false;
unsigned long lastNotificationAttempt = 0;

// Status blinks are only meaningful while somebody is standing at the bin
// installing it. Once we hand the pin back to the bin-full warning, patterns
// would be misread as "bin is full", so they are suppressed after setup().
bool statusFeedbackEnabled = true;

void blink(int times, int onMs, int offMs) {
  if (!statusFeedbackEnabled) {
    return;
  }

  for (int i = 0; i < times; i++) {
    digitalWrite(warningPin, HIGH);
    delay(onMs);
    digitalWrite(warningPin, LOW);
    delay(offMs);
  }
}

bool joinNetwork(const char* ssid, const char* password) {
  Serial.printf("Connecting to \"%s\"", ssid);
  WiFi.begin(ssid, password);

  unsigned long startedAt = millis();
  bool ledOn = false;
  while (WiFi.status() != WL_CONNECTED && millis() - startedAt < wifiJoinTimeoutMs) {
    // Steady 2 Hz heartbeat for as long as we are trying to associate.
    if (statusFeedbackEnabled) {
      ledOn = !ledOn;
      digitalWrite(warningPin, ledOn ? HIGH : LOW);
    }
    delay(250);
    Serial.print(".");
  }
  digitalWrite(warningPin, LOW);

  bool connected = WiFi.status() == WL_CONNECTED;
  Serial.println(connected ? " connected" : " failed");
  if (!connected) {
    WiFi.disconnect();
  }
  return connected;
}

// Fallback when the configured network is out of range: scan, collect every
// open (unencrypted) SSID, and try them in random order until one lets us on.
bool connectToAnyOpenWifi() {
  // Three quick winks announce "configured network missing, scanning now".
  blink(3, 80, 80);

  int found = WiFi.scanNetworks();
  if (found <= 0) {
    Serial.println("No networks found");
    return false;
  }

  int openIndexes[maxOpenNetworks];
  int openCount = 0;
  for (int i = 0; i < found && openCount < maxOpenNetworks; i++) {
    if (WiFi.encryptionType(i) == WIFI_AUTH_OPEN && WiFi.SSID(i).length() > 0) {
      openIndexes[openCount++] = i;
    }
  }
  Serial.printf("Found %d open network(s) of %d\n", openCount, found);

  // Fisher-Yates shuffle so we do not always favour the same access point.
  for (int i = openCount - 1; i > 0; i--) {
    int j = random(i + 1);
    int tmp = openIndexes[i];
    openIndexes[i] = openIndexes[j];
    openIndexes[j] = tmp;
  }

  bool connected = false;
  for (int i = 0; i < openCount && !connected; i++) {
    connected = joinNetwork(WiFi.SSID(openIndexes[i]).c_str(), nullptr);
  }

  WiFi.scanDelete();
  return connected;
}

void connectToWifi() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  if (joinNetwork(wifiSsid, wifiPassword)) {
    return;
  }

  connectToAnyOpenWifi();
}

bool sendDistanceAlert(float distanceCm) {
  connectToWifi();

  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  HTTPClient http;
  http.begin(alertApiUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", deviceApiKey);

  String body = "{\"distanceCm\":" + String(distanceCm, 1) + "}";
  int statusCode = http.POST(body);
  String response = http.getString();
  http.end();

  Serial.printf("Alert API status: %d\n", statusCode);
  if (statusCode < 200 || statusCode >= 300) {
    Serial.println(response);
    return false;
  }

  return true;
}

// Returns 0 when the echo times out, which means the sensor is unwired,
// mispointed, or the lid is closer than its ~2 cm minimum range.
long readEchoDuration() {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  return pulseIn(echoPin, HIGH, 30000);
}

// Take a few readings so the installer knows the sensor is wired correctly
// before they close up the bin.
bool sensorSelfTest() {
  for (int attempt = 0; attempt < 5; attempt++) {
    if (readEchoDuration() > 0) {
      return true;
    }
    delay(200);
  }
  return false;
}

void setup() {
  Serial.begin(115200);
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  pinMode(warningPin, OUTPUT);
  digitalWrite(warningPin, LOW);

  // Boot: one long pulse proves the LED and its wiring are alive.
  blink(1, 600, 300);

  randomSeed(esp_random());
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();

  connectToWifi();

  bool wifiOk = WiFi.status() == WL_CONNECTED;
  bool sensorOk = sensorSelfTest();

  Serial.printf("Self test - wifi: %s, sensor: %s\n",
                wifiOk ? "ok" : "FAIL",
                sensorOk ? "ok" : "FAIL");
  if (wifiOk) {
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
  }

  if (wifiOk && sensorOk) {
    // Ready: two slow confirmation pulses, then the LED goes quiet until the
    // bin actually fills up.
    blink(2, 400, 200);
  } else if (sensorOk) {
    // Sensor fine, no network: alerts will not reach the server.
    blink(4, 150, 150);
  } else {
    // Sensor dead - the installer needs to recheck trig/echo wiring.
    blink(8, 100, 100);
  }

  statusFeedbackEnabled = false;
  digitalWrite(warningPin, LOW);
}

void loop() {
  long duration = readEchoDuration();

  if (duration == 0) {
    Serial.println("No ultrasonic reading");
    digitalWrite(warningPin, LOW);
    delay(500);
    return;
  }

  float distanceCm = duration * SOUND_SPEED / 2;
  float distanceInch = distanceCm * CM_TO_INCH;

  Serial.printf("Distance: %.2f cm / %.2f inch\n", distanceCm, distanceInch);

  if (distanceCm < warningDistanceCm) {
    digitalWrite(warningPin, HIGH);
    Serial.println("WARNING: Object is under 5 cm!");

    bool retryIsDue =
      !notificationSent &&
      (lastNotificationAttempt == 0 ||
       millis() - lastNotificationAttempt >= notificationRetryMs);

    if (retryIsDue) {
      lastNotificationAttempt = millis();
      notificationSent = sendDistanceAlert(distanceCm);
    }
  } else {
    digitalWrite(warningPin, LOW);

    // Rearm only after the object moves far enough away to avoid alert spam
    // from sensor readings fluctuating around 5 cm.
    if (distanceCm >= rearmDistanceCm) {
      notificationSent = false;
      lastNotificationAttempt = 0;
    }
  }

  delay(500);
}
