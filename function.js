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

// Elements
const elements = {
  temp: document.getElementById('nhietdo'),
  humi: document.getElementById('doam'),
  time: document.getElementById('time'),
  alarmDay: document.getElementById('alarmDay'),
  alarmMonth: document.getElementById('alarmMonth'),
  alarmHour: document.getElementById('alarmHour'),
  alarmMinute: document.getElementById('alarmMinute'),
  alarmEnable: document.getElementById('alarmEnable'),
  alarmList: document.getElementById('alarmList')
};

// Variables
let sensorData = {
  temp: [],
  humi: [],
  timestamps: []
};

let alarms = []; // Danh sách các báo thức

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
    console.log('Đã kết nối với Firebase');
  } else {
    console.log('Mất kết nối với Firebase');
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
      console.error('Lỗi xử lý dữ liệu cảm biến:', error);
    }
  }, error => console.error('Lỗi lắng nghe cảm biến:', error));

  // Listen for alarms from /device/alarms
  database.ref('device/alarms').on('value', snap => {
    try {
      alarms = [];
      const alarmData = snap.val() || {};
      Object.keys(alarmData).forEach(key => {
        alarms.push({ id: key, ...alarmData[key] });
      });
      renderAlarms();
    } catch (error) {
      console.error('Lỗi xử lý dữ liệu báo thức:', error);
    }
  }, error => console.error('Lỗi lắng nghe báo thức:', error));

  // Initialize default sensor data if not exists
  database.ref('device').once('value', snap => {
    if (!snap.exists()) {
      const defaultData = { temp: 1.0, humi: 0.0 };
      database.ref('device').set(defaultData)
        .then(() => console.log('Khởi tạo dữ liệu cảm biến mặc định'))
        .catch(error => console.error('Lỗi khởi tạo cảm biến:', error));
    }
  }, error => console.error('Lỗi kiểm tra cảm biến:', error));
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
  alarms.forEach(alarm => {
    const alarmItem = document.createElement('div');
    alarmItem.className = 'alarm-item';
    alarmItem.innerHTML = `
      <span>${alarm.month.toString().padStart(2, '0')}/${alarm.day.toString().padStart(2, '0')} ${alarm.hour.toString().padStart(2, '0')}:${alarm.minute.toString().padStart(2, '0')} ${alarm.enabled ? '(On)' : '(Off)'}</span>
      <button class="delete-btn" onclick="deleteAlarm('${alarm.id}')">×</button>
    `;
    elements.alarmList.appendChild(alarmItem);
  });
}

// Save alarm to Firebase
function saveAlarm() {
  const newAlarm = {
    day: parseInt(elements.alarmDay.textContent),
    month: parseInt(elements.alarmMonth.textContent),
    hour: parseInt(elements.alarmHour.textContent),
    minute: parseInt(elements.alarmMinute.textContent),
    enabled: elements.alarmEnable.checked
  };

  const newAlarmRef = database.ref('device/alarms').push();
  newAlarmRef.set(newAlarm)
    .then(() => {
      console.log('Lưu báo thức thành công');
      alert('Báo thức đã được lưu!');
    })
    .catch(error => {
      console.error('Lỗi lưu báo thức:', error);
      alert('Lỗi khi lưu báo thức!');
    });
}

// Delete alarm from Firebase
function deleteAlarm(alarmId) {
  database.ref(`device/alarms/${alarmId}`).remove()
    .then(() => {
      console.log('Xóa báo thức thành công:', alarmId);
      alert('Báo thức đã được xóa!');
    })
    .catch(error => {
      console.error('Lỗi xóa báo thức:', error);
      alert('Lỗi khi xóa báo thức!');
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
  alarms.forEach(alarm => {
    if (
      alarm.enabled &&
      now.getDate() === alarm.day &&
      (now.getMonth() + 1) === alarm.month &&
      now.getHours() === alarm.hour &&
      now.getMinutes() === alarm.minute &&
      now.getSeconds() === 0
    ) {
      triggerAlarm(alarm);
    }
  });
}

// Trigger alarm action
function triggerAlarm(alarm) {
  alert(`Báo thức! ${alarm.month.toString().padStart(2, '0')}/${alarm.day.toString().padStart(2, '0')} ${alarm.hour.toString().padStart(2, '0')}:${alarm.minute.toString().padStart(2, '0')}`);
}

// Adjust alarm settings and sync with Firebase
function adjustAlarm(type, delta) {
  let valueElement;
  let minValue, maxValue;

  switch (type) {
    case 'day':
      valueElement = elements.alarmDay;
      minValue = 1;
      maxValue = 31;
      break;
    case 'month':
      valueElement = elements.alarmMonth;
      minValue = 1;
      maxValue = 12;
      break;
    case 'hour':
      valueElement = elements.alarmHour;
      minValue = 0;
      maxValue = 23;
      break;
    case 'minute':
      valueElement = elements.alarmMinute;
      minValue = 0;
      maxValue = 59;
      break;
    default:
      return;
  }

  let currentValue = parseInt(valueElement.textContent);
  let newValue = currentValue + delta;

  if (newValue < minValue) newValue = minValue;
  if (newValue > maxValue) newValue = maxValue;

  valueElement.textContent = newValue.toString().padStart(2, '0');
}

// Toggle alarm enable (only affects UI, actual enable state is saved with alarm)
function toggleAlarmEnable() {
  const isEnabled = elements.alarmEnable.checked;
  console.log(`Trạng thái báo thức: ${isEnabled}`);
}

// Event listener for alarm enable toggle
elements.alarmEnable.addEventListener('change', toggleAlarmEnable);

// Initialize
window.onload = () => {
  initializeData();
  setInterval(updateClock, 1000);
  updateClock();
};