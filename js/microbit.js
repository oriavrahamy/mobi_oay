/**
 * microbit.js
 * Handles Web Serial API connections to BBC micro:bit and synchronizes
 * physical agent states (LEDs, animations, sensor triggers) with the web app.
 */

window.Microbit = {
  port: null,
  reader: null,
  writer: null,
  keepReading: true,
  isConnected: false,
  currentState: 'IDLE',
  
  // LED Matrix States
  avatars: {
    IDLE: [
      [0, 0, 1, 0, 0],
      [1, 1, 1, 1, 1],
      [1, 0, 1, 0, 1],
      [1, 1, 1, 1, 1],
      [0, 1, 0, 1, 0]
    ],
    THINK_1: [
      [0, 0, 1, 0, 0],
      [1, 1, 1, 1, 1],
      [1, 0, 1, 0, 1],
      [1, 1, 1, 1, 1],
      [0, 1, 0, 1, 0]
    ],
    THINK_2: [
      [0, 0, 0, 0, 0],
      [1, 1, 1, 1, 1],
      [1, 0, 1, 0, 1],
      [1, 1, 1, 1, 1],
      [0, 0, 0, 0, 0]
    ],
    SPEAK: [
      [1, 0, 1, 0, 1],
      [0, 1, 0, 1, 0],
      [1, 0, 1, 0, 1],
      [0, 1, 0, 1, 0],
      [1, 0, 1, 0, 1]
    ]
  },
  
  init() {
    this.bindEvents();
    this.renderVirtualMatrix(this.avatars.IDLE);
    
    // Attempt to automatically connect to previously approved ports
    this.checkExistingPorts();
  },
  
  bindEvents() {
    const connectBtn = document.getElementById('connect-microbit-btn');
    const disconnectBtn = document.getElementById('disconnect-microbit-btn');
    
    if (connectBtn) {
      connectBtn.addEventListener('click', () => this.connect());
    }
    
    if (disconnectBtn) {
      disconnectBtn.addEventListener('click', () => this.disconnect());
    }
    
    // Test Buttons
    const btnTalk = document.getElementById('test-microbit-talk');
    const btnThink = document.getElementById('test-microbit-think');
    const btnIdle = document.getElementById('test-microbit-idle');
    
    if (btnTalk) btnTalk.addEventListener('click', () => this.sendState('SPEAK'));
    if (btnThink) btnThink.addEventListener('click', () => this.sendState('THINK'));
    if (btnIdle) btnIdle.addEventListener('click', () => this.sendState('IDLE'));
    
    const clearLogBtn = document.getElementById('clear-serial-btn');
    if (clearLogBtn) {
      clearLogBtn.addEventListener('click', () => {
        const serialMonitor = document.getElementById('serial-monitor');
        if (serialMonitor) serialMonitor.innerHTML = '';
      });
    }
  },
  
  async checkExistingPorts() {
    if ('serial' in navigator) {
      const ports = await navigator.serial.getPorts();
      if (ports.length > 0) {
        // Just show that there's a known port available, don't auto-connect to avoid unprompted interruptions
        this.logToMonitor("Found previously paired micro:bit. Click 'Connect' to open port.");
      }
    }
  },
  
  async connect() {
    if (!('serial' in navigator)) {
      this.showToast('Web Serial API is not supported in this browser.', 'error');
      return;
    }
    
    try {
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: 115200 });
      this.isConnected = true;
      this.updateUIStatus('connected');
      
      this.logToMonitor('micro:bit connected via Web Serial API at 115200 baud.');
      
      // Setup writer
      const textEncoder = new TextEncoderStream();
      this.writableStreamClosed = textEncoder.readable.pipeTo(this.port.writable);
      this.writer = textEncoder.writable.getWriter();
      
      // Start the reading loop
      this.readLoop();
      
      // Dynamically inject the AI program into the micro:bit
      await this.injectAILogic();
      
      this.sendState('IDLE');
    } catch (err) {
      console.error('micro:bit connection failed:', err);
      this.logToMonitor(`Connection Error: ${err.message}`);
      this.updateUIStatus('disconnected');
    }
  },
  
  async disconnect() {
    this.keepReading = false;
    this.isConnected = false;
    
    // Close reader if active
    if (this.reader) {
      await this.reader.cancel();
      this.reader = null;
    }
    
    // Close writer if active
    if (this.writer) {
      this.writer.releaseLock();
      this.writer = null;
    }
    
    if (this.port) {
      await this.port.close();
      this.port = null;
    }
    
    this.updateUIStatus('disconnected');
    this.logToMonitor('micro:bit disconnected.');
    this.renderVirtualMatrix(this.avatars.IDLE);
    
    // Stop any running animations
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
    }
  },
  
  async readLoop() {
    this.keepReading = true;
    while (this.port && this.port.readable && this.keepReading) {
      const textDecoder = new TextDecoderStream();
      this.readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
      this.reader = textDecoder.readable.getReader();
      
      let buffer = '';
      
      try {
        while (true) {
          const { value, done } = await this.reader.read();
          if (done) {
            break;
          }
          if (value) {
            buffer += value;
            let lines = buffer.split('\\n');
            buffer = lines.pop(); // Keep the last incomplete part in the buffer
            
            for (let line of lines) {
              this.handleIncomingData(line.trim());
            }
          }
        }
      } catch (error) {
        console.error('Serial Read Error:', error);
      } finally {
        this.reader.releaseLock();
      }
    }
  },
  
  handleIncomingData(data) {
    if (!data) return;
    this.logToMonitor(`rx: ${data}`);
    
    if (data === 'CLAP') {
      this.showToast('Your Agent heard you! How can I help?', 'info');
      const orchestratorInput = document.getElementById('orchestrator-input');
      if (orchestratorInput) orchestratorInput.focus();
    } else if (data === 'BTN_A') {
      this.showToast('Button A Pressed - Triggering Action', 'info');
    } else if (data === 'BTN_B') {
      this.showToast('Button B Pressed - Clearing canvas context', 'info');
      const orchestratorInput = document.getElementById('orchestrator-input');
      if (orchestratorInput) orchestratorInput.value = '';
    }
  },
  
  async sendState(state) {
    this.currentState = state;
    this.logToMonitor(`tx: ${state}`);
    
    // Handle Virtual Representation
    this.startVirtualAnimation(state);
    
    if (!this.isConnected || !this.port || !this.port.writable) {
      return;
    }
    
    try {
      await this.writer.write(`${state}\n`);
    } catch (err) {
      console.error('Write error:', err);
      this.disconnect();
    }
  },
  
  startVirtualAnimation(state) {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
    }
    
    if (state === 'IDLE') {
      this.renderVirtualMatrix(this.avatars.IDLE);
    } else if (state === 'THINK') {
      let toggle = false;
      this.animationInterval = setInterval(() => {
        this.renderVirtualMatrix(toggle ? this.avatars.THINK_2 : this.avatars.THINK_1);
        toggle = !toggle;
      }, 300);
    } else if (state === 'SPEAK') {
      this.renderVirtualMatrix(this.avatars.SPEAK);
      setTimeout(() => {
        if (this.currentState === 'SPEAK') {
          this.renderVirtualMatrix(this.avatars.IDLE);
        }
      }, 200);
    }
  },

  async injectAILogic() {
    this.logToMonitor("Injecting AI logic directly into micro:bit...");
    
    const pythonCode = `from microbit import *
import music
AVATAR_IDLE = Image("00900:99999:90909:99999:09090")
AVATAR_THINK_1 = AVATAR_IDLE
AVATAR_THINK_2 = Image("00000:99999:90909:99999:00000")
AVATAR_SPEAK = Image("90909:09090:90909:09090:90909")
current_state = "IDLE"
display.show(AVATAR_IDLE)
def set_state(state):
    global current_state
    current_state = state
    if state == "IDLE":
        display.show(AVATAR_IDLE)
    elif state == "SPEAK":
        display.show(AVATAR_SPEAK)
        sleep(200)
        display.show(AVATAR_IDLE)
think_toggle = False
last_think_time = running_time()
while True:
    if uart.any():
        c = uart.readline()
        if c:
            try:
                cmd = str(c, 'utf-8').strip()
                if cmd in ["IDLE", "THINK", "SPEAK"]:
                    set_state(cmd)
            except: pass
    if current_state == "THINK":
        if running_time() - last_think_time > 300:
            think_toggle = not think_toggle
            if think_toggle: display.show(AVATAR_THINK_2)
            else: display.show(AVATAR_THINK_1)
            last_think_time = running_time()
    if microphone.current_event() == SoundEvent.LOUD:
        print("CLAP")
        display.show(Image.SURPRISED)
        sleep(500)
        display.show(AVATAR_IDLE)
    if button_a.was_pressed():
        print("BTN_A")
        display.show(Image.YES)
        sleep(300)
        set_state(current_state)
    if button_b.was_pressed():
        print("BTN_B")
        display.show(Image.NO)
        sleep(300)
        set_state(current_state)
    sleep(20)
`;

    try {
      // Send Ctrl+C twice to break out of running code
      await this.writer.write('\x03\x03');
      await new Promise(r => setTimeout(r, 200));
      // Enter paste mode (Ctrl+E)
      await this.writer.write('\x05');
      await new Promise(r => setTimeout(r, 100));
      
      // Write the python code line by line to prevent UART buffer overflow
      const lines = pythonCode.split('\n');
      for (const line of lines) {
        await this.writer.write(line + '\n');
        await new Promise(r => setTimeout(r, 15)); // 15ms delay per line
      }
      
      await new Promise(r => setTimeout(r, 100));
      // Execute paste mode (Ctrl+D)
      await this.writer.write('\x04');
      this.logToMonitor("AI logic successfully injected and running!");
    } catch (e) {
      console.error("Injection error:", e);
      this.logToMonitor("Failed to inject AI logic.");
    }
  },
  
  renderVirtualMatrix(matrix) {
    const matrixContainer = document.getElementById('virtual-led-matrix');
    if (!matrixContainer) return;
    
    matrixContainer.innerHTML = '';
    for (let r = 0; r < 5; r++) {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'led-row';
      for (let c = 0; c < 5; c++) {
        const led = document.createElement('div');
        led.className = 'led-dot' + (matrix[r][c] ? ' on' : '');
        rowDiv.appendChild(led);
      }
      matrixContainer.appendChild(rowDiv);
    }
  },
  
  updateUIStatus(status) {
    const indicator = document.getElementById('microbit-status-indicator');
    const text = document.getElementById('microbit-status-text');
    const connectBtn = document.getElementById('connect-microbit-btn');
    const disconnectBtn = document.getElementById('disconnect-microbit-btn');
    
    if (status === 'connected') {
      if (indicator) indicator.style.background = '#4CAF50';
      if (text) text.innerText = 'מחובר';
      if (connectBtn) connectBtn.style.display = 'none';
      if (disconnectBtn) disconnectBtn.style.display = 'inline-flex';
    } else {
      if (indicator) indicator.style.background = '#ccc';
      if (text) text.innerText = 'מנותק';
      if (connectBtn) connectBtn.style.display = 'inline-flex';
      if (disconnectBtn) disconnectBtn.style.display = 'none';
    }
  },
  
  logToMonitor(message) {
    const monitor = document.getElementById('serial-monitor');
    if (!monitor) return;
    
    const emptyMsg = monitor.querySelector('.serial-empty');
    if (emptyMsg) emptyMsg.remove();
    
    const logLine = document.createElement('div');
    logLine.className = 'log-line';
    
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    logLine.innerHTML = `<span class="log-time">[${time}]</span> <span class="log-msg">${message}</span>`;
    
    monitor.appendChild(logLine);
    monitor.scrollTop = monitor.scrollHeight;
  },
  
  showToast(message, type = 'info') {
    // If there's an existing toast system, try to use it.
    // Otherwise fallback to a simple alert.
    console.log(`[Toast: ${type}] ${message}`);
    // Since there is a toast-container in index.html, let's implement a simple toast
    const container = document.getElementById('toast-container');
    if (container) {
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.innerText = message;
      container.appendChild(toast);
      
      // Auto-remove after 3 seconds
      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    } else {
      alert(message);
    }
  }
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  Microbit.init();
});
