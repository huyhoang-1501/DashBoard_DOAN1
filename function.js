// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB3Hm969BjdLhV-2i1auDazDejCLemAe34",
  authDomain: "project1-a91b7.firebaseapp.com",
  databaseURL: "https://project1-a91b7-default-rtdb.firebaseio.com",
  projectId: "project1-a91b7",
  storageBucket: "project1-a91b7.firebasestorage.app",
  messagingSenderId: "273865965692",
  appId: "1:273865965692:web:2f24df6b13c8fd917949f9",
  measurementId: "G-5ZH17ZF55E"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Interface elements for 5 alarms
const elements = {
  temp: document.getElementById('nhietdo'),
  humi: document.getElementById('doam'),
  time: document.getElementById('time'),
  alarmDay: [],
  alarmMonth: [],
  alarmHour: [],
  alarmMinute: [],
  alarmEnable: []
};

// Initialize elements for each alarm
for (let i = 1; i <= 5; i++) {
  elements.alarmDay[i] = document.getElementById(`alarmDay${i}`);
  elements.alarmMonth[i] = document.getElementById(`alarmMonth${i}`);
  elements.alarmHour[i] = document.getElementById(`alarmHour${i}`);
  elements.alarmMinute[i] = document.getElementById(`alarmMinute${i}`);
  elements.alarmEnable[i] = document.getElementById(`alarmEnable${i}`);
}

// Sensor and chart data
let sensorData = {
  temp: [],
  humi: [],
  timestamps: []
};

let alarms = Array(5).fill(null); // Fixed array for 5 alarms to match Arduino

// Initialize charts
const ctxTemp = document.getElementById('tempChart').getContext('2d');
const ctxHumidity = document.getElementById('humidityChart').getContext('2d');

const tempChart = new Chart(ctxTemp, {
  type: 'line',
  data: {
    labels: sensorData.timestamps,
    datasets: [{
      label: 'Temperature (°C)',
      data: sensorData.temp,
      borderColor: '#e74c3c',
      fill: false,
      tension: 0.1
    }]
  },
  options: {
    responsive: true,
    scales: {
      x: { title: { display: true, text: 'Time' } },
      y: { title: { display: true, text: 'Temperature (°C)' } }
    }
  }
});

const humidityChart = new Chart(ctxHumidity, {
  type: 'line',
  data: {
    labels: sensorData.timestamps,
    datasets: [{
      label: 'Humidity (%)',
      data: sensorData.humi,
      borderColor: '#3498db',
      fill: false,
      tension: 0.1
    }]
  },
  options: {
    responsive: true,
    scales: {
      x: { title: { display: true, text: 'Time' } },
      y: { title: { display: true, text: 'Humidity (%)' } }
    }
  }
});

// Check Firebase connection
database.ref('.info/connected').on('value', snap => {
  console.log(snap.val() ? 'Connected to Firebase' : 'Disconnected from Firebase');
});

// Initialize sensor and alarm data
function initializeData() {
  // Listen for sensor data from /esp8266_data/sensors
  database.ref('esp8266_data/sensors').on('value', snap => {
    try {
      const data = snap.val() || { temperature: 0.0, humidity: 0.0, timestamp: 0 };
      const timestamp = data.timestamp * 1000;
      const date = new Date(timestamp);
      const timeStr = date.toLocaleTimeString();

      // Update sensor data
      sensorData.timestamps.push(timeStr);
      sensorData.temp.push(data.temperature || 0.0);
      sensorData.humi.push(data.humidity || 0.0);

      // Limit to 10 data points
      if (sensorData.timestamps.length > 10) {
        sensorData.timestamps.shift();
        sensorData.temp.shift();
        sensorData.humi.shift();
      }

      // Update display and charts
      updateDisplay(data);
      updateCharts();
    } catch (error) {
      console.error('Error processing sensor data:', error);
    }
  }, error => console.error('Error listening to sensor data:', error));

  // Listen for alarms from /esp8266_data/alarms
  database.ref('esp8266_data/alarms').on('value', snap => {
    try {
      alarms = Array(5).fill(null);
      const alarmData = snap.val() || {};

      for (let i = 1; i <= 5; i++) {
        const alarm = alarmData[`alarm${i}`];
        if (alarm) {
          alarms[i - 1] = {
            id: i.toString(),
            day: alarm.day || 1,
            month: alarm.month || 1,
            hour: alarm.hour || 0,
            minute: alarm.minute || 0,
            enabled: alarm.enabled !== undefined ? alarm.enabled : false
          };
          elements.alarmDay[i].textContent = alarm.day.toString().padStart(2, '0');
          elements.alarmMonth[i].textContent = alarm.month.toString().padStart(2, '0');
          elements.alarmHour[i].textContent = alarm.hour.toString().padStart(2, '0');
          elements.alarmMinute[i].textContent = alarm.minute.toString().padStart(2, '0');
          elements.alarmEnable[i].checked = alarm.enabled;
        } else {
          elements.alarmDay[i].textContent = "01";
          elements.alarmMonth[i].textContent = "01";
          elements.alarmHour[i].textContent = "00";
          elements.alarmMinute[i].textContent = "00";
          elements.alarmEnable[i].checked = false;
        }
      }
    } catch (error) {
      console.error('Error processing alarm data:', error);
    }
  }, error => console.error('Error listening to alarms:', error));

  // Initialize default sensor data if not exists
  database.ref('esp8266_data/sensors').once('value', snap => {
    if (!snap.exists()) {
      database.ref('esp8266_data/sensors').set({
        temperature: 0.0,
        humidity: 0.0,
        timestamp: Math.floor(Date.now() / 1000)
      }).then(() => console.log('Initialized default sensor data'))
        .catch(error => console.error('Error initializing sensor data:', error));
    }
  });

  // Initialize default alarms if not exists
  database.ref('esp8266_data/alarms').once('value', snap => {
    if (!snap.exists()) {
      const defaultAlarms = {};
      for (let i = 1; i <= 5; i++) {
        defaultAlarms[`alarm${i}`] = {
          day: 1,
          month: 1,
          hour: 0,
          minute: 0,
          enabled: false
        };
      }
      database.ref('esp8266_data/alarms').set(defaultAlarms)
        .then(() => console.log('Initialized default alarms'))
        .catch(error => console.error('Error initializing alarms:', error));
    }
  });
}

// Update display
function updateDisplay(data) {
  elements.temp.textContent = `${isNaN(data.temperature) ? 0.0 : data.temperature.toFixed(1)} °C`;
  elements.humi.textContent = `${isNaN(data.humidity) ? 0.0 : data.humidity.toFixed(1)} %`;
}

// Update charts
function updateCharts() {
  tempChart.data.labels = sensorData.timestamps;
  tempChart.data.datasets[0].data = sensorData.temp;
  tempChart.update();

  humidityChart.data.labels = sensorData.timestamps;
  humidityChart.data.datasets[0].data = sensorData.humi;
  humidityChart.update();
}

// Save alarm to Firebase
function saveAlarm(alarmIndex) {
  const newAlarm = {
    day: parseInt(elements.alarmDay[alarmIndex].textContent) || 1,
    month: parseInt(elements.alarmMonth[alarmIndex].textContent) || 1,
    hour: parseInt(elements.alarmHour[alarmIndex].textContent) || 0,
    minute: parseInt(elements.alarmMinute[alarmIndex].textContent) || 0,
    enabled: elements.alarmEnable[alarmIndex].checked
  };

  // Validate values
  newAlarm.day = Math.max(1, Math.min(31, newAlarm.day));
  newAlarm.month = Math.max(1, Math.min(12, newAlarm.month));
  newAlarm.hour = Math.max(0, Math.min(23, newAlarm.hour));
  newAlarm.minute = Math.max(0, Math.min(59, newAlarm.minute));

  database.ref(`esp8266_data/alarms/alarm${alarmIndex}`).set(newAlarm)
    .then(() => {
      console.log(`Alarm ${alarmIndex} saved successfully`);
      alert(`Alarm ${alarmIndex} has been saved!`);
    })
    .catch(error => {
      console.error(`Error saving alarm ${alarmIndex}:`, error);
      alert(`Error saving alarm ${alarmIndex}!`);
    });
}

// Delete alarm from Firebase
function deleteAlarm(alarmIndex) {
  const defaultAlarm = {
    day: 1,
    month: 1,
    hour: 0,
    minute: 0,
    enabled: false
  };

  database.ref(`esp8266_data/alarms/alarm${alarmIndex}`).set(defaultAlarm)
    .then(() => {
      console.log(`Alarm ${alarmIndex} deleted successfully`);
      alert(`Alarm ${alarmIndex} has been deleted!`);
      elements.alarmDay[alarmIndex].textContent = "01";
      elements.alarmMonth[alarmIndex].textContent = "01";
      elements.alarmHour[alarmIndex].textContent = "00";
      elements.alarmMinute[alarmIndex].textContent = "00";
      elements.alarmEnable[alarmIndex].checked = false;
    })
    .catch(error => {
      console.error(`Error deleting alarm ${alarmIndex}:`, error);
      alert(`Error deleting alarm ${alarmIndex}!`);
    });
}

// Toggle alarm enable state
function toggleAlarmEnable(alarmIndex) {
  const isEnabled = elements.alarmEnable[alarmIndex].checked;
  database.ref(`esp8266_data/alarms/alarm${alarmIndex}`).update({ enabled: isEnabled })
    .then(() => console.log(`Alarm ${alarmIndex} enable state updated: ${isEnabled}`))
    .catch(error => {
      console.error(`Error updating alarm ${alarmIndex} enable state:`, error);
      alert(`Error updating alarm ${alarmIndex} enable state!`);
    });
}

// Adjust alarm settings
function adjustAlarm(type, delta, alarmIndex) {
  let valueElement, minValue, maxValue;

  switch (type) {
    case 'day':
      valueElement = elements.alarmDay[alarmIndex];
      minValue = 1;
      maxValue = 31;
      break;
    case 'month':
      valueElement = elements.alarmMonth[alarmIndex];
      minValue = 1;
      maxValue = 12;
      break;
    case 'hour':
      valueElement = elements.alarmHour[alarmIndex];
      minValue = 0;
      maxValue = 23;
      break;
    case 'minute':
      valueElement = elements.alarmMinute[alarmIndex];
      minValue = 0;
      maxValue = 59;
      break;
    default:
      return;
  }

  let currentValue = parseInt(valueElement.textContent) || 0;
  let newValue = currentValue + delta;

  if (newValue < minValue) newValue = minValue;
  if (newValue > maxValue) newValue = maxValue;

  valueElement.textContent = newValue.toString().padStart(2, '0');
}

// Update clock
function updateClock() {
  const now = new Date();
  elements.time.textContent = now.toLocaleTimeString();
}

// Initialize
window.onload = () => {
  initializeData();
  setInterval(updateClock, 1000);
  updateClock();
};