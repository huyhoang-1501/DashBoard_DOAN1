const firebaseConfig = {
  apiKey: "AIzaSyD12p9Mh0D-7hEajc07UQ7FwuaTS_y6-dw",
  authDomain: "project1-4836e.firebaseapp.com",
  databaseURL: "https://project1-4836e-default-rtdb.firebaseio.com",
  projectId: "project1-4836e",
  storageBucket: "project1-4836e.firebasestorage.app",
  messagingSenderId: "835712630126",
  appId: "1:835712630126:web:d4d01debc11247b250157f",
  measurementId: "G-EJKEFXJQZQ"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Elements for all 5 alarms
const elements = {
  temp: document.getElementById('nhietdo'),
  humi: document.getElementById('doam'),
  time: document.getElementById('time'),
  alarmDay: [],
  alarmMonth: [],
  alarmHour: [],
  alarmMinute: [],
  alarmEnable: [],
  saveButton: [],
  deleteButton: []
};

// Initialize elements for each alarm
for (let i = 1; i <= 5; i++) {
  elements.alarmDay[i] = document.getElementById(`alarmDay${i}`);
  elements.alarmMonth[i] = document.getElementById(`alarmMonth${i}`);
  elements.alarmHour[i] = document.getElementById(`alarmHour${i}`);
  elements.alarmMinute[i] = document.getElementById(`alarmMinute${i}`);
  elements.alarmEnable[i] = document.getElementById(`alarmEnable${i}`);
  elements.saveButton[i] = document.getElementById(`saveAlarm${i}`);
  elements.deleteButton[i] = document.getElementById(`deleteAlarm${i}`);
}

elements.alarmList = document.getElementById('alarmList');

// Variables
let sensorData = {
  temp: [],
  humi: [],
  timestamps: []
};

let alarms = Array(5).fill(null); // Fixed array for 5 alarms to match Arduino

// Chart initialization
const ctxTrip = document.getElementById('tempChart').getContext('2d');
const ctxHumidity = document.getElementById('humidityChart').getContext('2d');

const tempChart = new Chart(ctxTrip, {
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
  if (snap.val() === true) {
    console.log('Connected to Firebase');
  } else {
    console.log('Disconnected from Firebase');
  }
});

// Initialize sensor and alarm data
function initializeData() {
  // Listen for sensor data from /device
  database.ref('device').on('value', snap => {
    try {
      const data = snap.val() || { temp: 0.0, humi: 0.0 };
      const now = new Date();
      const timeStr = now.toLocaleTimeString();

      // Update sensor data
      sensorData.timestamps.push(timeStr);
      sensorData.temp.push(data.temp || 0.0);
      sensorData.humi.push(data.humi || 0.0);

      // Limit data to last 10 points
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

  // Listen for alarms from /device/alarms
  database.ref('device/alarms').on('value', snap => {
    try {
      alarms = Array(5).fill(null); // Reset alarms array
      const alarmData = snap.val() || [];
      const alarmArray = Array.isArray(alarmData) ? alarmData : Object.values(alarmData);

      // Map Firebase alarms to fixed 5 slots
      alarmArray.slice(0, 5).forEach((alarm, index) => {
        if (alarm) {
          alarms[index] = {
            id: index.toString(), // Use index as ID for consistency
            day: alarm.day || 1,
            month: alarm.month || 1,
            hour: alarm.hour || 0,
            minute: alarm.minute || 0,
            enabled: alarm.enabled || false
          };
        }
      });

      // Update UI for each alarm slot
      for (let i = 1; i <= 5; i++) {
        const alarm = alarms[i - 1];
        if (alarm) {
          elements.alarmDay[i].textContent = alarm.day.toString().padStart(2, '0');
          elements.alarmMonth[i].textContent = alarm.month.toString().padStart(2, '0');
          elements.alarmHour[i].textContent = alarm.hour.toString().padStart(2, '0');
          elements.alarmMinute[i].textContent = alarm.minute.toString().padStart(2, '0');
          elements.alarmEnable[i].checked = alarm.enabled;
        } else {
          // Default values if no alarm exists
          elements.alarmDay[i].textContent = "01";
          elements.alarmMonth[i].textContent = "01";
          elements.alarmHour[i].textContent = "00";
          elements.alarmMinute[i].textContent = "00";
          elements.alarmEnable[i].checked = false;
        }
      }
      renderAlarms();
    } catch (error) {
      console.error('Error processing alarm data:', error);
    }
  }, error => console.error('Error listening to alarms:', error));

  // Initialize default sensor data if not exists
  database.ref('device').once('value', snap => {
    if (!snap.exists()) {
      const defaultData = { temp: 0.0, humi: 0.0, sensor_status: "OK" };
      database.ref('device').set(defaultData)
        .then(() => console.log('Initialized default sensor data'))
        .catch(error => console.error('Error initializing sensor data:', error));
    }
  }, error => console.error('Error checking sensor data:', error));

  // Initialize default alarms if not exists
  database.ref('device/alarms').once('value', snap => {
    if (!snap.exists()) {
      const defaultAlarms = Array(5).fill().map(() => ({
        day: 1,
        month: 1,
        hour: 0,
        minute: 0,
        enabled: false
      }));
      database.ref('device/alarms').set(defaultAlarms)
        .then(() => console.log('Initialized default alarms'))
        .catch(error => console.error('Error initializing alarms:', error));
    }
  }, error => console.error('Error checking alarms:', error));
}

// Update display
function updateDisplay(data) {
  elements.temp.innerText = `${isNaN(data.temp) ? 0 : data.temp.toFixed(1)} °C`;
  elements.humi.innerText = `${isNaN(data.humi) ? 0 : data.humi.toFixed(1)} %`;
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

// Render alarms in the UI
function renderAlarms() {
  elements.alarmList.innerHTML = '';
  alarms.forEach((alarm, index) => {
    if (alarm) {
      const alarmItem = document.createElement('div');
      alarmItem.className = 'alarm-item';
      alarmItem.innerHTML = `
        <span>Alarm ${index + 1}: ${alarm.month.toString().padStart(2, '0')}/${alarm.day.toString().padStart(2, '0')} ${alarm.hour.toString().padStart(2, '0')}:${alarm.minute.toString().padStart(2, '0')} ${alarm.enabled ? '(On)' : '(Off)'}</span>
      `;
      elements.alarmList.appendChild(alarmItem);
    }
  });
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

  // Update Firebase alarm array at specific index
  database.ref(`device/alarms/${alarmIndex - 1}`).set(newAlarm)
    .then(() => {
      console.log(`Saved alarm ${alarmIndex} successfully`);
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

  // Reset alarm at specific index
  database.ref(`device/alarms/${alarmIndex - 1}`).set(defaultAlarm)
    .then(() => {
      console.log(`Deleted alarm ${alarmIndex} successfully`);
      alert(`Alarm ${alarmIndex} has been deleted!`);
      // Update UI immediately
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

// Clock and alarm check
function updateClock() {
  const now = new Date();
  let hours = now.getHours().toString().padStart(2, '0');
  let minutes = now.getMinutes().toString().padStart(2, '0');
  let seconds = now.getSeconds().toString().padStart(2, '0');
  let timeString = `${hours}:${minutes}:${seconds}`;
  elements.time.textContent = timeString;

  // Check all alarms
  alarms.forEach((alarm, index) => {
    if (
      alarm &&
      alarm.enabled &&
      now.getDate() === alarm.day &&
      (now.getMonth() + 1) === alarm.month &&
      now.getHours() === alarm.hour &&
      now.getMinutes() === alarm.minute &&
      now.getSeconds() === 0
    ) {
      triggerAlarm(alarm, index + 1);
    }
  });
}

// Trigger alarm action
function triggerAlarm(alarm, index) {
  alert(`Alarm ${index}! ${alarm.month.toString().padStart(2, '0')}/${alarm.day.toString().padStart(2, '0')} ${alarm.hour.toString().padStart(2, '0')}:${alarm.minute.toString().padStart(2, '0')}`);
}

// Adjust alarm settings
function adjustAlarm(type, delta, alarmIndex) {
  let valueElement;
  let minValue, maxValue;

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

// Toggle alarm enable
function toggleAlarmEnable(alarmIndex) {
  const isEnabled = elements.alarmEnable[alarmIndex].checked;
  console.log(`Alarm ${alarmIndex} state: ${isEnabled}`);
  // Update Firebase if the alarm exists
  if (alarms[alarmIndex - 1]) {
    database.ref(`device/alarms/${alarmIndex - 1}`).update({ enabled: isEnabled })
      .then(() => {
        console.log(`Updated alarm ${alarmIndex} state successfully: ${isEnabled}`);
      })
      .catch(error => {
        console.error(`Error updating alarm ${alarmIndex} state:`, error);
        alert(`Error updating alarm ${alarmIndex} state!`);
      });
  } else {
    // Create new alarm with default values if it doesn't exist
    saveAlarm(alarmIndex);
  }
}

// Add event listeners for buttons and toggles
for (let i = 1; i <= 5; i++) {
  elements.alarmEnable[i].addEventListener('change', () => toggleAlarmEnable(i));
  if (elements.saveButton[i]) {
    elements.saveButton[i].addEventListener('click', () => saveAlarm(i));
  }
  if (elements.deleteButton[i]) {
    elements.deleteButton[i].addEventListener('click', () => deleteAlarm(i));
  }
}

// Initialize
window.onload = () => {
  initializeData();
  setInterval(updateClock, 1000);
  updateClock();
};