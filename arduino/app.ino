#include <WiFi.h>
#include <HTTPClient.h>
#include "secrets.h"

// Use your computer's LAN IP, not localhost, when Next.js runs locally.
const char* alertApiUrl = "http://192.168.1.100:3000/api/alerts/distance";

const int trigPin = 5;
const int echoPin = 18;
const int warningPin = 23;

const float warningDistanceCm = 5.0;
const float rearmDistanceCm = 7.0;
const unsigned long notificationRetryMs = 30000;

#define SOUND_SPEED 0.034
#define CM_TO_INCH 0.393701

bool notificationSent = false;
unsigned long lastNotificationAttempt = 0;

void connectToWifi() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  Serial.print("Connecting to Wi-Fi");
  WiFi.begin(wifiSsid, wifiPassword);

  unsigned long startedAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startedAt < 10000) {
    delay(250);
    Serial.print(".");
  }

  Serial.println(WiFi.status() == WL_CONNECTED ? " connected" : " failed");
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

void setup() {
  Serial.begin(115200);
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  pinMode(warningPin, OUTPUT);
  digitalWrite(warningPin, LOW);

  connectToWifi();
}

void loop() {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  long duration = pulseIn(echoPin, HIGH, 30000);

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
